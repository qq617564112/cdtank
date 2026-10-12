import type {ComponentPropsWithoutRef, ReactNode} from 'react';
import {GameStatRow} from '../resources/game-stat-row';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {TANK_SHOP_SOURCE_ATTRIBUTES} from './tank-shop-source-attributes';
import {TANK_SHOP_BUY_PARAMETERS} from './tank-shop-buy-parameters';

export function ShopTankStatRow({ui, source, endSource, className = '', children}: {
  ui: HomeSourceUi; source: string; endSource?: string; className?: string; children: ReactNode;
}) {
  const suffix = 'shop_tankpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const bounds = sourceProps(ui, layout, suffix, source);
  const end = endSource ? sourceProps(ui, layout, suffix, endSource).style : undefined;
  return <GameStatRow {...bounds} className={`shop-tank-stat-row ${className}`} style={{...bounds.style,
    ...(end ? {width: Number(end.left) + Number(end.width) - Number(bounds.style.left),
      height: Math.max(Number(bounds.style.height), Number(end.top) + Number(end.height) - Number(bounds.style.top))} : {})}}>
    {children}
  </GameStatRow>;
}

export function ShopTankStatNumber({name, value, className = '', ...props}:
  Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {name: string; value?: string | number}) {
  return <span {...props} className={`home-tank-stat-number ${className}`} data-source-control={name}
    data-source-layout="ui/layouts/shop_tankpage.xml">{value === undefined ? '' : String(value)}</span>;
}

const PARAMETER_ROWS = [
  ['huangtiao4', 'lblPanzerSide', '侧面装甲', 'txtPanzerSide', '%'],
  ['huangtiao3', 'lblPanzerBack', '背面装甲', 'txtPanzerBack', '%'],
  ['huangditu7', 'lblMoveSpeed', '移动速度', 'txtMoveSpeed', 'km/h'],
  ['huangditu9', 'lblRotationSpeed', '回旋速度', 'txtRotateSpeed', '°/sec'],
  ['hangditu8', 'lblShootInterval', '发射间隔', 'txtShootInterval', 'sec'],
] as const;
type ParameterValues = Partial<Record<typeof PARAMETER_ROWS[number][3], string | number>>;

export function ShopTankParameters({ui, values, owned = false}: {
  ui: HomeSourceUi; values?: ParameterValues; owned?: boolean;
}) {
  return <>{PARAMETER_ROWS.map(([source, labelName, label, name, unit]) =>
    <ShopTankStatRow key={source} ui={ui} source={source}>
      <span className="home-tank-stat-label" data-source-control={labelName}>{label}</span>
      <span className="home-tank-stat-value">
        <ShopTankStatNumber name={name} value={values?.[name]}
          data-tank-buy-field={!owned ? name : undefined} data-tank-buy-value={!owned ? values?.[name] : undefined}
          data-tank-owned-parameter={owned ? name : undefined} data-tank-owned-parameter-value={owned ? values?.[name] : undefined}/>
        <span className="home-tank-stat-unit">{unit}</span>
      </span>
    </ShopTankStatRow>)}</>;
}

/** Product table values and owned fields retain their respective account authority. */
export function ShopTankAttributes({ui, tankId, fields, owned = false}: {
  ui: HomeSourceUi; tankId?: number; fields?: ReadonlyMap<number, number>; owned?: boolean;
}) {
  const attributes = TANK_SHOP_SOURCE_ATTRIBUTES[tankId!], levels = TANK_SHOP_BUY_PARAMETERS[tankId!];
  const value = (name: string, offset: number) => owned ? fields?.get(offset) : attributes?.[name];
  return <>
    {([['huangtiao6', 'txtAttack', 0x3c, 'txtAttackExtra', 0x40],
      ['huangtiao5', 'txtPanzer', 0x4c, 'txtPanzerExtra', 0x50]] as const).map(([source, name, offset, extraName, extraOffset]) =>
      <ShopTankStatRow key={source} ui={ui} source={source} className="shop-tank-stat-formula">
        <span className="home-tank-stat-value">
          <ShopTankStatNumber name={name} value={value(name, offset)}
            data-tank-source-attribute={!owned ? name : undefined} data-tank-source-value={!owned ? value(name, offset) : undefined}
            data-tank-owned-field={owned ? offset : undefined} data-owned-value={owned ? value(name, offset) : undefined}/>
          <span className="home-tank-stat-unit">%</span>
          <span className="home-tank-stat-operator">＋</span>
          <ShopTankStatNumber name={extraName} value={value(extraName, extraOffset)}
            data-tank-source-attribute={!owned ? extraName : undefined} data-tank-source-value={!owned ? value(extraName, extraOffset) : undefined}
            data-tank-owned-field={owned ? extraOffset : undefined} data-owned-value={owned ? value(extraName, extraOffset) : undefined}/>
        </span>
      </ShopTankStatRow>)}
    {([['huolidengji', '火 力', 'txtAttackLevel', 0x44], ['zhuangjia', '装 甲', 'txtPanzerLevel', 0x54]] as const)
      .map(([source, label, name, offset]) => <ShopTankStatRow key={name} ui={ui} source={source} endSource={name}
        className="shop-tank-stat-heading">
        <span className="home-tank-stat-label">{label}</span>
        <span className="home-tank-stat-value">
          <span className="home-tank-stat-unit">Lv</span>
          <ShopTankStatNumber name={name} value={owned ? fields?.get(offset) : levels?.[name]}
            data-tank-buy-field={!owned ? name : undefined} data-tank-buy-value={!owned ? levels?.[name] : undefined}
            data-tank-owned-field={owned ? offset : undefined} data-owned-value={owned ? fields?.get(offset) : undefined}/>
        </span>
      </ShopTankStatRow>)}
  </>;
}
