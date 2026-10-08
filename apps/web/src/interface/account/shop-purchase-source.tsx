import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {ShopCurrency} from '../../../../shared/protocols/PtlShop';
import {SourceButton} from '../resources/source-button';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import './shop-purchase-source.css';

const suffix = 'userinput_dialog.xml';
const viewportScale = () => Math.min(innerWidth / 800, innerHeight / 600);

/** Shop decisions use the original input sheet and confirmation buttons. */
export function ShopPurchaseSource({ui, name, moneyPrice, tokenPrice, moneyAvailable = true, quantity, changeQuantity,
  currency, changeCurrency, pending, status, confirm, cancel}: {
  ui: HomeSourceUi; name: string; moneyPrice: number; tokenPrice: number; moneyAvailable?: boolean;
  quantity?: string; changeQuantity?: (quantity: string) => void;
  currency: ShopCurrency; changeCurrency: (currency: ShopCurrency) => void;
  pending: boolean; status: string; confirm: () => void; cancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<'Quantity' | 'Payment'>(quantity === undefined ? 'Payment' : 'Quantity');
  const [scale, setScale] = useState(viewportScale);
  const layout = new HomeSourceLayout(ui, suffix);
  const count = quantity === undefined ? 1 : Number(quantity);
  const validQuantity = Number.isInteger(count) && count >= 1 && count <= 10;
  const disabled = !validQuantity || (step === 'Payment' && (currency === 'TOKENS' ? tokenPrice <= 0 : !moneyAvailable));
  const price = currency === 'MONEY' ? String(moneyPrice * count) : String(tokenPrice * count / 10);
  const message = status || (step === 'Quantity'
    ? validQuantity ? '请输入您想要购买的道具数量（组）。' : '请输入1至10的整数。'
    : `用${currency === 'MONEY' ? '金钱' : '星币'}${price}购买${name}${quantity === undefined ? '' : `×${count}`}？`);

  useLayoutEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useLayoutEffect(() => {
    dialog.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select')?.focus();
  }, [step]);
  useEffect(() => {
    const resize = () => setScale(viewportScale());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  function accept() {
    if (pending || disabled) return;
    if (step === 'Quantity') setStep('Payment');
    else confirm();
  }
  const text = sourceProps(ui, layout, suffix, 'txtMessage');
  return createPortal(<dialog ref={dialog} className="shop-purchase-dialog" data-shop-purchase-confirm=""
    data-shop-purchase-step={step} aria-label={`购买${name}`} aria-busy={pending}
    style={{width: 307 * scale, height: 120 * scale}}
    onCancel={event => {event.preventDefault(); event.stopPropagation(); if (!pending) cancel();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter' && !event.nativeEvent.isComposing
          && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
        event.preventDefault(); accept();
      }
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="shop-purchase-stage" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {['SheetWindow', 'picBackgroundMask', 'shangkuang', 'xiakuang', 'shufukuangditu'].map(control =>
          <SourceStaticImage key={control} ui={ui} layout={layout} suffix={suffix} name={control} aria-hidden="true"/>)}
        <div {...text} style={{...text.style, height: 28}} role={status ? 'alert' : 'document'}>
          <SourceFeedbackText text={message}/>
        </div>
        {step === 'Quantity' ? <input {...sourceProps(ui, layout, suffix, 'edtInput')}
          inputMode="numeric" aria-label="购买数量" data-shop-quantity="" value={quantity}
          disabled={pending} onChange={event => changeQuantity?.(event.currentTarget.value)}/>
          : <select {...sourceProps(ui, layout, suffix, 'edtInput')} aria-label="购买币种"
            data-shop-currency="" value={currency} disabled={pending}
            onChange={event => changeCurrency(event.currentTarget.value === 'TOKENS' ? 'TOKENS' : 'MONEY')}>
            <option value="TOKENS" disabled={tokenPrice <= 0}>用星币购买</option>
            <option value="MONEY" disabled={!moneyAvailable}>用金钱购买</option>
          </select>}
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnOK" data-shop-buy=""
          aria-label={step === 'Quantity' ? '确认购买数量' : '确认购买'} disabled={pending || disabled} onClick={accept}/>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnCancel" data-shop-purchase-cancel=""
          aria-label="取消购买" disabled={pending} onClick={cancel}/>
      </SourceImageScale>
    </div>
  </dialog>, document.body);
}
