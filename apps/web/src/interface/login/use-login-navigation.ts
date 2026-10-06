import {useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import type {ResChannel} from '../../../../shared/protocols/PtlChannel';

/** React owns page transitions; Battle keeps the single authenticated connection. */
export function useLoginNavigation(battle: Battle, validation: boolean) {
  const [phase, setPhase] = useState<'login' | 'channel' | 'lobby' | 'closed'>(validation ? 'lobby' : 'login');
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [savedAccount, setSavedAccount] = useState(() => localStorage.getItem('cdtank-login-account') ?? '');
  const [saveAccount, setSaveAccount] = useState(() => localStorage.getItem('cdtank-login-save-account') === 'true');
  const [channels, setChannels] = useState<ResChannel['channels']>([]);
  const [selectedId, setSelectedId] = useState('');
  const operating = useRef(false);
  async function perform(operation: () => Promise<void>): Promise<void> {
    if (operating.current) return;
    operating.current = true; setBusy(true); setStatus('');
    try {await operation();}
    catch (error) {setStatus(error instanceof Error ? error.message : String(error));}
    finally {operating.current = false; setBusy(false);}
  }
  function authenticate(account: string, password: string, register = false): void {
    void perform(async () => {
      const name = account.trim();
      const restore = !register && !password && name === savedAccount;
      const identity = await battle.authenticate(restore || (!register && !name && !password) ? undefined
        : {operation: register ? 'REGISTER' : 'LOGIN', account: name, password});
      const remembered = saveAccount ? identity.accountName ?? '' : '';
      localStorage.setItem('cdtank-login-account', remembered);
      localStorage.setItem('cdtank-login-save-account', String(saveAccount));
      setSavedAccount(remembered);
      // Authentication success remains usable when a directory request needs a retry.
      setPhase('channel');
      const directory = await battle.channels();
      setChannels(directory.channels);
      setSelectedId(directory.channels.find(channel => channel.available)?.id ?? '');
    });
  }
  function enter(): void {
    void perform(async () => {
      const directory = await battle.channels(selectedId);
      if (directory.enteredChannelId !== selectedId) throw new Error('未能进入所选频道');
      setPhase('lobby');
    });
  }
  function back(): void {
    void perform(async () => {
      await battle.disconnectAccount();
      setChannels([]); setSelectedId(''); setPhase('login');
    });
  }
  function exit(): void {
    void perform(async () => {
      await battle.disconnectAccount();
      setChannels([]); setSelectedId(''); setPhase('closed');
    });
  }
  return {phase, busy, status, savedAccount, saveAccount, setSaveAccount, channels, selectedId, setSelectedId,
    hasSavedIdentity: battle.hasSavedIdentity, login: (account: string, password: string) => authenticate(account, password),
    register: (account: string, password: string) => authenticate(account, password, true), enter, back, exit,
    reopen: () => {setStatus(''); setPhase('login');}};
}
