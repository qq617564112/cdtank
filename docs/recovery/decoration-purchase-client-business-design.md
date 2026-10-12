# 饰品购买客户端业务设计

## 范围

对应M6-06-HAT40。本批只处理原category5饰品的精确`10001..10040`。`classifyItemId===5`当前采用范围为`10001..11000`，本批不纳入`11001..12000`，也不扩展到category6、pet世界、原地图002、Seq或其它已关闭范围。

## 原来源事实

来源为`output/verified/tables/item.json`行`10000..10039`（ID `10001..10040`）及`output/catalog/combat-catalog.json`。40件原行均为`ItemType=5`，`ItemMoney`与`ItemCoin`正，`Durable=3`，`GGet`为0或2。`ItemMoney`作为金币单价，`ItemCoin`作为软星币单价；`GGet`与`Durable`保持原literal，不推导免费取得、寿命初值或递减。

| ID | 名称 | 原类别 | ItemMoney | ItemCoin | GGet | Durable | Catalog pointer |
|---:|---|---:|---:|---:|---:|---:|---|
| 10001 | 救护车顶灯 | 5 | 2000 | 200 | 2 | 3 | `/items/43` |
| 10002 | 警车顶灯 | 5 | 2000 | 200 | 2 | 3 | `/items/44` |
| 10003 | TAXI顶灯 | 5 | 2000 | 200 | 2 | 3 | `/items/45` |
| 10004 | 草莓 | 5 | 2000 | 200 | 0 | 3 | `/items/46` |
| 10005 | 猫王帽 | 5 | 2000 | 200 | 0 | 3 | `/items/47` |
| 10006 | 缎带蝴蝶结（红） | 5 | 1000 | 100 | 2 | 3 | `/items/48` |
| 10007 | 缎带蝴蝶结（黄） | 5 | 1000 | 100 | 2 | 3 | `/items/49` |
| 10008 | 缎带蝴蝶结（蓝） | 5 | 1000 | 100 | 0 | 3 | `/items/50` |
| 10009 | 缎带蝴蝶结（绿） | 5 | 1000 | 100 | 0 | 3 | `/items/51` |
| 10010 | 天使翅膀 | 5 | 4000 | 400 | 0 | 3 | `/items/52` |
| 10011 | 恶魔翅膀 | 5 | 4000 | 400 | 0 | 3 | `/items/53` |
| 10012 | 妖精翅膀 | 5 | 4000 | 400 | 0 | 3 | `/items/54` |
| 10013 | 书包 | 5 | 2000 | 200 | 0 | 3 | `/items/55` |
| 10014 | 护士帽 | 5 | 3000 | 300 | 2 | 3 | `/items/56` |
| 10015 | 牛角 | 5 | 3000 | 300 | 0 | 3 | `/items/57` |
| 10016 | 羊角 | 5 | 3000 | 300 | 0 | 3 | `/items/58` |
| 10017 | 墨镜 | 5 | 3000 | 300 | 2 | 3 | `/items/59` |
| 10018 | 猫型墨镜 | 5 | 3000 | 300 | 0 | 3 | `/items/60` |
| 10019 | 星型墨镜 | 5 | 3000 | 300 | 0 | 3 | `/items/61` |
| 10020 | 心型墨镜 | 5 | 3000 | 300 | 0 | 3 | `/items/62` |
| 10021 | 书呆眼镜 | 5 | 3000 | 300 | 0 | 3 | `/items/63` |
| 10022 | 防风镜 | 5 | 3000 | 300 | 0 | 3 | `/items/64` |
| 10023 | 忍者护额 | 5 | 3000 | 300 | 0 | 3 | `/items/65` |
| 10024 | 水汪汪假眼 | 5 | 3000 | 300 | 0 | 3 | `/items/66` |
| 10025 | 喜悦假眼 | 5 | 3000 | 300 | 0 | 3 | `/items/67` |
| 10026 | 愤怒假眼 | 5 | 3000 | 300 | 0 | 3 | `/items/68` |
| 10027 | 悲伤假眼 | 5 | 3000 | 300 | 0 | 3 | `/items/69` |
| 10028 | 狗盆 | 5 | 3000 | 300 | 2 | 3 | `/items/70` |
| 10029 | 大中华炒锅 | 5 | 3000 | 300 | 0 | 3 | `/items/71` |
| 10030 | 书本 | 5 | 3000 | 300 | 2 | 3 | `/items/72` |
| 10031 | 黑猫耳 | 5 | 3000 | 300 | 0 | 3 | `/items/73` |
| 10032 | 白狗耳 | 5 | 3000 | 300 | 0 | 3 | `/items/74` |
| 10033 | 耳机 | 5 | 3000 | 300 | 0 | 3 | `/items/75` |
| 10034 | 螺丝钉 | 5 | 3000 | 300 | 2 | 3 | `/items/76` |
| 10035 | 原始骨头 | 5 | 3000 | 300 | 0 | 3 | `/items/77` |
| 10036 | 镇腰剑 | 5 | 3000 | 300 | 0 | 3 | `/items/78` |
| 10037 | 檞寄生 | 5 | 3000 | 300 | 0 | 3 | `/items/79` |
| 10038 | 圣诞帽 | 5 | 3000 | 300 | 0 | 3 | `/items/80` |
| 10039 | 爆竹 | 5 | 3000 | 300 | 0 | 3 | `/items/81` |
| 10040 | 南瓜头 | 5 | 3000 | 300 | 0 | 3 | `/items/82` |

## Web采用availability

现`apps/server/src/accounts/shop-catalog.ts`的`partShopItems(catalog)`在既有category8..12与精确marker资格之外追加本批40个ID。普通`Shop QUERY`返回这些商品，普通`Shop BUY`按现有`apps/server/src/accounts/shop.ts`事务执行：服务端校验catalog成员、`MONEY|TOKENS`逐币种正价、数量`1..10`、余额、requestId与账户事务，成功后写owned inventory实例、receipt与spending ledger。`apps/server/src/accounts/shop-api.ts`继续负责非`WAITING`拒绝、刷新profile/inventory并广播。

Web不为购买路径新增API、schema、未知字段、客户端价格或客户端余额。初始库存与owned记录均不预置；只有成功BUY后才出现owned实例。`GGet=0或2`不改变该规则，`Durable=3`也不提供免费取得或额外grant。

## 原Home装配路径

category5已有ordinary owned/equip路径：`apps/shared/combat/equipment-target.ts`将category5/6路由到`DECORATION`；`apps/web/src/interface/home/home-equipment.tsx`按`DECORATION`显示候选；`apps/server/src/accounts/api.ts`的Equipment `DECORATION`请求进入`configureCosmetic`，由`apps/server/src/account-store.ts`校验owned记录并写现profile selector。购买成功后，owned Hat列表和既有装备入口继续使用新owned实例，不新增第二套装备模型。

新购精确40件饰品单次BUY一个实例，采用3天＝4320分钟，从购买成功时以原事务锚定到期时间；这不改变原Durable字段，具体合同见`decoration-purchase-expiry-runtime.md`。

现`apps/web/src/interface/account/part-shop.tsx`与`part-shop-source-page.tsx`复用原`rdoShopHatPage`：仅在确认`Shop QUERY`实际返回category5且命中精确40 gating时开放Hat浏览；Common与Mark保持原行为。商品显示沿用现Part列表、名称、说明、图标及原`ItemMoney/ItemCoin`正价，购买沿用普通BUY与确认后的inventory/profile。

## 边界与继承

已售category8..12的74件普通部件继续由现`partShopItems`提供，本批不重复追加。`2010`原`ItemMoney/ItemCoin=0`，不进免费`Shop BUY`，继续沿现mode5 breach掉落取得。`2016`已沿普通正价弹药取得链接入，详`ammo2016-client-business-design.md`；原025 stop caller仍为独立来源边界。

当前consumer包括普通BUY、账户事务、钱包、receipt、inventory、owned Hat列表、Home `DECORATION`装配及战斗饰品显示。`rooms/snapshot.ts`按确认装配实例投影`PlayerSnapshot.decoration`，`BattlePlayers`通过`BattleTankDecoration`加载共享定义的模型／贴图并消费TankView饰品挂点，换型、卸装、换局和离房释放owner。

期限方面，`AccountPartMaintenance`成功维修后以`anchorMaintenance`保存到期时间，库存／维修查询按真实墙钟投影剩余分钟，交易转移到期时间。新购的`AccountShop`在原扣款／库存／receipt事务中为精确40件单实例写入4320分钟并锚定到期时间；重放不重新起算，旧拥有记录不回填。3天与购买成功起算为采用规则，原`Durable=3`初值／起算来源仍未闭合，见`decoration-purchase-expiry-runtime.md`及`battle-remaining-integration.md` X。

## 待验限制

商城、装配、战斗模型及维修期限生产接线尚未实测。新购期限采用3天并已接；原server出售授权与successful stock producer、原`Durable`初值／起算规则、逐币种真实支付、余额不足／重放／重启、真实页面操作、双端可见性与HD仍未完成。M6-06父项保持开放。
