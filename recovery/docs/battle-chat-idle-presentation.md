# Battle chat idle presentation

This note records the PLAYING/FINISHED chat visibility rule shown in the M5-04
screenshot: the lower-left chat frame is not part of the combat HUD while the
player fights. It appears only when the player composes, or briefly when a
confirmed message arrives.

## States

`BattleChat` distinguishes the source-layout phase from the editor:

- `sourceActive` is true for the whole `PLAYING`/`FINISHED` span. It selects the
  original lower-left source frame and its `300x164` stage geometry; it is not
  the editor.
- `editing` is true only while the player is composing. It is opened by Enter
  and closed by Esc or by a confirmed send.
- `noticePhase` is `hidden`, `full`, or `fading`. It controls the transient
  incoming-message frame.

`WAITING` keeps `sourceActive` false; the reconstructed room chat stays always
visible with its original channels, scroll, IME, private-target picker, emotes,
friend/quick chat, and scrollbar behaviour unchanged.

## Interaction

- Idle PLAYING/FINISHED renders no `.battle-chat` node, so it cannot capture
  battle keys or pointer events.
- Enter on the battle canvas opens the editor; the first key press releases any
  held battle keys before focusing the input.
- Esc closes the editor and keeps the draft. A confirmed send closes the editor
  once, blurs the input, and hands focus back to the battle canvas. A rejected
  send keeps the draft, keeps the editor open, and shows the readable status.
- FINISHED shares the same presentation but does not move the settlement focus:
  a confirmed send blurs the input without refocusing the canvas.

## Notice timing

A confirmed incoming message (including the local player's own acknowledged
message) shows the frame at full opacity for `5000 ms`, then runs a short
`400 ms` fade through a semi-transparent blur to fully hidden. The values live
in `battle-chat-visibility.ts` and match the CSS animation. New messages restart
the full-opacity hold. Opening the editor cancels the notice immediately.

Timers are cleared on `changePhase` away from PLAYING/FINISHED, on `clear`, and
on view teardown; a stale send response from a previous room cannot close the
new room's editor because `generation` guards every async update.

## Scope

The change only covers this idle presentation rule. It does not change room
chat authorization or persistence, the rich-text renderer, or the channel,
emote, and private-target menus beyond making them interactive only in edit
mode.
