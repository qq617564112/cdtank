# Formal waiting-room resource feedback

The existing `WaitingRoomSession` independently owns its layout load error. A failed `/ui.json` fetch displays a technical cause and an Escape recovery instruction, while `close()` returns immediately in formal mode. The source Close control is only rendered when `ui` exists. Formal recovery therefore needs a visible action outside the unavailable source sheet.

The proposed fallback consumes the existing Leave request without adding room state or a retry protocol. Its standalone `WaitingRoomResourceFeedback` module presents a readable load/error message and Return button through the existing shared text consumer. Pending state is supplied by the parent. The source successful page and its controls retain their existing geometry and handlers.

Exact proposed integration: `waiting-room.tsx` import, loader catch copy, `!ui` feedback within the existing scaled stage, only after a confirmed load error. The existing status output remains available with its fixed friendly message. The existing `request`, `actions.leave`, generation, native cancel and focus behavior remain the parent contract. Root authorized this precise integration, which is now atomic and passes the Web typecheck. Loading has no new Return button. First actual remains pending the coordinated GPU window.

## First actual scope

Use one normal authenticated renderer to Create a room through the existing source dialog. A runner-local marker targets only the waiting-sheet layout HTTP request for 503; other source consumers remain available. Observe successful room snapshot and readable fallback at 800×600, 1920×1080 and 3840×2160. Return performs the existing Leave and restores strict Create focus. Clear the failure and reopen normally under the same token. No Ready, CPU, invitation, send or purchase is needed. No native source error artwork or complete waiting-page acceptance is claimed.
