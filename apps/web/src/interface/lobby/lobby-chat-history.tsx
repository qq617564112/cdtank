import {useLayoutEffect, useRef, useState} from 'react';
import type {LobbyChat} from '../../network/lobby-chat';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from './source-react';
import {LobbyChatHistoryScrollbar} from './lobby-chat-history-scrollbar';
import {ChatEmotes} from '../battle/chat-emotes';
import './lobby-chat-history.css';

/** Messages remain server confirmed; React owns the source history viewport. */
export function LobbyChatHistory({ui, messages}: {
  ui?: HomeSourceUi; messages: ReturnType<LobbyChat['getSnapshot']>['messages'];
}) {
  const log = useRef<HTMLOListElement>(null);
  const [renderer] = useState(() => new ChatEmotes());
  const layout = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  useLayoutEffect(() => {if (ui) renderer.load(ui);}, [renderer, ui]);
  useLayoutEffect(() => () => renderer.clear(), [renderer]);
  useLayoutEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, ui]);
  return <div className="lobby-chat-history" data-lobby-history=""
    {...(ui && layout ? sourceProps(ui, layout, 'chat.xml', 'ChatTextBox') : {})}>
    <ol ref={log} data-lobby-chat-log="" role="log" aria-label="大厅消息">
      {messages.map(message => <LobbyChatMessage key={`${message.channel}-${message.id}`}
        renderer={renderer} message={message} />)}
    </ol>
    {ui && layout && <LobbyChatHistoryScrollbar list={log} ui={ui} properties={layout.control('ChatTextBox').properties} />}
  </div>;
}

function LobbyChatMessage({renderer, message}: {
  renderer: ChatEmotes; message: ReturnType<LobbyChat['getSnapshot']>['messages'][number];
}) {
  const element = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const row = element.current!;
    renderer.render(row, message.message);
    return () => renderer.remove(row);
  }, [renderer, message.message]);
  return <li ref={element} data-account-id={message.accountId} data-lobby-message-channel={message.channel} />;
}
