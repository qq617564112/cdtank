import {useEffect, useState} from 'react';
import type {Battle} from '../../match/battle';

/** Read the transport's heartbeat sample only while the directory is visible. */
export function useChannelPing(battle: Battle, active: boolean) {
  const [ping, setPing] = useState(() => battle.ping);
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      const next = battle.ping;
      setPing(current => current.connected === next.connected && current.milliseconds === next.milliseconds
        ? current : next);
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [battle, active]);
  return ping;
}
