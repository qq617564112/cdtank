import type {SyntheticEvent} from 'react';
import type {PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {GameRoomActionButton} from '../resources/game-room-action-button';
import {sourceProps} from '../resources/source-ui-props';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';

interface WaitingRoomSlotActionsProps {
  ui: HomeSourceUi;
  layout: HomeSourceLayout;
  index: number;
  player: PlayerSnapshot;
  disabled: boolean;
  pending: boolean;
  canKick: boolean;
  details(): void;
  kick(): void;
  onFocus(event: SyntheticEvent<HTMLButtonElement>): void;
}

export function WaitingRoomSlotActions({ui, layout, index, player, disabled, pending, canKick, details, kick, onFocus}: WaitingRoomSlotActionsProps) {
  return <div {...sourceProps(ui, layout, 'room_main.xml', `PlayerPanel${index}`)}
    className="waiting-room-slot-actions" role="group" aria-label={`${player.name}的操作`} tabIndex={0}
    data-waiting-slot-actions={player.id}>
    <div className="waiting-room-slot-mask">
      {!player.isCpu && <GameRoomActionButton variant="details" disabled={disabled} onFocus={onFocus}
        aria-busy={pending || undefined}
        data-waiting-control={`details${player.id}`} data-waiting-player-details={player.id}
        aria-label={`查看${player.name}详情`} onClick={details}>详情</GameRoomActionButton>}
      <GameRoomActionButton variant="kick" disabled={disabled || !canKick} onFocus={onFocus}
        aria-busy={pending && canKick || undefined}
        data-waiting-control={`kick${player.id}`} data-waiting-kick={player.id}
        aria-label={`踢出${player.name}`} title={canKick ? `踢出${player.name}` : '只有房主可以踢出其他成员'}
        onClick={kick}>踢出</GameRoomActionButton>
    </div>
  </div>;
}
