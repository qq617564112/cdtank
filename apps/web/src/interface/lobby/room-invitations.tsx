import {useLayoutEffect, useRef, useState} from 'react';
import type {MsgRoomInvitation} from '../../../../shared/protocols/MsgRoomInvitation';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {RoomPasswordDialog} from './room-password-dialog';

interface RoomInvitationsProps {
  formal?: boolean;
  messages: readonly MsgRoomInvitation[];
  ignore(id: string): void;
  join(message: MsgRoomInvitation, password: string): Promise<void>;
}
function InvitationCard({message, ignore, join}: {message: MsgRoomInvitation} & Omit<RoomInvitationsProps, 'messages'>) {
  const [password, setPassword] = useState(''), [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false), [status, setStatus] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const restorePasswordFocus = useRef(false);
  useLayoutEffect(() => {
    if (!pending && restorePasswordFocus.current) {
      restorePasswordFocus.current = false;
      passwordRef.current?.focus();
    }
  }, [pending, status]);
  async function accept() {
    if (message.expiresAt <= Date.now()) {setStatus('邀请已过期，请刷新房间列表'); setExpired(true); return;}
    setPending(true);
    try {await join(message, password);}
    catch (error) {
      setStatus(String(error));
      restorePasswordFocus.current = !!message.room.hasPassword;
    } finally {setPending(false);}
  }
  return <article data-room-invitation={message.invitationId} data-room-id={message.room.id}>
    <p>{`${message.senderName} 邀请你加入 ${message.room.name}（${message.room.playerCount}/${message.room.maxPlayers}）`}</p>
    <input ref={passwordRef} type="password" maxLength={64} aria-label="邀请房间密码" hidden={!message.room.hasPassword}
      data-invitation-password="" disabled={pending} value={password} onChange={event => setPassword(event.target.value)}/>
    <button type="button" data-invitation-accept="" disabled={pending || expired} onClick={() => {void accept();}}>加入房间</button>
    <button type="button" data-invitation-ignore="" disabled={pending} onClick={() => ignore(message.invitationId)}>忽略</button>
    <output role="status" data-invitation-status="">{status}</output>
  </article>;
}
function InvitationConfirm({message, ignore, join}: {message: MsgRoomInvitation} & Omit<RoomInvitationsProps, 'messages'>) {
  const [passwordOpen, setPasswordOpen] = useState(false), [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false), [status, setStatus] = useState('');
  function checkExpiry(): boolean {
    if (message.expiresAt > Date.now()) return true;
    setStatus('邀请已过期，请刷新房间列表'); setExpired(true);
    return false;
  }
  async function accept(): Promise<void> {
    if (pending || !checkExpiry()) return;
    if (message.room.hasPassword) {setPasswordOpen(true); return;}
    setPending(true); setStatus('');
    try {await join(message, '');}
    catch (cause) {setStatus(String(cause));}
    finally {setPending(false);}
  }
  if (passwordOpen) return <RoomPasswordDialog roomId={message.room.id} close={() => setPasswordOpen(false)}
    submit={async password => {
      if (!checkExpiry()) throw new Error('邀请已过期，请刷新房间列表');
      await join(message, password);
    }}/>;
  return <SourceConfirmView message={`${message.senderName} 邀请你加入 ${message.room.name}（${message.room.playerCount}/${message.room.maxPlayers}）`}
    pending={pending} disabled={expired} status={status} confirm={() => {void accept();}}
    cancel={() => {if (!pending) ignore(message.invitationId);}}/>;
}

export function RoomInvitations({formal, messages, ignore, join}: RoomInvitationsProps) {
  if (formal) return messages[0] ? <InvitationConfirm key={messages[0].invitationId} message={messages[0]} ignore={ignore} join={join}/> : null;
  return <section data-room-invitations="" aria-label="房间邀请" hidden={!messages.length}>
    {messages.map(message => <InvitationCard key={message.invitationId} message={message} ignore={ignore} join={join}/>)}
  </section>;
}
