import {imageResourceUrl} from '../../assets/image-cache';
import {CartoonExplosion, CartoonPaper} from '../resources/cartoon-artwork';
import './login-hd.css';

/** Decorative layers use the same 800 × 600 coordinates as the login controls. */
export function LoginArtwork() {
  return <>
    <CartoonExplosion className="login-burst"/>
    <CartoonPaper className="login-paper"/>
    <img className="login-logo" src={imageResourceUrl('/ui/login/logo-white-outline.png')} alt="阿猫阿狗大作战 TUN TOWN WARS ONLINE" draggable={false}/>
    <span className="login-field-label login-account-label" aria-hidden="true">账号</span>
    <span className="login-field-label login-password-label" aria-hidden="true">密码</span>
    <img className="login-wood-pole" src={imageResourceUrl('/ui/login/wood-pole.png')} alt="" aria-hidden="true" draggable={false}/>
  </>;
}
