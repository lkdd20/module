#!/usr/bin/env python3
"""Mirror Nullwhy's NodeSeek integration while keeping two accounts isolated."""
from pathlib import Path
from urllib.request import Request, urlopen
import json
import os

ROOT = Path(__file__).resolve().parents[2]
UPSTREAM = "https://raw.githubusercontent.com/Nullwhy/Egern/main/"
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "lkdd20/module")
RAW = f"https://raw.githubusercontent.com/{REPOSITORY}/main/"


def fetch(path):
    request = Request(UPSTREAM + path, headers={"User-Agent": "NodeSeek-module-sync"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise RuntimeError(f"Upstream format changed; inspect before replacing {old!r}")
    return text.replace(old, new, 1)


def main():
    module = fetch("Rewrite/NodeSeek.module")
    script = fetch("Scripts/NodeSeek.js")
    original_url = UPSTREAM + "Scripts/NodeSeek.js"
    if module.count(original_url) != 2:
        raise RuntimeError("Upstream module changed: expected capture and schedule script URLs")
    # Account 1 keeps the upstream key, preserving cookies already captured locally.
    key = 'const STORE_KEY = "nodeseek_headers";'
    if script.count(key) != 1:
        raise RuntimeError("Upstream storage changed; do not overwrite working integrations")
    script2 = replace_once(script, key, 'const STORE_KEY = "nodeseek_headers_2";')
    script2 = replace_once(script2, 'const SCRIPT_NAME = "NodeSeek🎉";',
                           'const SCRIPT_NAME = "NodeSeek账号2🎉";')
    module1 = module.replace(original_url, RAW + "Scripts/NodeSeek.js")
    module2 = module.replace(original_url, RAW + "Scripts/NodeSeek2.js")
    module2 = replace_once(module2, 'name: "NodeSeek"', 'name: "NodeSeek账号2"')
    module2 = replace_once(module2, 'name: "NodeSeek Cookie"', 'name: "NodeSeek账号2 Cookie"')
    module2 = replace_once(module2, 'name: "NodeSeek 签到"', 'name: "NodeSeek账号2 签到"')
    module2 = replace_once(module2, 'MINUTE: "00"', 'MINUTE: "05"')
    outputs = {
        "NodeSeek.module": module1,
        "NodeSeek2.module": module2,
        "Scripts/NodeSeek.js": script,
        "Scripts/NodeSeek2.js": script2,
    }
    # Resolve and validate every transformation before replacing any generated file.
    for path, content in outputs.items():
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    print(json.dumps({"upstream": "Nullwhy/Egern", "files": list(outputs)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
