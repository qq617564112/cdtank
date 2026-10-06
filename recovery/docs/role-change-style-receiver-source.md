# 原角色伪装通知与可见门禁

原 `UMsgChangeStyle` 通知type `0x4173` 已有明确的客户端角色消费者。`role-change-style-receiver-native.json` 执行9组原接收路由、4组两类战车绘制门禁，以及实际隐藏/恢复setter。此来源可准备技能10/11的表现接线；没有证明技能9的光学迷彩状态。

## 通知字段与接收者

`488b43–488b89` 绑定 `4860a7` 至监听器 `892bb0`，名称 `5ca1a0="UMsgChangeStyle"`，监听vtable `5c9fc8` 的type getter `489916` 返回 `0x4173`。原factory `489871` 分配20字节并安装packet vtable `5ca320`。

packet `+c` 是8位style；`+10` 是32位role ID。writer `4898e2` 和reader `492a08` 分别按8/32位顺序处理，reader读取前将两个DWORD清零。`4860a7` 先用 `+10` 查角色，要求存在 `role+310` actor，然后调用 `42a9dd(roleId,style)`。原路由已执行style1/2 ×角色缺失/actor缺失/两者存在六组，记录调用边界的精确参数。

恢复通知监听vtable `5c9fe0` 的type getter `489a17` 返回 `0x4174`；packet vtable `5ca348` 使用已有单DWORDreader `425ba6` 与writer `42571f`。`4860e6` 按packet `+c` 查role ID，要求actor存在后调用 `42a527(roleId)`。三组存在性路由已执行。完整transport注册/解码尚未执行，不能称网络接收闭环。

## 模型替换与恢复

`42a9dd` 查角色和actor后，style1选常量 `5c3a74="obj05428"`，style2选 `5c3a68="obj05422"`。其他style未取得合法来源，不用于业务。函数在 `42aa42–42aa49` 调用实际 `464950(0)`，把actor `+23d`置0；随后读取角色位置，经 `45aeb6` 创建世界对象，并将role ID与对象名称记录到角色manager `+54/+58` 容器。当前已执行该隐藏setter调用，世界对象分配/完整模型绘制仍为源码合同。

三组件 `4695bf` 和四组件 `46cec7` 的第一门禁均检查actor `+23d`。值0时原函数直接返回，不提交战车绘制；值1进入后续绘制体。四组实际原入口执行确认该门禁，未替代gfx调用。

`42a527` 查角色/actor后执行 `464950(1)`，再查角色manager中同role ID的世界名称记录，以 `4595f9` 删除对象，并移除对应记录。恢复setter原指令执行通过。此清理并非关闭全部角色特效。

原render内的virtual `+b4` 对应三组件 `468d92`、四组件 `46c6df`，调用gbengine `EnableOcclusionCulling`，不能当作隐身门禁。virtual `+bc` 对应递归blend设置，其值由camera距离计算，不能推为技能9透明度。

## 原技能资料与接入边界

item10/11分别关联skill10/11；原技能为FuncType8，T10，X1/X2。它们分别是南瓜和木桶伪装，说明文字包含开炮恢复原形。表值和上述style分支相符，但仍未证明原server如何从Func8生成4173、何时生成4174、目标权限、数量消费、10秒时基或开火取消条件。

可准备的正式表现接口是接收权威 `{roleId,style:1|2}` →隐藏同角色战车→按原角色位置显示对应世界对象，以及收到恢复通知→恢复战车→删除该角色替身。正式状态/协议/生命周期接线归主线；来源未足的权威规则需另作明确决策。本片未修改server、World、协议或Web。

替身对象创建/删除及现发布 `obj05428/obj05422` 资源合同见下节；未导入的呈现模块见 `role-change-style-consumer-proposal.md`。下一正式玩家依赖是取得、施放与成功消费、恢复条件和权威通知/presence；创建后的姿态更新仍缺来源。

来源：`CDTank/CDTank.exe`；脚本 `recovery/evidence/skills/role-change-style-receiver-native.py`；产物 `recovery/output/role-change-style-receiver-native.json`。既有 `skill-effect-message.md` 的恢复清理与原actor时钟vtable身份复用。

## 替身对象与已有资源资格

`45aeb6` 分配 `0xe0` 字节并构造 `45e417`，调用virtual `+34`加载给定模型、virtual `+38`设置收到的XYZ，调用 `461d9f` 处理后续参数、virtual `+4c(1)`，插入scene `+218`，并将 `44dbbc` 对象名称交回调用者。`4595f9` 按这个名称经 `459472` 从同scene容器移除。`42aa6b–42aaa2` 从原角色 `431fe0` 取XYZ并在创建时传入；尚未证明替身之后跟随角色，正式消费者不能自行假定跟随。

两份已发布源资源合同可直接复用：`scene-breach02-05428-intact-material-source.json` 的obj05428、174展开顶点与128×128原纹理；`scene-breach02-05422-intact-material-source.json` 的obj05422、108展开顶点与128×128原纹理。两者为FVF21/kind0，源顶点/UV/颜色与DDS→PNG逐值已核；它们的现有地图放置验收不等于角色伪装实际。无需重新转换模型或重复旧地图绘制。
