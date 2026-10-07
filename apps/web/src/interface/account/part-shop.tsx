import type {ReqPartSale, ResPartSale} from '../../../../shared/protocols/PtlPartSale';
import {createRequestId} from '../../network/request-id';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import './part-shop.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ReqShop, ResShop, ShopCurrency} from '../../../../shared/protocols/PtlShop';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {ShopSource} from './shop';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {PartShopSourcePage, type PartShopCategory} from './part-shop-source-page';
import {PartShopSourceList} from './part-shop-source-list';

export interface PartPurchaseOwner {
  salePending?: ReqPartSale; saleInFlight?: Promise<ResPartSale>;
  pending?: ReqShop; inFlight?: Promise<ResShop>; selected?: number;
  session?: {identity: object; refresh: () => void};
}
const inCategory = (id: number, category: PartShopCategory) => {
  const type = classifyItemId(id);
  return category === 'Common' ? type >= 8 && type <= 12 : type === (category === 'Hat' ? 5 : 7);
};
const MARK_CATALOG_IDS = [12501, 12502, 12503] as const;
const hasMarkCatalog = (items: readonly {itemTableId: number}[]) =>
  MARK_CATALOG_IDS.every(id => items.some(item => item.itemTableId === id && inCategory(item.itemTableId, 'Mark')));
const HAT_CATALOG_IDS = Array.from({length: 40}, (_, index) => 10001 + index);
const hasHatCatalog = (items: readonly {itemTableId: number}[]) =>
  HAT_CATALOG_IDS.every(id => items.some(item => item.itemTableId === id && inCategory(item.itemTableId, 'Hat')));
const categoryForItem = (id: number): PartShopCategory => {
  const type = classifyItemId(id);
  return type >= 8 && type <= 12 ? 'Common' : type === 5 ? 'Hat' : type === 7 ? 'Mark' : 'Common';
};
const positivePrice = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value > 0;

/** Part purchases reuse the existing Shop transaction and refresh real inventory. */
export function PartShopView({ui, source, owner, onBusy, onEquipmentPage, onMoney}: {
  ui: HomeSourceUi; source: ShopSource; owner: PartPurchaseOwner; onBusy: (busy: boolean) => void;
  onEquipmentPage?: () => void; onMoney?: (money: number) => void;
}) {
  const session = useRef({active: false, query: false, identity: {}});
  const [confirmed, setConfirmed] = useState<ResShop>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [sale, setSale] = useState<ResPartSale>();
  const [saleConfirm, setSaleConfirm] = useState(false);
  const generation = useRef(0);
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const initialSelected = owner.pending?.itemTableId ?? owner.selected;
  const [selected, setSelected] = useState(initialSelected);
  const [ownedSelected, setOwnedSelected] = useState<number>();
  const [category, setCategory] = useState<PartShopCategory>(() => initialSelected === undefined ? 'Common' : categoryForItem(initialSelected));
  const [ownedCategory, setOwnedCategory] = useState<PartShopCategory>('Common');
  const [currency, setCurrency] = useState<ShopCurrency>(owner.pending?.currency ?? 'MONEY');
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('载入部件商品与库存…');
  const focusAfterCommit = useRef<HTMLButtonElement | null>(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const products = confirmed?.items.filter(item => inCategory(item.itemTableId, category)) ?? [];
  const product = products.find(item => item.itemTableId === selected);
  const hatAvailable = confirmed ? hasHatCatalog(confirmed.items) : false;
  const markAvailable = confirmed ? hasMarkCatalog(confirmed.items) : false;
  const moneyPrice = product && positivePrice(product.moneyPrice) ? product.moneyPrice : undefined;
  const tokenPrice = product && positivePrice(product.tokenPrice) ? product.tokenPrice : undefined;
  const effectiveCurrency = currency === 'MONEY' && moneyPrice !== undefined ? 'MONEY'
    : currency === 'TOKENS' && tokenPrice !== undefined ? 'TOKENS'
      : moneyPrice !== undefined ? 'MONEY' : tokenPrice !== undefined ? 'TOKENS' : undefined;
  const unitPrice = effectiveCurrency === 'MONEY' ? moneyPrice : effectiveCurrency === 'TOKENS' ? tokenPrice : undefined;
  const owned = inventory?.records.filter(item => inCategory(item.itemTableId, ownedCategory)) ?? [];
  useEffect(() => {onBusy(busy);}, [busy, onBusy]);
  useEffect(() => {
    if (effectiveCurrency && effectiveCurrency !== currency) setCurrency(effectiveCurrency);
  }, [effectiveCurrency, currency]);
  useEffect(() => {
    generation.current++;
    const current = {active: true, query: false, identity: {}}; session.current = current;
    const controller = new AbortController(); let queued = false;
    async function refresh() {
      if (!current.active) return;
      if (current.query) {queued = true; return;}
      current.query = true; setBusy(true);
      try {
        const [shop, saleResult, response] = await Promise.all([source.shop({operation: 'QUERY'}),
          source.partSale?.({operation: 'QUERY'}), fetch('/combat-catalog.json', {signal: controller.signal})]);
        if (!response.ok) throw new Error('部件资料载入失败');
        const definitions = await response.json() as CombatCatalog;
        if (!current.active) return;
        const items = saleResult?.inventory ?? await source.inventory?.();
        if (!current.active) return;
        setConfirmed(saleResult?.money === undefined ? shop : {...shop, money: saleResult.money});
        setInventory(items); setSale(saleResult); setCatalog(definitions);
        if (saleResult?.money !== undefined) onMoney?.(saleResult.money);
        const hatCatalogComplete = hasHatCatalog(shop.items);
        const markCatalogComplete = hasMarkCatalog(shop.items);
        const nextCategory = categoryRef.current === 'Hat' && !hatCatalogComplete ? 'Common'
          : categoryRef.current === 'Mark' && !markCatalogComplete ? 'Common' : categoryRef.current;
        categoryRef.current = nextCategory; setCategory(nextCategory);
        setSelected(value => {const id = shop.items.some(item => item.itemTableId === value
          && inCategory(item.itemTableId, nextCategory)) ? value
          : shop.items.find(item => inCategory(item.itemTableId, nextCategory))?.itemTableId;
        owner.selected = id; return id;});
        setStatus(owner.inFlight ? '等待购买确认…' : owner.pending ? '购买未确认，可重试原请求。' : '购买部件后可前往装备。');
      } catch (error) {if (current.active) setStatus(error instanceof Error ? error.message : '部件资料载入失败');}
      finally {current.query = false; if (current.active) {setBusy(Boolean(owner.inFlight || owner.saleInFlight)); if (queued) {queued = false; void refresh();}}}
    }
    owner.session = {identity: current.identity, refresh: () => {void refresh();}}; void refresh();
    return () => {generation.current++; current.active = false; controller.abort(); if (owner.session?.identity === current.identity) owner.session = undefined;};
  }, [source, owner]);
  useLayoutEffect(() => {
    const target = focusAfterCommit.current;
    if (busy || !target) return; focusAfterCommit.current = null;
    if (target.isConnected && (document.activeElement === document.body || document.activeElement === target
      || document.activeElement?.id === 'account-shop')) target.focus();
  }, [busy]);
  async function purchase(button: HTMLButtonElement) {
    const current = session.current;
    if (!current.active || current.query || owner.inFlight || owner.saleInFlight || !product
        || effectiveCurrency === undefined || unitPrice === undefined) return;
    if (!owner.pending || owner.pending.itemTableId !== product.itemTableId || owner.pending.currency !== effectiveCurrency) {
      owner.pending = {operation: 'BUY', itemTableId: product.itemTableId, quantity: 1,
        currency: effectiveCurrency, requestId: createRequestId()};
    }
    focusAfterCommit.current = button; setBusy(true); setStatus('等待购买确认…');
    const request = source.shop(owner.pending); owner.inFlight = request;
    try {
      const result = await request; owner.pending = undefined;
      if (current.active) {
        setConfirmed(result); setStatus(`已购买${product.name}，正在查询库存…`);
        const saleResult = await source.partSale?.({operation: 'QUERY'});
        const items = saleResult?.inventory ?? await source.inventory?.();
        if (current.active) {setInventory(items); setSale(saleResult);
          if (saleResult?.money !== undefined) {setConfirmed(value => value && {...value, money: saleResult.money!}); onMoney?.(saleResult.money);} setOwnedSelected(result.purchased?.instanceId);
          setStatus(`已购买${product.name}，可在装备页配置。`);}
      }
    } catch (error) {if (current.active) setStatus(error instanceof Error ? error.message : '购买未确认，请重试');}
    finally {owner.inFlight = undefined; if (current.active) setBusy(current.query); else owner.session?.refresh();}
  }
  function requestSale(instanceId: number, button: HTMLButtonElement) {
    const quote = sale?.quotes.find(value => value.instanceId === instanceId);
    if (!session.current.active || busy || owner.inFlight || owner.saleInFlight || !quote?.canSell || !source.partSale) return;
    if (owner.salePending?.instanceId !== instanceId) {
      owner.salePending = {operation: 'SELL', instanceId, requestId: createRequestId()};
    }
    setOwnedSelected(instanceId); focusAfterCommit.current = button;
    setStatus(''); setSaleConfirm(true);
  }
  function selectProductCategory(kind: PartShopCategory) {
    if (busy || kind === 'Hat' && !hatAvailable || kind === 'Mark' && !markAvailable) return;
    categoryRef.current = kind; setCategory(kind);
    const id = confirmed?.items.find(item => inCategory(item.itemTableId, kind))?.itemTableId;
    owner.selected = id; setSelected(id);
  }
  async function sell() {
    const current = session.current, ticket = generation.current;
    if (!current.active || owner.saleInFlight || !owner.salePending || !source.partSale) return;
    setBusy(true); setStatus('等待出售确认…');
    const inFlight = source.partSale(owner.salePending); owner.saleInFlight = inFlight;
    try {
      const result = await inFlight;
      if (result.sold?.result !== 1) throw new Error('出售未确认，请重试原请求');
      owner.salePending = undefined;
      if (!current.active || generation.current !== ticket) return;
      setInventory(result.inventory); setSale(result);
      setOwnedSelected(value => result.inventory.records.some(record => record.instanceId === value)
        ? value : result.inventory.records.find(record => inCategory(record.itemTableId, ownedCategory))?.instanceId);
      if (result.money !== undefined) {setConfirmed(value => value && {...value, money: result.money!}); onMoney?.(result.money);}
      focusAfterCommit.current = document.querySelector<HTMLButtonElement>(`[data-part-owned-instance]:not([data-part-owned-instance="${result.sold.instanceId}"])`)
        ?? document.querySelector<HTMLButtonElement>('[data-part-refresh]');
      setSaleConfirm(false); setStatus(`已出售零件实例${result.sold.instanceId}，收入${result.sold.price}金币。`);
    } catch (error) {
      if (current.active && generation.current === ticket) setStatus(error instanceof Error ? error.message : '出售未确认，请重试原请求');
    } finally {
      owner.saleInFlight = undefined;
      if (current.active && generation.current === ticket) setBusy(current.query); else owner.session?.refresh();
    }
  }
  return <>
    <PartShopSourcePage ui={ui} money={confirmed?.money} tokens={confirmed?.tokens} quantity={inventory ? owned.length : undefined}
      category={category} ownedCategory={ownedCategory} busy={busy} hatAvailable={hatAvailable} markAvailable={markAvailable} selectCategory={selectProductCategory}
      selectOwned={value => {generation.current++; setSaleConfirm(false); setOwnedCategory(value); setOwnedSelected(undefined);}} />
    <PartShopSourceList ui={ui} source="lstShopEquip" selected={selected} busy={busy}
      select={id => {owner.selected = id; setSelected(id);}}
      entries={products.map(item => ({id: item.itemTableId, itemTableId: item.itemTableId, product: item, name: item.name, iconId: item.iconId,
        detail: [positivePrice(item.moneyPrice) ? `${item.moneyPrice}金币` : '',
          positivePrice(item.tokenPrice) ? `${item.tokenPrice}软星币` : ''].filter(Boolean).join(' / ')}))} />
    <PartShopSourceList ui={ui} source="lstMyEquip" selected={ownedSelected} busy={busy} select={setOwnedSelected}
      activate={requestSale} canActivate={id => Boolean(source.partSale && sale?.quotes.some(quote => quote.instanceId === id && quote.canSell))}
      entries={owned.map(item => {const definition = catalog?.items.find(value => value.itemTableId === item.itemTableId);
        return {id: item.instanceId, itemTableId: item.itemTableId, ownedQuantity: item.ownedQuantity, moneyPrice: definition?.moneyPrice, name: definition?.name ?? String(item.itemTableId),
          iconId: definition?.iconId ?? 0, detail: `×${item.ownedQuantity} · 实例${item.instanceId}`};})} />
    <div className="part-shop-description" data-part-description="">{product?.info ?? ''}</div>
    <div className="part-shop-query-prices" data-part-query-prices="">{product
      ? [moneyPrice !== undefined ? `${moneyPrice}金币` : '', tokenPrice !== undefined ? `${tokenPrice}软星币` : '']
        .filter(Boolean).join(' / ') : ''}</div>
    <label className="part-shop-currency">币种 <select aria-label="部件购买币种" data-part-currency=""
      value={effectiveCurrency ?? ''} disabled={busy || !product || (moneyPrice === undefined && tokenPrice === undefined)}
      onChange={event => {
        const value = event.currentTarget.value;
        if (value === 'MONEY' && moneyPrice !== undefined || value === 'TOKENS' && tokenPrice !== undefined) {
          setCurrency(value);
        }
      }}>
      {moneyPrice !== undefined && <option value="MONEY">金币</option>}
      {tokenPrice !== undefined && <option value="TOKENS">软星币</option>}
    </select></label>
    <button type="button" className="part-shop-buy" data-part-buy=""
      disabled={busy || !product || effectiveCurrency === undefined || unitPrice === undefined}
      onClick={event => {void purchase(event.currentTarget);}}>购买一件</button>
    <button type="button" className="part-shop-equipment" data-part-equipment="" disabled={busy || !onEquipmentPage}
      onClick={onEquipmentPage}>{category === 'Hat' ? '装备拥有装饰' : '装备拥有部件'}</button>
    <button type="button" className="part-shop-refresh" data-part-refresh="" disabled={busy}
      onClick={() => owner.session?.refresh()}>刷新</button>
    {saleConfirm && <SourceConfirmView label="出售零件" binding="owned-part-sale"
      message="你确定出售该零件吗？" pending={busy}
      disabled={!sale?.quotes.some(quote => quote.instanceId === owner.salePending?.instanceId && quote.canSell)}
      status={status} confirm={() => {void sell();}} cancel={() => setSaleConfirm(false)} />}
    <output className="part-shop-status" data-part-status="" role="status" aria-live="polite">{status}</output>
  </>;
}
