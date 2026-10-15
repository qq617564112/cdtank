#!/usr/bin/env python3
"""Compress extracted audio from its recipe, or publish existing encoded files."""

import argparse
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import wave


ROOT = Path(__file__).resolve().parents[1]
RECIPE = Path(__file__).with_name('audio_compression') / 'recipe.json'
ASSET_PREFIX = 'assets/audio/'


def write_json(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')


def audio_entries(catalog):
    return catalog['music'] + catalog['sounds']


def rewrite_assets(value, mapping):
    if isinstance(value, dict):
        result = {key: rewrite_assets(item, mapping) for key, item in value.items()}
        if 'asset' in value and result['asset'] != value['asset'] and 'sha256' in result:
            result['sourceSha256'] = result.pop('sha256')
        return result
    if isinstance(value, list):
        return [rewrite_assets(item, mapping) for item in value]
    if isinstance(value, str):
        return mapping.get(value, value)
    return value


def separate_directories(source, output):
    if source.is_relative_to(output) or output.is_relative_to(source):
        raise ValueError('Audio source and output directories must not overlap')


def select_files(rows, selected):
    if not selected:
        return rows
    selected = set(selected)
    matches = [row for row in rows
               if selected.intersection((row['source_relative'], row['output_relative']))]
    known = {path for row in matches for path in (row['source_relative'], row['output_relative'])}
    if selected - known:
        raise ValueError(f'Audio paths are not in the recipe: {", ".join(sorted(selected - known))}')
    return matches


def encode(row, profile, source, output, encoder, settings):
    original = source / row['source_relative']
    target = output / row['output_relative']
    target.parent.mkdir(parents=True, exist_ok=True)
    result = {**row, 'source_bytes': original.stat().st_size}
    temporary = target.with_name(target.name + '.candidate')
    try:
        if profile['codec'] == 'copy':
            shutil.copy2(original, temporary)
            result['mime_type'] = 'audio/mpeg'
        else:
            with wave.open(str(original), 'rb') as audio:
                channels = audio.getnchannels()
                result.update(source_sample_rate=audio.getframerate(), channels=channels,
                              source_bits_per_sample=audio.getsampwidth() * 8,
                              duration_seconds=audio.getnframes() / audio.getframerate())
            if channels != profile['channels']:
                raise ValueError(f'Channel count differs from the audio recipe: {original}')
            subprocess.run([encoder, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                            '-i', str(original), '-map', '0:a:0', '-map_metadata', '-1',
                            '-c:a', 'libopus', '-b:a', f'{profile["bitrate_kbps"]}k',
                            '-vbr', 'on', '-compression_level', str(settings['compression_level']),
                            '-application', 'audio', '-frame_duration', str(settings['frame_duration_ms']),
                            '-ar', str(settings['sample_rate']), '-f', 'opus', str(temporary)], check=True)
            result.update(mime_type='audio/ogg; codecs=opus', bitrate_kbps=profile['bitrate_kbps'],
                          output_sample_rate=settings['sample_rate'])
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    result['output_bytes'] = target.stat().st_size
    return result


def compressed_catalog(catalog, recipe, results):
    rows = {row['source_relative']: row for row in recipe['files']}
    mapping = {ASSET_PREFIX + name: ASSET_PREFIX + row['output_relative']
               for name, row in rows.items()}
    published = rewrite_assets(catalog, mapping)
    for original, entry in zip(audio_entries(catalog), audio_entries(published)):
        relative = original['asset'].removeprefix(ASSET_PREFIX)
        row = rows[relative]
        result = results[relative]
        if result['output_relative'] != row['output_relative'] or result['profile'] != row['profile']:
            raise ValueError(f'Encode the changed recipe entry before publishing: {relative}')
        entry.update(sourceAsset=original['asset'], sourceBytes=result['source_bytes'],
                     bytes=result['output_bytes'], mimeType=result['mime_type'])
        if recipe['profiles'][row['profile']]['codec'] != 'copy':
            if 'sha256' in entry:
                entry['sourceSha256'] = entry.pop('sha256')
            if 'format' in original:
                entry['sourceFormat'] = copy.deepcopy(original['format'])
            entry['format'] = {'container': 'ogg', 'encoding': 'Opus',
                               'sampleRate': result['output_sample_rate'], 'channels': result['channels'],
                               'bitrateKbps': result['bitrate_kbps']}
    return published


def compress(args):
    source, output = args.source.resolve(), args.output.resolve()
    separate_directories(source, output)
    recipe = json.loads(args.recipe.read_text())
    catalog = json.loads((source / 'audio.json').read_text())
    inputs = {entry['asset'].removeprefix(ASSET_PREFIX) for entry in audio_entries(catalog)}
    planned = {row['source_relative'] for row in recipe['files']}
    if inputs != planned:
        raise ValueError(f'Update the audio recipe: missing={sorted(inputs - planned)}, '
                         f'unused={sorted(planned - inputs)}')
    rows = select_files(recipe['files'], args.audio)
    report_path = output / 'reports/generated-audio.json'
    previous = json.loads(report_path.read_text()) if report_path.is_file() else {'files': []}
    results = {row['source_relative']: row for row in previous['files']} if args.audio else {}
    if args.audio and not planned.issubset(results):
        raise ValueError('Run full audio compression before using --audio')
    if args.audio and (previous.get('encoder') != recipe['encoder'] or
                       previous.get('profiles') != recipe['profiles']):
        raise ValueError('Run full audio compression after changing encoder profiles')
    encoder_version = previous.get('encoder_version')
    if any(recipe['profiles'][row['profile']]['codec'] != 'copy' for row in rows):
        encoder = shutil.which(args.ffmpeg)
        if encoder is None:
            raise FileNotFoundError('Install FFmpeg with libopus, or set --ffmpeg / CDTANK_FFMPEG')
        encoder_version = subprocess.run([encoder, '-version'], check=True, capture_output=True,
                                         text=True).stdout.splitlines()[0]
    else:
        encoder = None
    output.mkdir(parents=True, exist_ok=True)
    for index, row in enumerate(rows, 1):
        results[row['source_relative']] = encode(row, recipe['profiles'][row['profile']],
                                                source, output, encoder, recipe['encoder'])
        if index % 25 == 0 or index == len(rows):
            print(f'Encoded {index}/{len(rows)} audio files', flush=True)
    results = {relative: results[relative] for relative in sorted(planned)}
    published = compressed_catalog(catalog, recipe, results)
    write_json(output / 'audio.json', published)
    source_bytes = sum(row['source_bytes'] for row in results.values())
    output_bytes = sum(row['output_bytes'] for row in results.values())
    report = {'source': str(source), 'output': str(output), 'encoder_version': encoder_version,
              'encoder': recipe['encoder'], 'profiles': recipe['profiles'], 'files': list(results.values()),
              'source_bytes': source_bytes, 'output_bytes': output_bytes,
              'saved_percent': round(100 * (1 - output_bytes / source_bytes), 2)}
    write_json(report_path, report)
    retained = {row['output_relative'] for row in results.values()}
    for row in previous['files']:
        if row['output_relative'] not in retained:
            (output / row['output_relative']).unlink(missing_ok=True)
    print(json.dumps({key: report[key] for key in ('source_bytes', 'output_bytes', 'saved_percent')}))


def publish(args):
    source, output = args.source.resolve(), args.output.resolve()
    separate_directories(source, output)
    catalog = json.loads((source / 'audio.json').read_text())
    report = json.loads((source / 'reports/generated-audio.json').read_text())
    rows = select_files(report['files'], args.audio)
    selected = {ASSET_PREFIX + row['output_relative'] for row in rows}
    current = {entry['asset'] for entry in audio_entries(catalog)}
    for asset in current:
        path = source / asset.removeprefix(ASSET_PREFIX) if asset in selected else output / asset
        if not path.is_file():
            raise FileNotFoundError(f'Missing audio file; run full compression/publication first: {path}')
    manifest_path = output / 'manifests/audio.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    mapping = {entry['sourceAsset']: entry['asset'] for entry in audio_entries(catalog)}
    # Custom maps append their music selection independently of the original tables.
    maps = {(entry['mode'], entry['mapId']) for entry in catalog['maps']}
    for entry in previous.get('maps', []):
        extra = rewrite_assets(entry, mapping)
        if (entry['mode'], entry['mapId']) not in maps and extra['asset'] in current:
            catalog['maps'].append(extra)
    for row in rows:
        target = output / ASSET_PREFIX / row['output_relative']
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.candidate')
        shutil.copy2(source / row['output_relative'], temporary)
        temporary.replace(target)
    write_json(manifest_path, catalog)
    for entry in previous.get('music', []) + previous.get('sounds', []):
        if entry['asset'] not in current:
            (output / entry['asset']).unlink(missing_ok=True)
    summary = {'published_files': len(rows), 'source_bytes': report['source_bytes'],
               'output_bytes': report['output_bytes'], 'saved_percent': report['saved_percent']}
    write_json(source / 'reports/published-audio.json', {'output': str(output), **summary})
    print(json.dumps(summary))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    compression = commands.add_parser('compress', help='Encode source WAV once; copy original MP3')
    compression.add_argument('--source', type=Path, default=ROOT / 'arts/audio')
    compression.add_argument('--output', type=Path, default=ROOT / 'arts/compressed-audio')
    compression.add_argument('--recipe', type=Path, default=RECIPE)
    compression.add_argument('--ffmpeg', default=os.environ.get('CDTANK_FFMPEG', 'ffmpeg'))
    publication = commands.add_parser('publish', help='Copy encoded files and update the runtime catalog')
    publication.add_argument('--source', type=Path, default=ROOT / 'arts/compressed-audio')
    publication.add_argument('--output', type=Path,
                             default=ROOT / os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    for command in (compression, publication):
        command.add_argument('--audio', action='append', default=[],
                             help='Only process this recipe source/output path; repeat for multiple files')
    args = parser.parse_args()
    if args.command == 'compress':
        compress(args)
    else:
        publish(args)


if __name__ == '__main__':
    main()
