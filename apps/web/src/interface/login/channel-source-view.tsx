import {useRef} from 'react';
import type {ConnectionPing} from '../../network/game-connection';
import {DialogButton} from '../resources/dialog-button';
import {GameDialogPanel, GameDialogTitle, GameDialogTopbar} from '../resources/game-dialog';
import {GameCard} from '../resources/game-card';
import {GameInsetCard} from '../resources/game-inset-card';
import {GameSelectionHighlight} from '../resources/game-selection-highlight';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {SourceEntrySheet} from './source-entry-sheet';
import './channel-source.css';

export interface SourceChannel {
  id: string;
  name: string;
  region: string;
  levelLabel: string;
  available: boolean;
}
export interface ChannelSourceViewProps {
  busy: boolean;
  status: string;
  channels: SourceChannel[];
  ping: ConnectionPing;
  selectedId: string;
  onSelect: (id: string) => void;
  onEnter: () => void;
  onBack: () => void;
}

/** Directory rows share the textured frame and HTML labels used by the game dialogs. */
export function ChannelSourceView(props: ChannelSourceViewProps) {
  const {ui, error} = useSourceUi(true, ['lobby_select.xml']);
  const list = useRef<HTMLDivElement>(null);
  const layout = ui ? new HomeSourceLayout(ui, 'lobby_select.xml') : undefined;
  const selected = props.channels.find(channel => channel.id === props.selectedId);
  const pingLabel = !props.ping.connected ? '已断开'
    : props.ping.milliseconds === undefined ? '测量中' : `${props.ping.milliseconds} ms`;
  const focusId = selected?.available ? selected.id : props.channels.find(channel => channel.available)?.id;
  const place = (name: string) => sourceProps(ui!, layout!, 'lobby_select.xml', name);
  function focusChannel(index: number): void {
    const channel = props.channels[index];
    if (!channel?.available || props.busy) return;
    props.onSelect(channel.id);
    const button = list.current?.querySelectorAll<HTMLButtonElement>('[data-channel-id]')[index];
    button?.focus();
    button?.scrollIntoView({block: 'nearest'});
  }
  return <SourceEntrySheet page="channel" ui={ui} error={error} busy={props.busy} status={props.status}>
    {ui && layout && <>
      <GameDialogTopbar {...place('ditu2')} className="channel-topbar">
        <DialogButton kind="close" className="channel-close" aria-label="返回登录"
          disabled={props.busy} onClick={props.onBack}/>
        <GameDialogTitle as="h1">选择大厅</GameDialogTitle>
      </GameDialogTopbar>
      <GameDialogPanel {...place('ditu3')} style={{...place('ditu3').style,
        left: place('ditu2').style.left, width: place('ditu2').style.width}}
        className="channel-panel" aria-hidden="true"/>
      <GameInsetCard shape="modes" tone="walnut" insetShadow className="channel-location"
        style={{width: 493, height: 29}} aria-label="当前大厅">
        <span title={selected?.region}>{selected?.region ?? ''}</span>
        <span className="channel-location-separator" aria-hidden="true">&gt;&gt;&gt;</span>
        <span title={selected?.levelLabel}>{selected?.levelLabel ?? ''}</span>
        <span className="channel-location-separator" aria-hidden="true">&gt;&gt;&gt;</span>
        <span title={selected?.name}>{selected?.name ?? ''}</span>
      </GameInsetCard>
      <GameCard {...place('ditu4')} shape="chat" tone="sand" className="channel-card"
        style={{...place('ditu4').style, width: 722, height: 456}} aria-hidden="true"/>
      <div className="channel-columns" aria-hidden="true">
        {['大厅', '阶级限制', '状态', 'Ping'].map(label => <span key={label}>{label}</span>)}
      </div>
      <div ref={list} {...place('lstLobbyServer')} className="source-channel-list channel-list"
        style={{...place('lstLobbyServer').style, top: 136, width: 680, height: 367}}
        role="listbox" aria-label="大厅" aria-busy={props.busy}>
        {props.channels.map((channel, index) => <button key={channel.id} type="button" role="option"
          data-channel-id={channel.id} aria-selected={props.selectedId === channel.id}
          tabIndex={channel.id === focusId ? 0 : -1}
          title={`${channel.name} · ${channel.levelLabel} · ${channel.available ? '可进入' : '不可进入'} · Ping ${pingLabel}`}
          disabled={props.busy || !channel.available} onClick={() => props.onSelect(channel.id)}
          onDoubleClick={() => {if (props.selectedId === channel.id) props.onEnter();}}
          onKeyDown={event => {
            const available = props.channels.map((entry, row) => entry.available ? row : -1).filter(row => row >= 0);
            const position = available.indexOf(index);
            const next = event.key === 'ArrowDown' ? available[Math.min(position + 1, available.length - 1)]
              : event.key === 'ArrowUp' ? available[Math.max(position - 1, 0)]
              : event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1) : undefined;
            if (next !== undefined) {event.preventDefault(); focusChannel(next);}
            if (event.key === 'Enter') {
              event.preventDefault();
              if (props.selectedId === channel.id) props.onEnter();
              else props.onSelect(channel.id);
            }
          }}>
          {props.selectedId === channel.id && <GameSelectionHighlight className="channel-selection"/>}
          {[channel.name, channel.levelLabel, channel.available ? '可进入' : '不可进入', pingLabel].map((text, column) =>
            <span key={column} className="channel-cell">{text}</span>)}
        </button>)}
        {props.channels.length === 0 && <p className="channel-empty">暂无可用大厅</p>}
      </div>
      <DialogButton kind="back" className="channel-back" aria-label="回上页，返回登录"
        disabled={props.busy} onClick={props.onBack}>回上页</DialogButton>
    </>}
  </SourceEntrySheet>;
}
