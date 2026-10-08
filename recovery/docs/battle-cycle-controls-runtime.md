# M5-14 对局轮换与立即使用动作

本片在既有15个Web动作之后新增五个普通对局动作：`useItem`、`prevWeapon`、`nextWeapon`、`prevItem`、`nextItem`。这五个动作沿用同一个普通`PlayerInput.useItem`槽号请求链，不新增opcode、snapshot字段、schema或服务端消费规则，也不新发grant、改伤害或改库存。

## 来源事实

原客户端设置页`settings.xml`存在`txtUseItem0/1`、`txtPrevWeapon0/1`、`txtNextWeapon0/1`、`txtPrevItem0/1`、`txtNextItem0/1`文本区；`CDTank/Config/SystemSetting.ini`存在`UseItem29`、`PrevBullet199`、`NextBullet207`、`PrevItem201`、`NextItem209`字段，对应`Attached`附属字段均为0。原UI键位回调`4ce6c4`、两个选择索引及`4cb2f5`到选弹/陷阱/普通使用请求的分派已静态定位，详见battle-cycle-controls-source.md。原切换道具即请求使用、武器切换涵盖陷阱、到端点保留旧索引；当前Web采用规则如下。原成功回包与服务端业务仍有来源边界，不把ini数值直接当作浏览器键码。

## Web采用规则

新动作主键默认为`useItem=ControlLeft`、`prevWeapon=Home`、`nextWeapon=End`、`prevItem=PageUp`、`nextItem=PageDown`。原`UseItem29`对应DirectInput左Ctrl，Web按浏览器物理`ControlLeft`采用；`ControlRight`也可作为普通主/备用键保存和消费。既有15个默认动作保持原样，不改动任何一个。已保存的`KeyH`或其他合法用户绑定原样加载，不自动改写。

键位模型保留旧15动作主键必填；五个新动作主键可缺省，使旧`cdtank.key-bindings.v1`自选配置在保存后仍生效：缺少某新动作则不绑定该动作，既不回退整套默认也不自动赠键制造冲突。`fresh`默认配置包含五个新默认。高级键位页可清除任一已配置的新动作主键，清除即删除该字段（不是写成空字符串），仅保留备用键或保持未配置；原15动作主键不提供该清除入口。备用键对象可配置全部20个动作。冲突检查覆盖所有已配置主键与备用键，不允许重复或非法`code`。没有版本号、migration框架或compat层。

两个设置入口的单独Ctrl捕获分支和共享`isSupportedKeyCode`现已接受`ControlLeft/ControlRight`；普通物理Ctrl可捕获、校验、保存、加载并由`BattleInput`消费。Ctrl加其他键仍按组合键拒绝。

动作语义：

- `useItem`按当前本机选择的道具槽5–8发出一次普通`useItem`请求。
- `prevWeapon`/`nextWeapon`在默认弹、已配置炮弹及陷阱槽1–4间正向递增/反向递减，到端点保持当前索引；默认槽1始终是候选，槽请求由现服务端分派，HUD`selectedAmmoSlot`继续只读服务端确认。
- `prevItem`/`nextItem`在已配置道具槽5–8间递增/递减，到端点保持当前索引；移动本机道具选择框后立即发送一次普通`useItem`请求并复用统一数量门禁，record消失或未绑定不请求，repeat不重复请求。

炮弹候选保留默认槽1、`local.ammoSlots`中槽2–4的类别3条目，以及`Inventory.hotkeys`索引0..2（Battle槽2–4）中真实实例的类别4陷阱记录；`battleQuantity`为0的已配置记录仍保留为候选并进入统一槽请求入口。道具候选取`confirmedInventory.hotkeys`索引3..6（Battle槽5–8）中实例仍存在的记录，耗尽后仍保留；未绑定或记录消失的槽不参与。客户端不自行扣量，实际使用、放置和库存变化继续取服务端确认。

真实按下各动作一次：`repeat`不重复cycle或use；修饰键、输入法组合态、编辑器/button/modal聚焦、失焦、autopilot、死亡、非`PLAYING`、断连均不作用。五个新动作拒绝`Shift`组合；原15个动作的既有Shift语义保持不变。按键释放、`setKeyBindings`、`stop`、新生命、新round及离场清掉暂存意图，原50ms保持发送与主/备用键不叠加的行为保持。

## 武器切换意图

武器轮换维护本机导航游标与未确认炮弹选择，不是权威选中，HUD与后续开火仍读服务端`selectedAmmoSlot`。炮弹确认追上请求顺序后清理对应意图；陷阱发出放置请求并保留该导航位置，不等待`selectedAmmoSlot`变为陷阱槽，也不把陷阱当作炮弹确认。连续切换按槽顺序前进，到组内端点保留当前索引；数量为0的已配置槽仍推进到该槽，由统一入口播放UI28并拒绝。

炮弹未决请求的槽消失、数量或定义变化时清掉炮弹确认队列，已配置但数量为0的槽仍保留导航，仍有效的陷阱导航位置保留；陷阱绑定失效或记录消失才撤销该位置。请求已确认炮弹槽且没有更早未决选择时不增加确认队列。该玩家携带弹药`skillId`的普通`itemRejected`、发送失败、直接数字/HUD选槽，以及`clear`/`setKeyBindings`/`stop`/失焦/modal/托管/死亡/room/round生命周期重置均清掉导航意图并回当前确认基线。

## 本机道具选择框

唯一本机道具选择框是`BattleItemInventorySnapshot.selectedItemSlot`，只承载本机选择，不是服务端权威。`BattleItemInventory`同时保留本room、round和player内已真实配置过的道具槽身份；服务端耗尽后删除最后实例并清权威hotkey时，本机仍把该槽作为“已配备耗尽”候选，区别于从未配置，进入统一入口播UI28并拒绝。`useItem`读取cursor时按当前记录加本局槽记忆解释，未绑定且从未配置的槽不参与。前后切换先移动本机选择框，再与直接按Battle槽5–8或HUD点击共用一次普通`useItem`请求；不增加单独的第二步使用。记录消失的已配置槽保留到本局结束，`WAITING`、离场、新round/room清掉旧选择框与槽记忆，迟到的库存刷新不复活旧局选择。本机选择框和槽记忆只在`BattleItemInventory`中维护一份，`BattleInput`与React不各自另存。

## 接口

- `InputAction`新增精确`useItem/prevWeapon/nextWeapon/prevItem/nextItem`；`INPUT_ACTIONS`共20个，原15个在前且顺序保持。
- `KeyBindings`旧15主键必填、新5主键可选，`secondary`可覆盖20个动作；`bindingCodes`对未配置主键不返回`undefined`。
- `validateKeyBindings`不修改已有15动作保存值，也不自动赠新默认导致冲突；新动作主键缺省即未配置。
- `BattleItemInventorySnapshot`新增`selectedItemSlot?: number`；`getSnapshot`与`subscribe`不变。

正式文件归`match/input-bindings`、`battle-input`、`battle-item-inventory`、`match/battle-shortcut-selection`及`battle`接线；`shared`与服务端协议不改。客户端设置消费与未验收边界见 settings-cycle-controls-client.md。

## 验证

实际对局、网页、HD与保存重启未测；本片只做静态实现，不声明任何实测或test通过。原UI回调、选择索引与请求入口已静态定位；原成功回包及完整原Windows输入链仍有来源边界。
