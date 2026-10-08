"""Publish source music/sound bytes, reconstructed Type4 cues, and original map music mappings."""
from hashlib import sha256
import configparser
import json
from pathlib import Path
import shutil
from inspect_assets import read_table
from export_audio_events import export as export_audio_events
from reconstruct_battle_media import export_bg07, export_tree_sounds, export_ww051

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'recovery/output/web-assets'
VERIFIED = ROOT / 'recovery/output/verified'


def main():
    manifest = json.loads((VERIFIED / 'manifests/music.json').read_text())
    archive = ROOT / 'CDTank/Data/music/music.cpk'
    assert sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
    music = []
    for entry in manifest['entries']:
        source = VERIFIED / 'assets/music' / entry['path']
        assert sha256(source.read_bytes()).hexdigest() == entry['sha256']
        asset = f'audio/music/{source.name}'
        target = OUT / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        music.append({'name': source.stem, 'asset': asset, 'source': str(source),
                      'sha256': entry['sha256'], 'bytes': source.stat().st_size})
    sounds = []
    for source in sorted((ROOT / 'CDTank/Data/sound').glob('*.wav')):
        asset = f'audio/sound/{source.name}'
        target = OUT / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        sounds.append({'name': source.stem, 'asset': asset, 'source': str(source),
                       'sha256': sha256(source.read_bytes()).hexdigest()})
    if not any(entry['name'] == 'BG07' for entry in sounds):
        sounds.append(export_bg07(OUT))
    if not any(entry['name'].lower() == 'ww051' for entry in sounds):
        sounds.append(export_ww051(OUT))
    sounds.extend(export_tree_sounds(OUT, {entry['name'] for entry in sounds}))
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
    tank_types = [{'id': int(row['values']['ID']), 'type': int(row['values']['TankType'])}
                  for row in read_table(ROOT / 'CDTank/Data/table/tank.dat')['rows']]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'audio.json').write_text(json.dumps({'music': music, 'sounds': sounds,
        'soundIds': sound_ids, 'maps': maps,
        'battleKill': {'selections': evidence['killSound']['selections'],
                       'spatial': evidence['spatial'], 'tankTypes': tank_types},
        'battleFire': evidence['fireSound']['selections'],
        'defaultMusicVolume': settings.getfloat('Volume', 'MusicVolume'),
        'defaultSoundVolume': settings.getfloat('Volume', 'SoundVolume'),
        'unmatchedMusicIds': [{'id': key, 'name': name} for key, name in names.items()
                              if name.startswith(('GAM', 'UIM')) and name not in tracks]},
        ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(music)} original MP3, {len(sounds)} WAV entries, {len(maps)} map music mappings')


if __name__ == '__main__':
    main()
