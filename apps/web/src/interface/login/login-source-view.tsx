import {SourceButton} from '../resources/source-button';
import {useRef, useState} from 'react';
import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {useRoomInputLimit} from '../lobby/room-input-limit';
import {SourceEntryPictures, SourceEntrySheet} from './source-entry-sheet';

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
  const accountEvents = useRoomInputLimit(accountInput, 20, setAccount, !!ui);
  const passwordEvents = useRoomInputLimit(passwordInput, 20, setPassword, !!ui);
  const withinLimit = Array.from(account).length <= 20 && Array.from(password).length <= 20;
  const credentials = withinLimit && account.length > 0 && password.length > 0;
  const canLogin = !props.busy && withinLimit && (credentials || (props.hasSavedIdentity && account === props.savedAccount && password === ''));
  const login = () => {if (canLogin && !composing.current) props.onLogin(account, password);};
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
        value={password} disabled={props.busy}/>
      <SourceStaticImage ui={ui} layout={layout} suffix="login.xml" name="chkSaveAccount"
        reference={layout.control('chkSaveAccount').properties[props.saveAccount ? 'CheckMarkImage' : 'NormalImage']}
        className="source-entry-picture" aria-hidden="true"/>
      <input {...sourceProps(ui, layout, 'login.xml', 'chkSaveAccount')} className="source-entry-checkbox"
        type="checkbox" checked={props.saveAccount} disabled={props.busy} aria-label="保存账号"
        onChange={event => props.onSaveAccount(event.currentTarget.checked)}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnLogin" aria-label="登录"
        disabled={!canLogin} onClick={login}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnRegister" aria-label="注册"
        disabled={props.busy || !credentials} onClick={() => {if (!composing.current) props.onRegister(account, password);}}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnExit" aria-label="退出"
        disabled={props.busy} onClick={props.onExit}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnSettings" aria-label="系统设置"
        disabled={props.busy} onClick={props.onSettings}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnHistory" aria-label="游戏介绍"
        disabled={props.busy} onClick={props.onHistoryIntro}/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnPaypal" aria-label="充值" disabled/>
      <SourceButton ui={ui} layout={layout} suffix="login.xml" source="btnBuyCoinQ" aria-label="购买代币" disabled/>
    </form>}
  </SourceEntrySheet>;
}
