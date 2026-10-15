"""Extract source audio and original playback mappings into arts/audio."""
import argparse
from hashlib import sha256
import configparser
import json
from pathlib import Path
import shutil
import tempfile
from inspect_assets import read_cpk, read_table
from export_audio_events import export as export_audio_events
from reconstruct_battle_media import export_bg07, export_tree_sounds, export_ww051

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'arts/audio'


def extract(output):
    output.mkdir(parents=True, exist_ok=True)
    archive = ROOT / 'CDTank/Data/music/music.cpk'
    music = []
    with tempfile.TemporaryDirectory(prefix='.music-', dir=output) as temporary:
        extracted = Path(temporary)
        manifest = read_cpk(archive, extracted)
        for entry in manifest['entries']:
            source = extracted / entry['path']
            target = output / 'music' / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            music.append({'name': source.stem, 'asset': f'assets/audio/music/{source.name}',
                          'source': f'CDTank/Data/music/music.cpk#{entry["path"]}',
                          'sha256': entry['sha256'], 'bytes': source.stat().st_size})
    sounds = []
    for source in sorted((ROOT / 'CDTank/Data/sound').glob('*.wav')):
        asset = f'assets/audio/sfx/{source.name}'
        target = output / 'sfx' / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        sounds.append({'name': source.stem, 'asset': asset, 'source': str(source),
                       'sha256': sha256(source.read_bytes()).hexdigest()})
    with tempfile.TemporaryDirectory(prefix='.reconstructed-', dir=output) as temporary:
        reconstructed = Path(temporary)
        additions = []
        if not any(entry['name'] == 'BG07' for entry in sounds):
            additions.append(export_bg07(reconstructed))
        if not any(entry['name'].lower() == 'ww051' for entry in sounds):
            additions.append(export_ww051(reconstructed))
        additions.extend(export_tree_sounds(reconstructed, {entry['name'] for entry in sounds}))
        for entry in additions:
            group = 'music' if entry['name'] == 'BG07' else 'sfx'
            relative = f'{group}/reconstructed/{Path(entry["asset"]).name}'
            target = output / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(reconstructed / entry['asset'], target)
            entry['asset'] = f'assets/audio/{relative}'
            entry['provenance']['asset'] = entry['asset']
            sounds.append(entry)
    strings = read_table(ROOT / 'CDTank/Data/table/musicstring.dat')
    names = {int(row['values']['ID']): row['values']['String'] for row in strings['rows']}
    tracks = {entry['name']: entry for entry in music}
    sound_tracks = {entry['name']: entry for entry in sounds}
    sound_ids = [{'id': key, 'name': name, 'asset': sound_tracks[name]['asset']}
                 for key, name in names.items() if name in sound_tracks]
    maps = []
    for mode in range(1, 6):
        table = read_table(ROOT / f'CDTank/Data/table/m00{mode}.dat')
        for row in table['rows']:
            values = row['values']
            # EXE 0x4d058c–0x4d059a adds 0xbf to the map's music selector.
            music_id = int(values['MusicFile']) + 0xbf
            name = names[music_id]
            assert name in tracks, f'Missing source map music: {mode}/{values["MapID"]}/{name}'
            maps.append({'mode': mode, 'mapId': int(values['MapID']),
                         'musicFile': int(values['MusicFile']), 'musicId': music_id,
                         'name': name, 'asset': tracks[name]['asset'],
                         'tableSource': table['source'], 'tableSha256': table['sha256']})
    settings = configparser.ConfigParser()
    settings.read(ROOT / 'CDTank/Config/SystemSetting.ini')
    evidence = export_audio_events()
    evidence_path = ROOT / 'recovery/output/audio-events.json'
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    for entry in evidence['killSound']['selections'] + evidence['fireSound']['selections']:
        entry['asset'] = sound_tracks[entry['name']]['asset']
    tank_types = [{'id': int(row['values']['ID']), 'type': int(row['values']['TankType'])}
                  for row in read_table(ROOT / 'CDTank/Data/table/tank.dat')['rows']]
    (output / 'audio.json').write_text(json.dumps({'music': music, 'sounds': sounds,
        'soundIds': sound_ids, 'maps': maps,
        'battleKill': {'selections': evidence['killSound']['selections'],
                       'spatial': evidence['spatial'], 'tankTypes': tank_types},
        'battleFire': evidence['fireSound']['selections'],
        'defaultMusicVolume': settings.getfloat('Volume', 'MusicVolume'),
        'defaultSoundVolume': settings.getfloat('Volume', 'SoundVolume'),
        'unmatchedMusicIds': [{'id': key, 'name': name} for key, name in names.items()
                              if name.startswith(('GAM', 'UIM')) and name not in tracks]},
        ensure_ascii=False, indent=2) + '\n')
    print(f'Extracted {len(music)} original MP3, {len(sounds)} WAV entries to {output}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUT)
    args = parser.parse_args()
    extract(args.output.resolve())


if __name__ == '__main__':
    main()
