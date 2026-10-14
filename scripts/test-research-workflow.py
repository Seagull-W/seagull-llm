import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from datetime import date

spec = importlib.util.spec_from_file_location('workflow', Path(__file__).with_name('research-workflow.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WorkflowTests(unittest.TestCase):
    def bundle(self):
        return {'items': [{'id': 'S1'}, {'id': 'S2'}, {'id': 'S3'}]}

    def article(self, bundle):
        return {'bundle_sha256': w.digest(bundle), 'title': '测试文章', 'description': '摘要', 'sections': [
            {'heading': '问题', 'paragraphs': [{'text': '研究判断', 'source_ids': ['S1', 'S2']}]},
            {'heading': '边界', 'paragraphs': [{'text': '研究边界', 'source_ids': ['S3']}]}
        ]}

    def test_rejects_unknown_citations_and_stale_evidence(self):
        bundle = self.bundle()
        article = self.article(bundle)
        article['sections'][0]['paragraphs'][0]['source_ids'] = ['S404']
        with self.assertRaises(ValueError):
            w.validate_article(article, bundle)
        article = self.article(bundle)
        article['bundle_sha256'] = 'stale'
        with self.assertRaises(ValueError):
            w.validate_article(article, bundle)

    def test_source_aliases_merge_and_vue_is_neutralized(self):
        self.assertEqual(w.canonical_url('https://huggingface.co/papers/2610.00001'), w.canonical_url('http://arxiv.org/abs/2610.00001v3'))
        text = w.md_text('<script>alert(1)</script>{{ process.env.KEY }}\n# new heading')
        self.assertNotIn('<script>', text)
        self.assertNotIn('{{', text)
        self.assertNotIn('\n', text)

    def test_hf_flat_and_nested_formats(self):
        import json
        item = {'id': '2610.00001', 'title': 'RL', 'summary': 'reinforcement learning', 'publishedAt': '2026-10-13T00:00:00Z'}
        self.assertEqual(w.hf_items(json.dumps([item]).encode()), w.hf_items(json.dumps([{'paper': item}]).encode()))

    def test_collect_deduplicates_across_sources_and_ignores_old_records(self):
        config = {'topic': 'RL', 'slug': 'rl', 'lookback_days': 7, 'max_items': 10, 'keywords': ['reinforcement'], 'sources': [{'id': 'a', 'type': 'rss', 'url': 'https://a.example/feed'}, {'id': 'b', 'type': 'rss', 'url': 'https://b.example/feed'}]}
        records = [{'url': 'https://arxiv.org/abs/2610.00001', 'title': 'RL', 'summary': 'reinforcement', 'published_at': '2026-10-13T00:00:00Z', 'updated_at': '', 'reading_scope': 'feed-excerpt'}, {'url': 'https://a.example/old', 'title': 'RL', 'summary': 'reinforcement', 'published_at': '2020-01-01T00:00:00Z'}]
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog.json'), patch.object(w, 'fetch', return_value=b'feed'), patch.object(w, 'rss_items', side_effect=lambda _: [dict(x) for x in records]):
                self.assertTrue(w.collect(config, date(2026, 10, 14), run))
            bundle = w.read_json(run / 'bundle.json')
            self.assertEqual(len(bundle['items']), 1)
            self.assertEqual(bundle['items'][0]['discovered_via'], ['a', 'b'])

    def test_source_failure_blocks_default_and_no_updates_create_no_article(self):
        config = {'topic': 'RL', 'slug': 'rl', 'lookback_days': 7, 'max_items': 10, 'keywords': ['reinforcement'], 'sources': [{'id': 'a', 'type': 'rss', 'url': 'https://a.example/feed'}]}
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog.json'), patch.object(w, 'fetch', side_effect=OSError('offline')):
                with self.assertRaises(ValueError):
                    w.collect(config, date(2026, 10, 14), run)
            self.assertTrue(w.read_json(run / 'bundle.json')['partial'])
            with patch.object(w, 'CATALOG', run / 'catalog.json'), patch.object(w, 'fetch', return_value=b'feed'), patch.object(w, 'rss_items', return_value=[]):
                self.assertFalse(w.collect(config, date(2026, 10, 14), run))
            self.assertEqual(w.read_json(run / 'result.json')['status'], 'no-new-items')
            self.assertFalse((run / 'article.json').exists())


if __name__ == '__main__':
    unittest.main()
