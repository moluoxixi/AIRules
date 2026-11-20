"""Read standard test-runner summaries without changing the executed command."""
import codecs
import ntpath
import re


ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
UNITTEST = re.compile(r"^Ran (\d+) tests? in [\d.]+s[ \t\r]*\n\s*(OK|FAILED)(?: \(([^)]+)\))?[ \t\r]*$", re.M)
TESTS_LINE = re.compile(r"^\s*Tests\s*:?\s+([^\n]+)$", re.M)
COUNTS = re.compile(r"(\d+)\s+(passed|failed|errors?|skipped|todo|pending|xfailed|deselected)\b", re.I)
PYTEST = re.compile(r"^=*\s*((?:\d+ [a-z]+(?:,\s*|\s+))+|no tests ran\s+)in [\d.]+s\s*=*\s*$", re.M | re.I)
NODE = re.compile(r"^[#ℹ]\s+tests\s+(\d+)\s*$", re.M)


def test_summary(raw):
    """Runner names and counts are safe to include in a shareable receipt."""
    raw.seek(0, 2)
    end = raw.tell()
    # The large body may contain assertion diagnostics. The summary is at the end.
    raw.seek(max(0, end - 256 * 1024))
    text = ANSI.sub("", raw.read().decode("utf-8", "replace"))
    suites = list(UNITTEST.finditer(text))
    if suites:
        total = sum(int(match[1]) for match in suites)
        skipped = sum(int(count) for match in suites for count in re.findall(r"skipped=(\d+)", match[3] or ""))
        expected = sum(int(count) for match in suites for count in re.findall(r"expected failures=(\d+)", match[3] or ""))
        failed = sum(int(count) for match in suites for count in re.findall(
            r"(?:^|, )(?:failures|errors|unexpected successes)=(\d+)", match[3] or ""))
        if not failed and any(match[2] == "FAILED" for match in suites):
            failed = 1
        return {"runner": "unittest", "total": total, "skipped": skipped, "expected_failures": expected,
                "failed": failed}
    match = NODE.search(text)
    if match and re.search(r"^[#ℹ]\s+pass\s+\d+\s*$", text, re.M):
        skipped = sum(int(x) for x in re.findall(r"^[#ℹ]\s+(?:skipped|todo)\s+(\d+)\s*$", text, re.M))
        failure = re.search(r"^[#ℹ]\s+fail\s+(\d+)\s*$", text, re.M)
        return {"runner": "node:test", "total": int(match[1]), "skipped": skipped,
                "failed": int(failure[1]) if failure else 0}
    for pattern, runner in ((TESTS_LINE, "JavaScript"), (PYTEST, "pytest")):
        matches = list(pattern.finditer(text))
        if not matches:
            continue
        summary = matches[-1][1]
        counts = {kind.lower(): int(n) for n, kind in COUNTS.findall(summary)}
        if counts:
            total = sum(counts.values())
            skipped = sum(counts.get(k, 0) for k in ("skipped", "todo", "pending", "deselected"))
            return {"runner": runner, "total": total, "skipped": skipped, "expected_failures": counts.get("xfailed", 0),
                    "failed": sum(counts.get(k, 0) for k in ("failed", "error", "errors"))}
        if "no tests ran" in summary.lower() or re.search(r"\b0 total\b", summary):
            return {"runner": runner, "total": 0, "skipped": 0}
    if re.search(r"^(?:No test files found|No tests found)(?:\s|,|$)", text, re.M):
        return {"runner": "JavaScript", "total": 0, "skipped": 0}
    return None


def insufficient_tests(summary):
    if summary is None:
        return ""
    if summary.get("failed"):
        return "测试运行器报告失败，需要修复后重新验收。"
    if summary["total"] <= summary["skipped"] + summary.get("expected_failures", 0):
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


def can_share(argv, raw):
    if any(SENSITIVE.search(arg) for arg in argv):
        return False
    if any(arg in ("--user", "--proxy-user", "--netrc-file") or arg.startswith(("--user=", "--proxy-user="))
           for arg in argv):
        return False
    # curl accepts short options with attached operands; ntpath handles both path separator styles.
    if ntpath.basename(argv[0]).lower() in ("curl", "curl.exe"):
        if any(arg.startswith(("-u", "-b", "-U")) for arg in argv[1:]):
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
