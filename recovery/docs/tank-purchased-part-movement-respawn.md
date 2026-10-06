# 已装引擎自然复活后的运动消费者

M2-03限定真实购买装配到自然复活后的运动链。合法BUY3/pet2检查点通过新Shop请求购买16001，并正常Equipment PART0确认真实实例state2/数量1。普通mode4/map7双账户准备，P2普通炮塔瞄准与连续普通射击使P1自然死亡；停止射击，正常生命周期复活后，仅用普通前后、车体正反、独立炮塔正反及stop输入测量。

原16001→13061被动技能ItemMove2通过现原技能选择、限幅、所选宠物精通及单位换算，实际统一公式为speed150、turn0.6806783676。复活后前后各0.4模拟秒累计59.9981405，車体正反各±0.2723rad，独立炮塔+0.2722/−0.2723rad且车体不动，stop稳定。各段服务器、墙钟耗时及真实自然复活三个时基见摘要。完整players双端及指定destroy/respawn事件同，destroy以targetId关联受害者、respawn以playerId关联角色。

权威原raw tank-purchased-part-movement-respawn-network-2026-10-05T05-14-21-251Z.json整体FAIL保留；独立分析tank-purchased-part-movement-respawn-player-evidence.json只接受已完成的复活运动/双端范围。首raw05-13-16也保留，完整服务日志各同前缀-server.log。

## 未完成范围

末库存断言比较了开局前全库存与对局内全库存，已有3003的本局数量正常初始化0→1。末Inventory回执未保存，不能据摘要宣称复活后原生库存state或余量验证；本片正常Leave未执行，finally断线和服务清理不代退房。限定已有实际动作不证明完整生命周期、全部配装、原伤害、原拥有初值或绑定；原已有引擎买装/卸装、生命复活和退房证据各自保留范围。未开第三房或补造数据库证据。
