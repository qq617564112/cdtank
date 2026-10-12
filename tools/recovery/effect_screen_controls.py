"""Type10 and type11 activation parameters read by the original vtables."""
import struct


def screen_controls(nodes):
    rows=[]
    for node in nodes:
        if node['type'] not in (10, 11):
            continue
        resource = bytes.fromhex(node['resource'])
        row = dict(node=node['index'], type=node['type'])
        if node['type'] == 11:
            row.update(parameter=struct.unpack_from('<I', resource)[0],
                       strength=struct.unpack_from('<f', resource, 4)[0])
        rows.append(row)
    return rows
