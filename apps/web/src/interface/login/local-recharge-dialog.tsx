import {useId, useLayoutEffect, useRef, useState} from 'react';
import {LOCAL_CURRENCY_LIMITS} from '../../../../shared/contracts/local-currency';
import {desktopClient} from '../../platform/desktop';
import {accountPageScale, subscribeGamePageViewport} from '../../platform/page-viewport';
import {CartoonInput} from '../resources/cartoon-controls';
import {DialogButton} from '../resources/dialog-button';
import {GameDialog, GameDialogFootbar, GameDialogPanel, GameDialogTitle, GameDialogTopbar}
  from '../resources/game-dialog';
import './local-recharge-dialog.css';

export function LocalRechargeDialog({savedAccount, close}: {savedAccount: string; close(): void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const formId = useId();
  const [account, setAccount] = useState(savedAccount);
  const [tokens, setTokens] = useState('0'), [money, setMoney] = useState('0');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(accountPageScale);
  useLayoutEffect(() => subscribeGamePageViewport(() => setScale(accountPageScale())), []);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);
  async function recharge(): Promise<void> {
    if (submitting.current) return;
    const desktop = desktopClient();
    if (desktop?.initialState.mode !== 'local') return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    setStatus('正在充值…');
    try {
      const balance = await desktop.creditLocalCurrency({account, tokens: Number(tokens), money: Number(money)});
      setStatus(`充值成功：${balance.account} 当前星币 ${balance.tokens}，金钱 ${balance.money}。`);
      setTokens('0');
      setMoney('0');
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : '充值失败。');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return <GameDialog ref={dialog} width={510} height={370} uiScale={scale} className="local-recharge-dialog"
    aria-label="充值" aria-busy={pending}
    onCancel={event => {event.preventDefault(); if (!submitting.current) close();}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <GameDialogTopbar><GameDialogTitle>充值</GameDialogTitle></GameDialogTopbar>
    <GameDialogPanel>
      <form id={formId} className="local-recharge-form" onSubmit={event => {event.preventDefault(); void recharge();}}>
        <p>为本地账号增加星币和金钱</p>
        <label htmlFor={`${formId}-account`}>用户名</label>
        <CartoonInput id={`${formId}-account`} width={300} height={38} required autoFocus
          autoComplete="username" spellCheck={false} autoCapitalize="none" value={account} disabled={pending}
          onChange={event => setAccount(event.currentTarget.value)}/>
        <label htmlFor={`${formId}-tokens`}>星币数量</label>
        <CartoonInput id={`${formId}-tokens`} width={300} height={38} type="number" inputMode="numeric"
          required min={0} max={LOCAL_CURRENCY_LIMITS.tokens} step={1} value={tokens} disabled={pending}
          onChange={event => setTokens(event.currentTarget.value)}/>
        <label htmlFor={`${formId}-money`}>金钱数量</label>
        <CartoonInput id={`${formId}-money`} width={300} height={38} type="number" inputMode="numeric"
          required min={0} max={LOCAL_CURRENCY_LIMITS.money} step={1} value={money} disabled={pending}
          onChange={event => setMoney(event.currentTarget.value)}/>
        <p className="local-recharge-status" role="status" aria-live="polite" data-failed={failed}>{status}</p>
      </form>
    </GameDialogPanel>
    <GameDialogFootbar className="local-recharge-actions">
      <DialogButton type="submit" form={formId} disabled={pending || !account.trim()
        || !(Number(tokens) > 0 || Number(money) > 0)}>充值</DialogButton>
      <DialogButton type="button" disabled={pending} onClick={close}>关闭</DialogButton>
    </GameDialogFootbar>
  </GameDialog>;
}
