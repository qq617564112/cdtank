"""Submit image edits to the configured image server."""
import getpass
import json
import os
from pathlib import Path
import subprocess

DEFAULT_BASE_URL = 'http://192.168.10.140:13999'
MODEL = 'gpt-image-2.5-sunburst'
REQUEST_TIMEOUT = 1300


def auth_key():
    return os.environ.get('CHATGPT2API_KEY') or getpass.getpass('Image API key: ')


def edit(base_url, key, prompt, image):
    result = subprocess.run(
        ['curl', '--silent', '--show-error', '--max-time', str(REQUEST_TIMEOUT),
         base_url.rstrip('/') + '/v1/images/edits',
         '--header', '@-', '--form-string', 'model=' + MODEL,
         '--form', 'image=@' + str(Path(image).resolve()),
         '--form-string', 'prompt=' + prompt,
         '--form-string', 'n=1', '--form-string', 'response_format=url',
         '--write-out', '\n%{http_code}'],
        input=('Authorization: Bearer ' + key + '\n').encode(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=REQUEST_TIMEOUT + 10)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace').strip())
    raw, status = result.stdout.rsplit(b'\n', 1)
    status = int(status)
    if not 200 <= status < 300:
        raise RuntimeError(f'HTTP {status}: {raw[:600].decode(errors="replace")}')
    payload = json.loads(raw)
    if not payload.get('data') or not payload['data'][0].get('url'):
        raise ValueError('The image API returned no data[0].url')
    return status, payload
