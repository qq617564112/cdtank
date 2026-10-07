import {Fragment, type MouseEventHandler} from 'react';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const suffix = 'myhome_panzerpage.xml';

/** Original txtListQuantity page capacity (0x14). */
export const HOME_TANK_LIST_CAPACITY = 20;

/** Source txtListQuantity text: the active list row count over the 20-row page capacity. */
export function homeTankListQuantity(rows?: number) {
  return rows === undefined ? '' : `${rows}/${HOME_TANK_LIST_CAPACITY}`;
}

function HomeTankUpgradeLevel({ui, layout, name, text, offset, value}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; text: string; offset: number; value?: number;
}) {
  const props = sourceProps(ui, layout, suffix, name, undefined, 0, 0, true);
  const properties = layout.control(name).properties;
  const horizontal = properties.HorzFormatting ?? 'LeftAligned';
  const vertical = properties.VertFormatting ?? 'VertCentred';
  return <span {...props} className="source-static-text home-tank-upgrade-entry-level"
    data-source-font="xiangjiao-brush" data-source-font-viewport="800,600" data-source-text-colour="FFFFFFFF"
    data-source-horz-format={horizontal} data-source-vert-format={vertical} data-source-text-clip="text-area-intersect-window"
    data-home-tank-owned-field={offset} data-owned-value={value}
    style={{...props.style, display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12,
      lineHeight: '15px', color: '#fff',
      justifyContent: horizontal === 'HorzCentred' ? 'center' : horizontal === 'RightAligned' ? 'flex-end' : 'flex-start',
      alignItems: vertical === 'TopAligned' ? 'flex-start' : vertical === 'BottomAligned' ? 'flex-end' : 'center'}}>
    <span data-source-text-content="" style={{textShadow: 'none'}}>{text}</span>
  </span>;
}

/** Original tankeshengjiqu children btnModifyFire/btnModifyPanzer and their level text, shared by both modes. */
export function HomeTankUpgradeEntries({ui, record, busy, openUpgrade}: {
  ui: HomeSourceUi; record?: OwnedRoleRecordData; busy: boolean;
  openUpgrade?: (instanceId: number, action: 1 | 2) => void;
}) {
  const layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  const instanceId = fields?.get(0x1c);
  return <>{(['btnModifyFire', 'btnModifyPanzer'] as const).map((source, index) => {
    const action = index + 1 as 1 | 2;
    const enabled = !!openUpgrade && instanceId !== undefined && (fields?.get(action === 1 ? 0x38 : 0x48) ?? 0) !== 0;
    const level = action === 1 ? 'txtAttackLevel' : 'txtPanzerLevel';
    const levelOffset = action === 1 ? 0x44 : 0x54;
    return <Fragment key={source}>
      <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name={source}
        reference={layout.control(source).properties.NormalImage} className="home-tank-source-picture"
        aria-hidden="true" />
      <SourceButton ui={ui} layout={layout} suffix={suffix} source={source} disabled={busy || !enabled}
        data-home-tank-modify-action={action} aria-label={action === 1 ? '火力改装' : '装甲改装'}
        onClick={() => {if (enabled && instanceId !== undefined) openUpgrade?.(instanceId, action);}}>
        <HomeTankUpgradeLevel ui={ui} layout={layout} name={level} offset={levelOffset}
          value={fields?.get(levelOffset)} text={fields?.has(levelOffset) ? String(fields.get(levelOffset)) : ''} />
      </SourceButton>
    </Fragment>;
  })}</>;
}

/** Original btnUse/picAlreadyUsed pair; the confirmed battle tank swaps the button for the current marker. */
export function HomeTankUseControl({ui, alreadyUsed, busy, canUse, use, selectedInstance}: {
  ui: HomeSourceUi; alreadyUsed: boolean; busy: boolean; canUse: boolean;
  use: MouseEventHandler<HTMLButtonElement>; selectedInstance?: number;
}) {
  const layout = new HomeSourceLayout(ui, suffix);
  return <>
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnUse"
      className="home-role-use home-tank-source-use" aria-label="选择战车出击"
      disabled={busy || !canUse} data-selected-instance={selectedInstance ?? ''} onClick={use} />
    {alreadyUsed && <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="picAlreadyUsed"
      className="home-tank-source-picture" aria-label="当前出击战车" role="img"
      data-home-tank-already-used="" data-state-source="confirmed-profile-web-visibility" />}
  </>;
}
