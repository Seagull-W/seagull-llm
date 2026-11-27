"""Offline ToolACE cross entropy on assistant tokens, including EOS."""

import asyncio

from toolace import prompt_ids
from training import datum, train


async def setup(service, trainer, a):
    tok = trainer.get_tokenizer()

    async def make_batch(step, rows):
        ds = []
        supervised = inputs = 0
        for row in rows:
            p = prompt_ids(tok, row)
            c = tok.encode(row["assistant"], add_special_tokens=False) + [
                tok.eos_token_id
            ]
            if len(p + c) > a.max_length:
                raise ValueError(
                    f"{row['id']} exceeds max_length; refusing to clip the target"
                )
            ds.append(
                datum(
                    (p + c)[:-1], (p + c)[1:], weights=[0] * (len(p) - 1) + [1] * len(c)
                )
            )
            supervised += len(c)
            inputs += len(p + c) - 1
        return (
            ds,
            dict(supervised_tokens=supervised),
            dict(training_input_tokens=inputs),
        )

    return make_batch


if __name__ == "__main__":
    asyncio.run(train("sft", setup))
