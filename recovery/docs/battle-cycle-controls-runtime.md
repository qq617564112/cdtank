# M5-14 对局轮换与立即使用动作

本片在既有15个Web动作之后新增五个普通对局动作：`useItem`、`prevWeapon`、`nextWeapon`、`prevItem`、`nextItem`。这五个动作沿用同一个普通`PlayerInput.useItem`槽号请求链，不新增opcode、snapshot字段、schema或服务端消费规则，也不新发grant、改伤害或改库存。

## 来源事实

原客户端设置页`settings.xml`存在`txtUseItem0/1`、`txtPrevWeapon0/1`、`txtNextWeapon0/1`、`txtPrevItem0/1`、`txtNextItem0/1`文本区；`CDTank/Config/SystemSetting.ini`存在`UseItem29`、`PrevBullet199`、`NextBullet207`、`PrevItem201`、`NextItem209`字段，对应`Attached`附属字段均为0。这些字段证明五个动作在原界面存在，但不包含原Windows键位回调、`DirectInput`扫描码到浏览器`code`的映射，也没有恢复“当前选择”的原始写入函数。本片不把这些ini数值当作浏览器键码，也不宣称原完整输入链已恢复。

## Web采用规则

新动作主键默认为`useItem=KeyH`、`prevWeapon=Home`、`nextWeapon=End`、`prevItem=PageUp`、`nextItem=PageDown`。`KeyH`是本片采用的Web键，不把原ini的29当作`H`。既有15个默认动作保持原样，不改动任何一个。

键位模型保留旧15动作主键必填；五个新动作主键可缺省，使旧`cdtank.key-bindings.v1`自选配置在保存后仍生效：缺少某新动作则不绑定该动作，既不回退整套默认也不自动赠键制造冲突。`fresh`默认配置包含五个新默认。高级键位页可清除任一已配置的新动作主键，清除即删除该字段（不是写成空字符串），仅保留备用键或保持未配置；原15动作主键不提供该清除入口。备用键对象可配置全部20个动作。冲突检查覆盖所有已配置主键与备用键，不允许重复或非法`code`。没有版本号、migration框架或compat层。

动作语义：

- `useItem`按当前本机选择的道具槽5–8发出一次普通`useItem`请求。
- `prevWeapon`/`nextWeapon`只在普通弹药槽1–4间正向递增/反向递减并wrap，默认槽1始终是候选；只发普通`useItem`1–4的槽选择，不额外开火或扣量，HUD`selectedAmmoSlot`继续只读服务端确认。
- `prevItem`/`nextItem`只在有限已确认道具槽5–8间递增/递减并wrap，仅移动本机道具选择框，不发送请求、不扣量。

弹药候选只取`local.ammoSlots`中槽2–4且`quantity>0`、`classifyItemId(itemTableId)===3`的条目，加上默认槽1；不扫描`Inventory`分类2的地面陷阱`3001..3005`把`place`当作cycle候选。道具候选只取`confirmedInventory.hotkeys`索引3..6（Battle槽5–8）中实例存在且`ownedQuantity`、`battleQuantity`均为正数的真实记录；未知、未绑定或耗尽条目跳过。没有可用候选时动作为空，不请求、不扣量、不改配置。

真实按下各动作一次：`repeat`不重复cycle或use；修饰键、输入法组合态、编辑器/button/modal聚焦、失焦、autopilot、死亡、非`PLAYING`、断连均不作用。五个新动作拒绝`Shift`组合；原15个动作的既有Shift语义保持不变。按键释放、`setKeyBindings`、`stop`、新生命、新round及离场清掉暂存意图，原50ms保持发送与主/备用键不叠加的行为保持。

## 武器切换意图

武器轮换只维护本机迭代意图，不是权威选中，HUD与后续开火仍读服务端`selectedAmmoSlot`。连续快速合法cycle沿输入次序前进：每次被接受的按下记录该请求的真实`slot`、`itemTableId`、`quantity`，服务端确认只在`selectedAmmoSlot`推进追上该序列表时才剪除已确认项，因此较早到达的ack不会把已请求的更新槽回拨。

以下情况清掉未决意图并回当前确认基线：该玩家携带弹药`skillId`的普通`itemRejected`；`PlayerInput`发送promise返回`isSucc:false`或reject；既有`local.ammoSlots`中未决请求的槽消失、数值数量变化或`itemTableId`变化；直接数字/HUD选槽；以及`clear`/`setKeyBindings`/`stop`/失焦/modal/托管/死亡/room/round生命周期重置。这里不新增opcode/schema、超时轮询、固定毫秒猜测、receipt、hash或通用pending框架，也不给普通message伪造业务回执。

## 本机道具选择框

唯一本机道具选择框是`BattleItemInventorySnapshot.selectedItemSlot`，只承载本机选择，不是服务端权威。写入只在槽属于当前确认可用道具候选时生效；空、未绑定、未知或耗尽槽一律不写cursor。`useItem`读取cursor时再按当前确认候选过滤，无可用候选则不发送。直接按Battle槽5–8或HUD点击同一槽位时，沿原普通立即`useItem`路径一次请求，并让本机选择框跟随该合法槽位；数字/HUD点空槽保留既有的一次普通请求，不去掉该即时请求，但不写入合法cursor。取消绑定或耗尽后刷新回退到首个可用道具槽或清空。`WAITING`、离场、新round/room清掉旧选择框，迟到的库存刷新不复活旧局选择。本机选择框只在`BattleItemInventory`中维护一份，`BattleInput`与React不各自另存。

## 接口

- `InputAction`新增精确`useItem/prevWeapon/nextWeapon/prevItem/nextItem`；`INPUT_ACTIONS`共20个，原15个在前且顺序保持。
- `KeyBindings`旧15主键必填、新5主键可选，`secondary`可覆盖20个动作；`bindingCodes`对未配置主键不返回`undefined`。
- `validateKeyBindings`不修改已有15动作保存值，也不自动赠新默认导致冲突；新动作主键缺省即未配置。
- `BattleItemInventorySnapshot`新增`selectedItemSlot?: number`；`getSnapshot`与`subscribe`不变。

正式文件归`match/input-bindings`、`battle-input`、`battle-item-inventory`、`match/battle-shortcut-selection`及`battle`接线；`shared`与服务端协议不改。客户端设置消费与未验收边界见 settings-cycle-controls-client.md。

## 验证

实际对局、网页、HD与保存重启未测；本片只做静态实现，不声明任何实测或test通过。原Windows回调、当前选择writer及原完整输入链保持未恢复。
