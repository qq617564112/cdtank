"""Run the offline WebAssembly geometry kernels through Node."""

from pathlib import Path
import subprocess

REPOSITORY = Path(__file__).resolve().parents[2]


def preprocess_geometry(root, mode='models'):
    subprocess.run(['node', str(REPOSITORY / 'scripts/geometry/preprocess.mjs'),
        '--' + mode, str(Path(root).resolve())], check=True)
