import {useEffect, useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import type {ResChannel} from '../../../../shared/protocols/PtlChannel';
import {navigateGame, readGameRoute, useGameRoute} from '../../navigation/route';
import {readLoginSession, saveLoginSession, saveRoomSession} from '../../navigation/session';
import {readQuickStart} from '../../navigation/quick-start';
import {useChannelPing} from './use-channel-ping';

/** React owns page transitions; Battle keeps the single authenticated connection. */
export function useLoginNavigation(battle: Battle, validation: boolean) {
  const route = useGameRoute();
  const [phase, setPhase] = useState<'login' | 'channel' | 'lobby' | 'closed'>(validation ? 'lobby' : route.page === 'closed' ? 'closed' : 'login');
  const ping = useChannelPing(battle, phase === 'channel');
  const [restoring, setRestoring] = useState(() => !validation && battle.hasSavedIdentity && !!readLoginSession()
    && location.pathname.replace(/\/$/, '') !== '/login' && route.page !== 'closed');
  const [busy, setBusy] = useState(restoring), [status, setStatus] = useState('');
  const [savedAccount, setSavedAccount] = useState(() => localStorage.getItem('cdtank-login-account') ?? '');
  const [saveAccount, setSaveAccount] = useState(() => localStorage.getItem('cdtank-login-save-account') === 'true');
  const [channels, setChannels] = useState<ResChannel['channels']>([]);
  const [selectedId, setSelectedId] = useState('');
  const operating = useRef(false);
  const quickStart = useRef(readQuickStart());
  useEffect(() => {
    if (validation) return;
    if (!restoring) {
      if (route.page !== 'closed') navigateGame('/login', true);
      return;
    }
    let active = true;
    let restored = false;
    const requested = readGameRoute();
    const saved = readLoginSession();
    void perform(async () => {
      const identity = await battle.authenticate();
      const directory = await battle.channels();
      if (!active) return;
      setChannels(directory.channels);
      const cachedChannel = saved?.accountId === identity.accountId ? saved.channelId : undefined;
      const channelId = directory.channels.find(channel => channel.id === cachedChannel && channel.available)?.id
        ?? directory.channels.find(channel => channel.available)?.id ?? '';
      setSelectedId(channelId);
      if (requested.page === 'channels' || (!cachedChannel && requested.page === 'login')) {
        saveLoginSession({accountId: identity.accountId});
        setPhase('channel');
        navigateGame('/channels', true);
        restored = true;
        return;
      }
      const entered = await battle.channels(channelId);
      if (entered.enteredChannelId !== channelId) throw new Error('未能恢复原频道');
      saveLoginSession({accountId: identity.accountId, channelId});
      const resumed = quickStart.current ? false : await battle.resumeSavedRoom();
      if (!active) return;
      setPhase('lobby');
      restored = true;
      if (!resumed) navigateGame('/lobby', true);
    }).finally(() => {
      if (!active) return;
      setRestoring(false);
      if (!restored) navigateGame('/login', true);
    });
    return () => {active = false;};
  }, [battle, validation]);

  useEffect(() => {
    if (validation || restoring || busy || battle.inRoom) return;
    if (route.page === 'login' && phase !== 'login') back();
    else if (route.page === 'closed' && phase !== 'closed') exit();
    else if (battle.accountContext.identity) {
      if (route.page === 'channels') setPhase('channel');
      else if (route.page === 'lobby' || route.roomId) setPhase('lobby');
    } else if (phase === 'login' && route.page !== 'login') navigateGame('/login', true);
  }, [route.page, route.roomId, phase, busy, restoring, battle, validation]);
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
      saveLoginSession({accountId: identity.accountId});
      // Authentication success remains usable when a directory request needs a retry.
      setPhase('channel');
      navigateGame('/channels', false, true);
      const directory = await battle.channels();
      setChannels(directory.channels);
      setSelectedId(directory.channels.find(channel => channel.available)?.id ?? '');
    });
  }
  function enter(): void {
    void perform(async () => {
      const directory = await battle.channels(selectedId);
      if (directory.enteredChannelId !== selectedId) throw new Error('未能进入所选频道');
      const accountId = battle.accountContext.identity?.accountId;
      if (accountId) saveLoginSession({accountId, channelId: selectedId});
      if (!quickStart.current) await battle.resumeSavedRoom();
      setPhase('lobby');
      if (!battle.inRoom) navigateGame('/lobby');
    });
  }
  function back(): void {
    void perform(async () => {
      await battle.disconnectAccount();
      saveLoginSession(); saveRoomSession();
      setChannels([]); setSelectedId(''); setPhase('login');
      navigateGame('/login', false, true);
    });
  }
  function exit(): void {
    void perform(async () => {
      await battle.disconnectAccount();
      saveLoginSession(); saveRoomSession();
      setChannels([]); setSelectedId(''); setPhase('closed');
      navigateGame('/closed', false, true);
    });
  }
  return {phase, busy, restoring, status, savedAccount, saveAccount, setSaveAccount, channels, ping, selectedId, setSelectedId,
    hasSavedIdentity: battle.hasSavedIdentity, login: (account: string, password: string) => authenticate(account, password),
    register: (account: string, password: string) => authenticate(account, password, true), enter, back, exit,
    reopen: () => {setStatus(''); setPhase('login'); navigateGame('/login', false, true);}};
}
