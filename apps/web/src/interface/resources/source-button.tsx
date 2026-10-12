import {backgroundStyle} from '../../assets/image-artwork';
import './source-button.css';
import type {ComponentPropsWithoutRef} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';
import {sourceProps} from './source-ui-props';
import {sourceTextArtwork, SourceTextArtwork} from './source-text-artwork';
import {useButtonInteraction} from './button-interaction';
import {dialogButtonPreset, DialogButtonArtwork} from './dialog-button';

interface SourceButtonProps extends ComponentPropsWithoutRef<'button'> {
  ui: HomeSourceUi; layout: HomeSourceLayout; source: string; selected?: boolean;
  suffix: 'login.xml' | 'lobby_select.xml' | 'game_summary.xml' | 'settings.xml' | 'shop_partpage.xml' | 'shop_petpage.xml' | 'shop_tankpage.xml' | 'shop_tankpage_texture.xml' | 'game_main.xml' | 'shop.xml' | 'shop_itempage.xml' | 'playerlist.xml' | 'playerlist_playerinfo.xml' | 'myhome.xml' | 'myhome_panzerpage.xml' | 'myhome_panzerpage_modify.xml' | 'myhome_petpage.xml' | 'myhome_playerpage.xml' | 'createroom.xml' | 'room_main.xml' | 'roomlist_icon.xml' | 'roomlist.xml' | 'userinput_dialog.xml' | 'notify_dialog.xml' | 'selectgamemode.xml' | 'chat.xml' | 'chat_channellist.xml' | 'chat_channellist_lobby.xml' | 'game_main_channellist.xml' | 'game_main_chat_shrinked.xml' | 'confirm_dialog.xml' | 'myhome_petpage_skill.xml' | 'shop_mendpage.xml' | 'history.xml' | 'trade.xml' | 'trade_partdesc.xml' | 'trade_petdesc.xml' | 'trade_tankdesc.xml' | 'tut_settings.xml'; offsetX?: number; offsetY?: number;
}

/** ButtonBase hover is pointer-inside XOR captured push; radio checkmark is a second draw. */
export function SourceButton({ui, layout, source, suffix, offsetX = 0, offsetY = 0, selected = false, disabled = false,
  onClick, className = '', children, ...props}: SourceButtonProps) {
  const {element, buttonProps, state, pushed, hovering} = useButtonInteraction({disabled, onClick, ...props});
  const control = layout.control(source);
  const properties = control.properties;
  const preset = dialogButtonPreset(properties.NormalImage);
  const radio = control.type === 'WindowsLook/RadioButton';
  const property = radio && selected && (state === 'Normal' || state === 'Hover') ? 'PushedImage' : `${state}Image`;
  const stateImage = disabled && !properties[property] ? 'NormalImage' : property;
  const imageKeys = [stateImage, ...(radio && selected ? ['CheckMarkImage'] : [])].filter(key => properties[key]);
  const alpha = Number(properties.Alpha ?? 1);
  const place = sourceProps(ui, layout, suffix, source, undefined, offsetX, offsetY);
  const imageProps = preset ? [] : imageKeys.map(key => ({key, props: sourceProps(ui, layout, suffix, source, properties[key])}));
  return <button {...place} {...buttonProps} ref={element}
    className={`source-state-button${preset ? ' game-dialog-button' : ''}${suffix === 'createroom.xml' ? ' room-create-source-button' : ''}${className ? ` ${className}` : ''}`}
    data-dialog-button={preset?.kind} data-source-button-state={state} data-source-effective-alpha={alpha}
    data-source-pushed={String(pushed)} data-source-hovering={String(hovering)}
    data-source-asset={imageProps.at(-1)?.props['data-source-asset']}>
    {preset ? <DialogButtonArtwork kind={preset.kind}>{children ?? preset.label}</DialogButtonArtwork>
      : imageProps.map(({key, props: image}) => <i key={key} aria-hidden="true" data-room-button-image={key}
      data-source-asset={image['data-source-asset']}
      data-source-button-label={sourceTextArtwork(image['data-source-asset']) ? 'external' : undefined}
      style={{...backgroundStyle(image.style), filter: 'none', opacity: alpha}}>
      {sourceTextArtwork(image['data-source-asset']) && <SourceTextArtwork asset={image['data-source-asset']!}/>}
    </i>)}
    {!preset && children}
  </button>;
}
