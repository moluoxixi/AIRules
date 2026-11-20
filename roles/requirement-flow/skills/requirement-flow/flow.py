#!/usr/bin/env python3
"""在项目内创建、查阅、推进和归档需求。"""
import argparse
from contextlib import contextmanager, ExitStack
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import unicodedata

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent / "runtime"))
import sync as engine
from lesson_retirement import decision_file, read_retirement
from task_locations import legacy_lock_only, lock_path, remove_legacy_lock_directory


def identifier(value):
    value = unicodedata.normalize("NFC", value)
    if (not value or not value[0].isalnum() or len(value.encode("utf-8")) > 255
            or any(not c.isalnum() and c not in "_-" for c in value)):
        raise argparse.ArgumentTypeError("需求 ID 可用汉字、字母、数字、连字符和下划线，首位须为文字或数字。")

    if re.fullmatch(r"CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]", value, re.IGNORECASE):
        raise argparse.ArgumentTypeError("需求 ID 不能使用操作系统保留名称")
    return value


def project_root(explicit):
    if explicit is not None:
        path = explicit.expanduser().resolve()
        if not path.is_dir():
            raise ValueError(f"项目目录不存在：{path}")
        return path
    current = Path.cwd().resolve()
    for candidate in (current, *current.parents):
        if ((candidate / ".requirements").exists() or (candidate / ".git").exists()
                or (candidate / ".agents/skills/requirement-flow").is_dir()):
            return candidate
    return current


def local_directory(path, *, create=False):
    if engine.evidence.linked(path):
        raise ValueError(f"需求存储目录不能使用符号链接：{path}")
    if create:
        path.mkdir(exist_ok=True)
    if path.exists() and not path.is_dir():
        raise ValueError(f"需求存储路径不是目录：{path}")
    return path


@contextmanager
def windows_lock(stream, exclusive, nonblocking):
    import ctypes
    from ctypes import wintypes as wt
    import msvcrt

    class Overlapped(ctypes.Structure):
        _fields_ = [("internal", ctypes.c_size_t), ("internal_high", ctypes.c_size_t),
                    ("offset", wt.DWORD), ("offset_high", wt.DWORD), ("event", wt.HANDLE)]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    pointer = ctypes.POINTER(Overlapped)
    kernel.LockFileEx.argtypes = [wt.HANDLE, wt.DWORD, wt.DWORD, wt.DWORD, wt.DWORD, pointer]
    kernel.LockFileEx.restype = wt.BOOL
    kernel.UnlockFileEx.argtypes = [wt.HANDLE, wt.DWORD, wt.DWORD, wt.DWORD, pointer]
    kernel.UnlockFileEx.restype = wt.BOOL
    position = ctypes.byref(Overlapped())
    handle = msvcrt.get_osfhandle(stream.fileno())
    # LockFileEx on a synchronous handle blocks by default and allows shared readers.
    flags = (2 if exclusive else 0) | (1 if nonblocking else 0)
    if not kernel.LockFileEx(handle, flags, 0, 1, 0, position):
        error = ctypes.get_last_error()
        if nonblocking and error == 33:  # ERROR_LOCK_VIOLATION
            raise BlockingIOError(error, "lock occupied")
        raise ctypes.WinError(error)
    try:
        yield
    finally:
        if not kernel.UnlockFileEx(handle, 0, 1, 0, position):
            raise ctypes.WinError(ctypes.get_last_error())


@contextmanager
def project_lock(store, key=None, *, exclusive=False, nonblocking=False):
    path = lock_path(store, key)
    with path.open("a+b") as stream:
        if os.name == "nt":
            with windows_lock(stream, exclusive, nonblocking):
                yield
        else:
            import fcntl
            operation = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
            fcntl.flock(stream.fileno(), operation | (fcntl.LOCK_NB if nonblocking else 0))
            try:
                yield
            finally:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def locations(store, key):
    return [local_directory(local_directory(store / bucket) / key) for bucket in ("active", "archive")]


def existing(paths, key):
    found = [path for path in paths if path.is_dir() and not legacy_lock_only(path)]
    if not found:
        raise ValueError(f"需求不存在：{key}")
    if len(found) != 1:
        raise ValueError(f"需求 ID 在进行中和归档目录重复：{key}")
    path = found[0]
    for name in ("model.json", "handbook.html", ".workflow.lock"):
        if engine.evidence.linked(path / name):
            raise ValueError(f"需求数据不能使用符号链接：{path / name}")
    if not (path / "model.json").is_file():
        raise ValueError(f"缺少可读取的需求模型：{key}")
    return path


def task_report(path, *, include_lessons=False):
    model = engine.load(path / "model.json")
    engine.validate(model)
    work = model["work"]
    if work["id"] != unicodedata.normalize("NFC", path.name):
        raise ValueError(f"需求 ID 与目录不一致：{work['id']} / {path.name}")
    return work, engine.dispatch(work, workspace=path, include_lessons=include_lessons)


def summary(path, *, include_lessons=False):
    work, queue = task_report(path, include_lessons=include_lessons)
    return {
        "id": work["id"], "title": work["title"], "outcome": work.get("outcome", "delivery"),
        "revision": work["revision"], "state": queue["state"], "progress": queue["progress"],
        "next": queue["next"]["id"] if queue["next"] else None, "running": queue["running"],
        "pending_decisions": [item["id"] for item in queue["pending_decisions"]],
        "handbook": str(path / "handbook.html"),
        **({"related_lessons": queue["related_lessons"]} if include_lessons else {}),
    }


def emit(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def list_lessons(store, include_all):
    with project_lock(store):
        cards = engine.knowledge.project_cards(store, engine)
        emit({"lessons":[c for c in cards if include_all or c["state"] == "approved"]})


def memory_command(store, operation):
    memory = engine.knowledge.basic_memory
    if operation == "status":
        return memory.status(store)
    cards = engine.knowledge.project_cards(store, engine)
    if operation == "enable" or (operation == "sync" and memory.status(store)["enabled"]):
        return memory.enable(store, cards)
    return memory.project(store, cards)


def refresh_notes(store):
    # The review ledger is authoritative. A failed derivative can always be rebuilt with memory sync.
    try:
        return memory_command(store, "project")
    except (OSError, ValueError, RuntimeError) as error:
        print(f"经验记录已保存，笔记需要运行 memory sync 重建：{error}", file=sys.stderr)
        return {"state": "needs_sync", "reason": str(error)}


def retire_lesson(store, args):
    if args.version < 1 or not args.actor.strip() or not args.why.strip():
        raise ValueError("请填写经验版本、决定人及退役理由")
    with project_lock(store, exclusive=True):
        existing(locations(store, args.task), args.task)
        prior = read_retirement(store, args.task, args.lesson, args.version)
        if prior:
            if prior["actor"] == args.actor and prior["reason"] == args.why:
                refresh_notes(store)
                emit(prior)
                return
            raise ValueError("本版本已有退役决定，请查看原决定")
        card = next((row for row in engine.knowledge.project_cards(store, engine)
                     if (row["task"],row["id"],row["version"]) == (args.task,args.lesson,args.version)), None)
        if not card or card["state"] not in ("approved", "stale") or (card["review"] or {}).get("verdict") != "approve":
            raise ValueError("请核对经验 ID、已批准版本和当前状态")
        record = {"task":args.task,"id":args.lesson,"version":args.version,"actor":args.actor,"reason":args.why,
                  "at":datetime.now(timezone.utc).isoformat(timespec="seconds")}
        target = decision_file(store,args.task,args.lesson,args.version,create=True)
        engine.atomic(target,engine.encoded(record))
        refresh_notes(store)
        emit(record)


def inventory(store, reader):
    local_directory(store)
    result = {"active":[], "archive":[]}
    if store.exists():
        with project_lock(store):
            for bucket, entries in result.items():
                try:
                    folder = local_directory(store / bucket)
                    paths = sorted(folder.iterdir()) if folder.exists() else []
                except (ValueError, OSError) as error:
                    entries.append({"id":bucket, "error":str(error)})
                    continue
                for path in paths:
                    if path.name.startswith(".") or not (path.is_dir() or path.is_symlink()):
                        continue
                    try:
                        if legacy_lock_only(path):
                            continue
                        entries.append(reader(existing(locations(store, identifier(path.name)), path.name)))
                    except (ValueError, OSError, KeyError, TypeError, AttributeError, IndexError, RecursionError, argparse.ArgumentTypeError) as error:
                        entries.append({"id":path.name, "error":str(error)})
    return result


@contextmanager
def catalog_task(store, name):
    try:
        key = identifier(name)
    except argparse.ArgumentTypeError as error:
        raise ValueError("无效的需求 ID") from error
    with ExitStack() as lease:
        with project_lock(store):
            local_directory(store)
            path = existing(locations(store, key), key)
            lease.enter_context(project_lock(store, key))
        yield key, path


def serve_catalog(store, args, *, root_task=None):
    import catalog_server
    with project_lock(store, ".project-viewer"):
        default_task = root_task or args.default_task
        if default_task:
            with catalog_task(store, default_task):
                pass
        cache = catalog_server.CardReader(task_report)
        catalog_server.serve(store.parent, args.port, args.source_root, default_task, task_at_root=bool(root_task),
                            inventory=lambda: inventory(store, cache),
                            open_task=lambda name: catalog_task(store, name))


def create(store, args):
    if not args.request.strip():
        raise ValueError("请提供需求原话")
    local_directory(store, create=True)
    with project_lock(store, exclusive=True):
        active, archive = locations(store, args.id)
        if any(path.exists() and not legacy_lock_only(path) for path in (active, archive)):
            raise ValueError(f"需求 ID 已使用：{args.id}")
        remove_legacy_lock_directory(active)
        local_directory(active.parent, create=True)
        engine.initialize_task(active, args.request, key=args.id, title=args.title, outcome=args.outcome)
        emit(summary(active, include_lessons=True))


def upgrade(project, migrate=False):
    from install_project import MANIFEST, install_locked, project_lock as installation_lock, safe_path

    store = local_directory(project / ".requirements")
    with installation_lock(project), project_lock(store, exclusive=True), ExitStack() as locks:
        if not safe_path(project, MANIFEST).is_file():
            raise ValueError("尚未安装 requirement-flow，请先运行 init。")
        locks.enter_context(project_lock(store, ".project-viewer", exclusive=True, nonblocking=True))
        tasks = []
        active = local_directory(store / "active")
        for folder in sorted(active.iterdir()) if active.exists() else ():
            if folder.name.startswith(".") or not (folder.is_dir() or engine.evidence.linked(folder)):
                continue
            if legacy_lock_only(folder):
                continue
            key = identifier(folder.name)
            path = existing(locations(store, key), key)
            # A running server holds a task lease and would keep writing with its old renderer.
            locks.enter_context(project_lock(store, key, exclusive=True, nonblocking=True))
            engine.bind_workspace(path)
            locks.enter_context(engine.task_lock())
            model = engine.load()
            engine.validate(model)
            if model["work"]["id"] != key:
                raise ValueError(f"需求 ID 与目录不一致：{key}")
            tasks.append((path, model))
        refreshed = []
        def render_pages():
            # Installed files (including AGENTS.md and ignore rules) are now final;
            # the installer still holds its undo stack if any render/write fails.
            for path, model in tasks:
                book = path / "handbook.html"
                rendered = engine.render(model, workspace=path).encode()
                if not book.exists() or book.read_bytes() != rendered:
                    yield book.relative_to(project), rendered
                    refreshed.append(path.name)
        result = install_locked(project, migrate, after_apply=render_pages)
        result["refreshed"] = refreshed
        result["memory"] = refresh_notes(store)
        return result


class SnapshotHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.checksums = []
        self.payloads = []
        self.reading_payload = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "meta" and values.get("name") == "model-sha256":
            self.checksums.append(values.get("content"))
        if tag == "script" and values.get("id") == "data" and values.get("type") == "application/json":
            self.reading_payload = True
            self.payloads.append("")

    def handle_endtag(self, tag):
        if tag == "script":
            self.reading_payload = False

    def handle_data(self, content):
        if self.reading_payload:
            self.payloads[-1] += content


def check_snapshot(path, *, refresh_scenarios=False):
    model = engine.load(path / "model.json")
    if model["work"]["id"] != unicodedata.normalize("NFC", path.name):
        raise ValueError("归档模型与需求目录的 ID 不一致。")
    page = SnapshotHTML()
    page.feed((path / "handbook.html").read_text(encoding="utf-8"))
    page.close()
    if len(page.payloads) != 1 or len(page.checksums) != 1:
        raise ValueError("归档人读页缺少唯一的嵌入模型或 model-sha256 标记。")
    snapshot = json.loads(page.payloads[0], object_pairs_hook=engine.unique)
    checksum = engine.digest(model)
    if checksum != engine.digest(snapshot["model"]) or checksum != page.checksums[0]:
        raise ValueError("归档人读页的嵌入模型或摘要与 model.json 不一致。")
    saved_queue = snapshot.get("queue", {})
    if "lesson_version" in snapshot and snapshot["lesson_version"] != engine.graph_view.lesson_version(saved_queue):
        raise ValueError("归档人读页的经验记录与摘要不一致。")
    saved_cases = saved_queue.get("scenarios")
    if saved_cases is not None or refresh_scenarios:
        live_queue = engine.dispatch(model["work"], workspace=path, include_lessons=refresh_scenarios, for_map=True)
        live_cases = live_queue["scenarios"]
        saved_states = {case["id"]: case["status"] for case in saved_cases or []}
        live_states = {case["id"]: case["status"] for case in live_cases}
        lessons_changed = refresh_scenarios and snapshot.get("lesson_version") != engine.graph_view.lesson_version(live_queue)
        if saved_cases is None or saved_states != live_states or lessons_changed:
            if not refresh_scenarios:
                changed = sorted(key for key in saved_states.keys() | live_states.keys()
                                 if saved_states.get(key) != live_states.get(key))
                raise ValueError("验收场景与归档快照不一致，请核对凭据：" + "、".join(changed))
            # Only the active copy can be refreshed, while the archive operation holds its lock.
            engine.bind_workspace(path)
            engine.sync()
    return model["work"]["revision"]


def archive(store, args):
    if not store.exists():
        raise ValueError(f"需求不存在：{args.id}")
    with project_lock(store, exclusive=True):
        active, target = locations(store, args.id)
        source = existing([active, target], args.id)
        if source == target:
            emit(summary(target))
            return
        with project_lock(store, args.id, exclusive=True, nonblocking=True):
            info = summary(source)
            if info["state"] != "complete" and not args.allow_incomplete:
                raise ValueError(f"需求 {args.id} 当前状态为 {info['state']}。如需保留当前进度并归档，请使用 --allow-incomplete。")
            own_cards = engine.load(source / "model.json")["work"].get("lesson_cards", {})
            pending = [key for key, card in own_cards.items() if card["state"] == "pending"]
            if pending and not args.allow_incomplete:
                raise ValueError("归档会冻结待审经验 " + "、".join(pending)
                                 + "。请先完成审查；如需按当前状态保存草稿，使用 --allow-incomplete。")
            check_snapshot(source, refresh_scenarios=True)
            local_directory(target.parent, create=True)
            remove_legacy_lock_directory(target)
            source.rename(target)
            if own_cards:
                refresh_notes(store)
            info["handbook"] = str(target / "handbook.html")
            emit(info)


def forward(store, args):
    if not store.exists():
        raise ValueError(f"需求不存在：{args.id}")
    with ExitStack() as handle:
        # Selecting and adopting a published version must serialize with replacement and retirement.
        knowledge_write = args.arguments[:1] in (["lesson-review"], ["lesson-adopt"])
        if knowledge_write:
            handle.enter_context(project_lock(store, exclusive=True))
        with ExitStack() as lookup:
            if not knowledge_write:
                lookup.enter_context(project_lock(store))
            active, archived = locations(store, args.id)
            path = existing([active, archived], args.id)
            handle.enter_context(project_lock(store, args.id))
        words = args.arguments
        if words and words[0].startswith("-") and words not in (["--check"], ["--help"], ["-h"]):
            raise ValueError("请在 task ID 后直接指定动作，或使用 --check 检查该需求。")
        if path == archived and (not words or words[0] not in {"--check", "context", "next", "-h", "--help"}):
            raise ValueError("需求已归档，可通过 context、next、--check 和人读页查阅。")
        if path == archived and words == ["--check"]:
            print(f"归档快照一致 · v{check_snapshot(path)}")
            return
        if words and words[0] == "new":
            raise ValueError("创建独立需求请使用项目命令 new。")
        engine.bind_workspace(path)
        engine.main(words, serve_project=lambda options: serve_catalog(store, options, root_task=args.id))
        if words[:1] == ["lesson-review"]:
            refresh_notes(store)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project", type=Path, help="目标项目根目录。默认从当前目录查找。")
    commands = p.add_subparsers(dest="command", required=True)
    new = commands.add_parser("new", help="按原话创建需求")
    new.add_argument("id", type=identifier)
    new.add_argument("--request", required=True)
    new.add_argument("--title")
    new.add_argument("--outcome", choices=("delivery","research"), default="delivery")
    init = commands.add_parser("init", help="接入当前项目，迁移时归档旧流程入口")
    init.add_argument("--migrate", action="store_true", help="迁移已有项目编排配置")
    commands.add_parser("upgrade", help="从此版本升级项目技能并刷新进行中需求图，保留历史归档")
    commands.add_parser("list", help="查看项目的进行中与已归档需求")
    viewer = commands.add_parser("serve", help="在本地查看项目内的全部需求")
    viewer.add_argument("--port", type=int, default=0, help="本机端口，默认自动分配")
    viewer.add_argument("--source-root", type=Path, help="定位来源文件的本项目工作树")
    viewer.add_argument("--default-task", type=identifier, help="旧图链接指向的需求 ID")
    memory = commands.add_parser("memory", help="管理当前项目的 Basic Memory 经验笔记与本地索引")
    memory.add_argument("operation", choices=("enable", "sync", "status"))
    lessons = commands.add_parser("lessons", help="查看本项目经审查且依据仍有效的经验")
    lessons.add_argument("--all", action="store_true", help="同时列出待审、退役及需要重新核验的经验")
    retire = commands.add_parser("lesson-retire", help="在项目经验库退役一个已批准版本，可用于归档需求")
    retire.add_argument("task", type=identifier)
    retire.add_argument("lesson", type=identifier)
    retire.add_argument("--version", required=True, type=int)
    retire.add_argument("--actor", required=True)
    retire.add_argument("--why", required=True)
    arch = commands.add_parser("archive", help="保留当前模型和人读页并归档")
    arch.add_argument("id", type=identifier)
    arch.add_argument("--allow-incomplete", action="store_true", help="按当前未完成状态归档")
    task = commands.add_parser("task", help="执行指定需求的编排命令")
    task.add_argument("id", type=identifier)
    task.add_argument("arguments", nargs=argparse.REMAINDER)
    args = p.parse_args()
    project = project_root(args.project)
    if args.command in ("init", "upgrade"):
        from install_project import MANIFEST, install
        if args.command == "upgrade" or (project / MANIFEST).exists():
            result = upgrade(project, getattr(args, "migrate", False))
        else:
            result = install(project, migrate=args.migrate)
        emit(result)
        return
    store = local_directory(project / ".requirements")
    if args.command == "list":
        emit(inventory(store, summary))
    elif args.command == "serve":
        serve_catalog(store, args)
    elif args.command == "memory":
        with project_lock(store, exclusive=args.operation != "status"):
            result = memory_command(store, args.operation)
            emit(result)
            requested_index = args.operation == "enable" or (args.operation == "sync" and "ready" in result)
            if requested_index and not result.get("ready"):
                raise SystemExit(result.get("error") or "Basic Memory 索引未就绪，请查看 memory status 后重试。")
    elif args.command == "lessons":
        list_lessons(store,args.all)
    elif args.command == "lesson-retire":
        retire_lesson(store,args)
    elif args.command == "new":
        create(store, args)
    elif args.command == "archive":
        archive(store, args)
    else:
        forward(store, args)


if __name__ == "__main__":
    try:
        main()
    except BlockingIOError:
        sys.exit("需求正在使用，请先结束核验服务或等待当前操作结束。")
    except (OSError, ValueError, KeyError, TypeError, argparse.ArgumentTypeError) as error:
        sys.exit(str(error))
