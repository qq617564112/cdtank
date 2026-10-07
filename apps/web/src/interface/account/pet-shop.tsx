import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../../shared/protocols/PtlOwnedRoleSale';
import {createRequestId} from '../../network/request-id';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {SourceImageScale} from '../resources/source-static-image';
import './pet-shop.css';
import {RoleShopSourceList} from './role-shop-source-list';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ReqPetShop, ResPetShop} from '../../../../shared/protocols/PtlPetShop';
import type {ShopSource} from './shop';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {PetShopSourceRegions} from './pet-shop-source-regions';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {SourceButton} from '../resources/source-button';
import {sourceProps} from '../resources/source-ui-props';
import {PetModelPreview} from '../resources/pet-model-preview';
import {PetShopDirectoryDetails} from './pet-shop-directory-details';
import {sourcePetDescription} from '../resources/role-source-descriptions';

export interface PetPurchaseOwner {
  salePending?: ReqOwnedRoleSale;
  saleInFlight?: Promise<ResOwnedRoleSale>;
  pending?: ReqPetShop;
  inFlight?: Promise<ResPetShop>;
  selected?: number;
  purchasedInstance?: number;
  session?: {identity: object; refresh: () => void};
}

export function PetShopView({ui, source, owner, onBusy, scale, onMoney}: {
  ui: HomeSourceUi; source: ShopSource; owner: PetPurchaseOwner; onBusy: (busy: boolean) => void; scale: number; onMoney?: (money: number) => void;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_petpage.xml');
  const [confirmed, setConfirmed] = useState<ResPetShop>();
  const [selected, setSelected] = useState(owner.pending?.petId ?? owner.selected);
  const [busy, setBusy] = useState(true);
  const [mode, setMode] = useState<'buy' | 'owned'>('buy');
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [sale, setSale] = useState<ResOwnedRoleSale>();
  const [saleConfirm, setSaleConfirm] = useState(false);
  const generation = useRef(0);
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [ownedSelection, setOwnedSelection] = useState<number>();
  const [status, setStatus] = useState('正在载入宠物目录…');
  const session = useRef({active: false, query: false, identity: {}});
  const focusAfterCommit = useRef<HTMLElement | null>(null);
  const ownedRecord = owned?.base.find(record => new Map(record.fields).get(0) === ownedSelection);
  const ownedFields = ownedRecord ? new Map(ownedRecord.fields) : undefined;
  const displayedPetId = mode === 'buy' ? selected : ownedFields?.get(8);
  const product = confirmed?.pets.find(pet => pet.petId === displayedPetId);
  const saleQuote = sale?.quotes.find(quote => quote.kind === 'pet' && quote.instanceId === ownedSelection);
  const displayedName = mode === 'owned' ? ownedRecord?.name ?? '' : product?.name ?? '';
  const displayedHp = mode === 'owned' ? ownedFields?.get(0x2c) : product?.maxHp;
  const displayedDescription = mode === 'owned' ? sourcePetDescription(displayedPetId) : product?.info;
  const descriptionText = mode === 'owned' ? displayedDescription : product ? `${product.name} — ${product.info}` : undefined;
  const previewPetId = mode === 'owned' ? displayedPetId : product?.petId;
  const currentTankInstance = mode === 'owned' && sale?.profile
    ? new DataView(Uint8Array.from(sale.profile.bytes).buffer).getUint32(0xa8, true) : undefined;
  const currentTank = currentTankInstance === undefined ? undefined
    : owned?.equipment.find(record => new Map(record.fields).get(0x1c) === currentTankInstance);
  useEffect(() => {onBusy(busy);}, [busy, onBusy]);
  useEffect(() => {
    const current = {active: true, query: false, identity: {}}; session.current = current;
    let queued = false;
    async function refresh() {
      if (!current.active) return;
      if (current.query) {queued = true; return;}
      current.query = true; setBusy(true);
      try {
        const result = await source.petShop!({operation: 'QUERY'});
        if (!current.active) return;
        setConfirmed(result);
        setSelected(value => {
          const id = result.pets.some(pet => pet.petId === value) ? value : result.pets[0]?.petId;
          owner.selected = id; return id;
        });
        setStatus(owner.inFlight ? '等待购买确认…' : owner.pending ? '购买尚未确认，可重试原请求。'
          : owner.purchasedInstance ? `已拥有宠物实例${owner.purchasedInstance}，请在我的家选择。` : '购买后请在我的家选择宠物。');
      } catch (error) {
        if (current.active) setStatus(error instanceof Error ? error.message : '宠物目录载入失败');
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
  }, [source, owner]);
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
    setMode('owned'); setBusy(true); setStatus('正在载入拥有宠物…');
    try {
      const [result, response] = await Promise.all([source.ownedRoleSale ? source.ownedRoleSale({operation: 'QUERY'}) : undefined, fetch('/combat-catalog.json')]);
      const records = result?.owned ?? await source.ownedRoles();
      if (!response.ok) throw new Error('宠物类别资料载入失败');
      const metadata = await response.json() as CombatCatalog;
      if (!current.active) return;
      if (generation.current !== ticket) return;
      setOwned(records); setCatalog(metadata); setSale(result);
      if (result?.money !== undefined) {setConfirmed(value => value && {...value, money: result.money!}); onMoney?.(result.money);}
      setOwnedSelection(value => records.base.some(record => new Map(record.fields).get(0) === value)
        ? value : records.base[0] ? new Map(records.base[0].fields).get(0) : undefined);
      setStatus('');
    } catch (error) {
      if (current.active) setStatus(error instanceof Error ? error.message : '拥有宠物载入失败');
    } finally {
      if (current.active) setBusy(Boolean(owner.inFlight || owner.saleInFlight));
    }
  }
  function requestSale(button: HTMLButtonElement) {
    if (busy || owner.saleInFlight || !saleQuote?.canSell || saleQuote.selected || !source.ownedRoleSale) return;
    if (!owner.salePending || owner.salePending.instanceId !== saleQuote.instanceId) {
      owner.salePending = {operation: 'SELL', kind: 'pet', instanceId: saleQuote.instanceId,
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
      setOwnedSelection(value => result.owned.base.some(record => new Map(record.fields).get(0) === value)
        ? value : result.owned.base[0] ? new Map(result.owned.base[0].fields).get(0) : undefined);
      if (result.money !== undefined) {setConfirmed(value => value && {...value, money: result.money!}); onMoney?.(result.money);}
      setSaleConfirm(false); setStatus(`已出售宠物实例${result.sold?.instanceId}，收入${result.sold?.price}金币。`);
    } catch (error) {
      if (current.active && generation.current === ticket) setStatus(error instanceof Error ? error.message : '出售未确认，请重试原请求');
    } finally {
      owner.saleInFlight = undefined;
      if (current.active && generation.current === ticket) setBusy(current.query);
      else owner.session?.refresh();
    }
  }
  async function purchase(button: HTMLButtonElement) {
    const current = session.current;
    if (!current.active || current.query || owner.inFlight || mode !== 'buy' || !product) return;
    if (!owner.pending || owner.pending.petId !== product.petId) {
      owner.pending = {operation: 'BUY', petId: product.petId, currency: 'MONEY', requestId: createRequestId()};
    }
    focusAfterCommit.current = button;
    setBusy(true); setStatus('等待购买确认…');
    const inFlight = source.petShop!(owner.pending); owner.inFlight = inFlight;
    try {
      const result = await inFlight;
      owner.pending = undefined;
      owner.purchasedInstance = result.purchased?.fields.find(([offset]) => offset === 0x0)?.[1];
      if (current.active) {
        setConfirmed(result);
        setStatus(`已购买${product.name}，拥有实例${owner.purchasedInstance}，请在我的家选择。`);
      }
    } catch (error) {
      if (current.active) setStatus(error instanceof Error ? error.message : '购买未确认，请重试');
    } finally {
      owner.inFlight = undefined;
      if (current.active) setBusy(current.query); else owner.session?.refresh();
    }
  }
  return <SourceImageScale value={1}>
    <PetShopSourceRegions ui={ui} />
    {displayedPetId !== undefined && <PetShopDirectoryDetails ui={ui} petId={displayedPetId}
      mode={mode === 'owned' ? 'owned' : 'directory'} ownedRecord={mode === 'owned' ? ownedRecord : undefined}
      profile={mode === 'owned' ? sale?.profile : undefined} currentTank={mode === 'owned' ? currentTank : undefined} />}
    <SourceStaticText ui={ui} layout={layout} suffix="shop_petpage.xml" name="txtMoney" text={confirmed?.money === undefined ? '' : String(confirmed.money)}/>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_petpage.xml" name="txtCoin" text={confirmed?.tokens === undefined ? '' : String(confirmed.tokens)}/>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_petpage.xml" name="txtName" text={displayedName}/>
    <span {...sourceProps(ui, layout, 'shop_petpage.xml', 'txtHP')} className="pet-shop-hp"
      data-pet-shop-hp="" data-presentation-colour="web-readable">{displayedHp === undefined ? '' : String(displayedHp)}</span>
    <SourceStaticText ui={ui} layout={layout} suffix="shop_petpage.xml" name="txtListQuantity" text={mode === 'buy' ? confirmed ? String(confirmed.pets.length) : '' : owned ? String(owned.base.length) : ''}/>
    <SourceButton ui={ui} layout={layout} suffix="shop_petpage.xml" source="rdoBuy" selected={mode === 'buy'}
      data-pet-shop-buy-tab="" aria-label="购买宠物商品" aria-pressed={mode === 'buy'} disabled={busy} onClick={() => {generation.current++; setSaleConfirm(false); setMode('buy'); setStatus('');}} />
    <SourceButton ui={ui} layout={layout} suffix="shop_petpage.xml" source="rdoSell" selected={mode === 'owned'}
      data-pet-shop-owned-tab="" aria-label="拥有宠物" aria-pressed={mode === 'owned'} disabled={busy || !source.ownedRoles}
      onClick={() => {void openOwned();}} />
    <RoleShopSourceList ui={ui} kind="pet" entries={mode === 'owned' ? owned?.base.map(record => {
      const fields = new Map(record.fields), petId = fields.get(8);
      const kind = catalog?.petTypes?.find(value => value.petId === petId);
      return {id: fields.get(0)!, name: record.name, petId, petType: kind?.petType, petSize: kind?.petSize, petMoney: kind?.petMoney, owned: true};
    }) ?? [] : confirmed?.pets.map(entry => ({id: entry.petId, name: entry.name, moneyPrice: entry.moneyPrice, tokenPrice: entry.tokenPrice, petType: entry.petType, petSize: entry.petSize})) ?? []}
      selected={mode === 'owned' ? ownedSelection : selected} busy={busy} select={id => {
        if (mode === 'owned') setOwnedSelection(id); else {owner.selected = id; setSelected(id);}
      }}/>
    {previewPetId !== undefined && <PetModelPreview petId={previewPetId} kind="shop" scale={scale}
      {...sourceProps(ui, layout, 'shop_petpage.xml', 'picModel')} data-shop-pet-preview="" />}
    <div {...sourceProps(ui, layout, 'shop_petpage.xml', 'edtPetDesc')}
      className="pet-shop-product" data-pet-shop-product="" data-presentation-colour="web-readable"
      data-description-source={descriptionText ? mode === 'owned' ? 'original-pet-table' : 'confirmed-pet-shop-product' : 'unavailable'}
      role={descriptionText ? 'region' : undefined}
      aria-label={descriptionText ? mode === 'owned' ? '拥有宠物介绍' : '宠物商品介绍' : undefined}
      tabIndex={descriptionText ? 0 : -1}>{descriptionText ?? ''}</div>
    <p className="pet-shop-price" data-pet-shop-price="">{mode === 'buy' && product ? `售价：${product.moneyPrice}金币` : ''}</p>
    <p className="pet-shop-balance" data-pet-shop-balance="">{confirmed?.money === undefined ? '账户尚无余额资料'
      : `金币：${confirmed.money} · 软星币：${confirmed.tokens}`}</p>
    {mode === 'buy' && <SourceButton ui={ui} layout={layout} suffix="shop_petpage.xml" source="btnBuy" data-pet-shop-buy=""
      aria-label="购买选中宠物" disabled={busy || !product} onClick={event => {void purchase(event.currentTarget);}}/>}
    {mode === 'owned' && <SourceButton ui={ui} layout={layout} suffix="shop_petpage.xml" source="btnSell" data-pet-shop-sell=""
      aria-label="出售选中宠物" disabled={busy || !source.ownedRoleSale || !saleQuote?.canSell || saleQuote.selected}
      onClick={event => requestSale(event.currentTarget)} />}
    {saleConfirm && <SourceConfirmView label="出售宠物" binding="owned-pet-sale"
      message="你确定出售这只猫狗吗？" pending={busy} disabled={!saleQuote?.canSell || saleQuote.selected}
      status={status} confirm={() => {void sell();}} cancel={() => {setSaleConfirm(false);}} />}
    <button type="button" className="pet-shop-refresh" data-pet-shop-refresh="" disabled={busy}
      onClick={event => {focusAfterCommit.current = event.currentTarget; mode === 'owned' ? void openOwned() : owner.session?.refresh();}}>刷新余额</button>
    <output className="pet-shop-status" data-pet-shop-status="" data-purchased-pet-instance={owner.purchasedInstance}
      role="status" aria-live="polite">{status}</output>
  </SourceImageScale>;
}
