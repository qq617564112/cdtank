import type {RefObject} from 'react';
import {GameScrollbar} from '../resources/game-scrollbar';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Waiting chat shares the dog thumb and SVG arrows within its original history bounds. */
export function WaitingChatHistoryScrollbar({list, ui}: {
  list: RefObject<HTMLOListElement | null>; ui: HomeSourceUi;
}) {
  const layout = new HomeSourceLayout(ui, 'chat.xml');
  const bounds = sourceProps(ui, layout, 'chat.xml', 'ChatTextBox', undefined, 0, -402);
  return <GameScrollbar list={list} step={16} label="等待房间聊天历史"
    className="waiting-chat-history-scrollbar" data-waiting-chat-history-scrollbar=""
    style={{left: Number(bounds.style.left) + Number(bounds.style.width) - 28,
      top: bounds.style.top, width: 28, height: bounds.style.height}}/>;
}
