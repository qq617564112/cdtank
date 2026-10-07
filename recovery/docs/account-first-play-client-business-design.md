# 正常账户首玩建档与初始角色合同

## 结论

正式 `REGISTER` 已接入首玩角色发放。`AccountCredentials` 在 `BEGIN IMMEDIATE` 事务内插入 `account_credentials` 后，调用 `grantRegistrationStarterRoles(database, session.accountId)`，再提交凭据、账户与初始角色。因此正常网页注册可得到 `role_records` 与 `role_profiles`，随后可经现有 `OwnedRoles`、`RoleProfile`、`SelectRole`、房间入口和结算链工作。

该合同的发放范围由 `apps/shared/content/definitions` 的 `starter` 标志决定，不按“所有零价定义都赠送”推断。当前索引中明确为 starter 的定义是宠物1阿呆、宠物101公主和坦克1小勇士；其余当前定义均为 `starter:false`。`defaultSelected` 只决定新 profile 的默认选择：宠物101与坦克1为 `true`，宠物1为 `false`。

## 当前实际入口

| 层 | 当前实际路径 | 行为 |
| --- | --- | --- |
| 网页注册 | `apps/web/src/interface/login/use-login-navigation.ts` | `register()`发送现有 `Account` 请求 `{operation:'REGISTER', account, password}`；成功后进入 Channel，再由现有客户端进入 Home。 |
| 账户事务 | `apps/server/src/accounts/credentials.ts` | `REGISTER`在同一 `BEGIN IMMEDIATE` 内建立或绑定账户、插入 `account_credentials`，随后调用 `grantRegistrationStarterRoles`；失败整体回滚。 |
| 内容来源 | `apps/server/src/content.ts` | 从 `apps/shared/content/definitions/index.json` 读取 definitions，并用 `GameContent` 建立 `content.pets`、`content.tanks`等索引。 |
| starter 发放 | `apps/server/src/accounts/starter-roles.ts` | 遍历 `content.pets.values()`和`content.tanks.values()`，只处理 `starter:true`，按定义构造 owned record，写 `role_records` 和新 profile 的默认选择。 |
| 记录契约 | `apps/shared/content/types.ts`、`catalog.ts` | `PetDefinition`/`TankDefinition`提供 `id`、`name`、`attributes`、`textures`、`skills.initialRank`、`partCapacity`、`starter`、`defaultSelected`。 |
| 查询与选择 | `apps/server/src/accounts/api.ts`、`account-store.ts` | `OwnedRoles`读取账户记录；`RoleProfile`读取当前 profile；`SelectRole`校验 owned instance 后写 `+0xa4/+0xa8`。 |
| 入房与结算 | `apps/server/src/accounts/battle-binding.ts`、`reward.ts` | profile `+0xa8`解析本账户坦克实例；结算金额写已有 profile `+0x70`，成长写 `account_growth`。 |

## 当前发放规则

### 实例分配与复用

`grantRegistrationStarterRoles` 先读取当前账户的 `role_records`，并建立 `inventory` 与 `role_records` 的实例 ID 并集。新记录使用该共同命名空间中的最小未使用正整数；每次分配后把 ID 加入 used 集合。

同一账户已有同 kind、同定义 ID 的记录时直接复用该实例，不再插入第二条记录：

- 宠物按 owned base `+8` 查找 `PetDefinition.id`。
- 坦克按 owned equipment `+0x24` 查找 `TankDefinition.id`。

因此 starter 发放不覆盖已有拥有记录、不重置实例键，也不因注册补发而制造同定义重复记录。

### 当前 starter 定义

| 定义 | 路径 | starter | defaultSelected | 说明 |
| --- | --- | --- | --- | --- |
| 宠物1 阿呆 | `apps/shared/content/definitions/pets/1.json` | true | false | 发放 owned base，非默认选中 |
| 宠物101 公主 | `apps/shared/content/definitions/pets/101.json` | true | true | 发放 owned base，默认选中 |
| 坦克1 小勇士 | `apps/shared/content/definitions/tanks/1.json` | true | true | 发放 owned equipment，默认选中 |
| 其余当前 tank/pet 定义 | 对应 definitions | false | false | 本入口不发放 |

### 宠物记录

`petRecord` 先为 owned base 的完整已知数值偏移建立零值，再写定义来源：

| 字段 | 当前值来源 |
| --- | --- |
| `+0` | 分配得到的实例 ID |
| `+8` | `PetDefinition.id` |
| `+0x2c` | `definition.attributes.maxHp` |
| `+0x34` | `definition.attributes.critical` |
| `+0x3c` | `definition.attributes.lucky` |
| `+0x44 + slot × 4` | `definition.skills[slot].baseId` |
| `+0x5c + slot × 4` | `definition.skills[slot].initialRank` |

名称使用 `definition.name`。其余已知数值字段沿用 starter builder 的零初始化；当前定义的具体 `initialRank` 值由 definitions 决定，不再以固定 rank0 代替。

### 坦克记录

`tankRecord` 先把 owned equipment 的 `0x1c` 至 `0x6c` 逐 DWORD 清零，再写定义来源：

| 字段 | 当前值来源 |
| --- | --- |
| `+0x1c` | 分配得到的实例 ID |
| `+0x24` | `TankDefinition.id` |
| `+0x28/+0x2c/+0x30` | `definition.textures.U/M/XY` |
| `+0x3c/+0x40` | `definition.attributes.attack/attackBonus` |
| `+0x4c/+0x50` | `definition.attributes.defense/defenseBonus` |
| `+0x6c` | `definition.partCapacity` |

名称使用 `definition.name`。其余结构内字段保持该 builder 的零值；不把旧文档中的固定实例键或其它字段硬编码为另一套值。

### profile 与默认选择

若账户已有 `role_profiles.payload`，starter 发放直接读取并保留该 payload 及原有两个 strings。若没有，则创建零初始化的 `0x170` 字节 payload，字符串为 `['', '']`。

| payload offset | 规则 |
| --- | --- |
| `0x70` | 新 profile 初值为0；已有 profile 保持原值 |
| `0x74` | 新 profile 初值为0；已有 profile 保持原值 |
| `0xa4` | 仅当当前选择不是本账户 owned base 时，写默认 starter 宠物实例；无默认项时保持/写入0 |
| `0xa8` | 仅当当前选择不是本账户 owned equipment 时，写默认 starter 坦克实例；无默认项时保持/写入0 |

已有 profile 的其它 bytes 与两个 strings 不被 starter 发放改写。已有账户的钱包、成长、库存、owned record 和已合法选择继续保留；本入口不做 migration、reset、余额补发或额外内容赠送。

## 正常用户路径

1. 客户端发送现有 `Account.credentials.REGISTER`。
2. `credentials.ts` 在同一事务内创建/绑定账户、写具名凭据并调用 starter 发放；返回原有 `ResAccount {accountId, token, accountName}`。
3. 客户端继续使用现有 `Channel` 的 `QUERY/ENTER main`，无需 starter 专用确认字段。
4. Home 的 `OwnedRoles` 返回 starter 拥有记录，`RoleProfile`返回新 profile；默认选择符合 definitions 的 `defaultSelected`。
5. `CreateRoom`、`Join`、`QuickMatch`经 profile `+0xa8`解析坦克实例，并使用 `roomTankId()`的 owner/definition 校验进入正常房间流程。
6. FINISHED 后现有结算把本局金钱写入 profile `+0x70`，把成长写入 `account_growth`；starter 钱包初值仍为0。

## Owned 职责

- `apps/server/src/accounts/credentials.ts` 负责注册事务边界和注册时调用。
- `apps/server/src/accounts/starter-roles.ts` 负责 definitions 驱动的 starter 遍历、同定义复用、实例分配、owned record 构造和 profile 默认选择。
- `apps/server/src/content.ts`、`apps/shared/content/types.ts`、`apps/shared/content/catalog.ts`、`apps/shared/content/definitions/*` 提供当前唯一 starter/defaultSelected 与角色定义来源。
- 没有独立 UI、新客户端 grant 字段、充值/注册平台、feature flag、迁移或兼容层需求；现有 Login、Channel、Home、OwnedRoles、RoleProfile、房间和结算消费者已经覆盖首玩路径。

## 真正剩余限制

- 现有实现是正常网页 REGISTER 的 Web 发放政策，尚未声明与原服务器新账户角色配给 producer 完整等价，也未以本设计替代全量首玩实测。
- `starter`/`defaultSelected` 当前定义内容决定发放集合；本合同不新增零价商城商品、不把 `prices:0` 自动解释为赠送。
- 初始 `money/tokens` 对无既有 profile 的账户写0，不创设未知初始余额；已有 profile 的资金保持。
- 当前 starter builder 的未命名字段、宠物技能成长上限与 `role+a0` 独立绑定等原始业务边界仍由其对应 M6/M2 父项追踪，不因首发角色已拥有而宣完整恢复。
- operator 导入账户和已有账户继续按显式持久数据运行；starter 只在缺失同定义记录或合法默认选择时补足，不迁移、不替换、不补偿既有数据。
