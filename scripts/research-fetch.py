#!/usr/bin/env python3
"""Unified lightweight research retrieval CLI (Python 3.10+, stdlib only).

Subcommands:
  search      Parallel discovery across zero-key (HF, arXiv, Crossref, DBLP)
              and optional keyed (OpenAlex, Semantic Scholar) providers.
  citations   Fetch references & citations for an anchor paper (S2 -> OpenAlex -> Crossref).
  read-paper  Tiered full-text reader: arXiv HTML -> LaTeX source -> PDF -> Jina.
  read-web    Clean article/blog/docs reader: direct HTML -> optional Jina Reader fallback.
  extract-figures  Index, render, and 300-DPI crop original figures from arXiv/local PDFs (requires PyMuPDF).

Optional environment variables (never printed):
  OPENALEX_API_KEY, OPENALEX_EMAIL, S2_API_KEY, JINA_API_KEY
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import gzip
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / '.research' / 'cache' / 'fetch'
USER_AGENT = 'SeagullResearchFetch/0.2 (mailto:research@localhost)'
ATOM_NS = {'a': 'http://www.w3.org/2005/Atom'}


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            try:
                stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass


def clean_ws(text: str | None) -> str:
    return re.sub(r'\s+', ' ', html.unescape(str(text or ''))).strip()


def normalize_title(title: str) -> str:
    return re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '', (title or '').lower())


def parse_arxiv_id(raw: str) -> tuple[str | None, str | None]:
    """Return (base_id, versioned_id) or (None, None)."""
    s = (raw or '').strip()
    s = re.sub(r'^arxiv:\s*', '', s, flags=re.I)
    m = re.search(
        r'(?:arxiv\.org/(?:abs|pdf|html|e-print)/|huggingface\.co/papers/|10\.48550/arxiv\.)([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+/\d{7}(?:v\d+)?)',
        s,
        flags=re.I,
    )
    if m:
        vid = re.sub(r'\.pdf$', '', m.group(1), flags=re.I)
        return re.sub(r'v\d+$', '', vid), vid
    m2 = re.fullmatch(r'([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+/\d{7}(?:v\d+)?)', s, flags=re.I)
    if m2:
        vid = m2.group(1)
        return re.sub(r'v\d+$', '', vid), vid
    return None, None


def parse_doi(raw: str) -> str | None:
    s = (raw or '').strip()
    m = re.search(r'(?:doi\.org/|doi:\s*)(10\.\d{4,9}/[^\s?#]+)', s, flags=re.I)
    if m:
        return m.group(1).rstrip('.,;)')
    if re.fullmatch(r'10\.\d{4,9}/\S+', s):
        return s.rstrip('.,;)')
    return None


def safe_https_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url.strip())
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError(f'Invalid URL: {url}')
    return url.strip()


def http_get(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
    retries: int = 1,
    max_bytes: int = 15_000_000,
) -> tuple[bytes, dict[str, str]]:
    req_headers = {'User-Agent': USER_AGENT}
    if headers:
        req_headers.update(headers)
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ValueError(f'Response exceeded {max_bytes} bytes limit')
                resp_headers = {k.lower(): v for k, v in resp.headers.items()}
                return data, resp_headers
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                delay = 2 * (attempt + 1)
                retry_after = e.headers.get('Retry-After') if e.headers else None
                if retry_after and retry_after.isdigit():
                    delay = min(int(retry_after), 6)
                time.sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    assert last_err is not None
    raise last_err


def cache_path(namespace: str, key: str, suffix: str) -> Path:
    digest = hashlib.sha256(key.encode('utf-8')).hexdigest()[:16]
    safe = re.sub(r'[^a-zA-Z0-9._-]+', '_', key)[:48].strip('_') or 'item'
    p = CACHE_DIR / namespace / f'{safe}-{digest}{suffix}'
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------
# Discovery providers
# ---------------------------

def reconstruct_openalex_abstract(inv_index: dict | None) -> str:
    if not isinstance(inv_index, dict) or not inv_index:
        return ''
    positions: dict[int, str] = {}
    for word, idxs in inv_index.items():
        if isinstance(idxs, list):
            for i in idxs:
                positions[i] = word
    if not positions:
        return ''
    return clean_ws(' '.join(positions[i] for i in sorted(positions)))


def openalex_extract_record(w: dict) -> dict:
    doi = parse_doi(w.get('doi') or '')
    arxiv_id = parse_arxiv_id(doi or '')[0]
    pdf_url = None
    best_oa = w.get('best_oa_location') or {}
    if best_oa.get('pdf_url'):
        pdf_url = best_oa['pdf_url']
    for loc in w.get('locations') or []:
        for u in (loc.get('landing_page_url'), loc.get('pdf_url')):
            if u and 'arxiv.org' in u:
                base, _ = parse_arxiv_id(u)
                if base:
                    arxiv_id = base
        if not pdf_url and loc.get('pdf_url'):
            pdf_url = loc['pdf_url']
    for val in (w.get('ids') or {}).values():
        if isinstance(val, str) and 'arxiv' in val.lower():
            base, _ = parse_arxiv_id(val)
            if base:
                arxiv_id = base
    authors = [
        (a.get('author') or {}).get('display_name', '')
        for a in (w.get('authorships') or [])[:6]
        if (a.get('author') or {}).get('display_name')
    ]
    venue = ((w.get('primary_location') or {}).get('source') or {}).get('display_name') or ''
    url = f'https://arxiv.org/abs/{arxiv_id}' if arxiv_id else (f'https://doi.org/{doi}' if doi else (w.get('id') or ''))
    return {
        'title': clean_ws(w.get('display_name') or w.get('title')),
        'year': w.get('publication_year'),
        'published': w.get('publication_date') or '',
        'citations': w.get('cited_by_count'),
        'influential_citations': None,
        'authors': authors,
        'venue': clean_ws(venue),
        'arxiv_id': arxiv_id,
        'doi': doi,
        'url': url,
        'pdf_url': pdf_url or (f'https://arxiv.org/pdf/{arxiv_id}.pdf' if arxiv_id else None),
        'abstract': reconstruct_openalex_abstract(w.get('abstract_inverted_index')),
        'tldr': '',
        'openalex_id': (w.get('id') or '').rsplit('/', 1)[-1] or None,
        'sources': ['openalex'],
    }


def search_openalex(query: str, limit: int, sort: str, since: int | None) -> tuple[list[dict], str]:
    params: dict[str, str | int] = {
        'search': query,
        'per-page': min(max(limit, 1), 25),
        'select': 'id,doi,ids,display_name,publication_year,publication_date,cited_by_count,authorships,primary_location,best_oa_location,locations,abstract_inverted_index',
    }
    if sort == 'citations':
        params['sort'] = 'cited_by_count:desc'
    elif sort == 'year':
        params['sort'] = 'publication_date:desc'
    if since:
        params['filter'] = f'from_publication_date:{since}-01-01'
    api_key = os.environ.get('OPENALEX_API_KEY', '').strip()
    if api_key:
        params['api_key'] = api_key
    email = os.environ.get('OPENALEX_EMAIL', '').strip()
    if email:
        params['mailto'] = email
    url = 'https://api.openalex.org/works?' + urllib.parse.urlencode(params)
    try:
        raw, _ = http_get(url, headers={'Accept': 'application/json'}, retries=1 if api_key else 0)
    except urllib.error.HTTPError as e:
        if e.code == 429 and not api_key:
            raise RuntimeError('429 rate-limited (set OPENALEX_API_KEY for free daily quota)') from e
        raise
    payload = json.loads(raw)
    items = [openalex_extract_record(w) for w in payload.get('results') or []]
    return items, f'ok ({len(items)})'


def s2_extract_record(p: dict) -> dict:
    ext = p.get('externalIds') or {}
    arxiv_raw = ext.get('ArXiv')
    arxiv_id = parse_arxiv_id(arxiv_raw)[0] if arxiv_raw else None
    doi = parse_doi(ext.get('DOI') or '')
    oa = p.get('openAccessPdf') or {}
    pdf_url = oa.get('url') or (f'https://arxiv.org/pdf/{arxiv_id}.pdf' if arxiv_id else None)
    url = f'https://arxiv.org/abs/{arxiv_id}' if arxiv_id else (p.get('url') or (f'https://doi.org/{doi}' if doi else ''))
    tldr = (p.get('tldr') or {}).get('text') or ''
    return {
        'title': clean_ws(p.get('title')),
        'year': p.get('year'),
        'published': p.get('publicationDate') or '',
        'citations': p.get('citationCount'),
        'influential_citations': p.get('influentialCitationCount'),
        'authors': [a.get('name', '') for a in (p.get('authors') or [])[:6] if a.get('name')],
        'venue': clean_ws(p.get('venue')),
        'arxiv_id': arxiv_id,
        'doi': doi,
        'url': url,
        'pdf_url': pdf_url,
        'abstract': clean_ws(p.get('abstract')),
        'tldr': clean_ws(tldr),
        's2_id': p.get('paperId'),
        'sources': ['s2'],
    }


def search_s2(query: str, limit: int, since: int | None) -> tuple[list[dict], str]:
    params: dict[str, str | int] = {
        'query': query,
        'limit': min(max(limit, 1), 25),
        'fields': 'paperId,title,year,publicationDate,citationCount,influentialCitationCount,authors,venue,externalIds,openAccessPdf,url,abstract,tldr',
    }
    if since:
        params['year'] = f'{since}-'
    headers = {'Accept': 'application/json'}
    api_key = os.environ.get('S2_API_KEY', '').strip()
    if api_key:
        headers['x-api-key'] = api_key
    url = 'https://api.semanticscholar.org/graph/v1/paper/search?' + urllib.parse.urlencode(params)
    try:
        raw, _ = http_get(url, headers=headers, retries=1 if api_key else 0)
    except urllib.error.HTTPError as e:
        if e.code == 429 and not api_key:
            raise RuntimeError('429 rate-limited (set S2_API_KEY for dedicated free quota)') from e
        raise
    payload = json.loads(raw)
    items = [s2_extract_record(p) for p in payload.get('data') or [] if p.get('title')]
    return items, f'ok ({len(items)})'


def search_arxiv(query: str, limit: int, sort: str, since: int | None) -> tuple[list[dict], str]:
    q = query.strip()
    if not re.search(r'\b(?:all|ti|abs|au|cat):', q):
        terms = [t for t in re.findall(r'"[^"]+"|\S+', q) if t]
        q = ' AND '.join(f'all:{t}' for t in terms) if terms else f'all:{q}'
    sort_by = 'submittedDate' if sort == 'year' else 'relevance'
    params = urllib.parse.urlencode({
        'search_query': q,
        'start': 0,
        'max_results': min(max(limit, 1), 25),
        'sortBy': sort_by,
        'sortOrder': 'descending',
    })
    raw, _ = http_get('https://export.arxiv.org/api/query?' + params, headers={'Accept': 'application/atom+xml'})
    root = ET.fromstring(raw)
    items: list[dict] = []
    for entry in root.findall('a:entry', ATOM_NS):
        entry_id = entry.findtext('a:id', '', ATOM_NS)
        if '/api/errors' in entry_id:
            raise ValueError('arXiv query error: ' + clean_ws(entry.findtext('a:summary', '', ATOM_NS)))
        base_id, vid = parse_arxiv_id(entry_id)
        published = (entry.findtext('a:published', '', ATOM_NS) or '')[:10]
        year = int(published[:4]) if published[:4].isdigit() else None
        if since and year and year < since:
            continue
        items.append({
            'title': clean_ws(entry.findtext('a:title', '', ATOM_NS)),
            'year': year,
            'published': published,
            'citations': None,
            'influential_citations': None,
            'authors': [clean_ws(a.findtext('a:name', '', ATOM_NS)) for a in entry.findall('a:author', ATOM_NS)[:6]],
            'venue': 'arXiv',
            'arxiv_id': base_id,
            'doi': None,
            'url': f'https://arxiv.org/abs/{vid or base_id}' if base_id else entry_id,
            'pdf_url': f'https://arxiv.org/pdf/{vid or base_id}.pdf' if base_id else None,
            'abstract': clean_ws(entry.findtext('a:summary', '', ATOM_NS)),
            'tldr': '',
            'sources': ['arxiv'],
        })
    return items, f'ok ({len(items)})'


def search_hf_papers(query: str, limit: int, since: int | None) -> tuple[list[dict], str]:
    url = 'https://huggingface.co/api/papers/search?' + urllib.parse.urlencode({'q': query})
    raw, _ = http_get(url, headers={'Accept': 'application/json'})
    data = json.loads(raw)
    items: list[dict] = []
    for entry in (data if isinstance(data, list) else []):
        paper = entry.get('paper', entry)
        pid = paper.get('id')
        if not pid:
            continue
        base_id, _ = parse_arxiv_id(pid)
        published = (paper.get('publishedAt') or '')[:10]
        year = int(published[:4]) if published[:4].isdigit() else None
        if since and year and year < since:
            continue
        items.append({
            'title': clean_ws(paper.get('title')),
            'year': year,
            'published': published,
            'citations': None,
            'influential_citations': None,
            'upvotes': paper.get('upvotes'),
            'authors': [clean_ws(a.get('name')) for a in (paper.get('authors') or [])[:6] if a.get('name')],
            'venue': 'HF Papers',
            'arxiv_id': base_id or pid,
            'doi': None,
            'url': f'https://arxiv.org/abs/{base_id or pid}',
            'pdf_url': f'https://arxiv.org/pdf/{base_id or pid}.pdf',
            'abstract': clean_ws(paper.get('summary')),
            'tldr': '',
            'sources': ['hf'],
        })
        if len(items) >= limit:
            break
    return items, f'ok ({len(items)})'


def crossref_extract_record(entry: dict) -> dict:
    doi = parse_doi(entry.get('DOI') or '')
    arxiv_id = parse_arxiv_id(doi or '')[0]
    parts = (entry.get('published') or entry.get('issued') or {}).get('date-parts', [[]])[0]
    year = parts[0] if parts and isinstance(parts[0], int) else None
    published = '-'.join(str(n) if i == 0 else f'{n:02}' for i, n in enumerate(parts) if isinstance(n, int))
    abstract = clean_ws(re.sub(r'<[^>]+>', ' ', entry.get('abstract') or ''))
    authors = [
        clean_ws(' '.join(filter(None, [a.get('given'), a.get('family')])))
        for a in (entry.get('author') or [])[:6]
    ]
    authors = [a for a in authors if a]
    venue = clean_ws(' '.join(entry.get('container-title') or []))
    url = f'https://arxiv.org/abs/{arxiv_id}' if arxiv_id else (f'https://doi.org/{doi}' if doi else (entry.get('URL') or ''))
    return {
        'title': clean_ws(' '.join(entry.get('title') or [])),
        'year': year,
        'published': published,
        'citations': entry.get('is-referenced-by-count'),
        'influential_citations': None,
        'authors': authors,
        'venue': venue or ('arXiv' if arxiv_id else ''),
        'arxiv_id': arxiv_id,
        'doi': doi,
        'url': url,
        'pdf_url': f'https://arxiv.org/pdf/{arxiv_id}.pdf' if arxiv_id else None,
        'abstract': abstract,
        'tldr': '',
        'sources': ['crossref'],
    }


def search_crossref(query: str, limit: int, sort: str, since: int | None) -> tuple[list[dict], str]:
    params: dict[str, str | int] = {'query': query, 'rows': min(max(limit, 1), 25)}
    if sort == 'citations':
        params['sort'] = 'is-referenced-by-count'
        params['order'] = 'desc'
    elif sort == 'year':
        params['sort'] = 'published'
        params['order'] = 'desc'
    if since:
        params['filter'] = f'from-pub-date:{since}-01-01'
    url = 'https://api.crossref.org/works?' + urllib.parse.urlencode(params)
    raw, _ = http_get(url, headers={'Accept': 'application/json'})
    payload = json.loads(raw)
    entries = payload.get('message', {}).get('items') or []
    items = [crossref_extract_record(e) for e in entries if e.get('title')]
    return items, f'ok ({len(items)})'


def search_dblp(query: str, limit: int, since: int | None) -> tuple[list[dict], str]:
    params = urllib.parse.urlencode({'q': query, 'h': min(max(limit, 1), 25), 'format': 'json'})
    raw, _ = http_get('https://dblp.org/search/publ/api?' + params, headers={'Accept': 'application/json'})
    if not raw.strip():
        raise ValueError('empty response from DBLP')
    hits = (json.loads(raw).get('result', {}).get('hits', {}).get('hit') or [])
    items: list[dict] = []
    for h in hits:
        info = h.get('info') or {}
        year_s = str(info.get('year') or '')
        year = int(year_s) if year_s.isdigit() else None
        if since and year and year < since:
            continue
        ee = info.get('ee') or ''
        if isinstance(ee, list):
            ee = ee[0] if ee else ''
        doi = parse_doi(info.get('doi') or ee)
        arxiv_id = parse_arxiv_id(ee)[0] or parse_arxiv_id(doi or '')[0]
        raw_authors = (info.get('authors') or {}).get('author') or []
        if isinstance(raw_authors, dict):
            raw_authors = [raw_authors]
        authors = [clean_ws(a.get('text') if isinstance(a, dict) else str(a)) for a in raw_authors[:6]]
        url = f'https://arxiv.org/abs/{arxiv_id}' if arxiv_id else (f'https://doi.org/{doi}' if doi else (ee or info.get('url') or ''))
        items.append({
            'title': clean_ws(info.get('title', '')).rstrip('.'),
            'year': year,
            'published': str(year or ''),
            'citations': None,
            'influential_citations': None,
            'authors': [a for a in authors if a],
            'venue': clean_ws(info.get('venue') or ''),
            'arxiv_id': arxiv_id,
            'doi': doi,
            'url': url,
            'pdf_url': f'https://arxiv.org/pdf/{arxiv_id}.pdf' if arxiv_id else None,
            'abstract': '',
            'tldr': '',
            'sources': ['dblp'],
        })
    return items, f'ok ({len(items)})'


def merge_records(records: list[dict]) -> list[dict]:
    merged: list[dict] = []
    index_by_key: dict[str, int] = {}

    def record_keys(r: dict) -> list[str]:
        keys = []
        if r.get('arxiv_id'):
            keys.append('arxiv:' + r['arxiv_id'].lower())
        if r.get('doi'):
            keys.append('doi:' + r['doi'].lower())
        nt = normalize_title(r.get('title', ''))
        if nt:
            keys.append('title:' + nt)
        return keys

    for rec in records:
        if not rec.get('title'):
            continue
        keys = record_keys(rec)
        existing_idx = next((index_by_key[k] for k in keys if k in index_by_key), None)
        if existing_idx is None:
            idx = len(merged)
            merged.append(dict(rec))
            for k in keys:
                index_by_key[k] = idx
        else:
            cur = merged[existing_idx]
            cur['sources'] = sorted(set(cur.get('sources', [])) | set(rec.get('sources', [])))
            for field in ('arxiv_id', 'doi', 'pdf_url', 'published', 'tldr', 'openalex_id', 's2_id', 'upvotes'):
                if not cur.get(field) and rec.get(field):
                    cur[field] = rec[field]
            # Prefer real conference/journal venue over generic arXiv/HF Papers
            if rec.get('venue') and cur.get('venue') in ('', 'arXiv', 'HF Papers', 'CoRR'):
                cur['venue'] = rec['venue']
            if not cur.get('year') and rec.get('year'):
                cur['year'] = rec['year']
            if rec.get('citations') is not None:
                if cur.get('citations') is None or rec['citations'] > cur['citations']:
                    cur['citations'] = rec['citations']
            if rec.get('influential_citations') is not None:
                if cur.get('influential_citations') is None or rec['influential_citations'] > cur['influential_citations']:
                    cur['influential_citations'] = rec['influential_citations']
            if len(rec.get('abstract') or '') > len(cur.get('abstract') or ''):
                cur['abstract'] = rec['abstract']
            if len(rec.get('authors') or []) > len(cur.get('authors') or []):
                cur['authors'] = rec['authors']
            if rec.get('arxiv_id') and 'arxiv.org' not in (cur.get('url') or ''):
                cur['url'] = f"https://arxiv.org/abs/{rec['arxiv_id']}"
            for k in keys:
                index_by_key[k] = existing_idx
    return merged


# ---------------------------
# Citations traversal
# ---------------------------

def fetch_citations_s2(paper_ref: str, direction: str, limit: int) -> dict:
    base_arxiv, _ = parse_arxiv_id(paper_ref)
    doi = parse_doi(paper_ref)
    s2_key = f'ARXIV:{base_arxiv}' if base_arxiv else (f'DOI:{doi}' if doi else paper_ref.strip())
    headers = {'Accept': 'application/json'}
    api_key = os.environ.get('S2_API_KEY', '').strip()
    if api_key:
        headers['x-api-key'] = api_key
    retries = 1 if api_key else 0
    base_fields = 'paperId,title,year,citationCount,influentialCitationCount,venue,externalIds,authors,tldr,url'
    raw, _ = http_get(
        f'https://api.semanticscholar.org/graph/v1/paper/{urllib.parse.quote(s2_key, safe=":")}?fields={base_fields}',
        headers=headers,
        retries=retries,
    )
    paper = s2_extract_record(json.loads(raw))
    pid = paper['s2_id']
    sub_fields = 'title,year,citationCount,influentialCitationCount,venue,externalIds,authors,url'
    result = {'provider': 's2', 'paper': paper, 'references': [], 'citations': [], 'note': ''}
    if direction in ('refs', 'both'):
        r_raw, _ = http_get(
            f'https://api.semanticscholar.org/graph/v1/paper/{pid}/references?fields={sub_fields}&limit=100',
            headers=headers,
            retries=retries,
        )
        refs = [s2_extract_record(x.get('citedPaper') or {}) for x in json.loads(r_raw).get('data') or []]
        refs = [r for r in refs if r.get('title')]
        refs.sort(key=lambda r: (r.get('citations') or -1, r.get('year') or 0), reverse=True)
        result['references'] = refs[:limit]
    if direction in ('cites', 'both'):
        c_raw, _ = http_get(
            f'https://api.semanticscholar.org/graph/v1/paper/{pid}/citations?fields={sub_fields}&limit=100',
            headers=headers,
            retries=retries,
        )
        cites = [s2_extract_record(x.get('citingPaper') or {}) for x in json.loads(c_raw).get('data') or []]
        cites = [c for c in cites if c.get('title')]
        cites.sort(key=lambda r: (r.get('citations') or -1, r.get('year') or 0), reverse=True)
        result['citations'] = cites[:limit]
    return result


def fetch_citations_openalex(paper_ref: str, direction: str, limit: int) -> dict:
    base_arxiv, _ = parse_arxiv_id(paper_ref)
    doi = parse_doi(paper_ref)
    api_key = os.environ.get('OPENALEX_API_KEY', '').strip()
    retries = 1 if api_key else 0
    params_extra: dict[str, str] = {}
    if api_key:
        params_extra['api_key'] = api_key
    if os.environ.get('OPENALEX_EMAIL', '').strip():
        params_extra['mailto'] = os.environ['OPENALEX_EMAIL'].strip()

    target_doi = doi or (f'10.48550/arXiv.{base_arxiv}' if base_arxiv else None)
    if not target_doi:
        raise ValueError('OpenAlex citation lookup requires an arXiv ID or DOI')
    work_url = f'https://api.openalex.org/works/https://doi.org/{urllib.parse.quote(target_doi)}'
    if params_extra:
        work_url += '?' + urllib.parse.urlencode(params_extra)
    work = json.loads(http_get(work_url, headers={'Accept': 'application/json'}, retries=retries)[0])

    paper = openalex_extract_record(work)
    oa_id = paper['openalex_id']
    result = {'provider': 'openalex', 'paper': paper, 'references': [], 'citations': [], 'note': ''}
    select = 'id,doi,ids,display_name,publication_year,publication_date,cited_by_count,authorships,primary_location,best_oa_location,locations'

    if direction in ('refs', 'both'):
        ref_ids = [r.rsplit('/', 1)[-1] for r in (work.get('referenced_works') or [])[:50]]
        if ref_ids:
            q = dict(params_extra, filter='openalex_id:' + '|'.join(ref_ids), sort='cited_by_count:desc', select=select, **{'per-page': min(limit, 25)})
            raw = http_get('https://api.openalex.org/works?' + urllib.parse.urlencode(q), retries=retries)[0]
            result['references'] = [openalex_extract_record(w) for w in json.loads(raw).get('results') or []]
    if direction in ('cites', 'both') and oa_id:
        q = dict(params_extra, filter=f'cites:{oa_id}', sort='cited_by_count:desc', select=select, **{'per-page': min(limit, 25)})
        raw = http_get('https://api.openalex.org/works?' + urllib.parse.urlencode(q), retries=retries)[0]
        result['citations'] = [openalex_extract_record(w) for w in json.loads(raw).get('results') or []]
    return result


def fetch_citations_crossref(paper_ref: str, direction: str, limit: int) -> dict:
    """Zero-key fallback: citation count + reference list from Crossref (forward citations need S2/OpenAlex)."""
    base_arxiv, _ = parse_arxiv_id(paper_ref)
    doi = parse_doi(paper_ref)
    target_doi = doi or (f'10.48550/arXiv.{base_arxiv}' if base_arxiv else None)
    if not target_doi:
        raise ValueError('Crossref lookup requires an arXiv ID or DOI')
    raw, _ = http_get(f'https://api.crossref.org/works/{urllib.parse.quote(target_doi)}', headers={'Accept': 'application/json'})
    msg = json.loads(raw).get('message') or {}
    paper = crossref_extract_record(msg)
    refs: list[dict] = []
    if direction in ('refs', 'both'):
        for r in (msg.get('reference') or []):
            title = clean_ws(r.get('article-title') or r.get('volume-title') or r.get('unstructured') or '')
            r_doi = parse_doi(r.get('DOI') or '')
            r_arxiv = parse_arxiv_id(r_doi or title)[0]
            if not title and not r_doi:
                continue
            yr = r.get('year')
            refs.append({
                'title': title[:220] or f'DOI:{r_doi}',
                'year': int(yr) if str(yr or '').isdigit() else None,
                'citations': None,
                'arxiv_id': r_arxiv,
                'doi': r_doi,
                'url': f'https://arxiv.org/abs/{r_arxiv}' if r_arxiv else (f'https://doi.org/{r_doi}' if r_doi else ''),
            })
            if len(refs) >= limit:
                break
    note = ''
    if direction in ('cites', 'both'):
        note = 'Crossref provides total citation count and reference list only; set S2_API_KEY or OPENALEX_API_KEY for forward citing papers.'
    return {'provider': 'crossref', 'paper': paper, 'references': refs, 'citations': [], 'note': note}


def fetch_citations_arxiv_html(paper_ref: str, direction: str, limit: int) -> dict:
    """Zero-key fallback for arXiv papers: extract reference entries from arXiv HTML bibliography."""
    base_arxiv, vid = parse_arxiv_id(paper_ref)
    if not base_arxiv:
        raise ValueError('Not an arXiv ID')
    doc = read_arxiv_paper(paper_ref, source_pref='html', refresh=False)
    arxiv_id = vid or base_arxiv
    cp = cache_path('arxiv-html', arxiv_id, '.html')
    raw_html = cp.read_text(encoding='utf-8', errors='replace') if cp.is_file() else ''
    bib_items = re.findall(r'<li\b[^>]*class="[^"]*ltx_bibitem[^"]*"[^>]*>(.*?)</li>', raw_html, flags=re.I | re.S)
    entries = [clean_ws(re.sub(r'<[^>]+>', ' ', b)) for b in bib_items]
    if not entries:
        ref_sec = next((s for s in doc['sections'] if s['title'].strip().lower() in ('references', 'bibliography')), None)
        if ref_sec:
            entries = [b.strip() for b in ref_sec['text'].split('\n\n') if len(b.strip()) > 25]
    if not entries:
        raise ValueError('No References section found in arXiv HTML')
    refs: list[dict] = []
    for block in entries:
        yr_m = re.search(r'\b(19\d{2}|20\d{2})\b', block)
        arx_m = re.search(r'arXiv[:\s]*([0-9]{4}\.[0-9]{4,5})', block, flags=re.I)
        refs.append({
            'title': block[:240] + ('...' if len(block) > 240 else ''),
            'year': int(yr_m.group(1)) if yr_m else None,
            'citations': None,
            'arxiv_id': arx_m.group(1) if arx_m else None,
            'doi': None,
            'url': f'https://arxiv.org/abs/{arx_m.group(1)}' if arx_m else '',
        })
        if len(refs) >= limit:
            break
    paper = {
        'title': doc.get('title') or f'arXiv:{base_arxiv}',
        'year': None,
        'citations': None,
        'arxiv_id': base_arxiv,
        'doi': None,
        'url': f'https://arxiv.org/abs/{base_arxiv}',
    }
    note = 'Extracted bibliography from arXiv HTML (zero-key fallback). Set S2_API_KEY or OPENALEX_API_KEY for citation counts and forward citing papers.'
    return {'provider': 'arxiv-html-refs', 'paper': paper, 'references': refs if direction in ('refs', 'both') else [], 'citations': [], 'note': note}


# ---------------------------
# Tiered paper & web readers
# ---------------------------

class StructuredHTMLReader(HTMLParser):
    """Extract clean sections, real tables (incl. LaTeXML figure.ltx_table), and readable text."""

    SKIP_TAGS = {'script', 'style', 'noscript', 'template', 'nav', 'footer', 'svg'}

    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.in_title = False
        self.title_parts: list[str] = []
        self.in_heading: str | None = None
        self.heading_id: str = ''
        self.heading_parts: list[str] = []
        self.sections: list[dict] = [{'id': 'preamble', 'level': 1, 'title': 'Preamble / Abstract', 'parts': []}]
        # Figure / table tracking (handles both standard <table><caption> and LaTeXML <figure class="ltx_table">)
        self.in_table_figure = 0
        self.figure_caption_parts: list[str] = []
        self.in_figcaption = False
        self.in_table = 0
        self.ignore_table_depth = 0
        self.cur_table: dict | None = None
        self.in_caption = False
        self.in_cell = False
        self.cur_row: list[str] = []
        self.cur_cell: list[str] = []
        self.tables: list[dict] = []
        self.table_caption_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        cls = (attr.get('class') or '').lower()
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag == 'title':
            self.in_title = True
        elif tag == 'figure' and 'ltx_table' in cls:
            self.in_table_figure += 1
            if self.in_table_figure == 1:
                self.figure_caption_parts = []
        elif tag == 'figcaption' and self.in_table_figure == 1:
            self.in_figcaption = True
        elif tag in ('h1', 'h2', 'h3', 'h4') and not self.in_table:
            self.in_heading = tag
            self.heading_id = attr.get('id') or ''
            self.heading_parts = []
        elif tag == 'table':
            # Skip LaTeXML equation layout tables
            if self.ignore_table_depth or 'ltx_eqn_table' in cls or 'ltx_equationgroup' in cls:
                self.ignore_table_depth += 1
                return
            self.in_table += 1
            if self.in_table == 1:
                self.cur_table = {'caption': '', 'rows': []}
                self.table_caption_parts = []
        elif self.in_table == 1 and not self.ignore_table_depth:
            if tag == 'caption':
                self.in_caption = True
            elif tag == 'tr':
                self.cur_row = []
            elif tag in ('th', 'td'):
                self.in_cell = True
                self.cur_cell = []
        elif tag in ('p', 'div', 'li', 'br', 'pre', 'blockquote') and not self.in_table:
            self.sections[-1]['parts'].append('\n')

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        if tag == 'title':
            self.in_title = False
        elif tag == 'figcaption' and self.in_figcaption:
            self.in_figcaption = False
        elif tag == 'figure' and self.in_table_figure:
            if self.in_table_figure == 1:
                # Backfill caption if figcaption appeared after </table>
                fig_cap = clean_ws(''.join(self.figure_caption_parts))
                if fig_cap and self.tables and not self.tables[-1]['caption']:
                    self.tables[-1]['caption'] = fig_cap
                self.figure_caption_parts = []
            self.in_table_figure -= 1
        elif self.in_heading == tag:
            title = clean_ws(''.join(self.heading_parts))
            if title:
                self.sections.append({
                    'id': self.heading_id or f'sec-{len(self.sections)}',
                    'level': int(tag[1]),
                    'title': title,
                    'parts': [],
                })
            self.in_heading = None
        elif tag == 'table':
            if self.ignore_table_depth:
                self.ignore_table_depth -= 1
                return
            if self.in_table:
                if self.in_table == 1 and self.cur_table:
                    if not self.cur_table['caption'] and self.figure_caption_parts:
                        self.cur_table['caption'] = clean_ws(''.join(self.figure_caption_parts))
                    if self.cur_table['rows']:
                        self.tables.append(self.cur_table)
                    self.cur_table = None
                self.in_table -= 1
        elif self.in_table == 1 and not self.ignore_table_depth:
            if tag == 'caption':
                self.in_caption = False
                if self.cur_table is not None:
                    self.cur_table['caption'] = clean_ws(''.join(self.table_caption_parts))
            elif tag in ('th', 'td'):
                self.in_cell = False
                self.cur_row.append(clean_ws(''.join(self.cur_cell)))
            elif tag == 'tr':
                if self.cur_table is not None and any(self.cur_row):
                    self.cur_table['rows'].append(self.cur_row)
                self.cur_row = []
        elif tag in ('p', 'li', 'pre', 'blockquote') and not self.in_table:
            self.sections[-1]['parts'].append('\n')

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        if self.in_title:
            self.title_parts.append(data)
        if self.in_figcaption:
            self.figure_caption_parts.append(data)
            return
        if self.in_heading:
            self.heading_parts.append(data)
            return
        if self.in_table == 1 and not self.ignore_table_depth:
            if self.in_caption:
                self.table_caption_parts.append(data)
            elif self.in_cell:
                self.cur_cell.append(data)
            return
        if data.strip():
            self.sections[-1]['parts'].append(data)
        elif ' ' in data or '\t' in data:
            # Preserve inline spaces between adjacent tags (e.g. "called <em>dreaming</em>")
            parts = self.sections[-1]['parts']
            if parts and not parts[-1].endswith((' ', '\n')):
                parts.append(' ')

    def finalize(self) -> dict:
        out_sections = []
        for idx, s in enumerate(self.sections):
            raw_text = ''.join(s['parts'])
            lines = [clean_ws(line) for line in raw_text.splitlines()]
            text = '\n\n'.join(line for line in lines if line)
            if text or idx > 0:
                out_sections.append({
                    'index': len(out_sections),
                    'id': s['id'],
                    'level': s['level'],
                    'title': s['title'],
                    'chars': len(text),
                    'text': text,
                })
        return {
            'title': clean_ws(''.join(self.title_parts)),
            'sections': out_sections,
            'tables': self.tables,
        }


def format_md_table(table: dict, index: int) -> str:
    rows = table.get('rows') or []
    if not rows:
        return ''
    width = max(len(r) for r in rows)
    norm = [r + [''] * (width - len(r)) for r in rows]
    cap = table.get('caption') or f'Table {index}'
    lines = [f'### Table {index}: {cap}', '']
    lines.append('| ' + ' | '.join(c.replace('|', '\\|') for c in norm[0]) + ' |')
    lines.append('| ' + ' | '.join('---' for _ in norm[0]) + ' |')
    for row in norm[1:]:
        lines.append('| ' + ' | '.join(c.replace('|', '\\|') for c in row) + ' |')
    return '\n'.join(lines)


def strip_latex_comments(src: str) -> str:
    return '\n'.join(re.sub(r'(?<!\\)%.*$', '', line) for line in src.splitlines())


def parse_latex_source(raw_bytes: bytes) -> dict:
    """Unpack arXiv e-print (.tar.gz / .gz / plain .tex), expand \\input, extract sections & tables."""
    files: dict[str, str] = {}
    unpacked = False
    try:
        with tarfile.open(fileobj=io.BytesIO(raw_bytes), mode='r:*') as tf:
            for member in tf.getmembers():
                if member.isfile() and member.name.lower().endswith('.tex') and member.size < 5_000_000:
                    f = tf.extractfile(member)
                    if f:
                        key = Path(member.name).as_posix().lstrip('./')
                        files[key] = f.read().decode('utf-8', errors='replace')
            unpacked = bool(files)
    except tarfile.TarError:
        unpacked = False

    if not unpacked:
        try:
            text = gzip.decompress(raw_bytes).decode('utf-8', errors='replace')
        except OSError:
            text = raw_bytes.decode('utf-8', errors='replace')
        files['main.tex'] = text

    main_key = next((k for k, v in files.items() if '\\begin{document}' in v), None) or max(files, key=lambda k: len(files[k]))

    def expand(name: str, seen: set[str]) -> str:
        if name in seen or name not in files:
            return ''
        seen = seen | {name}
        base_dir = str(Path(name).parent)
        content = strip_latex_comments(files[name])

        def repl(m: re.Match) -> str:
            inc = m.group(1).strip()
            candidates = [inc, inc + '.tex']
            if base_dir not in ('', '.'):
                candidates = [f'{base_dir}/{c}' for c in candidates] + candidates
            for c in candidates:
                c_norm = Path(c).as_posix().lstrip('./')
                if c_norm in files:
                    return '\n' + expand(c_norm, seen) + '\n'
            return ''

        return re.sub(r'\\(?:input|include)\{([^}]+)\}', repl, content)

    full_tex = expand(main_key, set())
    title_m = re.search(r'\\title(?:\[[^\]]*\])?\{((?:[^{}]|\{[^{}]*\})*)\}', full_tex, flags=re.S)
    title = clean_ws(re.sub(r'\\[a-zA-Z]+\*?(?:\[[^\]]*\])?', ' ', title_m.group(1))) if title_m else ''

    tables: list[dict] = []
    for tm in re.finditer(r'\\begin\{(table\*?)\}(.*?)\\end\{\1\}', full_tex, flags=re.S):
        body = tm.group(2)
        cap_m = re.search(r'\\caption(?:\[[^\]]*\])?\{((?:[^{}]|\{[^{}]*\})*)\}', body, flags=re.S)
        cap = clean_ws(cap_m.group(1)) if cap_m else f'LaTeX Table {len(tables) + 1}'
        tables.append({'caption': cap, 'latex': body.strip()})

    doc_m = re.search(r'\\begin\{document\}(.*)\\end\{document\}', full_tex, flags=re.S)
    body_tex = doc_m.group(1) if doc_m else full_tex

    sec_pat = re.compile(r'\\(section|subsection|subsubsection)\*?\{((?:[^{}]|\{[^{}]*\})*)\}')
    matches = list(sec_pat.finditer(body_tex))
    sections: list[dict] = []

    def add_sec(level: int, sec_title: str, chunk: str) -> None:
        txt = chunk.strip()
        sections.append({
            'index': len(sections),
            'id': f'tex-sec-{len(sections)}',
            'level': level,
            'title': clean_ws(sec_title),
            'chars': len(txt),
            'text': txt,
        })

    if matches:
        preamble = body_tex[:matches[0].start()]
        if preamble.strip():
            add_sec(1, 'Abstract / Preamble', preamble)
        level_map = {'section': 2, 'subsection': 3, 'subsubsection': 4}
        for i, m in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(body_tex)
            add_sec(level_map[m.group(1)], m.group(2), body_tex[m.end():end])
    else:
        add_sec(1, 'Full TeX Body', body_tex)

    return {'title': title, 'sections': sections, 'tables': tables, 'main_file': main_key, 'tex_files': len(files)}


def extract_pdf_pages(pdf_path: Path) -> tuple[list[str], str]:
    """Return (pages_text, backend_name) using fitz -> pypdf -> pdftotext."""
    try:
        import fitz  # type: ignore
        doc = fitz.open(str(pdf_path))
        pages = [page.get_text('text') for page in doc]
        doc.close()
        return pages, 'pymupdf'
    except ImportError:
        pass
    try:
        import pypdf  # type: ignore
        reader = pypdf.PdfReader(str(pdf_path))
        pages = [p.extract_text() or '' for p in reader.pages]
        return pages, 'pypdf'
    except ImportError:
        pass
    pdftotext = shutil.which('pdftotext')
    if pdftotext:
        out = subprocess.check_output([pdftotext, '-layout', str(pdf_path), '-'], timeout=60)
        pages = out.decode('utf-8', errors='replace').split('\f')
        if pages and not pages[-1].strip():
            pages = pages[:-1]
        return pages, 'pdftotext'
    raise RuntimeError('No PDF backend available (install pymupdf/pypdf or pdftotext)')


def fetch_via_jina(url: str, *, refresh: bool = False) -> str:
    safe_https_url(url)
    cp = cache_path('jina', url, '.md')
    if cp.is_file() and not refresh:
        return cp.read_text(encoding='utf-8')
    headers = {'Accept': 'text/markdown'}
    api_key = os.environ.get('JINA_API_KEY', '').strip()
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    try:
        raw, _ = http_get('https://r.jina.ai/' + url, headers=headers, timeout=35, retries=1 if api_key else 0)
    except urllib.error.HTTPError as e:
        if e.code == 401 and not api_key:
            raise RuntimeError('401 Unauthorized (set JINA_API_KEY to enable Jina Reader fallback)') from e
        raise
    text = raw.decode('utf-8', errors='replace').strip()
    if len(text) < 100:
        raise ValueError('Jina Reader returned too little text')
    cp.write_text(text, encoding='utf-8')
    return text


def read_arxiv_paper(target: str, source_pref: str, refresh: bool) -> dict:
    base_id, vid = parse_arxiv_id(target)
    if not base_id:
        raise ValueError(f'Not an arXiv ID or URL: {target}')
    arxiv_id = vid or base_id
    attempts: list[str] = []

    if source_pref != 'auto':
        order = [source_pref]
    else:
        order = ['html', 'latex', 'pdf']
        if os.environ.get('JINA_API_KEY', '').strip():
            order.append('jina')

    for src in order:
        if src == 'html':
            url = f'https://arxiv.org/html/{arxiv_id}'
            cp = cache_path('arxiv-html', arxiv_id, '.html')
            try:
                if cp.is_file() and not refresh:
                    raw = cp.read_bytes()
                else:
                    raw, _ = http_get(url, headers={'Accept': 'text/html'}, retries=1)
                    cp.write_bytes(raw)
                text = raw.decode('utf-8', errors='replace')
                if 'No HTML for' in text or len(text) < 1500:
                    raise ValueError('arXiv HTML unavailable or empty')
                # Scope to LaTeXML article body to strip arXiv toolbar chrome
                doc_title_m = re.search(r'<title[^>]*>(.*?)</title>', text, flags=re.I | re.S)
                article_m = re.search(r'<article\b[^>]*class="[^"]*ltx_document[^"]*"[^>]*>(.*)</article>', text, flags=re.I | re.S)
                parser = StructuredHTMLReader()
                parser.feed(article_m.group(0) if article_m else text)
                parsed = parser.finalize()
                if not parsed['title'] and doc_title_m:
                    parsed['title'] = clean_ws(doc_title_m.group(1))
                if len(parsed['sections']) <= 1 and sum(s['chars'] for s in parsed['sections']) < 1000:
                    raise ValueError('arXiv HTML parsed with insufficient text')
                return {
                    'arxiv_id': arxiv_id,
                    'source_used': 'arxiv-html',
                    'source_url': url,
                    'attempts': attempts + ['html:ok'],
                    **parsed,
                }
            except Exception as e:
                attempts.append(f'html:failed ({e})')

        elif src == 'latex':
            url = f'https://arxiv.org/e-print/{arxiv_id}'
            cp = cache_path('arxiv-latex', arxiv_id, '.bin')
            try:
                if cp.is_file() and not refresh:
                    raw = cp.read_bytes()
                else:
                    raw, _ = http_get(url, max_bytes=40_000_000, retries=1)
                    cp.write_bytes(raw)
                if raw.startswith(b'%PDF'):
                    raise ValueError('e-print returned PDF-only submission (no LaTeX source)')
                parsed = parse_latex_source(raw)
                return {
                    'arxiv_id': arxiv_id,
                    'source_used': 'arxiv-latex',
                    'source_url': url,
                    'attempts': attempts + ['latex:ok'],
                    **parsed,
                }
            except Exception as e:
                attempts.append(f'latex:failed ({e})')

        elif src == 'pdf':
            url = f'https://arxiv.org/pdf/{arxiv_id}.pdf'
            cp = cache_path('arxiv-pdf', arxiv_id, '.pdf')
            try:
                if not cp.is_file() or refresh:
                    raw, _ = http_get(url, max_bytes=50_000_000, retries=1)
                    if not raw.startswith(b'%PDF'):
                        raise ValueError('Response is not a valid PDF')
                    cp.write_bytes(raw)
                pages, backend = extract_pdf_pages(cp)
                sections = [
                    {
                        'index': i + 1,
                        'id': f'page-{i + 1}',
                        'level': 2,
                        'title': f'Page {i + 1}',
                        'chars': len(p),
                        'text': p.strip(),
                    }
                    for i, p in enumerate(pages)
                ]
                return {
                    'arxiv_id': arxiv_id,
                    'source_used': f'arxiv-pdf ({backend})',
                    'source_url': url,
                    'pdf_cache': str(cp),
                    'page_count': len(pages),
                    'attempts': attempts + [f'pdf:ok ({backend}, {len(pages)} pages)'],
                    'title': f'arXiv:{arxiv_id}',
                    'sections': sections,
                    'tables': [],
                }
            except Exception as e:
                attempts.append(f'pdf:failed ({e})')

        elif src == 'jina':
            target_url = f'https://arxiv.org/pdf/{arxiv_id}.pdf'
            try:
                md = fetch_via_jina(target_url, refresh=refresh)
                return {
                    'arxiv_id': arxiv_id,
                    'source_used': 'jina-reader',
                    'source_url': target_url,
                    'attempts': attempts + ['jina:ok'],
                    'title': f'arXiv:{arxiv_id}',
                    'sections': [{'index': 0, 'id': 'jina-full', 'level': 1, 'title': 'Jina Markdown', 'chars': len(md), 'text': md}],
                    'tables': [],
                }
            except Exception as e:
                attempts.append(f'jina:failed ({e})')

    raise RuntimeError('All paper sources failed: ' + '; '.join(attempts))


def read_web_page(url: str, via: str, refresh: bool) -> dict:
    url = safe_https_url(url)
    attempts: list[str] = []
    if via in ('auto', 'direct'):
        cp = cache_path('web-direct', url, '.html')
        try:
            if cp.is_file() and not refresh:
                raw = cp.read_bytes()
            else:
                raw, hdrs = http_get(
                    url,
                    headers={'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9'},
                    retries=1,
                )
                if raw.startswith(b'%PDF') or 'pdf' in hdrs.get('content-type', ''):
                    raise ValueError('URL is PDF; download locally or pass --via jina with JINA_API_KEY')
                cp.write_bytes(raw)
            html_text = raw.decode('utf-8', errors='replace')
            focus_m = re.search(r'<(article|main)\b[^>]*>(.*)</\1>', html_text, flags=re.I | re.S)
            parser = StructuredHTMLReader()
            parser.feed(focus_m.group(0) if focus_m else html_text)
            parsed = parser.finalize()
            total_chars = sum(s['chars'] for s in parsed['sections'])
            if total_chars < 300 and via == 'auto':
                raise ValueError(f'Direct HTML text too short ({total_chars} chars; likely JS-rendered)')
            if not parsed['title']:
                tm = re.search(r'<title[^>]*>(.*?)</title>', html_text, flags=re.I | re.S)
                if tm:
                    parsed['title'] = clean_ws(tm.group(1))
            return {
                'url': url,
                'source_used': 'direct-html',
                'attempts': attempts + ['direct:ok'],
                **parsed,
            }
        except Exception as e:
            attempts.append(f'direct:failed ({e})')
            if via == 'direct':
                raise

    if via == 'jina' or (via == 'auto' and os.environ.get('JINA_API_KEY', '').strip()):
        try:
            md = fetch_via_jina(url, refresh=refresh)
            return {
                'url': url,
                'source_used': 'jina-reader',
                'attempts': attempts + ['jina:ok'],
                'title': url,
                'sections': [{'index': 0, 'id': 'body', 'level': 1, 'title': 'Extracted Markdown', 'chars': len(md), 'text': md}],
                'tables': [],
            }
        except Exception as e:
            attempts.append(f'jina:failed ({e})')
    elif via == 'auto':
        attempts.append('jina:skipped (JINA_API_KEY not set)')

    raise RuntimeError('Web fetch failed: ' + '; '.join(attempts))


# ---------------------------
# Formatting & CLI commands
# ---------------------------

def resolve_default_sources(spec: str) -> list[str]:
    if spec.strip().lower() != 'auto':
        return [s.strip().lower() for s in spec.split(',') if s.strip()]
    sources = ['hf', 'arxiv', 'crossref', 'dblp']
    if os.environ.get('OPENALEX_API_KEY', '').strip():
        sources.insert(0, 'openalex')
    if os.environ.get('S2_API_KEY', '').strip():
        sources.insert(0, 's2')
    return sources


def cmd_search(args: argparse.Namespace) -> int:
    sources = resolve_default_sources(args.sources)
    all_records: list[dict] = []
    status: dict[str, str] = {}
    t0 = time.monotonic()

    def run_provider(src: str) -> tuple[str, list[dict], str]:
        st = time.monotonic()
        try:
            if src == 'openalex':
                recs, msg = search_openalex(args.query, args.limit, args.sort, args.since)
            elif src == 's2':
                recs, msg = search_s2(args.query, args.limit, args.since)
            elif src == 'arxiv':
                recs, msg = search_arxiv(args.query, args.limit, args.sort, args.since)
            elif src == 'hf':
                recs, msg = search_hf_papers(args.query, args.limit, args.since)
            elif src == 'crossref':
                recs, msg = search_crossref(args.query, args.limit, args.sort, args.since)
            elif src == 'dblp':
                recs, msg = search_dblp(args.query, args.limit, args.since)
            else:
                return src, [], 'unknown provider'
            return src, recs, f'{msg} in {time.monotonic() - st:.2f}s'
        except Exception as e:
            return src, [], f'failed ({e})'

    with ThreadPoolExecutor(max_workers=min(len(sources), 6) or 1) as pool:
        futs = [pool.submit(run_provider, s) for s in sources]
        for fut in as_completed(futs):
            src, recs, msg = fut.result()
            status[src] = msg
            all_records.extend(recs)

    merged = merge_records(all_records)
    if args.sort == 'citations':
        merged.sort(key=lambda r: (r.get('citations') if r.get('citations') is not None else -1, r.get('year') or 0), reverse=True)
    elif args.sort == 'year':
        merged.sort(key=lambda r: (r.get('published') or str(r.get('year') or ''), r.get('citations') or -1), reverse=True)
    else:
        merged.sort(
            key=lambda r: (
                len(r.get('sources', [])),
                1 if r.get('arxiv_id') else 0,
                r.get('citations') or 0,
                r.get('year') or 0,
            ),
            reverse=True,
        )

    results = merged[:args.limit]
    elapsed = time.monotonic() - t0
    ordered_status = {s: status.get(s, 'skipped') for s in sources}

    if args.format == 'json':
        print(json.dumps({'query': args.query, 'elapsed_s': round(elapsed, 2), 'source_status': ordered_status, 'results': results}, ensure_ascii=False, indent=2))
        return 0 if results else 1

    print(f'# Paper Search: {args.query}')
    print(f'- Elapsed: {elapsed:.2f}s | Unique results: {len(results)}')
    print('- Sources: ' + ' ; '.join(f'{k}={v}' for k, v in ordered_status.items()))
    print()
    for i, r in enumerate(results, 1):
        cite_str = f"cites={r['citations']}" if r.get('citations') is not None else 'cites=?'
        if r.get('influential_citations'):
            cite_str += f" (influential={r['influential_citations']})"
        ids = []
        if r.get('arxiv_id'):
            ids.append(f"arXiv:{r['arxiv_id']}")
        if r.get('doi'):
            ids.append(f"DOI:{r['doi']}")
        id_part = ' | '.join(ids) if ids else r.get('url', '')
        print(f"{i}. **{r['title']}** ({r.get('year') or '?'}, {cite_str}, via={','.join(r['sources'])})")
        print(f"   - IDs: {id_part} | Venue: {r.get('venue') or '-'}")
        if r.get('authors'):
            print(f"   - Authors: {', '.join(r['authors'])}")
        if r.get('tldr'):
            print(f"   - TLDR: {r['tldr']}")
        elif r.get('abstract'):
            snippet = r['abstract'][:300] + ('...' if len(r['abstract']) > 300 else '')
            print(f"   - Abstract: {snippet}")
    return 0 if results else 1


def cmd_citations(args: argparse.Namespace) -> int:
    errors = []
    data = None
    if args.provider != 'auto':
        order = [args.provider]
    else:
        order = []
        if os.environ.get('S2_API_KEY', '').strip():
            order.append('s2')
        if os.environ.get('OPENALEX_API_KEY', '').strip():
            order.append('openalex')
        # Zero-key fallback chain
        for p in ('crossref', 's2', 'openalex', 'arxiv-refs'):
            if p not in order:
                order.append(p)

    for prov in order:
        try:
            if prov == 's2':
                data = fetch_citations_s2(args.paper, args.direction, args.limit)
            elif prov == 'openalex':
                data = fetch_citations_openalex(args.paper, args.direction, args.limit)
            elif prov == 'crossref':
                data = fetch_citations_crossref(args.paper, args.direction, args.limit)
            else:
                data = fetch_citations_arxiv_html(args.paper, args.direction, args.limit)
            break
        except Exception as e:
            errors.append(f'{prov}: {e}')
    if not data:
        print('Citation lookup failed: ' + ' ; '.join(errors), file=sys.stderr)
        return 1

    if args.format == 'json':
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    p = data['paper']
    print(f"# Anchor Paper ({data['provider']}): {p['title']}")
    print(f"- Year: {p.get('year') or '?'} | Citations: {p.get('citations')} | arXiv: {p.get('arxiv_id') or '-'} | DOI: {p.get('doi') or '-'}")
    if data.get('note'):
        print(f"- Note: {data['note']}")
    if p.get('tldr'):
        print(f"- TLDR: {p['tldr']}")
    if data['references']:
        print(f"\n## Top References ({len(data['references'])})")
        for i, r in enumerate(data['references'], 1):
            c_txt = f", cites={r['citations']}" if r.get('citations') is not None else ''
            print(f"{i}. **{r['title']}** ({r.get('year') or '?'}{c_txt}) — {r.get('arxiv_id') or r.get('doi') or r.get('url')}")
    if data['citations']:
        print(f"\n## Top Citing Papers ({len(data['citations'])})")
        for i, c in enumerate(data['citations'], 1):
            c_txt = f", cites={c['citations']}" if c.get('citations') is not None else ''
            print(f"{i}. **{c['title']}** ({c.get('year') or '?'}{c_txt}) — {c.get('arxiv_id') or c.get('doi') or c.get('url')}")
    return 0


def cmd_read_paper(args: argparse.Namespace) -> int:
    base_id, _ = parse_arxiv_id(args.target)
    if base_id:
        doc = read_arxiv_paper(args.target, args.source, args.refresh)
    else:
        doc = read_web_page(args.target, via='jina' if args.source == 'jina' else 'auto', refresh=args.refresh)

    if args.format == 'json' and not args.section and args.tables is None and not args.pages:
        summary = {k: v for k, v in doc.items() if k not in ('sections', 'tables')}
        summary['sections'] = [{k: v for k, v in s.items() if k != 'text'} for s in doc['sections']]
        summary['table_count'] = len(doc['tables'])
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    print(f"# {doc.get('title') or args.target}")
    print(f"- Source used: `{doc['source_used']}` | URL: {doc.get('source_url') or doc.get('url')}")
    print(f"- Attempts: {' -> '.join(doc['attempts'])}")

    if args.tables is not None:
        tables = doc.get('tables') or []
        if not tables:
            print('\nNo structured tables extracted from this source. Try `--source latex` or `--source pdf`.')
            return 0
        q = args.tables.strip().lower()
        shown = 0
        for idx, t in enumerate(tables, 1):
            cap = t.get('caption') or ''
            if q:
                if q.isdigit():
                    if idx != int(q):
                        continue
                elif q not in cap.lower():
                    continue
            shown += 1
            if 'latex' in t:
                print(f'\n### Table {idx}: {cap}\n```latex\n{t["latex"][:args.max_chars]}\n```')
            else:
                print('\n' + format_md_table(t, idx))
        if shown == 0:
            print(f'\nNo table matched "{args.tables}". Available tables: {len(tables)}.')
        return 0

    if args.pages:
        m = re.fullmatch(r'(\d+)(?:-(\d+))?', args.pages.strip())
        if not m:
            raise ValueError('--pages must be N or START-END (e.g. 1-3)')
        start_p = int(m.group(1))
        end_p = int(m.group(2) or start_p)
        picked = [s for s in doc['sections'] if s['id'].startswith('page-') and start_p <= s['index'] <= end_p]
        if not picked:
            print('\nPage slicing requires `--source pdf`.')
            return 1
        out = '\n\n'.join(f"## {s['title']}\n\n{s['text']}" for s in picked)
        print('\n' + out[:args.max_chars])
        return 0

    if args.section:
        q = args.section.strip().lower()
        matched = []
        for s in doc['sections']:
            if q.isdigit():
                if s['index'] == int(q):
                    matched.append(s)
            elif q in s['title'].lower() or q == s['id'].lower():
                matched.append(s)
        if not matched:
            print(f'\nNo section matched "{args.section}". Run without --section to view outline.')
            return 1
        remaining = args.max_chars
        for s in matched:
            header = f"\n## [{s['index']}] {s['title']} ({s['chars']} chars)\n\n"
            body = s['text'][:remaining]
            print(header + body)
            remaining -= len(body)
            if remaining <= 0:
                print('\n... [truncated by --max-chars]')
                break
        return 0

    # Default outline mode
    print(f"- Sections: {len(doc['sections'])} | Tables extracted: {len(doc.get('tables') or [])}")
    print('\n## Outline')
    for s in doc['sections']:
        indent = '  ' * max(0, s['level'] - 2)
        print(f"{indent}- [{s['index']}] {s['title']} ({s['chars']} chars)")
    if doc.get('tables'):
        print('\n## Tables')
        for idx, t in enumerate(doc['tables'], 1):
            cap = (t.get('caption') or '')[:140]
            print(f'- Table {idx}: {cap}')
    preview = next((s for s in doc['sections'] if s['chars'] > 120), None)
    if preview:
        print(f"\n## Preview: [{preview['index']}] {preview['title']}\n")
        print(preview['text'][:1500] + ('\n...' if len(preview['text']) > 1500 else ''))
    return 0


def cmd_read_web(args: argparse.Namespace) -> int:
    doc = read_web_page(args.url, via=args.via, refresh=args.refresh)
    print(f"# {doc.get('title') or args.url}")
    print(f"- Source used: `{doc['source_used']}` | URL: {doc['url']}")
    print(f"- Attempts: {' -> '.join(doc['attempts'])}")

    full = '\n\n'.join(
        (f"## {s['title']}\n\n{s['text']}" if s['index'] > 0 else s['text'])
        for s in doc['sections']
        if s['text']
    )
    print(f"- Total extracted chars: {len(full)} | Tables: {len(doc.get('tables') or [])}\n")

    if args.query:
        q = args.query.strip().lower()
        hits = [m.start() for m in re.finditer(re.escape(q), full.lower())]
        if not hits:
            print(f'No match for "{args.query}".')
            return 0
        print(f'Matched {len(hits)} occurrence(s); showing windows around first 5:')
        for pos in hits[:5]:
            lo = max(0, pos - 350)
            hi = min(len(full), pos + 650)
            print('\n---\n' + full[lo:hi])
        return 0

    print(full[:args.max_chars] + ('\n\n... [truncated by --max-chars]' if len(full) > args.max_chars else ''))
    return 0


def cmd_extract_figures(args: argparse.Namespace) -> int:
    try:
        import fitz  # type: ignore
    except ImportError:
        print('Error: PyMuPDF (fitz) is required for extract-figures. Install with: pip install pymupdf', file=sys.stderr)
        return 1

    target = args.target.strip()
    local_pdf = Path(target)
    if local_pdf.is_file():
        pdf_path = local_pdf
        label = local_pdf.stem
    else:
        base_id, vid = parse_arxiv_id(target)
        if not base_id:
            raise ValueError(f'Expected local PDF path or arXiv ID/URL, got: {target}')
        label = vid or base_id
        pdf_path = cache_path('pdf_figures', label, '.pdf')
        if args.refresh or not pdf_path.exists():
            data, _ = http_get(f'https://arxiv.org/pdf/{label}.pdf', timeout=60, max_bytes=60_000_000)
            pdf_path.write_bytes(data)

    doc = fitz.open(str(pdf_path))
    total_pages = len(doc)

    if args.list or (not args.pages and not args.crop):
        print(f'# Figures in {label} ({total_pages} pages, cached at {pdf_path})')
        found = 0
        for pno in range(min(total_pages, args.max_pages)):
            txt = doc[pno].get_text()
            for m in re.finditer(r'(Fig(?:ure)?\.?\s*\d+[:\.][^\n]+(?:\n[^\n]+){0,2})', txt):
                clean = ' '.join(m.group(1).split())
                print(f'- p.{pno + 1}: {clean[:200]}')
                found += 1
        if found == 0:
            print('(No "Figure N" captions matched in scanned pages.)')
        return 0

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.pages:
        for tok in args.pages.split(','):
            tok = tok.strip()
            if not tok:
                continue
            pno = int(tok)
            if not (1 <= pno <= total_pages):
                raise ValueError(f'Page {pno} out of range 1..{total_pages}')
            pix = doc[pno - 1].get_pixmap(dpi=args.dpi, alpha=False)
            dest = out_dir / f'{label}_p{pno}.png'
            pix.save(str(dest))
            print(f'Rendered page {pno}: {dest} ({pix.width}x{pix.height})')

    if args.crop:
        for spec in args.crop:
            parts = spec.split(':')
            if len(parts) != 3:
                raise ValueError(f'Invalid --crop spec "{spec}". Expected "PAGE:x0,y0,x1,y1:filename.png"')
            pno = int(parts[0])
            coords = [float(v) for v in parts[1].split(',')]
            if len(coords) != 4:
                raise ValueError(f'Invalid normalized box in "{spec}". Expected 4 floats x0,y0,x1,y1')
            fname = parts[2].strip()
            if not (1 <= pno <= total_pages):
                raise ValueError(f'Page {pno} out of range 1..{total_pages}')
            page = doc[pno - 1]
            r = page.rect
            clip = fitz.Rect(r.width * coords[0], r.height * coords[1], r.width * coords[2], r.height * coords[3])
            pix = page.get_pixmap(clip=clip, dpi=args.dpi, alpha=False)
            dest = out_dir / fname
            pix.save(str(dest))
            print(f'Cropped p.{pno} -> {dest} ({pix.width}x{pix.height}, {dest.stat().st_size} bytes)')
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description='Lightweight unified research retrieval CLI')
    sub = p.add_subparsers(dest='cmd', required=True)

    sp = sub.add_parser('search', help='Parallel paper search across zero-key & optional keyed providers')
    sp.add_argument('query', help='English keywords work best for academic indexes')
    sp.add_argument('--sources', default='auto', help='auto (hf,arxiv,crossref,dblp + keyed openalex/s2) or comma list')
    sp.add_argument('--limit', type=int, default=8)
    sp.add_argument('--sort', choices=('relevance', 'citations', 'year'), default='relevance')
    sp.add_argument('--since', type=int, help='Filter papers published on/after YYYY')
    sp.add_argument('--format', choices=('md', 'json'), default='md')
    sp.set_defaults(func=cmd_search)

    cp = sub.add_parser('citations', help='Traverse references & citations of an anchor paper')
    cp.add_argument('paper', help='arXiv ID/URL or DOI')
    cp.add_argument('--direction', choices=('refs', 'cites', 'both'), default='both')
    cp.add_argument('--limit', type=int, default=8)
    cp.add_argument('--provider', choices=('auto', 's2', 'openalex', 'crossref'), default='auto')
    cp.add_argument('--format', choices=('md', 'json'), default='md')
    cp.set_defaults(func=cmd_citations)

    rp = sub.add_parser('read-paper', help='Tiered paper reader: arXiv HTML -> LaTeX -> PDF -> Jina')
    rp.add_argument('target', help='arXiv ID/URL or web paper URL')
    rp.add_argument('--source', choices=('auto', 'html', 'latex', 'pdf', 'jina'), default='auto')
    rp.add_argument('--section', help='Section index or title substring to extract')
    rp.add_argument('--tables', nargs='?', const='', default=None, help='Extract tables (exact index or caption keyword)')
    rp.add_argument('--pages', help='Page range for --source pdf, e.g. 1-3')
    rp.add_argument('--max-chars', type=int, default=12000)
    rp.add_argument('--refresh', action='store_true')
    rp.add_argument('--format', choices=('md', 'json'), default='md')
    rp.set_defaults(func=cmd_read_paper)

    wp = sub.add_parser('read-web', help='Clean web/blog/docs reader with optional Jina fallback')
    wp.add_argument('url')
    wp.add_argument('--via', choices=('auto', 'direct', 'jina'), default='auto')
    wp.add_argument('--query', help='Extract windows matching substring')
    wp.add_argument('--max-chars', type=int, default=12000)
    wp.add_argument('--refresh', action='store_true')
    wp.set_defaults(func=cmd_read_web)

    fp = sub.add_parser('extract-figures', help='Index, render, and 300-DPI crop original figures from arXiv/local PDFs')
    fp.add_argument('target', help='arXiv ID/URL or local PDF file path')
    fp.add_argument('--list', action='store_true', help='List Figure captions and page numbers')
    fp.add_argument('--pages', help='Comma-separated 1-based page numbers to render for inspection (e.g. 2,4,5)')
    fp.add_argument('--crop', action='append', help='Crop spec PAGE:x0,y0,x1,y1:filename.png (normalized 0..1 coords; repeatable)')
    fp.add_argument('--out-dir', default='.research/cache/figures', help='Output directory for rendered/cropped PNGs')
    fp.add_argument('--dpi', type=int, default=300, help='Render DPI (default 300; use 180-200 for full-page inspection)')
    fp.add_argument('--max-pages', type=int, default=30, help='Max pages to scan when listing figures')
    fp.add_argument('--refresh', action='store_true')
    fp.set_defaults(func=cmd_extract_figures)

    return p


def main(argv: list[str] | None = None) -> int:
    configure_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())
