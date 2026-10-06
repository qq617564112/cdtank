import './lobby-source-page.css';
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from './source-react';

const lobbyLogoUrl = new URL('../../assets/ui/lobby-logo.png', import.meta.url).href;

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

/** The original 800×600 lobby sheet contains the directory, player list and chat regions. */
export function LobbySourcePage({visible, children, chatContent, playerContent, headerContent, status, room = false, roomName = ''}: LobbySourcePageProps) {
  const {ui, error} = useSourceUi(visible, ['default.xml', 'roomlist.xml', 'playerlist.xml', 'chat.xml']);
  const retry = useRef<HTMLButtonElement>(null);
  const calculate = () => Math.min(innerWidth / 800, innerHeight / 600);
  const [scale, setScale] = useState(calculate);
  useEffect(() => {
    const resize = () => setScale(calculate());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    if (visible && error && document.activeElement === document.body) retry.current?.focus();
  }, [visible, error]);
  const background = ui ? new HomeSourceLayout(ui, 'default.xml') : undefined;
  const players = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const chat = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  return <main data-lobby-page="" hidden={!visible} aria-label="大厅">
    {!ui && <section className="lobby-resource-feedback" data-lobby-resource-error={error ? '' : undefined}
      data-lobby-resource-state={error ? 'error' : 'loading'} data-feedback-binding="web-source-resource"
      aria-label="大厅资源" aria-busy={!error}>
      <p role="status" aria-live="polite">{error ? '大厅界面资源未能载入' : '正在载入大厅界面…'}</p>
      {error && <>
        <button ref={retry} type="button" data-lobby-resource-retry="" onClick={() => location.reload()}>重新加载</button>
      </>}
    </section>}
    <div className="lobby-source-viewport" style={{width: 800 * scale, height: 600 * scale}}>
      <div className="lobby-source-stage" data-lobby-stage="" style={{transform: `scale(${scale})`}}>
        <SourceImageScale value={scale}>
          {ui && background && players && chat && <>
            <SourceStaticImage ui={ui} layout={background} suffix="default.xml" name="picMainBackground"
              data-lobby-background="" className="lobby-source-picture"/>
            {!room && <img src={lobbyLogoUrl} className="lobby-game-logo" data-lobby-logo=""
              alt="阿猫阿狗大作战" draggable={false}/>}
            {!room && headerContent && <div className="lobby-source-header" data-lobby-header="">{headerContent}</div>}
            <SourceStaticImage ui={ui} layout={players} suffix="playerlist.xml" name="haoyou"
              className="lobby-source-picture" data-lobby-player-panel=""/>
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
            {['lt', 'liaotiankuangditu', 'paomadengditu'].map(name =>
              <SourceStaticImage key={name} ui={ui} layout={chat} suffix="chat.xml" name={name}
                className="lobby-source-picture"/>) }
            <output {...sourceProps(ui, chat, 'chat.xml', 'Advertisement')} data-lobby-status=""
              className="lobby-source-status" aria-live="polite">{status}</output>
          </>}
          {chatContent}
          {playerContent}
          {children}
        </SourceImageScale>
      </div>
    </div>
  </main>;
}
