"""Import the two reward-model runs from W&B chart CSV exports.

Blank cells remain missing. MIN/MAX columns are checked to reject aggregated
exports, rather than presenting aggregate values as individual measurements.
"""
import csv
import datetime
import json
import math
import shutil
from pathlib import Path

SOURCE = Path('docs/rl-book/expriment_data/reward_model')
OUTPUT = Path('docs/public/experiments')
FILES = {
    'train/loss': 'train_loss.csv', 'train/accuracy': 'train_accu.csv',
    'train/lr': 'trainlr.csv', 'train/reward_margin': 'trainreward_margin.csv',
    'train/r_chosen_mean': 'trainr_chosen_mean.csv',
    'train/r_rejected_mean': 'trainr_rejected_mean.csv',
    'val/loss': 'val_loss.csv', 'val/accuracy': 'val_accu.csv',
    'val/reward_margin': 'valreward_margin.csv',
    'val/r_chosen_mean': 'valr_chosen_mean.csv',
    'val/r_rejected_mean': 'valr_rejected_mean.csv',
}


def read_points(rows, column):
    points = []
    seen = set()
    for row in rows:
        if not row[column].strip():
            continue
        step, value = float(row['Step']), float(row[column])
        if not math.isfinite(step) or not math.isfinite(value) or step < 0:
            raise ValueError(f'{column}: non-finite value or invalid Step')
        if step in seen:
            raise ValueError(f'{column}: duplicate Step {step}')
        seen.add(step)
        for suffix in ('__MIN', '__MAX'):
            bound = row.get(column + suffix, '')
            if bound.strip() and float(bound) != value:
                raise ValueError(f'{column}: aggregated export at Step {step}; export full-resolution CSV')
        points.append({'step': int(step) if step.is_integer() else step, 'value': value})
    if not points:
        raise ValueError(f'{column}: missing data')
    return sorted(points, key=lambda point: point['step'])


def main():
    manifest = json.loads((OUTPUT / 'reward-model-svg/index.json').read_text(encoding='utf-8'))
    runs = [{**run, 'state': '未提供', 'config': {}, 'metrics': {}} for run in manifest['runs']]
    metric_files = {}
    # Validate everything before writing any output.
    for metric, filename in FILES.items():
        with (SOURCE / filename).open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames or reader.fieldnames[0] != 'Step':
                raise ValueError(f'{filename}: expected Step axis')
            rows = list(reader)
        for run in runs:
            column = f"{run['name']} - {metric}"
            if column not in reader.fieldnames:
                raise ValueError(f'{filename}: missing expected run column {column}')
            run['metrics'][metric] = read_points(rows, column)
        metric_files[metric] = f"/experiments/reward-model-csv/{metric.replace('/', '-')}.csv"
    payload = {'version': 1, 'exportedAt': None,
               'processedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'source': 'W&B chart CSV exports; original value columns; MIN/MAX verified equal',
               'stepKey': 'Step', 'metricFiles': metric_files, 'runs': runs}
    (OUTPUT / 'reward-model-csv').mkdir(parents=True, exist_ok=True)
    for metric, filename in FILES.items():
        shutil.copyfile(SOURCE / filename, OUTPUT / 'reward-model-csv' / f"{metric.replace('/', '-')}.csv")
    (OUTPUT / 'reward-model-runs.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    for run in runs:
        print(f"{run['label']}: {len(run['metrics']['train/loss'])} training points, {len(run['metrics']['val/loss'])} validation points per metric")


if __name__ == '__main__':
    main()
