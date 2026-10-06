import {SourceFeedbackText} from '../resources/source-feedback-text';
import './shop-resource-feedback.css';

/** Web feedback and Return remain available while source resources are unavailable. */
export function ShopResourceFeedback({error, pending, close}: {
  error?: string; pending: boolean; close(): void;
}) {
  return <section className="shop-resource-feedback" data-shop-resource-state={error ? 'error' : 'loading'}
    data-shop-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    role="status" aria-live="polite" aria-busy={!error}>
    <p><SourceFeedbackText text={error ? '商城暂时无法显示' : '正在载入商城…'} /></p>
    {error && <p><SourceFeedbackText text="请返回大厅后重新打开。" /></p>}
    <button type="button" data-shop-close="" disabled={pending} onClick={close}>
      <SourceFeedbackText text="返回大厅" />
    </button>
  </section>;
}
