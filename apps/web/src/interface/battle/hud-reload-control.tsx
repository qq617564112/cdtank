import {useLayoutEffect, useRef, type ComponentPropsWithoutRef} from 'react';
import type {BattleHud} from './battle-hud';
import {BattleCrosshair} from './battle-hud-artwork';

/** The frame clock changes the existing clip rectangle without rebuilding its SVG. */
export function HudReloadControl({hud, mobile = false, ...props}: ComponentPropsWithoutRef<'div'> & {
  hud: BattleHud; mobile?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const clip = useRef<SVGRectElement>(null);
  const reload = hud.getReloadSnapshot();
  useLayoutEffect(() => {
    const update = (): void => {
      const state = hud.getReloadSnapshot();
      const fraction = mobile && !state.visible ? 1 : state.fraction;
      clip.current?.setAttribute('y', String(37 * (1 - fraction)));
      clip.current?.setAttribute('height', String(37 * fraction));
      const element = container.current;
      if (!element) return;
      if (mobile) element.setAttribute('aria-label', state.visible ? '装填中' : '准星');
      else {
        element.hidden = !state.visible;
        element.setAttribute('aria-valuenow', String(Math.round(state.fraction * 100)));
      }
    };
    const unsubscribe = hud.subscribeReload(update);
    update();
    return unsubscribe;
  }, [hud, mobile]);
  return <div {...props} ref={container}
    className={mobile ? 'mobile-battle-crosshair mobile-battle-sized' : 'source-control hud-reload-control'}
    hidden={mobile ? undefined : !reload.visible} role={mobile ? undefined : 'progressbar'}
    aria-label={mobile ? reload.visible ? '装填中' : '准星' : '装填'}
    aria-valuemin={mobile ? undefined : 0} aria-valuemax={mobile ? undefined : 100}
    aria-valuenow={mobile ? undefined : Math.round(reload.fraction * 100)}>
    <BattleCrosshair fraction={mobile && !reload.visible ? 1 : reload.fraction} clipRef={clip}/>
  </div>;
}
