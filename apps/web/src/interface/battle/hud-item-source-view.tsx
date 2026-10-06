import './hud-item-source.css';
import type {CSSProperties} from 'react';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {SourceUi, SourceWindow} from './battle-hud';

/** Original shortcut bar; icon ownership comes only from confirmed inventory. */
export function HudItemSourceView({data, catalog, inventory}: {
  data: SourceUi; catalog: CombatCatalog; inventory?: ResInventory;
}) {
  const layout = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml');
  const bar = layout?.windows.find(value => value.name === 'daojulan');
  if (!layout || !bar) return null;
  function asset(reference?: string): string | undefined {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    if (!match) return;
    const sets = data.imagesets.filter(value => value.attributes.Name === match[1]);
    const set = sets.find(value => value.path.includes('imagesets_dds/')) ?? sets[0];
    return set?.images.find(value => value.Name === match[2])?.asset;
  }
  function style(control: SourceWindow): CSSProperties {
    const rect = control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    return {left: rect[0], top: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1]};
  }
  function glyphs(value: string, fontName: string) {
    const size = fontName === 'SmallHT' ? 17 : 14;
    return <span data-dynamic-font="xiangjiao-brush" style={{fontSize: size,
      lineHeight: `${size}px`, color: fontName === 'Cheap' ? '#ffdf41' : '#fff'}}>{value}</span>;
  }
  function controls(parent: string): React.ReactNode {
    return layout!.windows.filter(value => value.parent === parent).map(control => {
      const name = control.name;
      let reference: string | undefined = control.properties.Image;
      let instanceId: number | undefined;
      let itemName: string | undefined;
      let quantity: number | undefined;
      if (/^daoju[1-8]$/.test(name)) {
        const digit = Number(name.slice(5));
        instanceId = digit === 1 ? undefined : inventory?.hotkeys[digit - 2];
        const record = instanceId ? inventory?.records.find(value => value.instanceId === instanceId) : undefined;
        const itemTableId = digit === 1 ? 2001 : record?.itemTableId;
        const item = catalog.items.find(value => value.itemTableId === itemTableId);
        itemName = item?.name;
        reference = item?.iconId === undefined ? undefined
          : `set:daoju0 image:data\\ui\\daoju\\${String(item.iconId).padStart(5, '0')}.tga`;
      }
      if (name.startsWith('txtItemCount')) {
        const index = Number(name.slice(12));
        const instance = index === 0 ? undefined : inventory?.hotkeys[index - 1];
        quantity = instance ? inventory?.records.find(value => value.instanceId === instance)?.battleQuantity : undefined;
      }
      const image = asset(reference);
      const count = name.startsWith('txtItemCount'), cooldown = name.startsWith('lengque');
      const label = name.startsWith('lblItem') ? control.properties.Text ?? '' : undefined;
      return <div key={name} className="hud-item-source-control" data-source-control={name}
        data-source-layout={layout!.path} data-source-asset={image} data-item-instance={instanceId}
        data-item-count-binding={count ? quantity === undefined ? 'unbound' : 'web-confirmed-battle-quantity' : undefined}
        data-item-quantity={quantity}
        data-item-cooldown-binding={cooldown ? 'unbound' : undefined}
        hidden={cooldown} title={itemName} aria-label={quantity === undefined ? label ?? itemName : `本局可用 ${quantity}`}
        style={{...style(control), textAlign: count ? 'right' : undefined,
          backgroundImage: image ? `url('/${image}')` : undefined}}>
        {label === undefined ? null : glyphs(label, control.properties.Font)}
        {quantity === undefined ? null : glyphs(String(quantity), control.properties.Font)}{controls(name)}
      </div>;
    });
  }
  const background = asset(bar.properties.Image);
  return <div className="hud-item-source-bar" data-source-control="daojulan" data-source-layout={layout.path}
    data-source-asset={background} style={{...style(bar), backgroundImage: background ? `url('/${background}')` : undefined}}>
    {controls(bar.name)}
  </div>;
}
