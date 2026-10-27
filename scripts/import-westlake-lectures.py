"""Import the five published Westlake lectures from their original LaTeX.

HTML is the editable authoritative body after import. Reruns require --overwrite.
Requires Pandoc; does not modify source files or publish additional lectures.
"""
import argparse
import collections
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    ('cha1_2', '强化学习基本概念与贝尔曼方程', 'index', '第 1–2 讲',
     '从状态、动作与回报出发，建立价值函数的递归关系，并推导贝尔曼方程与策略评估的收敛性。',
     ['基础概念', '贝尔曼方程', '策略评估']),
    ('cha3', '最优状态价值与贝尔曼最优方程', 'index', '第 3 讲',
     '从策略改进进入最优状态价值，通过压缩映射理解贝尔曼最优方程的唯一解与贪心最优策略。',
     ['最优策略', '压缩映射', '贝尔曼最优方程']),
    ('cha4', '值迭代与策略迭代', 'index', '第 4 讲',
     '沿着策略评估与策略改进两条线索，比较值迭代、策略迭代与截断策略迭代的更新方式和收敛性。',
     ['值迭代', '策略迭代', '截断策略迭代']),
    ('cha5', '蒙特卡洛方法', 'index', '第 5 讲',
     '用采样回报替代已知模型，从 MC Basic 到 Exploring Starts 与 ε-greedy，理解估计、控制和探索之间的关系。',
     ['蒙特卡洛', '采样估计', '探索与利用']),
    ('cha6', '随机近似', '课程讲义', '第 6 讲',
     '从增量均值估计进入 Robbins–Monro 递推、Dvoretzky 收敛定理与随机梯度下降，连接采样噪声和收敛条件。',
     ['随机近似', 'Robbins–Monro', '随机梯度下降']),
]
BOX_NAMES = {'definitionbox': '定义', 'theorembox': '定理', 'proofbox': '证明',
             'remarkbox': '备注', 'algobox': '算法'}


def pandoc(source, source_format, target_format):
    result = subprocess.run(['pandoc', '-f', source_format, '-t', target_format, '--wrap=none'],
                            input=source, text=True, encoding='utf-8', capture_output=True, check=True)
    if result.stderr.strip():
        raise RuntimeError(result.stderr)
    return result.stdout


def raw(kind, value):
    return {'t': kind, 'c': ['html', value]}


def attr(value):
    return html.escape(value, quote=True)


def nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child)


def inline_text(value):
    return ''.join(n['c'] if n['t'] == 'Str' else ' ' if n['t'] in ('Space', 'SoftBreak')
                   else n['c'][1] if n['t'] == 'Math' else '' for n in nodes(value)
                   if n.get('t') in ('Str', 'Space', 'SoftBreak', 'Math'))


class Converter:
    def __init__(self, source):
        self.ast = json.loads(pandoc(source, 'latex', 'json'))
        self.original_nodes = list(nodes(self.ast['blocks']))
        assert not any(n.get('t') in ('RawBlock', 'RawInline', 'Image') for n in self.original_nodes)
        self.math_count = collections.Counter(n['c'][0]['t'] for n in self.original_nodes if n.get('t') == 'Math')
        self.converted_math = collections.Counter()
        self.boxes = collections.Counter()
        self.box_titles = collections.defaultdict(list)
        body = source.split(r'\begin{document}', 1)[1]
        for env, title in re.findall(r'\\begin\{((?:definition|theorem|proof|remark|algo)box)\}(?:\[([^\]]*)\])?', body):
            self.box_titles[env].append(title)
        self.equations = {}
        self.equation_number = {}
        number = 0
        for node in self.original_nodes:
            if node.get('t') != 'Math':
                continue
            tex = node['c'][1]
            if r'\begin{equation}' in tex:
                number += 1
                self.equation_number[tex] = number
                for label in re.findall(r'\\label\{([^}]+)\}', tex):
                    self.equations[label] = number
        self.display_index = 0
        self.headings = []
        self.references = 0

    def math(self, node):
        mode, tex = node['c']
        self.converted_math[mode['t']] += 1
        if mode['t'] == 'InlineMath':
            formula = f'<span class="math-inline" data-tex="{attr(tex)}"></span>'
            return formula
        self.display_index += 1
        number = self.equation_number.get(tex)
        labels = re.findall(r'\\label\{([^}]+)\}', tex)
        tex = re.sub(r'\\label\{[^}]+\}', '', tex).strip()
        tex = tex.replace(r'\begin{equation}', '').replace(r'\end{equation}', '').strip()
        identity = labels[0] if labels else f'lecture-equation-{self.display_index}'
        formula = f'<div class="math-block" data-tex="{attr(tex)}"></div>'
        for label in labels[1:]:
            formula = f'<span id="{attr(label)}"></span>' + formula
        if number:
            formula += f'<a class="lecture-equation-number" href="#{attr(identity)}" aria-label="公式 {number}">({number})</a>'
        return f'<div class="lecture-equation{ " is-numbered" if number else ""}" id="{attr(identity)}">{formula}</div>'

    def inline(self, node):
        t = node['t']
        if t == 'Math':
            return raw('RawInline', self.math(node))
        if t == 'Link':
            attrs, text, target = node['c']
            props = dict(attrs[2])
            if 'reference' in props:
                label = props['reference']
                if label not in self.equations:
                    raise ValueError(f'Unresolved equation reference: {label}')
                number = str(self.equations[label])
                node['c'][1] = [{'t': 'Str', 'c': '(' + number + ')' if props['reference-type'] == 'eqref' else number}]
                self.references += 1
        if t in ('Strong', 'Emph', 'Strikeout', 'Superscript', 'Subscript', 'SmallCaps'):
            node['c'] = [self.inline(n) for n in node['c']]
        elif t in ('Link', 'Span'):
            node['c'][1] = [self.inline(n) for n in node['c'][1]]
        elif t == 'Quoted':
            node['c'][1] = [self.inline(n) for n in node['c'][1]]
        return node

    def blocks(self, blocks, first_two=False):
        result = []
        for node in blocks:
            t = node['t']
            if t in ('Para', 'Plain'):
                # Some source paragraphs use literal dash lines rather than
                # itemize. Preserve their intended list layout on the web.
                markers = [i for i in range(len(node['c']) - 2)
                           if node['c'][i]['t'] == 'SoftBreak'
                           and node['c'][i + 1] == {'t': 'Str', 'c': '-'}
                           and node['c'][i + 2]['t'] == 'Space']
                if markers:
                    prefix = {'t': t, 'c': node['c'][:markers[0]]}
                    items = [[{'t': 'Para', 'c': node['c'][start + 3:end]}]
                             for start, end in zip(markers, markers[1:] + [len(node['c'])])]
                    result.extend(self.blocks([prefix, {'t': 'BulletList', 'c': items}]))
                    continue
                # Display math in LaTeX paragraphs must become real HTML blocks.
                chunk = []
                def flush():
                    while chunk and chunk[0]['t'] in ('Space', 'SoftBreak'):
                        chunk.pop(0)
                    while chunk and chunk[-1]['t'] in ('Space', 'SoftBreak'):
                        chunk.pop()
                    if chunk:
                        result.append({'t': t, 'c': list(chunk)})
                    chunk.clear()
                for item in node['c']:
                    if item['t'] == 'Math' and item['c'][0]['t'] == 'DisplayMath':
                        flush()
                        result.append(raw('RawBlock', self.math(item)))
                    else:
                        chunk.append(self.inline(item))
                flush()
            elif t == 'Header':
                level, attributes, content = node['c']
                if level == 1 and not first_two:
                    continue  # The page has its own single, full chapter title.
                if first_two:
                    level += 1
                identity = attributes[0]
                text = inline_text(content)
                content = [self.inline(item) for item in content]
                content.append(raw('RawInline', f' <a class="header-anchor" href="#{attr(identity)}" aria-label="章节链接">&#8203;</a>'))
                attributes[2].append(['tabindex', '-1'])
                result.append({'t': 'Header', 'c': [level, attributes, content]})
                self.headings.append({'level': level, 'id': identity, 'title': text})
            elif t == 'Div':
                attributes, children = node['c']
                env = next((c for c in attributes[1] if c in BOX_NAMES), None)
                if env:
                    title = self.box_titles[env][self.boxes[env]]
                    self.boxes[env] += 1
                    label = BOX_NAMES[env]
                    if title:
                        label = title if title.startswith(('备注', '补充内容')) else label + ' ' + title
                    # Preserve optional tcolorbox titles (Pandoc otherwise discards them).
                    title_nodes = json.loads(pandoc(label, 'latex', 'json'))['blocks'][0]['c']
                    title_node = {'t': 'Div', 'c': [['', ['lecture-box-title'], []], [{'t': 'Para', 'c': title_nodes}]]}
                    children = [title_node] + children
                    attributes[1].append('lecture-box')
                node['c'][1] = self.blocks(children)
                result.append(node)
            elif t == 'BulletList':
                node['c'] = [self.blocks(items) for items in node['c']]
                result.append(node)
            elif t == 'OrderedList':
                node['c'][1] = [self.blocks(items) for items in node['c'][1]]
                result.append(node)
            elif t == 'Table':
                # Pandoc's table cells contain nested blocks.
                def table_walk(value):
                    if isinstance(value, list):
                        if value and all(isinstance(n, dict) and n.get('t') in ('Plain', 'Para') for n in value):
                            return self.blocks(value)
                        return [table_walk(v) for v in value]
                    return value
                node['c'] = table_walk(node['c'])
                result.append(raw('RawBlock', '<div class="note-table" tabindex="0" role="region" aria-label="讲义数据表">'))
                result.append(node)
                result.append(raw('RawBlock', '</div>'))
            else:
                raise ValueError(f'Unhandled Pandoc block: {t}')
        return result

    def render(self, first_two):
        self.ast['blocks'] = self.blocks(self.ast['blocks'], first_two)
        assert self.converted_math == self.math_count + collections.Counter(
            # Optional box titles can themselves contain math.
            {'InlineMath': sum(title.count('$') // 2 for titles in self.box_titles.values() for title in titles)}
        ), (self.converted_math, self.math_count)
        for env, titles in self.box_titles.items():
            assert self.boxes[env] == len(titles)
        rendered = pandoc(json.dumps(self.ast, ensure_ascii=False), 'json', 'html')
        # Create semantic sections while retaining the source's subsection hierarchy.
        rendered = re.sub(r'(<h2\b[^>]*\bid="([^"]+)"[^>]*>)',
                          lambda m: '</section>\n<section class="document-section note-panel" aria-labelledby="' + m[2] + '">\n' + m[1], rendered)
        if '</section>' in rendered:
            before, after = rendered.split('</section>', 1)
            rendered = before + after + '\n</section>'
        return rendered


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    report = []
    for key, title, stem, chapter, description, tags in PAGES:
        source_path = args.source_root / 'chapters' / key / (key + '.tex')
        source = source_path.read_text(encoding='utf-8')
        converter = Converter(source)
        body = converter.render(key == 'cha1_2')
        directory = ROOT / 'docs' / 'westlake-rl' / title
        target = directory / (stem + '.html')
        if 'PdfViewer' not in target.read_text(encoding='utf-8') and not args.overwrite:
            raise ValueError(f'{target}: edited HTML body; pass --overwrite to regenerate intentionally')
        pdf_name = title + '.pdf'
        jumps = '\n'.join(f'<a href="#{attr(h["id"])}">{attr(h["title"].replace(chr(92) + "varepsilon", "ε"))}</a>' for h in converter.headings if h['level'] == 2)
        chips = ''.join(f'<span>{attr(t)}</span>' for t in tags)
        output = f'''<script setup lang="ts">
import '../lecture-academic.css'
import {{ defineAsyncComponent, shallowRef }} from 'vue'
import pdfUrl from './{pdf_name}?url'
import outline from './目录.json'
const PdfViewer = defineAsyncComponent(() => import('../../.vitepress/components/PdfViewer.vue'))
const showOriginal = shallowRef(false)
function toggleOriginal(event: Event) {{
  showOriginal.value = (event.target as HTMLDetailsElement).open
}}
</script>

<article class="native-document format-course academic-lecture" data-format="course" data-design="linux-notebook" aria-label="{attr(chapter + '：' + title)}">
<header class="document-intro note-hero">
  <p class="note-kicker">西湖 RL 笔记<span>{chapter} · 课程讲义</span></p>
  <h1 id="note-title" tabindex="-1">{title} <a class="header-anchor" href="#note-title" aria-label="文章链接">&#8203;</a></h1>
  <p class="note-deck">{description}</p>
  <div class="note-chips">{chips}</div>
  <p class="lecture-source">据赵世钰《强化学习》课程整理的个人 LaTeX 笔记</p>
</header>
<nav class="note-jump" aria-label="本篇阅读导航">{jumps}</nav>
<div id="reading-context" class="lecture-body">
{body}
</div>
<details class="lecture-original note-details" @toggle="toggleOriginal">
  <summary>对照原版 PDF<span>保留原页码与讲义目录</span></summary>
  <div class="lecture-original-content">
    <p>网页正文依据原 LaTeX 源稿排版，保留原有定理标题、公式编号与引用。文中涉及课程教材的图号沿用源笔记；源稿未附这些插图。</p>
    <p><a :href="pdfUrl" target="_blank" rel="noopener">在新窗口打开原版 PDF</a></p>
    <ClientOnly><PdfViewer v-if="showOriginal" :src="pdfUrl" title="{attr(title)}" :outline="outline" /></ClientOnly>
  </div>
</details>
</article>
'''
        target.write_text(output, encoding='utf-8')
        meta = directory / (stem + '.md')
        content = meta.read_text(encoding='utf-8')
        content = re.sub(r'^(?:outline: false|aside: false|pdf: true)\r?\n', '', content, flags=re.M)
        content = re.sub(r'^description:.*$', 'description: ' + description, content, flags=re.M)
        if 'outline: [2, 3]' not in content:
            content = content.replace('contentFormat: html', 'outline: [2, 3]\ncontentFormat: html')
        meta.write_text(content, encoding='utf-8')
        original_pdf = source_path.with_suffix('.pdf').read_bytes()
        published_pdf = (directory / pdf_name).read_bytes()
        assert hashlib.sha256(original_pdf).digest() == hashlib.sha256(published_pdf).digest(), 'PDF source mismatch'
        report.append({'chapter': key, 'source': source_path.relative_to(args.source_root).as_posix(),
                       'source_sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
                       'pdf_sha256': hashlib.sha256(published_pdf).hexdigest(),
                       'html': target.relative_to(ROOT).as_posix(), 'math': dict(converter.math_count),
                       'boxes': dict(converter.boxes), 'headings': converter.headings,
                       'numbered_equations': len(converter.equation_number), 'equation_references': converter.references})
    dest = ROOT / 'scripts' / 'data' / 'westlake-lecture-import.json'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps({'source_project': '西湖大学强化学习/Study', 'pandoc': '3.9.0.2', 'pages': report}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps([{'chapter': r['chapter'], 'math': r['math'], 'boxes': r['boxes']} for r in report]))


if __name__ == '__main__':
    main()
