import {loadCombatCatalog} from '../../content';
import {StackItemSaleSource, type StackSaleOwner} from './stack-item-sale-source';
import {createRequestId} from '../../network/request-id';
import type {ReqStackItemSale, ResStackItemSale} from '../../../../shared/protocols/PtlStackItemSale';
import type {ReqPartSale, ResPartSale} from '../../../../shared/protocols/PtlPartSale';
import type {ReqPartMaintenance, ResPartMaintenance} from '../../../../shared/protocols/PtlPartMaintenance';
import {PartShopView, type PartPurchaseOwner} from './part-shop';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {ReqTankTextures, ResTankTextures} from '../../../../shared/protocols/PtlTankTextures';
import type {ReqTankMaintenance, ResTankMaintenance} from '../../../../shared/protocols/PtlTankMaintenance';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../../shared/protocols/PtlOwnedRoleSale';
import './shop.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ReqShop, ResShop, ShopCurrency, ShopItem} from '../../../../shared/protocols/PtlShop';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {SourceImageScale} from '../resources/source-static-image';
import {loadUiFont} from '../resources/source-ui-fonts';
import {loadSourceUi} from '../resources/source-ui-resources';
import {ShopSourcePage} from './shop-source-page';
import {TankShopView, type TankPurchaseOwner} from './tank-shop';
import {PetShopView, type PetPurchaseOwner} from './pet-shop';
import type {ReqPetShop, ResPetShop} from '../../../../shared/protocols/PtlPetShop';
import type {ReqTankShop, ResTankShop} from '../../../../shared/protocols/PtlTankShop';
import {sourceShopItemCategory} from './shop-item-category';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ReqEquipment, ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import {ShopItemSourceList} from './shop-item-source-list';
import {ShopItemDescriptionSource} from './shop-item-description-source';
import {MendShopSourcePage} from './mend-shop-source-page';
import {ShopResourceFeedback} from './shop-resource-feedback';
import {createPortal} from 'react-dom';
import {SourceNotice} from '../dialogs/source-notice';
import {SourceNoticeView} from '../dialogs/source-notice-view';
import {ShopPurchaseSource} from './shop-purchase-source';

export interface ShopSource {stackItemSale?(request: ReqStackItemSale): Promise<ResStackItemSale>; partSale?(request: ReqPartSale): Promise<ResPartSale>; partMaintenance?(request: ReqPartMaintenance): Promise<ResPartMaintenance>; ownedRoleSale?(request: ReqOwnedRoleSale): Promise<ResOwnedRoleSale>; tankMaintenance?(request: ReqTankMaintenance): Promise<ResTankMaintenance>; ownedRoles?(): Promise<ResOwnedRoles>; roleProfile?(): Promise<ResRoleProfile>; configureTankTextures?(request: ReqTankTextures): Promise<ResTankTextures>; equipment?(request: ReqEquipment): Promise<ResEquipment>; shop(request: ReqShop): Promise<ResShop>; inventory?(): Promise<ResInventory>; tankShop?(request: ReqTankShop): Promise<ResTankShop>; petShop?(request: ReqPetShop): Promise<ResPetShop>;}
export interface AccountShopViewProps {open: boolean; close: () => void; source: ShopSource; initialTextureInstance?: number; onEquipmentPage?: () => void;}
interface PurchaseOwner {
  page?: 'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend';
  stackSale?: StackSaleOwner;
  part?: PartPurchaseOwner;
  tank?: TankPurchaseOwner;
  pet?: PetPurchaseOwner;
  pending?: ReqShop;
  inFlight?: Promise<ResShop>;
  session?: {identity: object; refresh: () => void};
}

/** The request owner survives dialog sessions so an unconfirmed purchase keeps its id. */
export function AccountShopView({open, close, source, initialTextureInstance, onEquipmentPage}: AccountShopViewProps) {
  const owner = useRef<PurchaseOwner>({tank: {}, pet: {}, part: {}, stackSale: {}});
  return open ? <ShopSession onEquipmentPage={onEquipmentPage} initialTextureInstance={initialTextureInstance} close={close} source={source} owner={owner.current} /> : null;
}

function ShopSession({close, source, owner, initialTextureInstance, onEquipmentPage}: Omit<AccountShopViewProps, 'open'> & {owner: PurchaseOwner}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const escapePending = useRef(false);
  const session = useRef({active: false, query: false, identity: {}});
  const focusAfterCommit = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState<'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend'>(initialTextureInstance !== undefined ? 'Tank' : owner.page ?? 'Item');
  const [tankBusy, setTankBusy] = useState(false);
  const [petBusy, setPetBusy] = useState(false);
  const [partBusy, setPartBusy] = useState(false);
  const [mendBusy, setMendBusy] = useState(false);
  const [ui, setUi] = useState<HomeSourceUi>();
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const [confirmed, setConfirmed] = useState<ResShop>();
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [ownedCategory, setOwnedCategory] = useState<'Weapon' | 'Item'>('Item');
  const saleActivationSequence = useRef(0);
  const [saleRefresh, setSaleRefresh] = useState(0);
  const [saleActivation, setSaleActivation] = useState<{instanceId: number; sequence: number}>();
  const [ownedSelected, setOwnedSelected] = useState<number>();
  const [ownedBusy, setOwnedBusy] = useState(false);
  const [category, setCategory] = useState<'Weapon' | 'Item'>(() =>
    sourceShopItemCategory(owner.pending?.itemTableId ?? 0) ?? 'Item');
  const [selected, setSelected] = useState<number | undefined>(owner.pending?.itemTableId);
  const [quantity, setQuantity] = useState(String(owner.pending?.quantity ?? 1));
  const [currency, setCurrency] = useState<ShopCurrency>(owner.pending?.currency ?? 'MONEY');
  const [purchaseItem, setPurchaseItem] = useState<ShopItem>();
  const [description, setDescription] = useState<{id: number; left: number; top: number}>();
  const [notice] = useState(() => new SourceNotice());
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const [resourceError, setResourceError] = useState<string>();
  const [purchasedInstance, setPurchasedInstance] = useState<number>();
  const products = confirmed?.items.filter(value => sourceShopItemCategory(value.itemTableId) === category) ?? [];
  const describedItem = products.find(value => value.itemTableId === description?.id);
  const activePageBusy = page === 'Tank' ? tankBusy : page === 'Pet' ? petBusy : page === 'Part' ? partBusy : page === 'Mend' ? mendBusy : busy;

  function selectItemCategory(kind: 'Weapon' | 'Item') {
    if (busy || ownedBusy) return;
    setDescription(undefined);
    if (ownedCategory !== kind) {setOwnedCategory(kind); setOwnedSelected(undefined);}
    if (category !== kind) {
      setCategory(kind);
      setSelected(confirmed?.items.find(product => sourceShopItemCategory(product.itemTableId) === kind)?.itemTableId);
    }
  }

  useEffect(() => () => notice.clear(), [notice]);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const current = {active: true, query: false, identity: {}}; session.current = current;
    let refreshQueued = false;
    setResourceError(undefined);
    void loadUiFont().catch(() => {});
    void Promise.all([
      loadSourceUi(), loadCombatCatalog(),
    ]).then(([resources, itemCatalog]) => {
      if (!current.active) return;
      setUi(resources); setCatalog(itemCatalog);
    }).catch(error => {if (current.active) setResourceError(String(error));});
    async function load() {
      if (!current.active) return;
      if (current.query) {refreshQueued = true; return;}
      current.query = true; setBusy(true);
      try {
        const result = await source.shop({operation: 'QUERY'});
        if (!current.active) return;
        setConfirmed(result);
        setSelected(value => {
          const currentCategory = sourceShopItemCategory(value ?? 0) ?? 'Item';
          const available = result.items.filter(product => sourceShopItemCategory(product.itemTableId) === currentCategory);
          return available.some(product => product.itemTableId === value) ? value : available[0]?.itemTableId;
        });
      } catch (error) {
        if (current.active) void notice.show(error instanceof Error ? error.message : '商店载入失败');
      } finally {
        current.query = false;
        if (current.active) {
          setBusy(Boolean(owner.inFlight));
          if (refreshQueued) {refreshQueued = false; void load();}
        }
      }
    }
    owner.session = {identity: current.identity, refresh: () => {void load();}};
    void load();
    return () => {
      current.active = false;
      if (owner.session?.identity === current.identity) owner.session = undefined;
    };
  }, [source, owner, notice]);

  useLayoutEffect(() => {
    if (!ui || activePageBusy) return;
    if (document.activeElement === document.body || document.activeElement === dialog.current) {
      dialog.current?.querySelector<HTMLButtonElement>('[data-shop-close]')?.focus();
    }
  }, [ui, activePageBusy, page]);

  useEffect(() => {
    if (page !== 'Item' || !confirmed || !source.inventory || source.stackItemSale) return;
    let active = true;
    setOwnedBusy(true);
    void source.inventory().then(result => {
      if (active && session.current.active) {setInventory(result); setOwnedBusy(false);}
    }).catch(error => {
      if (active && session.current.active) {
        setOwnedBusy(false); void notice.show(error instanceof Error ? error.message : '拥有物品载入失败');
      }
    });
    return () => {active = false;};
  }, [source, confirmed, page, notice]);

  useLayoutEffect(() => {
    if (busy || !focusAfterCommit.current) return;
    const target = focusAfterCommit.current; focusAfterCommit.current = null;
    if (target.isConnected && (document.activeElement === document.body
        || document.activeElement === dialog.current || document.activeElement === target)) target.focus();
  }, [busy]);

  function requestClose() {session.current.active = false; close();}

  function describeItem(id: number, anchor: HTMLButtonElement) {
    if (!stage.current || purchaseItem) return;
    const sheet = stage.current.getBoundingClientRect(), row = anchor.getBoundingClientRect();
    const sourceScale = sheet.width / 625;
    setDescription({id, left: Math.max(0, Math.min(625 - 218, (row.left - sheet.left) / sourceScale)),
      top: Math.max(0, Math.min(404 - 103, (row.bottom - sheet.top) / sourceScale + 4))});
  }

  function requestPurchase(id: number, button: HTMLButtonElement) {
    const product = products.find(value => value.itemTableId === id);
    if (!session.current.active || busy || ownedBusy || owner.inFlight || owner.stackSale?.inFlight || !product) return;
    focusAfterCommit.current = button;
    setSelected(id); setDescription(undefined); setStatus('');
    setQuantity(String(owner.pending?.itemTableId === id ? owner.pending.quantity ?? 1 : 1));
    setCurrency(owner.pending?.itemTableId === id ? owner.pending.currency ?? 'MONEY'
      : (product.tokenPrice > 0 && (product.getMethod === 2 || product.moneyPrice <= 0)) ? 'TOKENS' : 'MONEY');
    setPurchaseItem(product);
  }

  async function purchase() {
    const current = session.current;
    if (!current.active || current.query || owner.inFlight || ownedBusy || owner.stackSale?.inFlight || !purchaseItem) return;
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 10) {setStatus('请选择1至10份'); return;}
    if (!owner.pending || owner.pending.itemTableId !== purchaseItem.itemTableId
        || owner.pending.quantity !== count || owner.pending.currency !== currency) {
      owner.pending = {operation: 'BUY', itemTableId: purchaseItem.itemTableId, quantity: count, currency,
        requestId: createRequestId()};
    }
    const request = owner.pending;
    setBusy(true); setStatus('等待购买确认…');
    const inFlight = source.shop(request); owner.inFlight = inFlight;
    try {
      const result = await inFlight;
      owner.pending = undefined;
      if (current.active) {
        setConfirmed(result); setPurchasedInstance(result.purchased?.instanceId); setSaleRefresh(value => value + 1);
        setPurchaseItem(undefined); setStatus('');
        void notice.show(`已购买${purchaseItem.name}×${count}。`);
      }
    } catch (error) {
      if (current.active) setStatus(error instanceof Error ? error.message : '购买未确认，请重试');
    } finally {
      owner.inFlight = undefined;
      if (current.active) setBusy(current.query);
      else owner.session?.refresh();
    }
  }

  return <dialog ref={dialog} id="account-shop" aria-labelledby="account-shop-title" aria-busy={activePageBusy} style={{zoom: scale}}
    data-purchased-instance={purchasedInstance === undefined ? undefined : String(purchasedInstance)}
    onCancel={event => {event.preventDefault(); requestClose();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {event.preventDefault(); escapePending.current = true;}
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        requestClose();
      }
    }}>
    <SourceImageScale value={scale}>
    <div ref={stage} className="shop-source-stage" data-shop-page="" data-shop-active-page={page}>
    {ui && <ShopSourcePage ui={ui} money={confirmed?.money} tokens={confirmed?.tokens} close={requestClose}
      page={page} tankAvailable={!!source.tankShop} petAvailable={!!source.petShop} mendAvailable={!!source.ownedRoles && !!source.inventory && !!source.roleProfile} partAvailable selectPage={value => {
        owner.page = value; setPage(value); setSaleActivation(undefined); setDescription(undefined);
        if (value === 'Item') owner.session?.refresh();
      }}
      category={category} ownedCategory={ownedCategory} ownedBusy={ownedBusy || busy}
      ownedQuantity={inventory?.records.filter(record => classifyInventoryCategory(record.itemTableId) === (ownedCategory === 'Weapon' ? 2 : 1)).length}
      selectOwnedCategory={selectItemCategory}
      busy={page === 'Tank' ? tankBusy : page === 'Pet' ? petBusy : page === 'Part' ? partBusy : page === 'Mend' ? mendBusy : busy || ownedBusy} selectCategory={selectItemCategory}/>} 
    <h2 id="account-shop-title">{page === 'Tank' ? '战车商店' : page === 'Pet' ? '宠物商店' : page === 'Mend' ? '维修中心' : '道具商店'}</h2>
    {page === 'Tank' && ui && source.tankShop && <TankShopView initialTextureInstance={initialTextureInstance} ui={ui} source={source} owner={owner.tank!} onBusy={setTankBusy} scale={scale}
      onMoney={money => setConfirmed(value => value && {...value, money})}/>}
    {page === 'Pet' && ui && source.petShop && <PetShopView ui={ui} source={source} owner={owner.pet!} onBusy={setPetBusy} scale={scale}
      onMoney={money => setConfirmed(value => value && {...value, money})}/>}
    {page === 'Part' && ui && <PartShopView ui={ui} source={source} owner={owner.part!} onBusy={setPartBusy} onEquipmentPage={onEquipmentPage}
      onMoney={money => setConfirmed(value => value && {...value, money})}/> }
    {page === 'Mend' && ui && <MendShopSourcePage ui={ui} catalog={catalog} source={source} onBusy={setMendBusy} />}
    {page === 'Item' && ui && <>
    <p className="shop-balance-summary" data-shop-balance="">{confirmed?.money === undefined ? '账户尚无余额资料'
      : `金币：${confirmed.money} · 软星币：${confirmed.tokens}`}</p>
    {ui && <>
      <ShopItemSourceList ui={ui} source="lstShopItem" selected={selected} busy={busy || ownedBusy} select={setSelected}
        activate={requestPurchase} canActivate={() => !busy && !ownedBusy}
        describe={describeItem} dismissDescription={() => setDescription(undefined)} described={description?.id}
        entries={products.map(product => ({id: product.itemTableId, name: product.name, iconId: product.iconId,
          detail: '', product}))} />
      <ShopItemSourceList ui={ui} source="lstMyItem" selected={ownedSelected} busy={busy || ownedBusy} select={id => {setOwnedSelected(id); setSaleActivation(undefined);}}
        activate={id => setSaleActivation({instanceId: id, sequence: ++saleActivationSequence.current})}
        canActivate={id => Boolean(source.stackItemSale && inventory?.records.some(record => record.instanceId === id && record.ownedQuantity > 0))}
        entries={(inventory?.records ?? []).filter(record => classifyInventoryCategory(record.itemTableId) === (ownedCategory === 'Weapon' ? 2 : 1)
          && record.ownedQuantity > 0).map(record => {
          const definition = catalog?.items.find(value => value.itemTableId === record.itemTableId);
          return {id: record.instanceId, name: definition?.name ?? String(record.itemTableId),
            iconId: definition?.iconId ?? record.itemTableId, detail: `×${record.ownedQuantity}`,
            itemTableId: record.itemTableId, ownedQuantity: record.ownedQuantity, ownedMoneyPrice: definition?.moneyPrice};
        })} />
    </>}
    {source.stackItemSale && <StackItemSaleSource ui={ui} source={source} instanceId={ownedSelected}
      activation={saleActivation} refreshKey={saleRefresh} owner={owner.stackSale!} disabled={busy} onBusy={setOwnedBusy}
      onError={message => {void notice.show(message);}}
      onConfirmed={result => {
        setInventory(result.inventory);
        if (result.money !== undefined) setConfirmed(value => value && value.money !== result.money ? {...value, money: result.money} : value);
      }} />}
    {describedItem && description && <ShopItemDescriptionSource ui={ui} itemTableId={describedItem.itemTableId}
      name={describedItem.name} description={describedItem.info} left={description.left} top={description.top}/>}
    {purchaseItem && <ShopPurchaseSource ui={ui} name={purchaseItem.name}
      moneyPrice={purchaseItem.moneyPrice} tokenPrice={purchaseItem.tokenPrice} moneyAvailable={purchaseItem.moneyPrice > 0}
      quantity={quantity} changeQuantity={value => {setQuantity(value); setStatus('');}}
      currency={currency} changeCurrency={value => {setCurrency(value); setStatus('');}}
      pending={busy || ownedBusy} status={status} confirm={() => {void purchase();}}
      cancel={() => {setPurchaseItem(undefined); setStatus('');}}/>}
    <output hidden data-shop-status="">{status}</output>
    </>}
    {!ui && <ShopResourceFeedback error={resourceError} pending={activePageBusy} close={requestClose}/>}
    </div>
    </SourceImageScale>
    {createPortal(<SourceNoticeView notice={notice}/>, document.body)}
  </dialog>;
}
