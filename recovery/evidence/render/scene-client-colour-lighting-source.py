"""Extract map colour/lighting inputs and their original static callers."""
import argparse
import configparser
import json
from pathlib import Path
import struct
import sys

import capstone
import pefile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pol import read_pol


def instructions(pe, start, end):
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    return [dict(address=hex(row.address), instruction=f'{row.mnemonic} {row.op_str}'.strip())
            for row in decoder.disasm(pe.get_data(start - base, end - start), start)]


def extract(client, assets):
    game = pefile.PE(str(client / 'CDTank.exe'))
    engine = pefile.PE(str(client / 'gbengine.dll'))
    maps = []
    for number in range(1, 26):
        scene_id = f'{number:04d}'
        reference = f'Data/scn/{scene_id}/{scene_id}'
        parser = configparser.ConfigParser()
        parser.read(assets / f'{reference}.ini', encoding='gbk')
        fog = parser['fog']
        ctl = (assets / f'{reference}.ctl').read_bytes()
        maps.append(dict(id=scene_id, ini=f'{reference}.ini', ctl=f'{reference}.ctl',
                         fog=dict(enable=fog.getint('enable'), start=fog.getfloat('start'),
                                  end=fog.getfloat('end'), density=fog.getfloat('density'),
                                  color=[fog.getfloat(f'color_{axis}') for axis in 'rgb']),
                         ctlBytes=ctl.hex(), toonCandidateCount=struct.unpack_from('<I', ctl)[0]))
    meshes = []
    for model in ['obj05431', 'obj05424', 'obj05460', 'obj05420', 'obj05459', 'obj05023', 'obj05023/scr']:
        folder, name = (model.split('/') if '/' in model else [model, model])
        directory = assets / f'Data/scnobj/{folder}'
        path = next(row for row in directory.iterdir()
                    if row.name.lower() == f'{name}.pol')
        source = read_pol(path)
        meshes.append(dict(model=model, reference=path.relative_to(assets).as_posix(),
                           meshes=[dict(name=mesh['name'], fvf=mesh['fvf'],
                                        parts=[dict(kind=part['kind'], properties=part['properties'],
                                                    textures=part['textures']) for part in mesh['parts']])
                                   for mesh in source['meshes']]))
    return dict(
        scope='Static original inputs and instructions; no execution or framebuffer acceptance',
        ambientWrite=instructions(game, 0x447bb9, 0x447c4b),
        ambientRegister=instructions(engine, 0x100033b0, 0x100033d3),
        fogLoader=instructions(game, 0x45a6dc, 0x45a7e2),
        defaultToonLight=instructions(game, 0x45b4e4, 0x45b539),
        actorEffect=instructions(game, 0x4696ce, 0x469750),
        fourPartActorEffect=instructions(game, 0x46cfd4, 0x46d054),
        silhouetteGetter=instructions(game, 0x44f074, 0x44f088),
        silhouetteSetting=instructions(game, 0x41d2a2, 0x41d2c2),
        silhouetteActivation=instructions(game, 0x454ef3, 0x454f28),
        maps=maps, opaquePolModels=meshes,
        scripts={name: (assets / f'Data/gfxscript/{name}.gbf').read_text(encoding='gbk')
                 for name in ['geom_c1', 'cartoon']})


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, default=root / 'CDTank')
    parser.add_argument('--assets', type=Path, default=root / 'recovery/output/verified/assets/data')
    parser.add_argument('--out', type=Path, default=root / 'recovery/output/scene-client-colour-lighting-source.json')
    args = parser.parse_args()
    result = extract(args.client, args.assets)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Extracted {len(result["maps"])} original map inputs and {len(result["opaquePolModels"])} POL identities')
