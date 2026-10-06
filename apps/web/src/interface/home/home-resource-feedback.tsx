import {SourceFeedbackText} from '../resources/source-feedback-text';
import './home-resource-feedback.css';

/** Web resource feedback remains available before the original sheet can load. */
export function HomeResourceFeedback({error, close, closeAttribute}: {
  error?: string; close: () => void;
  closeAttribute: 'data-home-close' | 'data-roles-close' | 'data-equipment-close';
}) {
  return <section className="home-resource-feedback" data-home-resource-state={error ? 'error' : 'loading'}
    data-home-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    role="status" aria-live="polite" aria-busy={!error}>
    <p><SourceFeedbackText text={error ? '我的家暂时无法显示' : '正在载入我的家…'} /></p>
    {error && <p><SourceFeedbackText text="请返回大厅后重新打开。" /></p>}
    <button type="button" {...{[closeAttribute]: ''}} onClick={close}>
      <SourceFeedbackText text="返回大厅" />
    </button>
  </section>;
}
