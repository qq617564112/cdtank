import './tutorial-settings-source.css';
import {useEffect, useRef, useState} from 'react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {sourceProps, useSourceUi} from '../lobby/source-react';

export const TUTORIAL_SETTINGS_LAYOUT = 'tut_settings.xml';
/** linkstring LinkID 4, the original tutorial button target. */
export const TUTORIAL_LINK = 'http://cdtank.joypark.com.cn/Guide/Key.htm';

export interface TutorialSettingsBarProps {
  onSettings: () => void;
  onExit: () => void;
}

/** The original tut_settings.xml top bar, shown only on the lobby directory. */
export function TutorialSettingsBar({onSettings, onExit}: TutorialSettingsBarProps) {
  const [attempt, setAttempt] = useState(0);
  return <TutorialSettingsSession key={attempt} onSettings={onSettings} onExit={onExit}
    retried={attempt > 0} retry={() => setAttempt(value => value + 1)}/>;
}

/** One prepare attempt; a retry remounts this consumer so the source resource flow reruns. */
function TutorialSettingsSession({onSettings, onExit, retried, retry}: TutorialSettingsBarProps & {
  retried: boolean; retry(): void;
}) {
  const {ui, error} = useSourceUi(true, [TUTORIAL_SETTINGS_LAYOUT]);
  const bar = useRef<HTMLDivElement>(null), retryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ui && error) retryButton.current?.focus();
  }, [ui, error]);
  useEffect(() => {
    if (ui && retried) bar.current?.querySelector<HTMLButtonElement>('[data-tutorial-first]')?.focus();
  }, [ui, retried]);
  if (!ui) {
    return <section className="tutorial-settings-feedback"
      data-tutorial-settings-state={error ? 'error' : 'loading'}
      data-tutorial-settings-error={error || undefined} data-feedback-binding="web-source-resource"
      role="status" aria-live="polite" aria-busy={!error}>
      <p>{error ? '顶栏暂时无法显示' : '正在载入顶栏…'}</p>
      {error && <button ref={retryButton} type="button" data-tutorial-settings-retry="" onClick={retry}>重试</button>}
    </section>;
  }
  const layout = new HomeSourceLayout(ui, TUTORIAL_SETTINGS_LAYOUT);
  const frame = sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'SheetWindow');
  return <div ref={bar} {...frame} className="tutorial-settings-bar" data-tutorial-settings-bar="">
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnTutorial"
      className="tutorial-settings-button" data-tutorial-first="" aria-label="查看教学说明" title="查看教学说明"
      onClick={() => {window.open(TUTORIAL_LINK, '_blank', 'noopener');}}/>
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnSettings"
      className="tutorial-settings-button" aria-label="系统设置" title="系统设置" onClick={onSettings}/>
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnClose"
      className="tutorial-settings-button" aria-label="返回登录" title="返回登录" onClick={onExit}/>
  </div>;
}
