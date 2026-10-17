"""Execute a PowerShell script over the configured training SSH connection."""

import argparse
import base64
from pathlib import Path
import subprocess
import sys


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("script", help="Local PowerShell file, or - to read stdin")
parser.add_argument("--host", default="192.168.10.179")
args = parser.parse_args()
script = sys.stdin.read() if args.script == "-" else Path(args.script).read_text(encoding="utf-8")
script = "$ProgressPreference='SilentlyContinue'\n$ErrorActionPreference='Stop'\n" + script
command = "powershell -NoProfile -EncodedCommand " + base64.b64encode(script.encode("utf-16le")).decode()
sys.exit(subprocess.call(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", args.host, command]))
