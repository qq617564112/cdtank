"""Inspect saved wooden bridge decks and NAV footprints without running movement."""
import argparse
import base64
import json
import math
import struct
from pathlib import Path
from bridge_navigation import BRIDGE_DECK_PARTS


ROOT = Path(__file__).resolve().parents[2]


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def bridge_decks(identifier='0003'):
    path = ROOT / f'apps/web/public/assets/models/hd/maps/{identifier}/{identifier}.glb'
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    model = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]
    decks = {}
    for name, part_index, face_indexes in BRIDGE_DECK_PARTS[identifier]:
        node_name = f'{name}/{part_index}'
        node = next(node for node in model['nodes'] if node.get('name') == node_name)
        part = model['meshes'][node['mesh']]['primitives'][0]
        accessor = model['accessors'][part['attributes']['POSITION']]
        view = model['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        vertices = [struct.unpack_from('<3f', binary,
                    offset + index * view.get('byteStride', 12))
                    for index in range(accessor['count'])]
        triangles = [vertices[index * 3:index * 3 + 3] for index in face_indexes]
        if identifier == '0003':
            decks[name] = triangles
        else:
            for index in range(0, len(triangles), 2):
                key = node_name if len(triangles) == 2 else f'{node_name}:{index // 2}'
                decks[key] = triangles[index:index + 2]
    return decks


def deck_height(triangle, x, z):
    a, b, c = triangle
    denominator = ((b[2] - c[2]) * (a[0] - c[0])
                   + (c[0] - b[0]) * (a[2] - c[2]))
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator
    if u >= -1e-8 and v >= -1e-8 and u + v <= 1 + 1e-8:
        return u * a[1] + v * b[1] + (1 - u - v) * c[1]
    return None


def summarize(movement, decks):
    navigation = movement['navigation']
    width, height = navigation['width'], navigation['height']
    minimum = navigation['minimum']
    cells = list(struct.iter_unpack('<fI', base64.b64decode(navigation['cells'])))
    occupied = {index for surface in movement['surfaces'] if surface['enabled']
                for index in surface['cells']}
    inverse_size = f32(1 / 12)

    def valid_at(x, z):
        column = math.trunc((x - minimum[0]) * inverse_size)
        row = math.trunc((z - minimum[2]) * inverse_size)
        index = row * width + column
        return (0 <= column < width and 0 <= row < height
                and (cells[index][1] & 255) > 1 and index not in occupied)

    report = []
    all_deck_cells = set()
    for name, triangles in decks.items():
        covered = set()
        invalid = []
        mismatches = []
        for row in range(height):
            for column in range(width):
                x, z = minimum[0] + column * 12 + 6, minimum[2] + row * 12 + 6
                heights = [value for triangle in triangles
                           if (value := deck_height(triangle, x, z)) is not None]
                if not heights:
                    continue
                index = row * width + column
                covered.add(index)
                if (cells[index][1] & 255) <= 1:
                    invalid.append(index)
                elif cells[index][0] != f32(max(heights)):
                    mismatches.append(index)
        all_deck_cells.update(covered)
        lanes = []
        # 0003 decks contain eight top faces; each 0016 deck is a quad
        # whose first triangle's first edge spans the two banks.
        if len(triangles) == 8:
            right_a, right_b = triangles[0][0], triangles[1][2]
            left_a, left_b = triangles[6][1], triangles[6][2]
        else:
            left_a, left_b = triangles[0][0], triangles[1][1]
            right_a, right_b = triangles[0][1], triangles[0][2]
        for fraction in (.2, .35, .5, .65, .8):
            left = [a * (1 - fraction) + b * fraction for a, b in zip(left_a, left_b)]
            right = [a * (1 - fraction) + b * fraction for a, b in zip(right_a, right_b)]
            dx, dz = right[0] - left[0], right[2] - left[2]
            distance = math.hypot(dx, dz)
            angle = f32(math.acos(f32(dz / distance)))
            if dx < 0:
                angle = f32(6.283180236816406 - angle)
            cosine, sine = f32(math.cos(angle)), f32(math.sin(angle))
            for command in (1, 2):
                points = []
                rejected = []
                # Three-unit intervals extend eighteen units onto both banks.
                for step in range(-6, math.trunc(distance / 3) + 7):
                    x = f32(left[0] + step * 3 / distance * dx)
                    z = f32(left[2] + step * 3 / distance * dz)
                    footprint = [(x, z)]
                    for row in range(2):
                        for column in range(5):
                            local_x = column * 12 - 25
                            local_z = 28 - row * 22 if command == 1 else row * 22 - 28
                            footprint.append((f32(x + f32(local_x * cosine + local_z * sine)),
                                              f32(z + f32(local_z * cosine - local_x * sine))))
                    points.append([x, z])
                    if not all(valid_at(px, pz) for px, pz in footprint):
                        rejected.append([x, z])
                lanes.append({'fraction': fraction, 'command': command,
                              'candidatePoints': len(points), 'rejectedPoints': rejected})
        report.append({'mesh': name, 'deckCells': len(covered),
                       'validDeckCells': len(covered) - len(invalid),
                       'invalidDeckCells': invalid, 'heightMismatchCells': mismatches,
                       'occupiedDeckCells': sorted(covered & occupied), 'lanes': lanes})
    return report, all_deck_cells


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--map', choices=tuple(BRIDGE_DECK_PARTS), default='0003')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--original-navigation', type=Path,
                        help='Saved original NAV layer for measuring the deck correction boundary')
    args = parser.parse_args()
    output = args.output or ROOT / ('recovery/output/bridge-navigation-audit.json' if args.map == '0003'
                                   else f'recovery/output/bridge-navigation-{args.map}-audit.json')
    movement = json.loads((ROOT / f'apps/web/public/data/maps/{args.map}/movement.json').read_text())
    bridges, covered = summarize(movement, bridge_decks(args.map))
    report = {'scope': 'saved model and NAV footprint candidates; no runtime execution',
              'id': args.map, 'bridges': bridges}
    if args.original_navigation:
        original = json.loads(args.original_navigation.read_text())
        before = list(struct.iter_unpack('<fI', base64.b64decode(original['cells'])))
        after = list(struct.iter_unpack('<fI', base64.b64decode(movement['navigation']['cells'])))
        changed = {index for index, (first, second) in enumerate(zip(before, after))
                   if first != second}
        report['changedNavigationCells'] = len(changed)
        report['newWalkableCells'] = sum((before[index][1] & 255) <= 1 < (after[index][1] & 255)
                                         for index in changed)
        report['changedCellsOutsideDecks'] = sorted(changed - covered)
        report['changedPassageFields'] = sum(before[index][1] != after[index][1] for index in changed)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    for bridge in bridges:
        count = sum(len(lane['rejectedPoints']) for lane in bridge['lanes'])
        print(f"{bridge['mesh']}: {bridge['deckCells']} deck cells; "
              f"{len(bridge['invalidDeckCells'])} invalid, "
              f"{len(bridge['heightMismatchCells'])} height mismatches, {count} rejected candidates")


if __name__ == '__main__':
    main()
