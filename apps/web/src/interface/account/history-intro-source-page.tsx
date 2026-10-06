import {useLayoutEffect, useRef, useState} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HISTORY_INTRO_CONTENT} from './history-intro-content';
import './history-intro-source-page.css';
import {HistoryIntroScrollbar} from './history-intro-scrollbar';

/** Original introduction text and four mutually exclusive source radio controls. */
export function HistoryIntroSourcePage({ui, close, scale}: {
  ui: HomeSourceUi; close: () => void; scale: number;
}) {
  const [selected, setSelected] = useState(0);
  const body = useRef<HTMLTextAreaElement>(null);
  const layout = new HomeSourceLayout(ui, 'history.xml');
  useLayoutEffect(() => {
    if (body.current) {body.current.scrollTop = 0; body.current.setSelectionRange(0, 0);}
  }, [selected]);
  return <section className="history-intro-source-page" data-history-intro-page="" aria-label="阿猫阿狗介绍">
    {['all', 'ditu', 'luangan', 'ditu2'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={layout} suffix="history.xml" name={name}
        className="history-intro-picture" aria-hidden="true" />)}
    <div role="group" aria-label="介绍分类">
      {HISTORY_INTRO_CONTENT.map((page, index) =>
        <SourceButton key={page.control} ui={ui} layout={layout} suffix="history.xml" source={page.control}
          selected={selected === index} aria-pressed={selected === index} aria-label={page.label}
          data-history-intro-tab={page.control} onClick={() => setSelected(index)} />)}
    </div>
    <textarea ref={body} {...sourceProps(ui, layout, 'history.xml', 'edtMainText')}
      className="history-intro-body" data-history-intro-body=""
      data-source-string-record={HISTORY_INTRO_CONTENT[selected].recordId} aria-label={HISTORY_INTRO_CONTENT[selected].label}
      readOnly value={HISTORY_INTRO_CONTENT[selected].text} />
    <HistoryIntroScrollbar list={body} ui={ui} properties={layout.control('edtMainText').properties} scale={scale} version={selected} />
    <SourceButton ui={ui} layout={layout} suffix="history.xml" source="btnClose"
      data-history-intro-close="" aria-label="返回" onClick={close} />
  </section>;
}
