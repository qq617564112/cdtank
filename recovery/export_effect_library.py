"""Export original effect.sav nodes and direct ELK target coverage."""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import struct

import capstone
import pefile
from effect_sav import read_library
from effect_resources import export_resources
from effect_strip_controls import strip_controls
from effect_sound_controls import sound_controls
from effect_overlay_controls import overlay_controls
from effect_screen_controls import screen_controls
from effect_model_controls import model_controls
from export_effect_models import export_models
from effect_bolt_controls import bolt_controls
from effect_controls import sprite_controls, node_timings, particle_controls
from effect_rendering import export_rendering
from effect_engine import export_engine
from export_effect_links import export as export_links

ROOT = Path(__file__).resolve().parents[1]


def export():
    source = ROOT / 'recovery/output/verified/assets/data/Data/effect/effect.sav'
    raw = source.read_bytes()
    library = read_library(raw)
    exe = ROOT / 'CDTank/CDTank.exe'
    pe = pefile.PE(str(exe))
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    # Factory entries prove base, extended, and type-11 resource loader selection.
    resource_vtables = [0x5C9450, 0x5C9480, 0x5C9494, 0x5C94A8,
                       0x5C94BC, 0x5C94E8, 0x5C94FC, 0x5C9528,
                       0x5C9554, 0x5C9450, 0x5C9450, 0x5C9580]
    loaders = [struct.unpack('<I', pe.get_data(v - 0x400000 + 12, 4))[0]
               for v in resource_vtables]
    assert loaders == [0x476116, 0x4765FF, 0x476839, 0x476A47,
                       0x476B09, 0x476EF7, 0x477077, 0x477636,
                       0x477AEF, 0x476116, 0x476116, 0x477D2F]
    ranges = [('libraryLoader', 0x47B8B3, 0x47BAF1),
              ('nodeLoader', 0x47F9CF, 0x47FAB5),
              ('resourceFactory', 0x47800E, 0x4781E3),
              ('modifierFactory', 0x478A67, 0x478C18),
              ('modifierBase', 0x47607A, 0x4760C3),
              ('spriteFactory', 0x478275, 0x4782AB),
              ('particleFactory', 0x4783AC, 0x4783E5),
              ('spriteResourceUse', 0x48321C, 0x4832F8),
              ('particleResourceUse', 0x4813DD, 0x48143D),
              ('spriteGrid', 0x482CC9, 0x482DC3),
              ('particleGrid', 0x4812E3, 0x4813DD),
              ('particleEmissionClock', 0x480138, 0x4801D4),
              ('particleEmissionLoop', 0x48010C, 0x480138),
              ('particleEmitterMotion', 0x4801D4, 0x48032C),
              ('particleSpawn', 0x47FDBB, 0x48010C),
              ('particleUpdate', 0x48032C, 0x480805),
              ('particleLifetime', 0x480805, 0x480857),
              ('particleForwardLoop', 0x480857, 0x480889),
              ('particleAllocate', 0x47FBB1, 0x47FBC9),
              ('particleEnd', 0x47FBC9, 0x47FBD7),
              ('particleResourceBinding', 0x4813DD, 0x48156A),
              ('randomFloatRange', 0x455880, 0x4558BC),
              ('particleRenderSelection', 0x480FD8, 0x481016),
              ('randomInclusiveCount', 0x474181, 0x474196),
              ('spriteFrameInitialization', 0x482976, 0x4829C7),
              ('spriteFrameStep', 0x4830E1, 0x483161),
              ('spriteTrailStep', 0x483161, 0x48321C),
              ('spriteHistoryAssign', 0x481630, 0x4816A5),
              ('spriteHistoryLookup', 0x48188D, 0x4818AA),
              ('spriteHistoryPushFront', 0x4823C7, 0x482419),
              ('spriteHistoryPushBack', 0x482419, 0x482470),
              ('spriteHistoryResize', 0x482C87, 0x482CC9),
              ('randomFrameModulo', 0x45E400, 0x45E417),
              ('controllerSelection', 0x47F0EB, 0x47F1BC),
              ('effectTimeTick', 0x47F61C, 0x47F664),
              ('delayedEffectStart', 0x47F572, 0x47F61C),
              ('effectLifetimeEnd', 0x47EEF0, 0x47EF25),
              ('activeEffectUpdate', 0x47F2AF, 0x47F311),
              ('endingEffectChildren', 0x47F311, 0x47F359),
              ('effectStartState', 0x47EEB3, 0x47EEF0),
              ('effectRelease', 0x47F262, 0x47F2AF),
              ('effectDetachChild', 0x47F359, 0x47F3C4),
              ('effectPoolReturn', 0x47F42D, 0x47F4A0),
              ('spriteAdditionalEndCondition', 0x481953, 0x4819A9),
              ('spriteStateInitialization', 0x482960, 0x482C87),
              ('spriteStateReset', 0x481FC0, 0x48220F),
              ('spriteSpatialUpdate', 0x482DDF, 0x483039),
              ('spriteColorUpdate', 0x483039, 0x4830E1),
              ('spriteRendering', 0x4819CB, 0x481FBE),
              ('vectorScaleF32', 0x422D4D, 0x422D71),
              ('scalarClamp', 0x464D7D, 0x464DA8),
              ('renderScriptRegistration', 0x47AD10, 0x47AE78),
              ('spriteRenderSelection', 0x481A0B, 0x481A90),
              ('renderScriptLookup', 0x4794C2, 0x4794D1),
              ('spriteDiffusePacking', 0x481EF2, 0x481F55),
              ('spriteTrailAlpha', 0x481F55, 0x481F87),
              ('floatTruncate', 0x57BB64, 0x57BBD9)]
    ranges += [('spriteBillboardCorners', 0x481B62, 0x481C38),
               ('nativeCosine', 0x57CA74, 0x57CB24),
               ('nativeSine', 0x57CB24, 0x57CBC4)]
    evidence = {name: [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                       'instruction': f'{i.mnemonic} {i.op_str}'}
                      for i in decoder.disasm(pe.get_data(start - 0x400000, end - start), start)]
                for name, start, end in ranges}
    modifier_loaders = [0x47607A, 0x476319, 0x47607A, 0x47607A,
                        0x47607A, 0x476CE7, 0x478626, 0x477337,
                        0x4779CE, 0x477C72, 0x47607A, 0x47607A]
    for family, addresses in [('resource', loaders), ('modifier', modifier_loaders)]:
        for address in sorted(set(addresses)):
            decoded = []
            for instruction in decoder.disasm(pe.get_data(address - 0x400000, 2000), address):
                decoded.append({'va': hex(instruction.address), 'bytes': instruction.bytes.hex(),
                                'instruction': f'{instruction.mnemonic} {instruction.op_str}'})
                if instruction.mnemonic.startswith('ret'):
                    break
            evidence[f'{family}Loader{hex(address)}'] = decoded
    identifiers = Counter(n['id'] for n in library['nodes'])
    names = {}
    for node in library['nodes']:
        names.setdefault(node['name'], []).append(node['index'])
    targets = sorted({record['field04String'] for file in export_links()['files']
                      for group in file['groups'] for action in group['actions']
                      for record in action['records']})
    coverage = []
    for target in targets:
        matches = names.get(target, [])
        descendants = [n['index'] for n in library['nodes']
                       if n['name'].startswith(target + '\\')]
        coverage.append({'name': target, 'nodes': matches, 'descendants': descendants})
    resources = export_resources(library['nodes'],
                                 ROOT / 'recovery/output/verified/assets/data',
                                 ROOT / 'recovery/output/web-assets')
    export_models(model_controls(library['nodes']), ROOT / 'recovery/output/verified/assets/data',
                  ROOT / 'recovery/output/web-assets')
    return {**library, 'textureGrids': [row for row in resources if row['type'] != 2],
            'boltTextures': [row for row in resources if row['type'] == 2],
            'colorPacking': {'multiplier': struct.unpack('<f', pe.get_data(0x5C9160 - 0x400000, 4))[0],
                             'trailUnit': struct.unpack('<f', pe.get_data(0x5CCFFC - 0x400000, 4))[0],
                             'trailMultiplier': struct.unpack('<f', pe.get_data(0x5C9BE8 - 0x400000, 4))[0]},
            'engine': export_engine(ROOT / 'CDTank/gbengine.dll'),
            'rendering': export_rendering(pe, library['nodes'],
                                         ROOT / 'recovery/output/verified/assets/data'),
            'spriteControls': sprite_controls(library['nodes']),
            'soundControls': sound_controls(library['nodes']),
            'overlayControls': overlay_controls(library['nodes']),
            'screenControls': screen_controls(library['nodes']),
            'modelControls': model_controls(library['nodes']),
            'boltControls': bolt_controls(library['nodes']),
            'stripControls': strip_controls(library['nodes']),
            'particleControls': particle_controls(library['nodes']),
            'nodeTimings': node_timings(library['nodes']), 'sourceSha256': sha256(raw).hexdigest(), 'sourceSize': len(raw),
            'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'runtimeComplete': False,
            'typeCounts': {str(key): value for key, value in sorted(Counter(n['type'] for n in library['nodes']).items())},
            'duplicateIds': [{'id': key, 'count': value} for key, value in identifiers.items()
                             if value > 1],
            'missingReferences': [{'node': n['index'], 'id': child}
                                  for n in library['nodes'] for child in n['children']
                                  if child not in identifiers],
            'linkTargets': coverage, 'resourceLoaders': [hex(x) for x in loaders],
            'evidence': evidence}


if __name__ == '__main__':
    result = export()
    out = ROOT / 'recovery/output/web-assets/effect-library.json'
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'nodes': len(result['nodes']), 'typeCounts': result['typeCounts'],
                      'duplicateIds': len(result['duplicateIds']),
                      'missingReferences': len(result['missingReferences']),
                      'linkTargets': result['linkTargets']}))
