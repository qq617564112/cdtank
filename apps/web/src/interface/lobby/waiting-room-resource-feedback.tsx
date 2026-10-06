import {SourceFeedbackText} from '../resources/source-feedback-text';
import './waiting-room-resource-feedback.css';

/** Web feedback retains a return action while the source waiting sheet is unavailable. */
export function WaitingRoomResourceFeedback({error, pending, leave}: {
  error: string; pending: boolean; leave(): void;
}) {
  return <section className="waiting-room-resource-feedback"
    data-waiting-resource-state="error"
    data-waiting-resource-error={error} data-feedback-binding="web-source-resource"
    role="status" aria-live="polite" aria-busy={pending}>
    <p><SourceFeedbackText text="等待房间暂时无法显示" /></p>
    <p><SourceFeedbackText text="界面资源未能载入，请返回大厅后重新进入。" /></p>
    <button type="button" data-waiting-resource-return="" disabled={pending} onClick={leave}>
      <SourceFeedbackText text={pending ? '正在返回…' : '返回大厅'} />
    </button>
  </section>;
}
