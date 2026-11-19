"""Resolve citations to relocated project documents without changing the signed record."""
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode

if __package__:
    from .evidence import linked
else:
    from evidence import linked


def relative(path):
    return (isinstance(path, str) and bool(path)
            and not re.search(r'[\\:\x00-\x1f\x7f]', path)
            and all(part and part.casefold() not in {".", "..", ".git"} for part in path.split("/")))


def project_file(root, path):
    current = root
    if linked(current):
        return False
    for part in path.split("/"):
        current = current / part
        if linked(current):
            return False
    return current.is_file()


def cited_lines(work):
    endpoints = (item for c in work["contracts"].values() for item in c.get("endpoints", []))
    for rows, field in ((work["stories"].values(), "basis"), (work["contracts"].values(), "source"),
                        (endpoints, "source"), (work["events"], "evidence"), (work["lessons"], "evidence")):
        for row in rows:
            value = row.get(field)
            if isinstance(value, str):
                yield from (line.strip() for line in value.splitlines() if line.strip())


def select_source_root(project, preferred):
    """Allow an explicit sibling checkout only when Git registers it for this project."""
    if preferred is None:
        return project
    requested = Path(preferred).expanduser()
    if project is None or linked(requested) or not requested.is_dir():
        raise ValueError("来源根目录应为当前项目或同一仓库登记的工作树。")
    requested = requested.resolve()
    if requested == project:
        return project
    try:
        top = subprocess.check_output(["git", "-C", str(project), "rev-parse", "--show-toplevel"],
                                      stderr=subprocess.DEVNULL, timeout=5)
        if Path(os.fsdecode(top.rstrip(b"\r\n"))).resolve() == project:
            data = subprocess.check_output(["git", "-C", str(project), "worktree", "list", "--porcelain", "-z"],
                                          stderr=subprocess.DEVNULL, timeout=5)
            worktrees = (Path(os.fsdecode(field[9:])) for field in data.split(b"\0") if field.startswith(b"worktree "))
            if requested in worktrees:
                return requested
    except (OSError, subprocess.SubprocessError):
        pass
    raise ValueError("来源根目录应为当前项目或同一仓库登记的工作树。")


CITATION = re.compile(r"([^:\r\n]+)(?::([1-9]\d{0,7})(?::([1-9]\d{0,7}))?(?:-[1-9]\d{0,7})?)?")
TEXT_FORMATS = set("c cc cpp cs css csv go graphql h hpp htm html java js json jsx kt kts less md mdx mjs cjs mts cts php properties proto py rb rs rst sass scala scss sh sql svelte swift toml ts tsx txt vue xml yaml yml".split())
ASSET_FORMATS = {"png", "jpg", "jpeg", "webp", "pdf", "svg"}
PRIVATE_LITERAL = re.compile(r"-----BEGIN [^-\n]*PRIVATE KEY-----|\bbearer [\w.=-]{8,}|"
                             r"(?:api[_-]?key|access[_-]?token|password|(?:client[_-]?)?secret|authorization)"
                             r"[\"']?\s*[:=]\s*[\"'][^\s\"']{6,}", re.I)
PREVIEW_BYTES = 2 * 1024 * 1024


def source_format(path):
    """Allow cited source and design files without traversing private or generated trees."""
    if not relative(path):
        return None
    parts = path.casefold().split("/")
    allowed_dot = {".requirements", ".agents", ".github", ".moluoxixi"}
    for i, part in enumerate(parts):
        if (part.startswith(".") and (i or part not in allowed_dot) or part.endswith((".", " "))
                or part in {"node_modules", "dist", "build", "target", "__pycache__", "__generated__", "vendor",
                            "coverage", "secrets", "credentials"}
                or re.search(r'[<>|?*"]', part) or re.fullmatch(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", part)):
            return None
    name = parts[-1]
    if (re.search(r"(?:^|[._-])(?:credentials?|passwords?|secrets?|keyfile|keystore|service.account|id_(?:rsa|ed25519))(?:[._-]|$)", name)
            or name.endswith((".min.js", ".min.css", ".bundle.js", ".chunk.js", ".lock", "-lock.json", "-lock.yaml"))):
        return None
    return name.rsplit(".", 1)[-1]


def editor_location(target, kind, line, column):
    uri_path = target.as_posix()
    if not uri_path.startswith("/"):
        uri_path = "/" + uri_path
    location = {"path": str(target), "line": line, "column": column, "editors": {
        "webstorm": "webstorm://open?" + urlencode({"file": str(target), "line": line, "column": column}, quote_via=quote),
        "vscode": "vscode://file" + quote(uri_path, safe="/:") + f":{line}:{column}"}}
    if kind not in TEXT_FORMATS or target.stat().st_size > PREVIEW_BYTES:
        return location
    with target.open("rb") as stream:
        raw = stream.read(PREVIEW_BYTES + 1)
    if len(raw) > PREVIEW_BYTES or b"\0" in raw:
        return location
    try:
        lines = raw.decode("utf-8-sig").splitlines() or [""]
    except UnicodeDecodeError:
        return location
    if line > len(lines) or column > len(lines[line - 1]) + 1:
        return None
    start = max(0, line - 4)
    window = lines[start:line + 3]
    if not any(PRIVATE_LITERAL.search(s) for s in window):
        location["preview"] = {"startLine": start + 1, "lines": [s[:400] for s in window]}
    return location


def source_location(work, aliases, root, ref):
    match = CITATION.fullmatch(ref)
    if root is None or not match or not relative(match[1]):
        return None
    for original in cited_lines(work):
        entry = CITATION.fullmatch(original)
        if not entry or not relative(entry[1]):
            continue
        path = entry[1]
        mapped = aliases.mapped(path)
        if ref not in (original, mapped + original[len(path):]):
            continue
        for candidate in dict.fromkeys([mapped, path] if ref == original else [mapped]):
            kind = source_format(candidate)
            if kind in TEXT_FORMATS | ASSET_FORMATS and project_file(root, candidate):
                return editor_location(root / candidate, kind, int(match[2] or 1), int(match[3] or 1))
    return None


class SourcePaths:
    @classmethod
    def for_task(cls, workspace):
        task = Path(workspace)
        return cls(task.parent.parent if task.parent.name in ("active", "archive") else None)

    def __init__(self, store):
        self.root = None
        self.directories = []
        self.targets = {}
        if store is None or store.name != ".requirements" or linked(store):
            return
        self.root = store.parent
        config = store / "source-paths.json"
        if linked(config):
            raise ValueError("来源映射必须是项目内的普通文件")
        if not config.exists():
            return
        if not config.is_file() or config.stat().st_size > 65536:
            raise ValueError("无效的 .requirements/source-paths.json")
        data = json.loads(config.read_text(encoding="utf-8"))
        if (not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] != 1
                or not isinstance(data.get("directories"), dict)):
            raise ValueError("来源映射需要 version 1 和 directories 对象")
        for old, new in data["directories"].items():
            if not all(isinstance(p, str) and p.endswith("/") and relative(p[:-1]) for p in (old, new)):
                raise ValueError("来源映射使用以 / 结尾的项目相对目录")
            self.directories.append((old, new))
        self.directories.sort(key=lambda pair: len(pair[0]), reverse=True)

    def mapped(self, path):
        for old, new in self.directories:
            if path.startswith(old) and relative(path):
                return new + path[len(old):]
        return path

    def target(self, path):
        if path not in self.targets:
            mapped = self.mapped(path)
            self.targets[path] = mapped if mapped != path and project_file(self.root, mapped) else path
        return self.targets[path]

    def citation(self, line):
        """Match a whole relative filename with optional line, column or range."""
        ref = line.strip()
        match = re.fullmatch(r"([^:\r\n]+)(:\d+(?::\d+)?(?:-\d+)?)?", ref)
        if not match:
            return line
        path = match[1]
        target = self.target(path)
        return line.replace(ref, target + (match[2] or ""), 1) if target != path else line

    def text(self, value, labels=None):
        if not self.directories or not isinstance(value, str):
            return value
        lines = value.split("\n")
        projected = [self.citation(line) for line in lines]
        if labels is not None:
            labels.update((a.strip(), b.strip()) for a, b in zip(lines, projected) if a != b)
        return "\n".join(projected)

    def project(self, data):
        """Only basis, source and evidence are citation fields. Logs and commands stay verbatim."""
        if not self.directories:
            return data
        if isinstance(data, list):
            return [self.project(item) for item in data]
        if not isinstance(data, dict):
            return data
        result = {}
        for key, value in data.items():
            if key in ("basis", "source", "evidence") and isinstance(value, str):
                result[key] = self.text(value)
            elif isinstance(value, (dict, list)) and key not in ("argv", "artifact", "receipt"):
                result[key] = self.project(value)
            else:
                result[key] = value
        return result

    def reading_context(self, record):
        projected = self.project(record)
        index = ".requirements/rules/index.md"
        if self.root is not None and project_file(self.root, index):
            return {**projected, "project_rules": index}
        return projected

    def graph_labels(self, work):
        labels = {}
        if self.directories:
            for line in cited_lines(work):
                self.text(line, labels)
        return labels
