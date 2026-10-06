# 建房输入资格正式页面验收

房名8/密码20按源UTF32码点计数、原普通单字插入资格及新文本prefix上限接正式同input，玩家闭环PASS9。主 `browser-room-create-input-limit-2026-10-04T01-19-15-886Z.json` 整体PASS8；限定可信原生按键补验 `browser-room-create-input-limit-single-2026-10-04T01-20-34-681Z.json` PASS1。索引 `browser-room-create-input-limit-accepted.json` 保存20张有效PNG与两次独立cleanup。

`tests/browser-room-create-input-limit.mjs` 在普通大厅正式建房dialog，通过800×600、1920×1080、3840×2160分别核同一个name/password输入。原HTML maxlength已去除，实际DOM maxLength为−1；输入处理由共用码点helper与native beforeinput/React composition消费者完成。没有第二editable或模拟服务器状态。

六组输入样本实际检查：供给超过limit的ASCII新文本截前8/20、满限普通X不改原值、普通Shift范围替换、真实clipboard.writeText后CtrlV中文粘贴截前缀、非BMP输入8/20码点对应16/40个UTF16单元。中文预编辑在name达到10、password达到22码点时保持未裁，commit才分别保留8/20。预编辑与提交各保存实际PNG，活动IME文本与原password掩码仍来自native input。

单字门禁補驗把可信Z键插入到已满限ASCII串中间位置3，实际beforeinput为isTrusted=true、defaultPrevented=true，完整原串及末尾保持。以普通Shift选区3..5再输入Z则成功替换成7/19码点，末尾不丢失。该样本区分了原插入拒绝与事后截尾，无需重复三分辨率。

三分辨率都普通输入合法中文房名和含tab的密码，请求实际CreateRoom。代理只推迟真实服务器回复用于pending观察；release后正式拒绝反馈恢复密码焦点，两个草稿值保持。成功段正常输入中文成功房/中文可用密码，实际请求及成功响应进入权威WAITING。第二独立网页错误密码Join实际拒绝，正确中文密码普通Join进入同一房间；双方Leave，再开建房编辑中文、普通Shift选区和Escape清理。独立3296/5326/9526和临时目录全清理。

已实际查看800房名未裁中文预编辑、4K密码20星号提交截图。旧browser-room-create-visual相关断言维护DOM maxlength−1及实际受限8/20的范围，原长30/54字显示只作为历史独立绘制provider，不声称现正式玩家输入允许超限；未重复整套旧UI。

工程共用 `breach35-input-limit-web-build.log`（Web类型/唯一构建1m26s）、`breach35-input-limit-boundaries.log`（315正式模块）、`room-input-server-types.log`。root18 native对照、真实双连接边界/retry/passwordJoin及既有房间规则沿room-input-root-native.log、room-input-network.log、room-input-creation.log，独立页面复核为room-input-root-browser.json。

## 限制

源nonBMP字符计数已执行，Fontavailability仍是native provider，未证明原源字体支持该glyph。原Windows clipboard/IME producer未执行，Web真实paste/commit是明确的原onTextChanged新值投影；服务器相同8/20门禁是重建权威，不伪称原server规则。OS候选窗、字体/字宽、完整layout/glyph与GPU/framebuffer仍属父精度范围。首FAIL原状态和截图保留，验收只采用两份整体PASS。
