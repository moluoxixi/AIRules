"""Project decisions that retire a particular published version, including archived sources."""
import json
from pathlib import Path
import unicodedata

if __package__:
    from .evidence import linked
else:
    from evidence import linked


def decision_file(store, task, card, version, *, create=False):
    def segment(value):
        return (isinstance(value, str) and value and value[0].isalnum()
                and all(c.isalnum() or c in "-_" for c in value))

    if not segment(task) or not segment(card) or type(version) is not int or version < 1:
        raise ValueError("退役记录引用了无效的需求、经验或版本")
    directory = Path(store)
    if directory.name != ".requirements" or linked(directory):
        raise ValueError("无效的项目经验目录")
    for name in ("knowledge", "retired", unicodedata.normalize("NFC", task), card):
        directory /= name
        if linked(directory) or (directory.exists() and not directory.is_dir()):
            raise ValueError(f"项目经验目录无效：{directory}")
        if create:
            directory.mkdir(exist_ok=True)
    path = directory / f"{version}.json"
    if linked(path) or (path.exists() and not path.is_file()):
        raise ValueError(f"退役记录必须是项目内的普通文件：{path}")
    return path


def read_retirement(store, task, card, version):
    path = decision_file(store, task, card, version)
    if not path.exists():
        return None
    record = json.loads(path.read_bytes())
    if (not isinstance(record, dict) or (record.get("task"), record.get("id"), record.get("version")) != (task, card, version)
            or not all(isinstance(record.get(k), str) and record[k].strip() for k in ("actor", "reason", "at"))):
        raise ValueError(f"项目经验退役记录损坏：{path}")
    return record
