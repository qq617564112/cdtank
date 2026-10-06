"""Decode type-1 frame controls proven by 0x476319 / 0x4830e1."""
import struct


def sprite_controls(nodes):
    rows = []
    for node in nodes:
        if node['type'] != 1:
            continue
        resource = bytes.fromhex(node['resource'])
        frame_count = struct.unpack_from('<I', resource, 656)[0]
        for index, modifier in enumerate(node['modifiers']):
            raw = bytes.fromhex(modifier['payload'])
            if len(raw) != 158:
                raise ValueError('unsupported sprite controller size')
            interval, flags = struct.unpack_from('<fI', raw, 136)
            start, end, base_flag = struct.unpack('<ffB', bytes.fromhex(modifier['base']))
            vectors = [list(struct.unpack_from('<fff', raw, offset))
                       for offset in range(0, 96, 12)]
            rows.append({'node': node['index'], 'modifier': index,
                         'frameCount': frame_count, 'frameInterval': interval,
                         'frameFlags': flags, 'baseStart': start,
                         'baseEnd': end, 'baseFlag': base_flag,
                         'appearance': {'scale': vectors[0], 'scaleRate': vectors[1],
                                        'angles': vectors[5], 'angleRate': vectors[6],
                                        'color': list(struct.unpack_from('<ffff', raw, 104)),
                                        'colorSubtractRate': list(struct.unpack_from('<ffff', raw, 120))},
                         'motion': {'position': vectors[2], 'velocity': vectors[3],
                                    'acceleration': vectors[4]},
                         'orbit': {'axis': vectors[7],
                                   'radius': struct.unpack_from('<f', raw, 96)[0],
                                   'angularRate': struct.unpack_from('<f', raw, 100)[0]},
                         'endOnModelAnimation': bool(raw[144]),
                         'trailEnabled': bool(raw[145]),
                         'trailLimit': struct.unpack_from('<I', raw, 146)[0],
                         'trailInterval': struct.unpack_from('<f', raw, 150)[0],
                         'remainingFieldAc': raw[154:].hex()})
    return rows


def node_timings(nodes):
    rows = []
    for node in nodes:
        reference, delay, lifetime = struct.unpack('<Iff', bytes.fromhex(node['fields']))
        controllers = []
        for modifier in node['modifiers']:
            start, end, flag = struct.unpack('<ffB', bytes.fromhex(modifier['base']))
            controllers.append({'start': start, 'end': end, 'flag': flag})
        rows.append({'node': node['index'], 'field14c': reference,
                     'delay': delay, 'lifetime': lifetime, 'controllers': controllers})
    return rows


def particle_controls(nodes):
    """Type-6 fields used directly by emission, rendering and emitter movement."""
    rows = []
    for node in nodes:
        if node['type'] != 6:
            continue
        for index, modifier in enumerate(node['modifiers']):
            raw = bytes.fromhex(modifier['payload'])
            if len(raw) != 602:
                raise ValueError('unsupported particle controller size')
            start, end, flag = struct.unpack('<ffB', bytes.fromhex(modifier['base']))
            rows.append({'node': node['index'], 'modifier': index,
                         'baseStart': start, 'baseEnd': end, 'baseFlag': flag,
                         'emitter': {'countRange': list(struct.unpack_from('<ii', raw, 569)),
                                     'burst': bool(raw[585])},
                         'motion': {'position': list(struct.unpack_from('<3f', raw, 0)),
                                    'velocity': list(struct.unpack_from('<3f', raw, 44))},
                         'orbit': {'axis': list(struct.unpack_from('<3f', raw, 56)),
                                   'radius': struct.unpack_from('<f', raw, 68)[0],
                                   'angularRate': struct.unpack_from('<f', raw, 72)[0]},
                         'pathEnabled': bool(raw[76]),
                         'renderFlags': struct.unpack_from('<I', raw, 581)[0],
                         'particleMotion': {'mode': struct.unpack_from('<I', raw, 586)[0],
                                            'acceleration': list(struct.unpack_from('<3f', raw, 590))},
                         'particleFrame': {'frameCount': struct.unpack_from('<I', bytes.fromhex(node['resource']), 332)[0],
                                           'frameInterval': struct.unpack_from('<f', raw, 409)[0],
                                           'frameFlags': struct.unpack_from('<I', raw, 413)[0]},
                         'alphaMode': struct.unpack_from('<I', raw, 577)[0],
                         'capacity': struct.unpack_from('<I', bytes.fromhex(node['resource']), 336)[0],
                         'spawn': {'shape': struct.unpack_from('<I', raw, 12)[0],
                                   'boxMin': list(struct.unpack_from('<3f', raw, 16)),
                                   'boxMax': list(struct.unpack_from('<3f', raw, 28)),
                                   'radius': struct.unpack_from('<f', raw, 40)[0],
                                   'ranges': {
                                       'angles': [list(struct.unpack_from('<3f', raw, 417)), list(struct.unpack_from('<3f', raw, 429))],
                                       'acceleration': [list(struct.unpack_from('<3f', raw, 441)), list(struct.unpack_from('<3f', raw, 453))],
                                       'velocity': [list(struct.unpack_from('<3f', raw, 465)), list(struct.unpack_from('<3f', raw, 477))],
                                       'angleRate': [list(struct.unpack_from('<3f', raw, 489)), list(struct.unpack_from('<3f', raw, 501))],
                                       'lifetime': list(struct.unpack_from('<2f', raw, 513)),
                                       'scale': list(struct.unpack_from('<2f', raw, 521)),
                                       'rgb': [list(struct.unpack_from('<3f', raw, 529)), list(struct.unpack_from('<3f', raw, 541))],
                                       'alpha': list(struct.unpack_from('<2f', raw, 553)),
                                       'frame': list(struct.unpack_from('<2i', raw, 561))}}})
    return rows
