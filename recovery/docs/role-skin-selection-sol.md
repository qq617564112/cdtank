# 原角色皮肤选择存储与接收合同（M3-03 / M6-01）

原 `OdlPlayer.m_arrayTexture` 是属性 32、记录 `+0x110` 的三个 32 位 unsigned 槽，角色 getter3 直接返回该存储。完整记录构造没有给这三个槽指定默认值；实际属性消息可以填入三槽，但接收过程没有执行皮肤拥有资格或来源转换。资料 selector44 保存的是分类5帽子装饰实例 ID（已验证10001救护车顶灯），不能当作这三个迷彩渲染表 ID；语义纠正与真实tankshop配置见role-skin-producer-sol.md。

## 初始化与角色存储

完整 `0x523303` 构造经原 `0x5227da` 创建记录后端，初始化数字字段与字符串，未写 `+0x110` 的三个 DWORD。四种预填 00/55/AA/FF 执行后，纹理槽分别保持 `[0,0,0]`、`[0x55555555]*3`、`[0xAAAAAAAA]*3`、`[0xFFFFFFFF]*3`。这证明构造没有默认纹理值，不能把零填内存效果当成原三槽默认初始化规则。

完整 `0x5221a0` 字段注册在 `0x5226de–0x522708` 绑定 `m_arrayTexture`、项数 3、元素宽度 4 与记录 `+0x110`。原 `0x4327ac` getter 的 selector3 分支 `0x4327f1–0x4327fc` 取得角色 `+0x2a0` 记录，再返回 `record+0x110`。

普通角色数组 setter `0x432826` 处理 0/1/2/4，selector3 走诊断并返回 false，不写纹理槽。不能仿照部件 setter 创建原本不存在的皮肤设置入口。

## 实际消息接收闭环

真实 `0x52a280 → 0x53dbd0 → 0x544950 → 0x52a8f0` 解码属性 32 数组，按操作 1/3 全量、操作 2 逐槽写入绑定存储，随后每个成功段通知属性 32。执行原 `0x4327ac` getter3 立即读到相同三槽。接收不更新 dirty 位图，也没有查 `tanktexture`、拥有皮肤或资料实例 ID。

九组用例覆盖上述三操作与三种值数组：零值、原 role001 渲染皮肤记录 `[10011,10012,10013]`、unsigned 边界 `[0xFFFFFFFF,0x80000000,0xF1234567]`。原消息字节、写入值、通知时刻和 getter 返回逐项一致。记录 ID 用例仅检查原传输保持这些值，不证明账户已拥有或选择这三种皮肤。

已确认的后续消费入口 `0x43c8aa` 按 U/M/XY 读取三槽，再把非零值交给原 `tanktexture` manager 查文件名；组件覆盖合同见 `role-skin-texture-sol.md`。接收属性值与渲染表查询的合同成立，账户合法来源仍缺少 producer。

## 资料帽子装饰实例与渲染表 ID

实际资料 virtual scalar getter（`0x42fdc5 → 0x42029e`，selector44）读取资料 `+0x118` 的帽子装饰实例 ID。原 `0x43ccf2` 在分类5拥有 vector `inventory+0x30/+0x34` 中比较每条记录 `+4` 的实例 ID。这与现存卸载入口 `0x4284ae` 的分类5路径一致：先取资料选择实例，再查本地拥有分类5记录。

四种实例值 71/0x80000000/0xF1234567/0xFFFFFFFF 通过真实资料 getter 与拥有 vector lookup 对照；不匹配实例返回空。两入口均保持角色三槽原值，未执行实例→三槽渲染表 ID 转换。这里没有把拥有皮肤记录的任何字段命名为原三槽 producer。

## 验证

```sh
npm run test:assets:skin-selection
```

共享receiveRoleArrayProperties对九个实际消息的unsigned值、有序通知与snapshot不变逐项一致；生产setArray(3)仍拒绝并保持dirty（role-skin-selection-integration.log）。

结果 PASS：四组完整构造预填、完整 schema 绑定、九组真实接收/getter3、selector3 setter 拒绝及四组资料实例/拥有查找。输出 `recovery/output/role-skin-selection-sol-native.json` 保留构造结果、全部消息字节、三槽值、属性通知与资料实例合同。

原执行覆盖完整构造、完整注册、管理器/字段 reader/通知及实际 getter。边界供给为内存分配、import 字节序转换、诊断和末端通知观察者；资料 getter/vector 查找不设 stub。回归用于发现构造新增纹理写入、绑定错位、数组宽度/符号损失、成功写入与 getter/通知脱节，以及把实例查找误当角色数组赋值。

## 剩余来源与页面接入

尚未确认已拥有战车如何按tankshop/specialtank配置产生U/M/XY三槽。tankshop战车1默认配置明确10011/10012/10013，但构造没有初始化，不证明账户获得/授权入口。selector44属于帽子装饰，不能沿该实例构造迷彩producer。生产接入需要已拥有战车→原配置→角色三槽的真实来源与创建/更新合同；此次未增加生产默认值或账户授权规则。
