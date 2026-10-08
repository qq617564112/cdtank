import type {SourceNavigationLayer} from './navigation';

export interface SourceMovementSurface {
  id: string;
  cells: readonly number[];
  enabled: boolean;
}

/** Per-map movement data exported from the initial render geometry and NAV. */
export interface SourceMovementField {
  id: string;
  navigation: SourceNavigationLayer;
  surfaces: readonly SourceMovementSurface[];
}
