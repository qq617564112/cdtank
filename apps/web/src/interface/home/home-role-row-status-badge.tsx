import {sourceUiImage} from '../resources/source-ui-image';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import './home-role-row-status-badge.css';

const STATUS_GLYPHS = {
  current: {reference: 'set:xiaoheitizi0 image:data\\ui\\xiaoheitizi\\n.tga', label: '当前使用'},
  installed: {reference: 'set:xiaoheitizi0 image:data\\ui\\xiaoheitizi\\e.tga', label: '本车已装备'},
  offered: {reference: 'set:xiaoheitizi0 image:data\\ui\\xiaoheitizi\\b.tga', label: '本方交易草稿'},
} as const;

/** Original SmallHT status glyphs: `N` current owned instance, `E` row installed on this tank, `B` local trade draft. */
export function HomeRoleRowStatusBadge({ui, status}: {ui: HomeSourceUi; status: 'current' | 'installed' | 'offered'}) {
  const {reference, label} = STATUS_GLYPHS[status];
  const {asset, backgroundImage} = sourceUiImage(ui, reference);
  return <span className="home-role-row-status-badge" role="img" aria-label={label}
    data-home-owned-role-current={status === 'current' ? '' : undefined}
    data-home-equipment-installed={status === 'installed' ? '' : undefined}
    data-trade-owned-row-offered={status === 'offered' ? '' : undefined}
    data-source-asset={asset} style={{backgroundImage}}/>;
}
