# 已购宠物的大包完整400恢复

M2-01/I02真实购入角色来源下首次未受生命上限截断的联机400恢复由tests/healing-large-feed-purchased-life-network.cts验证。旧large-feed-world完整400规则与I02逐内容业务直接复用；consumables-purchase-network真实购买大包，但生命161/204→204，itemUsed2实际value43，不能证明本次真实购买角色联机来源支路的完整400。本片沿真实BUY3/pet2检查点，新Shop请求购入大包2一件、Kitbag槽4，正常mode4/map7双账户Ready，不导入拥有或活跃生命/位置/伤害。

原skill2 HP400与所选pet2拥有+2c700直接提供来源。P2普通瞄准/连续普通炮击使P1自然存活至295/700，停射并等待12步，P1正常useItem5；双同itemUsed2/value400，生命精确295→695，上限700与分数不变。库存1→0，普通Inventory回执确认。此400没有被上限截断；原Func2目标、权威资格及消耗producer仍是已登记重建边界，普通伤害只作自然前提。

319次共同完整players观察和指定itemUsed2双同，两正常round1 Leave成功，3330无监听、服务进程/临时库已清。原raw healing-large-feed-purchased-life-network-2026-10-05T04-53-22-981Z.json与同前缀-server.log，封装healing-large-feed-purchased-life-player-evidence.json包含三个独立时基。30秒自然受伤等待上界仅为driver deadline，不更改任何服务时间或伤害参数。

旧43clamp、原效果、两局、CPU与持久重启合同直接复用，不重跑。新小包200与医疗300的实际证据分别保留其独立范围；完整原生命/伤害/Func2与M2父项仍开放。
