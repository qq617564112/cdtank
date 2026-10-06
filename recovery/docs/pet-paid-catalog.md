# 八只付费宠物目录与购买（M6-06-PPAID）

正式宠物目录开放原pet表全部8个正金钱价定义：2、3、4、5、102、103、104、105。玩家可按各自原金钱价购买独立拥有base记录，再由既有Home选择路径选用。`AccountPetShop.request` 按请求petId查目录，成功扣款、保存完整31字段和该定义的收据。

| 定义 | 名称 | 金钱价 | 代币报价 | 基础HP |
| --- | --- | --- | --- | --- |
| 2 | 大麦 | 3500 | 350 | 700 |
| 3 | 毛姐 | 4000 | 400 | 650 |
| 4 | 迅猛龙 | 4500 | 450 | 650 |
| 5 | 猎师 | 5000 | 500 | 700 |
| 102 | 忍者猫 | 3500 | 350 | 650 |
| 103 | 黄金母舰 | 4000 | 400 | 750 |
| 104 | 刽子猫 | 4500 | 450 | 650 |
| 105 | 猞猁 | 5000 | 500 | 700 |

名称、说明、报价、MaxHP、Critical、Lucky及六技能/等级全部直接读取原pet.json。原493d4f购买入口只检查金钱；正式BUY继续只接受MONEY，代币价作为源报价显示。零价定义1/101不在付费目录。

## 保存与重建政策

每笔新购入分配同账户库存及全部角色未占用的正实例；拥有记录+0为实例、+8为请求定义，+2c/+34/+3c复制该定义MaxHP/Critical/Lucky，六技能与原等级逐槽复制，包括0级。完整31数值字段其余值清0，名称取原表。实例分配、正价目录开放及购入初值采用明确重建服务端政策。

现有单事务扣款/独立base/收据保存、账户隔离、10只容量及回放保持。相同账户请求ID用于另一出售定义时拒绝并保留原值；同定义回放已有收据，不再次扣费。详细事务及原来源见 [pet-purchase-transaction.md](/workspace/cdtank/recovery/docs/pet-purchase-transaction.md) 和 [pet-purchase-source.md](/workspace/cdtank/recovery/docs/pet-purchase-source.md)。

## 验证

```sh
npx tsx tests/pet-paid-catalog.cts
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Node --esModuleInterop --strict --skipLibCheck tests/pet-paid-catalog.cts apps/server/src/accounts/pet-shop.ts apps/server/src/accounts/pet-shop-catalog.ts
```

PASS：8定义源报价与名称/说明、每定义完整31字段及六技能/等级、独立实例、实际金钱扣费、代币/其他资料/字符串/库存保留、同定义无扣费回放、跨定义同请求ID冲突和零价/TOKENS拒绝。检查发现错误目录定义、价格、建档值或收据定义时应修正对应生产查表与事务写入。证据保存于 `recovery/output/pet-paid-catalog.json`；既有pet2原子回滚、账户隔离、容量和重启规则证据沿用 `pet-purchase-transaction.json`。

## 限定范围

原服务器可售名单与成功建档producer尚未恢复；该正价开放和初值为重建政策。拥有六技能保存不建立boundGear战斗绑定；本片不开放成长、零价获得或代币购买。Home选用及入场/恢复由既有角色路径和集成验收承担。
