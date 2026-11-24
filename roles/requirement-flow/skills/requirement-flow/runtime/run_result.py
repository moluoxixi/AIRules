"""Read standard test-runner summaries without changing the executed command."""
import codecs
import ntpath
import re


# Advance when summary interpretation changes. Private raw logs cannot be
# reconstructed later, so acceptance must distinguish their collection policy.
SUMMARY_POLICY = "runner-summary-v3"
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
UNITTEST = re.compile(r"^Ran (\d+) tests? in [\d.]+s[ \t\r]*\n\s*(OK|FAILED)(?: \(([^)]+)\))?[ \t\r]*$", re.M)
TESTS_LINE = re.compile(r"^\s*Tests\s*:?\s+([^\n]+)$", re.M)
SUITES_LINE = re.compile(r"^\s*Test (?:Files|Suites)\s*:?\s+([^\n]+)$")
# Empty or numeric bodies identify incomplete headers; prose such as
# "Test Suites: selection of ..." remains an ordinary diagnostic.
PARTIAL_JS = re.compile(r"^\s*(?:Tests|Test (?:Files|Suites))(?:(?:\s*:\s*|\s+)[+-]?\d.*|\s*:?\s*)$")
PARTIAL_RAN = re.compile(r"^Ran ([+-]?\d+) tests?(?: in\b.*)?$")
PARTIAL_NODE = re.compile(r"^[#ℹ]\s+tests(?:\s+[+-]?\d.*|\s*)$")
COUNTS = re.compile(r"(\d+)\s+(passed|failed|errors?|skipped|todo|pending|xfailed|deselected)\b", re.I)
PYTEST_WARNINGS = re.compile(r"(\d+)\s+(warnings?)\b", re.I)
PYTEST_XPASSED = re.compile(r"(\d+)\s+(xpassed)\b", re.I)
PYTEST = re.compile(r"^=*\s*((?:\d+ [a-z]+(?:,\s*|\s+))+|no tests ran\s+)in [\d.]+s\s*=*\s*$", re.M | re.I)
NODE = re.compile(r"^([#ℹ])\s+(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\s+(\d+(?:\.\d+)?)\s*$")
RAN = re.compile(r"^Ran (\d+) tests? in ([\d.]+)s\s*$")
VERDICT = re.compile(r"^(OK|FAILED)(?: \(([^)]+)\))?\s*$")
UNIT_COUNTS = re.compile(r"(failures|errors|skipped|expected failures|unexpected successes)=(\d+)")
UNIT_DETAILS = re.compile(rf"{UNIT_COUNTS.pattern}(?:,\s*{UNIT_COUNTS.pattern})*")


def count_summary(summary, runner):
    summary = summary.strip()
    matches = list(COUNTS.finditer(summary))
    if runner == "pytest":
        # Warnings are metadata; non-strict XPASS counts an executed assertion.
        # Strict XPASS is still vetoed by pytest's failure count / command exit.
        matches = sorted(matches + list(PYTEST_WARNINGS.finditer(summary)) +
                         list(PYTEST_XPASSED.finditer(summary)), key=lambda match: match.start())
    counts = {}
    invalid = False
    end = 0
    for match in matches:
        number, kind = match.groups()
        kind = kind.lower()
        gap = summary[end:match.start()]
        invalid |= not (gap.isspace() or gap.strip() in (",", "|")) if end else bool(gap)
        invalid |= kind in counts
        counts[kind] = counts.get(kind, 0) + int(number)
        end = match.end()
    total = sum(n for kind, n in counts.items() if kind not in ("warning", "warnings"))
    if not counts:
        invalid = not bool(re.fullmatch(r"0 total|no tests ran", summary, re.I))
        return {"runner": runner, "total": 0, "skipped": 0, **({"invalid": True} if invalid else {})}
    # Every character must belong to a count, separator or single declared total.
    declared = re.fullmatch(r"(?:,\s*(\d+)\s+total|\((\d+)\))?", summary[end:].strip())
    invalid |= declared is None
    if declared and (declared[1] or declared[2]):
        invalid |= int(declared[1] or declared[2]) != total
    return {"runner": runner, "total": total,
            "skipped": sum(counts.get(k, 0) for k in ("skipped", "todo", "pending", "deselected")),
            "expected_failures": counts.get("xfailed", 0),
            "failed": sum(counts.get(k, 0) for k in ("failed", "error", "errors")),
            **({"invalid": True} if invalid else {})}


def test_summary(raw):
    """Scan the whole log, retaining only recognized summary blocks, never diagnostics."""
    raw.seek(0)
    blocks = []
    node = None
    ran = None
    scan_incomplete = False

    def finish_node():
        nonlocal node
        if node is None:
            return
        counts = node[1]
        required = {"tests", "pass", "fail", "skipped", "todo"}
        invalid = node[2] or not required <= counts.keys()
        invalid |= counts.get("tests", 0) != sum(counts.get(k, 0) for k in
                                                  ("pass", "fail", "cancelled", "skipped", "todo"))
        blocks.append({"runner": "node:test", "total": counts["tests"],
                       "skipped": counts.get("skipped", 0) + counts.get("todo", 0),
                       "failed": counts.get("fail", 0) + counts.get("cancelled", 0),
                       **({"invalid": True} if invalid else {})})
        node = None

    def finish_ran(verdict=None):
        nonlocal ran
        if ran is None:
            return
        counts = {}
        invalid = verdict is None or not ran[1] or ran[2]
        if verdict is not None:
            details = verdict[2] or ""
            invalid |= bool(details) and UNIT_DETAILS.fullmatch(details) is None
            for kind, number in UNIT_COUNTS.findall(details):
                invalid |= kind in counts
                counts[kind] = counts.get(kind, 0) + int(number)
            invalid |= verdict[1] == "OK" and any(k in counts for k in
                                                  ("failures", "errors", "unexpected successes"))
            invalid |= sum(counts.values()) > ran[0]
        failed = sum(counts.get(k, 0) for k in ("failures", "errors", "unexpected successes"))
        blocks.append({"runner": "unittest", "total": ran[0], "skipped": counts.get("skipped", 0),
                       "expected_failures": counts.get("expected failures", 0),
                       "failed": max(failed, int(verdict is not None and verdict[1] == "FAILED")),
                       **({"invalid": True} if invalid else {})})
        ran = None

    # readline's bound avoids retaining an arbitrarily large assertion body. If a
    # line is truncated, report that limitation rather than claiming full coverage.
    limit = 256 * 1024
    while True:
        line = raw.readline(limit + 1)
        if not line:
            break
        if len(line) > limit:
            scan_incomplete = True
            while line and not line.endswith(b"\n"):
                line = raw.readline(limit + 1)
            finish_node()
            finish_ran()
            continue
        text = ANSI.sub("", line.decode("utf-8", "replace")).strip("\r\n")
        if ran is not None:
            if not text.strip():
                ran[1] = True
                continue
            verdict = VERDICT.fullmatch(text.strip())
            if verdict:
                finish_ran(verdict)
                continue
            # Any nonblank interruption (including another runner/header) closes
            # this block as invalid before the new line is considered independently.
            finish_ran()
        match = NODE.fullmatch(text.strip())
        if node is not None and (not match or match[2] == "tests" or match[1] != node[0]):
            finish_node()
        if match:
            prefix, kind, number = match.groups()
            if kind == "tests":
                node = [prefix, {"tests": int(number.split(".")[0])}, "." in number]
            elif node is not None:
                node[2] |= kind in node[1] or (kind != "duration_ms" and "." in number)
                node[1][kind] = float(number) if kind == "duration_ms" else int(number.split(".")[0])
            continue
        start = RAN.fullmatch(text.strip())
        if start:
            ran = [int(start[1]), False, re.fullmatch(r"\d+(?:\.\d+)?", start[2]) is None]
            continue
        for pattern, runner in ((SUITES_LINE, "JavaScript"), (TESTS_LINE, "JavaScript"), (PYTEST, "pytest")):
            match = pattern.fullmatch(text)
            if match and (COUNTS.match(match[1].strip()) or match[1].lower().startswith("no tests ran")
                          or re.match(r"\d+ total\b", match[1].strip())
                          or (pattern is PYTEST and PYTEST_XPASSED.match(match[1].strip()))):
                block = count_summary(match[1], runner)
                if pattern is SUITES_LINE:
                    # File/suite failures veto the run independently; their counts
                    # are never test counts and their success cannot prove execution.
                    block = {"runner": runner, "total": 0, "skipped": 0, "failed": block.get("failed", 0),
                             "suite": True, **({"invalid": True} if block.get("invalid") else {})}
                blocks.append(block)
                break
        else:
            partial_ran = PARTIAL_RAN.fullmatch(text.strip())
            if PARTIAL_JS.fullmatch(text):
                blocks.append({"runner": "JavaScript", "total": 0, "skipped": 0, "invalid": True})
            elif partial_ran:
                blocks.append({"runner": "unittest", "total": max(0, int(partial_ran[1])), "skipped": 0, "invalid": True})
            elif PARTIAL_NODE.fullmatch(text.strip()):
                blocks.append({"runner": "node:test", "total": 0, "skipped": 0, "invalid": True})
            elif re.match(r"^(?:No test files found|No tests found)(?:\s|,|$)", text):
                blocks.append({"runner": "JavaScript", "total": 0, "skipped": 0})
    finish_node()
    finish_ran()
    if not blocks and not scan_incomplete:
        return None
    runners = list(dict.fromkeys(block["runner"] for block in blocks))
    result = {"runner": runners[0] if len(runners) == 1 else "mixed" if runners else "unknown",
              **{key: sum(block.get(key, 0) for block in blocks)
                 for key in ("total", "skipped", "expected_failures", "failed")
                 if key in ("total", "skipped") or any(key in block for block in blocks)}}
    if any(block.get("invalid") for block in blocks):
        result["invalid"] = True
    test_blocks = [block for block in blocks if not block.get("suite")]
    if len(test_blocks) > 1 and any(block["total"] <= block["skipped"] + block.get("expected_failures", 0)
                                    for block in test_blocks):
        result["insufficient"] = True
    if scan_incomplete:
        result["scan_incomplete"] = True
    if len(runners) > 1:
        result["runners"] = runners
    return result


def insufficient_tests(summary):
    if summary is None:
        return ""
    if summary.get("failed"):
        return "测试运行器报告失败，需要修复后重新验收。"
    if summary.get("scan_incomplete"):
        return "日志含超长行，摘要扫描已截断，不能确认全部运行结果，请重新验收。"
    if summary.get("invalid"):
        return "测试运行器摘要不完整或计数冲突，请重新验收。"
    if summary.get("insufficient") or summary["total"] <= summary["skipped"] + summary.get("expected_failures", 0):
        return "没有实际通过的测试，请检查发现规则、跳过条件和预期失败后重新验收。"
    return ""


# Only used when a caller explicitly opts into sharing raw parameters and output.
SENSITIVE = re.compile(
    r"""(?:^|\W)(?:[\w-]{1,48}[_-])?(?:(?:access|refresh|session|id|auth)?[_-]?token|"""
    r"""passwd|password|(?:client)?[_-]?secret|api[_-]?key|access[_-]?key|authorization|"""
    r"""cookie|credentials?|auth|private[_-]?key|session[_-]?id|x-(?:amz|goog)-signature)"""
    r"""(?:["']?\s*[:=]|\b(?=\s|$))|[?&]sig="""
    r"""|-----BEGIN [^-\n]*PRIVATE KEY-----|\b(?:bearer|basic)\s+[a-z0-9/+_.=-]{6,}"""
    r"""|https?://[^/\s@]+:[^/\s@]+@|\b(?:gh[pousr]_|github_pat_|sk-[a-z0-9_-]{8})"""
    r"""|\beyJ[a-z0-9_-]{6,}\.[a-z0-9_-]+\.[a-z0-9_-]+""",
    re.I,
)


def shareable_arguments(argv):
    if any(SENSITIVE.search(arg) for arg in argv):
        return False
    if any(arg in ("--user", "--proxy-user", "--netrc-file") or arg.startswith(("--user=", "--proxy-user="))
           for arg in argv):
        return False
    # curl accepts short options with attached operands; ntpath handles both path separator styles.
    if ntpath.basename(argv[0]).lower() in ("curl", "curl.exe"):
        if any(arg.startswith(("-u", "-b", "-U")) for arg in argv[1:]):
            return False
    return True


def can_share(argv, raw):
    if not shareable_arguments(argv):
        return False
    raw.seek(0)
    previous = ""
    decoder = codecs.getincrementaldecoder("utf-8")()
    while True:
        chunk = raw.read(65536)
        try:
            text = previous + decoder.decode(chunk, final=not chunk)
        except UnicodeDecodeError:
            # Binary output may contain credentials in an unsupported encoding.
            return False
        if "\0" in text or SENSITIVE.search(text):
            return False
        if not chunk:
            return True
        previous = text[-4096:]


def summary_text(code, has_output, tests):
    lines = [f"命令退出码 {code}"]
    if tests is not None:
        lines.append(f"{tests['runner']} 共 {tests['total']} 项，跳过 {tests['skipped']} 项。")
    if tests and tests.get("expected_failures"):
        lines.append(f"预期失败 {tests['expected_failures']} 项。")
    issue = insufficient_tests(tests)
    if issue:
        lines.append(issue)
    elif code != 0:
        lines.append("命令执行失败，需要修复后重新验收。")
    elif not has_output:
        lines.append("日志为空或仅含空白，请运行会输出断言结果的验证命令。")
    elif tests is None:
        lines.append("命令有输出，请在确认业务断言后完成场景验收。")
    return "\n".join(lines)
