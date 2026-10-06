# 设置页窗口与全屏

M5-12 / UI50。settings.xml 的 rdoWindowMode 与 rdoFullscreenMode 为 GroupID=1 的源单选控件，采用原 Normal/Hover/Pushed/CheckMark 图。Web 行为复用浏览器 Fullscreen API，即时切换；document.fullscreenElement / fullscreenchange 确认当前选择。原设备模式切换和 Apply callback 尚未知。

生产范围为 settings-source-view.tsx 的两个单选控件及 settings-source-page.tsx 的 selected 属性透传。切换时 aria-busy 配合现 guard，不禁用当前有焦点的按钮。保存本次原按钮引用，API 完成后仅 dialog 仍 open 且焦点在 body/documentElement/dialog 时恢复该按钮；已有主动焦点保持。键位草稿、快捷聊天、音量和 composition 合同保持。

实际 browser-settings-display-mode-2026-10-05T02-46-44-821Z.json PASS：普通账户 Home→设置，原生手势进入/退出真实浏览器全屏；change 事件与 CheckMark/aria-pressed 对齐，中文草稿保持，activeSource 分别为 rdoFullscreenMode/rdoWindowMode 且 withinDialog=true；关闭严格回设置入口与大厅 Home。无 save/send/room/BUY。首 02-45-17 raw FAIL 保留。server/Vite/Chrome/temp 已清，3457/5487/9687 无 listener。

1920 PNG 实际仅显示 Lobby，未包含本次 Settings 源按钮，保存为截图缺口，不接受新 radio 像素证据。旧 Settings 整页证据复用，未追加整套验收。两文件 Web strict types exit0，settings-display-general11-production-web-build.log 全 Web types/build exit0、Vite2m3，root 明确release并同步dist/release；包括最终两文件和 App 正式重复入口移除。root 已亲审 raw/code，接受行为有限范围，并移除 App 正式重复全屏入口，validation 保留。新 radio 图仍未接受。

原设备切换、Apply callback、完整设置父项与新截图保持未完成。
