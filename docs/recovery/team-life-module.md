# 1UP团队存量模块（M4-10-I501）

正式模块 `apps/server/src/battle/items/team-life.ts` 提供 `applyTeamLifeItem(room, player, request, consumeItem, events)`。已有账户显式拥有的物件501经普通 `useItem` 实例请求使用，持久数量CAS成功后消费一份账户库存和本局数量，本队 `teamLives` 增加1，对队及角色HP、属性、技能栏保持原值。

## 来源与重建规则

目录物件501“1UP”说明为“我方坦克存量+1。”，技能列表 `[501,0,0]`，每局上限2。技能501为Target1、TriggerType1、FuncType18，参数t0/x1/y1/z0；首效果Effect12/SE13/Tag0/Method3。模块实际校验技能501、Target1、TriggerType1、首函数18/x1/y1。每局上限沿现有开局库存初始化执行，模块只消费剩余本局数量。

自用资格、仅团队mode1、角色存活且status2、team只能0或1、两队存量均为有限正整数、本队增加1必须保持安全整数，以及FuncType18解释为增加本队存量，均为明确重建的业务权威规则。原服务端资格、消费及FuncType18处理函数尚未恢复。原表零价是目录数据，不授权免费商城发放；此模块复用已有归属，不接购买或掉落。

## 消费与通知

模块只处理 `useItem` 且请求实例确属物件501。非mode1明确发送 `itemRejected` 且不消费；死亡、非status2、空库存或错误请求无作用。非法队号或存量发送拒绝。消费回调签名与无敌道具一致：`(playerId, instanceId, expectedOwned, itemTableId) => boolean`。回调返回false或抛出异常时，只发送拒绝，不改变库存、存量或角色状态。无回调沿既有道具的非持久运行约定执行。

成功先完成持久消费，再扣两项数量、增加本队存量，发送单个 `itemUsed`，value1、skillId501、自身targetId及当前位置；`playSkillEffect` 使用skillId501/effectIndex0/duration0，roleId取玩家ID去掉首字符后的数字，xBits/zBits均0。1UP不安装临时技能，不占技能栏、不触发属性重算。

## 专项验证

`npx tsx tests/team-life.cts` 验证原表合同、两队分别成功、持久先于作用、非mode1拒绝、死亡及非战斗状态、非法team与两队存量、安全整数边界、错实例及非501、空库存、CAS返回false及异常、源参数不符、两次本局使用后零量不再消费。全部作用和失败均检查HP、属性、标志及已满技能栏不变化；成功仅增加本队。
