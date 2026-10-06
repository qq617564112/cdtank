import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRequestId} from '../../network/request-id';
import {createPortal} from 'react-dom';
import type {ReqStackItemSale, ResStackItemSale} from '../../../../shared/protocols/PtlStackItemSale';
import type {ShopSource} from './shop';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {SourceButton} from '../resources/source-button';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import './stack-item-sale-source.css';

export interface StackSaleOwner {
  pending?: ReqStackItemSale;
  inFlight?: Promise<ResStackItemSale>;
}

/** Confirmed inventory and wallet are installed by the page owner. */
export function StackItemSaleSource({ui, source, instanceId, activation, refreshKey, owner, onConfirmed, onBusy, disabled = false}: {
  ui: HomeSourceUi; source: ShopSource; instanceId?: number;
  activation?: {instanceId: number; sequence: number}; owner: StackSaleOwner;
  refreshKey?: number;
  onConfirmed: (response: ResStackItemSale) => void; onBusy: (busy: boolean) => void; disabled?: boolean;
}) {
  const callbacks = useRef({onConfirmed, onBusy}); callbacks.current = {onConfirmed, onBusy};
  const generation = useRef(0);
  const [response, setResponse] = useState<ResStackItemSale>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [saleInstance, setSaleInstance] = useState<number>();
  const [quantity, setQuantity] = useState('1');
  const locked = useRef(false);
  const handledActivation = useRef(activation?.sequence);
  function setPending(value: boolean) {locked.current = value; setBusy(value); callbacks.current.onBusy(value);}
  useEffect(() => {
    const current = ++generation.current;
    setSaleInstance(undefined);
    if (!source.stackItemSale) return;
    setPending(true);
    setStatus('');
    void (async () => {
      if (owner.inFlight) {try {await owner.inFlight;} catch { /* QUERY restores the confirmed projection. */ }}
      return await source.stackItemSale!({operation: 'QUERY'});
    })().then(result => {
      if (generation.current !== current) return;
      setResponse(result); callbacks.current.onConfirmed(result);
    }).catch(error => {
      if (generation.current === current) setStatus(error instanceof Error ? error.message : String(error));
    }).finally(() => {if (generation.current === current) setPending(false);});
    return () => {generation.current++; locked.current = false; callbacks.current.onBusy(false);};
  }, [source, instanceId, refreshKey, owner]);
  useEffect(() => {
    if (!activation || handledActivation.current === activation.sequence || disabled || locked.current) return;
    const quote = response?.quotes.find(value => value.instanceId === activation.instanceId);
    if (!quote?.canSell) return;
    handledActivation.current = activation.sequence;
    setSaleInstance(activation.instanceId);
    setQuantity(String(owner.pending?.instanceId === activation.instanceId ? owner.pending.quantity ?? 1 : 1));
    setStatus('');
  }, [activation, busy, disabled, response, owner]);
  const quote = response?.quotes.find(value => value.instanceId === saleInstance);
  const count = Number(quantity);
  const valid = Boolean(quote?.canSell && Number.isInteger(count) && count > 0
    && count <= Math.min(quote.ownedQuantity, 0xffffff) && response?.money !== undefined
    && response.money + quote.unitPrice * count <= 999999999);
  async function sell() {
    if (disabled || locked.current || !valid || !quote || !source.stackItemSale) return;
    const current = generation.current;
    if (owner.pending?.instanceId !== quote.instanceId || owner.pending.quantity !== count) {
      owner.pending = {operation: 'SELL', instanceId: quote.instanceId, quantity: count,
        requestId: createRequestId()};
    }
    const request = owner.pending;
    setPending(true); setStatus('');
    const promise = owner.inFlight ?? source.stackItemSale(request);
    owner.inFlight = promise;
    try {
      const result = await promise;
      if (result.sold?.result !== 2 || result.sold.instanceId !== request.instanceId
        || result.sold.quantity !== request.quantity) throw new Error('出售回执未确认');
      if (owner.pending === request) owner.pending = undefined;
      if (generation.current !== current) return;
      setResponse(result); callbacks.current.onConfirmed(result); setSaleInstance(undefined);
    } catch (error) {
      if (generation.current === current) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (owner.inFlight === promise) owner.inFlight = undefined;
      if (generation.current === current) setPending(false);
    }
  }
  return <>
    {saleInstance !== undefined && <StackSaleQuantityDialog ui={ui} quantity={quantity} change={setQuantity}
      busy={busy} disabled={disabled || !valid} status={status} confirm={() => void sell()}
      cancel={() => {if (!locked.current) setSaleInstance(undefined);}}/>}
    {saleInstance === undefined && status && <output role="status" data-stack-sale-status=""><SourceFeedbackText text={status}/></output>}
  </>;
}

const suffix = 'userinput_dialog.xml';
function StackSaleQuantityDialog({ui, quantity, change, busy, disabled, status, confirm, cancel}: {
  ui: HomeSourceUi; quantity: string; change: (value: string) => void;
  busy: boolean; disabled: boolean; status: string; confirm: () => void; cancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const layout = new HomeSourceLayout(ui, suffix);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useLayoutEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal(); element.querySelector<HTMLInputElement>('input')?.focus();
    return () => {if (element.open) element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus();};
  }, []);
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  return createPortal(<dialog ref={dialog} data-stack-sale-confirm="" aria-label="出售道具数量" aria-busy={busy}
    style={{width: 307 * scale, height: 120 * scale}} onCancel={event => {event.preventDefault(); if (!busy) cancel();}}
    onKeyDown={event => {event.stopPropagation(); if (event.key === 'Enter') {event.preventDefault(); if (!busy && !disabled) confirm();}}}
    onKeyUp={event => event.stopPropagation()}>
    <div className="stack-sale-stage" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {['SheetWindow', 'picBackgroundMask', 'shangkuang', 'xiakuang', 'shufukuangditu'].map(name =>
          <SourceStaticImage key={name} ui={ui} layout={layout} suffix={suffix} name={name} aria-hidden="true"/>)}
        <div {...sourceProps(ui, layout, suffix, 'txtMessage')} role="document">请输入你想要售出的道具的数量。</div>
        <input {...sourceProps(ui, layout, suffix, 'edtInput')} aria-label="出售数量" data-stack-sale-quantity=""
          data-feedback-font="xiangjiao-brush"
          inputMode="numeric" value={quantity} disabled={busy} onChange={event => change(event.target.value)}/>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnOK" aria-label="确认出售"
          data-stack-sale-ok="" disabled={busy || disabled} onClick={confirm}/>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnCancel" aria-label="取消出售"
          data-stack-sale-cancel="" disabled={busy} onClick={cancel}/>
      </SourceImageScale>
      {status && <output className="stack-sale-status" role="status"><SourceFeedbackText text={status}/></output>}
    </div>
  </dialog>, document.body);
}
