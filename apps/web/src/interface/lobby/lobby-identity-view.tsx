import {useEffect, useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import './lobby-identity-view.css';

/** Reconstructed name editor; confirmed identity is owned by the account server. */
export function LobbyIdentityView({battle, visible}: {battle: Battle; visible: boolean}) {
  const [draft, setDraft] = useState('');
  const [confirmed, setConfirmed] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const composing = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    if (!visible) return;
    pending.current = true; setBusy(true);
    void battle.displayName().then(name => {
      if (generation.current !== current) return;
      setConfirmed(name); setDraft(name); setStatus('');
    }).catch(error => {
      if (generation.current === current) setStatus(String(error instanceof Error ? error.message : error));
    }).finally(() => {
      if (generation.current === current) {pending.current = false; setBusy(false);}
    });
    return () => {generation.current++; pending.current = false;};
  }, [battle, visible]);
  async function save() {
    if (!visible || pending.current || composing.current) return;
    const current = generation.current;
    pending.current = true; setBusy(true); setStatus('确认中');
    try {
      const name = await battle.displayName(draft);
      if (current !== generation.current) return;
      setConfirmed(name); setDraft(name); setStatus('昵称已保存');
      void battle.lobbyPresence.refresh();
    } catch (error) {
      if (current === generation.current) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (current === generation.current) {pending.current = false; setBusy(false);}
    }
  }
  return <form data-lobby-identity data-confirmed-name={confirmed} onSubmit={event => {
    event.preventDefault(); void save();
  }}>
    <input id="player-name" aria-label="昵称" value={draft} disabled={busy}
      onChange={event => setDraft(event.currentTarget.value)}
      onCompositionStart={() => {composing.current = true;}}
      onCompositionEnd={() => {composing.current = false;}}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
      }} onKeyUp={event => event.stopPropagation()}/>
    <button type="submit" data-lobby-name-save disabled={busy}>确认昵称</button>
    <output data-lobby-name-status role="status">{status}</output>
  </form>;
}
