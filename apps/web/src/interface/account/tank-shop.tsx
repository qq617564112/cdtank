import {loadCombatCatalog} from '../../content';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../../shared/protocols/PtlOwnedRoleSale';
import {createRequestId} from '../../network/request-id';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {SourceNotice} from '../dialogs/source-notice';
import {SourceNoticeView} from '../dialogs/source-notice-view';
import {createPortal} from 'react-dom';
import type {ShopCurrency} from '../../../../shared/protocols/PtlShop';
import {ShopPurchaseSource} from './shop-purchase-source';
import {TankShopOwnedPartSourceRegions} from './tank-shop-owned-part-source-regions';
import {SourceImageScale} from '../resources/source-static-image';
import {TANK_SHOP_SOURCE_ATTRIBUTES} from './tank-shop-source-attributes';
import {TankShopBuyParametersView} from './tank-shop-buy-parameters-view';
import {TankShopOwnedParametersView} from './tank-shop-owned-parameters-view';
import {tankShopOwnedParameters} from './tank-shop-owned-parameters';
import {TankShopTextureView, type TankTextureOwner} from './tank-shop-texture';
import './tank-shop.css';
import {RoleShopSourceList} from './role-shop-source-list';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ReqTankShop, ResTankShop} from '../../../../shared/protocols/PtlTankShop';
import type {ShopSource} from './shop';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import {readOwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {TankShopSourceRegions} from './tank-shop-source-regions';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {SourceButton} from '../resources/source-button';
import {sourceProps} from '../resources/source-ui-props';
import {TankProductPreview} from '../resources/tank-product-preview';
import {sourceTankDescription} from '../resources/role-source-descriptions';

export interface TankPurchaseOwner {
  salePending?: ReqOwnedRoleSale;
  saleInFlight?: Promise<ResOwnedRoleSale>;
  texture?: TankTextureOwner;
  pending?: ReqTankShop;
  inFlight?: Promise<ResTankShop>;
  selected?: number;
  purchasedInstance?: number;
  session?: {identity: object; refresh: () => void};
}

export function TankShopView({ui, source, owner, onBusy, scale, onMoney, initialTextureInstance}: {
  ui: HomeSourceUi; source: ShopSource; owner: TankPurchaseOwner; onBusy: (busy: boolean) => void; scale: number; onMoney?: (money: number) => void; initialTextureInstance?: number;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_tankpage.xml');
  owner.texture ??= {};
  const [mode, setMode] = useState<'Buy' | 'Owned' | 'Texture'>(() => {
    if (initialTextureInstance !== undefined) {owner.texture!.selected = initialTextureInstance; return 'Texture';}
    return 'Buy';
  });
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [sale, setSale] = useState<ResOwnedRoleSale>();
  const [saleConfirm, setSaleConfirm] = useState(false);
  const [buyConfirm, setBuyConfirm] = useState(false);
  const [currency, setCurrency] = useState<ShopCurrency>(owner.pending?.currency ?? 'TOKENS');
  const [notice] = useState(() => new SourceNotice());
  const generation = useRef(0);
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [ownedSelection, setOwnedSelection] = useState<number>();
  const [partEquipment, setPartEquipment] = useState<ResEquipment>();
  const [partInventory, setPartInventory] = useState<ResInventory>();
  const [ownedConfirmed, setOwnedConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState<ResTankShop>();
  const [selected, setSelected] = useState(owner.pending?.tankId ?? owner.selected);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('正在载入战车目录…');
  const session = useRef({active: false, query: false, identity: {}});
  const focusAfterCommit = useRef<HTMLElement | null>(null);
  const ownedRecord = owned?.equipment.find(record => new Map(record.fields).get(0x1c) === ownedSelection);
  const ownedFields = ownedRecord ? new Map(ownedRecord.fields) : undefined;
  const displayedTankId = mode === 'Owned' ? ownedFields?.get(0x24) : selected;
  const product = confirmed?.tanks.find(tank => tank.tankId === displayedTankId);
  const saleQuote = sale?.quotes.find(quote => quote.kind === 'tank' && quote.instanceId === ownedSelection);
  const displayedName = mode === 'Owned' ? ownedRecord?.name ?? '' : product?.name ?? '';
  const displayedDescription = mode === 'Owned' ? sourceTankDescription(displayedTankId) : product?.info;
  const descriptionText = mode === 'Owned' ? displayedDescription : product ? `${product.name} — ${product.info}` : undefined;
  const previewTextures = mode === 'Owned' && ownedRecord
    ? readOwnedTankTextures({name: ownedRecord.name, fields: new Map(ownedRecord.fields)}) : product?.textures;
  const ownedPartEquipment = partEquipment?.tankInstanceId === ownedSelection ? partEquipment : undefined;
  const ownedParameters = ownedConfirmed ? tankShopOwnedParameters({owned, record: ownedRecord, profile: sale?.profile,
    partEquipment: ownedPartEquipment, inventory: partInventory, catalog}) : undefined;
  useEffect(() => () => notice.clear(), [notice]);
  useEffect(() => {if (mode !== 'Texture') onBusy(busy);}, [busy, onBusy, mode]);
  useEffect(() => {
    setPartEquipment(undefined); setPartInventory(undefined);
    if (mode !== 'Owned' || ownedSelection === undefined) return;
    if (!source.equipment || !source.inventory) return;
    let active = true;
    void Promise.all([
      source.equipment({operation: 'QUERY', tankInstanceId: ownedSelection}),
      source.inventory(),
    ]).then(([equipment, inventory]) => {
      if (!active) return;
      if (equipment.tankInstanceId !== ownedSelection) return;
      setPartEquipment(equipment); setPartInventory(inventory);
    }).catch(() => {
      if (active) {
        setPartEquipment(undefined); setPartInventory(undefined);
        void notice.show('部件信息载入失败，请重试');
      }
    });
    return () => {active = false;};
  }, [mode, ownedSelection, source, notice]);
  useEffect(() => {
    setOwnedConfirmed(false);
    const current = {active: true, query: false, identity: {}}; session.current = current;
    let queued = false;
    async function refresh() {
      if (!current.active) return;
      if (current.query) {queued = true; return;}
      current.query = true; setBusy(true);
      try {
        const result = await source.tankShop!({operation: 'QUERY'});
        if (!current.active) return;
        setConfirmed(result);
        setSelected(value => {
          const id = result.tanks.some(tank => tank.tankId === value) ? value : result.tanks[0]?.tankId;
          owner.selected = id; return id;
        });
        setStatus(owner.inFlight ? '等待购买确认…' : owner.pending ? '购买尚未确认，可重试原请求。' : '');
      } catch (error) {
        if (current.active) {
          const message = error instanceof Error ? error.message : '战车目录载入失败';
          setStatus(message); void notice.show(message);
        }
      } finally {
        current.query = false;
        if (current.active) {
          setBusy(Boolean(owner.inFlight || owner.saleInFlight));
          if (queued) {queued = false; void refresh();}
        }
      }
    }
    owner.session = {identity: current.identity, refresh: () => {void refresh();}};
    void refresh();
    return () => {generation.current++; current.active = false; if (owner.session?.identity === current.identity) owner.session = undefined;};
  }, [source, owner, notice]);
  useLayoutEffect(() => {
    if (busy || !focusAfterCommit.current) return;
    const target = focusAfterCommit.current; focusAfterCommit.current = null;
    if (target.isConnected && (document.activeElement === document.body || document.activeElement === target
      || document.activeElement?.id === 'account-shop')) target.focus();
  }, [busy]);
  async function openOwned() {
    const current = session.current;
    if (!current.active || busy || owner.inFlight || owner.saleInFlight || !source.ownedRoles) return;
    const ticket = ++generation.current;
    setOwnedConfirmed(false);
    setMode('Owned'); setBusy(true); setStatus('正在载入拥有战车…');
    try {
      const [result, metadata] = await Promise.all([source.ownedRoleSale ? source.ownedRoleSale({operation: 'QUERY'}) : undefined,
        loadCombatCatalog()]);
      const records = result?.owned ?? await source.ownedRoles();
      if (!current.active) return;
      if (generation.current !== ticket) return;
      setOwned(records); setCatalog(metadata); setSale(result);
      setOwnedConfirmed(true);
      if (result?.money !== undefined) {setConfirmed(value => value && {...value, money: result.money!}); onMoney?.(result.money);}
      setOwnedSelection(value => records.equipment.some(record => new Map(record.fields).get(0x1c) === value)
        ? value : records.equipment[0] ? new Map(records.equipment[0].fields).get(0x1c) : undefined);
      setStatus('');
    } catch (error) {
      if (current.active && generation.current === ticket) {
        const message = error instanceof Error ? error.message : '拥有战车载入失败';
        setStatus(message); void notice.show(message);
      }
    } finally {
      if (current.active) setBusy(Boolean(owner.inFlight || owner.saleInFlight));
    }
  }
  function requestSale(button: HTMLButtonElement) {
    if (busy || owner.saleInFlight || !saleQuote?.canSell || saleQuote.selected || !source.ownedRoleSale) return;
    if (!owner.salePending || owner.salePending.instanceId !== saleQuote.instanceId) {
      owner.salePending = {operation: 'SELL', kind: 'tank', instanceId: saleQuote.instanceId,
        requestId: createRequestId()};
    }
    focusAfterCommit.current = button;
    setStatus(''); setSaleConfirm(true);
  }
  async function sell() {
    const current = session.current, ticket = generation.current;
    if (!current.active || owner.saleInFlight || !owner.salePending || !source.ownedRoleSale) return;
    setBusy(true); setStatus('等待出售确认…');
    const inFlight = source.ownedRoleSale(owner.salePending); owner.saleInFlight = inFlight;
    try {
      const result = await inFlight;
      owner.salePending = undefined;
      if (!current.active || generation.current !== ticket) return;
      setOwned(result.owned); setSale(result);
      setOwnedConfirmed(true);
      setOwnedSelection(value => result.owned.equipment.some(record => new Map(record.fields).get(0x1c) === value)
        ? value : result.owned.equipment[0] ? new Map(result.owned.equipment[0].fields).get(0x1c) : undefined);
      if (result.money !== undefined) {setConfirmed(value => value && {...value, money: result.money!}); onMoney?.(result.money);}
      setSaleConfirm(false); setStatus(''); void notice.show('这辆坦克已售出。');
    } catch (error) {
      if (current.active && generation.current === ticket) setStatus(error instanceof Error ? error.message : '出售未确认，请重试原请求');
    } finally {
      owner.saleInFlight = undefined;
      if (current.active && generation.current === ticket) setBusy(current.query);
      else owner.session?.refresh();
    }
  }
  function requestPurchase(button: HTMLButtonElement) {
    if (busy || session.current.query || owner.inFlight || mode !== 'Buy' || !product) return;
    focusAfterCommit.current = button;
    setCurrency(owner.pending?.tankId === product.tankId ? owner.pending.currency ?? 'MONEY'
      : product.tokenPrice > 0 ? 'TOKENS' : 'MONEY');
    setStatus(''); setBuyConfirm(true);
  }
  async function purchase() {
    const current = session.current;
    if (!current.active || current.query || owner.inFlight || mode !== 'Buy' || !product) return;
    if (!owner.pending || owner.pending.tankId !== product.tankId || owner.pending.currency !== currency) {
      owner.pending = {operation: 'BUY', tankId: product.tankId, currency, requestId: createRequestId()};
    }
    setBusy(true); setStatus('等待购买确认…');
    const inFlight = source.tankShop!(owner.pending); owner.inFlight = inFlight;
    try {
      const result = await inFlight;
      owner.pending = undefined;
      owner.purchasedInstance = result.purchased?.fields.find(([offset]) => offset === 0x1c)?.[1];
      if (current.active) {
        setConfirmed(result);
        setSelected(value => {
          const id = result.tanks.some(tank => tank.tankId === value) ? value : result.tanks[0]?.tankId;
          owner.selected = id; return id;
        });
        setBuyConfirm(false); setStatus('');
        void notice.show('你买的新坦克很厉害的哦，快去试试它的威力吧。');
      }
    } catch (error) {
      if (current.active) setStatus(error instanceof Error ? error.message : '购买未确认，请重试');
    } finally {
      owner.inFlight = undefined;
      if (current.active) setBusy(current.query); else owner.session?.refresh();
    }
  }
  if (mode === 'Texture') return <TankShopTextureView ui={ui} source={source} owner={owner.texture} scale={scale}
    onBusy={onBusy} onBuy={() => {setOwnedConfirmed(false); setMode('Buy'); owner.session?.refresh();}} />;
  return <SourceImageScale value={1}>
    <TankShopSourceRegions ui={ui} />
    {mode === 'Owned' && <TankShopOwnedPartSourceRegions ui={ui}
      partSlotCount={catalog?.tankTypes?.find(value => value.tankId === displayedTankId)?.partSlotCount}
      equipment={ownedPartEquipment} inventory={partInventory} catalog={catalog} />}
    {mode === 'Buy' && product && <TankShopBuyParametersView ui={ui} tankId={product.tankId} />}
    {mode === 'Owned' && <TankShopOwnedParametersView ui={ui} values={ownedParameters} />}
    {mode === 'Buy' && product && Object.entries(TANK_SHOP_SOURCE_ATTRIBUTES[product.tankId] ?? {}).map(([name, value]) =>
      <SourceStaticText key={name} ui={ui} layout={layout} suffix="shop_tankpage.xml" name={name}
        text={String(value)} className="tank-shop-source-attribute" data-tank-source-attribute={name}
        data-tank-source-value={value} data-tank-source-product={product.tankId} />)}
    {mode === 'Owned' && ownedRecord && ([['txtAttack', 0x3c], ['txtAttackExtra', 0x40],
      ['txtPanzer', 0x4c], ['txtPanzerExtra', 0x50], ['txtAttackLevel', 0x44], ['txtPanzerLevel', 0x54]] as const)
      .map(([name, offset]) => <SourceStaticText key={name} ui={ui} layout={layout} suffix="shop_tankpage.xml" name={name}
        className="tank-shop-source-attribute" text={ownedFields?.has(offset) ? String(ownedFields.get(offset)) : ''}
        data-tank-owned-field={offset} data-owned-value={ownedFields?.get(offset)} />)}
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="rdoTexture"
      data-tank-shop-texture-tab="" aria-label="更换拥有战车迷彩" disabled={busy || !source.ownedRoles || !source.roleProfile || !source.configureTankTextures}
      onClick={() => {generation.current++; setOwnedConfirmed(false); setSaleConfirm(false); setBuyConfirm(false); setMode('Texture');}} />
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtMoney" text={confirmed?.money === undefined ? '' : String(confirmed.money)}/>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtCoin" text={confirmed?.tokens === undefined ? '' : String(confirmed.tokens)}/>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtName" text={displayedName}/>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtListQuantity" text={mode === 'Owned' ? owned ? String(owned.equipment.length) : '' : confirmed ? String(confirmed.tanks.length) : ''}/>
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="rdoBuy" selected={mode === 'Buy'}
      data-tank-shop-buy-tab="" aria-label="购买战车商品" aria-pressed={mode === 'Buy'} disabled={busy} onClick={() => {generation.current++; setOwnedConfirmed(false); setSaleConfirm(false); setBuyConfirm(false); setMode('Buy'); setStatus(''); owner.session?.refresh();}} />
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="rdoSell" selected={mode === 'Owned'}
      data-tank-shop-owned-tab="" aria-label="拥有战车" aria-pressed={mode === 'Owned'} disabled={busy || !source.ownedRoles}
      onClick={() => {void openOwned();}} />
    <RoleShopSourceList ui={ui} kind="tank" entries={mode === 'Owned' ? owned?.equipment.map(record => {
      const fields = new Map(record.fields), tankId = fields.get(0x24);
      return {id: fields.get(0x1c)!, name: record.name, tankId, durationMinutes: fields.get(0x34),
        tankType: catalog?.tankTypes?.find(value => value.tankId === tankId)?.tankType,
        tankMoney: catalog?.tankTypes?.find(value => value.tankId === tankId)?.tankMoney, owned: true};
    }) ?? [] : confirmed?.tanks.map(entry => ({id: entry.tankId, name: entry.name, moneyPrice: entry.moneyPrice, tokenPrice: entry.tokenPrice, tankType: entry.tankType, defaultDurability: entry.defaultDurability})) ?? []}
      selected={mode === 'Owned' ? ownedSelection : selected} busy={busy} select={id => {
        if (mode === 'Owned') setOwnedSelection(id); else {owner.selected = id; setSelected(id);}
      }}/>
    {displayedTankId !== undefined && previewTextures && <TankProductPreview {...sourceProps(ui, layout, 'shop_tankpage.xml', 'picModel')}
      tankId={displayedTankId} textures={previewTextures} scale={scale} data-tank-shop-preview=""/>}
    <div {...sourceProps(ui, layout, 'shop_tankpage.xml', 'edtDescription')}
      className="tank-shop-product" data-tank-shop-product="" data-presentation-colour="web-readable"
      data-description-source={descriptionText ? mode === 'Owned' ? 'original-tank-table' : 'confirmed-tank-shop-product' : 'unavailable'}
      role={descriptionText ? 'region' : undefined}
      aria-label={descriptionText ? mode === 'Owned' ? '拥有战车介绍' : '战车商品介绍' : undefined}
      tabIndex={descriptionText ? 0 : -1}>{descriptionText ?? ''}</div>
    {mode === 'Buy' && <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="btnBuy" data-tank-shop-buy=""
      aria-label="购买选中战车" disabled={busy || !product} onClick={event => requestPurchase(event.currentTarget)}/>}
    {buyConfirm && product && <ShopPurchaseSource ui={ui} name={product.name}
      moneyPrice={product.moneyPrice} tokenPrice={product.tokenPrice} currency={currency}
      changeCurrency={value => {setCurrency(value); setStatus('');}} pending={busy} status={status}
      confirm={() => {void purchase();}} cancel={() => {setBuyConfirm(false); setStatus('');}}/>}
    {mode === 'Owned' && <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="btnSell"
      data-tank-shop-sell="" aria-label="出售选中战车" disabled={busy || !source.ownedRoleSale || !saleQuote?.canSell || saleQuote.selected}
      onClick={event => requestSale(event.currentTarget)} />}
    {saleConfirm && <SourceConfirmView label="出售战车" binding="owned-tank-sale"
      message="你确定出售这辆坦克吗？" pending={busy} disabled={!saleQuote?.canSell || saleQuote.selected}
      status={status} confirm={() => {void sell();}} cancel={() => {setSaleConfirm(false);}} />}
    <output hidden data-tank-shop-status="" data-purchased-tank-instance={owner.purchasedInstance}>{status}</output>
    {createPortal(<SourceNoticeView notice={notice}/>, document.body)}
  </SourceImageScale>;
}
