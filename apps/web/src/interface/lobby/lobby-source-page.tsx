import './lobby-source-page.css';
import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from './source-react';
import {lobbyBannerUrl} from '../resources/source-ui-resources';
import {imageResourceUrl} from '../../assets/image-cache';

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

/** Both lobby layouts share the same header, skyline and panel artwork. */
export function LobbySourcePage({visible, children, chatContent, playerContent, headerContent, status, room = false, roomName = ''}: LobbySourcePageProps) {
  const {ui, error, retry: retryResources} = useSourceUi(visible, ['default.xml', 'roomlist.xml', 'playerlist.xml', 'chat.xml']);
  const retry = useRef<HTMLButtonElement>(null);
  const calculate = () => {
    const width = innerWidth / innerHeight >= 1.55 ? 600 * 16 / 9 : 800;
    return {width, scale: Math.min(innerWidth / width, innerHeight / 600)};
  };
  const [{width, scale}, setViewport] = useState(calculate);
  useEffect(() => {
    const resize = () => setViewport(calculate());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    if (visible && error && document.activeElement === document.body) retry.current?.focus();
  }, [visible, error]);
  const players = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const chat = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  return <main data-lobby-page="" hidden={!visible} aria-label="大厅">
    {!ui && <section className="lobby-resource-feedback" data-lobby-resource-error={error ? '' : undefined}
      data-lobby-resource-state={error ? 'error' : 'loading'} data-feedback-binding="web-source-resource"
      aria-label="大厅资源" aria-busy={!error}>
      <p role="status" aria-live="polite">{error ? '大厅界面资源未能载入' : '正在载入大厅界面…'}</p>
      {error && <>
        <button ref={retry} type="button" data-lobby-resource-retry="" onClick={retryResources}>重试</button>
      </>}
    </section>}
    <div className="lobby-source-viewport" style={{width: width * scale, height: 600 * scale}}>
      <div className="lobby-source-stage" data-lobby-stage="" style={{width, transform: `scale(${scale})`, '--lobby-width-extension': `${width - 800}px`} as CSSProperties}>
        <SourceImageScale value={scale}>
          {ui && players && chat && <>
            <img src={imageResourceUrl(`/hd-ui/lobby/background-${width > 800 ? '16-9' : '4-3'}.png`)}
              data-lobby-background="" className="lobby-hd-background" alt="" draggable={false}/>
            {!room && <img src={imageResourceUrl('/hd-ui/lobby/room-board.png')} className="lobby-hd-room-board"
              data-lobby-room-board="" alt="" draggable={false}/>}
            {!room && <div className="lobby-game-banner" data-lobby-banner="">
              <img src={imageResourceUrl(lobbyBannerUrl)} alt="阿猫阿狗大作战，游戏免费" draggable={false}/>
            </div>}
            {!room && headerContent && <div className="lobby-source-header" data-lobby-header="">{headerContent}</div>}
            <div className="lobby-source-sidebar">
              <img src={imageResourceUrl('/hd-ui/lobby/player-panel.png')} className="lobby-hd-player-panel"
                data-lobby-player-panel="" alt="" draggable={false}/>
              {room ? ['房间', roomName].map((text, index) => {
                const plaque = sourceProps(ui, players, 'playerlist.xml', 'datingmingchengditu',
                  players.control('datingmingchengditu').properties.Image);
                return <span key={index} {...plaque} className="lobby-room-plaque" data-room-plaque={index === 0 ? 'label' : 'name'}
                  style={{...plaque.style, top: index * 49, height: 48}} title={text}>
                  <SourceImageScale value={1}><SourceStaticText ui={ui} layout={players} suffix="playerlist.xml" name="datingmingcheng"
                    style={{left: 10, top: 0, width: 166, height: 48}} text={text}/></SourceImageScale>
                </span>;
              }) : <>
                <SourceStaticImage ui={ui} layout={players} suffix="playerlist.xml" name="datingmingchengditu"
                  className="lobby-source-picture"/>
                <SourceImageScale value={1}><SourceStaticText ui={ui} layout={players} suffix="playerlist.xml" name="datingmingcheng"
                  className="lobby-source-title" style={{top: 60, height: 30}} text="大厅"/></SourceImageScale>
              </>}
            </div>
            <div className="lobby-source-main">
              {['lt', 'liaotiankuangditu', 'paomadengditu'].map(name =>
                <SourceStaticImage key={name} ui={ui} layout={chat} suffix="chat.xml" name={name}
                  className="lobby-source-picture"/>) }
              <output {...sourceProps(ui, chat, 'chat.xml', 'Advertisement')} data-lobby-status=""
                className="lobby-source-status" aria-live="polite">{status}</output>
            </div>
          </>}
          <div className="lobby-source-main">{chatContent}{children}</div>
          <div className="lobby-source-sidebar">{playerContent}</div>
        </SourceImageScale>
      </div>
    </div>
  </main>;
}
