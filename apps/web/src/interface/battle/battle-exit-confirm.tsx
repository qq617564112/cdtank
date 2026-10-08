import {useEffect, useRef, useState} from 'react';
import type {LeavePenalty} from '../../../../shared/protocols/PtlLeave';
import {SourceConfirmView} from '../dialogs/source-confirm-view';

interface FrozenPenalty extends LeavePenalty {roomId: string; round: number;}

/** Source gamestring829/593 confirms the authoritative departure quote. */
export function useBattleExitConfirm(roomId: string, round: number, busy: boolean, canLeave: boolean,
    quote: () => Promise<LeavePenalty>, leave: (confirmedPenaltyPoints?: number) => Promise<void>) {
  const [quoteState, setQuoteState] = useState<FrozenPenalty>();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const roundRef = useRef(round);
  const roomRef = useRef(roomId);
  const canLeaveRef = useRef(canLeave);
  useEffect(() => {
    roundRef.current = round;
    roomRef.current = roomId;
    canLeaveRef.current = canLeave;
    setQuoteState(current => current?.roomId === roomId && current.round === round && canLeave
      ? current : undefined);
  }, [roomId, round, canLeave]);
  const requestLeave = () => {
    if (busy || pending || !canLeave) return;
    const requestedRoom = roomId;
    const requestedRound = round;
    setQuoteState(undefined);
    setStatus('');
    setPending(true);
    void quote().then(penalty => {
      if (roomRef.current === requestedRoom && roundRef.current === requestedRound && canLeaveRef.current) {
        setQuoteState({...penalty, roomId: requestedRoom, round: requestedRound});
      }
    }).catch(error => {
      if (roomRef.current === requestedRoom && roundRef.current === requestedRound) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }).finally(() => setPending(false));
  };
  const confirm = async () => {
    const confirmed = quoteState;
    if (busy || pending || !canLeave || !confirmed
        || confirmed.roomId !== roomId || confirmed.round !== round) return;
    setPending(true);
    setStatus('');
    try {
      await leave(confirmed.points);
      setQuoteState(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      if (!message.includes('积分已变化')) return;
      if (roomRef.current !== confirmed.roomId || roundRef.current !== confirmed.round
          || !canLeaveRef.current) {
        setQuoteState(undefined);
        return;
      }
      try {
        const refreshed = await quote();
        if (roomRef.current === confirmed.roomId && roundRef.current === confirmed.round && canLeaveRef.current) {
          setQuoteState({...refreshed, roomId: confirmed.roomId, round: confirmed.round});
          setStatus(`${message}；处罚已刷新为扣除 ${refreshed.points} 积分，请重新确认`);
        } else {
          setQuoteState(undefined);
        }
      } catch (refreshError) {
        setStatus(refreshError instanceof Error ? refreshError.message : String(refreshError));
        setQuoteState(undefined);
      }
    } finally {
      setPending(false);
    }
  };
  const confirmation = quoteState?.roomId === roomId && quoteState.round === round && canLeave ? <SourceConfirmView
    label="退出战场" binding="web-battle-leave"
    message={quoteState.count > 7
      ? `现在退出会扣除${quoteState.points}积分作为处罚，仍然要退出吗？`
      : '你真的要从战场中退出吗？'}
    confirmLabel="退出战场" cancelLabel="继续战斗" messageLabel="退出确认"
    pending={busy || pending} disabled={!canLeave} status={status} confirm={() => {void confirm();}}
    cancel={() => {if (!busy && !pending) {setQuoteState(undefined); setStatus('');}}} /> : null;
  return {requestLeave, confirmation, pending, status};
}
