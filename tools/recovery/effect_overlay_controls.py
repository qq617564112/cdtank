"""Type8 fields read by resource 0x477aef and modifier 0x4779ce."""
import struct


def overlay_controls(nodes):
    rows = []
    for node in nodes:
        if node['type'] != 8:
            continue
        resource = bytes.fromhex(node['resource'])
        for index, modifier in enumerate(node['modifiers']):
            raw = bytes.fromhex(modifier['payload'])
            start, end, flag = struct.unpack('<ffB', bytes.fromhex(modifier['base']))
            rows.append(dict(node=node['index'], modifier=index, baseStart=start,
                baseEnd=end, baseFlag=flag, textured=bool(resource[0]),
                reference=resource[1:325].split(b'\0')[0].decode('gb18030'),
                color=list(struct.unpack_from('<4f', raw)),
                colorAddRate=list(struct.unpack_from('<4f', raw, 16)),
                frameCount=struct.unpack_from('<I', resource, 333)[0],
                frameInterval=struct.unpack_from('<f', raw, 32)[0],
                frameFlags=struct.unpack_from('<I', raw, 36)[0]))
    return rows
