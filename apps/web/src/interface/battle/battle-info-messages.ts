import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';

export function battleInfoText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const red = (text: string | number): string =>
  `<colour red=255 green=0 blue=0 alpha=255>${battleInfoText(String(text))}</colour>`;

/** Source gamestring583..586/591; only authoritative confirmations produce notices. */
export function battleInfoMessages(event: MsgRoomEvent, snapshot: MsgRoomSnapshot | undefined,
  localId: string): string[] {
  if (event.type === 'destroy' && snapshot) {
    const local = snapshot.players.find(player => player.id === localId);
    const killer = snapshot.players.find(player => player.id === event.playerId);
    const victim = snapshot.players.find(player => player.id === event.targetId);
    if (!killer || !victim) return [battleInfoText(event.message)];
    const name = (player: PlayerSnapshot): string => {
      const friend = (snapshot.mode ?? 1) <= 3 ? player.team === local?.team : player.id === localId;
      return `<colour red=${friend ? 0 : 255} green=0 blue=${friend ? 255 : 0} alpha=255>${battleInfoText(player.name)}</colour>`;
    };
    const messages: string[] = [];
    if (killer.id === localId) {
      if ((event.killCombo ?? 0) > 1 && local?.alive) {
        messages.push(`你连续击毁${red(event.killCombo!)}辆坦克，好厉害哦！`);
      }
      if (event.destroyScore !== undefined) {
        messages.push(`你击毁${red(victim.name)}，获得${red(event.destroyScore)}积分。`);
      }
    }
    messages.push(`${name(killer)}击毁${name(victim)}。`);
    return messages;
  }
  if (event.type === 'itemUsed' || event.type === 'ammoSelected') {
    if (event.playerId !== localId || !event.itemName) return [];
    return [event.type === 'itemUsed' ? `你使用了${red(event.itemName)}。`
      : `你将炮弹更换成${red(event.itemName)}。`];
  }
  if (event.type === 'groundItemPickedUp') {
    if (event.playerId !== localId) return [];
    const quantity = event.groundItemPickedUp?.quantity;
    return event.itemName
      ? [`你拾取了${red(event.itemName)}${quantity !== undefined ? ` × ${red(quantity)}` : ''}。`]
      : [battleInfoText(event.message)];
  }
  if (event.type === 'itemRejected') {
    return event.playerId === localId ? [battleInfoText(event.message)] : [];
  }
  if (event.type === 'chat') return [event.message];
  return ['finish', 'leave', 'friendlyFire'].includes(event.type)
    ? [battleInfoText(event.message)] : [];
}
