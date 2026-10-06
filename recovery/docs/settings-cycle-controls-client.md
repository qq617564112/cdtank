# 快捷循环控制客户端

M5-14 / UI-50 的原 Windows 回调与当前选择 writer 未恢复。本页登记 Web 端已实现的设置页、普通输入消费和 HUD 本机道具 cursor 范围；不把该投影冒称原版全部输入链路，父项保持未完成。

## 原字段

`settings.xml` 提供 `txtUseItem0/1`、`txtPrevWeapon0/1`、`txtNextWeapon0/1`、`txtPrevItem0/1`、`txtNextItem0/1` 五个动作的主/备用键矩形。`CDTank/Config/SystemSetting.ini` 对应 `UseItem29`、`PrevBullet199`、`NextBullet207`、`PrevItem201`、`NextItem209`，Attached 字段均为 0。原设置窗口的实际捕获、保存回调和运行期选择 writer 未取得。源事件与请求边界见 battle-cycle-controls-source.md；本页只登记 Web 采用与消费。

## Web 合同

`InputAction` 包含原有 15 个动作及 `useItem`、`prevWeapon`、`nextWeapon`、`prevItem`、`nextItem`，共 20 个。旧 15 个主键继续必填；五个新动作主键可选，未配置时不写该字段。高级键位页列出全部 20 个动作，五个新动作主键可显示为未设置并单独清除，清除即删除该字段（不是写成空字符串），原 15 个必填主键不因该操作被清空。备用键可覆盖全部 20 个动作。冲突检查覆盖所有已配置主键和备用键；旧 15 键自选配置保存后保持，新 5 键未配置则不补默认，也不自动赠键制造冲突。

Web 采用默认值为 `useItem=KeyH`、`prevWeapon=Home`、`nextWeapon=End`、`prevItem=PageUp`、`nextItem=PageDown`。`UseItem29` 不解释为 `KeyH`；H 是本实现采用的普通浏览器按键。

系统设置页把上述十个原矩形接现有草稿捕获、保存、取消、恢复默认、存储和错误反馈规则，确认成功才更新 Battle 消费。按键提示同步展示五个新动作的当前绑定，未设置的新动作显示“未设置”。

## 普通输入与 HUD

`BattleInput` 对五个动作只处理非 repeat 的真实 keydown，并拒绝 `Shift` 组合；Ctrl/Alt/Meta、IME、编辑器、按钮、模态、失焦、托管、死亡、非 PLAYING 和断连沿现有门禁，原 15 个动作的既有语义不变。武器循环只请求服务端确认的槽 1–4（默认 1 加数量为正的类别 3 弹药槽 2–4）；道具循环只在确认库存的槽 5–8 中按真实实例的正拥有量和正本局量选择。没有可用槽时为空，不请求、不扣量。

`useItem` 请求当前本机 cursor 一次普通 `PlayerInput.useItem(slot)`；直接按数字/HUD 槽 5–8 仍立即请求一次，并让合法 cursor 跟随该槽。`prevItem`/`nextItem` 只移动 cursor，不请求、不扣量。武器选择仍走普通 `useItem` 1–4，HUD 选中仍只读服务端 `selectedAmmoSlot`。

HUD 的 `selectedItemSlot` 是 `BattleItemInventory` 的本机 cursor，范围 5–8，不是服务端权威字段。`HudItemSourceView` 只在该槽仍有已确认实例且 `ownedQuantity`、`battleQuantity` 为正时显示 `data-item-cursor`；原有 `data-item-selected` 只表示 `combat.selectedAmmoSlot` 的服务器确认弹药选中。空槽、未确认槽和耗尽槽不显示道具 cursor，图标、数量、冷却和点击立即使用行为保持原消费规则。

本实现不新增 opcode、snapshot、schema 或服务端消费规则，不发送额外开火、不改伤害和库存，也不预测服务端扣量。发送成功不等于服务端选择成功，静默业务拒绝不宣新可观测字段。

## 未实测

本批未运行实际对局、浏览器、高清、保存重启或完整输入回归。现有原 writer/原回调缺口、HD 表现和父任务验收保持未完成；上述代码只登记静态实现合同。
