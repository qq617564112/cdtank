import {DialogButton} from '../resources/dialog-button';
import {GameMessage} from '../resources/game-message';
import './home-resource-feedback.css';

/** Web resource feedback remains available before the original sheet can load. */
export function HomeResourceFeedback({error, close, closeAttribute}: {
  error?: string; close: () => void;
  closeAttribute: 'data-home-close' | 'data-roles-close' | 'data-equipment-close';
}) {
  return <section className="home-resource-feedback" data-home-resource-state={error ? 'error' : 'loading'}
    data-home-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    aria-busy={!error}>
    <GameMessage text={error ? '我的家暂时无法显示，请返回大厅后重新打开。' : ''} tone="error"/>
    <DialogButton type="button" {...{[closeAttribute]: ''}} onClick={close}>
      返回大厅
    </DialogButton>
  </section>;
}
