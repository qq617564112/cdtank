"""Type2 lightning resource fields read by 0x476839."""
import struct


def bolt_controls(nodes):
    rows=[]
    for node in nodes:
        if node['type']!=2:
            continue
        raw=bytes.fromhex(node['resource'])
        fields=struct.unpack_from('<12f',raw,324)
        rows.append(dict(node=node['index'],reference=raw[:324].split(b'\0')[0].decode('gb18030'),
            start=list(fields[:3]),end=list(fields[3:6]),interval=fields[6],width=fields[7],
            lengthRange=list(fields[8:10]),angleRange=list(fields[10:12]),
            color=struct.unpack_from('<I',raw,372)[0],
            parameter=struct.unpack_from('<I',raw,376)[0],flag=bool(raw[380])))
    return rows
