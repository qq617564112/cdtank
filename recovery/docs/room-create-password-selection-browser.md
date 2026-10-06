# 建房密码选区正式页面验收

正式RoomCreateDialog同一个type=password输入以源EmotionFont0规则显示完整星号串，7字中文密码选区1..4保留7颗星号。视觉层仅持有count/range/scroll/focus，文字left=−scrollLeft，背景left=start×6−scrollLeft、width=(end−start)×6，不显示密码明文。

当前三分辨率证据见 `room-create-name-emotion-gate-browser.md` 和 `browser-room-create-emotion-gate-accepted.json`。共享 `--emotion-gate-only` 分支检查完整掩码、源Password面、自定义星号字体像素、真实鼠拖1..4、Shift、中文composition、54字密码End/Home、pointer hit、pending灰色、实际服务器拒绝后焦点恢复和Escape卸载。旧正式 `--password-selection-only` 命令维护同样完整mask断言。

历史 `browser-room-create-password-selection.json` 及30PNG保留。旧count−start呈现属于非零EmotionFont provider分支，不能证明源建房font0；当前完整星号的限定ctor/setup与draw合同见 `room-create-password-selection-source.md`。Caret纹理/时钟未改，来源沿既有独立验收。OS字体/字宽、原逐值scroll、完整候选窗和GPU/framebuffer保持父项。
