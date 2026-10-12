"""Decode the supplied scene Breach payload; field names retain native offsets.

CDTank.exe 0x461f60 reads these fields after the common placement header.
This payload has no recovered HP field. Concrete General/Crush behavior differs.
"""
import struct
from mv3 import Reader


def decode_breach_tail(raw):
    reader = Reader(raw)
    stamp = reader.integer()
    if stamp != 0x778346a2:
        raise ValueError(f'Unsupported Breach stamp {stamp:#x}')
    fields = {'stamp': stamp}
    for key, kind in [('field04', 'string'), ('field20', 'byte'),
                      ('field24', 'string'), ('field5c', 'float'),
                      ('field60', 'string'), ('field88', 'byte')]:
        if kind == 'string':
            fields[key] = reader.name(reader.integer())
        else:
            fields[key] = reader.unpack('B' if kind == 'byte' else 'f')[0]
    fields['extensionStamp'] = reader.integer()
    # This marker is shared by several derived classes, including Breach.
    # It must not be used by itself to infer a General runtime class.
    if fields['extensionStamp'] != 0x778344ad or reader.position != len(raw):
        raise ValueError('Unsupported Breach extension or trailing bytes')
    return fields


def encode_breach_tail(fields):
    raw = bytearray(struct.pack('<I', fields['stamp']))
    for key, kind in [('field04', 'string'), ('field20', 'byte'),
                      ('field24', 'string'), ('field5c', 'float'),
                      ('field60', 'string'), ('field88', 'byte')]:
        if kind == 'string':
            text = fields[key].encode('gbk')
            raw.extend(struct.pack('<I', len(text)))
            raw.extend(text)
        else:
            raw.extend(struct.pack('<B' if kind == 'byte' else '<f', fields[key]))
    raw.extend(struct.pack('<I', fields['extensionStamp']))
    return bytes(raw)
