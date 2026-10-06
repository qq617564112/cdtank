"""Decode SYcScnObjSound's 0x461f60 / 0x45eaab placement tail."""
from mv3 import Reader


def decode_sound_tail(raw):
    reader = Reader(raw)
    stamp = reader.integer()
    if stamp != 0x778346a2:
        raise ValueError(f'Unsupported Sound stamp {stamp:#x}')
    fields = {'stamp': stamp}
    for key, kind in [('field04', 'string'), ('field20', 'byte'),
                      ('field24', 'string'), ('field5c', 'float'),
                      ('field60', 'string'), ('field88', 'byte')]:
        fields[key] = (reader.name(reader.integer()) if kind == 'string'
                       else reader.unpack('B' if kind == 'byte' else 'f')[0])
    fields['extensionStamp'] = reader.integer()
    fields['intervalMs'] = reader.integer()
    fields['randomGate'] = reader.unpack('B')[0]
    if fields['extensionStamp'] != 0x778346a1 or reader.position != len(raw):
        raise ValueError('Unsupported Sound extension or trailing bytes')
    return fields
