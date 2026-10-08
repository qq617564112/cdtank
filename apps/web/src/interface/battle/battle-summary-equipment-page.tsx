import './battle-summary-equipment-page.css';
import {useEffect, useRef} from 'react';
import type {ResultItemGrant, ResultTankGrant} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {HudBattleInfoView} from './hud-battle-info-view';
import {battleInfoText} from './battle-info-messages';

/** One committed equipped reward: an owned item record or an owned tank record. */
export type EquipmentGrant =
  | {kind: 'item'; item: ResultItemGrant}
  | {kind: 'tank'; tank: ResultTankGrant};

/** Source `picItem` uses the item definition's icon id in the daoju atlas. */
function equipmentIcon(grant: EquipmentGrant): string {
  return grant.kind === 'item'
    ? `set:daoju0 image:data\\ui\\daoju\\${String(grant.item.iconId).padStart(5, '0')}.tga`
    : `set:tanke0 image:data\\ui\\tanke\\${String(grant.tank.tankId).padStart(3, '0')}.tga`;
}

function equipmentName(grant: EquipmentGrant): string {
  return grant.kind === 'item' ? grant.item.name : grant.tank.name;
}

/** Original equipment notice consumes this round's persisted item and tank grants. */
export function BattleSummaryEquipmentPage({ui, grant, scale, close, origin}: {
  ui: HomeSourceUi; grant: EquipmentGrant; scale: number; close(): void; origin(): HTMLElement | null;
}) {
  const suffix = 'game_summary_dialog.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.show();
    element.focus();
    const timer = window.setTimeout(close, 3400);
    return () => {
      window.clearTimeout(timer);
      element.close();
      const target = origin();
      if (target?.isConnected) target.focus();
    };
  }, []);
  const name = equipmentName(grant);
  return <dialog ref={dialog} className="battle-summary-equipment-notice" aria-label="获得装备奖励"
    tabIndex={-1} data-summary-equipment-kind={grant.kind}
    data-summary-equipment-instance={grant.kind === 'item' ? grant.item.instanceId : grant.tank.instanceId}
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if ((event.key === 'Enter' || event.key === 'Escape')
          && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault(); close();
      }
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="battle-summary-equipment-stage" style={{zoom: scale}}>
      <SourceImageScale value={scale}>
        <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="wndDialog" aria-hidden="true" />
        <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="picItem" reference={equipmentIcon(grant)}
          className="battle-summary-equipment-icon" role="img" aria-label={`获得${name}`} />
        <span {...sourceProps(ui, layout, suffix, 'txtMessage')}>
          <HudBattleInfoView ui={ui} label="获得装备奖励"
            text={`你获得了<colour red=255 green=0 blue=0 alpha=255>${battleInfoText(name)}</colour>。`} />
        </span>
      </SourceImageScale>
    </div>
  </dialog>;
}
