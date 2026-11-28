#!/usr/bin/env python3
"""Serve a read-only business reader directly from the project's Markdown."""
import argparse
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from html import escape as html_escape
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path, PurePosixPath
import re
from socketserver import TCPServer
import subprocess
import sys
import threading
from urllib.parse import parse_qs, unquote, urlencode, urlsplit


sys.dont_write_bytecode = True
MAX_BYTES = 2 * 1024 * 1024
MAX_DOCUMENTS = 500
MARKDOWN = {'.md', '.markdown'}
TASK_FILES = {'handbook.html', 'model.json'}
TASK_PAGE_CSP = ("sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; "
                 "style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; "
                 "base-uri 'none'; form-action 'none'; frame-ancestors 'self'")
TEXT_TYPES = MARKDOWN | {'.txt', '.json', '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx',
                         '.jsx', '.vue', '.css', '.html', '.yaml', '.yml', '.toml',
                         '.ini', '.sql', '.sh', '.go', '.java', '.rs', '.kt', '.dart',
                         '.rb', '.php', '.c', '.h', '.cpp', '.graphql', '.proto', '.csv'}
BLOCKED_PARTS = {'.git', '.ssh', '.aws', '.azure', '.gnupg', '.npmrc', '.netrc', '.pypirc',
                 '.credentials', '.secrets', 'node_modules'}
CREDENTIAL_STEMS = {'credential', 'credentials', 'secret', 'secrets'}
CREDENTIAL_SUFFIXES = {'.json', '.yaml', '.yml', '.toml', '.ini', '.env'}
CREDENTIAL_FILES = {'oauth_creds.json', 'application_default_credentials.json', 'mcp-oauth-tokens.json'}


class ReaderError(ValueError):
    def __init__(self, message, status=403, *, scope_limited=False):
        super().__init__(message)
        self.status = status
        self.scope_limited = scope_limited


def path_parts(name):
    parts = PurePosixPath(name).parts
    if (not parts or PurePosixPath(name).is_absolute() or '\\' in name
            or any(part == '..' or ':' in part or '\0' in part for part in parts)):
        raise ReaderError('路径必须位于项目内：' + name)
    return parts


def local_path(root, name):
    parts = path_parts(name)
    path = root
    for part in parts:
        lowered = part.casefold()
        if lowered in BLOCKED_PARTS or lowered == '.env' or lowered.startswith('.env.'):
            raise ReaderError('不读取隐藏或凭据路径：' + name)
        path /= part
        if path.is_symlink():
            raise ReaderError('不读取符号链接：' + name)
        if path.exists() and bool(getattr(path.lstat(), 'st_file_attributes', 0) & 0x400):
            raise ReaderError('不读取链接路径：' + name)
    stored_credentials = (path.stem.lstrip('.').casefold() in CREDENTIAL_STEMS
                          and path.suffix.lower() in CREDENTIAL_SUFFIXES)
    codex_auth = path.name.casefold() == 'auth.json' and path.parent.name.casefold() == '.codex'
    if (stored_credentials or codex_auth or path.name.casefold() in CREDENTIAL_FILES
            or path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx'}):
        raise ReaderError('不读取凭据文件：' + name)
    return path


def text_file(root, name):
    path = local_path(root, name)
    if not path.is_file():
        raise ReaderError('来源不存在或不是文件：' + name, 404)
    if path.suffix.lower() not in TEXT_TYPES:
        raise ReaderError('不支持的文本来源：' + name, 415)
    if path.stat().st_size > MAX_BYTES:
        raise ReaderError('来源超过 2 MiB，请缩小内容或使用外部链接：' + name, 413)
    data = path.read_bytes()
    if len(data) > MAX_BYTES:
        raise ReaderError('来源超过 2 MiB：' + name, 413)
    try:
        content = data.decode('utf-8')
    except UnicodeDecodeError:
        raise ReaderError('来源不是 UTF-8 文本：' + name, 415) from None
    if '\0' in content:
        raise ReaderError('来源包含二进制内容：' + name, 415)
    return data, content


class MarkdownMetadata:
    """Reuse the reader's Marked parser for one catalog traversal."""
    def __enter__(self):
        worker = Path(__file__).resolve().parents[1] / 'reader/metadata.mjs'
        self.io = ThreadPoolExecutor(max_workers=1)
        try:
            self.process = subprocess.Popen(['node', str(worker)], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8', bufsize=1)
        except OSError:
            self.io.shutdown(wait=True)
            raise ReaderError('业务阅读器需要 Node.js 20.19+；请确认 Node 可用后重新打开。', 503) from None
        return self

    def read(self, source):
        def request():
            self.process.stdin.write(json.dumps({'source': source[1:] if source.startswith('\ufeff') else source}, ensure_ascii=False) + '\n')
            self.process.stdin.flush()
            return self.process.stdout.readline(MAX_BYTES * 8)
        try:
            response = self.io.submit(request).result(timeout=15)
            result = json.loads(response)
            if (not response.endswith('\n') or not isinstance(result, dict) or set(result) != {'title', 'links'}
                    or not isinstance(result.get('title'), str) or not isinstance(result.get('links'), list)
                    or any(not isinstance(link, list) or len(link) != 2
                           or not all(isinstance(value, str) for value in link) for link in result['links'])):
                raise ValueError('Invalid metadata response')
            return result
        except (OSError, UnicodeError, ValueError, FutureTimeout):
            raise ReaderError('Markdown 元数据读取失败；请确认 Node.js 20.19+ 和阅读器离线资产可用后重读。', 503) from None

    def __exit__(self, *_args):
        try:
            if self.process.poll() is None:
                self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)
        finally:
            self.io.shutdown(wait=True)
            self.process.stdin.close()
            self.process.stdout.close()


def link_target(root, source, value):
    try:
        parsed = urlsplit(value)
    except ValueError:
        raise ReaderError('链接无效：' + value) from None
    if parsed.scheme or parsed.netloc:
        if parsed.scheme.lower() not in {'http', 'https', 'mailto'}:
            raise ReaderError('不支持的链接协议：' + value)
        return value, parsed, 'external'
    target = unquote(parsed.path)
    if not target:
        return source, parsed, 'document'
    if target.startswith('/') or '\\' in target:
        raise ReaderError('不读取项目外的绝对链接：' + value)
    parts = list(PurePosixPath(source).parent.parts)
    for part in target.split('/'):
        if part in ('', '.'):
            continue
        if part == '..':
            if not parts:
                raise ReaderError('链接越出项目：' + value)
            parts.pop()
        else:
            parts.append(part)
    name = '/'.join(parts)
    path_parts(name)
    kind = 'document' if PurePosixPath(name).suffix.lower() in MARKDOWN else 'source'
    return name, parsed, kind


def resolve_link(root, normalized, handbooks, known_tasks):
    name, parsed, kind = normalized
    if kind == 'external':
        return name, '', kind, ''
    if PurePosixPath(name).name == 'handbook.html':
        kind = handbook_probe(root, name, handbooks, known_tasks)['kind']
    query = parse_qs(parsed.query, keep_blank_values=True)
    # Only the original page's existing view controls belong in task links.
    query = {key: values[-1] for key, values in query.items()
             if key in {'view', 'q', 'features'}} if kind == 'task-page' else {}
    if query.get('view') not in {None, 'overview', 'detail'}:
        query.pop('view')
    fragment = parsed.fragment if kind == 'task-page' else unquote(parsed.fragment)
    return name, fragment, kind, urlencode(sorted(query.items()))


class ModelFingerprint(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'meta' and (values.get('name') or '').casefold() == 'model-sha256':
            self.values.append(values.get('content'))


def handbook_probe(root, name, handbooks, known_tasks):
    if name not in handbooks:
        probe = {'kind': 'task-page' if name in known_tasks else 'source'}
        handbooks[name] = probe
        read_handbook(root, name, probe)
        if probe.get('declaration'):
            probe['kind'] = 'task-page'
        model_path = PurePosixPath(name).with_name('model.json').as_posix()
        try:
            model_data, _ = text_file(root, model_path)
            probe['model_sha256'] = hashlib.sha256(model_data).hexdigest()
            try:
                model = json.loads(model_data)
            except ValueError:
                probe['model_error'] = ('任务 AI 记录不是有效 JSON：' + model_path, 422)
                return probe
            protocol = model.get('protocol') if isinstance(model, dict) else None
            publication = protocol.get('publication') if isinstance(protocol, dict) else None
            if (isinstance(publication, dict) and publication.get('human') == 'handbook.html'
                    and publication.get('agent') == 'model.json'):
                probe['kind'] = 'task-page'
            work = model.get('work') if isinstance(model, dict) else None
            metadata = isinstance(work, dict) and (
                any(isinstance(work.get(key), str) and work[key].strip() for key in ('id', 'title'))
                or type(work.get('revision')) in {int, float})
            if not isinstance(work, dict):
                probe['model_error'] = ('任务 AI 记录缺少 work 对象：' + model_path, 422)
            if probe['kind'] != 'task-page' and not (metadata and probe.get('page_exists')):
                return probe
            probe['kind'] = 'task-page'
            if not isinstance(work, dict):
                return probe
            try:
                canonical = json.dumps(model, ensure_ascii=False, sort_keys=True,
                                       separators=(',', ':'), allow_nan=False).encode()
            except ValueError:
                probe['model_error'] = ('任务 AI 记录不是有效 JSON：' + model_path, 422)
                return probe
            probe.update(work={key: work.get(key) for key in ('id', 'title', 'revision')},
                         model_digest=hashlib.sha256(canonical).hexdigest())
        except (OSError, ReaderError) as error:
            probe['model_error'] = (str(error), getattr(error, 'status', 404))
    return handbooks[name]


def read_handbook(root, name, probe):
    if 'sha256' not in probe and 'error' not in probe:
        try:
            probe['page_exists'] = local_path(root, name).is_file()
            data, content = text_file(root, name)
            declaration = ModelFingerprint()
            declaration.feed(content)
            probe.update(sha256=hashlib.sha256(data).hexdigest(), declaration=declaration.values)
        except (OSError, ReaderError) as error:
            probe['error'] = (str(error), getattr(error, 'status', 404))


class ReaderProject:
    def __init__(self, project, entry='docs/business/index.md', tasks=None):
        self.alias = Path(project).expanduser().absolute()
        self.root = self.alias.resolve(strict=True)
        if not self.root.is_dir():
            raise ReaderError('项目根必须是目录')
        self.entry = self.relative(entry)
        if PurePosixPath(self.entry).suffix.lower() not in MARKDOWN:
            raise ReaderError('业务入口必须是 Markdown')
        text_file(self.root, self.entry)
        self.tasks = None if tasks is None else [self.relative(value) for value in tasks]
        for name in self.tasks or []:
            path = local_path(self.root, name)
            if not path.exists():
                raise ReaderError('任务入口不存在：' + name, 404)
            if path.is_file() and path.suffix.lower() not in MARKDOWN and path.name not in TASK_FILES:
                raise ReaderError('任务文件必须是 Markdown、handbook.html 或 model.json：' + name)
        self.metadata_cache = OrderedDict()
        self.metadata_lock = threading.RLock()
        self.confirmed_tasks = set()

    def relative(self, value):
        path = Path(value)
        if path.is_absolute():
            for prefix in (self.root, self.alias):
                try:
                    path = path.relative_to(prefix)
                    break
                except ValueError:
                    continue
            else:
                raise ReaderError('入口必须位于项目内') from None
        name = path.as_posix()
        local_path(self.root, name)
        return name

    def task_page(self, name, probe):
        page_path = PurePosixPath(name).with_name('handbook.html').as_posix()
        model_path = PurePosixPath(name).with_name('model.json').as_posix()
        read_handbook(self.root, page_path, probe)
        if 'error' in probe:
            raise ReaderError(*probe['error'])
        if 'model_error' in probe:
            raise ReaderError(*probe['model_error'])
        work = probe['work']
        # This checks the declared canonical digest, not the page's embedded payload.
        title = work.get('title')
        if not isinstance(title, str) or not title.strip():
            title = PurePosixPath(page_path).parent.name or PurePosixPath(page_path).name
        return {'path': page_path, 'id': work.get('id'), 'title': title,
                'sha256': probe['sha256'], 'model_path': model_path,
                'model_sha256': probe['model_sha256'], 'revision': work.get('revision'),
                'synchronized': probe['declaration'] == [probe['model_digest']], 'backlinks': []}

    def catalog(self):
        try:
            return self._catalog()
        except (OSError, ValueError) as error:
            error.error_stage = 'catalog'
            raise

    def _catalog(self):
        documents, sources, task_pages, warnings, task_paths, page_paths = {}, {}, {}, [], set(), set()
        task_errors, task_error_statuses = {}, {}
        task_scope_limited = set()
        failed_pairs, handbooks = {}, {}
        explicit_pages = set()
        with self.metadata_lock:
            confirmed_tasks = set(self.confirmed_tasks)
        known_tasks = confirmed_tasks.copy()

        def task_error(name, error):
            page_path = PurePosixPath(name).with_name('handbook.html').as_posix()
            model_path = PurePosixPath(name).with_name('model.json').as_posix()
            task_errors[page_path] = task_errors[model_path] = str(error)
            task_error_statuses[page_path] = task_error_statuses[model_path] = getattr(error, 'status', 404)
            for path in (page_path, model_path):
                if getattr(error, 'scope_limited', False):
                    task_scope_limited.add(path)
                else:
                    task_scope_limited.discard(path)
            failed_pairs[page_path] = error

        def task_capacity_error(page_path):
            try:
                for part in (page_path, PurePosixPath(page_path).with_name('model.json').as_posix()):
                    if not local_path(self.root, part).is_file():
                        raise ReaderError('来源不存在或不是文件：' + part, 404)
            except (OSError, ReaderError) as error:
                task_error(page_path, error)
                return error
            error = ReaderError(f'任务原页超过 {MAX_DOCUMENTS} 份，请选择更具体的业务入口或任务目录。',
                                413, scope_limited=True)
            task_error(page_path, error)
            return error

        def add_task_page(name):
            page_path = PurePosixPath(name).with_name('handbook.html').as_posix()
            if page_path in failed_pairs:
                raise failed_pairs[page_path]
            if page_path not in task_pages:
                if len(task_pages) >= MAX_DOCUMENTS:
                    raise task_capacity_error(page_path)
                try:
                    page = self.task_page(page_path, handbook_probe(self.root, page_path, handbooks, known_tasks))
                except (OSError, ReaderError) as error:
                    task_error(page_path, error)
                    raise
                task_pages[page_path] = page
                with self.metadata_lock:
                    self.confirmed_tasks.add(page_path)
                for path, checksum in [(page['path'], page['sha256']),
                                       (page['model_path'], page['model_sha256'])]:
                    sources[path] = {'path': path, 'title': PurePosixPath(path).name, 'sha256': checksum}
            return task_pages[page_path]
        tasks = self.tasks
        if tasks is None:
            try:
                tasks = ['docs/changes'] if local_path(self.root, 'docs/changes').is_dir() else []
            except (OSError, ReaderError) as error:
                tasks = []
                warnings.append(str(error))
        for name in tasks:
            try:
                path = local_path(self.root, name)
                if not path.exists():
                    raise ReaderError('任务入口不存在：' + name, 404)
                if path.is_file() and path.suffix.lower() not in MARKDOWN and path.name not in TASK_FILES:
                    raise ReaderError('任务文件必须是 Markdown、handbook.html 或 model.json：' + name)
                candidates = path.rglob('*') if path.is_dir() else [path]
                for file in candidates:
                    relative = file.relative_to(self.root).as_posix()
                    if file.suffix.lower() in MARKDOWN:
                        task_paths.add(relative)
                    elif file.name in TASK_FILES:
                        page_path = PurePosixPath(relative).with_name('handbook.html').as_posix()
                        page_paths.add(page_path)
                        if file == path:
                            explicit_pages.add(page_path)
                            known_tasks.add(page_path)
            except (OSError, ReaderError) as error:
                warnings.append(str(error))
                if PurePosixPath(name).name in TASK_FILES:
                    task_error(name, error)
        queue = [self.entry, *sorted(task_paths)]
        visited = set()
        scheduled = set(queue)
        normalized_links, document_errors, prepared_links = {}, {}, []
        referenced_markdown = set()
        model_links, task_views = set(), set()
        with self.metadata_lock, ExitStack() as workers:
            metadata = None
            while queue:
                name = queue.pop(0)
                if name in visited:
                    continue
                visited.add(name)
                try:
                    data, content = text_file(self.root, name)
                except (OSError, ReaderError) as error:
                    if name == self.entry:
                        error.error_source = name
                        raise
                    document_errors[name] = {'error': str(error), 'status': getattr(error, 'status', 404)}
                    continue
                if len(documents) >= MAX_DOCUMENTS:
                    document_errors[name] = {
                        'error': f'文档读取超过 {MAX_DOCUMENTS} 份，请缩小业务入口或任务目录后重新读取：' + name,
                        'status': 413, 'scope_limited': True}
                    for pending in queue:
                        if pending not in visited:
                            document_errors[pending] = {
                                'error': f'本次未检查：已达文档读取上限 {MAX_DOCUMENTS} 份，请缩小业务入口或任务目录后重新读取：' + pending,
                                'status': 413, 'scope_limited': True}
                    break
                digest = hashlib.sha256(data).hexdigest()
                cached = self.metadata_cache.get(name)
                if cached is None or cached[0] != digest:
                    if metadata is None:
                        metadata = workers.enter_context(MarkdownMetadata())
                    try:
                        parsed = metadata.read(content)
                    except (OSError, ValueError) as error:
                        error.error_source = name
                        raise
                    cached = (digest, parsed['title'], tuple(tuple(link) for link in parsed['links']))
                    self.metadata_cache[name] = cached
                self.metadata_cache.move_to_end(name)
                if len(self.metadata_cache) > MAX_DOCUMENTS:
                    self.metadata_cache.popitem(last=False)
                document = {'path': name, 'title': cached[1] or PurePosixPath(name).stem,
                            'kind': 'task' if name in task_paths and name != self.entry else 'document',
                            'sha256': digest, 'links': [], 'backlinks': []}
                documents[name] = document
                for label, value in cached[2]:
                    link = {'target': value, 'fragment': '', 'query': '', 'label': label,
                            'kind': 'external', 'exists': False}
                    document['links'].append(link)
                    key = (name, value)
                    if key not in normalized_links:
                        try:
                            normalized_links[key] = link_target(self.root, name, value)
                        except (OSError, ReaderError) as error:
                            normalized_links[key] = (str(error), getattr(error, 'status', 404))
                    normalized = normalized_links[key]
                    prepared_links.append((document, link, normalized))
                    if len(normalized) == 2:
                        continue
                    target, parsed, kind = normalized
                    if kind == 'document':
                        referenced_markdown.add(target)
                        if target not in scheduled:
                            scheduled.add(target)
                            queue.append(target)
                    elif kind == 'source':
                        filename = PurePosixPath(target).name
                        if filename == 'model.json':
                            model_links.add(PurePosixPath(target).with_name('handbook.html').as_posix())
                        elif filename == 'handbook.html':
                            view = parse_qs(parsed.query, keep_blank_values=True).get('view', [None])[-1]
                            if (view in {'overview', 'detail'} or view is None
                                    and any(parse_qs(parsed.fragment).get('node', []))):
                                task_views.add(target)

        # Classify once all reachable Markdown has supplied its task evidence.
        known_tasks.update(model_links & task_views)
        for name in sorted(page_paths):
            try:
                if len(task_pages) >= MAX_DOCUMENTS:
                    break
                # A common filename alone does not make an ordinary source a task.
                if handbook_probe(self.root, name, handbooks, known_tasks)['kind'] == 'task-page':
                    add_task_page(name)
            except (OSError, ReaderError) as error:
                if name not in task_scope_limited:
                    warnings.append(str(error))
        for name in sorted(explicit_pages - task_pages.keys()):
            try:
                add_task_page(name)
            except (OSError, ReaderError) as error:
                if name not in task_scope_limited:
                    warnings.append(str(error))
        if len(task_pages) >= MAX_DOCUMENTS:
            pending = (confirmed_tasks & page_paths) - handbooks.keys() - failed_pairs.keys()
            for name in sorted(pending):
                handbooks[name] = {'kind': 'task-page'}
                task_capacity_error(name)
                if name not in task_scope_limited:
                    warnings.append(task_errors[name])
        for document, link, normalized in prepared_links:
            try:
                if len(normalized) == 2:
                    raise ReaderError(*normalized)
                name, _parsed, base_kind = normalized
                if (len(task_pages) >= MAX_DOCUMENTS and base_kind == 'source'
                        and PurePosixPath(name).name in TASK_FILES):
                    page_path = PurePosixPath(name).with_name('handbook.html').as_posix()
                    if page_path in known_tasks and page_path not in task_pages:
                        handbooks[page_path] = {'kind': 'task-page'}
                        if page_path not in failed_pairs:
                            task_capacity_error(page_path)
                target, fragment, kind, query = resolve_link(self.root, normalized, handbooks, known_tasks)
                link.update(target=target, fragment=fragment, kind=kind, query=query)
                if kind == 'source' and PurePosixPath(target).name == 'model.json':
                    page_path = PurePosixPath(target).with_name('handbook.html').as_posix()
                    if handbook_probe(self.root, page_path, handbooks, known_tasks)['kind'] == 'task-page':
                        add_task_page(page_path)
                if kind == 'task-page':
                    add_task_page(target)
                elif kind == 'document' and target in document_errors:
                    link.update(document_errors[target])
                    raise ReaderError(link['error'], link['status'], scope_limited=link.get('scope_limited', False))
                elif kind == 'source' and target not in sources:
                    probe = handbooks.get(target, {})
                    if 'error' in probe:
                        raise ReaderError(*probe['error'])
                    checksum = probe.get('sha256')
                    if PurePosixPath(target).name == 'model.json':
                        page_path = PurePosixPath(target).with_name('handbook.html').as_posix()
                        checksum = handbooks.get(page_path, {}).get('model_sha256')
                    if checksum is None:
                        raw, _ = text_file(self.root, target)
                        checksum = hashlib.sha256(raw).hexdigest()
                    sources[target] = {'path': target, 'title': PurePosixPath(target).name,
                                       'sha256': checksum}
                link['exists'] = True
            except (OSError, ReaderError) as error:
                link.update(error=str(error), status=getattr(error, 'status', 404))
                if getattr(error, 'scope_limited', False):
                    link['scope_limited'] = True
                if not link.get('scope_limited'):
                    warnings.append(document['path'] + ' → ' + str(error))
        warnings.extend(error['error'] for name, error in document_errors.items()
                        if name not in referenced_markdown and not error.get('scope_limited'))
        limited_count = sum(bool(error.get('scope_limited')) for error in document_errors.values())
        if limited_count:
            warnings.append(f'文档收录上限为 {MAX_DOCUMENTS} 份，本次 {limited_count} 个 Markdown 来源目标未收录；'
                            '请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
        limited_tasks = {name for name in task_scope_limited if PurePosixPath(name).name == 'handbook.html'}
        unexamined_tasks = page_paths - handbooks.keys() - failed_pairs.keys()
        if limited_tasks or unexamined_tasks:
            detail = f'本次 {len(limited_tasks)} 个明确任务未收录；' if limited_tasks else ''
            if unexamined_tasks:
                detail += '未检查其余候选；'
            warnings.append(f'原任务收录上限为 {MAX_DOCUMENTS} 份；' + detail
                            + '请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
        task_sources = {path: page for page in task_pages.values() for path in (page['path'], page['model_path'])}
        for document in documents.values():
            for link in document['links']:
                if link['kind'] != 'external' and link['target'] in task_errors:
                    link['exists'] = False
                    error = failed_pairs[PurePosixPath(link['target']).with_name('handbook.html').as_posix()]
                    link.update(error=task_errors[link['target']], status=getattr(error, 'status', 404))
                    if link['target'] in task_scope_limited:
                        link['scope_limited'] = True
                if link['kind'] == 'document' and link['target'] in documents:
                    target = documents[link['target']]
                    backlink = {key: document[key] for key in ('path', 'title', 'kind')}
                    if target is not document and backlink not in target['backlinks']:
                        target['backlinks'].append(backlink)
                elif link['exists'] and link['target'] in task_sources:
                    target = task_sources[link['target']]
                    backlink = {key: document[key] for key in ('path', 'title', 'kind')}
                    if backlink not in target['backlinks']:
                        target['backlinks'].append(backlink)
                elif link['kind'] == 'document' and link['exists']:
                    link['exists'] = False
        for path in task_errors:
            sources.pop(path, None)
        referenced_pairs = {PurePosixPath(link['target']).with_name('handbook.html').as_posix()
                            for document in documents.values() for link in document['links']
                            if link['kind'] != 'external' and PurePosixPath(link['target']).name in TASK_FILES}

        def still_present(page_path):
            if page_path in explicit_pages or page_path in task_errors or page_path in referenced_pairs:
                return True
            try:
                return any(local_path(self.root, path).is_file() for path in
                    (page_path, PurePosixPath(page_path).with_name('model.json').as_posix()))
            except (OSError, ReaderError):
                return True

        # Keep live identities across capacity changes; discard completely retired paths.
        with self.metadata_lock:
            self.confirmed_tasks = {path for path in self.confirmed_tasks if still_present(path)}
        entry = documents[self.entry]
        navigation = [{'path': self.entry, 'label': entry['title'], 'fragment': '', 'query': ''}]
        destinations = {(self.entry, '', '')}
        for link in entry['links']:
            destination = (link['target'], link['fragment'], link['query'])
            if (link['kind'] not in {'document', 'task-page'} or link['target'] == self.entry
                    or destination in destinations):
                continue
            destinations.add(destination)
            navigation.append({'path': link['target'], 'label': link['label'],
                               'fragment': link['fragment'], 'query': link['query']})
        return {'project': self.root.name, 'entry': self.entry,
                'read_at': datetime.now(timezone.utc).isoformat(),
                'navigation': navigation,
                'documents': list(documents.values()), 'document_errors': document_errors,
                'task_pages': list(task_pages.values()),
                'task_errors': task_errors, 'task_error_statuses': task_error_statuses,
                'task_scope_limited': sorted(task_scope_limited),
                'sources': list(sources.values()),
                'warnings': list(dict.fromkeys(warnings))}

    def content(self, name, expected_sha256=None):
        local_path(self.root, name)
        catalog = self.catalog()
        if name in catalog['task_errors']:
            raise ReaderError(catalog['task_errors'][name], catalog['task_error_statuses'][name],
                              scope_limited=name in catalog['task_scope_limited'])
        if name in catalog['document_errors']:
            error = catalog['document_errors'][name]
            raise ReaderError(error['error'], error['status'], scope_limited=error.get('scope_limited', False))
        allowed = {item['path'] for item in catalog['documents'] + catalog['sources']}
        if name not in allowed:
            # Keep a missing/unsupported linked source's actual reason visible.
            links = [link for item in catalog['documents'] for link in item['links']]
            linked = next((link for link in links if link['target'] == name and link['kind'] != 'external'), None)
            if linked:
                if linked.get('error'):
                    raise ReaderError(linked['error'], linked['status'], scope_limited=linked.get('scope_limited', False))
                text_file(self.root, name)
            raise ReaderError('来源未由业务或任务 Markdown 链接：' + name, 404)
        data = text_file(self.root, name)[0]
        if expected_sha256 is not None and hashlib.sha256(data).hexdigest() != expected_sha256:
            raise ReaderError('来源已更新，请点击“刷新内容”重新读取目录与关联：' + name, 409)
        return data

    def task_page_content(self, name, expected_sha256=None, expected_model_sha256=None):
        path = local_path(self.root, name)
        if path.name in TASK_FILES and (not expected_sha256 or not expected_model_sha256):
            raise ReaderError('打开任务原页或 AI 记录需要两个版本摘要，请刷新目录。', 400)
        catalog = self.catalog()
        pages = catalog['task_pages']
        page = next((item for item in pages if name in {item['path'], item['model_path']}), None)
        if page is None:
            raise ReaderError(catalog['task_errors'].get(name)
                              or '任务原页或 AI 记录未收录、已移除或不可读取：' + name,
                              catalog['task_error_statuses'].get(name, 404),
                              scope_limited=name in catalog['task_scope_limited'])
        page_data = text_file(self.root, page['path'])[0]
        model_data = text_file(self.root, page['model_path'])[0]
        page_hash = hashlib.sha256(page_data).hexdigest()
        model_hash = hashlib.sha256(model_data).hexdigest()
        if (page_hash != page['sha256'] or model_hash != page['model_sha256']
                or expected_sha256 is not None and page_hash != expected_sha256
                or expected_model_sha256 is not None and model_hash != expected_model_sha256):
            raise ReaderError('任务原页或 AI 记录已更新，请刷新目录后重读。', 409)
        return page_data if name == page['path'] else model_data

    def document_texts(self, scope):
        if scope not in {'all', 'tasks'}:
            raise ReaderError('未知的文档范围', 400)
        # Resolve the current allowlist once, before sending a successful response.
        catalog = self.catalog()
        documents = catalog['documents']
        navigation = list(catalog['navigation'])
        task_members = set(catalog['task_errors'])
        task_members.update(path for page in catalog['task_pages'] for path in (page['path'], page['model_path']))
        source_checks = {}
        for document in documents:
            for link in document['links']:
                name = link['target']
                if link['kind'] == 'source' and name not in task_members and link.get('error'):
                    source_checks[name] = {'path': name, 'error': link['error'], 'status': link['status']}
        for source in catalog['sources']:
            if source['path'] not in task_members:
                source_checks[source['path']] = {'path': source['path'], 'sha256': source['sha256']}

        def records():
            for document in documents:
                if scope == 'tasks' and document['kind'] != 'task':
                    yield {'path': document['path'], 'sha256': document['sha256']}
                    continue
                name = document['path']
                try:
                    data, content = text_file(self.root, name)
                    if hashlib.sha256(data).hexdigest() != document['sha256']:
                        raise ReaderError('来源已更新，请刷新内容：' + name, 409)
                    yield {'path': name, 'sha256': document['sha256'], 'text': content}
                except (OSError, ReaderError) as error:
                    if name == catalog['entry']:
                        navigation.clear()
                    yield {'path': name, 'error': str(error), 'status': getattr(error, 'status', 404)}
            for name, error in catalog['document_errors'].items():
                yield {'path': name, **error}
            for page in catalog['task_pages']:
                try:
                    for path, expected in [(page['path'], page['sha256']),
                                           (page['model_path'], page['model_sha256'])]:
                        if hashlib.sha256(text_file(self.root, path)[0]).hexdigest() != expected:
                            raise ReaderError('原任务已更新，请刷新内容：' + page['path'], 409)
                    yield {'kind': 'task-page', 'path': page['path'], 'sha256': page['sha256'],
                           'model_sha256': page['model_sha256']}
                except (OSError, ReaderError) as error:
                    yield {'kind': 'task-page', 'path': page['path'], 'error': str(error),
                           'status': getattr(error, 'status', 404)}
            for name, error in catalog['task_errors'].items():
                if PurePosixPath(name).name == 'handbook.html':
                    status = catalog['task_error_statuses'][name]
                    record = {'kind': 'task-page', 'path': name, 'error': error, 'status': status}
                    if name in catalog['task_scope_limited']:
                        record['scope_limited'] = True
                    yield record

        return {'records': records(), 'source_checks': list(source_checks.values()),
                'navigation': navigation, 'warnings': catalog['warnings']}


def json_batch(batch):
    """Encode one document at a time so the server does not buffer the whole corpus."""
    yield b'{"records":['
    for index, record in enumerate(batch['records']):
        if index:
            yield b','
        yield json.dumps(record, ensure_ascii=False).encode()
    yield b'],"source_checks":' + json.dumps(batch['source_checks'], ensure_ascii=False).encode()
    yield b',"navigation":' + json.dumps(batch['navigation'], ensure_ascii=False).encode()
    yield b',"warnings":' + json.dumps(batch['warnings'], ensure_ascii=False).encode() + b'}'


def create_server(reader, port=0):
    assets = Path(__file__).resolve().parents[1] / 'reader'

    class LoopbackHTTPServer(ThreadingHTTPServer):
        def server_bind(self):
            # Numeric loopback needs no reverse DNS to populate HTTP metadata.
            TCPServer.server_bind(self)
            self.server_name, self.server_port = self.server_address[:2]

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def answer(self, status, body, mime='application/json; charset=utf-8', csp=None):
            self.send_response(status)
            self.send_header('Content-Type', mime)
            if isinstance(body, bytes):
                self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'SAMEORIGIN')
            self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
            self.send_header('Content-Security-Policy', csp or "default-src 'self'; script-src 'self'; "
                             "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
                             "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'")
            self.end_headers()
            if self.command != 'HEAD':
                if isinstance(body, bytes):
                    self.wfile.write(body)
                else:
                    self.wfile.writelines(body)

        def do_GET(self):
            embedded = None
            try:
                host = urlsplit('//' + self.headers.get('Host', '')).hostname
                if host not in {'127.0.0.1', 'localhost'}:
                    raise ReaderError('阅读器仅接受本机访问')
                parsed = urlsplit(self.path)
                route = unquote(parsed.path)
                if route == '/api/catalog':
                    self.answer(200, json.dumps(reader.catalog(), ensure_ascii=False).encode())
                elif route == '/api/document-texts':
                    scope = parse_qs(parsed.query, keep_blank_values=True).get('scope', ['all'])[0]
                    self.answer(200, json_batch(reader.document_texts(scope)))
                elif route.startswith('/task-page/'):
                    versioned = re.fullmatch(r'/task-page/([a-f0-9]{64})/([a-f0-9]{64})/(.+)', route)
                    if not versioned:
                        raise ReaderError('任务原页链接缺少双版本路径，请刷新目录后重新打开。', 400)
                    page_hash, model_hash, name = versioned.groups()
                    query = parse_qs(parsed.query, keep_blank_values=True)
                    if PurePosixPath(name).name == 'handbook.html' and query.get('embed', [None])[0] == '1':
                        embedded = {'type': 'requirement-flow:task-page-error',
                                    'request': query.get('embed_request', [''])[0], 'path': name,
                                    'sha256': page_hash, 'model_sha256': model_hash}
                    data = reader.task_page_content(name, page_hash, model_hash)
                    mime = 'application/json' if PurePosixPath(name).name == 'model.json' else 'text/html'
                    if mime == 'text/html' and query.get('embed', [None])[0] == '1':
                        data += b'<style>.app-head>header{display:none!important}</style>'
                    self.answer(200, data, mime + '; charset=utf-8', TASK_PAGE_CSP)
                elif route.startswith('/content/'):
                    name = route[len('/content/'):]
                    mime = 'text/markdown' if PurePosixPath(name).suffix.lower() in MARKDOWN else 'text/plain'
                    expected = parse_qs(parsed.query, keep_blank_values=True).get('sha256', [None])[0]
                    self.answer(200, reader.content(name, expected), mime + '; charset=utf-8')
                elif route in {'/', '/index.html'} or route.startswith('/assets/'):
                    name = 'index.html' if route in {'/', '/index.html'} else route.lstrip('/')
                    path = local_path(assets, name)
                    if not path.is_file():
                        raise ReaderError('阅读器资源不存在', 404)
                    mime = {'.js': 'text/javascript', '.mjs': 'text/javascript',
                            '.css': 'text/css', '.html': 'text/html'}.get(path.suffix.lower())
                    mime = mime or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
                    self.answer(200, path.read_bytes(), mime)
                elif route == '/favicon.ico':
                    self.answer(204, b'')
                else:
                    raise ReaderError('页面不存在', 404)
            except (ReaderError, OSError, ValueError) as error:
                body = {'error': str(error)}
                if getattr(error, 'scope_limited', False):
                    body['scope_limited'] = True
                if getattr(error, 'error_stage', None) == 'catalog':
                    body['error_stage'] = 'catalog'
                    if getattr(error, 'error_source', None):
                        body['error_source'] = error.error_source
                status = getattr(error, 'status', 400)
                if embedded is not None:
                    page = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
                            '<title>任务画布未加载</title><body style="margin:16px;font:14px/1.6 system-ui">'
                            '<h1 style="font-size:16px;margin:0 0 8px">任务画布未加载</h1><p style="margin:0;overflow-wrap:anywhere">'
                            + html_escape(str(error)) + '</p>')
                    if re.fullmatch(r'[a-f0-9]{32}', embedded['request']):
                        notification = json.dumps(embedded, ensure_ascii=True).replace('<', r'\u003c').replace('>', r'\u003e')
                        page += "<script>parent.postMessage(" + notification + ", '*');</script>"
                    self.answer(status, (page + '</body></html>').encode(), 'text/html; charset=utf-8', TASK_PAGE_CSP)
                else:
                    self.answer(status, json.dumps(body, ensure_ascii=False).encode())

        do_HEAD = do_GET

        def do_POST(self):
            self.answer(405, b'{"error":"Read-only reader"}')

    return LoopbackHTTPServer(('127.0.0.1', port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--entry', default='docs/business/index.md')
    parser.add_argument('--tasks', action='append', help='Task directory, Markdown, handbook.html or model.json; repeatable')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('--port 必须介于 0 与 65535')
    try:
        reader = ReaderProject(args.project, args.entry, args.tasks)
        server = create_server(reader, args.port)
    except (OSError, ValueError) as error:
        parser.exit(2, str(error) + '\n')
    print(f'Local: http://127.0.0.1:{server.server_port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
