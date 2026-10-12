# 精品饲料罐头团队治疗

物件3006沿普通地面放置、账户CAS和接触触发通道执行技能4027，为合格己方角色恢复最多400生命。实际恢复者各收到一次Effect11/GA15技能通知；生命写入和治疗统计沿既有World权威。

## 原字段与采用定义

3006原说明为“全队队友生命回复400。”，category4/itemType4、inventoryCategory2、BattleUseMax10、ItemSkill1=4027；价格0/0、getMethod0、Shop/CPU不可用，原物件三槽效果和声音为0。模型/图标复用00009。原skill表缺4027记录。

项目定义`skills/4027.json`采用已有skill14“全体加血”的合同：Trigger1、Target2、Range0、FuncType2、HP400，首槽Effect11/GA15/Tag0/Method3。它已登记共享index，3006不再有运行时缺引用。该定义是依据3006文案和skill14采用的规则，原4027字段仍未恢复。

`readTeamFeedRule`从4027实际attributes.HP取得治疗量，不重复在item写另一份HP。地面接触半径80、寿命60000ms为物件采用参数。取得已进入五模式Breach和结算奖励池，见[battle-item-acquisition-runtime.md](battle-item-acquisition-runtime.md)。

## 放置与目标

普通合法owned实例沿category4配置与placeTrap请求，账户CAS成功后ownedQuantity/battleQuantity各减1，创建一次地面对象；失败不扣量或创建对象。放置本身不播放治疗效果。

mode1–3允许owner或真实同队合格角色接触；首次有效接触选择room所有合格本队成员，治疗不限距。mode4/5仅owner接触和接受治疗，同team数字的其他角色不视为友方。满血、lastStand、死亡、非status2或HP不大于0不会触发，对象等待有效接触或到期。多个对象各自最多触发一次。

## 生命、统计和绘声

World两个advanceGroundTraps调用点均提供同一治疗回调。canHeal要求alive/status2/HP>0/非lastStand且低于实际maximum。VIP maximum为Math.max(1,room.map.vipHp)，普通为现playerMaxHp。setBattleHealth按该上限返回真实恢复差额；仅mode1–3非self同队实际恢复量进入recordHealing。

首次接触发一次trapTriggered，value400为规则量。每个实际restored>0目标发playerHealed，owner/target/XYZ和value为真实身份、位置与恢复量，同时带4027首槽role通知。通用BattleSkillEffects与SkillEffectNotifications消费Effect11和GA15；无shotPlayerResult或第二份治疗，未恢复生命者不播放。

## 生命周期

触发后移除对象；到期、owner离房、finish、新局和清理移除未触发对象，不退款。owner在房但死亡仍保留普通地面寿命。绘声沿目标角色与普通技能生命周期结束、角色释放和离场清理。地面视觉复用GroundTrapsPresentation/ContentItemVisual的原00009；协议与UI不新增字段。

## 验收边界

原4027 writer/字段、取得概率和触发语义仍缺来源；技能14合同、80接触、60秒地面寿命及玩法目标选择为项目采用。源码与发布定义已接，新增取得、实际VIP治疗、双端绘声、普通页面和持久重启尚未实测；静态走查不能代替这些验收。M4-10-I3006/FUNC-02及完整父项保持开放。
