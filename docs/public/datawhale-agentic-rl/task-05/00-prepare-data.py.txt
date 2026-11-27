"""Build and validate the deterministic ToolACE splits, using the configured HF_ENDPOINT."""

import json
import random
from collections import Counter
from statistics import mean

from datasets import load_dataset
from huggingface_hub import hf_hub_download

from toolace import PARSE_ERRORS, ROOT, parse_call, save_rows, score

MARKER = "Here is a list of functions in JSON format that you can invoke:\n"
REVISION = "6bda777c88d21e5a204703c1ee45597a8fa4f734"


def convert(index, row):
    system = row["system"]
    turns = row["conversations"]
    if MARKER not in system or len(system) > 2500 or len(turns) < 2:
        return None
    user, assistant = turns[:2]
    if (user["from"], assistant["from"]) != ("user", "assistant"):
        return None
    user, answer = user["value"].strip(), assistant["value"].strip()
    if not user or len(answer) > 400:
        return None
    try:
        tools, _ = json.JSONDecoder().raw_decode(system.split(MARKER, 1)[1].lstrip())
        names = [tool["name"] for tool in tools]
        name, _ = parse_call(answer)
    except (*PARSE_ERRORS, KeyError):
        return None
    if not 2 <= len(names) <= 5 or name not in names:
        return None
    return dict(
        id=f"toolace-{index:05d}",
        system=system,
        user=user,
        assistant=answer,
        tool_names=names,
    )


def main():
    path = hf_hub_download(
        "Team-ACE/ToolACE", "data.json", repo_type="dataset", revision=REVISION
    )
    data = load_dataset("json", data_files={"train": path}, split="train")
    pool = [record for i, row in enumerate(data) if (record := convert(i, row))]
    random.Random(42).shuffle(pool)
    unique = {}
    for row in pool:
        unique.setdefault(" ".join(row["user"].casefold().split()), row)
    rows = list(unique.values())
    if len(rows) < 260:
        raise ValueError(f"only {len(rows)} eligible unique requests")
    print(f"source={len(data)} filtered={len(pool)} unique={len(rows)}")
    for name, split in (("train", rows[:200]), ("eval", rows[200:260])):
        assert all(
            all(row.values())
            and score(row["assistant"], row["assistant"], False)["exact_ast_match"]
            for row in split
        )
        save_rows(ROOT / "datasets" / f"{name}.jsonl", split)
        print(
            name,
            len(split),
            {
                key: round(mean(len(r[key]) for r in split), 1)
                for key in ("system", "user", "assistant")
            },
            "gold AST 100%",
        )
    assert (
        len(Counter(" ".join(r["user"].casefold().split()) for r in rows[:260])) == 260
    )


if __name__ == "__main__":
    main()
