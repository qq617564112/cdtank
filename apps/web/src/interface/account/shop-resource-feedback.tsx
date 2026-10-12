import {DialogButton} from '../resources/dialog-button';
import {GameMessage} from '../resources/game-message';
import './shop-resource-feedback.css';

/** Web feedback and Return remain available while source resources are unavailable. */
export function ShopResourceFeedback({error, pending, close}: {
  error?: string; pending: boolean; close(): void;
}) {
  return <section className="shop-resource-feedback" data-shop-resource-state={error ? 'error' : 'loading'}
    data-shop-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    aria-busy={!error}>
    <GameMessage text={error ? '商城暂时无法显示，请返回大厅后重新打开。' : ''} tone="error"/>
    <DialogButton type="button" data-shop-close="" disabled={pending} onClick={close}>
      返回大厅
    </DialogButton>
  </section>;
}
