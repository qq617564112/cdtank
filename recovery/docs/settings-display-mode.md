# 设置页窗口、全屏与显示选项

M5-14 / UI-50。settings.xml 的 rdoWindowMode 与 rdoFullscreenMode 为 GroupID=1 的源单选控件，采用原 Normal/Hover/Pushed/CheckMark 图。正式页复用浏览器 Fullscreen API 即时切换，document.fullscreenElement / fullscreenchange 确认当前选择；生产范围仍为 settings-source-view.tsx 的两个源控件及 settings-source-page.tsx 的 selected 透传，切换期间 aria-busy guard，API 完成后按既有焦点规则恢复来源按钮。原设备模式切换和 Apply callback 尚未知。

本批同页的三个 display 控件已接入正式草稿：rdoLow/rdoHigh 是原源层、互斥的 GroupID 单选状态，chkSilhouette 是同源层的独立复选状态；每次打开从当前生效显示偏好复制，草稿不直接改运行消费。确认保存时先完成既有键位与快捷聊天保存，再以 `cdtank.display-settings.v1` 写入 `{highPrecision,silhouette}`；只有存储成功才 applyDisplayPreferences 并关闭。显示保存失败时当前生效显示保持，草稿和 dialog 保持，并提示“键位和快捷聊天已保存；显示设置未保存，草稿保留且仍使用当前显示设置。”；默认与取消只改/丢弃草稿，不改变已生效显示。

high 走现自适应 DPR 高档，low 使用相同 CSS 尺寸与当前 DPR 下三维后备宽高各一半；DOM、字体、几何与服务端不改。Type8 屏幕叠加的实际尺寸随 engine 后备尺寸更新并保留原 UV。描边只对已注册且满足现有源网格资格的 sourceMesh 更新；Ink 为 0.65、黑 RGB，alpha blending、alpha testing 平面卡片与 terrain 不描，异步入场资源仍登记，mesh/scene dispose 与偏好订阅引用按现有生命周期清理。

源 INI 的 HighPrecision=1、Silhouette=1 是事实；分辨率选档、浏览器 Fullscreen 与显示偏好的 localStorage 持久为 Web 采用，原 D3D 对应含义/producer 未取得，浏览器存储不是账户服务端保存。原有 audio 即时设置/保存与 fullscreen 即时切换合同保持。

历史 browser-settings-display-mode-2026-10-05T02-46-44-821Z.json 仍只证明当时的窗口/全屏有限范围；首 02-45-17 raw FAIL 与 1920 Lobby 截图缺口保留，不接受为 display 控件像素证据。本批未执行真实低/高画质、描边、保存刷新、浏览器重启、高清或像素操作，M5-14/UI-50 父项保持未勾。
