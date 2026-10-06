import {useEffect, useRef, useState} from 'react';
import './room-map-selector.css';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {roomMapPage, roomMapPreviewReference} from './room-map-options';
import {sourceProps, useSourceDialog, useSourceScale, useSourceUi} from './source-react';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';

const MODES = [['rdoTeamMode', '团队'], ['rdoConquerMode', '占领'], ['rdoVIPMode', '擒王'], ['rdoMeleeMode', '混战'], ['rdoDestroyMode', '破坏']];
interface RoomMapSelectorProps {
  open: boolean; close(): void; maps: readonly MapOption[]; busy: boolean;
  initialMode: number; initialMapId: number; confirm(mode: number, mapId: number): boolean;
  closeOnConfirm?: boolean;
  originalConfirm?: boolean;
}

export function RoomMapSelector({open, close, maps, busy, initialMode, initialMapId, confirm, closeOnConfirm = true, originalConfirm = false}: RoomMapSelectorProps) {
  const [mode, setMode] = useState(initialMode), [mapId, setMapId] = useState(initialMapId);
  const [page, setPage] = useState(Math.max(0, Math.floor(maps.filter(map => map.mode === initialMode).findIndex(map => map.mapId === initialMapId) / 8)));
  const [status, setStatus] = useState('');
  const escapePending = useRef(false);
  const {ui, error} = useSourceUi(open, ['selectgamemode.xml', 'selectgamemode_icon.xml', ...(originalConfirm ? ['createroom.xml'] : [])]);
  const dialog = useSourceDialog(open), scale = useSourceScale(800, 600, 0, 0, .25, Infinity);
  useEffect(() => {
    const element = dialog.current;
    if (open && ui && !busy && element?.open && (document.activeElement === document.body || document.activeElement === element)) {
      element.querySelector<HTMLButtonElement>('[data-map-selector-close]')?.focus();
    }
  }, [open, ui, busy, dialog]);
  const state = roomMapPage(maps, mode, page, mapId);
  const layout = ui ? new HomeSourceLayout(ui, 'selectgamemode.xml') : undefined;
  const icon = ui ? new HomeSourceLayout(ui, 'selectgamemode_icon.xml') : undefined;
  const confirmation = ui && originalConfirm ? new HomeSourceLayout(ui, 'createroom.xml') : undefined;
  const accept = () => {
    if (confirm(mode, mapId)) {if (closeOnConfirm) close();}
    else setStatus('所选地图已不可用，请重新选择');
  };
  const place = (name: string, image?: string) => sourceProps(ui!, layout!, 'selectgamemode.xml', name, image);
  const button = (name: string, label: string, action: () => void, selected = false, disabled = false, data: Record<string, string> = {}) =>
    <SourceButton key={name} ui={ui!} layout={layout!} suffix="selectgamemode.xml" source={name} 
      aria-label={label} title={label} selected={selected} disabled={busy || disabled} onClick={action} {...data}/>;
  return <dialog ref={dialog} data-room-map-selector="" aria-label="选择模式与地图" onCancel={event => {
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
    <div className="map-selector-viewport" style={scale.viewport}><div className="map-selector-stage" data-map-selector-stage="" style={scale.stage}>
      <SourceImageScale value={scale.viewport.width / 800}>
      {ui && layout && icon && <>
        {['SheetWindow', 'picBackgroundMask', 'hongsexiaodi', 'quxiaoditu', 'youbiandaditu', 'xiamianfenhongtiao'].map(name =>
          <SourceStaticImage key={name} ui={ui} layout={layout} suffix="selectgamemode.xml" name={name}
            className="map-selector-picture" aria-hidden="true" />)}
        {MODES.map(([name, label], index) => button(name, label, () => {
          setMode(index + 1); setPage(0); setMapId(maps.find(map => map.mode === index + 1)?.mapId ?? 0); setStatus('');
        }, mode === index + 1, !maps.some(map => map.mode === index + 1), {'data-map-selector-mode': String(index + 1), 'aria-pressed': String(mode === index + 1)}))}
        {button('btnClose', '取消地图选择', close, false, false, {'data-map-selector-close': ''})}
        {button('btnPageUp', '上一页地图', () => setPage(state.page - 1), false, state.page === 0, {'data-map-selector-previous': ''})}
        {button('btnPageDown', '下一页地图', () => setPage(state.page + 1), false, state.page + 1 >= state.pages, {'data-map-selector-next': ''})}
        <output {...place('txtPage')} data-map-selector-page="">{`${state.pages ? state.page + 1 : 0} / ${state.pages}`}</output>
        {state.maps.map((map, index) => <button type="button" key={map.mapId} {...place(`picMap${index}`)} data-map-selector-map={map.mapId}
          className="map-selector-card" aria-label={`${map.name} ${map.sourceMinPlayers}–${map.maxPlayers}人`} aria-pressed={map.mapId === mapId}
          disabled={busy} onClick={() => {setMapId(map.mapId); setStatus('');}}>
          {['ditu', 'picMapImage', 'txtMapName'].map(name => {
            const props = sourceProps(ui, icon, 'selectgamemode_icon.xml', name, name === 'picMapImage' ? roomMapPreviewReference(map.mapId) : name === 'ditu' ? icon.control(name).properties.Image : undefined);
            return name === 'txtMapName' ? <span key={name} {...props}>{map.name}</span>
              : <SourceStaticImage key={name} ui={ui} layout={icon} suffix="selectgamemode_icon.xml" name={name}
                reference={name === 'picMapImage' ? roomMapPreviewReference(map.mapId) : undefined} aria-hidden="true" />;
          })}
        </button>)}
        {Array.from({length: 8 - state.maps.length}, (_, index) => <span key={`empty-${index}`} {...place(`picMap${state.maps.length + index}`)} aria-hidden="true"/>)}
      </>}
      </SourceImageScale>
    <div className="map-selector-toolbar" data-map-selector-web-confirm="" data-map-selector-original={originalConfirm || undefined}
      style={originalConfirm && ui && layout ? {backgroundImage: sourceProps(ui, layout, 'selectgamemode.xml', 'xiamianfenhongtiao',
        layout.control('xiamianfenhongtiao').properties.Image).style.backgroundImage} : undefined}>
      {originalConfirm ? ui && confirmation && <SourceButton ui={ui} layout={confirmation} suffix="createroom.xml" source="btnOK"
        style={{position: 'relative', left: 0, top: 0, width: 81, height: 43}} data-map-selector-confirm=""
        disabled={busy || !state.selected} aria-label="确认模式与地图" title="确认模式与地图" onClick={accept}/>
        : <button type="button" data-map-selector-confirm="" disabled={busy || !state.selected || !ui} onClick={accept}>确认模式与地图</button>}
      <output role="status">{error ? `地图选择资源载入失败：${error}；关闭后可重试` : !ui ? '正在载入地图选择…' : status || (state.selected ? `${state.selected.name} · ${state.selected.timeLimit}秒 · ${state.selected.sourceMinPlayers}–${state.selected.maxPlayers}人` : '请选择可用地图')}</output>
    </div>
    </div></div>
  </dialog>;
}
