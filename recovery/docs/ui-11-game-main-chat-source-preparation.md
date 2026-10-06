# UI-11 `game_main_chat_shrinked.xml` source preparation

The archived layout at `recovery/output/verified/assets/data/Data/ui/layouts/game_main_chat_shrinked.xml` contains 18 named controls on an 800×600 design surface. The source is decoded and available; the named consumers are already integrated in formal PLAYING. This slice audits their visibility and geometry without adding production wiring.

## Current consumer map

`SourceBattleChat` projects `liaotianlan`, `picUpperPanel`, `picLowerPanel`, `liaotianditu`, `picNormalChat`, `picIntimateChat`, `btnPublic`, `btnTeam`, `btnPrivate`, `btnFriend`, and `btnExpandIntimate`. `SourceChatFrame` consumes the upper panel frame imagery. `BattleChatView` supplies the controlled `edtChat`, `edtIntimateNameInput`, and `edtIntimateChatInput` fields, while `RoomChatSourceCaret` supplies their source caret projection. `SourceChatEmotes` consumes `btnExpandEmotion`; `SourceChatScrollbar` consumes the `edtDisplayBox` scrollbar image properties while the message log remains the existing DOM projection.

The XML also contains `btnFamily` and `btnGM`. No current Web consumer or verified producer contract binds either control. They remain explicitly unbound; no channel permission or routing behavior is inferred from their image names.

The complete control table and exact consumer paths are recorded in [ui-11-game-main-chat-source-preparation.json](/workspace/cdtank/recovery/output/ui-11-game-main-chat-source-preparation.json).

## Next bounded slice

After the current release, the first UI-11 actual should inspect the three source resolutions and document the visible state of all 18 controls across normal and private render states, preserving unsent Chinese drafts and normal dual Leave. Existing menu, send, permission and scroll acceptance is reused. It must preserve the existing message store, send/pending behavior, focus cleanup, fonts, and App bridge. The run should not repeat accepted chat, emote, caret, or scrollbar suites.

The run must leave `btnFamily` and `btnGM` unbound unless a verified producer and permission contract is found. It also does not claim native RichEdit parsing, OS IME behavior, original font fidelity, or complete UI-11 page acceptance. Those gaps remain open in the tasklist.

## Evidence boundary

Existing accepted artifacts are reused only for their recorded limited scopes: battle channel controls, room caret, intimate target menu, WAITING history scrollbar, and battle emote controls. This preparation file adds source mapping and a bounded next actual; it is not a runtime pass and has no new browser, typecheck, or production build result.
