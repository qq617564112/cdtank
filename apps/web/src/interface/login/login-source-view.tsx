import {imageResourceUrl} from '../../assets/image-cache';
import {useRef, useState} from 'react';
import {CartoonButton, CartoonCheckbox, CartoonInput} from '../resources/cartoon-controls';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {useRoomInputLimit} from '../lobby/room-input-limit';
import {SourceEntrySheet} from './source-entry-sheet';
import {LoginArtwork} from './login-artwork';

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
  const login = () => {
    if (!canLogin || composing.current) return;
    props.onLogin(account, password);
  };
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
      <LoginArtwork/>
      <CartoonInput ref={accountInput} {...sourceProps(ui, layout, 'login.xml', 'edtAccount')} {...accountEvents}
        width={197} height={31} style={sourceProps(ui, layout, 'login.xml', 'zhanghaoshurukuangditu').style}
        inputStyle={sourceProps(ui, layout, 'login.xml', 'edtAccount', undefined, 0, 0, true).style}
        aria-label="账号" autoComplete="username" value={account}
        disabled={props.busy} spellCheck={false} autoCapitalize="none"/>
      <CartoonInput ref={passwordInput} {...sourceProps(ui, layout, 'login.xml', 'edtPassword')} {...passwordEvents}
        width={189} height={31} shape="password" style={sourceProps(ui, layout, 'login.xml', 'mimashurukuangditu').style}
        inputStyle={sourceProps(ui, layout, 'login.xml', 'edtPassword', undefined, 0, 0, true).style}
        aria-label="密码" type="password" autoComplete="off"
        value={password} disabled={props.busy}/>
      <CartoonCheckbox {...sourceProps(ui, layout, 'login.xml', 'chkSaveAccount')}
        checked={props.saveAccount} disabled={props.busy}
        onChange={event => props.onSaveAccount(event.currentTarget.checked)}>保存账号</CartoonCheckbox>
      <CartoonButton {...sourceProps(ui, layout, 'login.xml', 'btnLogin')} width={249}
        type="submit" disabled={!canLogin}>登录</CartoonButton>
      <CartoonButton {...sourceProps(ui, layout, 'login.xml', 'btnRegister')} width={79}
        disabled={props.busy || !credentials} onClick={() => {
          if (!composing.current) props.onRegister(account, password);
        }}>注册</CartoonButton>
      <CartoonButton {...sourceProps(ui, layout, 'login.xml', 'btnExit')} width={249}
        disabled={props.busy} onClick={props.onExit}>离开游戏</CartoonButton>
      <button type="button" className="login-wood-button login-wood-home" disabled>
        <img src={imageResourceUrl('/ui/login/wood-home.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>主页</span>
      </button>
      <button type="button" className="login-wood-button login-wood-currency" disabled>
        <img src={imageResourceUrl('/ui/login/wood-currency.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>取得 Q 点</span>
      </button>
      <button type="button" className="login-wood-button login-wood-settings"
        disabled={props.busy} onClick={props.onSettings}>
        <img src={imageResourceUrl('/ui/login/wood-settings.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>系统设定</span>
      </button>
      <button type="button" className="login-wood-button login-wood-intro"
        disabled={props.busy} onClick={props.onHistoryIntro}>
        <img src={imageResourceUrl('/ui/login/wood-intro.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>木桶镇<small>介绍</small></span>
      </button>
    </form>}
  </SourceEntrySheet>;
}
