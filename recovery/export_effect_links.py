"""Recover ELK grouping and raw records using the original 0x47cf35 loader."""
from hashlib import sha256
import json
from pathlib import Path
import struct

import capstone
import pefile
from effect_action_keys import action_identifier

ROOT = Path(__file__).resolve().parents[1]


def read_links(raw):
    offset = 0

    def take(size):
        nonlocal offset
        if offset + size > len(raw):
            raise ValueError(f'truncated ELK at {offset}, need {size} bytes')
        value = raw[offset:offset + size]
        offset += size
        return value

    def uint():
        return struct.unpack('<I', take(4))[0]

    def string(value):
        return value.split(b'\0')[0].decode('ascii')

    groups = []
    for _ in range(uint()):
        key = uint()
        actions = []
        for _ in range(uint()):
            name = string(take(16))
            records = []
            for _ in range(uint()):
                start = offset
                record = take(0x294)
                # Constructor 0x47baf1 proves two 0x144-byte fields at +4/+0x148.
                # Preserve entire fields: only their initial strings are identified.
                records.append({'offset': start, 'raw': record.hex(),
                                'field04String': string(record[4:0x148]),
                                'field148String': string(record[0x148:0x28c]),
                                'bindingMode': struct.unpack_from('<i', record, 0x28c)[0],
                                'field290': struct.unpack_from('<f', record, 0x290)[0]})
            actions.append({'name': name, 'records': records})
        groups.append({'key': key, 'keyHex': f'0x{key:08x}', 'actions': actions})
    if offset != len(raw):
        raise ValueError(f'unconsumed ELK bytes: {len(raw) - offset}')
    return groups


def export():
    exe = ROOT / 'CDTank/CDTank.exe'
    pe = pefile.PE(str(exe))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    assert pe.get_data(0x47D00C - base, 5) == bytes.fromhex('6894020000')
    assert pe.get_data(0x47CFDB - base, 2) == bytes.fromhex('6a10')
    assert pe.get_data(0x5C87A4 - base, 11).split(b'\0')[0] == b'%s\\%s.elk'
    ranges = [('threePartLoad', 0x46A1E7, 0x46A21A),
              ('fourPartLoad', 0x46D6D6, 0x46D709),
              ('elkLoader', 0x47CF35, 0x47D0AF),
              ('recordConstructor', 0x47BAF1, 0x47BB2F),
              ('linkReplaceAllGoto', 0x46610F, 0x4661C9),
              ('linkReplaceAttack', 0x4661C9, 0x466280),
              ('linkActionDispatch', 0x4675A1, 0x467A08),
              ('linkGotoThreePart', 0x46A5E5, 0x46A6F8),
              ('linkGotoFourPart', 0x46DAF1, 0x46DC4F),
              ('modelTagMatrix', 0x46748F, 0x467517),
              ('startLinkedMatrix', 0x47B29E, 0x47B322)]
    evidence = {name: [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                       'instruction': f'{i.mnemonic} {i.op_str}'}
                      for i in decoder.disasm(pe.get_data(start - base, end - start), start)]
                for name, start, end in ranges}
    directory = ROOT / 'recovery/output/verified/assets/data/Data/effect/link'
    files = []
    for path in sorted(directory.glob('*.elk')):
        raw = path.read_bytes()
        files.append({'tankCode': path.stem, 'path': f'Data/effect/link/{path.name}',
                      'sha256': sha256(raw).hexdigest(), 'size': len(raw),
                      'groups': read_links(raw)})
    expected = ['001', '002', '003', '004', '051', '052', '053', '054',
                '101', '102', '103', '104', '105', *[str(n) for n in range(151, 159)]]
    present = {f['tankCode'] for f in files}
    return {'sourceSha256': sha256(exe.read_bytes()).hexdigest(),
            'recordSize': 0x294, 'runtimeComplete': False,
            'actionKeys': [{'name': name, 'id': action_identifier(name),
                            'idHex': f'0x{action_identifier(name):08x}'}
                           for name in ['03', '09', 'goto_action', 'attack1', 'attack3', 'effect1']],
            'missingTankCodes': [code for code in expected if code not in present],
            'evidence': evidence, 'files': files}


if __name__ == '__main__':
    result = export()
    out = ROOT / 'recovery/output/web-assets/effect-links.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'files': len(result['files']),
                      'missingTankCodes': result['missingTankCodes']}))
