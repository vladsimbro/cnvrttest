import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_pages", ROOT / "scripts/build-pages.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PagesBuildTest(unittest.TestCase):
    def test_each_commit_changes_both_urls_without_changing_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            previous = None
            for revision in ("a" * 40, "b" * 40):
                module.build(output, revision)
                html = (output / "index.html").read_text()
                for asset in ("style.css", "app.js"):
                    self.assertIn(f'{asset}?v={revision}', html)
                    self.assertEqual((output / asset).read_bytes(), (ROOT / asset).read_bytes())
                self.assertNotEqual(previous, html)
                previous = html
            self.assertEqual(
                {p.name for p in output.iterdir()},
                {"index.html", ".nojekyll", *module.ASSETS},
            )

    def test_invalid_revision_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                module.build(Path(temp), "missing")


if __name__ == "__main__":
    unittest.main()
