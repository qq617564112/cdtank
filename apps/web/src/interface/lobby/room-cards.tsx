import {SourceFeedbackText} from '../resources/source-feedback-text';
import './room-cards.css';
import {useContext} from 'react';
import type {RoomSummary} from '../../../../shared/protocols/PtlListRooms';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {canJoinRoom, type RoomSort} from './room-directory';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {roomModeIconReference} from './room-mode-icons';
import {SourceButton} from '../resources/source-button';
import {sourceProps, useSourceDialog, useSourceScale, useSourceUi} from './source-react';

interface RoomCardsProps {
  embedded?: boolean;
  open: boolean; close(): void; rooms: readonly RoomSummary[]; selectedId: string;
  page: number; pages: number; sort: RoomSort; busy: boolean; createEnabled: boolean;
  select(id: string): void; activate(id: string): void; changeSort(sort: RoomSort): void;
  previous(): void; next(): void; refresh(): void; join(): void; createRoom(): void; openInventory(): void; openShop(): void;
}
const MODE_NAMES = ['团队', '占领', '擒王', '混战', '破坏'];

function RoomCard({room, index, ui, selected, busy, select, activate}: {
  room: RoomSummary; index: number; ui: HomeSourceUi; selected: boolean; busy: boolean; select(id: string): void; activate(id: string): void;
}) {
  const grid = new HomeSourceLayout(ui, 'roomlist.xml'), layout = new HomeSourceLayout(ui, 'roomlist_icon.xml');
  const child = (name: string, text?: string, shown = true, reference?: string) => {
    const control = layout.control(name);
    const props = sourceProps(ui, layout, 'roomlist_icon.xml', name,
      reference ?? (text === undefined ? control.properties.Image : undefined));
    if ((name === 'maomao' || name === 'gougou') && control.parent && control.properties.ClippedByParent !== 'False') {
      const parent = sourceProps(ui, layout, 'roomlist_icon.xml', control.parent).style;
      const left = Number(props.style.left), top = Number(props.style.top);
      const width = Number(props.style.width), height = Number(props.style.height);
      const parentLeft = Number(parent.left), parentTop = Number(parent.top);
      const insets = [Math.max(0, parentTop - top), Math.max(0, left + width - parentLeft - Number(parent.width)),
        Math.max(0, top + height - parentTop - Number(parent.height)), Math.max(0, parentLeft - left)];
      props.style = {...props.style, clipPath: `inset(${insets.map(value => `${value}px`).join(' ')})`};
    }
    return <span key={name} hidden={!shown} {...props}>{text}</span>;
  };
  const text = (name: string, value: string, shown = true) => <SourceImageScale key={name} value={1}><SourceStaticText ui={ui} layout={layout}
    suffix="roomlist_icon.xml" name={name} text={value} hidden={!shown} title={value}/></SourceImageScale>;
  const team = room.mode <= 3, modeName = MODE_NAMES[room.mode - 1] ?? String(room.mode);
  const modeProps = sourceProps(ui, layout, 'roomlist_icon.xml', 'picGameMode', roomModeIconReference(room.mode));
  return <div className="room-card-slot" {...sourceProps(ui, grid, 'roomlist.xml', `picRoomIcon${index}`, undefined, 0, 0, true)}>
    <SourceButton ui={ui} layout={layout} suffix="roomlist_icon.xml" source="btnRoom" className="room-source-card"
      selected={selected} data-room-card-id={room.id} aria-pressed={selected}
      aria-label={`${room.id} ${room.name} ${room.playerCount}/${room.maxPlayers} ${room.phase}${room.hasPassword ? ' 密码房' : ''}`}
      title={`${modeName} · ${room.playerCount}/${room.maxPlayers} · ${room.phase}`} disabled={busy || !canJoinRoom(room)} onClick={() => select(room.id)} onDoubleClick={() => activate(room.id)}>
      {text('txtRoomID', room.id)}{text('txtRoomName', room.name)}
      <span {...modeProps} title={modeName} aria-label={modeName}>{modeProps['data-source-asset'] ? undefined : modeName}</span>
      {child('picModeNormal', undefined, team)}{child('xiaoditu1', undefined, team)}{child('xiaoditu2', undefined, team)}
      {child('maomao', undefined, team)}{child('gougou', undefined, team)}
      {text('txtTeam0PlayerNumber', room.teamPlayerCounts ? String(room.teamPlayerCounts[0]) : '—', team)}
      {text('txtTeam1PlayerNumber', room.teamPlayerCounts ? String(room.teamPlayerCounts[1]) : '—', team)}
      {child('picModeMelee', undefined, !team)}{child('xiang', undefined, !team)}{text('txtPlayerNumber', String(room.playerCount), !team)}
      {child('picLock', undefined, !!room.hasPassword)}{child('picStarted', undefined, room.phase === 'PLAYING')}
      <span className="room-card-capacity"><SourceFeedbackText text={`${room.playerCount}/${room.maxPlayers}${room.phase === 'FINISHED' ? ' 待再战' : !canJoinRoom(room) && room.phase !== 'PLAYING' ? ' 满员' : ''}`} /></span>
    </SourceButton>
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
      {ui && pagination && <SourceStaticImage ui={ui} layout={pagination} suffix="roomlist.xml" name="ditu"
        offsetY={-84} className="room-card-source-background" data-room-card-background=""/>}
      {ui && props.rooms.map((room, index) => <RoomCard key={room.id} room={room} index={index} ui={ui}
        selected={room.id === props.selectedId} busy={props.busy} select={props.select} activate={props.activate}/>)}
      {ui && pagination && <div className="room-card-pagination">
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnMyHome" className="room-source-page-button"
          data-room-card-home="" aria-label="我的家" title="我的家" disabled={props.busy} onClick={props.openInventory}/>
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnShopping" className="room-source-page-button"
          data-room-card-shop="" aria-label="逛街购物" title="逛街购物" disabled={props.busy} onClick={props.openShop}/>
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnCreateRoom" className="room-source-page-button"
          data-room-card-create="" aria-label="开新房间" title="开新房间"
          disabled={props.busy || !props.createEnabled} onClick={props.createRoom}/>
        {props.embedded && <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnExpressGame"
          className="room-source-page-button" data-room-card-express="" aria-label="加入选中房间" title="加入选中房间"
          disabled={props.busy || !props.selectedId} onClick={props.join}/>}
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml"
          source={props.sort === 'ID' ? 'btnSortByEmpty' : 'btnSortByID'} className="room-source-page-button"
          data-room-card-sort="" data-room-card-sort-mode={props.sort}
          aria-label={props.sort === 'ID' ? '空房间优先排序' : '编号排序'}
          title={props.sort === 'ID' ? '当前编号排序；切换为空房间优先' : '当前空房间优先；切换为编号排序'}
          disabled={props.busy} onClick={() => props.changeSort(props.sort === 'ID' ? 'EMPTY' : 'ID')}/>
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnPageUp" className="room-source-page-button"
          data-room-card-previous="" aria-label="上一页" disabled={props.busy || props.page === 0} onClick={props.previous}/>
        <SourceStaticText ui={ui} layout={pagination} suffix="roomlist.xml" name="yeshu"
          data-room-card-page="" aria-live="polite" text={`${props.pages ? props.page + 1 : 0} / ${props.pages}`}/>
        <SourceButton ui={ui} layout={pagination} suffix="roomlist.xml" source="btnPageDown" className="room-source-page-button"
          data-room-card-next="" aria-label="下一页" disabled={props.busy || props.page + 1 >= props.pages} onClick={props.next}/>
      </div>}
      </SourceImageScale>
    </div></div>
    {!props.embedded && <div className="room-card-toolbar">
      <button type="button" data-room-card-refresh="" onClick={props.refresh}>刷新</button>
      <button type="button" data-room-card-join="" disabled={props.busy || !props.selectedId} onClick={() => {props.close(); props.join();}}>加入所选房间</button>
      <button type="button" data-room-card-close="" onClick={props.close}>关闭</button>
    </div>}
    <output role="status">{error ? `卡片资源载入失败：${error}；关闭后可重试` : !ui && props.open ? '正在载入房间卡片…' : ''}</output>
  </>;
  return props.embedded ? <section data-room-cards="" data-room-cards-embedded="" aria-label="房间列表" hidden={!props.open}>{content}</section>
    : <dialog ref={dialog} data-room-cards="" aria-label="房间卡片" onCancel={event => {event.preventDefault(); props.close();}}>{content}</dialog>;
}
