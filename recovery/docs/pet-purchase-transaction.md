# 首只付费宠物账户事务（M6-06-P02）

`AccountPetShop.request` 提供宠物2“大麦”的目录与金钱购买。价格来自原 `pet.dat` 的 PetMoney3500；PetCoin350作为目录报价返回，购买只接受MONEY。购买在单次SQLite事务中扣资料 `+0x70` 金钱、创建独立 `role_records.kind=base` 拥有记录并写入账户请求收据，不写道具库存或自动选择宠物。

## 建档与来源

目录直接读取原pet2名称、说明、价格、MaxHP700、Critical20、Lucky8及六技能/等级。建档保存完整31数值字段：`+0`为分配实例，`+8`为定义2，`+2c=700`、`+34=20`、`+3c=8`；`+44..+58`保存10211/10221/10231/10241/10251/10261，`+5c..+70`保存5/1/5/5/1/0，其他字段保存0。购入名称为“大麦”。

完整字段集合遵守原拥有base消息合同；从原表复制数值/技能和未知字段清0是明确的重建未成长购买政策。六技能保存不会创建独立boundGear或自动绑定战斗被动。原请求与记录来源见 [pet-purchase-source.md](pet-purchase-source.md)。

## 事务规则

账户必须存在，BUY必须指定pet2、MONEY及8至80字符的字母/数字/下划线/连字符请求ID。账户角色资料必须已建立。`BEGIN IMMEDIATE` 内先查询同账户收据；相同购买回放原拥有记录，返回当前余额，不再次扣费或检查新增数量。新请求要求该账户拥有base记录少于10只及金钱至少3500。

新实例采用同账户库存及全部拥有角色记录未使用的最小正unsigned32 ID。成功只改资料金钱4字节，保留代币、其他资料字段和字符串；插入完整base记录及收据后提交。余额不足、数量达10只或任一保存失败均保留资料、拥有记录、库存和收据。不同账户的请求ID和实例空间各自独立。

## 验证

```sh
npx tsx tests/pet-purchase.cts
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Node --esModuleInterop --strict --skipLibCheck tests/pet-purchase.cts apps/server/src/accounts/pet-shop.ts apps/server/src/accounts/pet-shop-catalog.ts
```

事务检查用于发现错误币种/价格、缺失拥有字段、实例冲突、重复扣费、数量门禁顺序和部分保存；失败时修正相应事务规则再接入正式购买。PASS覆盖原pet2目录、3500金钱扣费、31字段完整值、六技能等级含0、资料仅4字节变化、库存/代币/字符串保留、独立实例、拒绝不写入、账户隔离、第10只购买、第11只拒绝、达上限及余额耗尽后的收据回放、重启回放，以及拥有记录/收据INSERT触发器失败后的整笔回滚。规则证据为 `recovery/output/pet-purchase-transaction.json`。

## 限定范围

原服务器购买建档producer与未知字段成功初值尚未恢复。本事务为重建账户规则；不提供其他宠物、代币购买、成长或技能绑定业务。购买后的选择和战斗生命通过既有正式角色路径接线。
