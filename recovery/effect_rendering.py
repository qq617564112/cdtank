"""Recover ordered GBF scripts and type-1 selectors, without inventing defaults."""
from hashlib import sha256
from pathlib import Path
import re
import struct


def parse_gbf(text):
    text = re.sub(r'//[^\n]*', '', text)
    # Only the grammar present in these scripts is supported; reject other syntax.
    techniques, position = [], 0
    technique = re.compile(r'\s*technique\s+(\w+)\s*\{')
    passt = re.compile(r'\s*pass\s+(\w+)\s*\{')
    assignment = re.compile(r'\s*(\w+(?:\[\d+\])?)\s*=\s*([\w|\s]+);')
    while text[position:].strip():
        match = technique.match(text, position)
        if not match:
            raise ValueError('unsupported GBF technique syntax')
        name, position, passes = match[1], match.end(), []
        while True:
            closing = re.match(r'\s*\}', text[position:])
            if closing:
                position += closing.end()
                break
            match = passt.match(text, position)
            if not match:
                raise ValueError('unsupported GBF pass syntax')
            pass_name, position, states = match[1], match.end(), []
            while True:
                closing = re.match(r'\s*\}', text[position:])
                if closing:
                    position += closing.end()
                    break
                match = assignment.match(text, position)
                if not match:
                    raise ValueError('unsupported GBF state syntax')
                states.append({'name': match[1], 'value': re.sub(r'\s+', '', match[2]).upper()})
                position = match.end()
            passes.append({'name': pass_name, 'states': states})
        techniques.append({'name': name, 'passes': passes})
    if not techniques or any(not t['passes'] for t in techniques):
        raise ValueError('empty GBF technique')
    return techniques


def sprite_selector(flags, screen_space):
    if screen_space:
        return 5 if flags & 4 else 4
    if flags & 2:
        return (7 if flags & 8 else 3) if flags & 4 else (9 if flags & 8 else 2)
    return (6 if flags & 8 else 1) if flags & 4 else (8 if flags & 8 else 0)


def export_rendering(pe, nodes, source_root):
    import capstone
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    entries = []
    for instruction in decoder.disasm(pe.get_data(0x47ad28 - 0x400000, 0x47ae78 - 0x47ad28), 0x47ad28):
        if instruction.mnemonic != 'push' or not instruction.op_str.startswith('0x5c'):
            continue
        address = int(instruction.op_str, 16)
        path_bytes = pe.get_data(address - 0x400000, 128).split(b'\0', 1)[0]
        path = path_bytes.decode('ascii')
        relative = path.replace('\\', '/')
        matches = [p for p in source_root.rglob('*.gbf')
                   if p.relative_to(source_root).as_posix().lower() == relative.lower()]
        if len(matches) != 1:
            raise ValueError(f'GBF source is not unique: {path}')
        source = matches[0]
        raw = source.read_bytes()
        entries.append({'index': len(entries), 'path': path, 'pathBytes': path_bytes.hex(),
                        'pathVa': hex(address), 'pushVa': hex(instruction.address),
                        'source': source.relative_to(source_root).as_posix(),
                        'sourceSha256': sha256(raw).hexdigest(),
                        'techniques': parse_gbf(raw.decode('ascii'))})
    if len(entries) != 11:
        raise ValueError('original GBF registration count changed')
    rows, particle_rows = [], []
    for node in nodes:
        if node['type'] == 6:
            for index, modifier in enumerate(node['modifiers']):
                flags = struct.unpack_from('<I', bytes.fromhex(modifier['payload']), 581)[0]
                particle_rows.append({'node': node['index'], 'modifier': index, 'flags': flags,
                                      'selector': sprite_selector(flags, False)})
        if node['type'] != 1:
            continue
        screen_space = bool(bytes.fromhex(node['resource'])[669])
        for index, modifier in enumerate(node['modifiers']):
            flags = struct.unpack_from('<I', bytes.fromhex(modifier['payload']), 154)[0]
            rows.append({'node': node['index'], 'modifier': index, 'flags': flags,
                         'screenSpace': screen_space,
                         'selector': sprite_selector(flags, screen_space)})
    overlay_scripts = []
    for textured, address, push_va, offset in [(True, 0x5c6290, 0x447c66, 0x24), (False, 0x5c6230, 0x447c90, 0x20)]:
        path = pe.get_data(address - 0x400000, 128).split(b'\0', 1)[0].decode('ascii')
        relative = path.replace('\\', '/')
        source = next(p for p in source_root.rglob('*.gbf') if p.relative_to(source_root).as_posix().lower() == relative.lower())
        overlay_scripts.append(dict(textured=textured, path=path, pathVa=hex(address), pushVa=hex(push_va),
            gfxOffset=offset, source=source.relative_to(source_root).as_posix(), techniques=parse_gbf(source.read_text())))
    return {'scripts': entries, 'overlayScripts': overlay_scripts, 'spriteSelections': rows, 'particleSelections': particle_rows,
            'implicitStatesResolved': False}
