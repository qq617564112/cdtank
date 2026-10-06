# Waiting-room resource failure recovery

Formal waiting-room layout failures retain a readable explanation and a Return to Lobby button. Return consumes the existing Leave request with the existing busy and externalBusy guard. Loading before a confirmed error has no new button; the successful source geometry, request lifecycle, management and room actions retain their existing implementations.

Real targeted HTTP503 and a successful room creation were observed. Error feedback remains independent of the room snapshot. At 800×600, 1920×1080 and 3840×2160 the full feedback is readable, its bounds fit the viewport and its enabled Return is hit-testable. All three frames are captured after the Create dialog closes. Return produced a successful Leave response and strict Create focus. The same authenticated token reopened a normal source waiting room without the error; final cleanup produced another successful Leave and strict Create focus. No Ready, CPU, send, join or purchase request was issued.

[Accepted evidence](../output/waiting-room-resource-feedback-accepted.json) contains the raw files, four complete frames, marker/HTTP records, API receipts and process cleanup. Root inspected all four final frames and accepted this recovery scope in [waiting-room-resource-feedback-root-review.json](../output/waiting-room-resource-feedback-root-review.json). The Web typecheck passed; the unified production build passed in 1m38s and was copied to release (breach21-waiting-resource-production-web-build.log). All dedicated browser, Vite, server and temporary resources are cleaned.

## Remaining scope

Three complete fallback frames and the recovered 1920 source page are unobscured. Earlier raw FAIL statuses remain preserved in the evidence index. This Web feedback does not restore native source error artwork or complete UI44/M5-03. Existing successful page and room-business evidence retains its original scope.
