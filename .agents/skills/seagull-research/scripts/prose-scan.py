#!/usr/bin/env python3
"""List an article's structure and negation sites for a human read.

Prints: heading tree, characters per section, and every defensive-negation
or "not X but Y" contrast with its line number and surrounding text.
It assigns no score and fails on nothing. Matches are candidates, not
diagnoses; review their meaning with readable-survey.md.

Usage: python3 prose-scan.py docs/research/<article>.md
"""

import pathlib
import re
import sys

PATTERNS = (
    "不等于", "不意味着", "不代表", "不能据此", "不能推出", "不足以",
    "并非", "不只是", "不仅仅是", "未必", "不自动", "并不构成",
    "也不能", "仍不能", "不是[^。]{0,18}而是",
)


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            return parts[2]
    return text


def main(path: str) -> None:
    body = strip_frontmatter(pathlib.Path(path).read_text(encoding="utf-8"))
    body = re.split(r"\n## 来源与阅读范围", body)[0]

    headings = [line for line in body.splitlines() if re.match(r"^#{1,3} ", line)]
    print("== 节标题 ==")
    for line in headings:
        print("  " + line)

    print("\n== 各节字符数（含 Markdown 标记、表格与图注） ==")
    for chunk in re.split(r"\n(?=## )", body):
        head = chunk.strip().split("\n")[0][:44]
        print(f"  {len(chunk.strip()):5d}  {head}")

    print("\n== 否定与对照句式 ==")
    hits = 0
    for m in re.finditer("|".join(PATTERNS), body):
        hits += 1
        start, end = max(0, m.start() - 40), min(len(body), m.end() + 45)
        line_no = body.count("\n", 0, m.start()) + 1
        snippet = re.sub(r"\s+", " ", body[start:end])
        print(f"  L{line_no}: …{snippet}…")
    if not hits:
        print("  （未命中）")

    print("\n这里只定位候选句式，不判断质量。按 readable-survey.md 结合语义审读；零命中也不是通过标准。")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
