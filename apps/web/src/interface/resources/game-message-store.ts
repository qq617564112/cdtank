export type GameMessageTone = 'info' | 'pending' | 'success' | 'error';

export interface GameMessageEntry {
  readonly id: number;
  readonly text: string;
  readonly tone: GameMessageTone;
}

export const GAME_MESSAGE_ENTER_MS = 200;
export const GAME_MESSAGE_HOLD_MS = 1000;
export const GAME_MESSAGE_EXIT_MS = 240;

let nextId = 0;
let messages: readonly GameMessageEntry[] = [];
const listeners = new Set<() => void>();

function publish(next: readonly GameMessageEntry[]): void {
  messages = next;
  for (const listener of listeners) listener();
}

export function showGameMessage(text: string, tone: GameMessageTone = 'info'): void {
  const content = text.trim();
  if (!content || messages.some(message => message.text === content)) return;
  publish([...messages, {id: ++nextId, text: content, tone}]);
}

export function dismissGameMessage(id: number): void {
  publish(messages.filter(message => message.id !== id));
}

export const getGameMessages = (): readonly GameMessageEntry[] => messages;
export const subscribeGameMessages = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {listeners.delete(listener);};
};
