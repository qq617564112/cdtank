"""Align map NAV heights with the wooden bridge deck surfaces."""
import base64
import math
import struct


BRIDGE_DECK_PARTS = {
    '0003': tuple((name, 0, tuple(range(6, 14)))
                  for name in ('line712', 'line736', 'line737', 'line738')),
    '0016': (
        ('box10625', 0, (0, 1)), ('box10638', 0, (0, 1)),
        ('box10641', 1, (0, 1, 10, 11, 20, 21)),
        ('box10642', 0, (0, 1)), ('box10643', 0, (0, 1)),
        ('box10644', 0, (0, 1)), ('box10645', 0, (0, 1)),
        ('box10646', 0, (0, 1)), ('box10647', 0, (0, 1)),
        ('box10648', 0, (0, 1)),
    ),
}


def deck_navigation(layer, triangles, repair_passage=True):
    """Project cell centers onto deck tops, preserving other NAV fields."""
    cells = bytearray(base64.b64decode(layer['cells']))
    width, height = layer['width'], layer['height']
    origin_x, _, origin_z = layer['minimum']
    heights = {}
    for a, b, c in triangles:
        denominator = ((b[2] - c[2]) * (a[0] - c[0])
                       + (c[0] - b[0]) * (a[2] - c[2]))
        left = max(0, math.ceil((min(a[0], b[0], c[0]) - origin_x - 6) / 12))
        right = min(width - 1, math.floor((max(a[0], b[0], c[0]) - origin_x - 6) / 12))
        top = max(0, math.ceil((min(a[2], b[2], c[2]) - origin_z - 6) / 12))
        bottom = min(height - 1, math.floor((max(a[2], b[2], c[2]) - origin_z - 6) / 12))
        for row in range(top, bottom + 1):
            for column in range(left, right + 1):
                x, z = origin_x + column * 12 + 6, origin_z + row * 12 + 6
                u = ((b[2] - c[2]) * (x - c[0])
                     + (c[0] - b[0]) * (z - c[2])) / denominator
                v = ((c[2] - a[2]) * (x - c[0])
                     + (a[0] - c[0]) * (z - c[2])) / denominator
                if u < -1e-8 or v < -1e-8 or u + v > 1 + 1e-8:
                    continue
                index = row * width + column
                value = u * a[1] + v * b[1] + (1 - u - v) * c[1]
                heights[index] = max(heights.get(index, value), value)
    for index, value in heights.items():
        offset = index * 8
        fields = struct.unpack_from('<I', cells, offset + 4)[0]
        if fields & 255 <= 1:
            if not repair_passage:
                continue
            fields = (fields & ~255) | 5
        struct.pack_into('<fI', cells, offset, value, fields)
    return {**layer, 'cells': base64.b64encode(cells).decode('ascii')}


def patch_bridge_navigation(identifier, layer, terrain):
    parts = BRIDGE_DECK_PARTS.get(identifier)
    if parts is None:
        return layer
    triangles = []
    for name, part, face_indexes in parts:
        mesh = next(mesh for mesh in terrain['meshes'] if mesh['name'] == name)
        vertices = [struct.unpack_from('<3f', vertex) for vertex in mesh['vertices']]
        # Only deck top faces supply ground heights; rails and posts stay
        # in the collision mesh. The 0016 NAV retains its passage boundaries.
        triangles.extend([vertices[index] for index in face]
                         for face in (mesh['parts'][part]['faces'][index]
                                      for index in face_indexes))
    return deck_navigation(layer, triangles, repair_passage=identifier == '0003')
