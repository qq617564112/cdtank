"""Export original battle sound call paths without inventing browser mixing rules."""
from hashlib import sha256
import json
from pathlib import Path
import struct

import capstone
import pefile
from inspect_assets import read_table

ROOT = Path(__file__).resolve().parents[1]


def export():
    source = ROOT / 'CDTank/CDTank.exe'
    raw = source.read_bytes()
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

    def data(va, size):
        return pe.get_data(va - base, size)

    def instructions(start, end):
        return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                 'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
                for i in decoder.disasm(data(start, end - start), start)]

    # Selector values are read from the executable, not inferred from WAV names.
    assert data(0x4CF166, 3) == bytes.fromhex('c745fc')
    assert data(0x4CF174, 3) == bytes.fromhex('c745fc')
    selectors = [struct.unpack('<I', data(va, 4))[0] for va in (0x4CF169, 0x4CF177)]
    assert data(0x4D654D, 3) == bytes.fromhex('83c029')
    bias = data(0x4D654F, 1)[0]
    table = read_table(ROOT / 'CDTank/Data/table/musicstring.dat')
    names = {int(r['values']['ID']): r['values']['String'] for r in table['rows']}
    selected = []
    for tank_type, selector in zip((1, 2), selectors):
        sound_id = selector + bias
        name = names[sound_id]
        wav = ROOT / f'CDTank/Data/sound/{name}.wav'
        assert wav.is_file()
        selected.append({'tankType': tank_type, 'selector': selector, 'soundId': sound_id,
                         'name': name, 'asset': f'audio/sound/{name}.wav',
                         'sha256': sha256(wav.read_bytes()).hexdigest()})
    assert [(r['soundId'], r['name']) for r in selected] == [(55, 'GA14'), (87, 'GA46')]
    # Getter 0x11 follows the original switch table to role-record +0x5c.
    team_branch = struct.unpack('<I', data(0x4324D4 + 17 * 4, 4))[0]
    assert team_branch == 0x432492
    assert data(team_branch, 3) == bytes.fromhex('8b405c')
    paths = {hex(va): data(va, 40).split(b'\0')[0].decode('ascii')
             for va in (0x5C9EF8, 0x5C9EF4, 0x5C9AAC)}
    assert list(paths.values()) == ['data\\sound', '/', '.wav']
    imports = {hex(i.address): {'dll': d.dll.decode(), 'name': i.name.decode()}
               for d in pe.DIRECTORY_ENTRY_IMPORT for i in d.imports
               if i.address in (0x5C0738, 0x5C073C, 0x5C0740) and i.name}
    assert [imports[hex(a)]['name'] for a in (0x5C0738, 0x5C073C, 0x5C0740)] == [
        'alSource3f', 'alSourcef', 'alSourcei']
    assert data(0x57178B, 5) == bytes.fromhex('6804d00000')
    assert data(0x571EBC, 3) == bytes.fromhex('89460c')
    assert data(0x571EC3, 3) == bytes.fromhex('894610')
    assert data(0x571ECC, 3) == bytes.fromhex('894614')
    reference, maximum, rolloff = [struct.unpack('<f', data(va, 4))[0]
                                  for va in (0x5C1540, 0x5C1DA4, 0x5CCFF8)]
    assert (reference, maximum, rolloff) == (100, 1600, 2)
    # HUD skill-dispatch jump table: argument skillId - 2001, then byte indirection.
    assert data(0x4CF023, 5) == bytes.fromhex('052ff8ffff')
    assert data(0x428CB2, 5) == bytes.fromhex('68d1070000')
    dispatch = data(0x4CF117, 21)
    branches = struct.unpack('<4I', data(0x4CF107, 16))
    fire = []
    skill_table = read_table(ROOT / 'CDTank/Data/table/skill.dat')
    skills = {int(r['values']['SkillTableID']): r['values'] for r in skill_table['rows']}
    for index, branch_index in enumerate(dispatch):
        branch = branches[branch_index]
        # Every branch pushes a direct original WAV stem into 0x485b1b.
        decoded = list(decoder.disasm(data(branch, 54), branch))
        pushed = [int(i.op_str, 16) for i in decoded if i.mnemonic == 'push'
                  and i.op_str.startswith('0x') and int(i.op_str, 16) > base]
        assert len(pushed) == 1
        name_va = pushed[0]
        name = data(name_va, 20).split(b'\0')[0].decode('ascii')
        assert name in ('GA07', 'GA08', 'GA09', 'GA10')
        sound_id = next(key for key, value in names.items() if value == name)
        skill_id = 2001 + index
        fire.append({'skillId': skill_id, 'skillName': skills[skill_id]['SkillName'],
                     'soundId': sound_id, 'name': name, 'nameVa': hex(name_va),
                     'branchVa': hex(branch), 'asset': f'audio/sound/{name}.wav'})
    assert fire[0]['name'] == 'GA07'
    ranges = [('attackerCallback', 0x429101, 0x42914C),
              ('killHud', 0x4CF12C, 0x4CF21F),
              ('soundSelectorBias', 0x4D6541, 0x4D6561),
              ('soundIdLookup', 0x4178C9, 0x4178E4),
              ('wavPathAndSpatialDispatch', 0x485C1B, 0x485D96),
              ('spatialPlayer', 0x571D14, 0x571DE3),
              ('openalSourceParameters', 0x56FEE9, 0x56FFCA),
              ('audioManagerDefaults', 0x5715E3, 0x571611),
              ('initialSpatialOverride', 0x416A93, 0x416ABF),
              ('spatialOverrideSetter', 0x571E9F, 0x571ECF),
              ('distanceModel', 0x57178B, 0x571796),
              ('frameListener', 0x45004A, 0x45008A),
              ('listenerWrappers', 0x56FD88, 0x56FE33),
              ('skillHudCallbackRegistration', 0x4D4338, 0x4D4364),
              ('skillCallbackDispatch', 0x42312D, 0x423146),
              ('defaultShotSkill', 0x428CB2, 0x428CC1),
              ('receivedSkillDispatch', 0x4245C9, 0x424614),
              ('skillHudAttackAndAudio', 0x4CEFC9, 0x4CF107),
              ('tankDirectSoundHelpers', 0x46484B, 0x4648F0),
              ('tankHelperCaller', 0x422BC6, 0x422C27),
              ('woundHudNoSoundCall', 0x4CEEBD, 0x4CEF02),
              ('deathHud', 0x4CEF02, 0x4CEFC9)]
    return {'source': str(source), 'sha256': sha256(raw).hexdigest(),
            'musicStringSource': table['source'], 'musicStringSha256': table['sha256'],
            'killSound': {'owner': 'destroy attacker callback +0x90',
                'selections': selected, 'bias': bias,
                'conditions': {'hudModes3And4': 'all roster attackers',
                               'hudModes0To2': 'attacker property 0x11 equals local property 0x11'},
                'position': 'attacker role +0x310 vtable +0x1c argument 1',
                'unknownTankType': 'selector remains zero; lookup ID41 (UI41), no substitution'},
            'paths': paths, 'imports': imports,
            'openalParameters': {'0x1004': 'position', '0x1006': 'velocity',
                '0x1005': 'direction', '0x1020': 'reference distance',
                '0x1021': 'rolloff factor', '0x1023': 'maximum distance',
                '0x202': 'source relative = false'},
            'managerDefaults': {'referenceDistance': 10, 'rolloffFactor': 1, 'maxDistance': 100},
            'spatial': {'referenceDistance': reference, 'rolloffFactor': rolloff,
                        'maxDistance': maximum, 'distanceModel': 'linear',
                        'originalDistanceModel': 'AL_LINEAR_DISTANCE_CLAMPED (0xd004)'},
            'listener': {'position': 'per-frame camera result +0x18',
                         'forward': 'per-frame camera result +0x48',
                         'up': 'per-frame camera result +0x3c',
                         'source': '0x45004a vtable+0x28 -> 0x56fd88/0x56fdea'},
            'fireSound': {'callbackOffset': '0x8c', 'defaultSkillId': 2001,
                          'owner': 'skill-using role, no team filter', 'selections': fire,
                          'portraitFlag': 2, 'position': 'role +0x310 vtable+0x1c argument 1',
                          'skillSource': skill_table['source'], 'skillSha256': skill_table['sha256'],
                          'dispatchBytes': dispatch.hex(),
                          'limits': ['Skill sound and attack portrait do not prove damage/projectile rules.',
                                     'Skill IDs outside 2001–2021 have no direct WAV branch here.']},
            'directTankHelpers': [
                {'entryVa': hex(entry), 'nameVa': hex(va),
                 'name': data(va, 20).split(b'\0')[0].decode('ascii'),
                 'event': 'upstream semantics unresolved'}
                for entry, va in [(0x46484B, 0x5C821C), (0x464882, 0x5C8224),
                                  (0x4648B9, 0x5C822C)]],
            'disassembly': {name: instructions(start, end) for name, start, end in ranges},
            'limits': ['Camera mode fidelity and original OpenAL versus browser panning remain unverified.',
                       'No browser battle WAV triggers are wired by this evidence export.',
                       'Wound/death HUD callbacks do not establish the tank-level sound trigger.',
                       'Original source position is confirmed, but current Web server rules remain prototype.']}


if __name__ == '__main__':
    output = ROOT / 'recovery/output/audio-events.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(export(), ensure_ascii=False, indent=2) + '\n')
    print('Exported source kill and 21 skill-fire selections, ownership, WAV path and OpenAL evidence')
