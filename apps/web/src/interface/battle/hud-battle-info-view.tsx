import './hud-battle-info-view.css';
import {useLayoutEffect, useRef, useState} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {ChatEmotes} from './chat-emotes';
import {parseChatSourceMarkup} from './chat-source-markup';
import type {SourceUi} from './battle-hud';

/** edtBattleInfo shares the original RichEditbox text/image layout with chat. */
export function HudBattleInfoView({ui, text, label = '战斗信息'}: {
  ui: SourceUi | HomeSourceUi; text: string; label?: string;
}) {
  const log = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [renderer] = useState(() => new ChatEmotes());
  useLayoutEffect(() => {
    renderer.setSourceLayout(true, log.current!);
    renderer.load(ui as HomeSourceUi);
    return () => renderer.clear();
  }, [renderer, ui]);
  useLayoutEffect(() => {
    const leaf = row.current!;
    const markup = parseChatSourceMarkup(text).status === 'parse-error'
      ? text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') : text;
    renderer.render(leaf, markup);
    const latest = () => {if (log.current) log.current.scrollTop = log.current.scrollHeight;};
    latest();
    const frame = requestAnimationFrame(latest);
    return () => {cancelAnimationFrame(frame); renderer.remove(leaf);};
  }, [renderer, ui, text]);
  return <div ref={log} className="hud-battle-info-log" role="log" aria-label={label}>
    <div ref={row} data-battle-info-text={text} />
  </div>;
}
