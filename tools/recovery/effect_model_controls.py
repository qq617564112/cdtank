"""Type5 model controls read by 0x476ce7 and resource animation rate."""
import struct


def model_controls(nodes):
    rows=[]
    for node in nodes:
        if node['type'] != 5:
            continue
        resource=bytes.fromhex(node['resource'])
        for index,modifier in enumerate(node['modifiers']):
            raw=bytes.fromhex(modifier['payload'])
            start,end,flag=struct.unpack('<ffB',bytes.fromhex(modifier['base']))
            vectors=[list(struct.unpack_from('<3f',raw,offset)) for offset in range(0,96,12)]
            rows.append(dict(node=node['index'],modifier=index,baseStart=start,baseEnd=end,
                baseFlag=flag,scale=vectors[0],scaleRate=vectors[1],
                motion=dict(position=vectors[2],velocity=vectors[3],acceleration=vectors[4]),
                angles=vectors[5],angleRate=vectors[6],
                orbit=dict(axis=vectors[7],radius=struct.unpack_from('<f',raw,96)[0],
                    angularRate=struct.unpack_from('<f',raw,100)[0]),
                alpha=struct.unpack_from('<f',raw,104)[0],alphaRate=struct.unpack_from('<f',raw,108)[0],
                modelParameter=struct.unpack_from('<I',raw,112)[0],
                reference=resource[:324].split(b'\0')[0].decode('gb18030'),
                animationRate=struct.unpack_from('<f',resource,324)[0]))
    return rows
