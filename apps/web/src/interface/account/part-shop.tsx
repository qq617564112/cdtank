import {gameContent} from '../../../../shared/content/catalog';
import {loadCombatCatalog} from '../../content';
import type {ReqPartSale, ResPartSale} from '../../../../shared/protocols/PtlPartSale';
import {createRequestId} from '../../network/request-id';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {SourceNotice} from '../dialogs/source-notice';
import {SourceNoticeView} from '../dialogs/source-notice-view';
import {createPortal} from 'react-dom';
import {ShopPurchaseSource} from './shop-purchase-source';
import {ShopItemDescriptionSource} from './shop-item-description-source';
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
const hasCategoryCatalog = (items: readonly {itemTableId: number}[], category: PartShopCategory) =>
  [...gameContent().items.values()].filter(item => item.shop.available && item.shop.group === 'part'
    && inCategory(item.id, category)).every(item => items.some(row => row.itemTableId === item.id));
const hasMarkCatalog = (items: readonly {itemTableId: number}[]) => hasCategoryCatalog(items, 'Mark');
const hasHatCatalog = (items: readonly {itemTableId: number}[]) => hasCategoryCatalog(items, 'Hat');
const categoryForItem = (id: number): PartShopCategory => {
  const type = classifyItemId(id);
  return type >= 8 && type <= 12 ? 'Common' : type === 5 ? 'Hat' : type === 7 ? 'Mark' : 'Common';
};
const positivePrice = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value > 0;
/** Current-role install equality from the read-only profile projection. */
function profileInstalled(profile: {bytes: number[]} | undefined, category: PartShopCategory, instanceId: number): boolean {
  if (!profile) return false;
  const bytes = Uint8Array.from(profile.bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read = (offset: number) => bytes.byteLength >= offset + 4 ? view.getUint32(offset, true) : undefined;
  const id = instanceId >>> 0;
  if (category === 'Hat') return read(0x118) === id;
  if (category === 'Mark') return read(0x13c) === id;
  for (let slot = 0; slot < 5; slot++) if (read(0x148 + slot * 4) === id) return true;
  return false;
}

/** Part purchases reuse the existing Shop transaction and refresh real inventory. */
export function PartShopView({ui, source, owner, onBusy, onMoney}: {
  ui: HomeSourceUi; source: ShopSource; owner: PartPurchaseOwner; onBusy: (busy: boolean) => void;
  onEquipmentPage?: () => void; onMoney?: (money: number) => void;
}) {
  const session = useRef({active: false, query: false, identity: {}});
  const [confirmed, setConfirmed] = useState<ResShop>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [sale, setSale] = useState<ResPartSale>();
  const [saleConfirm, setSaleConfirm] = useState(false);
  const [buyConfirm, setBuyConfirm] = useState(false);
  const [description, setDescription] = useState<{id: number; left: number; top: number}>();
  const [notice] = useState(() => new SourceNotice());
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
  const describedProduct = products.find(item => item.itemTableId === description?.id);
  const hatAvailable = confirmed ? hasHatCatalog(confirmed.items) : false;
  const markAvailable = confirmed ? hasMarkCatalog(confirmed.items) : false;
  const moneyPrice = product && positivePrice(product.moneyPrice) ? product.moneyPrice : undefined;
  const tokenPrice = product && positivePrice(product.tokenPrice) ? product.tokenPrice : undefined;
  const effectiveCurrency = currency === 'MONEY' && moneyPrice !== undefined ? 'MONEY'
    : currency === 'TOKENS' && tokenPrice !== undefined ? 'TOKENS'
      : moneyPrice !== undefined ? 'MONEY' : tokenPrice !== undefined ? 'TOKENS' : undefined;
  const unitPrice = effectiveCurrency === 'MONEY' ? moneyPrice : effectiveCurrency === 'TOKENS' ? tokenPrice : undefined;
  const owned = inventory?.records.filter(item => inCategory(item.itemTableId, ownedCategory)) ?? [];
  useEffect(() => () => notice.clear(), [notice]);
  useEffect(() => {onBusy(busy);}, [busy, onBusy]);
  useEffect(() => {
    if (effectiveCurrency && effectiveCurrency !== currency) setCurrency(effectiveCurrency);
  }, [effectiveCurrency, currency]);
  useEffect(() => {
    generation.current++;
    const current = {active: true, query: false, identity: {}}; session.current = current;
    let queued = false;
    async function refresh() {
      if (!current.active) return;
      if (current.query) {queued = true; return;}
      current.query = true; setBusy(true);
      try {
        const [shop, saleResult, definitions] = await Promise.all([source.shop({operation: 'QUERY'}),
          source.partSale?.({operation: 'QUERY'}), loadCombatCatalog()]);
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
      } catch (error) {if (current.active) void notice.show(error instanceof Error ? error.message : '部件资料载入失败');}
      finally {current.query = false; if (current.active) {setBusy(Boolean(owner.inFlight || owner.saleInFlight)); if (queued) {queued = false; void refresh();}}}
    }
    owner.session = {identity: current.identity, refresh: () => {void refresh();}}; void refresh();
    return () => {generation.current++; current.active = false; if (owner.session?.identity === current.identity) owner.session = undefined;};
  }, [source, owner, notice]);
  useLayoutEffect(() => {
    const target = focusAfterCommit.current;
    if (busy || !target) return; focusAfterCommit.current = null;
    if (target.isConnected && (document.activeElement === document.body || document.activeElement === target
      || document.activeElement?.id === 'account-shop')) target.focus();
  }, [busy]);
  function describeProduct(id: number, button: HTMLButtonElement) {
    const stage = button.closest('.shop-source-stage');
    if (!stage || buyConfirm || saleConfirm) return;
    const sheet = stage.getBoundingClientRect(), row = button.getBoundingClientRect();
    const scale = sheet.width / 625;
    setDescription({id, left: Math.max(0, Math.min(625 - 218, (row.left - sheet.left) / scale)),
      top: Math.max(0, Math.min(404 - 103, (row.bottom - sheet.top) / scale + 4))});
  }
  function requestPurchase(id: number, button: HTMLButtonElement) {
    const item = products.find(value => value.itemTableId === id);
    if (!session.current.active || busy || owner.inFlight || owner.saleInFlight || !item) return;
    owner.selected = id; setSelected(id);
    setCurrency(owner.pending?.itemTableId === id ? owner.pending.currency ?? 'MONEY'
      : positivePrice(item.tokenPrice) ? 'TOKENS' : 'MONEY');
    focusAfterCommit.current = button;
    setDescription(undefined); setStatus(''); setBuyConfirm(true);
  }
  async function purchase() {
    const current = session.current;
    if (!current.active || current.query || owner.inFlight || owner.saleInFlight || !product
        || effectiveCurrency === undefined || unitPrice === undefined) return;
    if (!owner.pending || owner.pending.itemTableId !== product.itemTableId || owner.pending.currency !== effectiveCurrency) {
      owner.pending = {operation: 'BUY', itemTableId: product.itemTableId, quantity: 1,
        currency: effectiveCurrency, requestId: createRequestId()};
    }
    setBusy(true); setStatus('等待购买确认…');
    const request = source.shop(owner.pending); owner.inFlight = request;
    try {
      const result = await request; owner.pending = undefined;
      if (current.active) {
        setConfirmed(result); setBuyConfirm(false); setStatus('');
        const saleResult = await source.partSale?.({operation: 'QUERY'});
        const items = saleResult?.inventory ?? await source.inventory?.();
        if (current.active) {setInventory(items); setSale(saleResult);
          if (saleResult?.money !== undefined) {setConfirmed(value => value && {...value, money: saleResult.money!}); onMoney?.(saleResult.money);} setOwnedSelected(result.purchased?.instanceId);
          void notice.show(`已购买${product.name}。`);}
      }
    } catch (error) {if (current.active) {
      const message = error instanceof Error ? error.message : '购买未确认，请重试';
      if (owner.pending) setStatus(message); else void notice.show(`购买已完成，库存载入失败：${message}`);
    }}
    finally {owner.inFlight = undefined; if (current.active) setBusy(current.query); else owner.session?.refresh();}
  }
  function requestSale(instanceId: number, button: HTMLButtonElement) {
    const quote = sale?.quotes.find(value => value.instanceId === instanceId);
    if (!session.current.active || busy || owner.inFlight || owner.saleInFlight || !quote?.canSell || !source.partSale) return;
    if (owner.salePending?.instanceId !== instanceId) {
      owner.salePending = {operation: 'SELL', instanceId, requestId: createRequestId()};
    }
    setOwnedSelected(instanceId); focusAfterCommit.current = button;
    setDescription(undefined); setStatus(''); setSaleConfirm(true);
  }
  function selectProductCategory(kind: PartShopCategory) {
    if (busy || kind === 'Hat' && !hatAvailable || kind === 'Mark' && !markAvailable) return;
    setDescription(undefined); setBuyConfirm(false);
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
        ?? document.querySelector<HTMLButtonElement>(`[data-part-owned-category="${ownedCategory}"]`);
      setSaleConfirm(false); setStatus('');
      void notice.show(`已出售零件，收入${result.sold.price}金币。`);
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
      activate={requestPurchase} canActivate={id => products.some(item => item.itemTableId === id
        && (positivePrice(item.moneyPrice) || positivePrice(item.tokenPrice)))}
      describe={describeProduct} dismissDescription={() => setDescription(undefined)} described={description?.id}
      entries={products.map(item => ({id: item.itemTableId, itemTableId: item.itemTableId, product: item, name: item.name, iconId: item.iconId,
        detail: [positivePrice(item.moneyPrice) ? `${item.moneyPrice}金币` : '',
          positivePrice(item.tokenPrice) ? `${item.tokenPrice}软星币` : ''].filter(Boolean).join(' / ')}))} />
    <PartShopSourceList ui={ui} source="lstMyEquip" selected={ownedSelected} busy={busy} select={setOwnedSelected}
      activate={requestSale} canActivate={id => Boolean(source.partSale && sale?.quotes.some(quote => quote.instanceId === id && quote.canSell))}
      entries={owned.map(item => {const definition = catalog?.items.find(value => value.itemTableId === item.itemTableId);
        return {id: item.instanceId, itemTableId: item.itemTableId, installed: profileInstalled(sale?.profile, ownedCategory, item.instanceId),
          ownedQuantity: item.ownedQuantity, moneyPrice: definition?.moneyPrice, name: definition?.name ?? String(item.itemTableId),
          iconId: definition?.iconId ?? 0, detail: `×${item.ownedQuantity} · 实例${item.instanceId}`};})} />
    {describedProduct && description && <ShopItemDescriptionSource ui={ui} itemTableId={describedProduct.itemTableId}
      name={describedProduct.name} description={describedProduct.info} left={description.left} top={description.top}/>}
    {buyConfirm && product && <ShopPurchaseSource ui={ui} name={product.name}
      moneyPrice={moneyPrice ?? 0} tokenPrice={tokenPrice ?? 0} moneyAvailable={moneyPrice !== undefined}
      currency={effectiveCurrency ?? currency} changeCurrency={value => {setCurrency(value); setStatus('');}}
      pending={busy} status={status} confirm={() => {void purchase();}}
      cancel={() => {setBuyConfirm(false); setStatus('');}}/>}
    {saleConfirm && <SourceConfirmView label="出售零件" binding="owned-part-sale"
      message="你确定出售该零件吗？" pending={busy}
      disabled={!sale?.quotes.some(quote => quote.instanceId === owner.salePending?.instanceId && quote.canSell)}
      status={status} confirm={() => {void sell();}} cancel={() => setSaleConfirm(false)} />}
    <output hidden data-part-status="">{status}</output>
    {createPortal(<SourceNoticeView notice={notice}/>, document.body)}
  </>;
}
