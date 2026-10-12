# 等待页正式呈现状态（M5-03-R-PRESENTATION）

原 `room_main.xml` 根为透明 SheetWindow：没有 Image，FrameEnabled=False，frame为空。正式等待窗口沿既有源布局、图像、按钮与字体消费者显示，透明区域露出场景。原根属性与中央 frame 消费见 `waiting-room-visual-source.md`。

`dialog[data-waiting-room][open]` 是呈现切换条件。窗口实际打开时，`style.css` 隐藏 `.controls`；`match.css` 清除所属 `.battle-match` 的背景与边框，并以 visibility 隐藏其直接 Web 工具、目标与名单节点。等待窗口与 `[data-source-notice]` 保留可见，源 Chat/Hud 保留现有消费。visibility 保持既有节点与尺寸；Esc 关闭窗口后，普通 Web 工具和具有管理权限的 CPU 按钮恢复。

等待窗口状态输出保留 `role="status"`、完整文字和语义。`data-waiting-room-status-state="normal"` 以 1px、零 padding 和 clip-path 裁切，不在正常源页绘制蓝色状态条。loading、error、pending 与 invitation confirmation 保留既有可见状态条。状态优先次序与当前输出一致：资源失败、资源加载、业务失败、提交中、邀请确认、普通房号与已准备人数。

状态属性与 CSS 不改变请求、权威快照、原生 dialog、焦点、邀请冷却或 React 会话生命周期。正常 Ready/Cancel/Team/Invite/Close 继续使用原 source 按钮；服务器拒绝继续使用原 source notice。窗口关闭后仍处于 WAITING，只有普通 Leave 清空房间。

## 限制

本片验证当前正式 Web 等待页呈现与状态切换，不证明原 Windows framebuffer/GPU/display 的整页一致性。原 `game_main.xml` 的 `picBattleInfoPanel`（原矩形 309,0,263,93，`ui/regions/77/2.png`）目前在 WAITING 保留，`edtBattleInfo` 为空，形成顶中黄色透明区域；closed source notice 的 computed display 为 none、矩形为零。现场记录见 `waiting-room-presentation-hud-observation.json`。原 WAITING HUD 显隐规则、头像、称号、原房间数据来源、开局权限及全业务恢复仍属于 M5-03/UI-44 的父范围。加载、错误与请求状态条是现有 Web 状态呈现，不作为原 room_main 控件。
