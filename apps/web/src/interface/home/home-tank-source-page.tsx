import {sourceProps} from '../resources/source-ui-props';
import {Fragment, type MouseEventHandler} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {sourceOwnedTankDays} from './home-owned-tank-row-display';
import {sourceTankKind} from '../account/tank-shop-row-display';
import {HOME_TANK_PARAMETER_BASES, homeTankParameters} from './home-tank-parameters';

interface HomeTankSourcePageProps {
  ui: HomeSourceUi;
  name: string;
  money?: number;
  quantity?: number;
  description?: string;
  alreadyUsed: boolean;
  busy: boolean;
  canUse: boolean;
  use: MouseEventHandler<HTMLButtonElement>;
  selectedInstance?: number;
  openUpgrade?: (instanceId: number, action: 1 | 2) => void;
  openEquipment?: () => void;
  record?: OwnedRoleRecordData;
  pet?: OwnedRoleRecordData;
  catalog?: CombatCatalog;
  equippedItemIds?: readonly number[];
}

/** The owned tank sheet keeps its original attribute, parameter and balance regions. */
export function HomeTankSourceRegions({ui}: {ui: HomeSourceUi}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5', 'fuhao2', 'huangtiao4',
    'lblPanzerSide', 'baifenbi3', 'huangtiao3', 'lblPanzerBack', 'baifenbi4',
    'tankkemiaoshu', 'hangditu1', 'huangtiao6', 'fuhao1', 'shengyutianshu',
    'tankecanshuqu', 'hangditu8', 'lblShootInterval', 'sec', 'huangditu7',
    'lblMoveSpeed', 'km', 'huangditu9', 'lblRotationSpeed', 'xiegangsec',
    'huangtiao10', 'lblLoadBullet', 'ditu', 'shuliangditu', 'changtiao', 'changtiao2',
    'jinqiantubiao', 'jinqian', 'chuangyidiantubiao', 'chuangyidiantubiao2',
  ];
  return <>
    {pictures.map(source => <SourceStaticImage key={source} ui={ui} layout={layout}
      suffix={suffix} name={source} className="home-tank-source-picture" aria-hidden="true" />)}
  </>;
}

function HomeTankUpgradeEntries({ui, record, busy, openUpgrade}: Pick<HomeTankSourcePageProps,
    'ui' | 'record' | 'busy' | 'openUpgrade'>) {
  const suffix = 'myhome_panzerpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  const instanceId = fields?.get(0x1c);
  return <>{(['btnModifyFire', 'btnModifyPanzer'] as const).map((source, index) => {
    const action = index + 1 as 1 | 2;
    const enabled = !!openUpgrade && instanceId !== undefined && (fields?.get(action === 1 ? 0x38 : 0x48) ?? 0) !== 0;
    const level = action === 1 ? 'txtAttackLevel' : 'txtPanzerLevel';
    const levelBox = layout.control(level).properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const levelOffset = action === 1 ? 0x44 : 0x54;
    return <Fragment key={source}>
      <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name={source}
        reference={layout.control(source).properties.NormalImage} className="home-tank-source-picture"
        aria-hidden="true" />
      <SourceButton ui={ui} layout={layout} suffix={suffix} source={source} disabled={busy || !enabled}
        data-home-tank-modify-action={action} aria-label={action === 1 ? '火力改装' : '装甲改装'}
        onClick={() => {if (enabled && instanceId !== undefined) openUpgrade?.(instanceId, action);}}>
        <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={level}
          style={{left: levelBox[0], top: levelBox[1]}} className="home-tank-upgrade-entry-level"
          text={fields?.has(levelOffset) ? String(fields.get(levelOffset)) : ''}
          data-home-tank-owned-field={levelOffset} data-owned-value={fields?.get(levelOffset)} />
      </SourceButton>
    </Fragment>;
  })}</>;
}

export function HomeTankOwnedAttributes({ui, record}: {ui: HomeSourceUi; record?: OwnedRoleRecordData}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  const tank = HOME_TANK_PARAMETER_BASES[fields?.get(0x24)!];
  return <>{([['txtAttack', 0x3c], ['txtAttackExtra', 0x40], ['txtPanzer', 0x4c], ['txtPanzerExtra', 0x50]] as const)
      .map(([name, offset]) => <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
        className="home-tank-owned-attribute" text={fields?.has(offset) ? String(fields.get(offset)) : ''}
        data-home-tank-owned-field={offset} data-owned-value={fields?.get(offset)} />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtTankType"
      className="home-tank-owned-attribute" text={sourceTankKind(tank?.[0])} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtStability"
      className="home-tank-owned-attribute" text={sourceOwnedTankDays(fields?.get(0x34))} />
  </>;
}

function HomeTankOwnedParameters({ui, record, pet, catalog, equippedItemIds, alreadyUsed}: Pick<HomeTankSourcePageProps,
    'ui' | 'record' | 'pet' | 'catalog' | 'equippedItemIds' | 'alreadyUsed'>) {
  const suffix = 'myhome_panzerpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const values = homeTankParameters(record, pet, catalog, equippedItemIds, alreadyUsed);
  if (!values) return null;
  const control = layout.control('prgLoadBullet');
  const background = sourceProps(ui, layout, suffix, 'prgLoadBullet', control.properties.BackgroundImage);
  const fill = sourceProps(ui, layout, suffix, 'prgLoadBullet', control.properties.ProgressImage);
  const progress = Math.max(0, Math.min(1, Math.fround(values.capacity * Math.fround(1 / 6))));
  const width = Number(background.style.width), height = Number(background.style.height);
  const extent = Math.floor(width * progress + .5);
  return <>
    {(['txtPanzerSide', 'txtPanzerBack', 'txtMoveSpeed', 'txtRotationSpeed', 'txtShootInterval'] as const)
      .map(name => <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
        className="home-tank-owned-attribute" text={String(values[name])} />)}
    <div {...background} className="home-tank-capacity" data-home-tank-capacity=""
      role="meter" aria-label="炮弹容量" aria-valuemin={0} aria-valuemax={6} aria-valuenow={values.capacity}>
      <span aria-hidden="true" style={{position: 'absolute', inset: 0, width, height,
        clipPath: `inset(0 ${width - extent}px 0 0)`, backgroundImage: fill.style.backgroundImage,
        backgroundSize: '100% 100%'}} />
    </div>
  </>;
}

export function HomeTankDescription({ui, description}: {ui: HomeSourceUi; description?: string}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <div {...sourceProps(ui, layout, suffix, 'edtTankDesc')} className="home-tank-description"
    role="region" aria-label="战车介绍" tabIndex={description ? 0 : -1}
    data-home-tank-description="" data-description-source={description === undefined ? 'unavailable' : 'original-tank-table'}
    data-presentation-colour="web-readable">{description ?? ''}</div>;
}

export function HomeTankSourcePage({ui, name, money, quantity, description, alreadyUsed, busy, canUse, use, selectedInstance,
  openUpgrade, openEquipment, record, pet, catalog, equippedItemIds}: HomeTankSourcePageProps) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <>
    <HomeTankSourceRegions ui={ui} />
    <HomeTankUpgradeEntries ui={ui} record={record} busy={busy} openUpgrade={openUpgrade} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtTankName" text={name} />
    <HomeTankOwnedAttributes ui={ui} record={record} />
    <HomeTankOwnedParameters ui={ui} record={record} pet={pet} catalog={catalog}
      equippedItemIds={equippedItemIds} alreadyUsed={alreadyUsed} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoney" text={money === undefined ? '' : String(money)} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtListQuantity" text={quantity === undefined ? '' : String(quantity)} />
    <HomeTankDescription ui={ui} description={description} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoTank"
      selected aria-pressed="true" aria-label="拥有战车" disabled={busy} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoEquip"
      aria-pressed="false" aria-label="装备部件" disabled={busy || !openEquipment}
      onClick={openEquipment} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnUse"
      className="home-role-use home-tank-source-use" aria-label="选择战车出击"
      disabled={!canUse} data-selected-instance={selectedInstance ?? ''} onClick={use} />
    {alreadyUsed && <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="picAlreadyUsed"
      className="home-tank-source-picture" aria-label="当前出击战车" role="img"
      data-home-tank-already-used="" data-state-source="confirmed-profile-web-visibility" />}
  </>;
}
