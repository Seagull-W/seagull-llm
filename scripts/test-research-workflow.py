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
    def test_local_skill_is_loaded_as_utf8_and_missing_skill_is_not_silenced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            guide = root / '.agents/skills/seagull-research/SKILL.md'
            with patch.object(w, 'ROOT', root):
                with self.assertRaises(FileNotFoundError):
                    w.read_research_guide()
                guide.parent.mkdir(parents=True)
                expected = '# 本机调研技能\n检索、阅读和试读。\n'
                guide.write_text(expected, encoding='utf-8')
                self.assertEqual(w.read_research_guide(), expected)

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


class ExpandedSourceTests(unittest.TestCase):
    def record(self, suffix='one', **kwargs):
        value = {'url': 'https://example.org/' + suffix, 'title': 'RL study', 'summary': 'reinforcement learning',
                 'published_at': '2026-10-13T00:00:00Z', 'updated_at': '', 'reading_scope': 'feed-excerpt'}
        value.update(kwargs)
        return value

    def config(self):
        return {'topic': 'RL', 'slug': 'rl', 'tags': ['RL'], 'lookback_days': 7, 'max_items': 3, 'max_per_source': 2,
                'keywords': ['reinforcement'], 'sources': [
                    {'id': 'paper', 'type': 'rss', 'url': 'https://example.org/feed', 'group': 'paper'},
                    {'id': 'blog', 'type': 'rss', 'url': 'https://example.org/blog', 'group': 'research-blog', 'required': False}]}

    def test_releases_use_publish_date_and_exclude_drafts_and_prereleases(self):
        import json
        release = {'html_url': 'https://github.com/a/b/releases/tag/v1', 'tag_name': 'v1', 'body': 'GRPO training',
                   'created_at': '2020-01-01T00:00:00Z', 'published_at': '2026-10-13T00:00:00Z', 'author': {'login': 'a'}}
        entries = [release, dict(release, draft=True), dict(release, prerelease=True)]
        items = w.github_release_items(json.dumps(entries), 'a/b')
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['published_at'], release['published_at'])
        self.assertEqual(items[0]['reading_scope'], 'release-notes')
        self.assertEqual(len(w.github_release_items(json.dumps(entries), 'a/b', True)), 2)
        with self.assertRaises(ValueError):
            w.github_release_items('{}', 'a/b')

    def test_github_adapter_reuses_gh_without_reading_tokens(self):
        from types import SimpleNamespace
        source = {'type': 'github-releases', 'repository': 'a/b'}
        with patch.object(w.shutil, 'which', return_value='/bin/gh'), patch.object(w.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'[]')) as call:
            self.assertEqual(w.source_records(source, None, None, None, {}), [])
            self.assertEqual(call.call_args.args[0], ['/bin/gh', 'api', '--hostname', 'github.com', 'repos/a/b/releases?per_page=20'])
        with patch.object(w.shutil, 'which', return_value=None), patch.object(w, 'fetch', return_value=b'[]') as fetch:
            w.source_records(source, None, None, None, {})
            fetch.assert_called_once_with('https://api.github.com/repos/a/b/releases?per_page=20')

    def test_feed_content_fallback_and_invalid_dates_are_record_local(self):
        raw = b'<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><link>https://example.org/a</link><title>RL</title><content:encoded>reinforcement</content:encoded><pubDate>bad-date</pubDate></item></channel></rss>'
        item = w.rss_items(raw)[0]
        self.assertEqual(item['summary'], 'reinforcement')
        self.assertEqual(item['published_at'], 'bad-date')
        with self.assertRaises(ValueError):
            w.rss_items(b'<html/>')
        atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><link href="https://example.org/a"/><title>RL</title><content>reinforcement</content><updated>2026-10-13T00:00:00Z</updated></entry></feed>'
        self.assertEqual(w.rss_items(atom)[0]['published_at'], '2026-10-13T00:00:00Z')

    def test_canonical_urls_and_keyword_boundaries(self):
        self.assertEqual(w.canonical_url('https://arxiv.org/pdf/2610.00001v2.pdf'), 'https://arxiv.org/abs/2610.00001')
        self.assertEqual(w.canonical_url('https://example.org/a?utm_source=x&v=2#section'), 'https://example.org/a?v=2')
        self.assertEqual(w.relevance_score('support and adposition', ['ppo', 'dpo']), 0)
        self.assertEqual(w.relevance_score('GRPO / 后训练', ['grpo', '后训练']), 2)

    def test_optional_failure_continues_but_is_disclosed_and_disabled_is_not_called(self):
        config = self.config()
        config['sources'].append({'id': 'disabled', 'type': 'rss', 'enabled': False})
        def retrieve(source, *args):
            if source['id'] == 'blog':
                raise OSError('offline')
            self.assertNotEqual(source['id'], 'disabled')
            return [self.record()]
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', side_effect=retrieve):
                self.assertTrue(w.collect(config, date(2026, 10, 14), run))
            bundle = w.read_json(run / 'bundle.json')
            self.assertTrue(bundle['partial'])
            self.assertEqual(bundle['source_status'][2]['status'], 'disabled')
            article = {'bundle_sha256': w.digest(bundle), 'title': 'RL', 'description': 'RL', 'sections': [
                {'heading': h, 'paragraphs': [{'text': 'RL', 'source_ids': ['S1']}]} for h in ['判断', '局限']]}
            w.write_json(run / 'article.json', article)
            with patch.object(w, 'ROOT', run), patch.object(w, 'CATALOG', run / 'docs/research/catalog.json'):
                w.integrate(config, run)
            self.assertIn('blog', (run / 'docs/research/2026-10-14-rl.md').read_text())

    def test_bad_records_do_not_drop_good_records_and_groups_get_coverage(self):
        config = self.config()
        records = [self.record('p' + str(i)) for i in range(6)]
        records += [self.record('bad', published_at='bad'), self.record('missing', published_at=''),
                    self.record('unsafe', url='http://example.org/no'), self.record('old', published_at='2020-01-01T00:00:00Z')]
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', side_effect=lambda source, *args: records if source['id'] == 'paper' else [self.record('blog')]):
                w.collect(config, date(2026, 10, 14), run)
            bundle = w.read_json(run / 'bundle.json')
            self.assertEqual(len(bundle['items']), 3)
            self.assertEqual({x['source_group'] for x in bundle['items']}, {'paper', 'research-blog'})
            self.assertEqual(bundle['source_status'][0]['rejected']['invalid-record'], 2)
            self.assertEqual(bundle['source_status'][0]['rejected']['missing-date'], 1)
            self.assertEqual(bundle['selection']['eligible_unique'], 7)

    def test_cap_is_respected_and_multi_import_status_is_aggregated(self):
        config = self.config()
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            imports = [run / 'one.json', run / 'two.json']
            for i, path in enumerate(imports):
                w.write_json(path, [self.record('manual' + str(i))])
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', side_effect=lambda source, *args: [self.record(str(i)) for i in range(8)] if source['id'] == 'paper' else []):
                config['max_items'] = 10
                w.collect(config, date(2026, 10, 14), run, imports=imports)
            bundle = w.read_json(run / 'bundle.json')
            self.assertEqual(sum(x['source_group'] == 'paper' for x in bundle['items']), 2)
            self.assertEqual(bundle['source_status'][2]['retrieved'], 2)
            self.assertEqual(bundle['source_status'][2]['selected'], 2)

    def test_config_rejects_duplicate_sources_and_invalid_repositories(self):
        config = dict(self.config(), tags=['RL'])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.json'
            config['sources'].append(dict(config['sources'][0]))
            w.write_json(path, config)
            with self.assertRaises(ValueError):
                w.load_config(path)
            config['sources'] = [{'id': 'github', 'type': 'github-releases', 'repository': '../wrong'}]
            w.write_json(path, config)
            with self.assertRaises(ValueError):
                w.load_config(path)


class FeedCompatibilityTests(unittest.TestCase):
    def test_rss_http_upgrade_and_bounded_description_enrichment(self):
        from datetime import datetime, timezone
        raw = b'<rss><channel><item><link>http://example.org/new</link><title>RL</title><pubDate>Tue, 13 Oct 2026 00:00:00 GMT</pubDate></item><item><link>http://example.org/old</link><title>Old</title><pubDate>Tue, 13 Oct 2020 00:00:00 GMT</pubDate></item></channel></rss>'
        source = {'type': 'rss', 'url': 'https://example.org/feed', 'upgrade_http': True, 'enrich_missing_summary': True}
        with patch.object(w, 'fetch', side_effect=[raw, b'<meta property="og:description" content="GRPO training &amp; results">']) as fetch:
            records = w.source_records(source, None, datetime(2026, 10, 10, tzinfo=timezone.utc), datetime(2026, 10, 15, tzinfo=timezone.utc), {})
        self.assertEqual(fetch.call_count, 2)
        self.assertEqual(records[0]['url'], 'https://example.org/new')
        self.assertEqual(records[0]['summary'], 'GRPO training & results')
        self.assertEqual(records[0]['reading_scope'], 'page-description')
        self.assertEqual(records[1]['summary'], '')

    def test_all_invalid_records_mark_source_failed(self):
        config = ExpandedSourceTests().config()
        config['sources'] = config['sources'][:1]
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', return_value=[ExpandedSourceTests().record(url=None)]):
                with self.assertRaises(ValueError):
                    w.collect(config, date(2026, 10, 14), run)
            self.assertEqual(w.read_json(run / 'bundle.json')['source_status'][0]['status'], 'failed')

    def test_health_check_reports_optional_failure_without_writing_run(self):
        config = ExpandedSourceTests().config()
        with patch.object(w, 'source_records', side_effect=[[], OSError('offline')]), patch('builtins.print'):
            with self.assertRaises(ValueError):
                w.source_check(config, date(2026, 10, 14))


class InstructionRetrievalTests(unittest.TestCase):
    def config(self):
        return {'topic': 'RL', 'slug': 'rl', 'tags': ['RL'], 'lookback_days': 7, 'max_items': 3, 'max_per_source': 2,
                'keywords': ['reinforcement'], 'sources': [
                    {'id': 'paper', 'type': 'rss', 'url': 'https://example.org/feed', 'group': 'paper'},
                    {'id': 'notes', 'type': 'rss', 'url': 'https://example.org/notes', 'group': 'release', 'required': False}]}

    def item(self, suffix, summary, group='paper'):
        return {'url': 'https://example.org/' + suffix, 'title': 'RL study', 'summary': summary,
                'published_at': '2026-10-13T00:00:00Z', 'updated_at': '', 'reading_scope': 'feed-excerpt',
                'source_group': group}

    def plan(self, **kwargs):
        value = {'instruction': '说明优势估计，而不是项目发布', 'axes': [
            {'id': 'advantage', 'question': '优势如何估计', 'queries': ['advantage'], 'preferred_groups': ['systematic']},
            {'id': 'absent', 'question': '没有材料的轴', 'queries': ['zzznomatch']}]}
        value.update(kwargs)
        return value

    def test_canonical_anchor_survives_window_and_gap_stays_open(self):
        anchor = {'axis': 'advantage', 'url': 'https://arxiv.org/abs/2402.03300', 'title': 'DeepSeekMath',
                  'summary': 'group relative advantage', 'published_at': '2024-02-05T00:00:00Z',
                  'reading_scope': 'manual-excerpt'}
        paper = self.item('new', 'reinforcement learning paper')
        release = self.item('rel', 'reinforcement advantage release notes', 'release')
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            w.write_json(run / 'catalog', [{'slug': 'rl', 'date': '2026-10-01', 'window_end': '2026-10-02T00:00:00+08:00',
                                            'source_urls': ['https://arxiv.org/abs/2402.03300']}])
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', side_effect=lambda source, *args: [paper] if source['id'] == 'paper' else [release]):
                w.collect(self.config(), date(2026, 10, 14), run, plan=self.plan(anchors=[anchor]))
            bundle = w.read_json(run / 'bundle.json')
            covered = {row['id']: row for row in bundle['selection']['axis_coverage']}
            self.assertEqual(covered['advantage']['status'], 'covered')
            self.assertTrue(covered['advantage']['canonical'])
            self.assertTrue(covered['advantage']['preferred_hit'])
            self.assertEqual(covered['absent'], {'id': 'absent', 'status': 'gap', 'reason': 'no-match'})
            self.assertEqual(bundle['items'][0]['url'], 'https://arxiv.org/abs/2402.03300')
            self.assertIn('reinforcement', bundle['items'][1]['summary'])
            self.assertEqual(bundle['selection']['strategy'], 'instruction-axes+group-round-robin')
            self.assertFalse(bundle['source_status'][-1]['required'])
            article = {'bundle_sha256': w.digest(bundle), 'title': 'RL', 'description': 'RL', 'sections': [
                {'heading': h, 'paragraphs': [{'text': 'RL', 'source_ids': ['S1', 'S2', 'S3']}]} for h in ['判断', '局限']]}
            w.write_json(run / 'article.json', article)
            with patch.object(w, 'ROOT', run), patch.object(w, 'CATALOG', run / 'docs/research/catalog.json'):
                w.integrate(self.config(), run)
            page = (run / 'docs/research/2026-10-14-rl.md').read_text()
            self.assertIn('规范摘录', page)
            self.assertIn('无匹配材料', page)

    def test_axis_only_hits_do_not_fill_the_news_pool(self):
        rows = [self.item('base', 'advantage baseline only'), self.item('other', 'advantage without the standing keyword'),
                self.item('news', 'reinforcement learning update')]
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory)
            with patch.object(w, 'CATALOG', run / 'catalog'), patch.object(w, 'source_records', return_value=rows):
                w.collect(self.config(), date(2026, 10, 14), run, plan=self.plan())
            bundle = w.read_json(run / 'bundle.json')
            summaries = [item['summary'] for item in bundle['items']]
            self.assertEqual(sum('advantage' in text and 'reinforcement' not in text for text in summaries), 1)
            self.assertTrue(any('reinforcement' in text for text in summaries))
            self.assertLessEqual(len(bundle['items']), 3)

    def test_plan_rejects_undated_or_unscoped_anchors(self):
        with self.assertRaises(ValueError):
            w.normalize_retrieval_plan(self.plan(anchors=[{'axis': 'advantage', 'url': 'https://example.org/a', 'title': 'A', 'summary': 'advantage'}]))
        with self.assertRaises(ValueError):
            w.normalize_retrieval_plan({'instruction': 'x', 'axes': [{'id': 'Bad', 'question': 'q', 'queries': ['a']}]})


if __name__ == '__main__':
    unittest.main()
