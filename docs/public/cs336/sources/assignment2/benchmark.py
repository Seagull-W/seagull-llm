"""Basic end-to-end benchmarking of forward / forward+backward / full training steps.

Usage (from the assignment2-systems directory):
    uv run python benchmark.py --model-size small  --mode forward
    uv run python benchmark.py --model-size medium --mode for_bac --warmup 5 --num-steps 10
    uv run python benchmark.py --model-size xl     --mode full    --autocast

Modes:
    forward   : forward pass only (inference-style, under torch.no_grad)
    for_bac   : forward + loss + backward pass (no optimizer)
    full      : forward + backward + optimizer step (AdamW)

For reproducible GPU timings:
    - every step is followed by torch.cuda.synchronize() (CUDA is async)
    - timing uses timeit.default_timer() (highest-resolution clock)
    - warmup steps run before measurement so lazy init / cuDNN autotune /
      caching / allocator growth happen before the clock starts

On success the script prints a machine-readable line for batch drivers:
    RESULT_JSON\t{...}
"""
import argparse
import contextlib
import json
import statistics
import timeit
import torch.cuda.nvtx as nvtx
import torch
import cs336_basics
from cs336_basics import AdamW, BasicsTransformerLM

import logging
import math
import os
import warnings

import einx
from einops import einsum, rearrange
from jaxtyping import Bool, Float, Int
from torch import Tensor
from cs336_basics.nn_utils import softmax

VOCAB_SIZE = 10_000  # §2.1.2: vocab 10k, batch 4 for all models except the leaderboard

# Table 1 in §2.1.2 (d_model / d_ff / num_layers / num_heads)
MODEL_SIZES = {
    "small":  dict(d_model=768,  d_ff=3072,  num_layers=12, num_heads=12),
    "medium": dict(d_model=1024, d_ff=4096,  num_layers=24, num_heads=16),
    "large":  dict(d_model=1280, d_ff=5120,  num_layers=36, num_heads=20),
    "xl":     dict(d_model=2560, d_ff=10240, num_layers=32, num_heads=32),
    # leaderboard-only model (4608 = 36 heads * 128 head_dim); not part of §2.1.2(b)
    "10b":    dict(d_model=4608, d_ff=12288, num_layers=50, num_heads=36),
}

MODES = ("forward", "for_bac", "full")

@nvtx.range("scaled dot product attention")
def annotated_scaled_dot_product_attention(
    Q: Float[Tensor, " ... queries d_k"],
    K: Float[Tensor, " ... keys    d_k"],
    V: Float[Tensor, " ... keys    d_v"],
    mask: Bool[Tensor, " ... queries keys"] | None = None,
) -> Float[Tensor, " ... queries d_v"]:
    d_k = K.shape[-1]
    with nvtx.range("computing attention scores"):
        # compute attention scores between Q and K
        attention_scores = einsum(Q, K, "... query d_k, ... key d_k -> ... query key") / math.sqrt(d_k)
    if mask is not None:
        attention_scores = torch.where(mask, attention_scores, float("-inf"))
    with nvtx.range("computing softmax"):
    # compute softmax of attention scores
        attention_weights = softmax(attention_scores, dim=-1)  # Softmax over the key dimension
    with nvtx.range("final matmul"):
        return einsum(attention_weights, V, "... query key, ... key d_v ->  ... query d_v")

cs336_basics.model.scaled_dot_product_attention = annotated_scaled_dot_product_attention

def build_model(size: str, context_length: int, device: torch.device):
    cfg = MODEL_SIZES[size]
    return BasicsTransformerLM(
        vocab_size=VOCAB_SIZE,
        context_length=context_length,
        d_model=cfg["d_model"],
        d_ff=cfg["d_ff"],
        num_layers=cfg["num_layers"],
        num_heads=cfg["num_heads"],
    ).to(device)


def benchmark(
    size: str,
    mode: str,
    context_length: int,
    batch_size: int,
    warmup: int,
    num_steps: int,
    autocast: bool,
    device: torch.device,
) -> tuple[list[float], int]:
    """Run `warmup` untimed steps then `num_steps` timed steps.

    Returns (per-step wall-clock seconds, model parameter count).
    Raises torch.cuda.OutOfMemoryError if the configuration does not fit.
    """
    model = build_model(size, context_length, device)
    optimizer = AdamW(model.parameters())
    x = torch.randint(0, VOCAB_SIZE, (batch_size, context_length), device=device)

    cast_ctx = (
        lambda: torch.autocast(device_type=device.type, dtype=torch.bfloat16)
        if autocast
        else contextlib.nullcontext()
    )
    # forward-only: no autograd graph is built, matching inference
    grad_ctx = torch.no_grad if mode == "forward" else contextlib.nullcontext

    def step() -> None:
        with cast_ctx(), grad_ctx():
            nvtx.range_push('forward')
            logits = model(x)
            nvtx.range_pop()
            if mode != "forward":
                loss = torch.nn.functional.cross_entropy(
                    logits.view(-1, VOCAB_SIZE), x.view(-1)
                )
        if mode != "forward":
            nvtx.range_push('backward')
            loss.backward()
            nvtx.range_pop()
            if mode == "full":
                nvtx.range_push('optimizer')
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)
                nvtx.range_pop()

    with nvtx.range('warmup'):
        for _ in range(warmup):
            step()
        torch.cuda.synchronize()  # flush warmup work before the clock starts

    times = []
    for _ in range(num_steps):
        t0 = timeit.default_timer()
        step()
        torch.cuda.synchronize()
        times.append(timeit.default_timer() - t0)

    n_params = sum(p.numel() for p in model.parameters())
    return times, n_params


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model-size", choices=list(MODEL_SIZES), required=True)
    p.add_argument("--mode", choices=MODES, required=True)
    p.add_argument("--context-length", type=int, default=512)
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument("--warmup", type=int, default=5)
    p.add_argument("--num-steps", type=int, default=10)
    p.add_argument("--autocast", action="store_true",
                   help="wrap forward in torch.autocast(dtype=bfloat16)")
    args = p.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cpu":
        print("[warning] CUDA not available; timing reflects CPU execution", file=__import__("sys").stderr)

    times, n_params = benchmark(
        size=args.model_size,
        mode=args.mode,
        context_length=args.context_length,
        batch_size=args.batch_size,
        warmup=args.warmup,
        num_steps=args.num_steps,
        autocast=args.autocast,
        device=device,
    )

    mean = statistics.fmean(times)
    std = statistics.stdev(times) if len(times) > 1 else 0.0
    cv = (std / mean * 100.0) if mean > 0 else 0.0  # coefficient of variation, %

    print(
        f"[{args.model_size:6s} | {args.mode:7s}] warmup={args.warmup} steps="
        f"{args.num_steps} -> mean={mean:.6f} s  std={std:.6f} s  "
        f"(CV={cv:.1f}%)  params={n_params:,}"
    )
    result = {
        "model_size": args.model_size,
        "mode": args.mode,
        "context_length": args.context_length,
        "batch_size": args.batch_size,
        "warmup": args.warmup,
        "num_steps": args.num_steps,
        "autocast": args.autocast,
        "mean": mean,
        "std": std,
        "cv_percent": cv,
        "n_params": n_params,
        "times": times,
    }
    print("RESULT_JSON\t" + json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
