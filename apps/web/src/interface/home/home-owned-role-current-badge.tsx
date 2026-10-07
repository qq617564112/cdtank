import {sourceUiImage} from '../resources/source-ui-image';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import './home-owned-role-current-badge.css';

const STATUS_GLYPH = 'set:xiaoheitizi0 image:data\\ui\\xiaoheitizi\\n.tga';

/** Original status-3 SmallHT `N` glyph marking the profile's current owned instance. */
export function HomeOwnedRoleCurrentBadge({ui}: {ui: HomeSourceUi}) {
  const {asset, backgroundImage} = sourceUiImage(ui, STATUS_GLYPH);
  return <span className="home-owned-role-current-badge" role="img" aria-label="当前使用"
    data-home-owned-role-current="" data-source-asset={asset} style={{backgroundImage}}/>;
}
