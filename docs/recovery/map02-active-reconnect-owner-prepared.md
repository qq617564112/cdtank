# Map02 活跃房间重连资源 owner 观察合同

安装入口为 `tests/observers/map02-reconnect-owner-prepared-browser.mjs` 的 `installMap02ReconnectOwnerObserver`。两页 Login 后、Create/Join 前，先安装现有 `installMap02EnvironmentObserver`，再安装此入口。Root owns 正式30s保留、自动重新认证、同账户/player/session恢复、输入清零与超时leave接口及唯一actual driver。

Driver 在正式操作前后调用 `window.captureMap02ReconnectOwners(label)`，并最终复制 `window.map02ReconnectOwners` 与 `window.map02Environment`。建议检查点为 connected、disconnected、resumed、normal-leave；超时分支使用 expired。标签仅记录读数，不执行断线、重连、load或clear。

每个检查点记录room/player/session、phase/round、Battle/scene/Preview、water/Plant/四BG voice和audio的真实引用身份、Preview及sound revision、Plant源ID/root enabled/snapshot ledger、资源计数与旧audio引用paused状态。引用编号仅比较同一页内对象，不比较双页编号。正常Leave后room/phase来自最后收到的快照，active/mapLoaded与资源数量来自实际Battle；保留room字段不证明还在房间。

同场景重连可续用资源owner与四BG，不要求重新加载或重播。若正式接口重建owner，必须结合既有environment lifecycle确认旧资源清理与新load；checkpoint本身不推定重建正确。输入清零、账号认证、server保留期限与同player恢复由Root正式接口证据承担。此观察器只读，不新增水/Plant像素门禁、声音触发或来源复查，返回数据不自动判PASS。

Web30s保留策略明确属于重建接口，原规则来源仍开放。

## 有限实际 owner 证据

Root session70569 实际出口0，`browser-map02-active-reconnect-2026-10-05T18-55-30-389Z.json` 为 PASS_FINITE_FIXED_MAP02_AUTOMATIC_SAME_ROOM_RECONNECT_INPUT_OWNER_LEAVE。原房R6主端P1真实transport loss后自动恢复，客端P2同时保留正常场景。26共同完整状态由Root记录。

主端before-loss、disconnected、same-room-restored保持同Battle/scene/Preview、水、Plant及sound owner，Preview和sound revision均1；29个Plant root与四BG voice/audio引用身份保持。客端before/resumed同样保持各自引用。两端各仅一次环境sound load，恢复前后无dispose/clear，四BG looptrue、pausedfalse续播。

正常双Leave后active/mapLoaded均false，players、breakables、Plant roots/ledger、effects、scene voices、battle voices均0，旧四audio全部pausedtrue；water containers/textures0，Plant owners/resources0/materialOwnerfalse，sound voices0/masterfalse/mapfalse。processcleanup serverExit1/ChromeExit0/tempRemovedtrue及root亲3604/5634/9834三空保持实际范围。

证据包装：`../output/map02-active-reconnect-owner-evidence.json`。本记录只收资源续用与正常清理，不新增像素、输出峰值、高清性能或原规则等价资格。

实际组合主审：`../output/room-reconnect-root-review.json` / `PASS_FINITE_FIXED_MAP02_SAME_ACCOUNT_AUTOMATIC_ROOM_RECOVERY_INPUT_OWNERS_LEAVE_SCOPE`。主审另组合19444 network真实30.031s过期记录；owner包装只登记上述浏览器资源范围。
