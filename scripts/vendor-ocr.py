#!/usr/bin/env python3
"""Закреплённые браузерные файлы OCR; изображения обрабатываются локально."""
from pathlib import Path
import hashlib
import io
import json
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'vendor'
ROOT.mkdir(parents=True, exist_ok=True)
files = {}

def fetch(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()

def save(name, data, source):
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    files[name] = {'sha256': hashlib.sha256(data).hexdigest(), 'source': source}
    print(f'{name}: {len(data)} bytes', flush=True)

for package, version in [('tesseract.js', '6.0.1'), ('tesseract.js-core', '6.0.0')]:
    url = f'https://registry.npmjs.org/{package}/-/{package}-{version}.tgz'
    with tarfile.open(fileobj=io.BytesIO(fetch(url)), mode='r:gz') as archive:
        for member in archive.getmembers():
            name = Path(member.name).name
            wanted = (package == 'tesseract.js' and (name in ['tesseract.min.js', 'worker.min.js'] or 'LICENSE' in name)) or (package == 'tesseract.js-core' and (name.endswith('.wasm.js') or name.endswith('.wasm') or 'LICENSE' in name))
            if wanted and member.isfile():
                prefix = 'core/' if package.endswith('core') else ''
                data = archive.extractfile(member).read()
                if name == 'tesseract.min.js':
                    # Локальные изменения 2026-11-26: ошибки init отклоняют promise;
                    # onWorker предоставляет native handle для отмены до завершения init.
                    patches = {
                        '.catch((function(){})),t.abrupt("return",F)': '.catch((function(t){null!==D&&(L(D),D=null),G(t)})),t.abrupt("return",F)',
                        '(D=w(P)).onerror=R,S+=1': '(D=w(P)).onerror=R,P.onWorker&&P.onWorker(D),S+=1',
                    }
                    text = data.decode()
                    for old, new in patches.items():
                        if text.count(old) != 1:
                            raise RuntimeError('Upstream OCR changed; review the patch before vendoring.')
                        text = text.replace(old, new)
                    data = ('/* Rust Util local changes 2026-11-26: initialization rejection/cleanup and onWorker hook. Apache-2.0. */\n' + text).encode()
                save(prefix + name, data, url)
url = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz'
save('lang/eng.traineddata.gz', fetch(url), url)
(ROOT / 'manifest.json').write_text(json.dumps(files, indent=2) + '\n')
