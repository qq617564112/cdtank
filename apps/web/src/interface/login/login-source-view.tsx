import {imageResourceUrl} from '../../assets/image-cache';
import {playButtonSound} from '../../audio/button-sound';
import {getResourcePackBytes} from '../../assets/static-resource-cache';
import {useCallback, useRef, useState} from 'react';
import {CartoonButton, CartoonCheckbox, CartoonInput} from '../resources/cartoon-controls';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {useRoomInputLimit} from '../lobby/room-input-limit';
import {SourceEntrySheet} from './source-entry-sheet';
import {LoginArtwork} from './login-artwork';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {ResourcePackLoading} from './resource-pack-loading';
import {isMobileDevice} from '../../platform/device';
import {desktopClient} from '../../platform/desktop';
import {LocalRechargeDialog} from './local-recharge-dialog';

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
}

/** Original login controls dispatch credentials to the owning entry lifecycle. */
export function LoginSourceView(props: LoginSourceViewProps) {
  const {ui, error} = useSourceUi(true, ['login.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'login.xml') : undefined;
  const [account, setAccount] = useState(props.savedAccount), [password, setPassword] = useState('');
  const [confirmResources, setConfirmResources] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const desktop = desktopClient();
  const canRecharge = desktop?.initialState.mode === 'local';
  const canLoadResources = !isMobileDevice() && !desktop;
  const finishLoadingResources = useCallback(() => setLoadingResources(false), []);
  const accountInput = useRef<HTMLInputElement>(null), passwordInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const accountEvents = useRoomInputLimit(accountInput, 20, setAccount, !!ui && !loadingResources);
  const passwordEvents = useRoomInputLimit(passwordInput, 20, setPassword, !!ui && !loadingResources);
  const withinLimit = Array.from(account).length <= 20 && Array.from(password).length <= 20;
  const credentials = withinLimit && account.length > 0 && password.length > 0;
  const canLogin = !props.busy && withinLimit && (credentials || (props.hasSavedIdentity && account === props.savedAccount && password === ''));
  const login = () => {
    if (!canLogin || composing.current) return;
    props.onLogin(account, password);
  };
  if (canLoadResources && loadingResources) return <ResourcePackLoading onComplete={finishLoadingResources}/>;
  return <><SourceEntrySheet page="login" ui={ui} error={error} busy={props.busy} status={props.status}>
    {ui && layout && <form className="source-entry-form" onSubmit={event => {event.preventDefault(); login();}}
      onCompositionStartCapture={() => {composing.current = true;}}
      onCompositionEndCapture={() => {composing.current = false;}}
      onKeyDown={event => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') {
          if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          if (canLogin) playButtonSound();
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
      <a className="login-wood-button login-wood-home" data-button-sound="" href="https://github.com/qq617564112/cdtank"
        target="_blank" rel="noopener noreferrer">
        <img src={imageResourceUrl('/ui/login/wood-home.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>项目主页</span>
      </a>
      {(canLoadResources || canRecharge) && <button type="button" className="login-wood-button login-wood-resources"
        disabled={props.busy} onClick={() => {if (canRecharge) setRecharging(true); else setConfirmResources(true);}}>
        <img src={imageResourceUrl('/ui/login/wood-currency.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>{canRecharge ? '充值' : '加载资源包'}</span>
      </button>}
      <button type="button" className="login-wood-button login-wood-settings"
        disabled={props.busy} onClick={props.onSettings}>
        <img src={imageResourceUrl('/ui/login/wood-settings.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>系统设定</span>
      </button>
      <a className="login-wood-button login-wood-intro" data-button-sound=""
        href="https://baike.baidu.com/item/%E9%98%BF%E7%8C%AB%E9%98%BF%E7%8B%97%E5%A4%A7%E4%BD%9C%E6%88%98/1715847"
        target="_blank" rel="noopener noreferrer">
        <img src={imageResourceUrl('/ui/login/wood-intro.png')} alt="" aria-hidden="true" draggable={false}/>
        <span>游戏<small>介绍</small></span>
      </a>
    </form>}
    <footer className="login-copyright" aria-label="版权与源码许可">
      <p>Copyright © 大宇资讯股份有限公司 · 上海软星制作 · All Rights Reserved.</p>
      <p>© 2026 CDTank contributors · 非官方复刻 · <a href="https://github.com/qq617564112/cdtank/blob/main/LICENSE"
        target="_blank" rel="noopener noreferrer">源码公开，仅供非商业研究，禁止商用</a></p>
    </footer>
  </SourceEntrySheet>
    {canRecharge && recharging && <LocalRechargeDialog savedAccount={props.savedAccount} close={() => setRecharging(false)}/>}
    {canLoadResources && confirmResources && <SourceConfirmView label="加载资源包" binding="web-resource-pack"
      message={`将一次性加载并缓存所有游戏静态资源。\n资源包约 ${(getResourcePackBytes() / 1_000_000_000).toFixed(1)} GB，确认后进入加载界面。`}
      pending={false} disabled={props.busy} status="" cancel={() => setConfirmResources(false)}
      confirm={() => {setConfirmResources(false); setLoadingResources(true);}}/>}
  </>;
}
