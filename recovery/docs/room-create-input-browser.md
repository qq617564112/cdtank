# 建房输入正式页面验收（UI-07-R-INPUT）

正式页面验收 PASS，三分辨率共6项检查；server、Chrome、Vite及临时目录均完成清理。

`node --import tsx tests/browser-room-create-visual.mjs --input-only` 从正式大厅打开实际 RoomCreateDialog，在800×600、1080p、4K检查源矩形与 PNG、中文房名/密码输入、选中文字与选区色、密码遮蔽、中心命中、提交禁用文字、拒绝后焦点恢复与 Escape 关闭清理。

选区使用实际 input 的 selectionRange，CSS 消费原 WindowsLook 白色选中文字、607FFF 活动底色与808080非活动底色。输入普通及禁用文字保持白色，禁用 opacity 1 与 text-fill-color 保持一致。

禁用截图来自现生产 pending 状态：专属测试代理暂存原服务器回复字节，页面通过原 CreateRoom 提交含 tab 的拒绝密码，截图后释放原回复，核对服务器拒绝和密码焦点恢复。该测试只控制回复到达时机，不修改生产服务器、协议、草稿或提交函数。

确认结束后的焦点恢复在 pending=false 的 DOM 提交后执行一次，输入已重新启用时回到最后使用的房名或密码。关闭卸载后输入不再持有焦点。800×600选中截图与4K密码及禁用截图可见原选区颜色、密码遮蔽和禁用白字。

证据为 `recovery/output/browser-room-create-input.json`，截图为 `browser-room-create-input-{800x600,1080p,4k}-{name-selected,password-focused,pending-disabled,closed}.png`。源执行与字体/GPU边界见 `room-create-input-source.md`。
