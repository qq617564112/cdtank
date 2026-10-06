import './home-name-source-dialog.css';
import {createPortal} from 'react-dom';
import {useEffect, useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage, SourceImageScale} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

/** Source input imagery hosts the existing confirmed account-name transaction. */
export function HomeNameSourceDialog({ui, battle, close, saved}: {
  ui: HomeSourceUi; battle: Pick<Battle, 'displayName' | 'lobbyPresence'>;
  close(): void; saved(name: string): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const owner = useRef({active: false, pending: false}), composing = useRef(false);
  const escapePending = useRef(false);
  const [draft, setDraft] = useState(''), [pending, setPending] = useState(true), [status, setStatus] = useState('载入昵称…');
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const layout = new HomeSourceLayout(ui, 'userinput_dialog.xml');
  useEffect(() => {
    const element = dialog.current!, origin = document.activeElement;
    const current = {active: true, pending: true};owner.current = current;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    void battle.displayName().then(name => {if (current.active) {setDraft(name);setStatus('');}})
      .catch(error => {if (current.active) setStatus(error instanceof Error ? error.message : String(error));})
      .finally(() => {if(current.active){current.pending = false;setPending(false);requestAnimationFrame(()=>input.current?.focus());}});
    return () => {
      current.active = false;window.removeEventListener('resize', resize);
      if(element.open)element.close();
      if(origin instanceof HTMLElement&&origin.isConnected&&(document.activeElement===document.body||element.contains(document.activeElement)))origin.focus();
    };
  }, [battle]);
  function cancel(){owner.current.active=false;close();}
  async function confirm(){
    const current=owner.current;
    if(!current.active||current.pending||composing.current)return;
    current.pending=true;setPending(true);setStatus('正在确认昵称…');
    try{
      const name=await battle.displayName(draft);
      void battle.lobbyPresence.refresh();
      if(!current.active)return;
      saved(name);cancel();
    }catch(error){if(current.active){setStatus(error instanceof Error?error.message:String(error));requestAnimationFrame(()=>input.current?.focus());}}
    finally{current.pending=false;if(current.active)setPending(false);}
  }
  return createPortal(<dialog ref={dialog} data-home-name-dialog="" aria-label="修改昵称" aria-busy={pending}
    style={{zoom:scale}} onCancel={event=>{event.preventDefault();if(!composing.current)cancel();}}
    onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();if(!composing.current&&!event.nativeEvent.isComposing)escapePending.current=true;}}}
    onKeyUp={event=>{event.stopPropagation();if(event.key==='Escape'&&escapePending.current){escapePending.current=false;if(!composing.current&&!event.nativeEvent.isComposing)cancel();}}}>
    <SourceImageScale value={scale}><div className="home-name-source-stage" data-home-name-stage="">
      {['shangkuang','shufukuangditu','xiakuang'].map(name=><SourceStaticImage key={name} ui={ui} layout={layout}
        suffix="userinput_dialog.xml" name={name} aria-hidden="true"/>)}
      <SourceStaticText ui={ui} layout={layout} suffix="userinput_dialog.xml" name="txtMessage" text="修改昵称"/>
      <form onSubmit={event=>{event.preventDefault();if(!composing.current)void confirm();}}>
        <input ref={input} {...sourceProps(ui,layout,'userinput_dialog.xml','edtInput')}
          className="home-name-source-input" data-home-name-input="" aria-label="昵称" autoComplete="off" disabled={pending}
          value={draft} onChange={event=>setDraft(event.currentTarget.value)}
          onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
          onKeyDown={event=>{if(event.key==='Enter'){
            event.preventDefault();if(!composing.current&&!event.nativeEvent.isComposing&&event.keyCode!==229)void confirm();
          }}}/>
        <SourceButton ui={ui} layout={layout} suffix="userinput_dialog.xml" source="btnOK" data-home-name-confirm=""
          aria-label="确认昵称" disabled={pending} onClick={()=>{void confirm();}}/>
        <SourceButton ui={ui} layout={layout} suffix="userinput_dialog.xml" source="btnCancel" data-home-name-cancel=""
          aria-label="取消修改昵称" onClick={cancel}/>
      </form>
      <output role="status" className="home-name-source-status" data-home-name-status="">{status}</output>
    </div></SourceImageScale>
  </dialog>, document.body);
}
