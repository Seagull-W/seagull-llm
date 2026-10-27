"""Regenerate the local article font subset using the current public content.

Requires fontTools with WOFF2 support, Node and installed site dependencies.
Original OFL fonts are cached under ignored .research/font-cache for later runs.
Only the shared WOFF2 files and their license are published.
"""
import io
import json
import re
import subprocess
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]


def main():
    result = subprocess.run(['node', '--input-type=module', '-e',
        "import {readingPages} from './scripts/reading-pages.mjs'; const pages=readingPages(); "
        "console.log(JSON.stringify({pages:pages.map(p=>({path:p.path,title:p.data.title})), "
        "text:pages.map(p=>p.content).join('')}))"],
        cwd=ROOT, text=True, encoding='utf-8', capture_output=True, check=True)
    report = json.loads(result.stdout)
    chars = ''.join(sorted(set(report['text'])))
    cache = ROOT / '.research' / 'font-cache'
    cache.mkdir(parents=True, exist_ok=True)
    output = ROOT / 'docs' / '.vitepress' / 'theme' / 'fonts'
    output.mkdir(exist_ok=True)
    css = None
    for weight in (400, 600):
        cached = cache / f'noto-serif-sc-{weight}.ttf'
        if not cached.exists():
            if css is None:
                url = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap'
                css = urllib.request.urlopen(url, timeout=30).read().decode()
            block = next(block for block in css.split('@font-face') if f'font-weight: {weight};' in block)
            font_url = re.search(r'url\((https[^)]+)\)', block)[1]
            print(f'Downloading original font {weight}', flush=True)
            cached.write_bytes(urllib.request.urlopen(font_url, timeout=60).read())
        font = TTFont(io.BytesIO(cached.read_bytes()))
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(text=chars)
        sub.subset(font)
        font.flavor = 'woff2'
        target = output / f'noto-serif-sc-{weight}.woff2'
        font.save(target)
        print(f'{target.name}: {target.stat().st_size} bytes', flush=True)
    styles = '\n'.join(f"""@font-face {{
  font-family: 'Seagull Academic Serif';
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url('./noto-serif-sc-{weight}.woff2') format('woff2');
}}""" for weight in (400, 600))
    (output / 'academic-font.css').write_text(styles + '\n', encoding='utf-8')
    license_path = output / 'OFL-NotoSerifSC.txt'
    if not license_path.exists():
        license_path.write_bytes(urllib.request.urlopen(
            'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt', timeout=30).read())
    manifest = {'family': 'Noto Serif SC', 'license': 'SIL OFL 1.1',
                'character_count': len(chars), 'pages': report['pages']}
    (ROOT / 'scripts' / 'data' / 'academic-reading-pages.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Covered {len(report['pages'])} public articles, {len(chars)} characters.", flush=True)


if __name__ == '__main__':
    main()
