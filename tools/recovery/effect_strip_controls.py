"""Type7 controls and geometry fields read by 0x477337/0x477636."""
import struct


def strip_controls(nodes):
    rows=[]
    for node in nodes:
        if node['type'] != 7: continue
        resource=bytes.fromhex(node['resource'])
        geometry=dict(extent=struct.unpack_from('<f',resource,336)[0],outerHeight=struct.unpack_from('<f',resource,340)[0],segments=struct.unpack_from('<I',resource,344)[0],alternatingWidth=list(struct.unpack_from('<2f',resource,348)),radii=list(struct.unpack_from('<2f',resource,356)),radiusRates=list(struct.unpack_from('<2f',resource,364)),heightRates=list(struct.unpack_from('<2f',resource,372)),textureLength=struct.unpack_from('<f',resource,380)[0])
        for index,modifier in enumerate(node['modifiers']):
            raw=bytes.fromhex(modifier['payload']);start,end,flag=struct.unpack('<ffB',bytes.fromhex(modifier['base']))
            vectors=[list(struct.unpack_from('<3f',raw,o)) for o in range(0,96,12)]
            rows.append(dict(node=node['index'],modifier=index,baseStart=start,baseEnd=end,baseFlag=flag,motion=dict(position=vectors[2],velocity=vectors[3],acceleration=vectors[4]),orbit=dict(axis=vectors[7],radius=struct.unpack_from('<f',raw,96)[0],angularRate=struct.unpack_from('<f',raw,100)[0]),scale=vectors[0],scaleRate=vectors[1],angles=vectors[5],angleRate=vectors[6],color=list(struct.unpack_from('<4f',raw,104)),colorAddRate=list(struct.unpack_from('<4f',raw,120)),frameCount=struct.unpack_from('<I',resource,332)[0],frameInterval=struct.unpack_from('<f',raw,136)[0],frameFlags=struct.unpack_from('<I',raw,140)[0],endOnModelAnimation=bool(raw[144]),renderFlags=struct.unpack_from('<I',raw,145)[0],scrollRate=struct.unpack_from('<f',raw,149)[0],geometry=geometry))
    return rows
