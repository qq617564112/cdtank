# 战车3付费拥有建档

M6-06-T03正式交易模块 `AccountTankShop` 以当前认证账户和已有角色资料为基础，通过BEGIN IMMEDIATE事务读取余额、扣金钱、插入拥有equipment及tank_purchases receipt。首件仅开放tank3/MONEY，单价2500；代币250仍为源目录显示价格，原购买方式2不授权TOKENS购买。价格、纹理与四属性来源见 `tank-purchase-source.md`。

QUERY返回限定tank3产品及可用资料余额。BUY要求tank3、MONEY和8至80字符请求ID。相同账户/key/语义返回原receipt并标replayed，不再次扣款；不同语义拒绝。新key分配本账户inventory与role_records共同范围内首个未占用正实例。事务写入失败同时回滚余额、拥有记录和receipt，其他账户保持隔离。

拥有记录为明确重建未强化购买状态：完整21字段先0，+1c写实例、+24写3，+28/+2c/+30写源纹理30041/30042/30013，+3c/+40/+4c/+50写122/78/17/44。原客户端空构造证明字段结构和清零，不证明服务器购买初值；+34保持0、+6c按原TankPartSlot建立新购入槽容量（tank3为2），其余未知值不赋语义。槽容量复制是重建购入政策，原服务端producer未恢复；既有拥有记录和已保存回执保留其原值。原shop耐久度默认3未映射，未写入任何拥有字段。

`tankShopCatalog()`读取tankshop/tank源发布表一次，返回限定产品与内部四基础属性/moneyOnly。不依赖取证reader或创建item3库存，不向商城添加其他战车/强化/赠品。

首次 `npx tsx tests/tank-purchase.cts` 通过实际SQLite成功扣款/完整记录、共享实例分配、原receipt重放、不同币/定义拒绝、余额不足/缺资料/缺账户、其他账户隔离、新key独立记录、关闭重开后receipt及余额保存，以及余额更新后equipment写入失败的事务回滚。证据 `recovery/output/tank-purchase.json/.log`。正式API、页面购买、拥有选择入房由root接线和独立业务验收，本模块测试不替代玩家闭环。
