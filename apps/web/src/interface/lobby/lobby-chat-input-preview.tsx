import {useLayoutEffect, useRef, type RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {sourceUiImage} from '../resources/source-ui-image';
import {EMOTE_COUNT, EMOTE_FIRST_CODEPOINT} from '../battle/chat-emote-text';
import './lobby-chat-input-preview.css';

/** The native input owns editing; its preview replaces source emotion glyphs. */
export function LobbyChatInputPreview({input, ui, value, control}: {
  input: RefObject<HTMLInputElement | null>; ui: HomeSourceUi; value: string; control: string;
}) {
  const viewport = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const active = /[\u2581-\u259e]/.test(value);
  useLayoutEffect(() => {
    const editor = input.current, view = viewport.current, line = content.current;
    if (!editor || !view || !line || !active) return;
    const computed = getComputedStyle(editor);
    Object.assign(view.style, {
      left: `${editor.offsetLeft}px`, top: `${editor.offsetTop}px`,
      width: `${editor.clientWidth}px`, height: `${editor.clientHeight}px`,
      color: computed.color, fontFamily: computed.fontFamily, fontSize: computed.fontSize,
      fontWeight: computed.fontWeight, fontStyle: computed.fontStyle,
      letterSpacing: computed.letterSpacing,
    });
    const fragment = document.createDocumentFragment();
    let text = '';
    for (const glyph of value) {
      const id = glyph.charCodeAt(0) - EMOTE_FIRST_CODEPOINT + 1;
      if (id < 1 || id > EMOTE_COUNT) {text += glyph; continue;}
      if (text) {fragment.append(document.createTextNode(text)); text = '';}
      const name = String(id).padStart(3, '0');
      const image = sourceUiImage(ui, `set:biaoqingfuhao0 image:data\\ui\\biaoqingfuhao\\${name}.tga`);
      const emote = document.createElement('span');
      emote.className = 'lobby-chat-input-emote';
      emote.dataset.chatInputEmote = String(id);
      emote.dataset.sourceAsset = image.asset;
      // The invisible glyph preserves the native input's character advance.
      emote.textContent = glyph;
      Object.assign(emote.style, image.style);
      fragment.append(emote);
    }
    if (text) fragment.append(document.createTextNode(text));
    line.replaceChildren(fragment);
    editor.classList.add('lobby-chat-rich-input');
    const syncScroll = () => {line.style.transform = `translateX(${-editor.scrollLeft}px)`;};
    const events = ['scroll', 'input', 'select', 'focus', 'keyup', 'pointerup'];
    events.forEach(event => editor.addEventListener(event, syncScroll));
    document.addEventListener('selectionchange', syncScroll);
    syncScroll();
    const frame = requestAnimationFrame(syncScroll);
    return () => {
      cancelAnimationFrame(frame);
      editor.classList.remove('lobby-chat-rich-input');
      events.forEach(event => editor.removeEventListener(event, syncScroll));
      document.removeEventListener('selectionchange', syncScroll);
    };
  }, [input, ui, value, control, active]);
  return <span ref={viewport} className="lobby-chat-input-preview" aria-hidden="true" hidden={!active}>
    <span ref={content} />
  </span>;
}
