/** Original CEGUI emotion glyphs; TSRPC carries decoded Unicode, not original bytes. */
export const EMOTE_FIRST_CODEPOINT = 0x2581;
export const EMOTE_COUNT = 30;
export function emoteGlyph(id: number): string {
  if (!Number.isInteger(id) || id < 1 || id > EMOTE_COUNT) throw new Error('表情编号无效');
  return String.fromCharCode(0x2580 + id);
}
export function normalizeEmoteInput(text: string): string {
  return text.replace(/\/(0[1-9]|[12][0-9]|30)/g, (_, id: string) => emoteGlyph(Number(id)));
}
