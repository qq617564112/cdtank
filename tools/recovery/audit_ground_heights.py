"""Summarize saved map NAV heights, initial occupancy and baked terrain faces."""
import argparse
import base64
import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INVERSE_SIZE = struct.unpack('<f', struct.pack('<f', 1 / 12))[0]
GROUND_SNAP = 0.5
STEP_HEIGHT = 18


def terrain_height(terrain, x, z, near):
    heights = []
    for face in terrain['triangles']:
        if not (face['minimum'][0] <= x <= face['maximum'][0]
                and face['minimum'][2] <= z <= face['maximum'][2]):
            continue
        a, b, c = face['vertices']
        denominator = ((b[2] - c[2]) * (a[0] - c[0])
                       + (c[0] - b[0]) * (a[2] - c[2]))
        if abs(denominator) < 0.00001:
            continue
        u = ((b[2] - c[2]) * (x - c[0])
             + (c[0] - b[0]) * (z - c[2])) / denominator
        v = ((c[2] - a[2]) * (x - c[0])
             + (a[0] - c[0]) * (z - c[2])) / denominator
        if u >= -0.000001 and v >= -0.000001 and u + v <= 1.000001:
            heights.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
    return min(heights, key=lambda value: abs(value - near)) if heights else None


def summarize(path, server_field):
    movement = json.loads(path.read_text())
    source = movement['navigation']
    width, height = source['width'], source['height']
    cells = list(struct.iter_unpack('<fI', base64.b64decode(source['cells'])))
    blocked = set()
    for surface in movement['surfaces']:
        if surface['enabled']:
            blocked.update(surface['cells'])

    def valid(column, row):
        return (0 <= column < width and 0 <= row < height
                and (cells[row * width + column][1] & 255) > 1
                and row * width + column not in blocked)

    def valid_at(x, z):
        return valid(math.trunc((x - source['minimum'][0]) * INVERSE_SIZE),
                     math.trunc((z - source['minimum'][2]) * INVERSE_SIZE))

    # Yaw-zero complete body boundary plus the original forward-command samples.
    footprint = [(x, z) for x in (-24.5, -12, 0, 12, 24.5)
                 for z in (-26, -12, 0, 12, 26)]
    footprint += [(column * 12 - 25, 28 - row * 22)
                  for row in range(2) for column in range(5)]

    def clear_footprint(x, z):
        return all(valid_at(x + dx, z + dz) for dx, dz in footprint)

    heights = [cell[0] for index, cell in enumerate(cells)
               if (cell[1] & 255) > 1 and index not in blocked]
    neighbors = 0
    maximum = 0
    above_snap = 0
    above_step = 0
    clear_above_snap = 0
    largest_clear = None
    for row in range(height):
        for column in range(width):
            if not valid(column, row):
                continue
            first = cells[row * width + column][0]
            for dx, dz in ((1, 0), (0, 1)):
                if not valid(column + dx, row + dz):
                    continue
                second = cells[(row + dz) * width + column + dx][0]
                delta = abs(second - first)
                neighbors += 1
                maximum = max(maximum, delta)
                above_step += delta > STEP_HEIGHT
                if delta <= GROUND_SNAP:
                    continue
                above_snap += 1
                x = source['minimum'][0] + column * 12 + 6
                z = source['minimum'][2] + row * 12 + 6
                end_x, end_z = x + dx * 12, z + dz * 12
                if not (clear_footprint(x, z) and clear_footprint(end_x, end_z)):
                    continue
                clear_above_snap += 1
                if largest_clear is None or delta > largest_clear['difference']:
                    largest_clear = {
                        'difference': delta,
                        'start': [x, first, z],
                        'end': [end_x, second, end_z],
                    }

    collision = json.loads((ROOT / 'apps/server/resources/assets/scene-collision'
                            / f"{movement['id']}.json").read_text())
    server_blocked = set(collision['terrainNavigationCells'])
    for identifier in collision['solids']:
        server_blocked.update(collision['colliders'][identifier]['navigationCells'])
    if largest_clear:
        first = largest_clear['start']
        second = largest_clear['end']
        model_start = terrain_height(collision['terrain'], first[0], first[2], first[1])
        model_end = terrain_height(collision['terrain'], second[0], second[2], second[1])
        largest_clear['bakedTerrainHeights'] = [model_start, model_end]
        largest_clear['bakedTerrainDifference'] = (
            abs(model_end - model_start)
            if model_start is not None and model_end is not None else None)
    return {
        'id': movement['id'],
        'navigationCells': len(cells),
        'initialWalkableCells': len(heights),
        'terrainOccupiedCells': len(collision['terrainNavigationCells']),
        'heightRange': [min(heights), max(heights)],
        'adjacentWalkablePairs': neighbors,
        'maximumAdjacentDifference': maximum,
        'pairsAboveGroundSnap': above_snap,
        'pairsAboveStepHeight': above_step,
        'clearFootprintPairsAboveGroundSnap': clear_above_snap,
        'largestClearFootprintPair': largest_clear,
        'navigationMatchesServer': source == server_field['navigationLayers'][0],
        'initialOccupancyMatchesServer': blocked == server_blocked,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path,
                        default=ROOT / 'recovery/output/map-ground-height-audit.json')
    args = parser.parse_args()
    fields = json.loads((ROOT / 'apps/server/resources/assets/battlefields.json').read_text())
    server_fields = {field['id']: field for field in fields}
    maps = [summarize(path, server_fields[path.parent.name]) for path in sorted(
        (ROOT / 'apps/web/public/data/maps').glob('*/movement.json'))]
    report = {
        'scope': 'saved NAV and initial baked occupancy; no runtime execution',
        'groundSnap': GROUND_SNAP,
        'stepHeight': STEP_HEIGHT,
        'mapCount': len(maps),
        'mapsAboveGroundSnap': [entry['id'] for entry in maps if entry['pairsAboveGroundSnap']],
        'maps': maps,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"{len(maps)} maps; {len(report['mapsAboveGroundSnap'])} above ground snap")
    for entry in maps:
        clear = entry['largestClearFootprintPair']
        print(f"{entry['id']}: max {entry['maximumAdjacentDifference']:.6f}, "
              f"above snap {entry['pairsAboveGroundSnap']}, "
              f"clear {entry['clearFootprintPairsAboveGroundSnap']}, "
              f"model delta {clear['bakedTerrainDifference'] if clear else None}, "
              f"server NAV/occupancy {entry['navigationMatchesServer']}/"
              f"{entry['initialOccupancyMatchesServer']}")


if __name__ == '__main__':
    main()
