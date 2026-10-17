"""Behavioral regression tests for task research; no network/model/publishing."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('workflow', Path(__file__).with_name('research-workflow.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class TaskTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name)
        # Local operator skills are intentionally excluded from Git checkouts.
        guide = patch.object(w, 'read_research_guide', return_value='# Offline task guide\n')
        guide.start()
        self.addCleanup(guide.stop)
        self.engine = w.task_engine()
        self.day = date(2026, 10, 16)

    def task(self):
        task = self.engine.plan('什么是因果推断？', 'concept', 'causality')
        task.pop('delivery')  # Legacy v2 behavior remains compatible; new delivery checks have separate tests.
        task['axes'] = task['axes'][:1]
        task['searches'] = [j for j in task['searches'] if j['axis_ids'] == ['definition']]
        return self.engine.normalize(task)

    def evidence(self, suffix='one', **changes):
        row = {'url': 'https://example.org/' + suffix, 'title': '教材定义', 'summary': '实际读到的定义摘录。',
               'published_at': '2000', 'updated_at': '', 'retrieved_at': '2026-10-16T08:00:00+08:00',
               'reading_scope': 'full-text-excerpt', 'source_kind': 'textbook', 'locator': '第 2 章，定义 1',
               'authority': 'primary', 'independence_key': suffix, 'role': 'foundation', 'stance': 'context',
               'axis_ids': ['definition'], 'search_ids': ['definition-foundation'], 'relevance': '给出问题的定义。'}
        row.update(changes)
        return row

    def prepare(self, task=None, rows=None, logs=True):
        task = task or self.task()
        self.engine.discover(task, self.day, self.run)
        if rows is None:
            rows = [self.evidence(), self.evidence('two', url='https://another.example/definition')]
        w.write_json(self.run / 'evidence.json', rows)
        if logs:
            w.write_json(self.run / 'search-log.json', [
                {'search_id': j['id'], 'query': '实际执行的查询 ' + j['role'], 'tool': 'test-search',
                 'searched_at': '2026-10-16T08:00:00+08:00', 'status': 'executed',
                 'urls': ['https://example.org/one'], 'notes': '真实执行记录的离线模拟'} for j in task['searches']])
        return task

    def collect(self, task, partial=False):
        logs = [self.run / 'search-log.json'] if (self.run / 'search-log.json').exists() else []
        return self.engine.collect(task, self.day, self.run, [self.run / 'evidence.json'], logs, partial)

    def article(self, bundle):
        return {'bundle_sha256': w.digest(bundle), 'title': '因果推断定义', 'description': '定义与证据边界',
                'sections': [{'heading': '定义', 'paragraphs': [{'text': '有据可查的定义。', 'kind': 'fact',
                    'axis_ids': ['definition'], 'source_ids': [i['id'] for i in bundle['items']]}]}]}

    def test_modes_do_not_inherit_daily_topic_sources_or_window(self):
        for mode in ('concept', 'comparison', 'landscape', 'decision', 'news', 'custom'):
            task = self.engine.normalize(self.engine.plan('机会成本是什么', mode, 'opportunity-cost'))
            self.assertNotIn('keywords', task)
            self.assertNotIn('sources', task)
            self.assertNotIn('reinforcement', json.dumps(task))
            self.assertEqual(task['time_policy'], 'recent' if mode == 'news' else 'all-time' if mode == 'concept' else 'mixed')
        academic = self.engine.plan('entropy', 'concept', 'entropy', 'academic')
        self.assertTrue({'web', 'arxiv', 'crossref'} <= {j['provider'] for j in academic['searches']})

    def test_bad_plans_and_unsearched_axes_fail(self):
        for change in ({'slug': '../escape'}, {'budget': {'max_rounds': True}}, {'time_policy': 'daily'}, {'tags': []}, {'axes': [None]}):
            task = dict(self.task(), **change)
            with self.assertRaises(ValueError):
                self.engine.normalize(task)
        task = self.task()
        task['searches'][0]['axis_ids'] = ['unknown']
        with self.assertRaises(ValueError):
            self.engine.normalize(task)

    def test_old_undated_and_previously_used_material_can_answer_concepts(self):
        task = self.prepare(rows=[self.evidence(), self.evidence('two', published_at='', url='https://another.example/two')])
        # No catalog read: prior daily coverage is irrelevant to a concept task.
        with patch.object(w, 'CATALOG', self.run / 'nonexistent-catalog'):
            self.collect(task)
        bundle = w.read_json(self.run / 'bundle.json')
        self.assertTrue(bundle['review']['ready'])
        self.assertIsNone(bundle['window_start'])
        self.assertEqual(bundle['items'][0]['published_at'], '2000')
        self.assertEqual(bundle['items'][1]['published_at'], '')
        self.assertTrue(any('undated' in m for m in bundle['review']['warnings']))

    def test_current_material_requires_reliable_recent_date(self):
        for stamp in ('', '2000-01-01', '2026', '2027-01-01'):
            task = self.prepare(rows=[self.evidence(role='current', published_at=stamp)])
            with self.assertRaises(ValueError):
                self.collect(task)

    def test_translations_and_reposts_are_not_independent_evidence(self):
        task = self.prepare(rows=[self.evidence(), self.evidence('two', independence_key='one')])
        with self.assertRaises(ValueError):
            self.collect(task)
        review = w.read_json(self.run / 'review.json')
        self.assertEqual(review['coverage'][0]['independent_sources'], 1)
        self.assertIn('insufficient-independent-evidence', review['coverage'][0]['reasons'])

    def test_same_url_and_arxiv_version_merge_without_inflating_counts(self):
        task = self.prepare(rows=[self.evidence(url='https://arxiv.org/abs/2402.03300v1'),
                                  self.evidence(url='https://arxiv.org/pdf/2402.03300v3.pdf')])
        self.collect(task, partial=True)
        self.assertEqual(len(w.read_json(self.run / 'bundle.json')['items']), 1)

    def test_discovery_metadata_does_not_become_evidence(self):
        for stamp in ('2020', '2026-10-16', '2026-10-16T08:00:00'):
            task = self.prepare(rows=[self.evidence(retrieved_at=stamp)])
            with self.assertRaises(ValueError):
                self.collect(task)
        task = self.prepare(rows=[self.evidence(reading_scope='metadata')])
        with self.assertRaises(ValueError):
            self.collect(task)
        task = self.prepare(rows=[])
        with self.assertRaises(ValueError):
            self.collect(task)
        self.assertFalse((self.run / 'article.json').exists())

    def test_pending_queries_are_not_executed_searches(self):
        task = self.prepare(rows=[], logs=False)
        with self.assertRaises(ValueError):
            self.collect(task)
        review = w.read_json(self.run / 'review.json')
        self.assertIn('searches-incomplete', review['coverage'][0]['reasons'])
        self.assertEqual(len(review['followups']), 1)

    def test_no_results_is_distinct_from_blocked(self):
        task = self.prepare()
        logs = w.read_json(self.run / 'search-log.json')
        logs[-1].update(status='no-results', urls=[])
        w.write_json(self.run / 'search-log.json', logs)
        self.collect(task)
        self.assertTrue(w.read_json(self.run / 'review.json')['ready'])
        logs[-1].update(status='blocked', notes='tool unavailable')
        w.write_json(self.run / 'search-log.json', logs)
        with self.assertRaises(ValueError):
            self.collect(task)

    def test_mislabelled_search_and_excess_context_are_rejected(self):
        task = self.prepare()
        logs = w.read_json(self.run / 'search-log.json')
        logs[-1].update(status='no-results')
        w.write_json(self.run / 'search-log.json', logs)
        with self.assertRaises(ValueError):
            self.collect(task)
        task['budget']['max_excerpt_chars'] = 1000
        # New run because a discovery plan is immutable.
        self.run = self.run / 'new'
        self.run.mkdir()
        task = self.prepare(task, rows=[self.evidence(summary='a' * 1100)])
        with self.assertRaisesRegex(ValueError, 'context budget'):
            self.collect(task)

    def test_partial_requires_explicit_opt_in_and_gap_disclosure(self):
        task = self.prepare(rows=[self.evidence()])
        with self.assertRaises(ValueError):
            self.collect(task)
        with self.assertRaises(ValueError):
            w.prompt(self.run)
        self.collect(task, partial=True)
        bundle = w.read_json(self.run / 'bundle.json')
        article = self.article(bundle)
        with self.assertRaises(ValueError):
            w.validate_article(article, bundle)
        article['sections'][0]['paragraphs'].append({'text': '缺少独立核验。', 'kind': 'gap',
                                                    'axis_ids': ['definition'], 'source_ids': []})
        self.assertEqual(w.validate_article(article, bundle), {'S1'})

    def test_cross_axis_citation_and_primary_omission_are_rejected(self):
        task = self.prepare()
        self.collect(task)
        bundle = w.read_json(self.run / 'bundle.json')
        article = self.article(bundle)
        self.assertEqual(w.validate_article(article, bundle), {'S1', 'S2'})
        article['sections'][0]['paragraphs'][0]['source_ids'] = ['S1']
        with self.assertRaises(ValueError):
            w.validate_article(article, bundle)
        article = self.article(bundle)
        bundle['items'][0]['axis_ids'] = ['elsewhere']
        article['bundle_sha256'] = w.digest(bundle)
        with self.assertRaises(ValueError):
            w.validate_article(article, bundle)

    def test_followup_round_and_budget_preserve_gaps(self):
        task = self.prepare(rows=[])
        with self.assertRaises(ValueError):
            self.collect(task)
        self.engine.discover(task, self.day, self.run, 2)
        jobs = w.read_json(self.run / 'discovery.json')['jobs']
        self.assertEqual(len(jobs), len(task['searches']) + 1)
        review = self.engine.review(task, [], [dict(j, round=3) for j in jobs])
        self.assertTrue(review['budget_exhausted'])
        self.assertEqual(review['followups'], [])
        self.assertEqual(review['stop_reason'], 'budget-exhausted')

    def test_changed_task_and_post_write_discovery_are_rejected(self):
        task = self.prepare()
        changed = dict(task, question='another question')
        with self.assertRaises(ValueError):
            self.engine.discover(changed, self.day, self.run)
        w.write_json(self.run / 'article.json', {})
        with self.assertRaises(ValueError):
            self.engine.discover(task, self.day, self.run)
        with self.assertRaises(ValueError):
            self.collect(task)

    def test_arxiv_all_time_query_has_no_news_filter(self):
        job = {'provider': 'arxiv', 'query': 'all:"causal inference"', 'time_policy': 'all-time', 'limit': 4}
        atom = b'<feed xmlns="http://www.w3.org/2005/Atom"/>'
        with patch.object(w, 'fetch', return_value=atom) as fetch, patch.object(w.time, 'sleep'):
            self.engine = w.task_engine()
            self.engine.retrieve(self.task(), job, self.day, self.run)
            url = urllib_unquote(fetch.call_args.args[0])
            self.assertNotIn('lastUpdatedDate', url)
            self.assertIn('sortBy=relevance', url)

    def test_crossref_preserves_date_precision_and_metadata_scope(self):
        payload = {'message': {'items': [{'DOI': '10.1/example', 'title': ['Classic'],
                                        'published': {'date-parts': [[1948]]}}]}}
        with patch.object(w, 'fetch', return_value=json.dumps(payload).encode()):
            self.engine = w.task_engine()
            records = self.engine.retrieve(self.task(), {'provider': 'crossref', 'query': 'entropy',
                                                       'time_policy': 'all-time', 'limit': 3}, self.day, self.run)
        self.assertEqual(records[0]['published_at'], '1948')
        self.assertEqual(records[0]['reading_scope'], 'metadata')
        self.assertEqual(len(list((self.run / 'raw').glob('*.bin'))), 1)

    def test_page_text_is_only_a_candidate_and_hides_active_content(self):
        raw = b'<html><nav>menu</nav><article>Definition<script>bad()</script> and example.</article></html>'
        with patch.object(w, 'fetch', return_value=raw):
            self.engine = w.task_engine()
            rows = self.engine.retrieve(self.task(), {'provider': 'url', 'url': 'https://example.org/a'}, self.day, self.run)
        self.assertNotIn('bad()', rows[0]['summary'])
        self.assertNotIn('menu', rows[0]['summary'])
        self.assertEqual(rows[0]['reading_scope'], 'page-text')

    def test_successful_discovery_resumes_and_blocked_adapter_retries(self):
        task = self.task()
        task['searches'] = [{'id': 'book', 'provider': 'url', 'url': 'https://example.org/book',
                             'axis_ids': ['definition'], 'role': 'foundation', 'time_policy': 'all-time'}]
        with patch.object(self.engine, 'retrieve', side_effect=[OSError('offline'), [self.evidence()]] ) as retrieve:
            self.engine.discover(task, self.day, self.run)
            self.engine.discover(task, self.day, self.run)
            self.engine.discover(task, self.day, self.run)
            self.assertEqual(retrieve.call_count, 2)
        self.assertEqual(w.read_json(self.run / 'discovery.json')['jobs'][0]['status'], 'executed')

    def test_task_render_and_integrate_preserve_catalog_and_escape_source_text(self):
        task = self.prepare()
        self.collect(task)
        bundle = w.read_json(self.run / 'bundle.json')
        article = self.article(bundle)
        article['sections'][0]['paragraphs'][0]['text'] = '{{ process.env.KEY }} <script>bad</script>'
        w.write_json(self.run / 'article.json', article)
        content, _ = w.render_article(task, self.run)
        self.assertIn('问题覆盖与证据边界', content)
        self.assertNotIn('{{', content)
        self.assertNotIn('<script>', content)
        self.assertNotIn('未进行全文精读', content)
        root = self.run / 'website'
        catalog = root / 'docs/research/catalog.json'
        prior = {'date': '2026-10-15', 'slug': 'manual', 'title': '手工专题', 'description': '保留',
                 'route': '/research/2026-10-15-manual', 'source_urls': [], 'window_end': '2026-10-16T00:00:00Z'}
        w.write_json(catalog, [prior])
        with patch.object(w, 'ROOT', root), patch.object(w, 'CATALOG', catalog):
            w.integrate(task, self.run)
        self.assertEqual(len(w.read_json(catalog)), 2)
        self.assertIn(prior['route'], (root / 'docs/research/index.md').read_text())
        self.assertIn('调研', (root / 'docs/.vitepress/research-sidebar.ts').read_text())

    def test_task_cli_report_is_local_and_cannot_be_mistaken_for_site_integration(self):
        base = self.run
        with patch.object(w, 'LOCAL', base):
            self.engine = w.task_engine()
            self.run = base / 'runs/2026-10-16-causality'
            self.run.mkdir(parents=True)
            task = self.prepare()
            self.collect(task)
            w.write_json(self.run / 'article.json', self.article(w.read_json(self.run / 'bundle.json')))
            task_path = base / 'task.json'
            w.write_json(task_path, task)
            args = SimpleNamespace(date='2026-10-16', stage='report', task=task_path, config='research/workflow.json')
            self.engine.handle(args)
            self.assertEqual(w.read_json(self.run / 'result.json')['status'], 'reported')
            self.assertTrue((self.run / 'report.md').exists())
            args.stage = 'verify'
            with self.assertRaisesRegex(ValueError, 'integrate first'):
                self.engine.handle(args)
            w.write_json(self.run / 'result.json', {'status': 'integrated', 'route': '/research/2026-10-16-causality'})
            args.stage = 'report'
            self.engine.handle(args)
            result = w.read_json(self.run / 'result.json')
            self.assertEqual(result['status'], 'integrated')
            self.assertEqual(result['report_status'], 'reported')


def urllib_unquote(value):
    from urllib.parse import unquote_plus
    return unquote_plus(value)


if __name__ == '__main__':
    unittest.main()
