import './source-button.css';
import {useEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';
import {sourceProps} from './source-ui-props';

interface SourceButtonProps extends ComponentPropsWithoutRef<'button'> {
  ui: HomeSourceUi; layout: HomeSourceLayout; source: string; selected?: boolean;
  suffix: 'login.xml' | 'lobby_select.xml' | 'game_summary.xml' | 'settings.xml' | 'shop_partpage.xml' | 'shop_petpage.xml' | 'shop_tankpage.xml' | 'shop_tankpage_texture.xml' | 'game_main.xml' | 'shop.xml' | 'shop_itempage.xml' | 'playerlist.xml' | 'playerlist_playerinfo.xml' | 'myhome.xml' | 'myhome_panzerpage.xml' | 'myhome_petpage.xml' | 'myhome_playerpage.xml' | 'createroom.xml' | 'room_main.xml' | 'roomlist_icon.xml' | 'roomlist.xml' | 'userinput_dialog.xml' | 'notify_dialog.xml' | 'selectgamemode.xml' | 'chat.xml' | 'chat_channellist.xml' | 'chat_channellist_lobby.xml' | 'game_main_channellist.xml' | 'game_main_chat_shrinked.xml' | 'confirm_dialog.xml' | 'myhome_petpage_skill.xml' | 'shop_mendpage.xml' | 'history.xml' | 'trade.xml' | 'trade_partdesc.xml' | 'trade_petdesc.xml' | 'trade_tankdesc.xml' | 'tut_settings.xml'; offsetX?: number; offsetY?: number;
}

/** ButtonBase hover is pointer-inside XOR captured push; radio checkmark is a second draw. */
export function SourceButton({ui, layout, source, suffix, offsetX = 0, offsetY = 0, selected = false, disabled = false,
  onClick, className = '', children, ...props}: SourceButtonProps) {
  const element = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | null>(null), releasedInside = useRef(true);
  const [view, setView] = useState({inside: false, held: false, keyHeld: false});
  const cancel = () => {
    const id = pointer.current;
    pointer.current = null;
    if (id !== null && element.current?.hasPointerCapture(id)) element.current.releasePointerCapture(id);
    setView({inside: false, held: false, keyHeld: false});
  };
  useEffect(() => {
    const blur = () => cancel();
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('blur', blur);
      const id = pointer.current;
      pointer.current = null;
      if (id !== null && element.current?.hasPointerCapture(id)) element.current.releasePointerCapture(id);
    };
  }, []);
  useEffect(() => {if (disabled) cancel();}, [disabled]);
  const control = layout.control(source);
  const properties = control.properties;
  const radio = control.type === 'WindowsLook/RadioButton';
  const pushed = !disabled && (view.held || view.keyHeld);
  const hovering = !disabled && !view.keyHeld && (view.inside !== pushed);
  const state = hovering ? 'Hover' : pushed ? 'Pushed' : disabled ? 'Disabled' : 'Normal';
  const property = radio && selected && (state === 'Normal' || state === 'Hover') ? 'PushedImage' : `${state}Image`;
  const imageKeys = [property, ...(radio && selected ? ['CheckMarkImage'] : [])].filter(key => properties[key]);
  const alpha = Number(properties.Alpha ?? 1);
  const place = sourceProps(ui, layout, suffix, source, undefined, offsetX, offsetY);
  const inside = (x: number, y: number) => {
    const rect = element.current!.getBoundingClientRect();
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  };
  const imageProps = imageKeys.map(key => ({key, props: sourceProps(ui, layout, suffix, source, properties[key])}));
  return <button ref={element} type="button" {...place} {...props} disabled={disabled}
    className={`source-state-button${suffix === 'createroom.xml' ? ' room-create-source-button' : ''}${className ? ` ${className}` : ''}`} data-source-button-state={state} data-source-effective-alpha={alpha}
    data-source-pushed={String(pushed)} data-source-hovering={String(hovering)}
    data-source-asset={imageProps.at(-1)?.props['data-source-asset']}
    onPointerEnter={event => {if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));}}
    onPointerMove={event => {if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));}}
    onPointerLeave={() => {if (!disabled) setView(value => ({...value, inside: false}));}}
    onPointerDown={event => {
      if (disabled || event.button !== 0) return;
      pointer.current = event.pointerId; releasedInside.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      setView({inside: true, held: true, keyHeld: false});
    }} onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      const hit = inside(event.clientX, event.clientY);
      releasedInside.current = hit; pointer.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setView({inside: hit, held: false, keyHeld: false});
    }} onPointerCancel={cancel} onLostPointerCapture={() => {if (pointer.current !== null) cancel();}}
    onKeyDown={event => {if (!disabled && (event.key === ' ' || event.key === 'Enter')) setView(value => ({...value, keyHeld: true}));}}
    onKeyUp={event => {if (event.key === ' ' || event.key === 'Enter') setView(value => ({...value, keyHeld: false}));}}
    onBlur={cancel}
    onClick={event => {if (!disabled && (event.detail === 0 || releasedInside.current)) onClick?.(event);}}>
    {imageProps.map(({key, props: image}) => <i key={key} aria-hidden="true" data-room-button-image={key}
      data-source-asset={image['data-source-asset']} style={{backgroundImage: image.style.backgroundImage, opacity: alpha}}/>)}
    {children}
  </button>;
}
