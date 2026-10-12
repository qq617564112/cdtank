import {imageResourceUrl} from '../../assets/image-cache';
import {GameMessage} from '../resources/game-message';
import './lobby-source-page.css';
import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {SourceImageScale} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceScale, useSourceUi} from './source-react';
import {lobbyBannerUrl} from '../resources/source-ui-resources';
import {ImageArtwork} from '../resources/image-artwork';
import {GameSurfacePanel} from '../resources/game-surface-panel';
import {LOBBY_CHAT_INPUT_BOUNDS, LOBBY_MAIN_BOUNDS} from './lobby-source-geometry';

interface LobbySourcePageProps {
  visible: boolean;
  children: ReactNode;
  chatContent?: ReactNode;
  playerContent?: ReactNode;
  headerContent?: ReactNode;
  status: string;
  room?: boolean;
  roomName?: string;
}

/** The directory composes shared textured panels around the live room and chat controls. */
export function LobbySourcePage({visible, children, chatContent, playerContent, headerContent, status, room = false, roomName = ''}: LobbySourcePageProps) {
  const {ui, error, retry: retryResources} = useSourceUi(visible, ['default.xml', 'roomlist.xml', 'playerlist.xml', 'chat.xml']);
  const retry = useRef<HTMLButtonElement>(null);
  const scale = useSourceScale(800, 600, 0, 0, 0, Infinity);
  useLayoutEffect(() => {
    if (visible && error && document.activeElement === document.body) retry.current?.focus();
  }, [visible, error]);
  const rooms = ui ? new HomeSourceLayout(ui, 'roomlist.xml') : undefined;
  const players = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const chat = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  const mainBounds = {left: LOBBY_MAIN_BOUNDS.left, width: LOBBY_MAIN_BOUNDS.right - LOBBY_MAIN_BOUNDS.left};
  return <main data-lobby-page="" data-lobby-hd="" data-lobby-room={room ? '' : undefined}
    hidden={!visible} aria-label={room ? '等待房间' : '大厅'}>
    {!ui && <section className="lobby-resource-feedback" data-lobby-resource-error={error ? '' : undefined}
      data-lobby-resource-state={error ? 'error' : 'loading'} data-feedback-binding="web-source-resource"
      aria-label="大厅资源" aria-busy={!error}>
      <GameMessage text={visible && error ? '大厅界面资源未能载入' : ''} tone="error"/>
      {error && <>
        <button ref={retry} type="button" data-lobby-resource-retry="" onClick={retryResources}>重试</button>
      </>}
    </section>}
    <div className="lobby-source-viewport" style={scale.viewport}>
      <div className="lobby-source-stage" data-lobby-stage="" style={scale.stage}>
        <SourceImageScale value={scale.viewport.width / 800}>
          {ui && players && chat && <>
            {!room && <div className="lobby-source-main">
              <GameSurfacePanel {...sourceProps(ui, rooms!, 'roomlist.xml', 'ditu')} shape="rooms"
                style={{...sourceProps(ui, rooms!, 'roomlist.xml', 'ditu').style, height: 277}}
                className="lobby-room-panel" aria-hidden="true"/>
            </div>}
            {!room && <div className="lobby-game-banner" data-lobby-banner="">
              <ImageArtwork asset={lobbyBannerUrl} role="img" aria-label="欢迎回来"/>
            </div>}
            {!room && headerContent && <div className="lobby-source-header" data-lobby-header="">{headerContent}</div>}
            <div className="lobby-source-sidebar">
              {room ? ['房间', roomName].map((text, index) => {
                const plaque = sourceProps(ui, players, 'playerlist.xml', 'datingmingchengditu');
                return <div key={index} {...plaque} className="lobby-sidebar-title" data-room-plaque={index === 0 ? 'label' : 'name'}
                  style={{...plaque.style, top: index * 49, height: 48}} title={text}>
                  <img src={imageResourceUrl(index === 0 ? '/ui/lobby/hall-plaque.png' : '/ui/lobby/room-name-plaque.png')}
                    alt="" aria-hidden="true" draggable={false}/>
                  {index === 0 ? <h1>{text}</h1> : <h2>{text}</h2>}
                </div>;
              }) : <>
                <div {...sourceProps(ui, players, 'playerlist.xml', 'datingmingchengditu')}
                  className="lobby-sidebar-title">
                  <img src={imageResourceUrl('/ui/lobby/hall-plaque.png')} alt="" aria-hidden="true" draggable={false}/>
                  <h1>游戏大厅</h1>
                </div>
              </>}
              <GameSurfacePanel shape="social" className="lobby-player-panel"
                style={{left: 610, top: 97}} aria-hidden="true"/>
            </div>
            <div className="lobby-source-main">
              {!room && <>
                <div {...sourceProps(ui, chat, 'chat.xml', 'paomadengditu')}
                  className="lobby-announcement" aria-hidden="true"/>
                <div {...sourceProps(ui, chat, 'chat.xml', 'lt')}
                  style={{...sourceProps(ui, chat, 'chat.xml', 'lt').style, ...mainBounds}}
                  className="lobby-chat-surface" aria-hidden="true"/>
                <GameSurfacePanel {...sourceProps(ui, chat, 'chat.xml', 'liaotiankuangditu')}
                  style={LOBBY_CHAT_INPUT_BOUNDS}
                  shape="chat-input" className="lobby-chat-input-panel" aria-hidden="true"/>
                <GameMessage data-lobby-status="" text={visible && !room ? status : ''}/>
              </>}
            </div>
          </>}
          <div className="lobby-source-main">{chatContent}{children}</div>
          <div className="lobby-source-sidebar">{playerContent}</div>
        </SourceImageScale>
      </div>
    </div>
  </main>;
}
