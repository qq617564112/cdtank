import {readFileSync, writeFileSync} from 'node:fs';
import {getBattlefield, segmentBox} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';

const route = JSON.parse(readFileSync('recovery/output/scene-breach02-05427-intact-entry-route.json', 'utf8'));
const field = getBattlefield(2);
const source = getSceneBreakables(2).find(value => value.id === '126')!;
const from = {...route.goal, y: route.goal.y + 20};
const to = {x: source.matrix[12], y: from.y, z: source.matrix[14]};
const fraction = segmentBox(from, to, source, 1);
const obstruction = field.firstSurfaceHit(from, to, 1);
const result = {status: fraction !== undefined && (!obstruction || obstruction.fraction >= fraction)
  ? 'PREPARED_SOURCE126_SHOT_LINE_CLEAR' : 'PREPARED_SOURCE126_SHOT_LINE_BLOCKED',
  sourcePlacementId: '126', model: source.model, from, to, targetFraction: fraction,
  firstSurface: obstruction, scope: 'Read-only source field and prior approach; no ENV permission, active state or ordinary shot acceptance.'};
writeFileSync('recovery/output/scene-breach02-126-shot-line-prepared.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
