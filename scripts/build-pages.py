"""Prepare the existing static site; never change application code or preferences."""
import os
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ("style.css", "app.js", "version.js", "favicon.svg")


def build(destination: Path, revision: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise ValueError("GITHUB_SHA must be a full Git commit identifier")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for asset in ("style.css", "app.js", "favicon.svg"):
        # Works with both unversioned source URLs and older manual version strings.
        pattern = r'(["\'])' + re.escape(asset) + r'(?:\?[^"\']*)?\1'
        html, count = re.subn(pattern, lambda m: f'{m[1]}{asset}?v={revision}{m[1]}', html)
        if count != 1:
            raise ValueError(f"Expected exactly one reference to {asset}; found {count}")
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "index.html").write_text(html, encoding="utf-8")
    for asset in ASSETS:
        shutil.copyfile(ROOT / asset, destination / asset)
    (destination / ".nojekyll").touch()


if __name__ == "__main__":
    build(ROOT / "_site", os.environ["GITHUB_SHA"])
