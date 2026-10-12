"""Recover GameBox CPK assets and CF_Flag_001 tables for feasibility analysis.

Never executes the Windows client or modifies the source directory.
"""

import argparse
import collections
import csv
import hashlib
import json
from pathlib import Path
import struct

import lzokay


def u32(data, offset):
    return struct.unpack_from('<I', data, offset)[0]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def read_cpk(path, target):
    data = path.read_bytes()
    if data[:4] != b'RST\x1a' or u32(data, 4) != 1:
        raise ValueError(f'Unsupported CPK: {path}')
    start, count = u32(data, 8), u32(data, 32)
    if start + count * 28 > len(data):
        raise ValueError('Truncated CPK index')
    entries = {}
    for index in range(count):
        crc, flags, parent, offset, packed, original, extra = struct.unpack_from(
            '<7I', data, start + index * 28)
        if not extra or not flags & 1 or flags & 0x10:
            continue
        if offset + packed + extra > len(data):
            raise ValueError(f'CPK entry outside archive: {index}')
        name_bytes = data[offset + packed:offset + packed + extra]
        name = name_bytes.split(b'\0', 1)[0].decode('gbk')
        if not name or name in ('.', '..') or any(c in name for c in '/\\:'):
            raise ValueError(f'Unsafe CPK name: {name!r}')
        if crc in entries:
            raise ValueError(f'Duplicate live CRC: {crc:x}')
        entries[crc] = dict(index=index, crc=crc, flags=flags, parent=parent,
                            offset=offset, packed=packed, original=original, name=name)

    def full_path(crc, ancestors=()):
        if crc in ancestors:
            raise ValueError('CPK directory cycle')
        entry = entries[crc]
        if not entry['parent']:
            return Path(entry['name'])
        parent = entries[entry['parent']]
        if not parent['flags'] & 2:
            raise ValueError('CPK parent is not a directory')
        return full_path(entry['parent'], ancestors + (crc,)) / entry['name']

    recovered = []
    for crc, entry in entries.items():
        relative = full_path(crc)
        if entry['flags'] & 2:
            continue
        blob = data[entry['offset']:entry['offset'] + entry['packed']]
        if entry['flags'] & 0x20000:
            blob = lzokay.decompress(blob, entry['original'])
        elif entry['flags'] & 0x10000:
            pass
        else:
            raise ValueError(f'Unknown storage flags: {entry["flags"]:x}')
        if len(blob) != entry['original']:
            raise ValueError(f'Incorrect unpacked length: {relative}')
        dest = target / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open('xb') as output:
            output.write(blob)
        recovered.append(dict(**entry, path=relative.as_posix(),
                              sha256=hashlib.sha256(blob).hexdigest()))
    return dict(source=str(path.resolve()), sha256=hashlib.sha256(data).hexdigest(),
                index_entries=count, directories=len(entries) - len(recovered),
                files=len(recovered), original_bytes=sum(e['original'] for e in recovered),
                extensions=dict(collections.Counter(Path(e['path']).suffix.lower()
                                                    for e in recovered)), entries=recovered)


def read_table(path):
    data = path.read_bytes()
    if data[:12] != b'CF_Flag_001\0':
        raise ValueError(f'Unsupported table: {path}')
    count, start = u32(data, 12), u32(data, 24)
    if start + count * 20 > len(data):
        raise ValueError('Truncated row index')
    rows, columns, original_columns = [], [], []
    for index in range(count):
        offset, _, blocks, _, row_id = struct.unpack_from('<5I', data, start + index * 20)
        chain, raw = set(), bytearray()
        for _ in range(blocks):
            if offset in chain or offset + 128 > len(data):
                raise ValueError('Invalid table block chain')
            chain.add(offset)
            raw.extend(data[offset:offset + 120])
            offset = u32(data, offset + 120)
        if offset:
            raise ValueError('Unexpected trailing table block')
        if index == 0:
            position = 4
            for _ in range(u32(raw, 0)):
                size = u32(raw, position)
                position += 4
                name = bytes(v ^ 0xaa for v in raw[position:position + size])
                original_columns.append(name.decode('gbk').strip())
                position += size + 12
            # Some original tables repeat a column label. Preserve each value.
            for number, label in enumerate(original_columns):
                candidate = label or f'column_{number + 1}'
                while candidate in columns:
                    candidate += f'_{number + 1}'
                columns.append(candidate)
        else:
            position, values = len(columns) * 4, []
            for column in range(len(columns)):
                size = u32(raw, column * 4)
                if position + size > len(raw):
                    raise ValueError('Truncated table value')
                value = bytes(v ^ 0xaa for v in raw[position:position + size])
                values.append(value.rstrip(b'\0').decode('gbk').strip())
                position += size
            rows.append(dict(recordId=row_id, values=dict(zip(columns, values))))
    return dict(source=str(path.resolve()), sha256=hashlib.sha256(data).hexdigest(),
                columns=columns, originalColumns=original_columns, rows=rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, default=Path('CDTank'))
    parser.add_argument('--out', type=Path, default=Path('recovery/output'))
    args = parser.parse_args()
    source, output = args.client.resolve(), args.out.resolve()
    if output == source or source in output.parents or output in source.parents:
        parser.error('Output and client trees must be separate')
    if output.exists():
        parser.error('Output must be a new directory; existing files are never overwritten')
    output.mkdir(parents=True)
    summary = dict(archives=[], tables=[])
    for label, relative in [('data', 'Data/data.cpk'), ('music', 'Data/music/music.cpk')]:
        archive = read_cpk(source / relative, output / 'assets' / label)
        write_json(output / 'manifests' / f'{label}.json', archive)
        summary['archives'].append({k: v for k, v in archive.items() if k != 'entries'})
        print(f'{label}: recovered {archive["files"]} files', flush=True)
    for path in sorted((source / 'Data/table').glob('*.dat')):
        table = read_table(path)
        write_json(output / 'tables' / f'{path.stem}.json', table)
        with (output / 'tables' / f'{path.stem}.csv').open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=table['columns'])
            writer.writeheader()
            writer.writerows(row['values'] for row in table['rows'])
        summary['tables'].append(dict(name=path.stem, rows=len(table['rows']),
                                      columns=len(table['columns']), sha256=table['sha256']))
        print(f'{path.name}: recovered {len(table["rows"])} rows', flush=True)
    write_json(output / 'summary.json', summary)


if __name__ == '__main__':
    main()
