# 补给装置周期恢复

17061为原正价1500金币部件，技能13171为Trigger0/Target1/Func2/T999/X3，技能HP字段20。物件说明写每3秒50，技能说明及字段写每3秒20。正式消费者使用技能字段20；原属性被动选择器继续不选择13171。

周期为明确Web重建：已认证装备资料的部件实例，与本角色真实库存state2/ownedQuantity>0及战斗同槽表ID17061一致，且当前生命来源已资格时启用。一个角色多个装置只启用一个周期。每服务器3000ms回复最多20，限制在当前生命上限内；满血时周期继续推进而不发布恢复事件。一次晚到tick只恢复一次，下个周期从该tick重新计时。

新局、复活及供源实例集合变化重新计时；死亡、结束、卸装或库存/来源资格撤回停止。周期恢复在本tick炮击及陷阱结算后执行，致死目标不恢复。恢复使用现有整数生命setter，发布playerHealed，playerId/targetId为本人、skillId13171、value为实际增加的生命。无库存消费、score变化、食物恢复率叠加或额外特效/音频派发。

现网页Benefit由权威HP快照差值驱动，单playerHealed不另添加一次浮字。

## 验收

equipment-supply-engineering.json记录真实装配资格、3秒边界、限幅、源撤回、多装单周期与迟到无追补规则，以及mode4两局正常CPU模拟的24次恢复、逐事件生命、再战与结算停止。该模拟本人未复活。正常网络两房181/164共同完整快照和四次Leave相同，恢复周期server3015ms/模拟3s/接收wall3009ms；卸装缺血观察server3521ms/模拟3.5s/wall3508ms无恢复。最终同实例重新装备，原生双资料、库存、拥有与购买receipt及同库重启全文一致。

正式双网页新普通房sole2001 normal伤害97.92477314317554，HP700→602→622→642；两个20恢复间隔3030ms。493共同完整快照及各页同连接同tick玩家全文一致，Benefit show各2，实际glyphmesh绘制16/12条记录（8/6个Scene frame）与自然expiry各1；两次正常离房、双Home关闭及资源map清零通过。浏览器208896B保存库六业务表保持源全文。

## 未完成范围

原Func2装备调度、T999执行含义和周期时间基准producer仍未恢复；本周期不能作为原服务端执行证据。20与物件文案50的冲突保留。全部Func2技能及装备期限消耗不在此消费者范围内。正常BUY1500/装备实例12、双周期20、卸下后停止与完整保存恢复已由supply-healing-network-root-review.json接受；正式网页Benefit实际绘制与退出清理已由supply-part-browser-root-review.json接受，supply-healing-root-review.json合审。
