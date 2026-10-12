import {GameMessage} from '../resources/game-message';
import {useEffect, useRef, useState} from 'react';
import './room-map-selector.css';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {roomMapPage, roomMapPreviewReference} from './room-map-options';
import {sourceProps, useSourceDialog, useSourceScale, useSourceUi} from './source-react';
import {GameDialog, GameDialogTopbar, GameDialogPanel, GameDialogFootbar} from '../resources/game-dialog';
import {DialogButton} from '../resources/dialog-button';
import {GameButton} from '../resources/game-button';
import {GameModeTab} from '../resources/game-mode-tab';
import {GameMapCard} from '../resources/game-map-card';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {useNavigationChoice, useNavigationNumber} from '../../navigation/route';

const MODES = [
  ['rdoTeamMode', 1], ['rdoConquerMode', 2], ['rdoVIPMode', 3],
  ['rdoMeleeMode', 4], ['rdoDestroyMode', 5],
] as const;
interface RoomMapSelectorProps {
  open: boolean; close(): void; maps: readonly MapOption[]; busy: boolean;
  initialMode: number; initialMapId: number; confirm(mode: number, mapId: number): boolean;
  closeOnConfirm?: boolean;
}

export function RoomMapSelector({open, close, maps, busy, initialMode, initialMapId, confirm, closeOnConfirm = true}: RoomMapSelectorProps) {
  const prefix = closeOnConfirm ? 'createMap' : 'editMap';
  const [modeValue, setModeValue] = useNavigationChoice(`${prefix}Mode`, ['1', '2', '3', '4', '5'], String(initialMode) as '1' | '2' | '3' | '4' | '5', true);
  const mode = Number(modeValue);
  const setMode = (value: number): void => setModeValue(String(value) as '1' | '2' | '3' | '4' | '5');
  const [pageValue, setPage] = useNavigationNumber(`${prefix}Page`, true);
  const page = pageValue ?? Math.max(0, Math.floor(maps.filter(map => map.mode === mode).findIndex(map => map.mapId === initialMapId) / 8));
  const [status, setStatus] = useState('');
  const escapePending = useRef(false);
  const {ui, error} = useSourceUi(open, ['selectgamemode.xml', 'selectgamemode_icon.xml']);
  const dialog = useSourceDialog(open);
  const uiScale = useSourceScale(800, 600, 0, 0, .25, Infinity).viewport.width / 800;
  useEffect(() => {
    const element = dialog.current;
    if (open && ui && !busy && element?.open && (document.activeElement === document.body || document.activeElement === element)) {
      element.querySelector<HTMLButtonElement>('[data-map-selector-close]')?.focus();
    }
  }, [open, ui, busy, dialog]);
  const state = roomMapPage(maps, mode, page, 0);
  const layout = ui ? new HomeSourceLayout(ui, 'selectgamemode.xml') : undefined;
  const icon = ui ? new HomeSourceLayout(ui, 'selectgamemode_icon.xml') : undefined;
  const accept = (mapId: number) => {
    setStatus('');
    if (confirm(mode, mapId)) {if (closeOnConfirm) close();}
    else setStatus('所选地图已不可用，请重新选择');
  };
  const origin = ui && layout
    ? sourceProps(ui, layout, 'selectgamemode.xml', 'SheetWindow').style : undefined;
  const place = (name: string) => sourceProps(ui!, layout!, 'selectgamemode.xml', name,
    undefined, -Number(origin!.left), -Number(origin!.top));
  return <GameDialog ref={dialog} width={674} height={435} uiScale={uiScale}
    stageClassName="map-selector-stage" data-room-map-selector="" aria-label="选择模式与地图"
    aria-busy={busy || !ui} onCancel={event => {
    event.preventDefault(); close();
  }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') {event.preventDefault(); if (!event.nativeEvent.isComposing && event.keyCode !== 229) escapePending.current = true;}
  }} onKeyUp={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && escapePending.current) {
      escapePending.current = false;
      if (!event.nativeEvent.isComposing) close();
    }
  }}>
    <SourceImageScale value={uiScale}>
      <GameDialogTopbar className="map-selector-topbar" aria-hidden="true"/>
      <GameDialogPanel className="map-selector-panel" tone="room-canvas" aria-hidden="true"/>
      <DialogButton kind="close" className="map-selector-close" data-map-selector-close=""
        aria-label="取消地图选择" title="取消地图选择" disabled={busy} onClick={close}/>
      <GameDialogFootbar className="map-selector-footer">
        <GameButton tone="cyan" shape="previous" data-map-selector-previous=""
          aria-label="上一页地图" title="上一页地图" style={{left: 2, top: 5, width: 26, height: 37}}
          disabled={busy || state.page === 0} onClick={() => setPage(state.page - 1)}/>
        <output data-map-selector-page="" aria-live="polite">
          {`${state.pages ? state.page + 1 : 0} / ${state.pages}`}
        </output>
        <GameButton tone="cyan" shape="next" data-map-selector-next=""
          aria-label="下一页地图" title="下一页地图" style={{right: 2, top: 5, width: 26, height: 37}}
          disabled={busy || state.page + 1 >= state.pages} onClick={() => setPage(state.page + 1)}/>
      </GameDialogFootbar>
      {ui && layout && icon && <>
        {MODES.map(([name, value]) => <GameModeTab key={name} {...place(name)}
          className="map-selector-mode" mode={value} selected={mode === value}
          data-map-selector-mode={value} disabled={busy || !maps.some(map => map.mode === value)}
          onClick={() => {setMode(value); setPage(0); setStatus('');}}/>)}
        {state.maps.map((map, index) => <GameMapCard key={map.mapId} {...place(`picMap${index}`)}
          className="map-selector-card" name={map.name} data-map-selector-map={map.mapId}
          aria-label={`${map.name} ${map.sourceMinPlayers}–${map.maxPlayers}人`}
          disabled={busy} onClick={() => accept(map.mapId)}
          thumbnail={<SourceStaticImage ui={ui} layout={icon} suffix="selectgamemode_icon.xml"
            name="picMapImage" offsetX={-7} offsetY={-12}
            reference={roomMapPreviewReference(map.mapId)} aria-hidden="true"/>}/>)}
      </>}
    </SourceImageScale>
    <GameMessage text={!open ? '' : error ? `地图选择资源载入失败：${error}；关闭后可重试` : status} tone="error"/>
  </GameDialog>;
}
