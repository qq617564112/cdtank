import {sourceProps} from '../resources/source-ui-props';
import type {MouseEventHandler} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';

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
  openEquipment?: () => void;
  record?: OwnedRoleRecordData;
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

export function HomeTankOwnedAttributes({ui, record}: {ui: HomeSourceUi; record?: OwnedRoleRecordData}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  return <>{([['txtAttack', 0x3c], ['txtAttackExtra', 0x40], ['txtPanzer', 0x4c], ['txtPanzerExtra', 0x50]] as const)
      .map(([name, offset]) => <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
        className="home-tank-owned-attribute" text={fields?.has(offset) ? String(fields.get(offset)) : ''}
        data-home-tank-owned-field={offset} data-owned-value={fields?.get(offset)} />)}</>;
}

export function HomeTankDescription({ui, description}: {ui: HomeSourceUi; description?: string}) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <div {...sourceProps(ui, layout, suffix, 'edtTankDesc')} className="home-tank-description"
    role="region" aria-label="战车介绍" tabIndex={description ? 0 : -1}
    data-home-tank-description="" data-description-source={description === undefined ? 'unavailable' : 'original-tank-table'}
    data-presentation-colour="web-readable">{description ?? ''}</div>;
}

export function HomeTankSourcePage({ui, name, money, quantity, description, alreadyUsed, busy, canUse, use, selectedInstance, openEquipment, record}: HomeTankSourcePageProps) {
  const suffix = 'myhome_panzerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <>
    <HomeTankSourceRegions ui={ui} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtTankName" text={name} />
    <HomeTankOwnedAttributes ui={ui} record={record} />
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
