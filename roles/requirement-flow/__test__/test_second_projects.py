"""Replay the retained cross-project snapshots; do not infer their historical process."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SNAPSHOT = Path(__file__).resolve().parent / "scenarios/results/second-projects.patch"


class SecondProjectsTest(unittest.TestCase):
    def setUp(self):
        if shutil.which("git") is None:
            self.skipTest("Git is needed to apply the retained project snapshot")
        temporary = tempfile.TemporaryDirectory(prefix="requirement-flow-second-projects-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        applied = subprocess.run(
            ["git", "apply", str(SNAPSHOT)], cwd=self.root,
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(applied.returncode, 0, applied.stderr)

    def python(self, project, *arguments, expected=0):
        result = subprocess.run(
            [sys.executable, "-B", *arguments], cwd=self.root / project,
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_export_heading_and_two_file_snapshot(self):
        self.python(
            "labels-check", "-c",
            "from exporter import heading; assert heading() == '每日对账汇总'; print(heading())",
        )
        files = sorted(path.name for path in (self.root / "labels-check").iterdir())
        self.assertEqual(files, ["README.md", "exporter.py"])

    def test_original_library_sqlite_tests(self):
        result = self.python("library", "-m", "unittest", "-v")
        self.assertIn("Ran 2 tests", result.stderr)

    def test_library_persistence_and_notification_fields_across_processes(self):
        database = self.root / "library/holds.sqlite"
        writer = """
from contextlib import closing
from datetime import date
import sys
from collection import desk_quote, open_db, reserve

arrival = date(2026, 2, 28)
assert desk_quote(arrival, 'regular') == date(2026, 3, 3)
assert desk_quote(arrival, 'pop-up') == date(2026, 3, 1)
with closing(open_db(sys.argv[1])) as db:
    db.execute('insert into holds values (?, ?)', ('existing', '2026-03-02'))
    db.commit()
    reserve(db, 'new', 'regular', arrival)
    reserve(db, 'temporary', 'pop-up', arrival)
"""
        self.python("library", "-c", writer, str(database))
        self.assertTrue(database.is_file())
        reader = """
from contextlib import closing
from datetime import date
import json
import sys
from collection import deadline_for, notification_payload, open_db

expected = {'new': '2026-03-03', 'temporary': '2026-03-01', 'existing': '2026-03-02'}
with closing(open_db(sys.argv[1])) as db:
    for member, deadline in expected.items():
        assert deadline_for(db, member) == date.fromisoformat(deadline)
        assert notification_payload(db, member) == {'member': member, 'collect_by': deadline}
    assert db.execute('select count(*) from holds').fetchone()[0] == 3
print(json.dumps(expected, sort_keys=True))
"""
        result = self.python("library", "-c", reader, str(database))
        self.assertEqual(json.loads(result.stdout), {
            "new": "2026-03-03", "temporary": "2026-03-01", "existing": "2026-03-02",
        })

    def test_popup_one_to_two_day_regression_is_detected_then_restored(self):
        implementation = self.root / "library/collection.py"
        original = implementation.read_bytes()
        before = b'days = 1 if counter == "pop-up" else 3'
        after = b'days = 2 if counter == "pop-up" else 3'
        self.assertEqual(original.count(before), 1, "The deliberate regression must change one branch")
        try:
            implementation.write_bytes(original.replace(before, after))
            failed = self.python("library", "-m", "unittest", "-v", expected=1)
            self.assertIn("FAIL: test_popup", failed.stderr)
            self.assertIn("FAIL: test_new_and_existing_holds_after_reopening", failed.stderr)
            self.assertIn("AssertionError", failed.stderr)
            self.python("library", "-c", """
from contextlib import closing
from datetime import date
from collection import deadline_for, desk_quote, notification_payload, open_db, reserve

arrival = date(2026, 2, 28)
assert desk_quote(arrival, 'pop-up') == date(2026, 3, 2)
with closing(open_db('regression.sqlite')) as db:
    reserve(db, 'temporary', 'pop-up', arrival)
with closing(open_db('regression.sqlite')) as db:
    assert deadline_for(db, 'temporary') == date(2026, 3, 2)
    assert notification_payload(db, 'temporary')['collect_by'] == '2026-03-02'
""")
        finally:
            implementation.write_bytes(original)
        self.python("library", "-m", "unittest", "-v")
        self.assertEqual(implementation.read_bytes(), original)

    def test_repairclub_station_and_owner_rejections_preserve_order(self):
        implementation = self.root / "repairclub/orders.py"
        original = implementation.read_bytes()
        self.python("repairclub", "-c", """
from orders import cancel, claim, file_order

def rejected(order, operation):
    before = dict(order)
    try:
        operation()
    except ValueError as error:
        assert str(error) == 'unavailable'
    else:
        raise AssertionError('Operation should have been rejected')
    assert order == before

order = file_order('resident-a', 'east')
assert order == {'owner': 'resident-a', 'depot': 'east', 'state': 'waiting'}
rejected(order, lambda: claim(order, 'west'))
rejected(order, lambda: cancel(order, 'resident-b'))
claim(order, 'east')
assert order['state'] == 'claimed'
rejected(order, lambda: cancel(order, 'resident-b'))
rejected(order, lambda: claim(order, 'east'))

waiting = file_order('resident-b', 'west')
cancel(waiting, 'resident-b')
assert waiting['state'] == 'cancelled'
rejected(waiting, lambda: claim(waiting, 'west'))
rejected(waiting, lambda: cancel(waiting, 'resident-b'))
""")
        self.assertEqual(implementation.read_bytes(), original)

    def test_repairclub_current_code_allows_owner_to_cancel_after_claim(self):
        # This characterizes the retained code, not approval of its policy discrepancy.
        implementation = self.root / "repairclub/orders.py"
        original = implementation.read_bytes()
        self.python("repairclub", "-c", """
from orders import cancel, claim, file_order

order = file_order('resident-a', 'east')
claim(order, 'east')
cancel(order, 'resident-a')
assert order == {'owner': 'resident-a', 'depot': 'east', 'state': 'cancelled'}
for operation in (lambda: cancel(order, 'resident-a'), lambda: claim(order, 'east')):
    before = dict(order)
    try:
        operation()
    except ValueError as error:
        assert str(error) == 'unavailable'
    else:
        raise AssertionError('Cancelled order must stay unavailable')
    assert order == before
""")
        self.assertEqual(implementation.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
