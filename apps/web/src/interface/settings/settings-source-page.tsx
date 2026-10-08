import type {ComponentPropsWithoutRef} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

export const SETTINGS_LAYOUT = 'settings.xml';

/** The dialog backdrop owns the mask; other image-bearing windows remain source pictures. */
export function SettingsSourcePage({ui}: {ui: HomeSourceUi}) {
  const layout = new HomeSourceLayout(ui, SETTINGS_LAYOUT);
  const pictures = ui.layouts.find(page => page.path.endsWith(SETTINGS_LAYOUT))!.windows
    .filter(control => control.type === 'WindowsLook/StaticImage' && control.properties.Image && control.name !== 'all');
  return <>{pictures.map(control => <SourceStaticImage key={control.name} ui={ui} layout={layout}
    suffix={SETTINGS_LAYOUT} name={control.name} className="settings-source-picture" aria-hidden="true" />)}</>;
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {ui: HomeSourceUi; source: string; selected?: boolean};
/** Shared source buttons own pointer and keyboard state. */
export function SettingsSourceButton({ui, source, disabled, ...attributes}: ButtonProps) {
  const layout = new HomeSourceLayout(ui, SETTINGS_LAYOUT);
  const properties = layout.control(source).properties;
  const normal = sourceProps(ui, layout, SETTINGS_LAYOUT, source, properties.NormalImage);
  return <SourceButton {...attributes} ui={ui} layout={layout} suffix={SETTINGS_LAYOUT} source={source}
    disabled={disabled} className="settings-source-button"
    data-settings-disabled-presentation={disabled && !properties.DisabledImage ? 'web-normal-opacity' : undefined}>
    {disabled && !properties.DisabledImage && <i aria-hidden="true" data-room-button-image="WebDisabledNormal"
      data-source-asset={normal['data-source-asset']} style={{backgroundImage: normal.style.backgroundImage}} />}
  </SourceButton>;
}

/** Checkbox state imagery remains a source draw above the shared button interaction layer. */
export function SettingsSourceCheckmark({ui, source}: {ui: HomeSourceUi; source: string}) {
  const layout = new HomeSourceLayout(ui, SETTINGS_LAYOUT);
  const properties = layout.control(source).properties;
  return <SourceStaticImage ui={ui} layout={layout} suffix={SETTINGS_LAYOUT} name={source}
    reference={properties.CheckMarkImage} className="settings-source-checkmark" aria-hidden="true" />;
}
