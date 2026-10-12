import {backgroundStyle} from '../../assets/image-artwork';
import type {ComponentPropsWithoutRef, ReactNode} from 'react';
import {SourceButton} from '../resources/source-button';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {GameDialogTopbar, GameDialogTitle, GameDialogPanel, GameDialogFootbar} from '../resources/game-dialog';
import {dialogButtonPreset} from '../resources/dialog-button';
import {GameCard} from '../resources/game-card';
import {GameInsetCard} from '../resources/game-inset-card';

export const SETTINGS_LAYOUT = 'settings.xml';

/** Vector frame pieces share the topbar's horizontal bounds around the source controls. */
export function SettingsSourcePage({ui, topbar, footbar}: {ui: HomeSourceUi; topbar: ReactNode; footbar: ReactNode}) {
  const layout = new HomeSourceLayout(ui, SETTINGS_LAYOUT);
  const place = (name: string) => sourceProps(ui, layout, SETTINGS_LAYOUT, name);
  const topbarBounds = place('zuishanghoutiao');
  const panelBounds = place('zuidaditu');
  const keysBounds = place('zuobianditu');
  const adjustmentsBounds = place('youxiaditu');
  const displayBounds = place('youshangditu');
  return <>
    <GameDialogTopbar {...topbarBounds}>
      {topbar}
      <GameDialogTitle>系统设定</GameDialogTitle>
    </GameDialogTopbar>
    <GameDialogPanel {...panelBounds} style={{...panelBounds.style,
      left: topbarBounds.style.left, width: topbarBounds.style.width}} aria-hidden="true"/>
    <GameDialogFootbar {...place('zuixiahoutiao')}>{footbar}</GameDialogFootbar>
    <GameCard {...keysBounds} style={{...keysBounds.style, top: 85, height: 468}}
      shape="panel" className="settings-source-panel" aria-hidden="true"/>
    <GameCard {...adjustmentsBounds} style={{...adjustmentsBounds.style, top: 204, height: 349}}
      shape="chat" className="settings-source-panel" aria-hidden="true"/>
    <GameCard {...displayBounds} style={{...displayBounds.style, top: 85}}
      shape="display" className="settings-source-panel" aria-hidden="true">
      <GameInsetCard shape="options" className="settings-display-options"/>
      <GameInsetCard shape="modes" className="settings-display-modes"/>
    </GameCard>
  </>;
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  ui: HomeSourceUi; source: string; selected?: boolean; offsetX?: number; offsetY?: number;
};
/** Shared source buttons own pointer and keyboard state. */
export function SettingsSourceButton({ui, source, disabled, ...attributes}: ButtonProps) {
  const layout = new HomeSourceLayout(ui, SETTINGS_LAYOUT);
  const properties = layout.control(source).properties;
  const vector = dialogButtonPreset(properties.NormalImage);
  const normal = sourceProps(ui, layout, SETTINGS_LAYOUT, source, properties.NormalImage);
  return <SourceButton {...attributes} ui={ui} layout={layout} suffix={SETTINGS_LAYOUT} source={source}
    disabled={disabled} className="settings-source-button"
    data-settings-disabled-presentation={disabled && !properties.DisabledImage ? 'web-normal-opacity' : undefined}>
    {disabled && !properties.DisabledImage && !vector ? <i aria-hidden="true" data-room-button-image="WebDisabledNormal"
      data-source-asset={normal['data-source-asset']} style={{...backgroundStyle(normal.style)}} /> : null}
  </SourceButton>;
}
