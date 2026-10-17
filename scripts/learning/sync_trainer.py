"""Install committed Python training scripts on the GPU host without simulation assets."""

import argparse
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import time


def main(args):
    repository = Path(__file__).resolve().parents[2]
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repository, text=True).strip()
    destination = f"D:/ai/cdtank/data/trainer-{commit[:12]}.tar.gz"
    trainer = f"D:/ai/cdtank/trainer/versions/{commit[:12]}"
    source = subprocess.Popen(["git", "archive", commit, "scripts/learning", "docs/ai-learning.md"],
                              cwd=repository, stdout=subprocess.PIPE)
    receiver = subprocess.Popen(["ssh", "-o", "BatchMode=yes", args.host,
                                 f"C:/ProgramData/miniconda3/python.exe D:/ai/cdtank/src/receive.py {destination}"],
                                stdin=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=receiver.stdin, mode="w|gz") as archive:
            with tarfile.open(fileobj=source.stdout, mode="r|") as committed:
                for member in committed:
                    archive.addfile(member, committed.extractfile(member) if member.isfile() else None)
            if source.wait() != 0:
                raise RuntimeError("git archive failed")
            provenance = json.dumps({"commit": commit, "archivedAt": time.time(), "role": "GPU trainer"}).encode()
            metadata = tarfile.TarInfo("source.json")
            metadata.size = len(provenance)
            archive.addfile(metadata, io.BytesIO(provenance))
        receiver.stdin.close()
        if receiver.wait() != 0:
            raise RuntimeError("Trainer transfer failed")
        subprocess.run([sys.executable, str(Path(__file__).with_name("remote.py")), "-", "--host", args.host],
                       input=f"""New-Item -ItemType Directory -Force '{trainer}' | Out-Null
if (-not (Test-Path '{trainer}/source.json')) {{
  tar -xzf '{destination}' -C '{trainer}'
  if ($LASTEXITCODE -ne 0) {{ throw 'Trainer extraction failed' }}
}}
@{{commit='{commit}';path='{trainer}'}} | ConvertTo-Json | Set-Content -Encoding ascii 'D:/ai/cdtank/trainer/current.json'
""", text=True, check=True)
        print(json.dumps({"commit": commit, "archive": destination, "trainer": trainer}))
    finally:
        source.stdout.close()
        if source.poll() is None:
            source.terminate()
            source.wait()
        if receiver.poll() is None:
            receiver.stdin.close()
            receiver.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="192.168.10.179")
    main(parser.parse_args())
