/**
 * Battle chat transient notice timing.
 *
 * A confirmed message keeps the chat frame at full opacity for {@link CHAT_NOTICE_FULL_MS},
 * then fades through a semi-transparent blur to hidden over {@link CHAT_NOTICE_FADE_MS}.
 * The duration is fixed here so the store timing and the CSS fade stay in step.
 */
export const CHAT_NOTICE_FULL_MS = 5000;
export const CHAT_NOTICE_FADE_MS = 400;
