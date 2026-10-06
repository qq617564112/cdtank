# 建房房名选区正式页面验收

正式RoomCreateDialog同一个text input以源EmotionFont0规则绘制完整前缀、选区和后缀，包含普通中文以及U2501..U251E前缀。native输入保持唯一editable，视觉层aria-hidden/pointer-events:none。

当前验收见 `room-create-name-emotion-gate-browser.md` 和 `browser-room-create-emotion-gate-accepted.json`。三分辨率从普通中文编辑、真实鼠拖、Shift范围、中文composition到长串End/Home、pending灰色、实际CreateRoom拒绝焦点与Escape清理，沿 `tests/browser-room-create-visual.mjs --emotion-gate-only` 的房名分支执行。原 `--name-selection-only` 命令维护相同完整前缀位置断言。

“中文房名123”选区1..4实际SIMSUN中文字宽12：前缀“中”left0，selected“文房名”left12，suffix“123”left48，背景left12/width36。特殊前缀“AB━中文房名”通过普通Home/箭头/Shift选择4..6，完整前缀“AB━中”、选区“文房”及后缀“名”沿同一真实extent累加定位，不回退native选区呈现。

历史 `browser-room-create-name-selection.json` 及39PNG保留。该记录使用旧非零EmotionFont provider下的省略前缀合同，不再用于证明源建房默认font0；当前原资格和完整draw见 `room-create-name-selection-source.md`。字体OS、完整字库、逐值scroll、原候选窗及GPU仍保持父精度边界。
