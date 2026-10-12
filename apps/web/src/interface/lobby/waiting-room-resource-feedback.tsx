import {DialogButton} from '../resources/dialog-button';
import {GameMessage} from '../resources/game-message';
import './waiting-room-resource-feedback.css';

/** Web feedback retains a return action while the source waiting sheet is unavailable. */
export function WaitingRoomResourceFeedback({error, pending, leave}: {
  error: string; pending: boolean; leave(): void;
}) {
  return <section className="waiting-room-resource-feedback"
    data-waiting-resource-state="error"
    data-waiting-resource-error={error} data-feedback-binding="web-source-resource"
    aria-busy={pending}>
    <GameMessage text={error} tone="error"/>
    <DialogButton type="button" data-waiting-resource-return="" disabled={pending} onClick={leave}>
      {pending ? '正在返回…' : '返回大厅'}
    </DialogButton>
  </section>;
}
