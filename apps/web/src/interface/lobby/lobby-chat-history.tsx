import {useLayoutEffect, useRef} from 'react';
import type {LobbyChat} from '../../network/lobby-chat';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from './source-react';
import {LobbyChatHistoryScrollbar} from './lobby-chat-history-scrollbar';
import './lobby-chat-history.css';

/** Messages remain server confirmed; React owns the source history viewport. */
export function LobbyChatHistory({ui, messages}: {
  ui?: HomeSourceUi; messages: ReturnType<LobbyChat['getSnapshot']>['messages'];
}) {
  const log = useRef<HTMLOListElement>(null);
  const layout = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  useLayoutEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  return <div className="lobby-chat-history" data-lobby-history=""
    {...(ui && layout ? sourceProps(ui, layout, 'chat.xml', 'ChatTextBox') : {})}>
    <ol ref={log} data-lobby-chat-log="" role="log" aria-label="大厅消息">
      {messages.map(message => <li key={`${message.channel}-${message.id}`} data-account-id={message.accountId}
        data-lobby-message-channel={message.channel}>{message.message}</li>)}
    </ol>
    {ui && layout && <LobbyChatHistoryScrollbar list={log} ui={ui} properties={layout.control('ChatTextBox').properties} />}
  </div>;
}
