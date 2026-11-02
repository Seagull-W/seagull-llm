"""Batch driver: iterate over model sizes x modes and aggregate benchmark results.

For each (model_size, mode) pair it runs benchmark.py in a fresh subprocess:
  - each combo gets isolated GPU memory, so an OOM in one combo cannot
    corrupt the others, and every measurement starts from a clean CUDA state;
  - a crashed combo (e.g. CUDA out-of-memory on a small GPU) is recorded as
    OOM and the sweep continues.

Output:
  - console: progress + a markdown table (mean ± std, CV%) per size x mode,
    plus derived backward time (t_for_bac - t_forward) and optimizer time
    (t_full - t_for_bac);
  - files: <output>.csv and <output>.md with the same table.

Usage (from the assignment2-systems directory):
    uv run python run_benchmarks.py                                   # small,medium,large,xl x 3 modes
    uv run python run_benchmarks.py --model-sizes small,medium        # subset
    uv run python run_benchmarks.py --modes forward,full
    uv run python run_benchmarks.py --autocast                        # bf16 mixed precision
"""
import argparse
import csv
import json
import os
import subprocess
import sys

# Keep in sync with benchmark.py (it is the source of truth).
MODEL_SIZES = ("small", "medium", "large", "xl", "10b")
MODES = ("forward", "for_bac", "full")

CSV_HEADER = [
    "model_size", "mode", "context_length", "batch_size",
    "warmup", "num_steps", "autocast",
    "mean_s", "std_s", "cv_percent", "n_params", "status",
]

STATUS_OK = "ok"
STATUS_OOM = "oom"
STATUS_FAIL = "fail"


def run_combo(python: str, script: str, args: dict) -> dict:
    """Run one benchmark.py invocation and return the parsed result row."""
    cmd = [python, script]
    for key, value in args.items():
        flag = f"--{key.replace('_', '-')}"  # model_size -> --model-size
        if isinstance(value, bool):
            if value:
                cmd.append(flag)
        else:
            cmd += [flag, str(value)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    stderr = (proc.stderr or "").lower()
    if proc.returncode != 0:
        if "out of memory" in stderr or "cuda oom" in stderr or "cuda error" in stderr:
            return {**args, "status": STATUS_OOM, "mean_s": None, "std_s": None,
                    "cv_percent": None, "n_params": None}
        print(f"    [fail] returncode={proc.returncode}", file=sys.stderr)
        print(proc.stderr[-2000:] if proc.stderr else "", file=sys.stderr)
        return {**args, "status": STATUS_FAIL, "mean_s": None, "std_s": None,
                "cv_percent": None, "n_params": None}

    for line in proc.stdout.splitlines():
        if line.startswith("RESULT_JSON\t"):
            payload = json.loads(line[len("RESULT_JSON\t"):])
            return {
                "model_size": payload["model_size"],
                "mode": payload["mode"],
                "context_length": payload["context_length"],
                "batch_size": payload["batch_size"],
                "warmup": payload["warmup"],
                "num_steps": payload["num_steps"],
                "autocast": payload["autocast"],
                "mean_s": payload["mean"],
                "std_s": payload["std"],
                "cv_percent": payload["cv_percent"],
                "n_params": payload["n_params"],
                "status": STATUS_OK,
            }
    print(f"    [fail] no RESULT_JSON found in output:\n{proc.stdout}", file=sys.stderr)
    return {**args, "status": STATUS_FAIL, "mean_s": None, "std_s": None,
            "cv_percent": None, "n_params": None}


def fmt(v, suffix=" s"):
    return f"{v:.4f}{suffix}" if v is not None else "-"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model-sizes", type=str,
                   default=",".join(MODEL_SIZES[:4]),  # 10b is leaderboard-only
                   help="comma-separated subset of " + ",".join(MODEL_SIZES))
    p.add_argument("--modes", type=str, default=",".join(MODES))
    p.add_argument("--context-length", type=int, default=512)
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument("--warmup", type=int, default=5)
    p.add_argument("--num-steps", type=int, default=10)
    p.add_argument("--autocast", action="store_true", help="bf16 mixed precision")
    p.add_argument("--output", type=str, default="benchmark_results")
    args = p.parse_args()

    sizes = [s.strip() for s in args.model_sizes.split(",") if s.strip()]
    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    for s in sizes:
        assert s in MODEL_SIZES, f"unknown model size: {s}"
    for m in modes:
        assert m in MODES, f"unknown mode: {m}"

    combos = [(s, m) for s in sizes for m in modes]
    total = len(combos)
    print(f"Sweeping {total} combos: sizes={sizes} modes={modes} "
          f"(warmup={args.warmup}, steps={args.num_steps}, ctx={args.context_length}, "
          f"batch={args.batch_size}, autocast={args.autocast})\n")

    python = sys.executable  # we run inside the uv venv, so this is the venv python
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "benchmark.py")
    results = []
    for i, (size, mode) in enumerate(combos, start=1):
        print(f"[{i:2d}/{total}] {size:6s} x {mode:7s} ...", end=" ", flush=True)
        row = run_combo(python, script, dict(
            model_size=size, mode=mode,
            context_length=args.context_length, batch_size=args.batch_size,
            warmup=args.warmup, num_steps=args.num_steps, autocast=args.autocast,
        ))
        status_tag = {"ok": "OK", "oom": "OOM", "fail": "FAIL"}[row["status"]]
        if row["status"] == STATUS_OK:
            print(f"{row['mean_s']:.4f} s ± {row['std_s']:.4f}  [{status_tag}]")
        else:
            print(f"---  [{status_tag}]")
        results.append(row)

    # --- report -----------------------------------------------------------
    lines = []
    lines.append(f"# Benchmark results (warmup={args.warmup}, steps={args.num_steps}, "
                 f"context={args.context_length}, batch={args.batch_size}, "
                 f"autocast={args.autocast})")
    lines.append("")
    lines.append("mean ± std per step (s); CV = std/mean in %")
    lines.append("")
    lines.append("| model | mode | mean (s) | std (s) | CV (%) | params | status |")
    lines.append("|-------|------|----------|---------|--------|--------|--------|")
    for size in sizes:
        for mode in modes:
            row = next(r for r in results if r["model_size"] == size and r["mode"] == mode)
            if row["status"] == STATUS_OK:
                lines.append(
                    f"| {size} | {mode} | {fmt(row['mean_s'], '')} | {fmt(row['std_s'], '')} | "
                    f"{row['cv_percent']:.1f} | {row['n_params']} | ok |"
                )
            else:
                lines.append(
                    f"| {size} | {mode} | - | - | - | - | {row['status']} |"
                )

    # derived times (differences of independent means)
    lines.append("")
    lines.append("Derived per-pass times (s): backward ≈ t(for_bac) − t(forward), "
                 "optimizer ≈ t(full) − t(for_bac)")
    lines.append("")
    lines.append("| model | forward | backward | optimizer | full step |")
    lines.append("|-------|---------|----------|-----------|-----------|")
    for size in sizes:
        by_mode = {r["mode"]: r for r in results
                   if r["model_size"] == size and r["status"] == STATUS_OK}
        if "forward" in by_mode and "for_bac" in by_mode and "full" in by_mode:
            fwd, fb, full = (by_mode["forward"]["mean_s"],
                             by_mode["for_bac"]["mean_s"],
                             by_mode["full"]["mean_s"])
            lines.append(f"| {size} | {fmt(fwd)} | {fmt(fb - fwd)} | {fmt(full - fb)} | {fmt(full)} |")
        else:
            missing = [m for m in ("forward", "for_bac", "full") if m not in by_mode]
            lines.append(f"| {size} | - | - | - | - (missing: {', '.join(missing)}) |")

    report = "\n".join(lines)
    print("\n" + "=" * 78)
    print(report)
    print("=" * 78)

    with open(f"{args.output}.md", "w", encoding="utf-8") as f:
        f.write(report + "\n")
    with open(f"{args.output}.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADER, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            writer.writerow({k: r.get(k) for k in CSV_HEADER})
    print(f"\nSaved {args.output}.md and {args.output}.csv")


if __name__ == "__main__":
    main()
