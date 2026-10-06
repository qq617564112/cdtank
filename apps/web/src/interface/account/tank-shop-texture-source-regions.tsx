import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** The texture sheet owns its own parent chain; the caller supplies its attachment offset. */
export function TankShopTextureSourceRegions({ui, offsetX, offsetY}: {
  ui: HomeSourceUi; offsetX: number; offsetY: number;
}) {
  const suffix = 'shop_tankpage_texture.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = ['tiao1', 'tiao2', 'tiao3', 'daibitubiao', 'daibitubiao2', 'daibitubiao3',
    'xingdian1', 'xingdian2', 'xingdian3'];
  return <>{pictures.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} offsetX={offsetX} offsetY={offsetY}
    className="tank-shop-texture-source-picture" aria-hidden="true" />)}</>;
}
