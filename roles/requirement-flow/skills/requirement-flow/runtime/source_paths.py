"""Resolve citations to relocated project documents without changing the signed record."""
import json
from pathlib import Path
import re

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
    for part in path.split("/"):
        current = current / part
        if linked(current):
            return False
    return current.is_file()


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

    def target(self, path):
        if path in self.targets:
            return self.targets[path]
        destination = path
        for old, new in self.directories:
            if path.startswith(old) and relative(path):
                candidate = new + path[len(old):]
                if project_file(self.root, candidate):
                    destination = candidate
                break
        self.targets[path] = destination
        return destination

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
            for rows, field in ((work["stories"].values(), "basis"), (work["contracts"].values(), "source"),
                                (work["events"], "evidence"), (work["lessons"], "evidence")):
                for row in rows:
                    self.text(row.get(field), labels)
        return labels
