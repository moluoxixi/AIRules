#!/usr/bin/env python3
"""Serve a read-only business reader directly from the project's Markdown."""
import argparse
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path, PurePosixPath
import re
import string
import sys
from urllib.parse import unquote, urlsplit


sys.dont_write_bytecode = True
MAX_BYTES = 2 * 1024 * 1024
MAX_DOCUMENTS = 500
MARKDOWN = {'.md', '.markdown'}
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
    def __init__(self, message, status=403):
        super().__init__(message)
        self.status = status


def local_path(root, name):
    parts = PurePosixPath(name).parts
    if (not parts or PurePosixPath(name).is_absolute() or '\\' in name
            or any(part == '..' or ':' in part or '\0' in part for part in parts)):
        raise ReaderError('路径必须位于项目内：' + name)
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


def markdown_links(content):
    """Read ordinary inline/reference links, excluding code fences and code spans."""
    lines, fence = [], None
    for line in content.splitlines():
        marker = re.match(r'^\s{0,3}(`{3,}|~{3,})', line)
        if marker:
            value = marker[1]
            if fence is None:
                fence = value
            elif value[0] == fence[0] and len(value) >= len(fence):
                fence = None
            continue
        if fence is None:
            lines.append(line)
    text = re.sub(r'(`+).*?\1', '', '\n'.join(lines))
    definitions = {}
    definition_pattern = r'^\s{0,3}\[([^\]]+)\]:\s*(.+)$'
    for match in re.finditer(definition_pattern, text, re.M):
        definitions[match[1].strip().casefold()] = match[2]
    text = re.sub(definition_pattern, lambda match: ' ' * len(match[0]), text, flags=re.M)

    def unescape(value):
        return re.sub(r'\\(.)', lambda match: match[1] if match[1] in string.punctuation else match[0], value)

    def destination(value):
        value = value.strip()
        if value.startswith('<') and '>' in value:
            escaped = False
            for end in range(1, len(value)):
                if escaped:
                    escaped = False
                elif value[end] == '\\':
                    escaped = True
                elif value[end] == '>':
                    return unescape(value[1:end])
        return unescape(re.sub(r'\s+[\"\'].*[\"\']\s*$', '', value).strip())

    def closing_parenthesis(start):
        depth, escaped, angle, quote = 0, False, False, None
        for index in range(start, len(text)):
            char = text[index]
            if char == '\n':
                return None
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif angle:
                angle = char != '>'
            elif quote:
                if char == quote:
                    quote = None
            elif char == '<':
                angle = True
            elif char in '\"\'' and index > start and text[index - 1].isspace() and depth == 0:
                quote = char
            elif char == '(':
                depth += 1
            elif char == ')':
                if depth == 0:
                    return index
                depth -= 1
        return None

    found, occupied = [], []
    for match in re.finditer(r'(?<![!\\])\[([^\]]+)\]\(', text):
        end = closing_parenthesis(match.end())
        if end is not None:
            found.append((match.start(), match[1], destination(text[match.end():end])))
            occupied.append((match.start(), end + 1))
    for match in re.finditer(r'(?<![!\\])\[([^\]]+)\]\[([^\]]*)\]', text):
        key = (match[2] or match[1]).strip().casefold()
        if key in definitions:
            found.append((match.start(), match[1], destination(definitions[key])))
            occupied.append((match.start(), match.end()))
    for match in re.finditer(r'(?<![!\\])\[([^\]]+)\]', text):
        if any(start <= match.start() < end for start, end in occupied):
            continue
        key = match[1].strip().casefold()
        if key in definitions:
            found.append((match.start(), match[1], destination(definitions[key])))
    return [(label, target) for _, label, target in sorted(found)]


def resolve_link(root, source, value):
    try:
        parsed = urlsplit(value)
    except ValueError:
        raise ReaderError('链接无效：' + value) from None
    if parsed.scheme or parsed.netloc:
        if parsed.scheme.lower() not in {'http', 'https', 'mailto'}:
            raise ReaderError('不支持的链接协议：' + value)
        return value, '', 'external'
    target = unquote(parsed.path)
    if not target:
        return source, unquote(parsed.fragment), 'document'
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
            local_path(root, '/'.join(parts))
    name = '/'.join(parts)
    local_path(root, name)
    kind = 'document' if PurePosixPath(name).suffix.lower() in MARKDOWN else 'source'
    return name, unquote(parsed.fragment), kind


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
        if tasks is None:
            tasks = ['docs/changes'] if local_path(self.root, 'docs/changes').is_dir() else []
        self.tasks = [self.relative(value) for value in tasks]
        for name in self.tasks:
            path = local_path(self.root, name)
            if not path.exists():
                raise ReaderError('任务入口不存在：' + name, 404)
            if path.is_file() and path.suffix.lower() not in MARKDOWN:
                raise ReaderError('任务文件必须是 Markdown：' + name)

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

    def catalog(self):
        documents, sources, warnings, task_paths = {}, {}, [], set()
        for name in self.tasks:
            try:
                path = local_path(self.root, name)
                if path.is_dir():
                    task_paths.update(file.relative_to(self.root).as_posix()
                                      for file in path.rglob('*') if file.suffix.lower() in MARKDOWN)
                else:
                    task_paths.add(name)
            except (OSError, ReaderError) as error:
                warnings.append(str(error))
        queue = [self.entry, *sorted(task_paths)]
        visited = set()
        while queue:
            name = queue.pop(0)
            if name in visited:
                continue
            visited.add(name)
            if len(visited) > MAX_DOCUMENTS:
                warnings.append('文档超过 500 份，请选择更具体的业务入口和任务目录。')
                break
            try:
                data, content = text_file(self.root, name)
            except (OSError, ReaderError) as error:
                if name == self.entry:
                    raise
                warnings.append(str(error))
                continue
            heading = re.search(r'^#\s+(.+?)\s*#*\s*$', content.lstrip('\ufeff'), re.M)
            document = {'path': name, 'title': heading[1] if heading else PurePosixPath(name).stem,
                        'kind': 'task' if name in task_paths and name != self.entry else 'business',
                        'sha256': hashlib.sha256(data).hexdigest(), 'links': [], 'backlinks': []}
            documents[name] = document
            for label, value in markdown_links(content):
                link = {'target': value, 'fragment': '', 'label': label,
                        'kind': 'external', 'exists': False}
                try:
                    target, fragment, kind = resolve_link(self.root, name, value)
                    link.update(target=target, fragment=fragment, kind=kind)
                    if kind == 'external':
                        link['exists'] = True
                    else:
                        raw, _ = text_file(self.root, target)
                        link['exists'] = True
                        if kind == 'document':
                            queue.append(target)
                        else:
                            sources[target] = {'path': target, 'title': PurePosixPath(target).name,
                                               'sha256': hashlib.sha256(raw).hexdigest()}
                except (OSError, ReaderError) as error:
                    warnings.append(name + ' → ' + str(error))
                document['links'].append(link)
        for document in documents.values():
            for link in document['links']:
                if link['kind'] == 'document' and link['target'] in documents:
                    target = documents[link['target']]
                    backlink = {key: document[key] for key in ('path', 'title', 'kind')}
                    if target is not document and backlink not in target['backlinks']:
                        target['backlinks'].append(backlink)
                elif link['kind'] == 'document' and link['exists']:
                    link['exists'] = False
        return {'project': self.root.name, 'entry': self.entry,
                'read_at': datetime.now(timezone.utc).isoformat(),
                'documents': list(documents.values()), 'sources': list(sources.values()),
                'warnings': list(dict.fromkeys(warnings))}

    def content(self, name):
        local_path(self.root, name)
        catalog = self.catalog()
        allowed = {item['path'] for item in catalog['documents'] + catalog['sources']}
        if name not in allowed:
            # Keep a missing/unsupported linked source's actual reason visible.
            links = [link for item in catalog['documents'] for link in item['links']]
            if any(link['target'] == name and link['kind'] != 'external' for link in links):
                text_file(self.root, name)
            raise ReaderError('来源未由业务或任务 Markdown 链接：' + name, 404)
        return text_file(self.root, name)[0]


def create_server(reader, port=0):
    assets = Path(__file__).resolve().parents[1] / 'reader'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def answer(self, status, body, mime='application/json; charset=utf-8'):
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'SAMEORIGIN')
            self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; "
                             "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
                             "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'")
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)

        def do_GET(self):
            try:
                host = urlsplit('//' + self.headers.get('Host', '')).hostname
                if host not in {'127.0.0.1', 'localhost'}:
                    raise ReaderError('阅读器仅接受本机访问')
                route = unquote(urlsplit(self.path).path)
                if route == '/api/catalog':
                    self.answer(200, json.dumps(reader.catalog(), ensure_ascii=False).encode())
                elif route.startswith('/content/'):
                    name = route[len('/content/'):]
                    mime = 'text/markdown' if PurePosixPath(name).suffix.lower() in MARKDOWN else 'text/plain'
                    self.answer(200, reader.content(name), mime + '; charset=utf-8')
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
                self.answer(getattr(error, 'status', 400),
                            json.dumps({'error': str(error)}, ensure_ascii=False).encode())

        do_HEAD = do_GET

        def do_POST(self):
            self.answer(405, b'{"error":"Read-only reader"}')

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--entry', default='docs/business/index.md')
    parser.add_argument('--tasks', action='append', help='Task Markdown file or directory; repeatable')
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
