"""Project reviewed lessons to Markdown and query Basic Memory's local full-text index."""
from contextlib import closing
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import unicodedata
from urllib.parse import quote

if __package__:
    from .evidence import linked
else:
    from evidence import linked


PACKAGE = "basic-memory==1.0.0"
MODE = "basic-memory-fts5"
AUTOMATIC_REFRESH_SECONDS = 5
MARKER = "---\nairules: requirement-flow-lesson\n"
ERRORS = (OSError, ValueError, sqlite3.Error, subprocess.SubprocessError)
CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3\uf900-\ufaff]+")
WORDS = re.compile(r"[a-z][a-z0-9_]{1,63}")
COMMON = set("需求 功能 场景 验收 处理 验证 用户 一个 需要 可以 应该 是否 如果 实现 操作 页面 信息 进行 结果 经验 来源 接口 字段 the and for with api post get".split())


def directory(path, create=False):
    if linked(path) or (path.exists() and not path.is_dir()):
        raise ValueError(f"无效的本地经验目录：{path}")
    if create:
        path.mkdir(exist_ok=True)
    return path


def regular(path):
    if linked(path) or (path.exists() and not path.is_file()):
        raise ValueError(f"无效的本地经验文件：{path}")
    return path


def paths(store, *, create_notes=False):
    store = Path(store)
    if store.name != ".requirements" or not directory(store).is_dir():
        raise ValueError("需要项目的 .requirements 目录")
    store = store.resolve()
    knowledge = directory(store / "knowledge", create_notes)
    return directory(knowledge / "lessons", create_notes), directory(store / ".basic-memory")


def segment(value):
    if not isinstance(value, str) or not re.fullmatch(r"[^\W_][\w-]*", value):
        raise ValueError("经验记录包含无效的需求或经验 ID")
    return unicodedata.normalize("NFC", value)


def quoted(value):
    return json.dumps(value, ensure_ascii=False)


def atomic(path, content):
    regular(path)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        tmp = Path(stream.name)
        try:
            stream.write(content.encode("utf-8"))
            stream.flush()
            stream.close()
            os.replace(tmp, path)
        finally:
            tmp.unlink(missing_ok=True)


def markdown(card):
    task, key = segment(card["task"]), segment(card["id"])
    version = card["version"]
    if type(version) is not int or version < 1 or card["bucket"] not in ("active", "archive"):
        raise ValueError("经验引用的版本或需求位置无效")
    title = card["practice"].splitlines()[0]
    ref = f'../../../{card["bucket"]}/{quote(task)}'
    review = card["review"]
    lines = [MARKER.rstrip(), f"title: {quoted(title)}", "type: note",
             f'permalink: {quoted("lessons/" + task + "/" + key)}',
             f"task: {quoted(task)}", f"lesson: {quoted(key)}", f"version: {version}",
             f'tags: {quoted(card["tags"])}', "---", "", f"# {title}", "",
             f'来自 [{card["task_title"]}]({ref}/handbook.html)，版本 {version}。', "",
             "## 适用条件", "", card["when"], "", "## 做法", "", card["practice"],
             "", "## 适用边界", "", card["boundary"], "", "## 发现", "", card["observation"],
             "", "## 审查与依据", "", f'{review["actor"]}：{review["reason"]}', ""]
    for source in card["sources"]:
        graph = f'{ref}/handbook.html#node={quote(source["story"])}'
        lines.append(f'- [{source["story_title"]}]({graph}) · {source["scenario"]} · {source["action"]}')
        lines.append(f'  - 验收条件：{source["given"]}；{source["when"]}；{source["then"]}')
        proof = source["proof"]
        artifact = proof.get("artifact", {})
        if re.fullmatch(r"evidence/[0-9a-f]{32}/(?:output\.log|artifact\.[a-z0-9]{1,12})", artifact.get("path", "")):
            lines.append(f'  - [原始证据]({ref}/{artifact["path"]}) · SHA-256 `{artifact["sha256"]}`')
        lines.append(f'  - 回执 `{source["receipt"]}`')
    return "\n".join(lines) + "\n"


def managed(path):
    with regular(path).open(encoding="utf-8") as stream:
        return stream.read(len(MARKER)) == MARKER


def project(store, cards, *, refresh_index=True):
    """Caller holds the project write lock across catalogue validation and projection."""
    notes, state = paths(store)
    desired = {}
    counts = dict(written=0, removed=0, unchanged=0)
    for card in cards:
        if card["state"] == "approved":
            relative = Path(segment(card["task"])) / (segment(card["id"]) + ".md")
            if relative in desired:
                raise ValueError(f"同一经验有多个有效版本：{relative}")
            desired[relative] = markdown(card)
    if not desired and not notes.exists():
        return counts
    paths(store, create_notes=True)
    for relative, content in desired.items():
        target = notes / relative
        directory(target.parent, True)
        if regular(target).is_file():
            if not managed(target):
                raise ValueError(f"已有同名的手写笔记：{relative}")
            if target.read_bytes() == content.encode("utf-8"):
                counts["unchanged"] += 1
                continue
        atomic(target, content)
        counts["written"] += 1
    for folder in notes.iterdir():
        if linked(folder) or not folder.is_dir():
            continue
        for target in folder.glob("*.md"):
            if not linked(target) and target.relative_to(notes) not in desired and managed(target):
                target.unlink()
                counts["removed"] += 1
    if refresh_index and registration(state, notes):
        result = refresh(notes, state, purpose="publish")
        if result.get("error"):
            raise ValueError("经验笔记已保存，Basic Memory 索引更新失败：" + result["error"])
    return counts


def binding_id(notes):
    return "airules-" + hashlib.sha256(os.fsencode(notes)).hexdigest()[:20]


def registration(state, notes):
    path = regular(state / "registration.json")
    if not path.exists():
        return {}
    try:
        row = json.loads(path.read_bytes())
        if isinstance(row, dict) and row.get("project") == binding_id(notes) and row.get("package") == PACKAGE:
            return row
    except (ValueError, UnicodeError):
        pass
    return {}


def write_state(state, row):
    atomic(state / "registration.json", json.dumps(row, ensure_ascii=False, sort_keys=True))


@lru_cache(maxsize=2048)
def note_version(path, fingerprint):
    with regular(path).open(encoding="utf-8") as stream:
        if stream.read(len(MARKER)) != MARKER:
            return None
        for line in stream:
            if line == "---\n":
                break
            match = re.fullmatch(r"version: ([1-9][0-9]*)\n", line)
            if match:
                return int(match[1])
    raise ValueError(f"经验 Markdown 缺少版本：{path}")


def snapshot(notes):
    files = {}
    checksum = hashlib.sha256()
    if notes.exists():
        for folder in sorted(notes.iterdir()):
            if folder.name.startswith(".") or (not linked(folder) and not folder.is_dir()):
                continue
            directory(folder)
            for path in sorted(folder.iterdir()):
                if path.name.startswith(".") or path.suffix != ".md":
                    continue
                regular(path)
                stat = path.stat()
                stamp = (stat.st_dev, stat.st_ino, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
                version = note_version(path, stamp)
                if version:
                    key = unicodedata.normalize("NFC", path.relative_to(notes).as_posix())
                    checksum.update(json.dumps([key, stamp]).encode())
                    files[key] = version
    return checksum.hexdigest(), files


def open_index(state, row):
    generation = row.get("generation", "")
    if not re.fullmatch(r"index-[a-z0-9_]+", generation):
        raise ValueError("需要重建 Basic Memory 本地索引")
    folder = directory(state / generation)
    database = regular(folder / "memory.db")
    # Basic Memory leaves a checkpointed WAL-mode DB without -shm/-wal files.
    # Apple SQLite opens it only if it can create those transient sidecars.
    # mode=rw requires an existing file; query_only forbids writes by this connection.
    db = sqlite3.connect(database.as_uri() + "?mode=rw", uri=True, timeout=0.2)
    db.execute("PRAGMA query_only=ON")
    return db


def launch(args, cwd, env, timeout):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, errors="replace",
                            stdin=subprocess.DEVNULL, timeout=timeout, check=False)
    if result.returncode:
        lines = [line.strip() for line in (result.stderr or result.stdout).splitlines() if line.strip()]
        raise ValueError("Basic Memory 执行失败：" + (lines[-1][:240] if lines else str(result.returncode)))
    return result.stdout.strip()


def binary(state, *, offline, timeout):
    uv = shutil.which("uv")
    if not uv:
        raise ValueError("未找到 uv；安装 uv 后重新执行 memory enable")
    args = [uv, "tool", "run"]
    if offline:
        args.append("--offline")
    args += ["--python", "3.12", "--from", PACKAGE, "python", "-I", "-c",
             "from pathlib import Path; import sys,os; print(Path(sys.executable).parent / ('basic-memory.exe' if os.name=='nt' else 'basic-memory'))"]
    path = Path(launch(args, state, dict(os.environ), timeout))
    if not path.is_absolute() or not path.is_file():
        raise ValueError("Basic Memory 可执行文件缺失，重新执行 memory enable")
    return str(path)


def project_id(db, name, notes):
    """Basic Memory stores Path.as_posix(), including on Windows."""
    entry = db.execute("SELECT id, path FROM project WHERE name=?", (name,)).fetchone()
    if entry and isinstance(entry[1], str):
        indexed = type(notes)(entry[1])
        if indexed.is_absolute() and indexed == notes:
            # Separators and drive-letter case may differ. For a difference in the
            # actual components, check file identity (Windows supports case-sensitive dirs).
            if indexed.parts[1:] == notes.parts[1:]:
                return entry[0]
            try:
                if os.path.samefile(indexed, notes):
                    return entry[0]
            except OSError:
                pass
    raise ValueError("Basic Memory 项目未绑定到当前工作区的经验目录")


def note_key(notes, indexed_path):
    if not isinstance(indexed_path, str):
        return None
    path = type(notes)(indexed_path)
    if path.anchor or len(path.parts) != 2 or ".." in path.parts:
        return None
    return unicodedata.normalize("NFC", path.as_posix())


def rebuild(notes, state, row, files, *, purpose, deadline=None):
    # Automatic refresh shares one budget across discovery and both CLI calls.
    # Explicit enable/sync can install packages and complete a longer rebuild.
    reading = purpose == "search"
    def budget(limit):
        remaining = limit if deadline is None else min(limit, deadline - time.monotonic())
        if remaining <= 0:
            raise ValueError("Basic Memory 自动索引更新超时，请运行 memory sync")
        return remaining
    executable = binary(state, offline=purpose != "enable", timeout=budget(12 if reading else 240))
    runtime = state / row.get("generation", "") if row.get("generation") else None
    if runtime:
        try:
            with closing(open_index(state, row)) as db:
                project_id(db, row["project"], notes)
        except ERRORS:
            runtime = None
    fresh = runtime is None
    if fresh:
        runtime = Path(tempfile.mkdtemp(prefix="index-", dir=state))
    env = {k: v for k, v in os.environ.items() if not k.startswith(("BASIC_MEMORY_", "LOGFIRE_", "OTEL_", "PYTHON"))}
    env.update(BASIC_MEMORY_CONFIG_DIR=str(runtime), BASIC_MEMORY_HOME=str(runtime / "unused"),
               BASIC_MEMORY_CLOUD_MODE="false", BASIC_MEMORY_LOGFIRE_ENABLED="false",
               BASIC_MEMORY_DATABASE_BACKEND="sqlite", LOGFIRE_SEND_TO_LOGFIRE="false",
               HF_HUB_OFFLINE="1", OTEL_SDK_DISABLED="true")
    try:
        if fresh:
            launch([executable, "project", "add", row["project"], str(notes), "--local", "--no-wait"],
                   state, env, budget(8 if reading else 100))
        launch([executable, "reindex", "--project", row["project"], "--search"], state, env,
               budget(12 if reading else 120))
        result = dict(row, generation=runtime.name)
        with closing(open_index(state, result)) as db:
            indexed = db.execute(
                "SELECT file_path FROM search_index WHERE project_id=? AND type='entity'",
                (project_id(db, row["project"], notes),))
            found = {note_key(notes, entry[0]) for entry in indexed}
        missing = files.keys() - found
        if missing:
            raise ValueError("Basic Memory 索引缺少已批准的经验：" + "、".join(sorted(missing)[:3]))
        stale = sorted(key for key in found - files.keys() if key and not (notes / key).is_file())
        if stale:
            raise ValueError("Basic Memory 索引仍包含已删除的笔记：" + "、".join(stale[:3]))
        return result
    except BaseException:
        if fresh:
            shutil.rmtree(runtime, ignore_errors=True)
        raise


def refresh(notes, state, *, purpose, force=False):
    """Serialize rebuilds. A reader racing another rebuild uses structured matches immediately."""
    deadline = time.monotonic() + AUTOMATIC_REFRESH_SECONDS if purpose in ("search", "publish") else None
    try:
        directory(state, create=True)
        with closing(sqlite3.connect(regular(state / "writer.sqlite"), timeout=0 if deadline else 120)) as lock:
            lock.execute("BEGIN IMMEDIATE")
            row = registration(state, notes)
            if not row:
                if purpose != "enable":
                    return {}
                row = {"package": PACKAGE, "project": binding_id(notes)}
            if purpose != "enable" and (row.get("error") or not row.get("generation")):
                return dict(row, error=row.get("error") or "本地索引尚未就绪，请运行 memory sync")
            if purpose != "enable":
                try:
                    with closing(open_index(state, row)) as db:
                        scope = project_id(db, row["project"], notes)
                        db.execute("SELECT rowid FROM search_index WHERE project_id=? LIMIT 1", (scope,)).fetchone()
                except ERRORS as exc:
                    row.update(error="本地索引不可用，请运行 memory sync：" + str(exc), stamp=None)
                    write_state(state, row)
                    return row
            stamp, files = snapshot(notes)
            if not force and row.get("stamp") == stamp and row.get("generation") and not row.get("error"):
                return row
            if purpose == "search" and time.time() < row.get("retry_after", 0):
                return {}
            old = row.get("generation")
            try:
                row = rebuild(notes, state, row, files, purpose=purpose, deadline=deadline)
            except ERRORS as exc:
                row.update(error=str(exc), retry_after=time.time() + 30, stamp=None)
                write_state(state, row)
                return row
            row.update(stamp=stamp, indexed=len(files), error=None, retry_after=0)
            write_state(state, row)
            if old and old != row["generation"] and re.fullmatch(r"index-[a-z0-9_]+", old):
                shutil.rmtree(directory(state / old), ignore_errors=True)
            return row
    except ERRORS as exc:
        if purpose != "search":
            raise ValueError("无法更新 Basic Memory 本地索引：" + str(exc)) from exc
        return {}


def status(store):
    notes, state = paths(store)
    row = registration(state, notes)
    result = {"enabled": bool(row), "ready": False, "mode": MODE if row else "structured", "package": PACKAGE}
    if row:
        result.update(indexed=row.get("indexed", 0), error=row.get("error"), project=row["project"])
        if not row.get("error"):
            try:
                with closing(open_index(state, row)) as db:
                    scope = project_id(db, row["project"], notes)
                    db.execute("SELECT rowid FROM search_index WHERE project_id=? LIMIT 1", (scope,)).fetchone()
                result["ready"] = row.get("stamp") == snapshot(notes)[0]
                if not result["ready"]:
                    result["error"] = "本地经验笔记已变更，索引尚未同步"
            except ERRORS as exc:
                result["error"] = "无法读取本地经验索引：" + str(exc)
    return result


def enable(store, cards):
    project(store, cards, refresh_index=False)
    notes, state = paths(store, create_notes=True)
    refresh(notes, state, purpose="enable", force=True)
    return status(store)


def terms(query):
    query = unicodedata.normalize("NFKC", query[:8000]).lower()
    chinese = {run[i:i + 2] for run in CJK.findall(query) for i in range(len(run) - 1)}
    word = set(WORDS.findall(query))
    return sorted(chinese - COMMON)[:192], sorted(word - COMMON)[:64]


def search(store, query):
    """Search the pinned upstream FTS5 table, with no CLI/model startup on a current index."""
    chinese, words = terms(query)
    if not (chinese or words):
        return []
    try:
        notes, state = paths(store)
        row = registration(state, notes)
        if not row or row.get("error") or not row.get("generation"):
            return []
        stamp, files = snapshot(notes)
        if not files:
            return []
        if row.get("stamp") != stamp:
            row = refresh(notes, state, purpose="search")
        if row.get("stamp") != stamp:
            return []
        clauses = [f'script_ngrams:"{term}"' for term in chinese] + [f'"{word}"' for word in words]
        sql = """SELECT file_path, script_ngrams, content_snippet, rank FROM search_index
                 WHERE search_index MATCH ? AND type='entity'
                   AND project_id=?
                 ORDER BY rank, file_path LIMIT 20"""
        def read(current):
            with closing(open_index(state, current)) as db:
                scope = project_id(db, current["project"], notes)
                return db.execute(sql, (" OR ".join(clauses), scope)).fetchall()

        try:
            rows = read(row)
        except (ValueError, sqlite3.Error):
            row = refresh(notes, state, purpose="search", force=True)
            if row.get("stamp") != stamp:
                return []
            rows = read(row)
        matches = []
        for file, grams, snippet, rank in rows:
            file = note_key(notes, file)
            if file not in files:
                continue
            hits = (set(chinese) & set((grams or "").split())) | (set(words) & set(WORDS.findall((snippet or "").lower())))
            if len(hits) < min(2, len(chinese) + len(words)):
                continue
            path = Path(file)
            matches.append(dict(task=path.parent.name, id=path.stem, version=files[file],
                                reason="Basic Memory 本地全文匹配：" + "、".join(sorted(hits)[:5]), score=-rank))
        return matches
    except ERRORS:
        return []
