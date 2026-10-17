"""Reader-facing delivery regressions; fixtures are synthetic, not benchmark claims."""
import copy
from datetime import date
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('workflow', Path(__file__).with_name('research-workflow.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        # Assert prompt wiring without depending on the operator's local skill.
        guide = patch.object(w, 'read_research_guide', return_value=(
            '# Offline delivery guide\n浏览器搜索摘要只作线索；原文摘录才作为证据。\n'))
        guide.start()
        self.addCleanup(guide.stop)
        self.e = w.task_engine()
        self.d = w.delivery_engine()
        self.task = self.e.normalize(self.e.plan('逐个介绍数据集和具体数据形式', 'custom', 'catalog-test',
                                                deliverable='dataset-catalog', subjects=['toy=演示数据集']))
        self.axes = [a['id'] for a in self.task['axes']]
        self.items = [{'id': 'S1', 'url': 'https://example.org/toy.jsonl', 'title': '演示数据',
                       'summary': '这是一条测试用的合成记录。', 'subject_ids': ['toy'], 'axis_ids': self.axes,
                       'authority': 'primary', 'independence_key': 'toy', 'source_group': 'dataset',
                       'source_kind': 'dataset',
                       'reading_scope': 'full-text-excerpt', 'locator': '第 1 行',
                       'retrieved_at': '2026-10-16T12:00:00+08:00', 'discovered_via': ['test'],
                       'role': 'foundation', 'stance': 'context',
                       'access': {'method': 'http', 'surface': 'downloaded-data', 'limitations': []}}]
        source = self.run / 'specimens/toy.jsonl'
        source.parent.mkdir()
        source.write_text(json.dumps({'question': '2 + 3 = ?', 'answer': '5', 'id': 'toy-1'}) + '\n')
        self.card = {'subject_id': 'toy',
                     'facets': {f['id']: {'text': '演示说明：' + f['label'], 'source_urls': [self.items[0]['url']]}
                                for f in self.task['delivery']['facets']},
                     'schema': [{'path': '/' + k, 'type': 'string', 'role': role, 'description': description,
                                 'source_urls': [self.items[0]['url']]}
                                for k, role, description in [('question', 'input', '题目'), ('answer', 'reference', '参考答案'), ('id', 'metadata', '记录标识')]],
                     'specimens': [{'id': 'toy-example', 'source_url': self.items[0]['url'],
                                    'source_file': 'specimens/toy.jsonl', 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                    'format': 'jsonl', 'record_index': 0, 'display_fields': ['question', 'answer'],
                                    'walkthrough': {'input': '模型接收 question，不接收参考答案。',
                                                    'output': '模型应回答 5。', 'scoring': '在这个合成用例中与参考值比较。'}}]}

    def prepare(self, cards=None):
        w.write_json(self.run / 'cards.json', cards if cards is not None else [self.card])
        return self.d.prepare(self.task, self.run, self.items)

    def bundle(self):
        delivery = self.prepare()
        return {'version': 2, 'task': self.task, 'task_sha256': w.digest(self.task), 'items': self.items,
                'topic': self.task['topic'], 'slug': self.task['slug'], 'date': '2026-10-16',
                'collected_at': '2026-10-16T12:00:00+08:00', 'window_end': '2026-10-17T00:00:00+08:00',
                'source_status': [], 'partial': False, 'delivery': delivery,
                'review': {'coverage': [{'id': a, 'status': 'covered', 'required': True, 'question': a,
                                        'independent_sources': 1, 'reasons': []} for a in self.axes], 'warnings': []}}

    def article(self, bundle):
        return {'bundle_sha256': w.digest(bundle), 'title': '演示目录', 'description': '测试统一的对象介绍和实际样本',
                'catalog_order': ['toy'], 'sections': []}

    def report(self, bundle=None):
        bundle = bundle or self.bundle()
        article = self.article(bundle)
        w.write_json(self.run / 'bundle.json', bundle)
        w.write_json(self.run / 'article.json', article)
        content, _ = w.render_article(self.task, self.run)
        w.write_text(self.run / 'report.md', content)
        w.write_json(self.run / 'result.json', {'status': 'reported'})
        return bundle, article, content

    def acceptance(self, bundle):
        return {'reviewer': '测试中的实际审核者', 'fingerprints': self.d.fingerprints(self.run, bundle),
                'checks': [{'id': key, 'status': 'pass', 'notes': '逐项核对了示例 question 输入、answer 标签及其判分说明。',
                            'locations': ['subject:toy'] if key.startswith('subject:') else ['report:whole']}
                           for key in self.d.check_ids(self.task)]}

    def test_catalog_requires_objects_and_input_output_contract(self):
        with self.assertRaises(ValueError):
            self.e.plan('数据集', 'custom', 'x', deliverable='dataset-catalog')
        changed = copy.deepcopy(self.task)
        changed['delivery']['subjects'][0]['required_roles'] = ['metadata']
        with self.assertRaises(ValueError):
            self.e.normalize(changed)

    def test_global_sources_do_not_cover_a_missing_object_or_facet(self):
        self.task['delivery']['subjects'].append(dict(self.task['delivery']['subjects'][0], id='other', name='第二个对象'))
        result = self.prepare()
        self.assertFalse(result['ready'])
        self.assertIn('other:missing-concrete-example', result['issues'])
        self.assertIn('other:missing-facet:overview', result['issues'])
        self.assertEqual(len(result['matrix']), 2 * len(self.task['delivery']['facets']))

    def test_collect_stops_even_when_global_axis_source_counts_are_satisfied(self):
        self.task['delivery']['subjects'].append(dict(self.task['delivery']['subjects'][0], id='other', name='第二个对象'))
        self.e.discover(self.task, date(2026, 10, 16), self.run)
        self.prepare()
        row = dict(self.items[0], relevance='合成单元测试材料，覆盖全局轴但没有第二个对象。',
                   search_ids=[self.task['searches'][0]['id']], discovery_method='web-search')
        w.write_json(self.run / 'evidence.json', [row])
        w.write_json(self.run / 'search-log.json', [{'search_id': j['id'], 'query': j['query'], 'tool': 'unit-test-fixture',
                    'searched_at': '2026-10-16T12:00:00+08:00', 'status': 'executed',
                    'urls': [row['url']], 'notes': '合成测试记录，不代表真实检索。'} for j in self.task['searches']])
        with self.assertRaises(ValueError):
            self.e.collect(self.task, date(2026, 10, 16), self.run, [self.run / 'evidence.json'], [self.run / 'search-log.json'])
        review = w.read_json(self.run / 'review.json')
        self.assertTrue(review['sources_ready'])
        self.assertFalse(review['ready'])
        self.assertEqual(review['stop_reason'], 'delivery-incomplete')
        self.assertTrue(any('other' in j['id'] for j in review['followups']))

    def test_answer_only_and_id_only_projections_fail(self):
        # These reproduce the published survey's observed failure shapes.
        for fields in (['answer'], ['id'], ['answer', 'id']):
            self.card['specimens'][0]['display_fields'] = fields
            result = self.prepare()
            self.assertFalse(result['ready'])
            self.assertTrue(any('example-missing-roles:input' in s for s in result['issues']))

    def test_input_and_reference_are_extracted_without_shortening_strings(self):
        result = self.prepare()
        self.assertTrue(result['ready'])
        sample = result['cards'][0]['specimens'][0]
        self.assertEqual(sample['record'], {'question': '2 + 3 = ?', 'answer': '5'})
        self.assertEqual(sample['omitted_fields'], ['id'])

    def test_missing_walkthrough_does_not_count_as_a_concrete_explanation(self):
        self.card['specimens'][0]['walkthrough'].pop('scoring')
        self.assertTrue(any('missing-walkthrough:scoring' in s for s in self.prepare()['issues']))

    def test_source_hash_and_source_directory_are_enforced(self):
        self.card['specimens'][0]['source_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.prepare()
        self.card['specimens'][0]['source_file'] = '../outside.json'
        with self.assertRaisesRegex(ValueError, 'inside this run'):
            self.prepare()

    def test_model_written_example_is_rejected(self):
        self.card['specimens'][0]['content'] = '{"answer":"invented"}'
        with self.assertRaisesRegex(ValueError, 'model-written'):
            self.prepare()

    def test_wrong_object_evidence_and_wrong_field_type_are_rejected(self):
        self.items[0]['subject_ids'] = ['another']
        with self.assertRaisesRegex(ValueError, 'wrong-subject'):
            self.prepare()
        self.items[0]['subject_ids'] = ['toy']
        self.card['schema'][0]['type'] = 'integer'
        with self.assertRaisesRegex(ValueError, 'type disagrees'):
            self.prepare()

    def test_screenshot_cannot_establish_raw_data_schema(self):
        self.items[0]['access']['surface'] = 'screenshot'
        with self.assertRaisesRegex(ValueError, 'Screenshots'):
            self.prepare()

    def test_catalog_renderer_keeps_an_object_and_its_sample_together(self):
        bundle, article, content = self.report()
        self.assertEqual(w.validate_article(article, bundle), {'S1'})
        self.assertIn('## 演示数据集', content)
        self.assertIn('"question": "2 + 3 = ?"', content)
        self.assertIn('模型输入', content)
        self.assertIn('预期输出', content)
        self.assertIn('如何评分', content)
        self.assertIn('展示的字段值未截断', content)
        article['catalog_order'] = []
        with self.assertRaisesRegex(ValueError, 'every subject'):
            w.validate_article(article, bundle)

    def test_literal_python_task_extraction_never_executes_code(self):
        source = 'raise RuntimeError("must not run")\nTASKS_TEST = [Task(instruction="goal", actions=[Action(name="get", kwargs={"id": 1})])]'
        path = self.run / 'specimens/task.py'
        path.write_text(source)
        self.card['schema'] = [{'path': '/instruction', 'type': 'string', 'role': 'input', 'description': '目标', 'source_urls': [self.items[0]['url']]},
                               {'path': '/actions', 'type': 'array', 'role': 'reference', 'description': '参考动作', 'source_urls': [self.items[0]['url']]}]
        self.card['specimens'][0].update(source_file='specimens/task.py', source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            format='python-tasks', display_fields=['instruction', 'actions'], extraction_note='从 Task/Action 字面量机械提取为 JSON，未执行源文件。')
        result = self.prepare()
        self.assertTrue(result['ready'])
        self.assertEqual(result['cards'][0]['specimens'][0]['record']['actions'][0]['name'], 'get')

    def test_no_acceptance_no_site_integration(self):
        bundle, _, _ = self.report()
        with self.assertRaisesRegex(ValueError, 'run accept'):
            self.d.require_acceptance(self.run, bundle)
        with patch.object(w, 'ROOT', self.run / 'site'):
            with self.assertRaises(ValueError):
                w.integrate(self.task, self.run)
        self.assertFalse((self.run / 'site/docs/research/catalog.json').exists())

    def test_acceptance_requires_specific_check_findings_and_real_locations(self):
        bundle, _, _ = self.report()
        path = self.run / 'acceptance.json'
        for alteration in ('missing-check', 'generic-pass', 'fake-location'):
            data = self.acceptance(bundle)
            if alteration == 'missing-check':
                data['checks'].pop()
            elif alteration == 'generic-pass':
                data['checks'][0]['notes'] = '通过'
            else:
                data['checks'][0]['locations'] = ['subject:not-present']
            w.write_json(path, data)
            with self.assertRaises(ValueError):
                self.d.accept(self.run, bundle, path)

    def test_acceptance_is_bound_to_the_exact_final_text(self):
        bundle, _, _ = self.report()
        path = self.run / 'acceptance.json'
        w.write_json(path, self.acceptance(bundle))
        self.d.accept(self.run, bundle, path)
        self.assertIsNotNone(self.d.require_acceptance(self.run, bundle))
        self.assertEqual(w.read_json(self.run / 'result.json')['status'], 'accepted')
        with (self.run / 'report.md').open('a') as stream:
            stream.write('\n未经审核的新段落。\n')
        with self.assertRaisesRegex(ValueError, 'changed after acceptance'):
            self.d.require_acceptance(self.run, bundle)

    def test_accepted_catalog_integration_records_the_exact_published_content(self):
        bundle, _, _ = self.report()
        path = self.run / 'acceptance.json'
        w.write_json(path, self.acceptance(bundle))
        self.d.accept(self.run, bundle, path)
        root = self.run / 'site'
        catalog = root / 'docs/research/catalog.json'
        with patch.object(w, 'ROOT', root), patch.object(w, 'CATALOG', catalog):
            w.integrate(self.task, self.run)
        row = w.read_json(catalog)[0]
        page = root / ('docs' + row['route'] + '.md')
        self.assertEqual(hashlib.sha256(page.read_bytes()).hexdigest(), row['delivery']['content_sha256'])
        self.assertEqual(row['delivery']['acceptance_sha256'], w.digest(w.read_json(self.run / 'accepted.json')))

    def test_modifying_saved_source_after_drafting_invalidates_acceptance(self):
        bundle, _, _ = self.report()
        path = self.run / 'acceptance.json'
        w.write_json(path, self.acceptance(bundle))
        with (self.run / 'specimens/toy.jsonl').open('a') as stream:
            stream.write('{}\n')
        with self.assertRaisesRegex(ValueError, 'source changed'):
            self.d.accept(self.run, bundle, path)

    def test_editorial_prompts_are_in_the_actual_runtime_handoffs(self):
        bundle, _, _ = self.report()
        self.d.handoff(self.task, self.run)
        guide = w.read_research_guide()
        self.assertTrue((self.run / 'handoff.md').read_text().startswith(guide))
        prompt = self.e.prompt(self.run, bundle)
        self.assertTrue(prompt.startswith(guide))
        self.d.acceptance_brief(self.run, bundle)
        self.assertTrue((self.run / 'acceptance-prompt.md').read_text().startswith(guide))

    def test_missing_data_cannot_be_accepted_even_as_a_partial_draft(self):
        self.card['specimens'][0]['display_fields'] = ['answer']
        bundle = self.bundle()
        bundle['partial'] = True
        bundle['partial_approved'] = True
        self.report(bundle)
        path = self.run / 'acceptance.json'
        w.write_json(path, self.acceptance(bundle))
        with self.assertRaisesRegex(ValueError, 'Missing delivery'):
            self.d.accept(self.run, bundle, path)

    def test_assignment_preserves_the_full_contract_and_is_frozen(self):
        self.d.handoff(self.task, self.run)
        self.assertEqual(w.read_json(self.run / 'assignment.json')['task'], self.task)
        self.assertIn('原始问题', (self.run / 'handoff.md').read_text())
        self.assertIn('浏览器', (self.run / 'handoff.md').read_text())
        task = dict(self.task, question='a changed assignment')
        with self.assertRaisesRegex(ValueError, 'frozen'):
            self.d.handoff(task, self.run)

    def test_browser_previews_are_leads_but_read_pages_are_evidence(self):
        task = self.e.normalize(self.e.plan('概念', 'concept', 'browser-test'))
        task['axes'] = task['axes'][:1]
        axis = task['axes'][0]['id']
        row = dict(self.items[0], axis_ids=[axis], reading_scope='manual-excerpt', relevance='支持定义。',
                   search_ids=['browser'], discovery_method='browser-search')
        logs = [{'id': 'browser', 'status': 'executed'}]
        path = self.run / 'evidence.json'
        for surface in ('metadata', 'search-snippet'):
            row['access'] = {'method': 'browser', 'surface': surface, 'limitations': []}
            w.write_json(path, [row])
            with self.assertRaisesRegex(ValueError, 'discovery leads'):
                self.e.evidence(task, [path], logs, date(2026, 10, 16))
        row['access'] = {'method': 'browser', 'surface': 'excerpt', 'limitations': ['只读定义段，未通读全文。']}
        row['authority'] = 'secondary'
        row['source_kind'] = 'research-blog'
        w.write_json(path, [row])
        accepted = self.e.evidence(task, [path], logs, date(2026, 10, 16))
        self.assertEqual(accepted[0]['access']['method'], 'browser')


if __name__ == '__main__':
    unittest.main()
