import {useState} from 'react';
import {LoadingPage} from '../resources/loading-page';

/** Original loading artwork; the bright word is clipped to completed loading work. */
export function BattleLoadingPage({round, progress, status, error, feedback, loadedPlayers, totalPlayers, pending, retry}: {
  round: number; progress: number; status: string; error?: string; loadedPlayers: number;
  totalPlayers: number; pending: boolean; feedback?: string; retry?: () => void;
}) {
  const [background] = useState(() => 1 + Math.floor(Math.random() * 5));
  const fraction = Math.max(0, Math.min(1, progress));
  const message = error || feedback || `${status}${fraction === 1 ? `（${loadedPlayers}/${totalPlayers} 人）` : ''}`;
  return <LoadingPage data-match-panel="" data-phase="LOADING" data-round={round} data-battle-loading=""
    className="battle-loading-page" aria-label="正在载入对局" aria-busy={!error}
    background={background} progress={progress} status={message}
    actions={error && retry && <button type="button" disabled={pending} onClick={retry}>重新载入</button>}/>;
}
