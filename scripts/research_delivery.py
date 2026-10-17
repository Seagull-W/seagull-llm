"""Delivery contracts: coherent object cards, source-derived specimens, final readback.

These checks establish completeness and artifact fidelity, not semantic truth.
The assigning agent must read the rendered result before accepting it.
"""
import ast
import gzip
import hashlib
import json
from pathlib import Path
import re


DATASET_FACETS = [
    ('overview', '一句话介绍', 'objects'), ('task', '测什么、要求完成什么', 'objects'),
    ('unit', '一条样本是什么', 'objects'), ('version', '版本与来源', 'data'),
    ('splits', '规模与切分', 'protocol'), ('storage', '文件与存储格式', 'data'),
    ('input', '模型实际看到什么', 'data'), ('output', '模型需要输出什么', 'data'),
    ('scoring', '如何判分', 'protocol'), ('use', '训练与评测用途', 'protocol'),
    ('limits', '适用范围与主要限制', 'limits')]
OBJECT_FACETS = [('overview', '是什么', 'objects'), ('task', '解决什么问题', 'objects'),
                 ('mechanism', '如何工作', 'data'), ('use', '如何使用与比较', 'protocol'),
                 ('limits', '条件与限制', 'limits')]
ROLES = {'input', 'reference', 'scoring', 'environment', 'metadata'}
TYPES = {'string', 'integer', 'number', 'boolean', 'array', 'object', 'null'}


def text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(label + ' must be nonempty text')
    return value.strip()


def ident(value):
    if not isinstance(value, str) or not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', value):
        raise ValueError('Invalid delivery identifier')
    return value


def pointer(record, path):
    if not isinstance(path, str) or not path.startswith('/'):
        raise ValueError('Schema fields use JSON pointers, e.g. /question')
    value = record
    for part in path[1:].split('/'):
        key = part.replace('~1', '/').replace('~0', '~')
        try:
            value = value[int(key)] if isinstance(value, list) else value[key]
        except (KeyError, IndexError, TypeError, ValueError):
            raise ValueError('Field is absent from specimen: ' + path) from None
    return value


def value_type(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'boolean'
    return {str: 'string', int: 'integer', float: 'number', list: 'array', dict: 'object'}[type(value)]


def python_tasks(raw):
    """Read literal Task/Action records without importing or executing source code."""
    def literal(node):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ('Task', 'Action'):
            if node.args or any(k.arg is None for k in node.keywords):
                raise ValueError('Only keyword Task/Action literals are supported')
            return {k.arg: literal(k.value) for k in node.keywords}
        if isinstance(node, (ast.List, ast.Tuple)):
            return [literal(n) for n in node.elts]
        return ast.literal_eval(node)
    tree = ast.parse(raw)
    for node in tree.body:
        value = None
        names = []
        if isinstance(node, ast.Assign):
            names, value = node.targets, node.value
        elif isinstance(node, ast.AnnAssign):
            names, value = [node.target], node.value
        if any(isinstance(n, ast.Name) and n.id in ('TASKS_TEST', 'TASKS', 'TASKS_TRAIN') for n in names):
            return literal(value)
    raise ValueError('No literal task list found; use a documented mechanical extraction')


class DeliveryContract:
    def __init__(self, workflow):
        self.w = workflow

    def template(self, profile, subjects=()):
        if profile == 'narrative':
            return {'profile': profile, 'requirements': ['直接回答用户问题，按读者的理解顺序组织成稿'],
                    'subjects': [], 'facets': []}
        facets = DATASET_FACETS if profile == 'dataset-catalog' else OBJECT_FACETS
        entries = []
        for subject in subjects:
            key, sep, name = subject.partition('=')
            if not sep:
                raise ValueError('--subject must be id=display-name')
            entries.append({'id': ident(key), 'name': text(name, 'subject name'),
                            'required_roles': ['input', 'reference'] if profile == 'dataset-catalog' else [],
                            'min_examples': 1 if profile == 'dataset-catalog' else 0})
        if not entries:
            raise ValueError('Catalog delivery requires explicit --subject id=name entries')
        return {'profile': profile, 'requirements': ['每个对象集中介绍，使用同一组必答内容',
                    '数据形式必须让读者看到输入、预期输出和评分关系；标识符或答案投影不能代替完整例子'],
                'subjects': entries, 'facets': [{'id': key, 'label': label, 'axis_ids': [axis]} for key, label, axis in facets]}

    def normalize(self, delivery, axes):
        if not isinstance(delivery, dict) or delivery.get('profile') not in ('narrative', 'dataset-catalog', 'object-catalog'):
            raise ValueError('Invalid delivery profile')
        d = json.loads(json.dumps(delivery))
        requirements = d.get('requirements')
        if not isinstance(requirements, list) or not requirements or any(not isinstance(r, str) or not r.strip() for r in requirements):
            raise ValueError('Delivery requires explicit reader-facing requirements')
        subjects, facets = d.get('subjects', []), d.get('facets', [])
        if not isinstance(subjects, list) or not isinstance(facets, list):
            raise ValueError('Delivery subjects/facets must be arrays')
        if d['profile'] != 'narrative' and (not subjects or not facets):
            raise ValueError('Catalog requires subjects and facets')
        for subject in subjects:
            ident(subject['id'])
            text(subject.get('name'), 'subject name')
            roles = subject.get('required_roles', [])
            if not isinstance(roles, list) or any(r not in ROLES for r in roles):
                raise ValueError('Invalid specimen roles')
            count = subject.get('min_examples', 0)
            if type(count) is not int or not 0 <= count <= 5:
                raise ValueError('min_examples must be 0–5')
            if d['profile'] == 'dataset-catalog' and ('input' not in roles or count < 1):
                raise ValueError('Dataset catalogs need a concrete example with an input')
            if d['profile'] == 'dataset-catalog' and not set(roles) & {'reference', 'scoring'}:
                raise ValueError('Dataset examples need a reference or an evaluation specification')
        for facet in facets:
            ident(facet['id'])
            text(facet.get('label'), 'facet label')
            if not isinstance(facet.get('axis_ids'), list) or not facet['axis_ids'] or any(a not in axes for a in facet['axis_ids']):
                raise ValueError('Each facet must map to known task axes')
        if len({s['id'] for s in subjects}) != len(subjects) or len({f['id'] for f in facets}) != len(facets):
            raise ValueError('Duplicate subjects/facets')
        return d

    def refs(self, urls, subject, axes, items):
        if not isinstance(urls, list):
            raise ValueError('Card source_urls must be an array')
        refs = []
        for url in urls:
            canonical = self.w.canonical_url(url)
            item = next((i for i in items if i['url'] == canonical), None)
            if not item or subject not in item.get('subject_ids', []):
                raise ValueError('Card cites unreviewed/wrong-subject evidence: ' + canonical)
            if any(a not in item['axis_ids'] for a in axes):
                raise ValueError('Card citation does not support its declared axes')
            refs.append(item['id'])
        return list(dict.fromkeys(refs))

    def specimen(self, spec, subject, schema, run, items):
        if any(k in spec for k in ('content', 'record', 'example')):
            raise ValueError('Specimens must be extracted from source_file, not supplied as model-written content')
        ident(spec['id'])
        source_ids = self.refs([spec['source_url']], subject['id'], [], items)
        source = next(i for i in items if i['id'] == source_ids[0])
        if source.get('access', {}).get('surface') in ('screenshot', 'search-snippet', 'metadata'):
            raise ValueError('Screenshots/search previews/metadata cannot establish an executable data specimen')
        base = (run / 'specimens').resolve()
        path = (run / text(spec.get('source_file'), 'source_file')).resolve()
        if not path.is_relative_to(base) or path.is_symlink() or not path.is_file():
            raise ValueError('Specimen sources must be saved files inside this run/specimens/')
        raw = path.read_bytes()
        if len(raw) > 5_000_000:
            raise ValueError('Specimen source exceeds 5 MB; save a documented extraction')
        sha = hashlib.sha256(raw).hexdigest()
        if spec.get('source_sha256') != sha:
            raise ValueError('Specimen source hash mismatch')
        fmt = spec.get('format')
        index = spec.get('record_index', 0)
        if type(index) is not int or index < 0:
            raise ValueError('record_index must be a nonnegative integer')
        if fmt == 'jsonl-gzip':
            import io
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                raw = stream.read(5_000_001)
            if len(raw) > 5_000_000:
                raise ValueError('Decoded specimen source exceeds 5 MB')
        decoded = raw.decode('utf-8-sig')
        if fmt in ('jsonl', 'jsonl-gzip'):
            rows = [line for line in decoded.splitlines() if line.strip()]
            record = json.loads(rows[index])
        elif fmt == 'json':
            value = json.loads(decoded)
            if not isinstance(value, list) and index != 0:
                raise ValueError('A JSON object has record_index 0')
            record = value[index] if isinstance(value, list) else value
        elif fmt == 'python-tasks':
            record = python_tasks(decoded)[index]
        else:
            raise ValueError('Specimen format must be json/jsonl/jsonl-gzip/python-tasks')
        if not isinstance(record, dict):
            raise ValueError('Specimen must resolve to one record object')
        fields = spec.get('display_fields', list(record))
        if not isinstance(fields, list) or not fields or any(f not in record for f in fields):
            raise ValueError('display_fields must name fields present in the actual record')
        displayed = {k: record[k] for k in fields}
        content = json.dumps(displayed, ensure_ascii=False, indent=2)
        if len(content) > 20000:
            raise ValueError('Choose a shorter representative record; do not truncate input/output strings')
        roles, issues = set(), []
        for field in schema:
            try:
                value = pointer(displayed, field['path'])
            except ValueError:
                continue
            actual = value_type(value)
            if field['type'] != actual and not (field['type'] == 'number' and actual == 'integer'):
                raise ValueError('Schema type disagrees with actual specimen: ' + field['path'])
            if value not in (None, '', [], {}) and value not in ('...', '…', '[omitted]'):
                roles.add(field['role'])
        missing = set(subject.get('required_roles', [])) - roles
        if missing:
            issues.append('example-missing-roles:' + ','.join(sorted(missing)))
        for key in displayed:
            if not any(f['path'] == '/' + key.replace('~', '~0').replace('/', '~1') or f['path'].startswith('/' + key + '/') for f in schema):
                issues.append('unexplained-field:' + key)
        walkthrough = spec.get('walkthrough', {})
        for key in ('input', 'output', 'scoring'):
            if not isinstance(walkthrough, dict) or not isinstance(walkthrough.get(key), str) or not walkthrough[key].strip():
                issues.append('missing-walkthrough:' + key)
        source_format = spec.get('source_format', fmt)
        note = spec.get('extraction_note', '')
        if (source_format != fmt or fmt == 'python-tasks') and not note:
            raise ValueError('Decoded/normalized specimens need an explicit extraction_note')
        return {'id': spec['id'], 'record': displayed, 'source_ids': source_ids, 'source_sha256': sha,
                'source_file': spec['source_file'], 'record_index': index, 'source_format': source_format,
                'omitted_fields': [k for k in record if k not in displayed], 'extraction_note': note,
                'walkthrough': walkthrough, 'issues': issues}

    def prepare(self, task, run, items):
        d = task.get('delivery')
        if not d or d['profile'] == 'narrative':
            return {'ready': True, 'cards': [], 'issues': [], 'matrix': []}
        path = run / 'cards.json'
        rows = self.w.read_json(path) if path.exists() else []
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ValueError('cards.json must be an array of object dossiers')
        by_id = {r.get('subject_id'): r for r in rows}
        expected = {s['id'] for s in d['subjects']}
        if len(by_id) != len(rows) or set(by_id) - expected:
            raise ValueError('Duplicate or unplanned subject cards')
        cards, issues, matrix = [], [], []
        specimen_ids = set()
        for subject in d['subjects']:
            row = by_id.get(subject['id'], {})
            card = {'subject_id': subject['id'], 'name': subject['name'], 'facets': [], 'schema': [], 'specimens': []}
            if set(row.get('facets', {})) - {f['id'] for f in d['facets']}:
                raise ValueError('Unknown card facet')
            for facet in d['facets']:
                value = row.get('facets', {}).get(facet['id'], {})
                refs = self.refs(value.get('source_urls', []), subject['id'], facet['axis_ids'], items)
                body = value.get('text', '')
                if not isinstance(body, str):
                    raise ValueError('Facet text must be a string')
                complete = bool(body.strip() and refs)
                cell = dict(facet, text=body, source_ids=refs, status='complete' if complete else 'missing')
                card['facets'].append(cell)
                matrix.append({'subject_id': subject['id'], 'facet_id': facet['id'], 'status': cell['status']})
                if not complete:
                    issues.append(subject['id'] + ':missing-facet:' + facet['id'])
            for field in row.get('schema', []):
                text(field.get('path'), 'schema path')
                if not field['path'].startswith('/') or field.get('type') not in TYPES or field.get('role') not in ROLES:
                    raise ValueError('Schema requires pointer/type/role')
                text(field.get('description'), 'field description')
                refs = self.refs(field.get('source_urls', []), subject['id'], [], items)
                if not refs:
                    raise ValueError('Schema field requires actual source evidence')
                card['schema'].append({k: field[k] for k in ('path', 'type', 'role', 'description')} | {'source_ids': refs})
            if len({f['path'] for f in card['schema']}) != len(card['schema']):
                raise ValueError('Duplicate schema fields')
            for spec in row.get('specimens', []):
                if spec['id'] in specimen_ids:
                    raise ValueError('Duplicate specimen IDs')
                specimen_ids.add(spec['id'])
                sample = self.specimen(spec, subject, card['schema'], run, items)
                card['specimens'].append(sample)
                issues.extend(subject['id'] + ':' + sample['id'] + ':' + issue for issue in sample['issues'])
            if len(card['specimens']) < subject.get('min_examples', 0):
                issues.append(subject['id'] + ':missing-concrete-example')
            cards.append(card)
        return {'ready': not issues, 'cards': cards, 'issues': issues, 'matrix': matrix}

    def coverage(self, bundle):
        covered, gaps, used = set(), set(), set()
        for card in bundle.get('delivery', {}).get('cards', []):
            for facet in card['facets']:
                (covered if facet['status'] == 'complete' else gaps).update(facet['axis_ids'])
                used.update(facet['source_ids'])
            for field in card['schema']:
                used.update(field['source_ids'])
            for sample in card['specimens']:
                used.update(sample['source_ids'])
        return covered, gaps, used

    def validate_order(self, article, bundle):
        delivery = bundle['task'].get('delivery')
        if delivery and delivery['profile'] != 'narrative':
            expected = [s['id'] for s in delivery['subjects']]
            if article.get('catalog_order') != expected:
                raise ValueError('Catalog must include every subject once in the planned order')

    def render(self, article, bundle):
        if not bundle.get('delivery', {}).get('cards'):
            return ''
        esc = self.w.md_text
        def cite(refs):
            return ' '.join(f'[{s}](#source-{s.lower()})' for s in refs)
        cards = {c['subject_id']: c for c in bundle['delivery']['cards']}
        out = ''
        for key in article['catalog_order']:
            card = cards[key]
            out += '## ' + esc(card['name']) + '\n\n'
            facets = {f['id']: f for f in card['facets']}
            shown = set()
            def explain(keys):
                bits = []
                for facet_id in keys:
                    if facet_id not in facets:
                        continue
                    facet = facets[facet_id]
                    shown.add(facet_id)
                    body = facet['text'] if facet['status'] == 'complete' else facet['label'] + '：尚未取得可用证据，待补查。'
                    bits.append(esc(body) + ' ' + cite(facet['source_ids']))
                return ' '.join(bits) + '\n\n' if bits else ''
            # Facets are an internal completeness aid, not eleven disconnected headings.
            out += explain(['overview', 'task', 'unit', 'mechanism'])
            out += explain(['version', 'splits', 'storage'])
            if card['schema'] or card['specimens']:
                out += '### 数据形式与样本\n\n'
            out += explain(['input', 'output'])
            if card['schema']:
                out += '### 字段与角色\n\n| 字段路径 | 类型 | 角色 | 含义 |\n| --- | --- | --- | --- |\n'
                roles = {'input': '输入', 'reference': '参考答案/参考实现', 'scoring': '评分用数据', 'environment': '环境上下文', 'metadata': '元数据'}
                for f in card['schema']:
                    out += '| ' + ' | '.join(esc(v) for v in (f['path'], f['type'], roles[f['role']], f['description'])) + ' ' + cite(f['source_ids']) + ' |\n'
                out += '\n'
            for sample in card['specimens']:
                label = '关键字段投影' if sample['omitted_fields'] else '完整记录'
                out += '### 具体样本：' + esc(sample['id']) + '\n\n'
                out += '以下为所读记录的 JSON 展示（' + label + '）；源格式：' + esc(sample['source_format']) + '。' + cite(sample['source_ids']) + '\n\n'
                if sample['extraction_note']:
                    out += esc(sample['extraction_note']) + '\n\n'
                if sample['omitted_fields']:
                    out += '省略的字段：' + esc('、'.join(sample['omitted_fields'])) + '。展示的字段值未截断。\n\n'
                content = json.dumps(sample['record'], ensure_ascii=False, indent=2)
                fence = '`' * max(3, 1 + max([len(x) for x in re.findall('`+', content)] or [0]))
                out += fence + 'json\n' + content + '\n' + fence + '\n\n'
                for field, label in [('input', '模型输入'), ('output', '预期输出'), ('scoring', '如何评分')]:
                    out += '**' + label + '：** ' + esc(sample['walkthrough'].get(field) or '待补查') + '\n\n'
            if any(k in facets for k in ('scoring', 'use', 'limits')):
                out += '### 评分、用途与边界\n\n'
                out += explain(['scoring', 'use', 'limits'])
            out += explain([f['id'] for f in card['facets'] if f['id'] not in shown])
        return out

    def check_ids(self, task):
        checks = ['request-fulfillment', 'organization', 'reader-understanding', 'source-fidelity', 'source-discrimination']
        for subject in task.get('delivery', {}).get('subjects', []):
            checks.append('subject:' + subject['id'] + ':introduction')
            if subject.get('min_examples', 0):
                checks.append('subject:' + subject['id'] + ':input-output-scoring')
        return checks

    def fingerprints(self, run, bundle):
        article = self.w.read_json(run / 'article.json')
        return {'task_sha256': self.w.digest(bundle['task']), 'bundle_sha256': self.w.digest(bundle),
                'article_sha256': self.w.digest(article),
                'report_sha256': hashlib.sha256((run / 'report.md').read_bytes()).hexdigest()}

    def acceptance_brief(self, run, bundle):
        if not bundle['task'].get('delivery'):
            return
        out = {'fingerprints': self.fingerprints(run, bundle), 'required_checks': self.check_ids(bundle['task']),
               'instructions': '实际负责人阅读 report.md；要求真实样本时另核对样本，逐项记录判断与报告位置。不能用 build/引用数量或执行者的成功消息替代验收，不得伪造其他 Agent 的审核。生成 acceptance.json 后执行 accept。',
               'requirements': bundle['task']['delivery']['requirements'],
               'known_issues': bundle.get('delivery', {}).get('issues', [])}
        self.w.write_json(run / 'acceptance-brief.json', out)
        guide = self.w.read_research_guide()
        self.w.write_text(run / 'acceptance-prompt.md', guide + '\n\n## 本次具体约定\n\n' +
                          json.dumps(out, ensure_ascii=False, indent=2) + '\n')

    def accept(self, run, bundle, path):
        if not bundle['task'].get('delivery'):
            raise ValueError('Legacy task has no delivery contract; create a new task with one')
        if not bundle.get('delivery', {}).get('ready', True):
            raise ValueError('Missing delivery cells/examples cannot pass final acceptance')
        self.verify_specimen_sources(run, bundle)
        data = self.w.read_json(path)
        if data.get('fingerprints') != self.fingerprints(run, bundle):
            raise ValueError('Acceptance is stale or does not bind this exact report/article/evidence')
        text(data.get('reviewer'), 'actual reviewer identity')
        rows = data.get('checks', [])
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ValueError('Acceptance checks must be an array')
        by_id = {r.get('id'): r for r in rows}
        if len(by_id) != len(rows) or set(by_id) != set(self.check_ids(bundle['task'])):
            raise ValueError('Acceptance must address every required check exactly once')
        for check in rows:
            if check.get('status') != 'pass':
                raise ValueError('Reader-facing acceptance failed: ' + check['id'])
            finding = text(check.get('notes'), 'specific readback finding')
            if finding.lower().strip('。.!！') in ('pass', 'ok', '通过', '已检查', '完成', 'done'):
                raise ValueError('Acceptance needs a concrete finding, not a success word')
            locations = check.get('locations')
            if not isinstance(locations, list) or not locations or any(not isinstance(l, str) or not l.strip() for l in locations):
                raise ValueError('Acceptance requires report locations, not a generic success flag')
            known = {'report:whole'} | {'source:' + i['id'] for i in bundle['items']}
            article = self.w.read_json(run / 'article.json')
            known |= {'section:' + str(i) for i in range(len(article['sections']))}
            for card in bundle.get('delivery', {}).get('cards', []):
                known.add('subject:' + card['subject_id'])
                known |= {'specimen:' + s['id'] for s in card['specimens']}
            if any(location not in known for location in locations):
                raise ValueError('Acceptance points to a nonexistent report location')
            if check['id'].startswith('subject:'):
                subject_id = check['id'].split(':')[1]
                card = next(c for c in bundle['delivery']['cards'] if c['subject_id'] == subject_id)
                relevant = {'subject:' + subject_id} | {'specimen:' + s['id'] for s in card['specimens']}
                if not relevant & set(locations):
                    raise ValueError('Object acceptance must point to that object/sample')
        self.w.write_json(run / 'accepted.json', data)
        result = self.w.read_json(run / 'result.json')
        if not result.get('route'):
            result['status'] = 'accepted'
        result.update(acceptance_status='accepted', acceptance_sha256=self.w.digest(data))
        self.w.write_json(run / 'result.json', result)
        return data

    def require_acceptance(self, run, bundle):
        if not bundle['task'].get('delivery'):
            return None
        self.verify_specimen_sources(run, bundle)
        path = run / 'accepted.json'
        if not path.exists():
            raise ValueError('Read the final report and run accept before website integration/publication')
        data = self.w.read_json(path)
        if data.get('fingerprints') != self.fingerprints(run, bundle):
            raise ValueError('Content changed after acceptance; render and accept the report again')
        return data

    def verify_specimen_sources(self, run, bundle):
        for card in bundle.get('delivery', {}).get('cards', []):
            for sample in card['specimens']:
                path = (run / sample['source_file']).resolve()
                if not path.is_relative_to((run / 'specimens').resolve()) or not path.is_file():
                    raise ValueError('Accepted specimen source is missing/outside the run')
                if hashlib.sha256(path.read_bytes()).hexdigest() != sample['source_sha256']:
                    raise ValueError('Specimen source changed after collection')

    def handoff(self, task, run):
        """A durable assignment, not a request to launch or impersonate another agent."""
        path = run / 'assignment.json'
        manifest = {'task_sha256': self.w.digest(task), 'task': task,
                    'executor_outputs': ['search-log.json', 'evidence.json', 'cards.json (catalog only)',
                                         'specimens/ (when concrete data requested)', 'article.json', 'report.md'],
                    'assigner_responsibility': '阅读最终报告并核验任务完成；不是转发执行者成功消息',
                    'executor_responsibility': '从原文记录证据，按约定交付；仅目录型任务要求对象卡与所需样本，缺口明确报告'}
        if path.exists() and self.w.read_json(path)['task_sha256'] != manifest['task_sha256']:
            raise ValueError('Assignment already frozen; use a new slug/run for a changed task')
        self.w.write_json(path, manifest)
        guide = self.w.read_research_guide()
        out = guide + '\n\n# 本次调研分派与交付约定\n\n原始问题：' + task['question'] + '\n\n'
        out += '本次已选择结构化交接。assignment.json 保留完整 task；文件接口见 .agents/skills/seagull-research/references/task-pipeline.md，目录型任务另读 references/delivery-contract.md（相对 skill 目录）。\n\n'
        out += '## 必须交付\n\n'
        for requirement in task.get('delivery', {}).get('requirements', []):
            out += '- ' + requirement + '\n'
        d = task.get('delivery', {})
        if d.get('subjects'):
            out += '\n## 对象与必答内容\n\n| 对象 | 必答内容 | 样本要求 |\n| --- | --- | --- |\n'
            for subject in d['subjects']:
                out += '| ' + subject['name'] + ' | ' + '、'.join(f['label'] for f in d['facets']) + ' | ' + str(subject.get('min_examples', 0)) + ' 个；角色 ' + ', '.join(subject.get('required_roles', [])) + ' |\n'
        out += '\n## 工具步骤\n\n检索与阅读 → 累计 evidence/search-log → collect → 写作 → report → 实际负责人试读与 accept。目录型交付在 collect 前另准备 cards.json 和要求的样本。完成判断使用前附 skill 与本次 requirements。\n'
        self.w.write_text(run / 'handoff.md', out)
        return manifest
