import type {ComponentProps} from 'react';
import {SourceButton} from '../resources/source-button';
import {sourceProps} from '../resources/source-ui-props';
import {GameButton, type GameButtonShape} from '../resources/game-button';
import {ShopMaintenanceArtwork, ShopTabArtwork} from './shop-panel-artwork';

type ShopButtonKind = 'tab' | 'category' | 'action' | 'maintenance';
const BUTTON_SHAPES: Record<ShopButtonKind, GameButtonShape> = {
  tab: 'tab', category: 'slab', action: 'slab', maintenance: 'slab',
};

const LABELS: Record<string, string> = {
  rdoPetPage: '猫狗', rdoTankPage: '坦克', rdoItemPage: '道具', rdoPartPage: '零件', rdoMendPage: '维修中心',
  rdoMyWeaponPage: '武器', rdoMyItemPage: '辅助', rdoShopWeaponPage: '武器', rdoShopItemPage: '辅助',
  rdoMyCommonPage: '一般', rdoMyHatPage: '饰品', rdoMyMarkPage: '标志',
  rdoShopCommonPage: '一般', rdoShopHatPage: '饰品', rdoShopMarkPage: '标志',
  rdoCommonPage: '一般', rdoHatPage: '饰品', rdoMarkPage: '标志', rdoTexture: '换涂装',
  btnBuy: '购买', btnSell: '出售', btnChangeTexture: '更换',
};

/** Shop controls compose the lobby's GameButton at their original coordinates. */
export function ShopSourceButton({price, ...props}: ComponentProps<typeof SourceButton> & {price?: string}) {
  const {source, suffix} = props;
  if (source === 'btnClose') return <SourceButton {...props}/>;
  if (/^btn(?:Dec|Inc)(?:Turret|Body|Tread)Texture$/.test(source)) {
    return <ShopPaintedButton {...props} label="" kind="category"
      shape={source.startsWith('btnDec') ? 'previous' : 'next'} gradient/>;
  }
  const maintenance = /^btn(?:Coin|Money)Mend[0-2]$/.test(source);
  const label = source === 'rdoBuy' ? suffix === 'shop_petpage.xml' ? '买猫狗' : '买坦克'
    : source === 'rdoSell' ? suffix === 'shop_petpage.xml' ? '卖猫狗' : '卖坦克' : LABELS[source];
  if (!label && !maintenance) return <SourceButton {...props}/>;
  const kind: ShopButtonKind = maintenance ? 'maintenance'
    : source.startsWith('btn') ? 'action'
    : source.startsWith('rdoShop') || ['rdoCommonPage', 'rdoHatPage', 'rdoMarkPage'].includes(source) ? 'category' : 'tab';
  return <ShopPaintedButton {...props} className={`${kind === 'tab' ? 'shop-joined-tab' : ''} ${props.className ?? ''}`}
    label={label ?? ''} price={price} kind={kind} gradient/>;
}

export function ShopPaintedButton({ui, layout, source, suffix, offsetX = 0, offsetY = 0,
  selected = false, className = '', label, price, kind, shape = BUTTON_SHAPES[kind], children, ...props}:
  ComponentProps<typeof SourceButton> & {label: string; price?: string; kind: ShopButtonKind; shape?: GameButtonShape; gradient?: boolean}) {
  const position = sourceProps(ui, layout, suffix, source, undefined, offsetX, offsetY);
  const style = {...position.style, ...props.style};
  return <GameButton {...position} {...props} shape={shape}
    aria-label={price === undefined ? props['aria-label'] : `${props['aria-label'] ?? label}（${price}）`}
    className={`shop-source-button ${className}`} style={style}
    data-shop-button-kind={kind} data-shop-button-checked={selected ? '' : undefined}
    data-shop-button-price={price}>
    {kind === 'tab' && <ShopTabArtwork width={Number(style.width)} height={Number(style.height)}/>}
    {kind === 'maintenance' && <ShopMaintenanceArtwork width={Number(style.width)} height={Number(style.height)}/>}
    {label && <span className="shop-button-label">{price === undefined ? label : <>
      <span className="shop-button-title">{label}</span>
      <span className="shop-button-price">（{price}）</span>
    </>}</span>}
    {children}
  </GameButton>;
}
