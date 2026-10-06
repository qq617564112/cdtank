import {useEffect, useRef, useState} from 'react';
import type {ReqValuableItemSale, ResValuableItemSale} from '../../../../shared/protocols/PtlValuableItemSale';
import type {Battle} from '../../match/battle';
import {createRequestId} from '../../network/request-id';
import {InventorySaleQuantityDialog} from '../account/stack-item-sale-source';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceFeedbackText} from '../resources/source-feedback-text';

export interface ValuableItemSaleOwner {
  account?: object;
  pending?: ReqValuableItemSale;
  inFlight?: Promise<ResValuableItemSale>;
}

/** Confirmed valuable-sale projection is installed by the Home page owner. */
export function ValuableItemSaleSource({ui, battle, refreshKey, activation, owner, onConfirmed, onBusy, disabled = false}: {
  ui: HomeSourceUi; battle: Pick<Battle, 'accountContext' | 'valuableItemSale'>;
  refreshKey?: number; activation?: {instanceId: number; sequence: number};
  owner: ValuableItemSaleOwner; onConfirmed: (response: ResValuableItemSale) => void;
  onBusy: (busy: boolean) => void; disabled?: boolean;
}) {
  const callbacks = useRef({onConfirmed, onBusy}); callbacks.current = {onConfirmed, onBusy};
  const account = battle.accountContext;
  const generation = useRef(0);
  const [response, setResponse] = useState<ResValuableItemSale>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [saleInstance, setSaleInstance] = useState<number>();
  const [quantity, setQuantity] = useState('1');
  const locked = useRef(false);
  const handledActivation = useRef(activation?.sequence);
  function setPending(value: boolean) {locked.current = value; setBusy(value); callbacks.current.onBusy(value);}

  useEffect(() => {
    const current = ++generation.current;
    if (owner.account !== account) {
      owner.account = account;
      owner.pending = undefined;
      owner.inFlight = undefined;
    }
    setSaleInstance(undefined);
    setStatus('');
    setPending(true);
    void (async () => {
      if (owner.inFlight) {try {await owner.inFlight;} catch { /* QUERY restores confirmation. */ }}
      return await battle.valuableItemSale({operation: 'QUERY'});
    })().then(result => {
      if (generation.current !== current || owner.account !== account) return;
      setResponse(result); callbacks.current.onConfirmed(result);
    }).catch(error => {
      if (generation.current === current) setStatus(error instanceof Error ? error.message : String(error));
    }).finally(() => {if (generation.current === current) setPending(false);});
    return () => {generation.current++; locked.current = false; callbacks.current.onBusy(false);};
  }, [account, battle, owner, refreshKey]);

  useEffect(() => {
    if (!activation || handledActivation.current === activation.sequence || disabled || locked.current) return;
    const quote = response?.quotes.find(value => value.instanceId === activation.instanceId);
    if (!quote?.canSell || (quote.itemTableId !== 20001 && quote.itemTableId !== 20002)) return;
    handledActivation.current = activation.sequence;
    setSaleInstance(activation.instanceId);
    setQuantity(String(owner.pending?.instanceId === activation.instanceId ? owner.pending.quantity ?? 1 : 1));
    setStatus('');
  }, [activation, busy, disabled, response, owner]);

  const quote = response?.quotes.find(value => value.instanceId === saleInstance);
  const count = Number(quantity);
  const exact = quote?.itemTableId === 20001 || quote?.itemTableId === 20002;
  const valid = Boolean(quote?.canSell && exact && Number.isInteger(count) && count > 0
    && count <= Math.min(quote.ownedQuantity, 0xffffff) && response?.money !== undefined
    && response.money + quote.unitPrice * count <= 999999999);

  async function sell() {
    if (disabled || locked.current || !valid || !quote || !exact) return;
    const current = generation.current;
    if (owner.account !== account) return;
    if (!owner.pending || owner.pending.instanceId !== quote.instanceId || owner.pending.quantity !== count) {
      owner.pending = {operation: 'SELL', instanceId: quote.instanceId, quantity: count,
        requestId: createRequestId()};
    }
    const request = owner.pending;
    setPending(true); setStatus('');
    const promise = owner.inFlight ?? battle.valuableItemSale(request);
    owner.inFlight = promise;
    try {
      const result = await promise;
      if (result.sold?.result !== 2 || result.sold.instanceId !== request.instanceId
          || result.sold.quantity !== request.quantity) throw new Error('出售回执未确认');
      if (owner.pending === request) owner.pending = undefined;
      if (generation.current !== current || owner.account !== account) return;
      setResponse(result); callbacks.current.onConfirmed(result); setSaleInstance(undefined);
    } catch (error) {
      if (generation.current === current && owner.account === account) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (owner.inFlight === promise) owner.inFlight = undefined;
      if (generation.current === current && owner.account === account) setPending(false);
    }
  }

  return <>
    {saleInstance !== undefined && <InventorySaleQuantityDialog ui={ui} quantity={quantity} change={setQuantity}
      busy={busy} disabled={disabled || !valid} status={status} confirm={() => void sell()}
      cancel={() => {
        if (locked.current) return;
        if (owner.pending?.instanceId === saleInstance) owner.pending = undefined;
        setSaleInstance(undefined);
      }} label="出售贵重品数量" dataAttribute="data-valuable-sale-confirm"
      inputAttribute="data-valuable-sale-quantity" okAttribute="data-valuable-sale-ok"
      cancelAttribute="data-valuable-sale-cancel"/>}
    {saleInstance === undefined && status && <output role="status" data-valuable-sale-status=""><SourceFeedbackText text={status}/></output>}
  </>;
}
