#!/usr/bin/env python3
"""Offline unit tests for scripts/research-fetch.py."""
import gzip
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('research_fetch', ROOT / 'scripts/research-fetch.py')
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class ResearchFetchTests(unittest.TestCase):
    def test_parse_arxiv_id_variants(self):
        cases = [
            ('2503.09516', ('2503.09516', '2503.09516')),
            ('arXiv:2503.09516v5', ('2503.09516', '2503.09516v5')),
            ('https://arxiv.org/abs/2503.09516v5', ('2503.09516', '2503.09516v5')),
            ('https://arxiv.org/pdf/2503.09516v2.pdf', ('2503.09516', '2503.09516v2')),
            ('https://arxiv.org/html/2503.09516v1', ('2503.09516', '2503.09516v1')),
            ('https://huggingface.co/papers/2503.09516', ('2503.09516', '2503.09516')),
            ('10.48550/arXiv.2503.09516', ('2503.09516', '2503.09516')),
            ('https://example.com/blog', (None, None)),
        ]
        for raw, expected in cases:
            self.assertEqual(MOD.parse_arxiv_id(raw), expected, raw)

    def test_parse_doi(self):
        self.assertEqual(MOD.parse_doi('https://doi.org/10.18653/2026.emnlp-main.2440.'), '10.18653/2026.emnlp-main.2440')
        self.assertEqual(MOD.parse_doi('doi: 10.1145/12345.67890'), '10.1145/12345.67890')
        self.assertIsNone(MOD.parse_doi('not-a-doi'))

    def test_reconstruct_openalex_abstract(self):
        inv = {'Policy': [0], 'gradient': [1], 'reduces': [2], 'variance.': [3]}
        self.assertEqual(MOD.reconstruct_openalex_abstract(inv), 'Policy gradient reduces variance.')
        self.assertEqual(MOD.reconstruct_openalex_abstract(None), '')

    def test_merge_records_dedup_and_venue_upgrade(self):
        r1 = {
            'title': 'Search-R1: Training LLMs',
            'year': 2025,
            'published': '2025-03-12',
            'citations': None,
            'influential_citations': None,
            'authors': ['Bowen Jin'],
            'venue': 'arXiv',
            'arxiv_id': '2503.09516',
            'doi': None,
            'url': 'https://arxiv.org/abs/2503.09516',
            'pdf_url': 'https://arxiv.org/pdf/2503.09516.pdf',
            'abstract': 'Full abstract from arXiv.',
            'tldr': '',
            'sources': ['arxiv'],
        }
        r2 = {
            'title': 'Search-R1: Training LLMs',
            'year': 2025,
            'published': '',
            'citations': 42,
            'influential_citations': 7,
            'authors': ['Bowen Jin', 'Jiawei Han'],
            'venue': 'COLM 2025',
            'arxiv_id': '2503.09516',
            'doi': '10.1234/colm.2025',
            'url': 'https://doi.org/10.1234/colm.2025',
            'pdf_url': None,
            'abstract': 'Short.',
            'tldr': 'RL for search.',
            'sources': ['crossref'],
        }
        merged = MOD.merge_records([r1, r2])
        self.assertEqual(len(merged), 1)
        m = merged[0]
        self.assertEqual(m['sources'], ['arxiv', 'crossref'])
        self.assertEqual(m['venue'], 'COLM 2025')
        self.assertEqual(m['citations'], 42)
        self.assertEqual(m['abstract'], 'Full abstract from arXiv.')
        self.assertEqual(m['doi'], '10.1234/colm.2025')

    def test_structured_html_latexml_tables_and_spacing(self):
        sample = '''
        <article class="ltx_document">
          <h1>Paper Title</h1>
          <p>This process is often called <em>dreaming</em> in practice.</p>
          <h2>1 Method</h2>
          <table class="ltx_equationgroup ltx_eqn_table"><tr><td>x = y</td></tr></table>
          <figure class="ltx_table">
            <figcaption>Table 1: Main comparison.</figcaption>
            <table>
              <tr><th>Method</th><th>Score</th></tr>
              <tr><td>Baseline</td><td>60.0</td></tr>
              <tr><td>Ours</td><td>72.5</td></tr>
            </table>
          </figure>
        </article>
        '''
        reader = MOD.StructuredHTMLReader()
        reader.feed(sample)
        doc = reader.finalize()
        self.assertIn('called dreaming in practice', doc['sections'][0]['text'])
        # Equation table ignored; only real table kept with figcaption
        self.assertEqual(len(doc['tables']), 1)
        self.assertEqual(doc['tables'][0]['caption'], 'Table 1: Main comparison.')
        self.assertEqual(doc['tables'][0]['rows'][1], ['Baseline', '60.0'])

    def test_parse_latex_source_tar_with_input_and_tables(self):
        main_tex = r'''
        \documentclass{article}
        \title{Demo Paper}
        \begin{document}
        \section{Intro}
        Hello world. % hidden comment
        \input{sections/method}
        \end{document}
        '''
        method_tex = r'''
        \section{Method}
        We optimize $J(\theta)$ with 100\% precision.
        \begin{table}[h]
        \caption{Ablation results.}
        \begin{tabular}{cc}A & B \\ 1 & 2\end{tabular}
        \end{table}
        '''
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode='w:gz') as tf:
            for name, content in [('main.tex', main_tex), ('sections/method.tex', method_tex)]:
                data = content.encode('utf-8')
                ti = tarfile.TarInfo(name)
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
        parsed = MOD.parse_latex_source(buf.getvalue())
        self.assertEqual(parsed['title'], 'Demo Paper')
        titles = [s['title'] for s in parsed['sections']]
        self.assertEqual(titles, ['Intro', 'Method'])
        self.assertNotIn('hidden comment', parsed['sections'][0]['text'])
        self.assertIn(r'100\% precision', parsed['sections'][1]['text'])
        self.assertEqual(len(parsed['tables']), 1)
        self.assertEqual(parsed['tables'][0]['caption'], 'Ablation results.')

    def test_parse_latex_single_gzipped_tex(self):
        tex = r'\begin{document}\section{Only}Body text.\end{document}'.encode('utf-8')
        parsed = MOD.parse_latex_source(gzip.compress(tex))
        self.assertEqual([s['title'] for s in parsed['sections']], ['Only'])


if __name__ == '__main__':
    unittest.main()
