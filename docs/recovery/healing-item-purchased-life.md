# 已购宠物生命上限的小包恢复消费者

M2-01/I01首次正式取得到独立lifeReady恢复消费者由tests/healing-item-purchased-life-network.cts补齐。旧healing-item-network使用导入库存，consumables-purchase-network使用拥有夹具并实际治疗大包2；本片复用真实BUY3/pet2检查点，通过新Shop请求购买小包1一件、Kitbag槽4，mode4/map7双账户Ready，没有活跃生命、位置、伤害或拥有注入。

原小包技能1提供HP200；原已购pet2的owned+2c为700。正式生命资格沿现独立生命合成、原signed32 setter与上限合同执行，自用资格/成功CAS/使用入口仍为已登记重建服务器规则，未恢复原Func2目标分派。

P2以普通炮塔输入瞄准并连续普通开火，使P1自然存活受伤至475/700；停止射击并等待12步后，P1正常useItem5。双同itemUsed1/value200，生命精确475→675，上限700与分数保持。库存1→0，普通Inventory回执确认。此缺血量足够，200没有受上限截断；普通命中伤害只提供自然前提，不冒称原完整伤害公式。

共同完整players快照和指定使用事件双同，两正常round1 Leave成功，3329无监听、服务进程/临时库清理。共同观察数量与三个独立时基保存在healing-item-purchased-life-player-evidence.json；原raw healing-item-purchased-life-network-2026-10-05T04-50-40-381Z.json与同前缀-server.log。

只补真实购买角色与小包之后的生命恢复消费者支路。原效果、CPU策略、两局/保存重启与模块证据直接复用，不重跑；宠物拥有不作boundGear，原购入初值及完整Func2/M2父保持开放。
