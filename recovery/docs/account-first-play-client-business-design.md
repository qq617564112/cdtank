# 正常账户首玩建档与初始角色合同

## 结论

当前正式注册只建立 `accounts` 与 `account_credentials`，没有为新账户建立 `role_profiles`、`role_records`、初始钱包或任何可出击角色。正式 Login 注册成功后虽能进入频道和大厅，但 `OwnedRoles` 返回空列表，`SelectRole` 因缺少 profile 而拒绝，`CreateRoom`/`Join` 也没有可由已建档账户正常取得的坦克实例。

现有 operator `replaceRoleProfile`/`replaceRoleRecords`/`replaceInventory` 导入可以建立可玩账户，但它们是明确的本机导入入口，不是普通网页首玩入口。该缺口已由 `tank-ammo-qualification.md` 明确登记为“新账户仅写 accounts；原服务端新账户角色配给/初值 producer 缺失”。

本设计不补造原服务器的未知初始钱包、技能成长或完整配装，只采用原表中明确为零价的 `tank1` 小勇士和 `pet1` 阿呆，建立一个仅在新正式注册时执行的 Web 初始角色政策。客户端协议不变，已有账户、已有 profile、已有拥有记录、库存和成长均不覆盖。

## 当前正式入口与消费者

| 层 | 当前实际路径 | 行为 |
| --- | --- | --- |
| 网页登录 | `apps/web/src/interface/login/use-login-navigation.ts` | `register()`向现有 `Account` 请求发送 `{operation:'REGISTER', account, password}`；成功后进入 Channel，再进入大厅。 |
| 网页连接 | `apps/web/src/network/game-connection.ts` | 使用同一条已认证连接持久保存 token，后续 `Channel`、`RoleProfile`、`OwnedRoles`、`SelectRole` 和房间请求均从该身份发出。 |
| 注册事务 | `apps/server/src/accounts/credentials.ts` | `REGISTER`在 `BEGIN IMMEDIATE` 内建立或绑定账户并写 `account_credentials`；当前没有角色资料或拥有记录初始化。 |
| 账户存储 | `apps/server/src/account-store.ts` | `open()`只向 `accounts` 写 `id/token`；`roleProfile()`无资料时返回 `undefined`；`roleRecords()`空；`selectRole()`要求 profile 与 owned instance 已存在。 |
| 查询确认 | `apps/server/src/accounts/api.ts` | `RoleProfile`、`OwnedRoles`、`SelectRole` 都以当前连接认证得到的 `accountId` 为准，客户端不能指定另一个账户。 |
| 入房绑定 | `apps/server/src/accounts/battle-binding.ts` | 账户存在 profile 时，`roomTankId()`只接受 profile `+0xa8` 对应的本账户 equipment 实例，并通过 `+0x24` 解析实际坦克定义。 |
| 结算 | `apps/server/src/accounts/reward.ts` | 金钱写入已存在的 profile `+0x70`，成长写入 `account_growth`；profile 缺失时金钱无法入账。 |

## 来源事实

### 原表身份

发布表 `recovery/output/verified/tables/tank.json` 中的 ID1：

| 字段 | 值 | 用途 |
| --- | ---: | --- |
| TankName / TankInfo | 小勇士 / 陪玩家起步的第一台坦克 | 初始战车身份 |
| TankMoney / TankCoin | 0 / 0 | 原表零价 |
| TankType | 1 | 定义类型 |
| TankAtk / TankAtkBonus | 100 / 70 | 拥有装备 `+0x3c/+0x40` 的来源基值 |
| TankDef / TankDefBonus | 15 / 30 | 拥有装备 `+0x4c/+0x50` 的来源基值 |
| TankMove / TankTurn | 10 / 8 | 重算基础 |
| TankPartSlot | 2 | 拥有装备 `+0x6c` |

`tankshop.json` 的 ID1 行给出默认纹理 U/M/XY=`10011/10012/10013`、金钱价/代币价均为0、购买方式2、耐久度默认3。当前可售目录会过滤零价行，因此 tank1 不能经现有 TankShop BUY 取得。

发布表 `pet.json` 中的 ID1：

| 字段 | 值 | 用途 |
| --- | ---: | --- |
| PetName / PetInfo | 阿呆 / 原表明确称其为玩家初始狗 | 初始宠物身份 |
| PetMoney / PetCoin | 0 / 0 | 原表零价 |
| MaxHP | 600 | 拥有宠物 `+0x2c` |
| Critical / Lucky | 5 / 10 | 拥有宠物 `+0x34/+0x3c` |
| STank/MTank/LTank/STugMastery | 3/3/3/3 | `PET_BASES`按定义 ID 读取 |
| Skill0..5 | 10111/10121/10131/10141/10151/10161 | 原技能 ID |
| SkillLv0..5 | 6/6/4/4/1/0 | 原表等级上限来源，不是新购初值证据 |

`pet.json` 没有独立的新账户赠予记录；当前 PetShop 同样过滤零价行，因此 pet1 不能经现有 PetShop BUY 取得。

### 拥有记录读取合同

装备记录的唯一字段集合来自 `recovery/evidence/roles/role-owned-equipment.ts`。它必须包含全部21个字段，名称单独保存。当前 TankShop 重建购买已经给出可采用的成功初值政策：`+0x1c..+0x6c` 先清0，再写实例、定义、三纹理、四攻防值和容量；`+0x38/+0x48` 写1。耐久度默认3到 `+0x34` 的映射没有来源，不能把3写进 `+0x34`。

宠物记录的唯一字段集合来自 `recovery/evidence/roles/role-owned-base.ts`。它必须包含全部31个数值字段和名称。当前 PetShop 重建购买已经给出可采用的成功初值政策：未确定字段清0，名称与定义 ID、MaxHP、Critical、Lucky 和六技能 ID 写入，六技能 rank 写0；原表 SkillLv 值作为上限保存于定义来源，不能冒充已购入或已学习 rank。

## 可直接实施合同

### 创建触发

只处理正式 `Account` 请求中的 `REGISTER`：

```ts
{
  credentials: {
    operation: 'REGISTER',
    account: string,
    password: string
  }
}
```

触发点位于 `AccountCredentials.authenticate()` 已验证账号名/密码并固定最终 `session.accountId` 之后。必须在该请求已有的 `BEGIN IMMEDIATE` 事务内完成初始化，再写 `account_credentials` 并提交。因此新账户、凭据和初始角色要么全部成功，要么全部回滚。

以下情况不创建 starter：

- `LOGIN`、仅 token 的匿名会话和 room-only 自动连接。
- 当前 token 已绑定具名账户，注册因此改为新账户身份时，只对新身份执行。
- 目标账户已有 `role_profiles`、任一 `role_records`、任一 `inventory`、`account_growth` 或历史 reward ledger。已有账户一律保持原状态，不做迁移、重置或补偿。

初始化函数必须自身不再执行 `BEGIN`/`COMMIT`/`ROLLBACK`，只由注册事务控制提交边界。它需要可重复调用：已有 profile 或任一类 owned record 时直接 no-op。禁止使用会覆盖数据的 `INSERT OR REPLACE` 或 `replaceRoleRecords`/`replaceRoleProfile`。

### 精确初始记录

新账户共用当前账户实例命名空间，按“先 tank、后 pet”创建，空账户结果为：

| kind | 名称 | instance | 定义/纹理 |
| --- | --- | ---: | --- |
| `equipment` | 小勇士 | 1 | tankId=1；U/M/XY=10011/10012/10013 |
| `base` | 阿呆 | 2 | petId=1 |

装备记录完整字段：

| offset | 值 |
| ---: | ---: |
| `0x1c` | 1 |
| `0x20/0x44/0x54/0x58/0x5c/0x60/0x64/0x68` | 0 |
| `0x24` | 1 |
| `0x28/0x2c/0x30` | 10011/10012/10013 |
| `0x34` | 0 |
| `0x38/0x48` | 1 |
| `0x3c/0x40` | 100/70 |
| `0x4c/0x50` | 15/30 |
| `0x6c` | 2 |

宠物记录完整字段：

| offset | 值 |
| ---: | ---: |
| `0` | 2 |
| `4/8/0x28/0x30/0x34/0x38/0x3c/0x40/0x74/0x78/0x7c/0x80/0x84/0x88/0x8c/0x90/0x94` | 0，其中 `8` 随后写1 |
| `8` | 1 |
| `0x2c` | 600 |
| `0x34/0x3c` | 5/10 |
| `0x44/0x48/0x4c/0x50/0x54/0x58` | 10111/10121/10131/10141/10151/10161 |
| `0x5c/0x60/0x64/0x68/0x6c/0x70` | 0/0/0/0/0/0 |

### profile 与选择

写入一个新的 368 字节零初始化 `RoleProfilePayload`，字符串为 `['', '']`：

| payload offset | 值 | 含义 |
| ---: | ---: | --- |
| `0x70` | 0 | 初始金钱；不赠币 |
| `0x74` | 0 | 初始代币；不赠币 |
| `0xa4` | 2 | 已选 pet1 实例 |
| `0xa8` | 1 | 已选 tank1 实例 |

其余字节保持0。该 profile 建立后，既有 `RoleProfile` 查询、`SelectRole`、`selectedRoleSources()`、`roomTankId()` 和结算金钱写入都能按正式消费者工作。

不创建 `account_growth` 行，初始成长继续由现有读取返回 level1、其余0；不写技能点、星币、金钱或其它付费内容。首局结算仍由现有 reward 链写入 profile `+0x70` 和独立 `account_growth`。

### 正常的 Login → Channel → Home → 对局路径

1. 客户端发送现有 `Account.credentials.REGISTER`。
2. 服务端在同一注册事务中建立账户、starter 和凭据，并返回原有 `ResAccount {accountId, token, accountName}`。
3. 客户端继续使用现有 `Channel` 的 `QUERY/ENTER main`，不需要新确认字段。
4. Home 通过现有 `RoleProfile` 取得已选实例和零余额，通过现有 `OwnedRoles` 取得 tank1/pet1；角色页可直接选择实例1/2，或使用已预选值。
5. `CreateRoom`、`Join`、`QuickMatch`通过 profile `+0xa8`取得 tank1 实例，`roomTankId()`核对本账户 equipment 后进入正常房间流程。
6. FINISHED 后现有结算把本局金钱写入同一 profile，把成长写入账户 growth。无需赠送初始资金即可正常取得首局收益。

## Owned 划分

Core owner 只需修改正式账户代码：

- 新增 `apps/server/src/accounts/starter-role-records.ts`：从 `sourceTablePath('tank')`、`sourceTablePath('tankshop')`、`sourceTablePath('pet')` 构造上述两个 exact owned record；不把 builder 放入 evidence reader。
- 新增 `apps/server/src/accounts/starter-role-bootstrap.ts`：实现事务内条件检查与三条 `INSERT`（equipment、base、profile），不自行管理事务。
- 修改 `apps/server/src/accounts/credentials.ts`：把 bootstrap 回调注入 `AccountCredentials`，仅在 `REGISTER` 固定最终 session 后调用。
- 修改 `apps/server/src/account-store.ts`：构造注入回调，直接使用现有 `database`，不改 `replaceRole*` operator 语义。

没有独立 UI 生产改动。`LoginSourceView`、`ChannelSourceView`、Home 角色页和房间控件已经消费现有协议；新增 UI、客户端 grant 字段、充值/注册平台、feature flag、兼容层或迁移均不需要。

## 真正剩余限制

- 原服务器“新账户赠予 tank1/pet1”的成功 producer 没有恢复。原表零价、默认纹理和“小勇士/初始狗”文本提供身份来源，但本次 starter 仍明确是 Web 采用政策。
- `tankshop` 耐久度默认3如何映射到 owned `+0x34` 未恢复；starter 与现有 TankShop BUY 一样写0，不推定3天或其它含义。
- pet1 原表 SkillLv 的初始状态未恢复；starter 技能 rank 与现有 PetShop 新建政策一致写0，skill cap 仍从原表读取。`role+a0` 独立技能绑定 producer 仍属于 M6-04 的剩余父项。
- 原初始金钱、代币、技能点、成长值、库存、部件、装饰和额外宠物均无这个注册入口的来源，因此保持空/零，不扩充赠送范围。
- `TankMoney=0`/`PetMoney=0` 只证明这两条定义可作为 starter 身份，不授权开放任意零价商城商品。该合同只创建 tank1/pet1，不改变 `tankShopCatalog()`/`petShopCatalog()` 的筛选。
- 操作者导入的已有账户继续按其显式 profile/owned/inventory/growth 运行；本合同不修复、替换、迁移或补齐这些账户。
