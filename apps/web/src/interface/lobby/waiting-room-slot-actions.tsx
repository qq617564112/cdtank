import type {SyntheticEvent} from 'react';
import type {PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

interface WaitingRoomSlotActionsProps {
  ui: HomeSourceUi;
  layout: HomeSourceLayout;
  index: number;
  player: PlayerSnapshot;
  disabled: boolean;
  canKick: boolean;
  details(): void;
  kick(): void;
  onFocus(event: SyntheticEvent<HTMLButtonElement>): void;
}

export function WaitingRoomSlotActions({ui, layout, index, player, disabled, canKick, details, kick, onFocus}: WaitingRoomSlotActionsProps) {
  const plaqueLayout = new HomeSourceLayout(ui, 'playerlist.xml');
  const plaque = sourceProps(ui, plaqueLayout, 'playerlist.xml', 'datingmingchengditu',
    plaqueLayout.control('datingmingchengditu').properties.Image);
  const buttonStyle = {backgroundImage: plaque.style.backgroundImage};
  return <div {...sourceProps(ui, layout, 'room_main.xml', `PlayerPanel${index}`)}
    className="waiting-room-slot-actions" role="group" aria-label={`${player.name}的操作`} tabIndex={0}
    data-waiting-slot-actions={player.id}>
    <div className="waiting-room-slot-mask">
      {!player.isCpu && <button type="button" style={buttonStyle} disabled={disabled} onFocus={onFocus}
        data-waiting-control={`details${player.id}`} data-waiting-player-details={player.id}
        aria-label={`查看${player.name}详情`} onClick={details}><SourceFeedbackText text="详情"/></button>}
      <button type="button" style={buttonStyle} disabled={disabled || !canKick} onFocus={onFocus}
        data-waiting-control={`kick${player.id}`} data-waiting-kick={player.id}
        aria-label={`踢出${player.name}`} title={canKick ? `踢出${player.name}` : '只有房主可以踢出其他成员'}
        onClick={kick}><SourceFeedbackText text="踢出"/></button>
    </div>
  </div>;
}
