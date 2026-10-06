"""Decode type4 fields read by the original loader 0x476b09."""
import struct


def sound_controls(nodes):
    rows = []
    for node in nodes:
        if node['type'] != 4:
            continue
        resource = bytes.fromhex(node['resource'])
        rows.append(dict(node=node['index'], reference=resource[:324].split(b'\0')[0].decode('gb18030'),
            parameter=struct.unpack_from('<I', resource, 324)[0], stopPrevious=bool(resource[328])))
    return rows
