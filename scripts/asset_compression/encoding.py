import io
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

import numpy as np
from PIL import Image


def webp_encoding(payload):
    offset = 12
    while offset < len(payload):
        kind, length = struct.unpack_from('<4sI', payload, offset)
        if kind in (b'VP8 ', b'VP8L'):
            return 'lossy' if kind == b'VP8 ' else 'lossless'
        offset += 8 + length + (length & 1)


class WebpEncoder:
    def __init__(self, command, profiles, work):
        executable = shutil.which(command)
        if executable is None:
            raise FileNotFoundError('cwebp is required; install libwebp tools or specify --cwebp')
        self.command = executable
        self.profiles = profiles
        self.work = work
        self.environment = os.environ.copy()
        library = Path(executable).resolve().parent.parent / 'lib/x86_64-linux-gnu'
        if library.is_dir():
            self.environment['LD_LIBRARY_PATH'] = str(library) + ':' + self.environment.get('LD_LIBRARY_PATH', '')
        self.version = subprocess.check_output([self.command, '-version'], env=self.environment, text=True).strip()

    def encode(self, source, destination, profile):
        subprocess.run([self.command, '-quiet', str(source), *self.profiles[profile],
            '-metadata', 'all', '-o', str(destination)], env=self.environment,
            check=True, capture_output=True, text=True)

    def verify(self, path, reference, metadata, exact=False):
        with Image.open(path) as decoded:
            if decoded.format != 'WEBP' or decoded.size != reference.size:
                raise RuntimeError(f'WebP format or dimensions changed: {path}')
            for field in ('icc_profile', 'exif'):
                if metadata.get(field) != decoded.info.get(field):
                    raise RuntimeError(f'WebP metadata changed: {path}')
            result = np.asarray(decoded.convert('RGBA'))
        source = np.asarray(reference.convert('RGBA'))
        if not np.array_equal(source[:, :, 3], result[:, :, 3]):
            raise RuntimeError(f'WebP alpha changed: {path}')
        if exact and not np.array_equal(source, result):
            raise RuntimeError(f'Lossless pixels changed: {path}')
        difference = np.abs(source[:, :, :3].astype(np.int16) - result[:, :, :3].astype(np.int16))
        return result, {'rgb_equal': bool(np.array_equal(source, result)),
            'rgb_max_error': int(difference.max()), 'rgb_mae': round(float(difference.mean()), 4),
            'dimensions_equal': True, 'alpha_equal': True, 'metadata_equal': True}

    def image(self, payload, suffix, target, profile):
        with Image.open(io.BytesIO(payload)) as original:
            metadata = {field: original.info[field] for field in ('icc_profile', 'exif') if original.info.get(field)}
            source_size = list(original.size)
            reference = original.resize(tuple(target), Image.Resampling.LANCZOS) if target != source_size else original.copy()
        with tempfile.TemporaryDirectory(prefix='image-', dir=self.work) as directory:
            directory = Path(directory)
            baseline = directory / 'baseline.webp'
            if suffix == '.webp' and target == source_size:
                baseline.write_bytes(payload)
            else:
                input_path = directory / 'sized.png'
                reference.save(input_path, format='PNG', **metadata)
                self.encode(input_path, baseline, 'baseline')
                self.verify(baseline, reference, metadata, exact=True)
            baseline_payload = baseline.read_bytes()
            final_payload = baseline_payload
            adopted = 'keep-source'
            metrics = {'rgb_equal': True, 'rgb_max_error': 0, 'rgb_mae': 0.0,
                'dimensions_equal': True, 'alpha_equal': True, 'metadata_equal': True}
            source = np.asarray(reference.convert('RGBA'))
            candidate_bytes = len(baseline_payload)
            if profile != 'keep-source' and webp_encoding(baseline_payload) != 'lossy':
                candidate = directory / 'candidate.webp'
                input_path = baseline
                if profile == 'near80' and bool(np.any(source[:, :, 3] != 255)):
                    input_path = directory / 'rgb.png'
                    Image.fromarray(source[:, :, :3]).save(input_path, format='PNG', **metadata)
                self.encode(input_path, candidate, profile)
                if profile == 'near80':
                    with Image.open(candidate) as decoded:
                        adjusted = np.array(decoded.convert('RGBA'))
                    transparent = source[:, :, 3] == 0
                    black = source[:, :, :3].max(axis=2) == 0
                    restore = (not np.array_equal(adjusted[:, :, 3], source[:, :, 3])
                        or not np.array_equal(adjusted[transparent], source[transparent])
                        or bool(np.any(adjusted[:, :, :3][black] != 0)))
                    if restore:
                        adjusted[:, :, 3] = source[:, :, 3]
                        adjusted[transparent] = source[transparent]
                        adjusted[:, :, :3][black] = 0
                        input_path = directory / 'restored.png'
                        Image.fromarray(adjusted).save(input_path, format='PNG', **metadata)
                        self.encode(input_path, candidate, 'restored')
                decoded, candidate_metrics = self.verify(candidate, reference, metadata)
                if profile == 'near80' and (candidate_metrics['rgb_max_error'] > 1
                    or bool(np.any(decoded[:, :, :3][black] != 0))):
                    raise RuntimeError('Near-lossless RGB exceeds one level or pure black changed')
                candidate_payload = candidate.read_bytes()
                candidate_bytes = len(candidate_payload)
                if candidate_bytes < len(baseline_payload):
                    final_payload = candidate_payload
                    adopted = profile
                    metrics = candidate_metrics
            if adopted == 'keep-source':
                _, metrics = self.verify(baseline, reference, metadata, exact=True)
            return final_payload, {'source_size': source_size, 'target_size': target,
                'source_bytes': len(payload), 'baseline_bytes': len(baseline_payload),
                'candidate_bytes': candidate_bytes, 'output_bytes': len(final_payload),
                'requested_profile': profile, 'encoding_profile': adopted,
                'output_encoding': webp_encoding(final_payload), 'resized': target != source_size,
                **metrics}
