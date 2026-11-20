"""Generate the web edition from the Chinese v5 TeX and its matching PDF.

Run from the repository with: python scripts/import-agentic-rl-html.py <zh-source-dir>
The source directory contains main.tex, main.bib, main.bbl, main.aux and figures/.
Requires Pandoc, Pillow, and PyMuPDF. The published PDF is the source of the tree figure.
"""

from argparse import ArgumentParser
from copy import deepcopy
from html import escape
from pathlib import Path
import json
import re
import subprocess
from urllib.parse import unquote

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
URL = "/papers/agentic-rl-survey/"
WEB = URL + "web/"
SITE = ROOT / ("docs" + WEB)
PUBLIC = ROOT / ("docs/public" + URL)
TITLE = "大语言模型智能体强化学习全景：综述"
CHAPTERS = (
    ("introduction", "引言"),
    ("foundations", "预备知识：从 LLM RL 到 Agentic RL"),
    ("capabilities", "Agentic RL：模型能力视角"),
    ("tasks", "Agentic RL：任务视角"),
    ("resources", "环境与框架"),
    ("future", "开放挑战与未来方向"),
    ("conclusion", "结论"),
    ("references", "参考文献"),
)


def pandoc(args, source, *, cwd=ROOT):
    return subprocess.run(
        ["pandoc", *args], input=source, cwd=cwd, encoding="utf-8",
        capture_output=True, check=True,
    ).stdout


def nodes(value):
    if isinstance(value, dict):
        if "t" in value:
            yield value
        for child in value.values():
            yield from nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child)


def text(value):
    return "".join(
        node["c"] if node["t"] == "Str" else " "
        for node in nodes(value)
        if node["t"] in {"Str", "Space", "SoftBreak", "LineBreak"}
    )


def unwrap_resize(source):
    pattern = re.compile(r"\\resizebox\{[^{}]*\}\{[^{}]*\}\{")
    while match := pattern.search(source):
        level = 1
        for token in re.finditer(r"(?<!\\)[{}]|(?<!\\)%[^\n]*", source[match.end():]):
            if token[0].startswith("%"):
                continue
            level += 1 if token[0] == "{" else -1
            if level == 0:
                end = match.end() + token.start()
                source = source[:match.start()] + source[match.end():end] + source[end + 1:]
                break
        else:
            raise ValueError("Unbalanced resizebox")
    return source


def web_tex(root):
    def flatten(path):
        source = re.sub(r"(?m)^[ \t]*%.*$", "", path.read_text(encoding="utf-8"))

        def include(match):
            name = Path(match[1].strip())
            if not name.suffix:
                name = name.with_suffix(".tex")
            if name == Path("sections/intro/trees.tex"):
                return r"\includegraphics{figures/outline-tree.webp}"
            return flatten(root / name)

        return re.sub(r"\\input\{\s*([^}]+)\s*\}", include, source)

    source = flatten(root / "main.tex")
    # Keep content macros, but skip layout packages that redefine section commands.
    source = re.sub(r"\\usepackage(?:\[[^]]*\])?\{[^{}]*\}", "", source)
    source = re.sub(r"(?ms)^\\tikzstyle\{[^{}]*\}\s*=\s*\[.*?^]", "", source)
    source = re.sub(r"(?ms)^\\forestset\{.*?^}", "", source)
    source = re.sub(r"(?ms)^\\newcommand\{\\insightbox\}\[1\]\{.*?^}",
                    lambda _: r"\newcommand{\insightbox}[1]{\begin{quote}\textbf{#1}\end{quote}}", source)
    source = re.sub(r"\\begin\{tcolorbox\}(?:\[[^]]*\])?", r"\\begin{quote}", source)
    source = source.replace(r"\end{tcolorbox}", r"\end{quote}")
    source = unwrap_resize(source)
    source = source.replace(r"\begin{table*}", r"\begin{table}").replace(r"\end{table*}", r"\end{table}")
    source = re.sub(r"(?m)^[ \t]*\\small[ \t]*\n", "", source)
    source = re.sub(r"\\faIcon\{[^{}]*\}(?:\\,)?", "", source)
    source = re.sub(r"\\includegraphics(?:\[[^]]*\])?\{figures/hf-logo.png\}(?:\\,)?", "", source)
    source = re.sub(r"\\item\[\{\\color\{[^{}]*\}\\ding\{\d+\}\}\]", r"\\item", source)
    symbols = {51: "✓", 52: "✓", 55: "✗", **dict(zip(range(172, 178), "①②③④⑤⑥"))}
    source = re.sub(r"\\ding\{(\d+)\}", lambda m: symbols[int(m[1])], source)
    source = re.sub(r"\\rowcolor\{gray!15\}", "SURVEYRLROW ", source)
    source = source.replace(r"\label{sec:task}", "").replace(
        r"\section{Agentic RL：任务视角}",
        r"\section{Agentic RL：任务视角}\label{sec:task}",
    )
    return source


def prepend(inlines, label):
    inlines[:0] = [{"t": "Str", "c": label}, {"t": "Space"}]


def set_captions(document, labels):
    table_labels = [label for label in labels if label.startswith("tab:")]
    table_number = 0
    for block in document["blocks"]:
        if block["t"] == "Figure":
            attrs, caption, _ = block["c"]
            label = attrs[0]
            attrs[1].append("note-figure")
            prepend(caption[1][0]["c"], f"图 {labels[label]} ·")
        if block["t"] != "Div":
            continue
        for table in (node for node in nodes(block["c"][1]) if node["t"] == "Table"):
            label = table_labels[table_number]
            table_number += 1
            block["c"][0][0] = label
            caption = table["c"][1][1]
            if not caption:
                raise ValueError(f"Caption missing for {label}")
            prepend(caption[0]["c"], f"表 {labels[label]} ·")
    if table_number != len(table_labels):
        raise ValueError(f"Expected {len(table_labels)} tables, got {table_number}")


def label_blocks(blocks, labels):
    """Make display equations block elements and retain the original equation labels."""
    counter = 0
    for block in blocks:
        if block["t"] != "Para":
            yield block
            continue
        paragraph = []
        for item in block["c"]:
            if item["t"] != "Math" or item["c"][0]["t"] != "DisplayMath":
                paragraph.append(item)
                continue
            if paragraph:
                yield {"t": "Para", "c": paragraph}
            paragraph = []
            counter += 1
            tex = item["c"][1].strip()
            match = re.search(r"\\label\{([^}]+)\}", tex)
            anchor = match[1] if match else f"equation-{counter}"
            number = labels.get(anchor, str(counter))
            if number != str(counter):
                raise ValueError(f"Unexpected equation number {anchor}: {number}")
            tex = re.sub(r"\\(?:begin|end)\{equation\}|\\label\{[^}]+\}", "", tex).strip()
            html = (f'<div class="survey-equation" id="{escape(anchor)}" tabindex="0" aria-label="公式 {number}">'
                    f'<div class="math-block" data-tex="{escape(tex)}"></div>'
                    f'<span class="survey-equation-number">({number})</span></div>')
            yield {"t": "RawBlock", "c": ["html", html]}
        if paragraph:
            yield {"t": "Para", "c": paragraph}
    if counter != 17:
        raise ValueError(f"Expected 17 display equations, got {counter}")


def identify_sections(document, labels):
    blocks = list(label_blocks(document["blocks"], labels))
    starts = [i for i, block in enumerate(blocks)
              if block["t"] == "Header" and block["c"][0] == 1]
    refs = [i for i, block in enumerate(blocks)
            if block["t"] == "Div" and block["c"][0][0] == "refs"]
    if len(starts) != len(CHAPTERS) - 1 or len(refs) != 1:
        raise ValueError(f"Expected seven chapters and references, got {len(starts)} and {len(refs)}")
    sections = []
    for number, (start, stop) in enumerate(zip(starts, starts[1:] + refs), 1):
        header = blocks[start]["c"]
        slug, title = CHAPTERS[number - 1]
        if text(header[2]) != title:
            raise ValueError(f"Unexpected chapter title at {number}: {text(header[2])}")
        body = blocks[start + 1:stop]
        heading_numbers = [number, 0, 0]
        for node in nodes(body):
            if node["t"] != "Header":
                continue
            level, attrs, inlines = node["c"]
            if level <= 3:
                heading_numbers[level - 1] += 1
                heading_numbers[level:] = [0] * (3 - level)
                heading_number = ".".join(str(n) for n in heading_numbers[:level])
                if attrs[0] in labels and labels[attrs[0]] != heading_number:
                    raise ValueError(f"Heading number mismatch for {attrs[0]}")
                prepend(inlines, heading_number)
            node["c"][0] = min(4, level)
        sections.append((slug, f"{number} {title}", header[1][0], body))
    sections.append(("references", "参考文献", "references", [blocks[refs[0]]]))
    return sections


def adapt_links_and_assets(sections, source_dir):
    def node_id(node):
        if node["t"] in {"Span", "Div", "Figure", "Table"}:
            return node["c"][0][0]
        if node["t"] == "Header":
            return node["c"][1][0]
        if node["t"] == "RawBlock":
            match = re.search(r'\bid="([^"]+)"', node["c"][1])
            return match[1] if match else ""
        return ""

    targets = {}
    for slug, _, anchor, blocks in sections:
        targets[anchor] = slug
        for node in nodes(blocks):
            key = node_id(node)
            if key:
                if key in targets:
                    raise ValueError(f"Duplicate destination {key}")
                targets[key] = slug

    assets = {}
    figures = PUBLIC / "web-assets"
    figures.mkdir(exist_ok=True)
    for slug, _, _, blocks in sections:
        for node in nodes(blocks):
            if node["t"] == "Link":
                target = node["c"][-1]
                if target[0].startswith("#"):
                    key = unquote(target[0][1:])
                    if key not in targets:
                        raise ValueError(f"Unresolved destination {key}")
                    if targets[key] != slug:
                        target[0] = WEB + targets[key] + "#" + key
            elif node["t"] == "Image":
                attrs, _, target = node["c"]
                name = Path(target[0]).name
                derivative = Path(name).stem + ".webp"
                if name not in assets:
                    path = figures / derivative
                    if name == "outline-tree.webp":
                        with fitz.open(PUBLIC / "arxiv-2509.02547v5-zh.pdf") as pdf:
                            # Graph only. The translated caption is rendered as HTML.
                            clip = fitz.Rect(62, 62, 534, 684)
                            pixmap = pdf[5].get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip, alpha=False)
                            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                    else:
                        with Image.open(source_dir / "figures" / name) as original:
                            image = original.convert("RGB")
                    image.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
                    image.save(path, format="WEBP", quality=91, method=6)
                    assets[name] = image.size
                width, height = assets[name]
                attrs[2] = [["width", str(width)], ["height", str(height)], ["loading", "lazy"]]
                target[0] = URL + "web-assets/" + derivative


def render(blocks, template):
    def prepare(value):
        if isinstance(value, list):
            return [prepare(child) for child in value]
        if not isinstance(value, dict):
            return value
        kind = value.get("t")
        if kind == "Math":
            mode, formula = value["c"]
            if mode["t"] != "InlineMath":
                raise ValueError("Unexpected nested display equation")
            formula = re.sub(r"\\dag\b", r"\\dagger", formula)
            return {"t": "RawInline", "c": ["html", f'<span class="math-inline" data-tex="{escape(formula)}"></span>']}
        if kind == "RawInline" and value["c"] == ["latex", r"\textemdash"]:
            return {"t": "Str", "c": "—"}
        if kind in {"Span", "Div"}:
            value["c"][0][2] = [attr for attr in value["c"][0][2] if attr[0] != "style"]
        return {key: prepare(child) for key, child in value.items()}

    doc = {"pandoc-api-version": template, "meta": {}, "blocks": prepare(deepcopy(blocks))}
    html = pandoc(["-f", "json", "-t", "html5", "--wrap=none"], json.dumps(doc, ensure_ascii=False))

    def table(match):
        inner = re.sub(r"<colgroup>[\s\S]*?</colgroup>", "", match[0])
        inner = re.sub(r'<tr(?: class="([^"]*)")?>([\s\S]*?)</tr>',
                       lambda row: f'<tr class="{(row[1] or "")} survey-rl-row">{row[2].replace("SURVEYRLROW", "")}</tr>'
                       if "SURVEYRLROW" in row[2] else row[0], inner)
        return '<div class="survey-table" role="region" aria-label="表格，可水平滑动" tabindex="0">' + inner + "</div>"

    html = re.sub(r"<table\b[\s\S]*?</table>", table, html)
    html = re.sub(r'(<img\b[^>]*\bsrc="([^"]+/web-assets/[^"]+)"[^>]*>)',
                  lambda m: f'<a href="{m[2]}" target="_blank" rel="noopener" aria-label="打开原尺寸图片">{m[1]}</a>', html)
    if "SURVEYRLROW" in html:
        raise ValueError("Unprocessed table row markers")
    return html


def write_page(slug, title, anchor, body, navigation, children, previous="", following=""):
    if slug == "index":
        page_title = TITLE + "（网页版）"
        links = ""
        index_links = '<nav id="survey-toc" class="survey-sections" aria-label="全文目录">' + navigation + "</nav>"
        home_link = '<a href="#survey-toc">跳到全文目录</a> '
    else:
        page_title = title + " · " + TITLE
        links = ('<details class="note-details survey-toc"><summary>全文目录</summary>'
                 '<nav class="survey-sections" aria-label="全文目录">' + navigation + "</nav></details>")
        index_links = ""
        home_link = f'<a href="{WEB}">摘要与目录</a> '
    pager = ""
    if previous or following:
        pager = (f'<nav class="survey-pager" aria-label="章节导航">{previous}'
                 f'<a href="{WEB}">摘要与目录</a>{following}</nav>')
    page = f'''<script setup>
import './reading.css'
</script>

<article class="native-document format-paper survey-web" data-design="linux-notebook" aria-labelledby="{escape(anchor)}">
  <header class="document-intro note-hero">
    <p class="note-kicker">中文译本<span>arXiv:2509.02547v5</span></p>
    <h1 id="{escape(anchor)}">{escape(title)}</h1>
    <p class="survey-links">{home_link}<a href="{URL}?view=pdf">PDF 阅读工作台</a></p>
  </header>
  {links}
  {children}
  <section class="document-section note-panel" aria-labelledby="{escape(anchor)}">
{body.rstrip()}
  </section>
  {index_links}
  {pager}
</article>
'''
    metadata = f"""---
title: {json.dumps(page_title, ensure_ascii=False)}
description: 大语言模型智能体强化学习全景综述的中文网页版，按章节阅读。
pageClass: native-html-page
contentFormat: html
readingNotes: true
search: false
tags: []
---

<!--@include: ./{slug}.html-->
"""
    page = "\n".join(line.rstrip() for line in page.splitlines()) + "\n"
    (SITE / f"{slug}.html").write_text(page, encoding="utf-8", newline="\n")
    (SITE / f"{slug}.md").write_text(metadata, encoding="utf-8", newline="\n")


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path)
    root = parser.parse_args().source_dir.resolve()
    source = web_tex(root)
    document = json.loads(pandoc(["-f", "latex", "-t", "json", "--citeproc", "-M", "link-citations:true"], source, cwd=root))
    version = document["pandoc-api-version"]
    aux = (root / "main.aux").read_text(encoding="utf-8")
    labels = dict(re.findall(r"(?m)^\\newlabel\{([^{}\n]+)\}\{\{(\d+(?:\.\d+)*)\}", aux))
    expected_refs = set(re.findall(r"(?ms)^\\bibitem(?:\[.*?])?\s*\{([^{}]+)\}", (root / "main.bbl").read_text(encoding="utf-8")))
    actual_refs = {node["c"][0][0][4:] for node in nodes(document["blocks"])
                   if node["t"] == "Div" and node["c"][0][0].startswith("ref-")}
    if actual_refs != expected_refs:
        raise ValueError(f"Reference mismatch: missing {expected_refs - actual_refs}, extra {actual_refs - expected_refs}")
    if sum(node["t"] == "Figure" for node in nodes(document["blocks"])) != 8:
        raise ValueError("Expected eight figures")

    set_captions(document, labels)
    sections = identify_sections(document, labels)
    adapt_links_and_assets(sections, root)
    SITE.mkdir(parents=True, exist_ok=True)
    navigation = "".join(f'<a href="{WEB}{slug}">{escape(title)}</a>' for slug, title, _, _ in sections)
    abstract = re.search(r"(?s)\\begin\{abstract\}(.*?)\\end\{abstract\}", source)[1].strip()
    credits = []
    for author in document["meta"]["author"]["c"]:
        inlines = deepcopy(author["c"])
        for index, part in enumerate(inlines):
            if part["t"] == "Math" and (mark := re.fullmatch(r"\^\{([^{}]+)\}", part["c"][1])):
                inlines[index] = {"t": "Superscript", "c": [{"t": "Str", "c": mark[1].replace(r"\dag", "†")}]}
        credits.append({"t": "Para", "c": inlines})
    title_page = render(credits, version)
    intro = (f'<h2 id="abstract">摘要</h2>\n<p>{escape(abstract)}</p>\n'
             '<p class="survey-source">据用户提供的源码译出。正文、图注和表格为中文，图内标注与参考文献保留原文。'
             '<a href="https://arxiv.org/abs/2509.02547v5">原论文 v5</a></p>\n'
             '<details class="note-details"><summary>原文作者与机构</summary>'
             f'{title_page}</details>')
    write_page("index", TITLE, "paper-title", intro, navigation, "")
    for index, (slug, title, anchor, blocks) in enumerate(sections):
        subsection_links = []
        for block in blocks:
            if block["t"] == "Header" and block["c"][0] == 2:
                key = block["c"][1][0]
                subsection_links.append(f'<a href="#{escape(key)}">{escape(text(block["c"][2]))}</a>')
        children = ('<nav class="note-jump" aria-label="本章小节">' + "\n".join(subsection_links) + "</nav>"
                    if subsection_links else "")
        previous = f'<a href="{WEB}{sections[index - 1][0]}">上一章</a>' if index else ""
        following = f'<a href="{WEB}{sections[index + 1][0]}">下一章</a>' if index < len(sections) - 1 else ""
        write_page(slug, title, anchor, render(blocks, version), navigation, children, previous, following)
    print(f"Converted {len(sections) - 1} chapters with 618 references, 17 numbered equations, 11 tables and 8 figures.")


if __name__ == "__main__":
    main()
