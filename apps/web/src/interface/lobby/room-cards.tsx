import {imageResourceUrl} from '../../assets/image-cache';
import {GameMessage} from '../resources/game-message';
import './room-cards.css';
import {useContext, type ComponentPropsWithoutRef} from 'react';
import type {RoomSummary} from '../../../../shared/protocols/PtlListRooms';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {canJoinRoom, type RoomSort} from './room-directory';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceButton} from '../resources/source-button';
import {GameButton, type GameButtonShape, type GameButtonTone} from '../resources/game-button';
import {GameDialogFootbar} from '../resources/game-dialog';
import {GameRoomCard, type GameRoomCardAnimal} from '../resources/game-room-card';
import {RoomCardFactionPortrait, RoomCardModeBadge, roomCardModeName} from './room-card-artwork';
import {sourceProps, useSourceDialog, useSourceScale, useSourceUi} from './source-react';
import {LOBBY_MAIN_BOUNDS, LOBBY_ROOM_FOOTBAR} from './lobby-source-geometry';

interface RoomCardsProps {
  embedded?: boolean;
  open: boolean; close(): void; rooms: readonly RoomSummary[]; selectedId: string;
  page: number; pages: number; sort: RoomSort; busy: boolean; createEnabled: boolean;
  select(id: string): void; activate(id: string): void; changeSort(sort: RoomSort): void;
  previous(): void; next(): void; refresh(): void; join(): void; createRoom(): void; openInventory(): void; openShop(): void;
}

function RoomDirectoryButtons({props, ui, layout}: {props: RoomCardsProps; ui: HomeSourceUi; layout: HomeSourceLayout}) {
  const centerY = LOBBY_ROOM_FOOTBAR.top + LOBBY_ROOM_FOOTBAR.height / 2;
  const pageButtonStyle = {width: 22, height: 34, top: 34 * (.5 - 19.4 / 41)};
  const button = (source: string, label: string,
    attributes: ComponentPropsWithoutRef<'button'> & {[attribute: `data-${string}`]: string},
    tone: GameButtonTone = 'blue', shape: GameButtonShape = 'bevel') => {
    if (!props.embedded) return <SourceButton {...attributes} ui={ui} layout={layout}
      suffix="roomlist.xml" source={source} className="room-source-page-button"/>;
    const position = sourceProps(ui, layout, 'roomlist.xml', source);
    // The contour's center differs from the center of its 41-row SVG viewBox.
    const artworkCenterY = shape === 'bevel' ? 18.5 : 19;
    return <GameButton {...position} {...attributes}
      style={{...position.style, top: centerY - Number(position.style.height) * artworkCenterY / 41}}
      className="room-source-page-button" tone={tone} shape={shape}>{label}</GameButton>;
  };
  return <div className="room-card-pagination">
    {props.embedded && <GameDialogFootbar className="lobby-room-footbar"
      style={LOBBY_ROOM_FOOTBAR} aria-hidden="true"/>}
    {button('btnMyHome', '玩家信息', {'data-room-card-home': '', 'aria-label': '玩家信息',
      title: '玩家信息', disabled: props.busy, onClick: props.openInventory}, 'violet', 'badge')}
    {button('btnShopping', '商店', {'data-room-card-shop': '', 'aria-label': '商店',
      title: '商店', disabled: props.busy, onClick: props.openShop}, 'violet', 'arrow')}
    {button('btnCreateRoom', '开新房间', {'data-room-card-create': '', 'aria-label': '开新房间',
      title: '开新房间', disabled: props.busy || !props.createEnabled, onClick: props.createRoom})}
    {props.embedded && button('btnExpressGame', '快速进入', {'data-room-card-express': '',
      'aria-label': '加入选中房间', title: '加入选中房间', disabled: props.busy || !props.selectedId, onClick: props.join})}
    {button(props.sort === 'ID' ? 'btnSortByEmpty' : 'btnSortByID', props.sort === 'ID' ? '空房间' : '编号', {
      'data-room-card-sort': '', 'data-room-card-sort-mode': props.sort,
      'aria-label': props.sort === 'ID' ? '空房间优先排序' : '编号排序',
      title: props.sort === 'ID' ? '当前编号排序；切换为空房间优先' : '当前空房间优先；切换为编号排序',
      disabled: props.busy, onClick: () => props.changeSort(props.sort === 'ID' ? 'EMPTY' : 'ID'),
    })}
    {props.embedded ? <nav className="room-card-page-controls" aria-label="房间分页"
      style={{right: 615 - LOBBY_MAIN_BOUNDS.right, top: centerY - 20}}>
      <GameButton tone="neutral" shape="previous" style={pageButtonStyle}
        data-room-card-previous="" aria-label="上一页"
        disabled={props.busy || props.page === 0} onClick={props.previous}/>
      <output data-room-card-page="" aria-live="polite">
        {`${props.pages ? props.page + 1 : 0}/${props.pages}`}
      </output>
      <GameButton tone="neutral" shape="next" style={pageButtonStyle}
        data-room-card-next="" aria-label="下一页"
        disabled={props.busy || props.page + 1 >= props.pages} onClick={props.next}/>
    </nav> : <>
      {button('btnPageUp', '', {'data-room-card-previous': '', 'aria-label': '上一页',
        disabled: props.busy || props.page === 0, onClick: props.previous}, 'neutral', 'previous')}
      <SourceStaticText ui={ui} layout={layout} suffix="roomlist.xml" name="yeshu"
        data-room-card-page="" aria-live="polite" text={`${props.pages ? props.page + 1 : 0} / ${props.pages}`}/>
      {button('btnPageDown', '', {'data-room-card-next': '', 'aria-label': '下一页',
        disabled: props.busy || props.page + 1 >= props.pages, onClick: props.next}, 'neutral', 'next')}
    </>}
  </div>;
}

function RoomCard({room, index, ui, selected, busy, select, activate}: {
  room: RoomSummary; index: number; ui: HomeSourceUi; selected: boolean; busy: boolean; select(id: string): void; activate(id: string): void;
}) {
  const layout = new HomeSourceLayout(ui, 'roomlist_icon.xml');
  const team = room.mode <= 3, modeName = roomCardModeName(room.mode);
  const namedRoom = room.name.match(new RegExp(`^(?:(.*) · )?${modeName}模式·(.*)$`));
  const mapName = namedRoom?.[2] ?? `地图 ${room.mapId}`;
  const roomName = namedRoom ? namedRoom[1] || mapName : room.name;
  const teamCapacity = Math.ceil(room.maxPlayers / 2);
  const status = room.phase === 'LOADING' ? '载入中' : room.phase === 'FINISHED' ? '待再战'
    : room.phase === 'PLAYING' ? '对战中' : !canJoinRoom(room) ? '满员' : '';
  const factionRow = (faction: GameRoomCardAnimal, teamIndex: 0 | 1) => {
    const name = `xiaoditu${teamIndex + 1}`;
    const strip = sourceProps(ui, layout, 'roomlist_icon.xml', name, layout.control(name).properties.Image);
    const count = `${room.teamPlayerCounts?.[teamIndex] ?? '—'}/${teamCapacity}`;
    return <span className="room-card-faction-row" style={{backgroundImage: strip.style.backgroundImage}}
      aria-label={`${faction === 'dog' ? '狗队' : '猫队'} ${count}`}>
      <RoomCardFactionPortrait faction={faction}/>
      <span className="room-card-text" data-source-control={`txtTeam${teamIndex}PlayerNumber`}>{count}</span>
    </span>;
  };
  return <div className="room-card-slot" data-source-control={`picRoomIcon${index}`}>
    <GameRoomCard animal={index % 2 === 0 ? 'cat' : 'dog'} className="room-source-card"
      data-room-card-id={room.id} aria-pressed={selected}
      aria-label={`${roomName} ${modeName}模式 ${mapName} ${room.playerCount}/${room.maxPlayers} ${room.phase}${room.hasPassword ? ' 密码房' : ''}`}
      title={`${roomName} · ${modeName}模式 · ${mapName} · ${room.playerCount}/${room.maxPlayers}${status ? ` · ${status}` : ''}`}
      disabled={busy || !canJoinRoom(room)} onClick={() => select(room.id)} onDoubleClick={() => activate(room.id)}>
      <span className="room-card-content">
        <span className="room-card-heading">
          {room.hasPassword && <SourceStaticImage ui={ui} layout={layout} suffix="roomlist_icon.xml" name="picLock"
            className="room-card-lock" style={{position: 'relative', left: 0, top: 0, width: 8, height: 10}} aria-hidden="true"/>}
          <span className="room-card-name" data-source-control="txtRoomName" title={roomName}>
            <span className="room-card-name-track">
              <span>{roomName}</span><span aria-hidden="true">{roomName}</span>
            </span>
          </span>
          {status && <span className="room-card-status">{status}</span>}
        </span>
        <RoomCardModeBadge mode={room.mode}/>
        <span className="room-card-map" data-room-card-map="" title={mapName}>{mapName}</span>
        <span className="room-card-factions">
          {team ? <>{factionRow('dog', 0)}{factionRow('cat', 1)}</> : <span className="room-card-faction-row">
            <img className="room-card-player-star" src={imageResourceUrl('/ui/lobby/room-cards/star.png')} alt="" aria-hidden="true"/>
            <span className="room-card-text" data-source-control="txtPlayerNumber">{`${room.playerCount}/${room.maxPlayers}`}</span>
          </span>}
        </span>
      </span>
    </GameRoomCard>
  </div>;
}

export function RoomCards(props: RoomCardsProps) {
  const {ui, error} = useSourceUi(props.open, ['roomlist_icon.xml', 'roomlist.xml']);
  const pagination = ui ? new HomeSourceLayout(ui, 'roomlist.xml') : undefined;
  const dialog = useSourceDialog(props.open && !props.embedded), scale = useSourceScale(615, 321, 48, 160, .25, 3);
  const inheritedScale = useContext(SourceImageScale);
  const content = <>
    <div className="room-card-viewport" style={props.embedded ? {width: 615, height: 321} : scale.viewport}>
      <div data-room-card-stage="" className="room-card-stage" style={props.embedded ? undefined : scale.stage}>
      <SourceImageScale value={props.embedded ? inheritedScale : scale.viewport.width / 615}>
      {ui && pagination && !props.embedded && <SourceStaticImage ui={ui} layout={pagination} suffix="roomlist.xml" name="ditu"
        offsetY={-84} className="room-card-source-background" data-room-card-background=""/>}
      {ui && <div className="room-card-grid">
        {props.rooms.map((room, index) => <RoomCard key={room.id} room={room} index={index} ui={ui}
          selected={room.id === props.selectedId} busy={props.busy} select={props.select} activate={props.activate}/>)}
      </div>}
      {ui && pagination && <RoomDirectoryButtons props={props} ui={ui} layout={pagination}/>}
      </SourceImageScale>
    </div></div>
    {!props.embedded && <div className="room-card-toolbar">
      <button type="button" data-room-card-refresh="" onClick={props.refresh}>刷新</button>
      <button type="button" data-room-card-join="" disabled={props.busy || !props.selectedId} onClick={() => {props.close(); props.join();}}>加入所选房间</button>
      <button type="button" data-room-card-close="" onClick={props.close}>关闭</button>
    </div>}
    <GameMessage text={props.open && error ? `卡片资源载入失败：${error}；关闭后可重试` : ''} tone="error"/>
  </>;
  return props.embedded ? <section data-room-cards="" data-room-cards-embedded="" aria-label="房间列表" hidden={!props.open}>{content}</section>
    : <dialog ref={dialog} data-room-cards="" aria-label="房间卡片" onCancel={event => {event.preventDefault(); props.close();}}>{content}</dialog>;
}
