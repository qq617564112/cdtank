"""Read original effect library records, retaining unknown fields losslessly."""
import struct


class Reader:
    def __init__(self, raw):
        self.raw = raw
        self.offset = 0

    def take(self, size):
        if size < 0 or size > len(self.raw) - self.offset:
            raise ValueError(f'truncated effect library at {self.offset}, need {size}')
        start = self.offset
        self.offset += size
        return self.raw[start:self.offset]

    def uint(self):
        return struct.unpack('<I', self.take(4))[0]

    def block(self):
        return self.take(self.uint())


def read_library(raw):
    reader = Reader(raw)
    version = struct.unpack('<f', reader.take(4))[0]
    if version != 1:
        raise ValueError(f'unsupported effect library version {version}')
    nodes = []
    for index in range(reader.uint()):
        start = reader.offset
        kind, identifier = reader.uint(), reader.uint()
        if kind not in range(12):
            raise ValueError(f'unknown effect type {kind}')
        name_field = reader.take(0x144)
        name = name_field.split(b'\0')[0].decode('gb18030')
        fields = reader.take(12)
        resource = reader.block()
        modifiers = []
        for _ in range(reader.uint()):
            base = reader.block()
            if len(base) != 9:
                raise ValueError(f'unsupported modifier base size {len(base)}')
            payload = reader.block() if kind in (1, 5, 6, 7, 8, 9) else b''
            modifiers.append({'base': base.hex(), 'payload': payload.hex()})
        children = [reader.uint() for _ in range(reader.uint())]
        nodes.append({'index': index, 'offset': start, 'size': reader.offset - start,
                      'type': kind, 'id': identifier, 'name': name,
                      'nameField': name_field.hex(), 'fields': fields.hex(),
                      'resource': resource.hex(), 'modifiers': modifiers,
                      'children': children})
    if reader.offset != len(raw):
        raise ValueError(f'unconsumed bytes: {len(raw) - reader.offset}')
    return {'version': version, 'nodes': nodes}


def rebuild_library(library):
    def uint(value):
        return struct.pack('<I', value)

    def block(value):
        return uint(len(value)) + value

    raw = struct.pack('<fI', library['version'], len(library['nodes']))
    for node in library['nodes']:
        raw += uint(node['type']) + uint(node['id'])
        raw += bytes.fromhex(node['nameField']) + bytes.fromhex(node['fields'])
        raw += block(bytes.fromhex(node['resource'])) + uint(len(node['modifiers']))
        for modifier in node['modifiers']:
            raw += block(bytes.fromhex(modifier['base']))
            if node['type'] in (1, 5, 6, 7, 8, 9):
                raw += block(bytes.fromhex(modifier['payload']))
        raw += uint(len(node['children']))
        raw += b''.join(uint(child) for child in node['children'])
    return raw
