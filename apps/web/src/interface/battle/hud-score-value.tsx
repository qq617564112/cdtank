import {useEffect, useRef} from 'react';

interface ScoreValueProps {value: string; context: string; active: boolean;}

/** A value transition starts one browser animation without updating React on every frame. */
function useScoreJump(value: number | undefined, context: string, active: boolean, direction: 'up' | 'down') {
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef<{value: number | undefined; context: string; active: boolean} | undefined>(undefined);
  useEffect(() => {
    const last = previous.current;
    previous.current = {value, context, active};
    if (!active || !last?.active || last.context !== context || value === undefined || last.value === undefined) return;
    const changed = direction === 'down' ? value < last.value : value > last.value;
    if (!changed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.current!.animate([
      {transform: 'translateY(0) scale(1)', offset: 0},
      {transform: 'translateY(-6px) scale(1.25)', offset: .18},
      {transform: 'translateY(0) scale(.94)', offset: .38},
      {transform: 'translateY(-3px) scale(1.12)', offset: .62},
      {transform: 'translateY(0) scale(1)', offset: 1},
    ], {duration: 1000, easing: 'ease-in-out'});
    return () => animation.cancel();
  }, [value, context, active, direction]);
  return element;
}

export function HudCountValue({value, context, active}: ScoreValueProps) {
  const count = value === '' ? undefined : Number(value);
  const jump = useScoreJump(count, context, active, 'down');
  return <span className="hud-score-count" data-low-count={count !== undefined && count < 5 || undefined}
    data-active={active || undefined}>
    <span ref={jump} className="hud-score-value">{value ? value.padStart(2, '0') : ''}</span>
  </span>;
}

export function HudTimeValue({value, elapsedMinutes, context, active}: ScoreValueProps & {elapsedMinutes?: number}) {
  const [minutes, seconds] = value.split(':').map(Number);
  const remaining = value === '' ? undefined : minutes * 60 + seconds;
  const urgency = remaining === undefined ? undefined : remaining < 10 ? 'critical' : remaining < 60 ? 'warning' : undefined;
  const jump = useScoreJump(elapsedMinutes, context, active, 'up');
  return <span className="hud-score-timer" data-timer-urgency={urgency}>
    <span className="hud-score-timer-label">剩余时间：</span>
    <span ref={jump} className="hud-score-value hud-score-time-value">{value}</span>
  </span>;
}
