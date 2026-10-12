import type {ComponentPropsWithoutRef} from 'react';
import {SourceButton} from '../resources/source-button';
import {sourceProps} from '../resources/source-ui-props';
import {DialogButton} from '../resources/dialog-button';
import {GameButton} from '../resources/game-button';
import {ShopPaintedButton} from '../account/shop-source-button';
import './home-artwork.css';

interface HomeButtonPreset {label: string; kind: 'tab' | 'category' | 'summary' | 'use' | 'name' | 'skill';}
const PRESETS: Record<string, HomeButtonPreset> = {
  rdoPlayerPage: {label: '关于我', kind: 'tab'}, rdoPetPage: {label: '猫狗', kind: 'tab'},
  rdoTankPage: {label: '坦克', kind: 'tab'}, rdoWeapon: {label: '武器', kind: 'tab'},
  rdoItem: {label: '辅助', kind: 'tab'}, rdoValuable: {label: '贵重品', kind: 'tab'},
  rdoTank: {label: '坦克', kind: 'tab'}, rdoEquip: {label: '装备零件', kind: 'tab'},
  maogou: {label: '猫狗', kind: 'tab'},
  rdoCommon: {label: '一般', kind: 'category'}, rdoHat: {label: '饰品', kind: 'category'},
  rdoMark: {label: '改装', kind: 'category'},
  btnModifyFire: {label: '火力', kind: 'category'}, btnModifyPanzer: {label: '装甲', kind: 'category'},
  rdoBattleSummary: {label: '战斗统计', kind: 'summary'},
  rdoTitleSummary: {label: '拥有称号', kind: 'summary'},
  rdoAwardSummary: {label: '获奖统计', kind: 'summary'},
  btnUse: {label: '出击！', kind: 'use'}, btnUseMe: {label: '出击！', kind: 'use'},
  xiugainicheng: {label: '修改昵称', kind: 'name'},
};

/** Source positions compose the shared game and dialog button families. */
export function HomeSourceButton({ui, layout, source, suffix, offsetX = 0, offsetY = 0,
  selected = false, className = '', children, ...props}: ComponentPropsWithoutRef<typeof SourceButton>) {
  const preset = ['myhome_petpage.xml', 'shop_petpage.xml'].includes(suffix) && /^btnViewSkill[0-5]$/.test(source)
    ? {label: '', kind: 'skill' as const} : PRESETS[source];
  if (!preset) return <SourceButton ui={ui} layout={layout} source={source} suffix={suffix}
    offsetX={offsetX} offsetY={offsetY} selected={selected} className={className} {...props}>{children}</SourceButton>;
  if (preset.kind === 'tab' || preset.kind === 'category' || preset.kind === 'summary') {
    return <ShopPaintedButton ui={ui} layout={layout} source={source} suffix={suffix}
      offsetX={offsetX} offsetY={offsetY} selected={selected} {...props}
      className={`source-state-button ${preset.kind === 'tab' ? 'home-joined-tab' : preset.kind === 'summary' ? 'home-summary-tab' : ''} ${className}`}
      label={preset.label} kind={preset.kind === 'summary' ? 'category' : preset.kind}
      shape={preset.kind === 'summary' ? 'tab' : undefined}>
      {children}
    </ShopPaintedButton>;
  }
  const position = sourceProps(ui, layout, suffix, source, undefined, offsetX, offsetY);
  const classes = `source-state-button home-button ${className}`;
  const style = {...position.style, ...props.style};
  if (preset.kind === 'name') return <DialogButton {...position} {...props} style={style}
    className={classes} data-home-button="name">{preset.label}{children}</DialogButton>;
  return <GameButton {...position} {...props} style={style} className={classes}
    shape="slab" tone={preset.kind === 'skill' ? 'cyan' : 'orange'} gradient
    data-home-button={preset.kind} data-home-button-selected={selected ? '' : undefined}>
    {preset.kind === 'skill' && <span className="home-skill-level-caption" aria-hidden="true">Lv</span>}
    {preset.label}{children}
  </GameButton>;
}
