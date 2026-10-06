import {useLayoutEffect, useRef, type ChangeEvent, type CompositionEvent, type RefObject} from 'react';
import {limitRoomInput, roomInputLength} from '../../../../shared/room-input';

/** Source single-character gate; committed new text follows the source prefix limit. */
export function useRoomInputLimit(input: RefObject<HTMLInputElement | null>, limit: number,
  onValue: (value: string) => void, available = true) {
  const composing = useRef(false);
  useLayoutEffect(() => {
    const element = input.current;
    if (!available || !element) return;
    const beforeInput = (event: InputEvent) => {
      if (composing.current || event.isComposing || event.inputType !== 'insertText'
        || !event.data || roomInputLength(event.data) !== 1) return;
      const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start;
      const remaining = element.value.slice(0, start) + element.value.slice(end);
      if (roomInputLength(remaining) >= limit) event.preventDefault();
    };
    element.addEventListener('beforeinput', beforeInput);
    return () => element.removeEventListener('beforeinput', beforeInput);
  }, [input, limit, available]);
  const commit = (element: HTMLInputElement) => {
    const value = limitRoomInput(element.value, limit);
    if (value !== element.value) {
      const start = element.selectionStart ?? value.length, end = element.selectionEnd ?? start;
      element.value = value;
      element.setSelectionRange(Math.min(start, value.length), Math.min(end, value.length));
    }
    onValue(value);
  };
  return {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (composing.current || (event.nativeEvent as InputEvent).isComposing) onValue(event.currentTarget.value);
      else commit(event.currentTarget);
    },
    onCompositionStart: () => {composing.current = true;},
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      commit(event.currentTarget);
    },
  };
}
