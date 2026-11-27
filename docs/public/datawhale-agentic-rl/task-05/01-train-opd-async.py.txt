"""Prompt-only ToolACE OPD with a frozen teacher scoring each sampled token."""

import asyncio

import numpy as np
import pytrio as trio

from toolace import capped, prompt_ids
from training import datum, train


async def setup(service, trainer, a):
    tok = trainer.get_tokenizer()
    teacher = await service.create_sampling_client_async(
        base_model=a.teacher_base_model
    )
    teacher_tok = teacher.get_tokenizer()
    teacher_vocab = teacher_tok.get_vocab()
    incompatible = {
        i for token, i in tok.get_vocab().items() if teacher_vocab.get(token) != i
    }
    sem = asyncio.Semaphore(a.concurrency)
    params = trio.SamplingParams(
        max_tokens=a.max_tokens,
        seed=42,
        temperature=a.temperature,
        top_p=a.top_p,
        top_k=a.top_k,
        stop=[tok.eos_token],
    )
    sampler = None

    async def teach(p, seq):
        c = seq.tokens
        if not c or len(seq.logprobs) != len(c) or incompatible.intersection(p + c):
            raise ValueError("empty or incompatible rollout")
        async with sem:
            scores = await teacher.compute_logprobs_async(
                trio.ModelInput.from_ints(p + c)
            )
        target = scores[len(p) :]
        if len(target) != len(c) or None in target:
            raise ValueError("invalid teacher completion scores")
        kl = np.asarray(seq.logprobs) - np.asarray(target)
        if not np.isfinite(kl).all():
            raise ValueError("non-finite log probability")
        pad = [0] * (len(p) - 1)
        d = datum(
            p + c[:-1],
            pad + c,
            logprobs=pad + seq.logprobs,
            advantages=pad + (-a.kl_penalty_coef * kl).tolist(),
        )
        return d, kl, capped(seq, tok, a.max_tokens)

    async def sample(row):
        p = prompt_ids(tok, row)
        async with sem:
            result = await sampler.sample_async(
                prompt=trio.ModelInput.from_ints(p),
                num_samples=a.group_size,
                sampling_params=params,
                return_text=False,
            )
        if len(result.sequences) != a.group_size:
            raise ValueError("incomplete sample group")
        trajectories = await asyncio.gather(
            *(teach(p, seq) for seq in result.sequences)
        )
        return result.input_tokens or len(p), len(p), trajectories

    async def make_batch(step, rows):
        nonlocal sampler
        if step % a.sampler_refresh_steps == 0:
            sampler = await trainer.save_weights_and_get_sampling_client_async()
        groups = await asyncio.gather(*(sample(row) for row in rows))
        paths = [path for _, _, group in groups for path in group]
        ds, kls, flags = zip(*paths)
        kl = np.concatenate(kls)
        teacher_inputs = sum(p * len(group) for _, p, group in groups) + len(kl)
        return (
            list(ds),
            dict(
                reverse_kl_mean=float(kl.mean()),
                reverse_kl_std=float(kl.std()),
                truncation_rate=float(np.mean(flags)),
                completion_tokens_mean=len(kl) / len(ds),
            ),
            dict(
                prompt_tokens_total=sum(reported for reported, _, _ in groups),
                completion_tokens_total=len(kl),
                teacher_input_tokens=teacher_inputs,
                training_input_tokens=teacher_inputs - len(ds),
            ),
        )

    return make_batch


if __name__ == "__main__":
    asyncio.run(train("opd", setup))
