import type {ReactNode} from 'react';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {useSourceScale} from '../lobby/source-react';
import './source-entry.css';

export function SourceEntrySheet({page, ui, error, busy, status, children}: {
  page: 'login' | 'channel'; ui?: HomeSourceUi; error: string; busy: boolean;
  status: string; children: ReactNode;
}) {
  const scale = useSourceScale(800, 600, 0, 0, 0, Infinity);
  return <main className="source-entry" data-entry-page={page} aria-label={page === 'login' ? '登录' : '频道选择'} aria-busy={busy}>
    <div className="source-entry-viewport" style={scale.viewport}>
      <div className="source-entry-stage" style={scale.stage}>
        <SourceImageScale value={scale.viewport.width / 800}>{children}</SourceImageScale>
        <output className={`source-entry-status source-entry-status-${page}`} role="status" aria-live="polite">
          <SourceFeedbackText text={error ? '界面资源载入失败，请重新打开页面。' : !ui ? '正在载入界面…' : status}/>
        </output>
      </div>
    </div>
  </main>;
}

export function SourceEntryPictures({ui, layout, suffix, dynamicText = []}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; suffix: string; dynamicText?: string[];
}) {
  const controls = ui.layouts.find(item => item.path.endsWith(suffix))!.windows;
  return <>{controls.filter(control => control.type === 'WindowsLook/StaticImage' && control.name !== 'all')
    .map(control => <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix}
      name={control.name} reference={control.properties.Image || control.properties.BackgroundImage}
      className="source-entry-picture" aria-hidden="true"/>)}
    {controls.filter(control => control.type === 'WindowsLook/StaticText' && !dynamicText.includes(control.name))
      .map(control => <SourceEntryText key={control.name} ui={ui} layout={layout} suffix={suffix}
        name={control.name} text={control.properties.Text ?? ''}/>)}</>;
}

/** Source text bounds and colour remain independent of the directory producer. */
export function SourceEntryText({ui, layout, suffix, name, text}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; suffix: string; name: string; text: string;
}) {
  const bounds = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  const colour = properties.TextColours?.match(/tl:([\dA-Fa-f]{8})/)?.[1];
  return <span {...bounds} className="source-entry-text" style={{...bounds.style,
    justifyContent: properties.HorzFormatting === 'RightAligned' ? 'flex-end'
      : properties.HorzFormatting === 'HorzCentred' ? 'center' : 'flex-start',
    alignItems: properties.VertFormatting === 'TopAligned' ? 'flex-start'
      : properties.VertFormatting === 'BottomAligned' ? 'flex-end' : 'center'}}>
    <SourceFeedbackText text={text} colour={colour ? `#${colour.slice(2)}${colour.slice(0, 2)}` : '#fff'}/>
  </span>;
}
