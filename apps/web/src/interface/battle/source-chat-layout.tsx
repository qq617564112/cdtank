import {imageResourceBackground} from '../../assets/image-cache';
import {useState, type ComponentPropsWithRef, type CSSProperties} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';

/** Original rectangles and image references expressed as React props. */
export class ChatSourceLayout {
  readonly controls;
  constructor(readonly ui: HomeSourceUi, readonly suffix: string) {
    this.controls = ui.layouts.find(layout => layout.path.endsWith(suffix))!.windows;
  }
  control(name: string) {return this.controls.find(control => control.name === name)!;}
  picture(reference?: string) {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    const sets = this.ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
    return {style: {backgroundImage: asset ? imageResourceBackground(`/${asset}`) : undefined}, 'data-source-asset': asset};
  }
  place(name: string, offsetX = 0, offsetY = 0) {
    const source = this.control(name);
    const rect = (control: typeof source) => control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const box = rect(source);
    let left = box[0], top = box[1];
    for (let parent = source.parent; parent;) {
      const owner = this.control(parent), position = rect(owner);
      left += position[0]; top += position[1]; parent = owner.parent;
    }
    return {style: {left: left + offsetX, top: top + offsetY, width: box[2] - box[0], height: box[3] - box[1]} as CSSProperties,
      'data-source-control': name, 'data-source-layout': `ui/layouts/${this.suffix}`};
  }
}

export function SourceChatButton({layout, name, offsetX = 0, offsetY = 0, style, ...props}: {
  layout: ChatSourceLayout; name: string; offsetX?: number; offsetY?: number;
} & ComponentPropsWithRef<'button'>) {
  const [state, setState] = useState('NormalImage');
  const position = layout.place(name, offsetX, offsetY);
  const image = layout.picture(layout.control(name).properties[state]);
  return <button {...props} {...position} {...image} type="button" style={{...position.style, ...image.style, ...style}}
    onMouseEnter={event => {setState('HoverImage'); props.onMouseEnter?.(event);}}
    onMouseLeave={event => {setState('NormalImage'); props.onMouseLeave?.(event);}}
    onMouseDown={event => {setState('PushedImage'); props.onMouseDown?.(event);}}
    onMouseUp={event => {setState('HoverImage'); props.onMouseUp?.(event);}} />;
}

export function SourceChatFrame({layout, name, width, height, kind}: {
  layout: ChatSourceLayout; name: string; width: number; height: number; kind: 'chat' | 'emote';
}) {
  return <>{[
    ['TopLeftFrameImage', 0, 0, 20, 20], ['TopFrameImage', 20, 0, width - 40, 20], ['TopRightFrameImage', width - 20, 0, 20, 20],
    ['LeftFrameImage', 0, 20, 20, height - 40], ['Image', 20, 20, width - 40, height - 40], ['RightFrameImage', width - 20, 20, 20, height - 40],
    ['BottomLeftFrameImage', 0, height - 20, 20, 20], ['BottomFrameImage', 20, height - 20, width - 40, 20], ['BottomRightFrameImage', width - 20, height - 20, 20, 20],
  ].map(([property, left, top, w, h]) => {
    const image = layout.picture(layout.control(name).properties[property]);
    return <span key={property} {...image} data-chat-frame={kind === 'chat' ? property : undefined}
      data-emote-frame={kind === 'emote' ? property : undefined}
      style={{...image.style, left, top, width: w, height: h} as CSSProperties} />;
  })}</>;
}
