import {SourceButton} from '../resources/source-button';
import {useRef} from 'react';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from '../lobby/source-react';
import {SourceEntryPictures, SourceEntrySheet, SourceEntryText} from './source-entry-sheet';

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
  selectedId: string;
  onSelect: (id: string) => void;
  onEnter: () => void;
  onBack: () => void;
  onExit: () => void;
}

/** Confirmed deployment rows populate the original lobby selection sheet. */
export function ChannelSourceView(props: ChannelSourceViewProps) {
  const {ui, error} = useSourceUi(true, ['lobby_select.xml']);
  const list = useRef<HTMLDivElement>(null);
  const layout = ui ? new HomeSourceLayout(ui, 'lobby_select.xml') : undefined;
  const selected = props.channels.find(channel => channel.id === props.selectedId);
  const focusId = selected?.available ? selected.id : props.channels.find(channel => channel.available)?.id;
  const selection = ui && layout ? sourceProps(ui, layout, 'lobby_select.xml', 'lstLobbyServer',
    layout.control('lstLobbyServer').properties.SelectionImage) : undefined;
  const columns = ui && layout ? ['dating', 'jiejixianzhi', 'zhuangtai', 'ping'].map(name => {
    const header = sourceProps(ui, layout, 'lobby_select.xml', name);
    return Number(header.style.left) + Number(header.style.width) / 2 - Number(selection!.style.left);
  }) : [];
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
      <SourceEntryPictures ui={ui} layout={layout} suffix="lobby_select.xml" dynamicText={['txtRegion', 'txtLevel', 'txtLobby']}/>
      <div ref={list} {...sourceProps(ui, layout, 'lobby_select.xml', 'lstLobbyServer')} className="source-channel-list"
        role="listbox" aria-label="频道" aria-busy={props.busy}>
        {props.channels.map((channel, index) => <button key={channel.id} type="button" role="option"
          data-channel-id={channel.id} aria-selected={props.selectedId === channel.id}
          tabIndex={channel.id === focusId ? 0 : -1}
          title={`${channel.name} · ${channel.levelLabel} · ${channel.available ? '可进入' : '不可进入'}`}
          style={props.selectedId === channel.id ? {backgroundImage: selection?.style.backgroundImage} : undefined}
          data-source-selection-asset={props.selectedId === channel.id ? selection?.['data-source-asset'] : undefined}
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
          {[channel.name, channel.levelLabel, channel.available ? '可进入' : '不可进入'].map((text, column) =>
            <span key={column} className="source-channel-cell" style={{left: columns[column],
              width: Math.min(column === 0 ? columns[column] * 2 : columns[column] - columns[column - 1],
                columns[column + 1] - columns[column])}}>
              <SourceFeedbackText text={text}/>
            </span>)}
        </button>)}
        {props.channels.length === 0 && <SourceFeedbackText text="暂无可用频道"/>}
      </div>
      <SourceEntryText ui={ui} layout={layout} suffix="lobby_select.xml" name="txtRegion" text={selected?.region ?? ''}/>
      <SourceEntryText ui={ui} layout={layout} suffix="lobby_select.xml" name="txtLevel" text={selected?.levelLabel ?? ''}/>
      <SourceEntryText ui={ui} layout={layout} suffix="lobby_select.xml" name="txtLobby" text={selected?.name ?? ''}/>
      <SourceButton ui={ui} layout={layout} suffix="lobby_select.xml" source="btnBack" aria-label="返回登录"
        disabled={props.busy} onClick={props.onBack}/>
      <SourceButton ui={ui} layout={layout} suffix="lobby_select.xml" source="btnClose" aria-label="退出"
        disabled={props.busy} onClick={props.onExit}/>
    </>}
  </SourceEntrySheet>;
}
