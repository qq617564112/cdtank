import {sourceProps} from '../resources/source-ui-props';
import {type MouseEventHandler, type ReactNode} from 'react';
import {HomeSourceButton as SourceButton} from './home-source-button';
import {HomeSourceSurface as SourceStaticImage} from './home-surface';
import {HomeStaticText as SourceStaticText} from './home-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {sourceOwnedTankDays} from './home-owned-tank-row-display';
import {sourceTankKind} from '../account/tank-shop-row-display';
import {HOME_TANK_PARAMETER_BASES, homeTankParameters} from './home-tank-parameters';
import {HomeTankUpgradeEntries, HomeTankUseControl} from './home-tank-page-state';
import {HomeSymbolMeter} from './home-symbol-meter';
import {GameStatRow} from '../resources/game-stat-row';

interface HomeTankSourcePageProps {
  ui: HomeSourceUi;
  name: string;
  money?: number;
  quantity?: number;
  description?: string;
  originality?: number;
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

/** Each stat row lays out its label, value and unit on a shared baseline. */
function HomeTankStatRow({ui, layout, source, endSource, className = '', children}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; source: string; endSource?: string;
  className?: string; children: ReactNode;
}) {
  const bounds = sourceProps(ui, layout, 'myhome_panzerpage.xml', source);
  const end = endSource ? sourceProps(ui, layout, 'myhome_panzerpage.xml', endSource).style : undefined;
  return <GameStatRow {...bounds} className={`home-tank-stat-row ${className}`} contentClassName="home-tank-stat-content" style={{...bounds.style,
    ...(end ? {width: Number(end.left) + Number(end.width) - Number(bounds.style.left),
      height: Math.max(Number(bounds.style.height), Number(end.top) + Number(end.height) - Number(bounds.style.top))} : {})}}>
    {children}
  </GameStatRow>;
}

function HomeTankStatNumber({name, text, field, value}: {
  name: string; text: string; field?: number; value?: number;
}) {
  return <span className="home-tank-stat-number home-tank-owned-attribute" data-source-control={name}
    data-source-layout="ui/layouts/myhome_panzerpage.xml"
    data-home-tank-owned-field={field} data-owned-value={value}>{text}</span>;
}

function HomeTankStatLabel({name, text}: {name: string; text: string}) {
  return <span className="home-tank-stat-label" data-source-control={name}
    data-source-layout="ui/layouts/myhome_panzerpage.xml">{text}</span>;
}

function HomeTankStatUnit({name, text}: {name: string; text: string}) {
  return <span className="home-tank-stat-unit" data-source-control={name}
    data-source-layout="ui/layouts/myhome_panzerpage.xml">{text}</span>;
}

/** The owned tank sheet keeps its original attribute, parameter and balance regions. */
export function HomeTankSourceRegions({ui}: {ui: HomeSourceUi}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5', 'huangtiao4', 'huangtiao3',
    'tankkemiaoshu', 'hangditu1', 'huangtiao6', 'tankecanshuqu', 'hangditu8',
    'huangditu7', 'huangditu9', 'huangtiao10', 'ditu', 'changtiao', 'changtiao2',
    'jinqiantubiao', 'jinqian', 'chuangyidiantubiao', 'chuangyidiantubiao2',
  ];
  return <>
    {pictures.map(source => <SourceStaticImage key={source} ui={ui} layout={layout}
      suffix={suffix} name={source} className="home-tank-source-picture" aria-hidden="true" />)}
  </>;
}

export function HomeTankOwnedAttributes({ui, record}: {ui: HomeSourceUi; record?: OwnedRoleRecordData}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  const tank = HOME_TANK_PARAMETER_BASES[fields?.get(0x24)!];
  return <>
    {([['huangtiao6', 'txtAttack', 0x3c, 'txtAttackExtra', 0x40, 'fuhao1'],
      ['huangtiao5', 'txtPanzer', 0x4c, 'txtPanzerExtra', 0x50, 'fuhao2']] as const)
      .map(([source, name, offset, extraName, extraOffset, unit]) =>
        <HomeTankStatRow key={source} ui={ui} layout={layout} source={source} className="home-tank-stat-formula">
          <span className="home-tank-stat-value">
            <span className="home-tank-stat-value">
              <HomeTankStatNumber name={name} field={offset} value={fields?.get(offset)}
                text={fields?.has(offset) ? String(fields.get(offset)) : ''}/>
              <HomeTankStatUnit name={unit} text="%"/>
            </span>
            <span className="home-tank-stat-operator">＋</span>
            <HomeTankStatNumber name={extraName} field={extraOffset} value={fields?.get(extraOffset)}
              text={fields?.has(extraOffset) ? String(fields.get(extraOffset)) : ''}/>
          </span>
        </HomeTankStatRow>)}
    <HomeTankStatRow ui={ui} layout={layout} source="hangditu1">
      <HomeTankStatNumber name="txtTankType" text={sourceTankKind(tank?.[0])}/>
      <HomeTankStatNumber name="txtTankStatus" text=""/>
    </HomeTankStatRow>
    <HomeTankStatRow ui={ui} layout={layout} source="shengyutianshu" endSource="txtStability"
      className="home-tank-stat-days">
      <HomeTankStatLabel name="shengyutianshu" text="剩余天数"/>
      <HomeTankStatNumber name="txtStability" text={sourceOwnedTankDays(fields?.get(0x34))}/>
    </HomeTankStatRow>
  </>;
}

export function HomeTankOwnedParameters({ui, record, pet, catalog, equippedItemIds, alreadyUsed}: Pick<HomeTankSourcePageProps,
    'ui' | 'record' | 'pet' | 'catalog' | 'equippedItemIds' | 'alreadyUsed'>) {
  const suffix = 'myhome_panzerpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const values = homeTankParameters(record, pet, catalog, equippedItemIds, alreadyUsed);
  const background = sourceProps(ui, layout, suffix, 'prgLoadBullet');
  const progress = values ? Math.max(0, Math.min(1, Math.fround(values.capacity * Math.fround(1 / 6)))) : 0;
  const width = Number(background.style.width), height = Number(background.style.height);
  const extent = Math.floor(width * progress + .5);
  return <>
    {([['huangtiao4', 'lblPanzerSide', '侧面装甲', 'txtPanzerSide', 'baifenbi3', '%'],
      ['huangtiao3', 'lblPanzerBack', '背面装甲', 'txtPanzerBack', 'baifenbi4', '%'],
      ['huangditu7', 'lblMoveSpeed', '移动速度', 'txtMoveSpeed', 'km', 'km/h'],
      ['huangditu9', 'lblRotationSpeed', '回旋速度', 'txtRotationSpeed', 'xiegangsec', '°/sec'],
      ['hangditu8', 'lblShootInterval', '发射间隔', 'txtShootInterval', 'sec', 'sec']] as const)
      .map(([source, labelName, label, name, unitName, unit]) =>
        <HomeTankStatRow key={source} ui={ui} layout={layout} source={source}>
          <HomeTankStatLabel name={labelName} text={label}/>
          <span className="home-tank-stat-value">
            <HomeTankStatNumber name={name} text={values ? String(values[name]) : ''}/>
            <HomeTankStatUnit name={unitName} text={unit}/>
          </span>
        </HomeTankStatRow>)}
    <HomeTankStatRow ui={ui} layout={layout} source="huangtiao10" className="home-tank-stat-capacity">
      <HomeTankStatLabel name="lblLoadBullet" text="炮弹容量"/>
      {values && <div className="home-tank-stat-meter" data-source-control="prgLoadBullet" data-home-tank-capacity=""
        role="meter" aria-label="炮弹容量" aria-valuemin={0} aria-valuemax={6} aria-valuenow={values.capacity}>
        <HomeSymbolMeter kind="shells" width={width} height={height} extent={extent}/>
      </div>}
    </HomeTankStatRow>
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

export function HomeTankSourcePage({ui, name, money, description, alreadyUsed, busy, canUse, use, selectedInstance,
  originality, openUpgrade, openEquipment, record, pet, catalog, equippedItemIds}: HomeTankSourcePageProps) {
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
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtOriginality"
      text={originality === undefined ? '' : String(originality)} />
    <HomeTankDescription ui={ui} description={description} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoTank"
      selected aria-pressed="true" aria-label="拥有战车" disabled={busy} aria-busy={busy} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoEquip"
      aria-pressed="false" aria-label="装备部件" disabled={busy || !openEquipment} aria-busy={busy && !!openEquipment}
      onClick={openEquipment} />
    <HomeTankUseControl ui={ui} alreadyUsed={alreadyUsed} busy={busy} canUse={canUse}
      selectedInstance={selectedInstance} use={use} />
  </>;
}
