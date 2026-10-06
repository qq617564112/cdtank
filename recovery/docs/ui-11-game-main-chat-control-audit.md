# UI-11 formal PLAYING chat controls

The 18 archived controls are mapped to the existing formal PLAYING consumers. Normal and private render states were captured at 800×600, 1920×1080 and 3840×2160. Source root geometry follows the 301×164 area at design Y435 with viewport scale and letterboxing. All six root measurements agree within 0.2 physical pixels.

The public input preserves the unsent Chinese draft when switching to private. Private target and content inputs render in their source subregion. Family and GM are absent. Friend and Team buttons are mounted but hidden in these two sampled states. Both normal accounts leave through the existing Leave control and regain the enabled Create opener. No chat, whisper, friend-message or purchase request was sent.

Runner: [browser-ui11-game-main-chat.mjs](/workspace/cdtank/tests/browser-ui11-game-main-chat.mjs). Raw, six complete PNGs, ordered control mapping and geometry comparison: [ui-11-game-main-chat-control-audit-accepted.json](/workspace/cdtank/recovery/output/ui-11-game-main-chat-control-audit-accepted.json). Production code is unchanged; the existing release log records Vite 1m53s. Browser, Vite, server and dedicated temporary directory are cleaned, and the GPU window is handed to Breach21.

## Remaining scope

This audit does not complete the whole UI11 page. Family/GM producer binding, native RichEdit, complete original layout attachment and OS IME remain open. Existing channel, emote, intimate menu, caret and scrollbar evidence retains its original limited scope; no new menu, permission, send or scroll suite is claimed. Root inspected all six complete PNGs and the raw record; finite acceptance is recorded in [ui-11-game-main-chat-root-review.json](/workspace/cdtank/recovery/output/ui-11-game-main-chat-root-review.json).
