/** Original CreateRoomDlg Editbox limits count CEGUI UTF32 characters. */
export const ROOM_NAME_MAX_CODEPOINTS = 8;
export const ROOM_PASSWORD_MAX_CODEPOINTS = 20;

export function roomInputLength(value: string): number {
  return Array.from(value).length;
}

/** Original onTextChanged keeps the prefix when a supplied value exceeds its limit. */
export function limitRoomInput(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('');
}

/** Server enforcement of the recovered client limits is a reconstructed policy. */
export function validateRoomInputLength(value: string, limit: number, label: string): void {
  if (roomInputLength(value) > limit) throw new Error(`${label}最多${limit}字`);
}
