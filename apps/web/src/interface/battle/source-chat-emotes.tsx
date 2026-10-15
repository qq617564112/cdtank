import {useRef, type RefObject} from 'react';
import {emoteGlyph} from './chat-emote-text';
import type {ChatSourceLayout} from './source-chat-layout';
import {ChatEmoteButton} from '../resources/chat-emote-button';
import {ImageArtwork} from '../resources/image-artwork';
import {sourceUiAsset} from '../resources/source-ui-image';

export function SourceChatEmotes({menuLayout, open, pending, composing, input, toggle, close, insert, releaseKeys}: {
  layout: ChatSourceLayout; menuLayout: ChatSourceLayout; open: boolean; pending: boolean;
  composing: RefObject<boolean>; input: RefObject<HTMLInputElement | null>;
  toggle: () => void; close: () => void; insert: (glyph: string, caret: number) => void; releaseKeys: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const bounds = menuLayout.place('all').style;
  return <>
    <ChatEmoteButton className="battle-chat-emote-toggle" data-source-control="btnExpandEmotion"
      aria-label="插入表情" aria-haspopup="menu" aria-expanded={open} disabled={pending}
      onPointerDown={event => {if (composing.current) event.preventDefault();}}
      onClick={() => {
        if (pending || composing.current) return;
        releaseKeys(); toggle();
        requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('button')?.focus());
      }}/>
    <div ref={menu} className="source-chat-emotes battle-chat-menu" data-chat-emote-menu="" hidden={!open}
      role="menu" aria-label="选择表情" onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!composing.current && !event.nativeEvent.isComposing) {close(); input.current?.focus();}
        }
      }} onKeyUp={event => event.stopPropagation()}>
      {Array.from({length: 30}, (_, index) => index + 1).map(id => {
        const name = String(id).padStart(3, '0');
        const asset = sourceUiAsset(menuLayout.ui, menuLayout.control(name).properties.Image).asset;
        const position = menuLayout.place(name, -Number(bounds.left), -Number(bounds.top));
        return <button key={id} type="button" data-chat-emote-choice={id} aria-label={`表情${name}`}
          style={position.style} role="menuitem" disabled={pending} onClick={() => {
            if (!pending && !composing.current && input.current) {
              insert(emoteGlyph(id), input.current.selectionStart ?? input.current.value.length);
              close();
            }
          }}>{asset && <ImageArtwork asset={`/${asset}`} fit="contain" aria-hidden="true"/>}</button>;
      })}
    </div>
  </>;
}
