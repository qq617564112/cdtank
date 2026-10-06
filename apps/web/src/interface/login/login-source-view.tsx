import {SourceButton} from '../resources/source-button';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {useRoomInputLimit} from '../lobby/room-input-limit';
import {roomInputLength} from '../../../../shared/room-input';
import {SourceEntryPictures, SourceEntrySheet} from './source-entry-sheet';
import {SourceCharacterKeyboard} from './source-character-keyboard';

export interface LoginSourceViewProps {
  busy: boolean;
  status: string;
  savedAccount: string;
  hasSavedIdentity: boolean;
  saveAccount: boolean;
  onSaveAccount: (checked: boolean) => void;
  onLogin: (account: string, password: string) => void;
  onRegister: (account: string, password: string) => void;
  onExit: () => void;
  onSettings: () => void;
  onHistoryIntro: () => void;
}

/** Original login controls dispatch credentials to the owning entry lifecycle. */
export function LoginSourceView(props: LoginSourceViewProps) {
  const {ui, error} = useSourceUi(true, ['login.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'login.xml') : undefined;
  const [account, setAccount] = useState(props.savedAccount), [password, setPassword] = useState('');
  const accountInput = useRef<HTMLInputElement>(null), passwordInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const suppressOpen = useRef(false), pendingCaret = useRef<number | null>(null);
  useEffect(() => {if (props.busy) setKeyboardOpen(false);}, [props.busy]);
  const accountEvents = useRoomInputLimit(accountInput, 20, setAccount, !!ui);
  const passwordEvents = useRoomInputLimit(passwordInput, 20, setPassword, !!ui);
  const withinLimit = Array.from(account).length <= 20 && Array.from(password).length <= 20;
  const credentials = withinLimit && account.length > 0 && password.length > 0;
  const canLogin = !props.busy && withinLimit && (credentials || (props.hasSavedIdentity && account === props.savedAccount && password === ''));
  const login = () => {
    if (!canLogin || composing.current) return;
    setKeyboardOpen(false);
    props.onLogin(account, password);
  };
  const dismissKeyboard = () => setKeyboardOpen(false);
  const inKeyboard = (target: EventTarget | null) =>
    target instanceof Element && target.closest('.source-keyboard') !== null;
  // Keyboard insertion replaces the live selection, rejecting overflow without touching the value.
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    passwordInput.current?.setSelectionRange(caret, caret);
  }, [password]);
  function insertCharacter(character: string): void {
    const element = passwordInput.current;
    if (!element || props.busy || composing.current) return;
    const start = element.selectionStart ?? element.value.length, end = element.selectionEnd ?? start;
    if (document.activeElement !== element) element.focus({preventScroll: true});
    element.setSelectionRange(start, end);
    const next = element.value.slice(0, start) + character + element.value.slice(end);
    if (roomInputLength(next) > 20) return;
    // Replacing a selection with the same character leaves value unchanged, so no commit effect runs.
    if (next === element.value) {
      pendingCaret.current = null;
      element.setSelectionRange(start + character.length, start + character.length);
      return;
    }
    pendingCaret.current = start + character.length;
    setPassword(next);
  }
  function openKeyboard(): void {
    if (props.busy) return;
    suppressOpen.current = false;
    setKeyboardOpen(true);
  }
  function closeKeyboard(returnToPassword: boolean): void {
    setKeyboardOpen(false);
    const element = passwordInput.current;
    if (returnToPassword && element && !props.busy && document.activeElement !== element) {
      suppressOpen.current = true;
      element.focus({preventScroll: true});
    }
  }
  return <SourceEntrySheet page="login" ui={ui} error={error} busy={props.busy} status={props.status}>
    {ui && layout && <form className="source-entry-form" onSubmit={event => {event.preventDefault(); login();}}
      onCompositionStartCapture={() => {composing.current = true;}}
      onCompositionEndCapture={() => {composing.current = false;}}
      onKeyDown={event => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') {
          if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          login();
        }
      }}>
      <SourceEntryPictures ui={ui} layout={layout} suffix="login.xml"/>
      <input ref={accountInput} {...sourceProps(ui, layout, 'login.xml', 'edtAccount')} {...accountEvents}
        className="source-entry-input" aria-label="账号" autoComplete="username" value={account}
        disabled={props.busy} spellCheck={false} autoCapitalize="none"/>
      <input ref={passwordInput} {...sourceProps(ui, layout, 'login.xml', 'edtPassword')} {...passwordEvents}
        className="source-entry-input" aria-label="密码" type="password" autoComplete="off"
        value={password} disabled={props.busy}
        onBlur={event => {if (!inKeyboard(event.relatedTarget)) setKeyboardOpen(false);}}
        onFocus={() => {if (suppressOpen.current) {suppressOpen.current = false; return;} openKeyboard();}}
        onPointerDown={() => {suppressOpen.current = false; openKeyboard();}}/>
      {ui && layout && <SourceCharacterKeyboard open={keyboardOpen} busy={props.busy} passwordInput={passwordInput}
        onCharacter={insertCharacter} onClose={closeKeyboard}/>}
      <SourceStaticImage ui={ui} layout={layout} suffix="login.xml" name="chkSaveAccount"
        reference={layout.control('chkSaveAccount').properties[props.saveAccount ? 'CheckMarkImage' : 'NormalImage']}
        className="source-entry-picture" aria-hidden="true"/>
      <input {...sourceProps(ui, layout, 'login.xml', 'chkSaveAccount')} className="source-entry-checkbox"
        type="checkbox" checked={props.saveAccount} disabled={props.busy} aria-label="保存账号"
        onChange={event => props.onSaveAccount(event.currentTarget.checked)}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnLogin" aria-label="登录"
        disabled={!canLogin} onClick={login}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnRegister" aria-label="注册"
        disabled={props.busy || !credentials} onClick={() => {
          dismissKeyboard();
          if (!composing.current) props.onRegister(account, password);
        }}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnExit" aria-label="退出"
        disabled={props.busy} onClick={() => {dismissKeyboard(); props.onExit();}}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnSettings" aria-label="系统设置"
        disabled={props.busy} onClick={() => {dismissKeyboard(); props.onSettings();}}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnHistory" aria-label="游戏介绍"
        disabled={props.busy} onClick={() => {dismissKeyboard(); props.onHistoryIntro();}}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnPaypal" aria-label="充值" disabled/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnBuyCoinQ" aria-label="购买代币" disabled/>
    </form>}
  </SourceEntrySheet>;
}
