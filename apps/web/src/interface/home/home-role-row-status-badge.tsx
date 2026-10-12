import type {HomeSourceUi} from '../resources/source-ui-layout';
import './home-role-row-status-badge.css';

const STATUS_GLYPHS = {
  current: {text: 'N', label: '当前使用'},
  installed: {text: 'E', label: '本车已装备'},
  offered: {text: 'B', label: '本方交易草稿'},
} as const;

/** Original SmallHT status glyphs: `N` current owned instance, `E` row installed on this tank, `B` local trade draft. */
export function HomeRoleRowStatusBadge({status}: {ui: HomeSourceUi; status: 'current' | 'installed' | 'offered'}) {
  const {text, label} = STATUS_GLYPHS[status];
  return <span className="home-role-row-status-badge" role="img" aria-label={label}
    data-home-owned-role-current={status === 'current' ? '' : undefined}
    data-home-equipment-installed={status === 'installed' ? '' : undefined}
    data-trade-owned-row-offered={status === 'offered' ? '' : undefined}
    data-source-text-value={text}>
    {text}
  </span>;
}
