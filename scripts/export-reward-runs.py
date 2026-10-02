"""Export two explicit W&B runs without sampled history or stored credentials.

Run on the training server (where wandb is already installed and authenticated):
python scripts/export-reward-runs.py --bf16 ENTITY/PROJECT/RUN_ID --f32 ENTITY/PROJECT/RUN_ID
"""
import argparse
import datetime
import json
import math
from pathlib import Path

METRICS = [f"{split}/{metric}" for split in ("train", "val") for metric in
           ("loss", "accuracy", "r_chosen_mean", "r_rejected_mean", "reward_margin")]
METRICS.append("train/lr")
CONFIG_KEYS = ("model_id", "freeze_backbone", "dataset_name", "dataset_split", "samples",
               "max_length", "batch_size", "grad_accum_steps", "epochs", "lr", "warmup_ratio",
               "lr_scheduler", "val_ratio", "eval_interval", "seed", "device", "precision",
               "dtype", "torch_dtype", "bf16", "fp16", "mixed_precision")


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def export_run(api, path, label):
    run = api.run(path)
    curves = {key: {} for key in METRICS}
    # Do not pass keys: scan_history(keys=...) would omit sparse evaluation rows.
    for row in run.scan_history(page_size=1000):
        step = row.get("global_step", row.get("_step"))
        if not number(step):
            continue
        for key in METRICS:
            if number(row.get(key)):
                curves[key][step] = row[key]
    metrics = {key: [{"step": step, "value": value} for step, value in sorted(points.items())]
               for key, points in curves.items() if points}
    if not metrics:
        raise ValueError(f"{label}: no supported numeric metrics; check the run ID and metric names")
    return {"id": run.id, "label": label, "name": run.name, "url": run.url,
            "state": run.state, "config": {key: run.config[key] for key in CONFIG_KEYS if key in run.config},
            "metrics": metrics}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bf16", required=True, help="entity/project/run_id")
    parser.add_argument("--f32", required=True, help="entity/project/run_id")
    parser.add_argument("--base-url", default="https://forge.coreweave.com/api/wandb")
    parser.add_argument("--output", type=Path, default=Path("docs/public/experiments/reward-model-runs.json"))
    args = parser.parse_args()
    if args.bf16 == args.f32:
        parser.error("bf16 and f32 must be distinct runs")
    import wandb
    api = wandb.Api(overrides={"base_url": args.base_url}, timeout=60)
    runs = [export_run(api, args.bf16, "bf16"), export_run(api, args.f32, "f32")]
    payload = {"version": 1, "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "source": "W&B scan_history (unsampled)", "stepKey": "global_step or _step",
               "runs": runs}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    for run in runs:
        print(f"{run['label']}: {run['id']}, {sum(len(points) for points in run['metrics'].values())} metric points")
    print(f"Exported to {args.output}")


if __name__ == "__main__":
    main()
