"""Execute a PowerShell or Python script over the training SSH connection."""

import argparse
import base64
from pathlib import Path
import subprocess
import sys
import uuid


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("script", help="Local script file, or - to read stdin")
parser.add_argument("--host", default="192.168.10.179")
parser.add_argument("--python", action="store_true", help="Run a Python script using the training virtual environment")
args = parser.parse_args()
script = sys.stdin.read() if args.script == "-" else Path(args.script).read_text(encoding="utf-8")
connection = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", args.host]
destination = None
if args.python:
    destination = f"D:/ai/cdtank/data/remote-scripts/{uuid.uuid4().hex}.py"
    command = f"D:/ai/cdtank/venv/Scripts/python.exe {destination}"
else:
    script = "$ProgressPreference='SilentlyContinue'\n$ErrorActionPreference='Stop'\n" + script
    encoded = base64.b64encode(script.encode("utf-16le")).decode()
    if len(encoded) <= 6000:
        command = "powershell -NoProfile -EncodedCommand " + encoded
    else:
        destination = f"D:/ai/cdtank/data/remote-scripts/{uuid.uuid4().hex}.ps1"
        command = "powershell -NoProfile -ExecutionPolicy Bypass -File " + destination
if destination is not None:
    receiver = "C:/ProgramData/miniconda3/python.exe D:/ai/cdtank/src/receive.py " + destination
    subprocess.run([*connection, receiver], input=script.encode("utf-8-sig"),
                   stdout=subprocess.DEVNULL, check=True)
sys.exit(subprocess.call([*connection, command]))
