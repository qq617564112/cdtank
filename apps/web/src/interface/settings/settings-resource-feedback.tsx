import {DialogButton} from '../resources/dialog-button';
import {GameMessage} from '../resources/game-message';
import './settings-resource-feedback.css';

/** Web feedback keeps the existing Return available during source loading. */
export function SettingsResourceFeedback({error, close, retry}: {
  error?: string; close(): void; retry(): void;
}) {
  return <section className="settings-resource-feedback" data-settings-resource-state={error ? 'error' : 'loading'}
    data-settings-resource-error={error || undefined} data-feedback-binding="web-source-resource"
    aria-busy={!error}>
    <GameMessage text={error} tone="error"/>
    {error && <>
      <DialogButton type="button" data-settings-resource-retry="" onClick={retry}>
        重试
      </DialogButton>
    </>}
    <DialogButton type="button" data-settings-resource-return="" onClick={close}>
      返回
    </DialogButton>
  </section>;
}
