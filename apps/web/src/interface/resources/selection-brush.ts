interface Point {x: number; y: number;}

function curve(start: Point, first: Point, second: Point, end: Point, t: number): Point {
  const rest = 1 - t;
  return {
    x: rest ** 3 * start.x + 3 * rest ** 2 * t * first.x + 3 * rest * t ** 2 * second.x + t ** 3 * end.x,
    y: rest ** 3 * start.y + 3 * rest ** 2 * t * first.y + 3 * rest * t ** 2 * second.y + t ** 3 * end.y,
  };
}

function position(point: Point): string {return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;}

function grain(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function pressureNoise(position: number): number {
  const start = Math.floor(position), fraction = position - start;
  const blend = fraction * fraction * (3 - 2 * fraction);
  return grain(start) * (1 - blend) + grain(start + 1) * blend;
}

function smoothOutline(points: Point[]): string {
  const middle = (first: Point, second: Point): Point => ({x: (first.x + second.x) / 2, y: (first.y + second.y) / 2});
  let path = `M${position(middle(points.at(-1)!, points[0]))}`;
  points.forEach((point, index) => {path += `Q${position(point)} ${position(middle(point, points[(index + 1) % points.length]))}`;});
  return `${path}Z`;
}

/** Brush pressure and dry bristles stay in row pixels as the contour gets wider. */
export function selectionBrush(width: number, height: number): {outline: string; bristles: string[]} {
  const scale = height / 32;
  const cap = Math.min(27 * scale, width * .18);
  const gap = Math.min(27 * scale, width * .16);
  const start = {x: width * .44 - gap / 2, y: 5.6 * scale};
  const end = {x: width * .44 + gap / 2, y: 3.3 * scale};
  const segments: [Point, Point, Point][] = [
    [{x: start.x - width * .16, y: 6.5 * scale}, {x: cap * 1.5, y: 8.4 * scale}, {x: cap, y: 10.5 * scale}],
    [{x: cap * .4, y: 13.2 * scale}, {x: 1.1 * scale, y: 17.2 * scale}, {x: 2.6 * scale, y: 20.2 * scale}],
    [{x: 5 * scale, y: 25 * scale}, {x: cap * 1.1, y: 27.1 * scale}, {x: cap * 2, y: 27.5 * scale}],
    [{x: width * .3, y: 29.3 * scale}, {x: width * .73, y: 28.8 * scale}, {x: width - cap * 1.7, y: 25.9 * scale}],
    [{x: width - cap * .6, y: 23.9 * scale}, {x: width - 1.3 * scale, y: 20 * scale}, {x: width - 3.4 * scale, y: 16.1 * scale}],
    [{x: width - 5.2 * scale, y: 12.8 * scale}, {x: width - cap * .9, y: 8.4 * scale}, {x: width - cap * 1.7, y: 6.7 * scale}],
    [{x: width * .73, y: 1.8 * scale}, {x: end.x + width * .1, y: 2.4 * scale}, end],
  ];
  const points: Point[] = [start];
  let previous = start;
  for (const [first, second, next] of segments) {
    const length = Math.hypot(first.x - previous.x, first.y - previous.y)
      + Math.hypot(second.x - first.x, second.y - first.y) + Math.hypot(next.x - second.x, next.y - second.y);
    const steps = Math.max(8, Math.ceil(length / (3 * scale)));
    for (let index = 1; index <= steps; index++) points.push(curve(previous, first, second, next, index / steps));
    previous = next;
  }
  const outside: Point[] = [], inside: Point[] = [], bristles: string[] = [];
  let travelled = 0;
  points.forEach((point, index) => {
    const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
    travelled += Math.hypot(point.x - before.x, point.y - before.y) / scale;
    const tangent = Math.hypot(after.x - before.x, after.y - before.y);
    const normal = {x: -(after.y - before.y) / tangent, y: (after.x - before.x) / tangent};
    const pressure = 1.55 + .48 * pressureNoise(travelled / 37) + .23 * pressureNoise(travelled / 11 + 9);
    const taper = Math.min(1, (index + 1) / 5, (points.length - index) / 7);
    const wobble = .22 * pressureNoise(travelled / 28 + 31);
    const edge = .2 * grain(index + 113) + (grain(index + 49) > .75 ? .22 : 0);
    const radius = pressure * (.24 + .76 * taper);
    outside.push({x: point.x + normal.x * (radius + wobble + edge) * scale,
      y: point.y + normal.y * (radius + wobble + edge) * scale});
    inside.push({x: point.x - normal.x * (radius - wobble - edge * .65) * scale,
      y: point.y - normal.y * (radius - wobble - edge * .65) * scale});
    if (grain(index + 73) > .82 && index > 6 && index < points.length - 8) {
      const next = points[Math.min(index + 1 + Math.round((grain(index + 17) + 1) * 1.5), points.length - 1)];
      const offset = radius * .63 * (index % 2 ? 1 : -1) * scale;
      bristles.push(`M${position({x: point.x + normal.x * offset, y: point.y + normal.y * offset})}`
        + `L${position({x: next.x + normal.x * offset, y: next.y + normal.y * offset})}`);
    }
  });
  return {outline: smoothOutline([...outside, ...inside.reverse()]), bristles};
}
