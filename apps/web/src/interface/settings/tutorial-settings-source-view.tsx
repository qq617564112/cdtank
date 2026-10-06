import './tutorial-settings-source.css';
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
  const {ui} = useSourceUi(true, [TUTORIAL_SETTINGS_LAYOUT]);
  if (!ui) return null;
  const layout = new HomeSourceLayout(ui, TUTORIAL_SETTINGS_LAYOUT);
  const frame = sourceProps(ui, layout, TUTORIAL_SETTINGS_LAYOUT, 'SheetWindow');
  return <div {...frame} className="tutorial-settings-bar" data-tutorial-settings-bar="">
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnTutorial"
      className="tutorial-settings-button" aria-label="查看教学说明" title="查看教学说明"
      onClick={() => {window.open(TUTORIAL_LINK, '_blank', 'noopener');}}/>
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnSettings"
      className="tutorial-settings-button" aria-label="系统设置" title="系统设置" onClick={onSettings}/>
    <SourceButton ui={ui} layout={layout} suffix={TUTORIAL_SETTINGS_LAYOUT} source="btnClose"
      className="tutorial-settings-button" aria-label="退出游戏" title="退出游戏" onClick={onExit}/>
  </div>;
}
