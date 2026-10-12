# 键位设置浏览器验收（M5-14-B）

验收通过：15 个 Web 输入动作的改键界面、冲突拒绝、取消草稿、默认恢复、1080p/4K 显示、刷新和 Chromium 同配置目录重开，以及真实服务端对局中的移动、转向、炮塔、开火和输入隔离。

`node --import tsx tests/browser-key-settings.mjs` 使用独立 Vite 5215、真实服务端 3175、Chromium CDP 9285、临时账户数据库及专用浏览器配置目录。`--diagnostics` 仅运行快捷槽重复键与存储诊断补验。专用服务、浏览器和临时目录均在结束时清理。

## 页面与保存

1920×1080 页面完整显示前进、后退、车体转向、炮塔转向、开火与快捷槽 1–8；3840×2160 页面恢复同一配置。操作使用 CDP 真实鼠标和键盘事件，以 `KeyboardEvent.code` 选择键位。正常配置为 I/K 前后、J/L 转向、U/O 炮塔、F 开火、H 快捷槽 5，其余数字快捷槽保留默认。

每次保存检查真实 `Battle.getKeyBindings()` 与 `localStorage['cdtank.key-bindings.v1']` 的全部动作。选择重复的 K 提示冲突并保留原键；取消未保存的 P 草稿不改变生效键或存储。恢复默认先修改草稿，保存后回到 W/S、A/D、左右方向键、空格和数字 1–8。刷新、新页面与关闭后重新启动 Chromium 均恢复完整自定义配置。保存后保持对话框打开并显示成功提示，取消按钮关闭对话框。

## 真实对局

通过普通模式与地图选择控件选择模式 4、地图 7，正常建房、添加 3 个 CPU，等待地图和战车资源载入后点击准备。服务端进入 PLAYING，保留正式比赛时限、生命、目标和 CPU 行为。

I/K 请求对应前后移动，服务器玩家坐标变化；J/L 请求对应车体转向，服务器 yaw 变化；U/O 请求对应炮塔转向，服务器 aim 变化；F 请求对应开火，服务器 reload.startedAt 从 0 更新。旧 W 的输入保持 move=0，坐标保持不变。

H 一次按下与一次 autoRepeat 只发出一个 `useItem=5` 普通消息；旧 Digit5 不发出快捷槽请求。聊天输入框和按钮焦点下，改键不驱动手动战斗操作；打开键位编辑器清除已按住的 I，编辑器中的 F 不开火。开启正常 AI 托管后，I 和 H 均不发出手动 PlayerInput；随后通过按钮结束托管并正常返回。

独立 Vite 观察器包装实际 Battle getter/setter 与客户端 sendMsg，保留原调用并记录参数；RoomEvent 仅旁路记录。服务器世界快照从正式 HUD dataset 读取。测试不写世界、玩家生命、比赛阶段或时限。

## 存储诊断

畸形 JSON 和含重复键的保存配置在独立浏览器上下文载入，均回到完整默认键位并显示相应提示。存储禁用 fixture 只令键位设置键的 Storage.getItem/setItem 抛出 SecurityError，账户存储仍正常。读取失败显示默认回退提示；真实鼠标和键盘修改草稿后保存失败，页面显示无法保存提示，生效键保持默认，Battle setter 未被调用。

## 证据

- `recovery/output/browser-key-settings.json`、`.log`：完整页面、持久恢复和真实对局结果及专用进程清理。
- `recovery/output/browser-key-settings.diagnostics.json`、`.log`：H 重复键、旧 Digit5 与存储诊断结果及专用进程清理。
- `recovery/output/browser-key-settings-1080p.png`、`-4k.png`、`-reopened.png`：改键页面与重开恢复。
- `recovery/output/browser-key-settings.diagnostics-storage-disabled.png`：存储禁用保存反馈。

## 限制

键位保存于当前浏览器本地，不跨配置目录或设备同步。本验收使用正式模式 4 对局验证输入链，不重新证明所有模式规则或 4K 战斗性能。快捷槽 5 未配置库存，本次证明新键普通消息分派和重复键抑制，不作为道具消耗或实际施放证据。
