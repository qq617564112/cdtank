import {isTreasureItem} from '../../../../shared/combat/treasure-items';
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import type {ReqValuableItemSale, ResValuableItemSale} from '../../../../shared/protocols/PtlValuableItemSale';
import type {Battle} from '../../match/battle';
import type {AccountContext} from '../../network/accounts';
import {createRequestId} from '../../network/request-id';
import {InventorySaleQuantityDialog} from '../account/stack-item-sale-source';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import type {HomeSourceUi} from '../resources/source-ui-layout';

export interface ValuableItemSaleOwner {
  account?: AccountContext;
  pending?: ReqValuableItemSale;
  inFlight?: Promise<ResValuableItemSale>;
}

function explicitNotSold(error: unknown): boolean {
  const candidate = error as {code?: string | number; message?: string};
  if (candidate.code !== 'VALUABLE_ITEM_SALE_REJECTED' || !candidate.message) return false;
  return /不属于当前贵重品账户|出售数量超过拥有量|原出售价格不可用|账户角色资料尚未建立|出售贵重品实例无效|出售数量须/.test(candidate.message);
}

/** Confirmed valuable-sale projection is installed by the Home page owner. */
export function ValuableItemSaleSource({ui, battle, refreshKey, activation, owner, onConfirmed, onBusy, onError, disabled = false}: {
  ui: HomeSourceUi;
  battle: Pick<Battle, 'accountContext' | 'subscribeAccountContext' | 'valuableItemSale' | 'matchPanel'
    | 'valuableSaleRoomContext' | 'subscribeValuableSaleRoom'>;
  refreshKey?: number; activation?: {instanceId: number; sequence: number};
  owner: ValuableItemSaleOwner; onConfirmed: (response: ResValuableItemSale) => void;
  onBusy: (busy: boolean) => void; onError(message: string): void; disabled?: boolean;
}) {
  const callbacks = useRef({onConfirmed, onBusy, onError}); callbacks.current = {onConfirmed, onBusy, onError};
  const account = useSyncExternalStore(
    listener => battle.subscribeAccountContext(listener), () => battle.accountContext, () => battle.accountContext);
  const roomContext = useSyncExternalStore(
    listener => battle.subscribeValuableSaleRoom(listener), () => battle.valuableSaleRoomContext, () => battle.valuableSaleRoomContext);
  const match = useSyncExternalStore(
    battle.matchPanel.subscribe, battle.matchPanel.getSnapshot, battle.matchPanel.getSnapshot);
  const saleAllowed = !match?.phase || match.phase === 'WAITING';
  const roomContextRef = useRef(roomContext); roomContextRef.current = roomContext;
  const generation = useRef(0);
  const [response, setResponse] = useState<ResValuableItemSale>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [saleInstance, setSaleInstance] = useState<number>();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const locked = useRef(false);
  const handledActivation = useRef(activation?.sequence);
  function setPending(value: boolean) {locked.current = value; setBusy(value); callbacks.current.onBusy(value);}

  useEffect(() => {
    const current = ++generation.current;
    const requestRoomContext = roomContext;
    if (owner.account !== account) {
      owner.account = account;
      owner.pending = undefined;
      owner.inFlight = undefined;
      callbacks.current.onBusy(false);
    }
    setSaleInstance(undefined); setReceiptOpen(false);
    setResponse(undefined);
    setStatus('');
    setPending(true);
    void (async () => {
      if (owner.inFlight) {try {await owner.inFlight;} catch { /* QUERY restores confirmation. */ }}
      return await battle.valuableItemSale({operation: 'QUERY'}, account,
        candidate => candidate === account && owner.account === account
          && roomContextRef.current === requestRoomContext);
    })().then(result => {
      if (generation.current !== current || owner.account !== account || roomContextRef.current !== requestRoomContext) return;
      setResponse(result); callbacks.current.onConfirmed(result); setReceiptOpen(Boolean(owner.pending));
    }).catch(error => {
      if (generation.current === current && roomContextRef.current === requestRoomContext) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message); setReceiptOpen(Boolean(owner.pending));
        if (!owner.pending) callbacks.current.onError(message);
      }
    }).finally(() => {if (generation.current === current && roomContextRef.current === requestRoomContext) setPending(false);});
    return () => {generation.current++; locked.current = false; callbacks.current.onBusy(false);};
  }, [account, battle, owner, refreshKey, roomContext]);

  useEffect(() => {
    handledActivation.current = activation?.sequence;
    setSaleInstance(undefined); setReceiptOpen(false);
    setResponse(undefined);
    setStatus('');
  }, [account, roomContext]);

  useEffect(() => {
    if (!activation || !saleAllowed || handledActivation.current === activation.sequence || disabled || locked.current) return;
    if (owner.pending && owner.pending.instanceId !== activation.instanceId) {
      handledActivation.current = activation.sequence;
      setSaleInstance(undefined);
      setStatus('请先确认未完成出售'); setReceiptOpen(true);
      return;
    }
    const quote = response?.quotes.find(value => value.instanceId === activation.instanceId);
    if (!quote?.canSell || !isTreasureItem(quote.itemTableId)) return;
    handledActivation.current = activation.sequence;
    setSaleInstance(activation.instanceId);
    setQuantity(String(owner.pending?.instanceId === activation.instanceId ? owner.pending.quantity ?? 1 : 1));
    setStatus('');
  }, [activation, busy, disabled, response, owner, saleAllowed]);

  const quote = response?.quotes.find(value => value.instanceId === saleInstance);
  const count = Number(quantity);
  const exact = quote !== undefined && isTreasureItem(quote.itemTableId);
  const pendingReceipt = Boolean(owner.pending && owner.pending.instanceId === saleInstance);
  const valid = Boolean(quote?.canSell && exact && Number.isInteger(count) && count > 0
    && count <= Math.min(quote.ownedQuantity, 0xffffff) && response?.money !== undefined
    && response.money + quote.unitPrice * count <= 999999999);
  const confirmable = pendingReceipt ? true : owner.pending ? false : valid;

  async function confirm(request: ReqValuableItemSale) {
    if (disabled || !saleAllowed || locked.current || owner.account !== account) return;
    const current = generation.current;
    setPending(true); setStatus('');
    if (owner.inFlight) {
      try {await owner.inFlight;} catch { /* Retry the same request below. */ }
      if (owner.inFlight !== undefined) {
        if (generation.current === current && owner.account === account) setPending(false);
        return;
      }
    }
    const requestRoomContext = roomContext;
    const promise = battle.valuableItemSale(request, account,
      candidate => candidate === account && owner.account === account && roomContextRef.current === requestRoomContext);
    owner.inFlight = promise;
    try {
      const result = await promise;
      if (result.sold?.result !== 2 || result.sold.instanceId !== request.instanceId
          || result.sold.quantity !== request.quantity) throw new Error('出售回执未确认');
      if (owner.pending === request) owner.pending = undefined;
      if (generation.current !== current || owner.account !== account) return;
      setResponse(result); callbacks.current.onConfirmed(result); setSaleInstance(undefined); setReceiptOpen(false);
    } catch (error) {
      if (owner.pending === request && explicitNotSold(error)) owner.pending = undefined;
      if (generation.current === current && owner.account === account) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (owner.inFlight === promise) owner.inFlight = undefined;
      if (generation.current === current && owner.account === account) setPending(false);
    }
  }

  async function sell() {
    if (disabled || !saleAllowed || locked.current || owner.account !== account) return;
    if (pendingReceipt) {await confirm(owner.pending!); return;}
    if (!valid || !quote || !exact) return;
    if (!owner.pending || owner.pending.instanceId !== quote.instanceId || owner.pending.quantity !== count) {
      owner.pending = {operation: 'SELL', instanceId: quote.instanceId, quantity: count,
        requestId: createRequestId()};
    }
    await confirm(owner.pending);
  }

  return <>
    {saleInstance !== undefined && <InventorySaleQuantityDialog ui={ui} quantity={quantity}
      change={value => {if (!owner.pending || owner.pending.instanceId !== saleInstance) setQuantity(value);}}
      busy={busy} disabled={disabled || !saleAllowed || !confirmable} status={status} confirm={() => void sell()}
      cancel={() => {if (!locked.current) {setSaleInstance(undefined); setReceiptOpen(Boolean(owner.pending));}}}
      label="出售贵重品数量" dataAttribute="data-valuable-sale-confirm"
      inputAttribute="data-valuable-sale-quantity" okAttribute="data-valuable-sale-ok"
      cancelAttribute="data-valuable-sale-cancel"/>}
    {receiptOpen && saleInstance === undefined && owner.pending && createPortal(<SourceConfirmView
      label="确认未完成出售" binding="valuable-sale-receipt" confirmLabel="确认出售结果" cancelLabel="稍后确认"
      messageLabel="出售确认" message={status || '出售结果尚未确认，是否重新确认本次出售？'}
      pending={busy} disabled={disabled || !saleAllowed} status=""
      confirm={() => {void confirm(owner.pending!);}} cancel={() => setReceiptOpen(false)}/>, document.body)}
  </>;
}
