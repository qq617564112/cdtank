"""Stream committed simulation sources and existing resources to the training host."""

import argparse
import io
import json
from pathlib import Path
import subprocess
import tarfile
import time


def main(args):
    repository = Path(__file__).resolve().parents[2]
    commit = subprocess.check_output(["git", "rev-parse", f"{args.revision}^{{commit}}"],
                                     cwd=repository, text=True).strip()
    resources = Path(args.resources).resolve()
    if not (resources / "assets/battlefields.json").is_file() or not (resources / "tables").is_dir():
        raise ValueError("Use the prepared apps/server/resources directory")
    destination = f"D:/ai/cdtank/data/simulation-{commit[:12]}.tar.gz"
    source = subprocess.Popen(["git", "archive", commit, "apps/server/src", "apps/shared",
                               "scripts/learning", "docs/ai-learning.md", "tsconfig.json"],
                              cwd=repository, stdout=subprocess.PIPE)
    receiver = subprocess.Popen(["ssh", "-o", "BatchMode=yes", args.host,
                                 f"C:/ProgramData/miniconda3/python.exe D:/ai/cdtank/src/receive.py {destination}"],
                                stdin=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=receiver.stdin, mode="w|gz", dereference=True) as archive:
            with tarfile.open(fileobj=source.stdout, mode="r|") as committed:
                for member in committed:
                    archive.addfile(member, committed.extractfile(member) if member.isfile() else None)
            if source.wait() != 0:
                raise RuntimeError("git archive failed")
            for name in ("assets", "tables"):
                archive.add(resources / name, arcname=f"apps/server/resources/{name}")
            provenance = json.dumps({"commit": commit, "archivedAt": time.time(),
                                     "resources": "Existing prepared game simulation resources"}, indent=2).encode()
            metadata = tarfile.TarInfo("source.json")
            metadata.size = len(provenance)
            archive.addfile(metadata, io.BytesIO(provenance))
        receiver.stdin.close()
        if receiver.wait() != 0:
            raise RuntimeError("Remote simulation archive transfer failed")
        print(json.dumps({"commit": commit, "archive": destination}))
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
    parser.add_argument("--resources", required=True)
    parser.add_argument("--revision", default="HEAD")
    parser.add_argument("--host", default="192.168.10.179")
    main(parser.parse_args())
