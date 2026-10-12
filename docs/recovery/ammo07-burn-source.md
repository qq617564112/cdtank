# 2007燃烧参数与权威边界

M2-04-AMMO07-BURN采用原表说明的9秒燃烧、每3秒HP−70，即命中后3/6/9秒三次伤害回调、合计210。当前持续伤害时序、触发授权及叠加策略是重建服务端合同；原服务器FuncType2周期执行与命中调用未恢复。

## 已有直接来源

原 `item.dat` 2007链接skill2007/4005/0，说明为燃烧9秒、生命减少210。已发布 `combat-catalog.json` 的skill4005「燃烧弹B」说明明确“9秒内被射中的目标会每3秒Hp-70”，数值属性HP为−70，TriggerType8、Target1、Range1；第一函数槽为type2、T6、X3、Y0、Z0。这些原数值进入目录，T6并无已证实的时间单位/函数语义，不把它转换为9秒。

skill2007本身说明为10秒/210，与Item及skill4005的9秒说明存在原表差异；其属性HP0/AtkBase100/Delay23/MaxBullet4/LoadTime100和FuncType1不提供燃烧scheduler合同。目录不存在skillId210，也没有已有专属skill210原执行依据；210是上述说明的总扣血量。

`skill-function-coverage.md`明确FuncType2实际授权/目标/持续未恢复。已有原433250生命setter负责signed32写入、0至maxHP限制及通知；它不证明技能4005如何产生增量或是否套用防御。原3a9d实体请求的数量不变合同、2007炮口及有限耗弹业务均已交付，本片不重复。

`skill-effect-message.md`证明4005在持续视觉白名单内，非零retention计数使用30个模拟步递减一次；已有相同(roleId,skillId,effectSlot)记录时不刷新视觉倒计时。该规则只约束客户端视觉记录，不能用于推断服务器周期伤害、重复命中叠加或刷新。4005表现槽为Effect14/SE03、Effect7/SE30；Item2007第二表现槽零值不表示4005全部效果静默。

## 可实现的独立合同

`battle/items/ammo-burn.ts` 保存ownerId、startedAt毫秒、nextTick1至3。`startAmmoBurn(target,ownerId,now)`仅向存活且无现存burn的目标写状态；重复命中不叠加、不刷新，也不转移原归属。`advanceAmmoBurn(target,now,ownerExists,damage)`在elapsed到达nextTick×3000时调用 `damage(ownerId,70)`，大时间步逐次处理到期tick；回调后重新核对alive与同一burn对象，防止死亡/结算清空后继续处理。目标死亡或归属角色缺失时清除；三次后删除。`clearAmmoBurn`供生命/局退出使用。

模块不计算防御、免疫或HP。正式projectiles在创建时保留ammoItemId，实际player碰撞把该表ID交World；有效命中造成HP下降且目标仍alive才start。World周期回调复用damagePlayer，因此既有防御、无敌、友军资格、hitScore与自然死亡/模式计分规则同样适用，每次成功周期hit标skillId4005，不伪造原受击选择参数。life死亡/复活、start及finish清空burn；owner离场后下次推进清空，不向新局继承。周期授予既有hitScore及防御免疫合成均属重建选择，尚无原server来源。非刷新/归属清理、首tick3秒、末tick9秒含端点和大步补处理是明确重建选择。

具体未恢复入口为FuncType2的T/X解释、TriggerType8实际命中调用、HP−70的攻击/防御/免疫合成、重复命中叠加及归属终局策略。原server已丢失，此模块不宣称这些原规则恢复。

`npx tsx tests/ammo-burn.cts`验证期限前不扣、3/6/9秒精确边界/同时间不重复、不刷新、大步三回调、死亡/缺归属清空、callback导致死亡/清空/替换/归属退出时停止补tick及clear/reentry。证据 `recovery/output/ammo-burn.json/.log`。正式普通2007自然命中及玩家可见HP持续变化另由集成验收，不用模块夹具替代。
