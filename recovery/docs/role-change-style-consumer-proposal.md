# FUNC-08 原角色伪装接收消费者准备

原4173/4174消息已确认角色伪装显示与恢复消费者。完整施放权威仍缺，当前生产未接。复用tasklist FUNC-08与M4-10原父，不关闭I09或创建新完成编号。

## 已确认输入与行为

原4173 `UMsgChangeStyle` 为style8、roleId32：style1加载obj05428南瓜，style2加载obj05422木桶。接收角色和actor缺失时不操作；存在时隐藏战车actor，按角色当前XYZ创建替身世界对象，并保存生成的对象名称用于删除。4174输入roleId32，恢复战车并删除该角色记录的替身对象。原setter与两种tankrender门禁已执行，九路由与四绘制门禁PASS。

源模型已有174/108展开顶点与原128纹理资格，可复用既有场景资源，不重新转换。源码只确认创建时复制角色XYZ，不能提前决定替身跟随角色。原链没有本机、同队、敌对区别；不能借此补I09的隐身过滤或透明度。

## 当前正式协议

`apps/shared/protocols/MsgRoomEvent.ts` 仅有playSkillEffect/stopSkillEffect与shot/scene等消息，没有style或restore语义。`PlayerSnapshot`也没有伪装presence。现SkillEffect通知按skill表特效引用产生树，不承载这两条原模型替换消息，不能把itemUsed或Effect0解释为伪装成功。

若主线提供具备资格的权威状态，最小事件输入建议为独立 `roleStyleChanged?: {roleId:number; style:1|2}` 与 `roleStyleRestored?: {roleId:number}`。它们对应原两种通知，不含未知duration或虚构的effect。已有Battle数值role映射 `P${roleId}` 可复用当前适配，仍不宣称恢复原uint32 objectId生产。

新进入/模型晚加载是否需要snapshot presence，以及替身后续位置、死亡/结算清理时序由主线明确接口后准备；不能只靠不可重放的事件假称完整生命周期。此proposal不修改共享协议或生产。

## 权威依赖与归属

原Func8到4173/4174的server producer仍缺：目标/使用资格、成功消费绑定、T10单位与期限、开火恢复条件、死亡/换局时序。物件和技能说明只能提供资料，不能作为这些规则的原执行证据。待主线选择并明确标注可玩的重建政策后才可普通购买/使用和联机验收。

| 玩家链步骤 | 已确认输入/输出 | 尚缺的权威合同 |
| --- | --- | --- |
| 取得与配置 | item10/11关联skill10/11 | 零价商品的合法取得途径、库存和配置资格 |
| 施放与消费 | skill Func8、X1/2对应原style1/2 | 谁可施放、目标是谁、成功条件与库存CAS因果 |
| 激活显示 | 4173收到style8/roleId32，隐藏actor并创建替身 | 正式发送者与当前协议中的通知，以及晚加载/新进入所需presence |
| 期限与开火恢复 | T10原表值、说明文字；4174恢复并删除同角色记录 | T的权威时基、到期触发点、哪一次开火构成恢复条件 |
| 生命周期 | 原restore删除全部同role替身记录 | 死亡、退离、终局与再战的权威状态清理/通知时序 |

现公开事件和快照都没有承载伪装状态的字段。上表已确认的显示输入不能代替尚缺的施放输出；仅导入呈现模块不能形成可操作玩家链。

root owns权威施放、CAS、公开协议、World生命周期与正式Web接线；本线owns专属数值/来源合同与必要网络测量；FX/地图资源归原owner。当前共享生产freeze保持。

依据：`role-change-style-receiver-source.md`、`role-change-style-receiver-native.json`。新增codec组合探针尚未通过，保留 `role-change-style-wire-native-incomplete.json`，不并入来源PASS；已有原reader/writer静态字段合同保持原有限范围。

## 未导入呈现合同

`recovery/prepared/role-change-style-presentation.ts` 提供纯回调式 `RoleStylePresentation.change(roleId,style)` 与 `restore(roleId)`。role ID保持数字身份，provider提供actor存在性、可见setter、角色XYZ、世界对象创建/按名称删除与scene存在性。它不持有Babylon对象，也未导入生产。

change先隐藏战车，再复制创建时角色XYZ并生成对应模型；保存每一条role ID/对象名称记录，不添加非叠加或刷新规则。restore在actor存在时先恢复可见；scene存在才逐条删除同role的世界名称记录。缺actor时保留记录，与原清理入口门禁一致。源码未给出替身跟随、倒计时、死亡或开火事件绑定，因此模块没有这些行为。

此prepare未执行新native、类型构建或actual，也不登记成玩家业务。主线必须先落实正式权威通知与完整玩家scope，再决定导入和提供scene回调。

原42aa70/42aa71另供给世界创建参数尾0与2；prepare按45aeb6原形参+1c/+20保留raw2/0，不为未证明的参数语义命名成期限或生命周期。
