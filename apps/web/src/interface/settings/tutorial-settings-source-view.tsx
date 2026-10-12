import {DialogButton} from '../resources/dialog-button';
import {GameMessage} from '../resources/game-message';
import './tutorial-settings-source.css';
import {useEffect, useRef, useState} from 'react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {GameArtworkButton} from '../resources/game-artwork-button';
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
      aria-busy={!error}>
      <GameMessage text={error ? '顶栏暂时无法显示' : ''} tone="error"/>
      {error && <DialogButton ref={retryButton} type="button" data-tutorial-settings-retry="" onClick={retry}>重试</DialogButton>}
    </section>;
  }
  const layout = new HomeSourceLayout(ui, TUTORIAL_SETTINGS_LAYOUT);
  const frame = sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'SheetWindow');
  return <div ref={bar} {...frame} className="tutorial-settings-bar" data-tutorial-settings-bar="">
    <GameArtworkButton {...sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'btnTutorial')} kind="tutorial"
      className="tutorial-settings-button" data-tutorial-first="" aria-label="查看教学说明" title="查看教学说明"
      onClick={() => {window.open(TUTORIAL_LINK, '_blank', 'noopener');}}>教学说明</GameArtworkButton>
    <GameArtworkButton {...sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'btnSettings')} kind="settings"
      className="tutorial-settings-button" aria-label="系统设定" title="系统设定" onClick={onSettings}>系统设定</GameArtworkButton>
    <GameArtworkButton {...sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'btnClose')} kind="return"
      className="tutorial-settings-button" aria-label="返回登录" title="返回登录" onClick={onExit}/>
  </div>;
}
