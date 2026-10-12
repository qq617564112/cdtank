import {GameMessage} from '../resources/game-message';
import {DialogButton} from '../resources/dialog-button';
import './player-info-resource-feedback.css';

/** Web resource feedback keeps the existing player-sheet Close action available. */
export function PlayerInfoResourceFeedback({close}: {close(): void}) {
  return <section className="player-info-resource-feedback" data-player-info-resource-state="error"
    data-feedback-binding="web-source-resource">
    <GameMessage text="玩家资料界面资源未能载入，请关闭后重新打开。" tone="error"/>
    <DialogButton data-player-info-close="" autoFocus onClick={close}>关闭</DialogButton>
  </section>;
}
