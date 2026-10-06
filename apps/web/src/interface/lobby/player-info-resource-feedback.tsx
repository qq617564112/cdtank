import {SourceFeedbackText} from '../resources/source-feedback-text';
import './player-info-resource-feedback.css';

/** Web resource feedback keeps the existing player-sheet Close action available. */
export function PlayerInfoResourceFeedback({close}: {close(): void}) {
  return <section className="player-info-resource-feedback" data-player-info-resource-state="error"
    data-feedback-binding="web-source-resource" role="status" aria-live="polite">
    <p><SourceFeedbackText text="玩家资料暂时无法显示" /></p>
    <p><SourceFeedbackText text="界面资源未能载入，请关闭后重新打开。" /></p>
    <button type="button" data-player-info-close="" autoFocus onClick={close}>
      <SourceFeedbackText text="关闭" />
    </button>
  </section>;
}
