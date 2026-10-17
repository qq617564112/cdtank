"""Receive a streamed training export on the GPU host."""

from pathlib import Path
import shutil
import sys


destination = Path(sys.argv[1])
destination.parent.mkdir(parents=True, exist_ok=True)
with destination.open("xb") as output:
    shutil.copyfileobj(sys.stdin.buffer, output)
print(destination)
