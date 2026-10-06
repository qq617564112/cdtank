import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

export function TankShopOwnedPartSourceRegions({ui, partSlotCount}: {
  ui: HomeSourceUi; partSlotCount?: number;
}) {
  const suffix = 'shop_tankpage_part.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const slots = ['bgInternalPart0', 'bgInternalPart1',
    'bgExternalPart0', 'bgExternalPart1', 'bgExternalPart2'];
  const controls = ['bgHatIcon', 'bgMarkIcon',
    ...(partSlotCount === undefined ? [] : slots.slice(0, partSlotCount))];
  return <>{controls.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} offsetX={0} offsetY={36}
    className="tank-shop-source-picture" aria-hidden="true" />)}</>;
}
