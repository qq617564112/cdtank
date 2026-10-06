import {SourceFeedbackText} from '../resources/source-feedback-text';
import './settings-resource-feedback.css';

/** Web feedback keeps the existing Return available during source loading. */
export function SettingsResourceFeedback({error, close}: {
  error?: string; close(): void;
}) {
  return <section className="settings-resource-feedback" data-settings-resource-state={error ? 'error' : 'loading'}
    data-settings-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    role="status" aria-live="polite" aria-busy={!error}>
    <p><SourceFeedbackText text={error ? '设置暂时无法显示' : '正在载入设置…'} /></p>
    {error && <p><SourceFeedbackText text="请返回后重新打开。" /></p>}
    <button type="button" data-settings-resource-return="" onClick={close}>
      <SourceFeedbackText text="返回" />
    </button>
  </section>;
}
