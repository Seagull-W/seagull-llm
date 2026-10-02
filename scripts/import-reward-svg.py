"""Repackage W&B SVG screenshots without reconstructing numerical data.

Retains the original embedded chart pixels; removes copied page CSS and fonts.
"""
import base64
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

SOURCE = Path('docs/rl-book/expriment_data/reward_model')
OUTPUT = Path('docs/public/experiments/reward-model-svg')
FILES = {
    'val/loss': 'val_loss.svg', 'val/accuracy': 'val_accuracy.svg',
    'val/reward_margin': 'val_reward_margin.svg',
    'train/loss': 'trainloss.svg', 'train/accuracy': 'train_accuracy.svg',
    'train/reward_margin': 'train_reward_margin.svg',
    'train/r_chosen_mean': 'train_r_chosen_mean.svg',
    'train/r_rejected_mean': 'train_r_rejected_mean.svg',
    'val/r_chosen_mean': 'val_r_chosen_mean.svg',
    'val/r_rejected_mean': 'val_r_rejected_mean.svg', 'train/lr': 'train_lr.svg',
}
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {'source': '用户提供的 W&B SVG 图像导出（非数值日志）', 'metrics': [], 'runs': []}
    run_refs = None
    for metric, filename in FILES.items():
        original = ET.parse(SOURCE / filename).getroot()
        layers = [element.attrib['src'] for element in original.iter()
                  if element.tag.rsplit('}', 1)[-1] == 'img']
        refs = [(element.attrib.get('href'), ''.join(element.itertext()).strip())
                for element in original.iter() if element.tag.rsplit('}', 1)[-1] == 'a']
        # Only retain known run names, not CSS text copied inside anchor children.
        refs = [(url, 'preference-rm-qwen3-0.6b-linear-float32' if 'float32' in text else
                 'preference-rm-qwen3-0.6b-linear-bf16' if 'bf16' in text else '') for url, text in refs]
        if len(refs) != 2 or not all(name for _, name in refs):
            raise ValueError(f'{filename}: cannot identify two expected runs')
        if run_refs is not None and refs != run_refs:
            raise ValueError(f'{filename}: run identities differ across charts')
        run_refs = refs
        if not layers:
            raise ValueError(f'{filename}: missing chart images')
        size = None
        for layer in layers:
            if not layer.startswith('data:image/png;base64,'):
                raise ValueError('Only embedded PNG images are allowed')
            with Image.open(io.BytesIO(base64.b64decode(layer.split(',', 1)[1]))) as image:
                if size is not None and size != image.size:
                    raise ValueError('Chart layers do not share dimensions')
                size = image.size
        width, height = size
        svg = ET.Element(f'{{{NS}}}svg', {'viewBox': f'0 0 {width} {height}', 'width': str(width),
                                       'height': str(height), 'role': 'img'})
        ET.SubElement(svg, f'{{{NS}}}title').text = f'{metric} — W&B exported chart'
        ET.SubElement(svg, f'{{{NS}}}rect', {'width': '100%', 'height': '100%', 'fill': 'white'})
        for layer in layers:
            ET.SubElement(svg, f'{{{NS}}}image', {'width': str(width), 'height': str(height), 'href': layer})
        asset = metric.replace('/', '-') + '.svg'
        ET.ElementTree(svg).write(OUTPUT / asset, encoding='utf-8', xml_declaration=True)
        manifest['metrics'].append({'key': metric, 'asset': f'/experiments/reward-model-svg/{asset}',
                                    'sourceFile': filename})
        print(f'{filename}: {(SOURCE / filename).stat().st_size:,} → {(OUTPUT / asset).stat().st_size:,} bytes')
    for url, name in run_refs:
        manifest['runs'].append({'id': url.rsplit('/', 1)[-1], 'label': 'f32' if 'float32' in name else 'bf16',
                                 'name': name, 'url': f'https://forge.coreweave.com{url}',
                                 'color': '#479a5f' if 'float32' in name else '#f0434f'})
    (OUTPUT / 'index.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
