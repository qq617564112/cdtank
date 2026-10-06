import type {ChatColour} from './chat-source-markup';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
let filterId = 0;

/** Apply the sequence item's colour without changing its shared animation image. */
export function applyChatEmoteColour(image: HTMLImageElement, colour: ChatColour,
  owner: HTMLElement): void {
  image.style.opacity = String(colour[3]);
  if (colour[0] === 1 && colour[1] === 1 && colour[2] === 1) return;
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  svg.dataset.chatEmoteColour = colour.join(',');
  const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
  const id = `chat-emote-colour-${++filterId}`;
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const transfer = document.createElementNS(SVG_NAMESPACE, 'feComponentTransfer');
  for (const [index, channel] of ['R', 'G', 'B'].entries()) {
    const component = document.createElementNS(SVG_NAMESPACE, `feFunc${channel}`);
    component.setAttribute('type', 'linear');
    component.setAttribute('slope', String(colour[index]));
    component.setAttribute('intercept', '0');
    transfer.append(component);
  }
  filter.append(transfer);
  svg.append(filter);
  owner.append(svg);
  image.style.filter = `url(#${id})`;
}
