# 原破坏模式信息显示来源

原破坏模式更新`txtInfo`显示`CatsInfo + DogsInfo`，初始化只显示`CatsInfo`，均使用`%d`。本机角色属性`0x15`（角色`+0x314`）会在破坏模式覆盖CatsInfo。这些输入未证明为剩余对象数或重建全局摧毁目标数，不能直接接这两种业务数据。

`recovery/.venv/bin/python recovery/evidence/rooms/destroy-info-source.py`：PASS。输出`recovery/output/destroy-info-source.json`记录完整显示消费者、初始化显示块和必要上游公告更新执行。

## 显示消费者

原`game_main_info_destroy.xml`通过`0x4ca195`加载，根面板绑定HUD`+0x66c`。`txtInfo`由`0x4ca1fa–0x4ca232`绑定至`+0x670`；计时控件另为`+0x674`。

更新函数`0x4cb6cb`要求公告输入与HUD根控件`+8`非空，将公告`+0xc/+0x10`复制到HUD`+0x38/+0x3c`。HUD模式`+0x80=4`时，`0x4cbb1e–0x4cbb35`将两值相加，以常量`0x5c83d4`的`%d`格式化，写入`+0x670`的txtInfo。没有读取目标总数、扣减、比例或目标列表。

初始化显示块`0x4d2e07–0x4d2e4a`使用同一格式和控件，只读取`HUD+0x38`。公告两字段名称由已有`bulletin-schema.json`确定为`m_iCatsInfo/m_iDogsInfo`；它们不是独立的`m_iCatTankNumb/m_iDogTankNumb`。

## 必要上游

`0x436307`在房间记录存在、公告存在、本机角色存在且原模式为4时，通过角色虚方法`+0x14`读取属性`0x15`。原getter`0x422b64`对此属性返回角色`+0x314`。如果它与公告CatsInfo不同，`0x436378`将其写入公告`+0xc`，再通过公告观察者虚方法`+8`通知；DogsInfo`+0x10`保持原值。值相同不重复通知。

已有原指令`0x424807`执行`inc [role+0x314]`，初始化`0x422bbd`清零该计数。该计数没有已恢复的语义字段名；递增所在消息的对象类型与实际触发条件未确定。因此当前来源只能准确称为本机角色属性0x15计数，不能称为已证明的本人摧毁对象数。破坏模式DogsInfo的生产者也是缺失入口。

## 验证与限制

完整`0x4cb6cb`执行六组输入，证明9+23显示32、0+12显示12、9+0显示9；空公告、无HUD和模式3均不写破坏控件。两个初始化显示块证明即使DogsInfo非零也只显示CatsInfo。完整`0x436307`与原getter执行证明角色计数7覆盖CatsInfo1并通知一次、值相等不通知，DogsInfo23均保持。

角色通知和CEGUI边界由夹具供应；格式钩子消费原`%d`字符串和有符号整数参数。公告复制、模式分支、相加、完整回调返回、属性getter和本地公告写入均执行原指令。

原破坏对象定义、递增触发、DogsInfo生产及胜负规则没有因此恢复。重建`destroyedTargets/remainingTargets`与这个原txtInfo之间仍无来源接线；当前证据不支持把任一值写入该控件并称为原玩法。
