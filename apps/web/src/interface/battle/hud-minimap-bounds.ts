import {TEST_MAP} from '../../../../shared/maps/test-map';
import {FIELD_ROAD_HD} from '../../../../shared/maps/field-road-hd';

export interface HudMinimapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const HUD_MINIMAP_SIZE = 192;
export const HUD_MINIMAP_BORDER = 6;
export const HUD_MINIMAP_WORLD_RADIUS = 500;
export const HUD_MINIMAP_SCALE = (HUD_MINIMAP_SIZE / 2 - HUD_MINIMAP_BORDER) / HUD_MINIMAP_WORLD_RADIUS;

export interface HudMinimapCamera {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
}

/** Out-of-range marker centres retain their bearing on the inner white border. */
export function hudMinimapLocalPosition(camera: HudMinimapCamera, x: number,
  z: number): {left: number; top: number; atEdge: boolean} {
  const dx = x - camera.x, dz = z - camera.z;
  const right = (dx * camera.rightX + dz * camera.rightZ) * HUD_MINIMAP_SCALE;
  const up = (dx * camera.forwardX + dz * camera.forwardZ) * HUD_MINIMAP_SCALE;
  const distance = Math.hypot(right, up);
  const visibleRadius = HUD_MINIMAP_SIZE / 2 - HUD_MINIMAP_BORDER;
  const borderCentreRadius = visibleRadius - .5;
  const atEdge = distance > visibleRadius;
  const factor = atEdge ? borderCentreRadius / distance : 1;
  return {left: HUD_MINIMAP_SIZE / 2 + right * factor,
    top: HUD_MINIMAP_SIZE / 2 - up * factor, atEdge};
}

/** Original NAV and all authored RPT spawn positions, square-fitted per map. */
const testMapSpan = Math.max(TEST_MAP.rows[0].length, TEST_MAP.rows.length) * TEST_MAP.tileSize;
const HUD_MINIMAP_BOUNDS: Readonly<Record<number, HudMinimapBounds>> = {
  1: {minX: -1506.6226806640625, maxX: 1560.65625, minZ: -1501.20703125, maxZ: 1566.0718994140625},
  2: {minX: -2626.316650390625, maxX: 1016.7206420898438, minZ: -1994.4244079589844, maxZ: 1648.6128845214844},
  [FIELD_ROAD_HD.id]: {minX: -2626.316650390625, maxX: 1016.7206420898438,
    minZ: -1994.4244079589844, maxZ: 1648.6128845214844},
  3: {minX: -1972.9508056640625, maxX: 1926.144287109375, minZ: -1812.6487426757812, maxZ: 2086.4463500976562},
  4: {minX: -1118.7362060546875, maxX: 1197.143310546875, minZ: -1153.3997192382812, maxZ: 1162.4797973632812},
  5: {minX: -1725.7015380859375, maxX: 1779.0223388671875, minZ: -1708.949462890625, maxZ: 1795.7744140625},
  6: {minX: -1918.953125, maxX: 1876.0538330078125, minZ: -1908.7784423828125, maxZ: 1886.228515625},
  7: {minX: -691.4258422851562, maxX: 670.4343872070312, minZ: -624.7454833984375, maxZ: 737.11474609375},
  8: {minX: -1403.23046875, maxX: 1902.918212890625, minZ: -1617.4569702148438, maxZ: 1688.6917114257812},
  9: {minX: -1506.2227783203125, maxX: 1496.9224853515625, minZ: -1499.18505859375, maxZ: 1503.960205078125},
  10: {minX: -1626.1029663085938, maxX: 1544.3082885742188, minZ: -1563.021484375, maxZ: 1607.3897705078125},
  11: {minX: -1974.3435668945312, maxX: 1937.2031860351562, minZ: -1473.6192626953125, maxZ: 2437.927490234375},
  12: {minX: -2116.49560546875, maxX: 1837.0350341796875, minZ: -1740.660888671875, maxZ: 2212.8697509765625},
  13: {minX: -1111.2669677734375, maxX: 1902.4742431640625, minZ: -1471.41162109375, maxZ: 1542.32958984375},
  14: {minX: -1271.8578491210938, maxX: 1292.2200317382812, minZ: -1120.0810546875, maxZ: 1443.996826171875},
  15: {minX: -1480.3224487304688, maxX: 1736.0216674804688, minZ: -1427.0517578125, maxZ: 1789.2923583984375},
  16: {minX: -1778.8253784179688, maxX: 1734.4276733398438, minZ: -1676.894287109375, maxZ: 1836.3587646484375},
  17: {minX: -1390.8282470703125, maxX: 1321.5465087890625, minZ: -1268.3779296875, maxZ: 1443.996826171875},
  18: {minX: -1281.87109375, maxX: 1234.7017822265625, minZ: -1225.3743286132812, maxZ: 1291.1985473632812},
  19: {minX: -1592.9093017578125, maxX: 1571.944091796875, minZ: -1573.4413452148438, maxZ: 1591.4120483398438},
  20: {minX: -1633.5587158203125, maxX: 1557.1734619140625, minZ: -1794.403564453125, maxZ: 1396.32861328125},
  21: {minX: -1389.0357055664062, maxX: 1383.9652709960938, minZ: -1412.447998046875, maxZ: 1360.552978515625},
  22: {minX: -1328.068115234375, maxX: 1257.057373046875, minZ: -1266.8448486328125, maxZ: 1318.2806396484375},
  23: {minX: -1918.953125, maxX: 1876.0538330078125, minZ: -1908.7784423828125, maxZ: 1886.228515625},
  24: {minX: -1329.1696166992188, maxX: 1259.8876342773438, minZ: -1268.3778076171875, maxZ: 1320.679443359375},
  25: {minX: -1118.7362060546875, maxX: 1197.143310546875, minZ: -1153.3997192382812, maxZ: 1162.4797973632812},
  [TEST_MAP.id]: {minX: -testMapSpan / 2, maxX: testMapSpan / 2,
    minZ: -testMapSpan / 2, maxZ: testMapSpan / 2},
};

export function hudMinimapBounds(mapId: number): HudMinimapBounds | undefined {
  return HUD_MINIMAP_BOUNDS[mapId];
}

/** Matches the top-down scene image: original +X right, original +Z up. */
export function hudMinimapPosition(bounds: HudMinimapBounds, x: number, z: number): {left: number; top: number} {
  return {
    left: (x - bounds.minX) / (bounds.maxX - bounds.minX) * HUD_MINIMAP_SIZE,
    top: (bounds.maxZ - z) / (bounds.maxZ - bounds.minZ) * HUD_MINIMAP_SIZE,
  };
}
