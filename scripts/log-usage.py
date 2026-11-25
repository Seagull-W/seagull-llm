#!/usr/bin/env python3
"""Append per-call token/quota usage records for Codex CLI and Antigravity CLI (agy).

Reads:
  - Codex CLI `--json` NDJSON event stream (`codex-events.jsonl`)
  - Antigravity CLI `--output-format json` envelope (`agy-result.json`)

Appends one JSON line to `.research/usage-log.jsonl` (gitignored) and prints a
concise one-line summary for Hermes to include in task handbacks.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOG = ROOT / '.research' / 'usage-log.jsonl'
SHANGHAI = timezone(timedelta(hours=8))


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            try:
                stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass


def int_or_none(val) -> int | None:
    return val if isinstance(val, int) and not isinstance(val, bool) else None


def sum_opt(a: int | None, b: int | None) -> int | None:
    if a is None:
        return b
    if b is None:
        return a
    return a + b


def parse_agy_json(path: Path) -> dict:
    raw = path.read_text(encoding='utf-8-sig').strip()
    if not raw:
        return {'status': 'empty-output'}
    # Handle single JSON envelope or stream-json (take last result object)
    data = None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        for line in reversed(raw.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and ('usage' in obj or obj.get('event') == 'result' or 'status' in obj):
                    data = obj
                    break
            except json.JSONDecodeError:
                continue
    if not isinstance(data, dict):
        return {'status': 'unparsed'}
    usage = data.get('usage') if isinstance(data.get('usage'), dict) else {}
    inp = int_or_none(usage.get('input_tokens'))
    cache_read = int_or_none(usage.get('cache_read_tokens'))
    out = int_or_none(usage.get('output_tokens'))
    thinking = int_or_none(usage.get('thinking_tokens'))
    total = int_or_none(usage.get('total_tokens'))
    if total is None and (inp is not None or out is not None):
        total = (inp or 0) + (out or 0)
    return {
        'conversation_id': data.get('conversation_id'),
        'status': data.get('status') or ('ERROR' if data.get('error') else 'UNKNOWN'),
        'duration_seconds': data.get('duration_seconds'),
        'num_turns': int_or_none(data.get('num_turns')),
        'input_tokens': inp,
        'cache_read_tokens': cache_read,
        'output_tokens': out,
        'thinking_tokens': thinking,
        'total_tokens': total,
        'error': data.get('error'),
    }


def parse_codex_jsonl(path: Path) -> dict:
    raw = path.read_text(encoding='utf-8-sig')
    thread_id = None
    inp = cache_read = out = thinking = total = None
    turns = 0
    errors: list[str] = []
    rate_limit_note = None

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(ev, dict):
            continue
        ev_type = ev.get('type') or ''
        if ev_type == 'thread.started' and ev.get('thread_id'):
            thread_id = ev['thread_id']
        if ev_type in ('error', 'turn.failed'):
            msg = ev.get('message') or (ev.get('error') or {}).get('message') or str(ev.get('error') or '')
            if msg:
                errors.append(msg)
        usage = ev.get('usage')
        if not isinstance(usage, dict) and isinstance(ev.get('msg'), dict):
            usage = ev['msg'].get('usage')
        if isinstance(usage, dict):
            turns += 1
            inp = sum_opt(inp, int_or_none(usage.get('input_tokens')))
            cache_read = sum_opt(
                cache_read,
                int_or_none(usage.get('cached_input_tokens'))
                if 'cached_input_tokens' in usage
                else int_or_none(usage.get('cache_read_tokens')),
            )
            out = sum_opt(out, int_or_none(usage.get('output_tokens')))
            thinking = sum_opt(
                thinking,
                int_or_none(usage.get('reasoning_output_tokens'))
                if 'reasoning_output_tokens' in usage
                else int_or_none(usage.get('thinking_tokens')),
            )
            total = sum_opt(total, int_or_none(usage.get('total_tokens')))
        if isinstance(ev.get('rate_limits'), dict):
            rate_limit_note = json.dumps(ev['rate_limits'], ensure_ascii=False)

    if total is None and (inp is not None or out is not None):
        total = (inp or 0) + (out or 0)

    return {
        'conversation_id': thread_id,
        'status': 'ERROR' if errors else ('SUCCESS' if turns > 0 or thread_id else 'UNKNOWN'),
        'duration_seconds': None,
        'num_turns': turns or None,
        'input_tokens': inp,
        'cache_read_tokens': cache_read,
        'output_tokens': out,
        'thinking_tokens': thinking,
        'total_tokens': total,
        'error': '; '.join(errors) if errors else None,
        'rate_limit_note': rate_limit_note,
    }


def fmt_num(n: int | float | None) -> str:
    if n is None:
        return '-'
    if isinstance(n, float):
        return f'{n:.1f}'
    return f'{n:,}'


def format_one_line(rec: dict) -> str:
    parts = [
        f"[{rec['tool']}/{rec['stage']}]",
        f"model={rec['model']}" + (f"({rec['effort']})" if rec.get('effort') else ''),
        f"status={rec['status']}",
        f"in={fmt_num(rec.get('input_tokens'))}",
        f"cache={fmt_num(rec.get('cache_read_tokens'))}",
        f"out={fmt_num(rec.get('output_tokens'))}",
    ]
    if rec.get('thinking_tokens') is not None:
        parts.append(f"think={fmt_num(rec['thinking_tokens'])}")
    parts.append(f"total={fmt_num(rec.get('total_tokens'))}")
    if rec.get('duration_seconds') is not None:
        parts.append(f"time={fmt_num(rec['duration_seconds'])}s")
    if rec.get('quota_note'):
        parts.append(f"quota={rec['quota_note']}")
    return ' | '.join(parts)


def cmd_summary(log_path: Path, last: int, task_filter: str | None) -> int:
    if not log_path.is_file():
        print('No usage records yet:', log_path)
        return 0
    rows = []
    for line in log_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if task_filter and rec.get('task') != task_filter:
            continue
        rows.append(rec)
    picked = rows[-last:] if last > 0 else rows
    if not picked:
        print('No matching usage records.')
        return 0
    tot_in = sum(r.get('input_tokens') or 0 for r in picked)
    tot_out = sum(r.get('output_tokens') or 0 for r in picked)
    tot_all = sum(r.get('total_tokens') or 0 for r in picked)
    print(f'# Usage Log Summary ({len(picked)} runs; total_in={tot_in:,}, total_out={tot_out:,}, total={tot_all:,})')
    for r in picked:
        ts = (r.get('timestamp') or '')[:16].replace('T', ' ')
        print(f"- {ts} | task={r.get('task')} | {format_one_line(r)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    configure_stdio()
    p = argparse.ArgumentParser(description='Record and summarize Codex / Antigravity CLI token & quota usage')
    p.add_argument('--log', default=str(DEFAULT_LOG), help='Path to JSONL usage log')
    p.add_argument('--summary', action='store_true', help='Show recent usage summary instead of appending')
    p.add_argument('--last', type=int, default=10, help='Number of recent entries for --summary')
    p.add_argument('--tool', choices=('codex', 'agy'))
    p.add_argument('--stage', default='run', help='e.g. research, write, revise')
    p.add_argument('--task', default='default', help='Task slug or directory name')
    p.add_argument('--model', default='unknown', help='Actual model name passed to CLI')
    p.add_argument('--effort', default='', help='Reasoning effort (e.g. medium, high)')
    p.add_argument('--input', dest='input_file', help='Path to codex-events.jsonl or agy-result.json')
    p.add_argument('--exit-code', type=int, help='CLI process exit code')
    p.add_argument('--duration-s', type=float, help='Wall-clock seconds (optional override)')
    p.add_argument('--quota-note', default='', help='Optional remaining quota / credit / rate-limit note')
    args = p.parse_args(argv)

    log_path = Path(args.log)
    if args.summary:
        return cmd_summary(log_path, args.last, args.task if args.task != 'default' else None)

    if not args.tool:
        p.error('--tool is required unless --summary is set')

    parsed = {}
    if args.input_file:
        ip = Path(args.input_file)
        if ip.is_file():
            parsed = parse_codex_jsonl(ip) if args.tool == 'codex' else parse_agy_json(ip)
        else:
            parsed = {'status': 'missing-input'}
    else:
        parsed = {'status': 'manual-record'}

    quota_note = args.quota_note.strip()
    if parsed.get('rate_limit_note'):
        quota_note = (quota_note + '; ' if quota_note else '') + parsed['rate_limit_note']

    status = parsed.get('status') or 'UNKNOWN'
    if args.exit_code is not None and args.exit_code != 0 and status == 'SUCCESS':
        status = f'EXIT_{args.exit_code}'

    record = {
        'timestamp': datetime.now(SHANGHAI).isoformat(timespec='seconds'),
        'task': args.task,
        'stage': args.stage,
        'tool': args.tool,
        'model': args.model,
        'effort': args.effort,
        'conversation_id': parsed.get('conversation_id'),
        'status': status,
        'exit_code': args.exit_code,
        'duration_seconds': args.duration_s if args.duration_s is not None else parsed.get('duration_seconds'),
        'num_turns': parsed.get('num_turns'),
        'input_tokens': parsed.get('input_tokens'),
        'cache_read_tokens': parsed.get('cache_read_tokens'),
        'output_tokens': parsed.get('output_tokens'),
        'thinking_tokens': parsed.get('thinking_tokens'),
        'total_tokens': parsed.get('total_tokens'),
        'quota_note': quota_note or None,
        'error': parsed.get('error'),
        'source_file': str(args.input_file) if args.input_file else None,
    }

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open('a', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')

    print(format_one_line(record))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
