# 我的家所选战车实例装备客户端业务设计

对应M5-07-EQUIPTARGET、M5-07/UI-32与M6-01。范围是“我的家”战车列表当前展示的
owned 战车实例进入装备页，以及该实例下的装备、部件、说明与账户成长显示。

## 原来源事实

原 `myhome.xml` 为 625×404 根，战车与装备页共用 `myhome_panzerpage.xml`；当前源目录
没有独立 `myhome_equip` 布局，`UI-37` 实为 `myhome_playerpage_awardsummary.xml`，不能
用作装备编号。原装备页消费 `HomeSourceRoot` 源框与导航、`rdoTank`/`rdoEquip`/
`rdoCommon`/`rdoHat`/`rdoMark` 五源按钮、`lstEquip` 原 `SelectionImage` 与拥有名单；
`picInternalPart0/1`、`picExternalPart0/1/2` 五个部件槽，加 `picHatIcon` 装饰与
`picMarkIcon` 标记。

原 owned 战车记录提供四攻防 `+0x3c/+0x40/+0x4c/+0x50`、车型定义 `+0x24` 与剩余分钟
`+0x34`，对应 `txtAttack/txtAttackExtra/txtPanzer/txtPanzerExtra`、`txtTankType`
与 `txtStability`。`txtPanzerSide/txtPanzerBack/txtMoveSpeed/txtRotationSpeed/
txtShootInterval/prgLoadBullet` 使用 `homeTankParameters` 的原 Home
`4e8f88 -> 429e41` 显示投影；`edtTankDesc` 是按 owned `+0x24` 匹配的原说明控件，
`txtMoney` 取 `RoleProfile.profile+0x70`，`txtListQuantity` 只作已确认拥有列表长度
投影。该投影是原 Home 显示值，不是已装配最终战斗属性。`txtOriginality` 与
`txtTankStatus` 的原 producer/字段语义未取得。

## 入口接口

HomeRoles 以当前 `displayed` owned 记录的实例 `+0x1c` 经
`onEquipmentPage(instanceId)` 上报 App，App 保存为本次装备目标并作为
`tankInstanceId` 传入 `HomeEquipmentView`。没有选中列表条目时按正式当前实例入口。
大厅、商城等其它普通装备入口在无 target 时显式清除本次目标，进入服务端正式当前
实例，不沿用上一次残留。Close、返回角色页/玩家页、logout/account 以及连接或
session 世代变化清空本次目标；返回角色页时把本次目标交给角色页作为初始显示选择。
原 Home 目录 selection、Close、导航、focus、modal 与快捷键行为保持。

## 实例判定

装备页对同一目标并行首查 `Equipment {operation:'QUERY', tankInstanceId}`、
`Inventory`、`OwnedRoles` 与普通 `RoleProfile`。显式目标存在时要求 Equipment 响应
`Res.tankInstanceId` 严格等于请求 `tankInstanceId`，只接受请求目标、同 session/
generation 的返回；target、battle 或账户世代变化重建 session 并清空旧 bundle、
资源错误、候选与创意点，卸载或失效后迟到查询与旧图像回挂被忽略。

真实当前出击实例只取普通 `RoleProfile.profile+0xa8`，当前宠物取同一普通 profile
`+0xa4`；`alreadyUsed` 比较 Equipment 目标 ID 与正式 current，不使用 Equipment
投影 profile 自比。只有 `alreadyUsed` 时把当前宠物精通/被动与当前已装部件加成并入
现 `homeTankParameters`；非当前目标保持 helper 的 owned-only 显示投影，不并入 current
宠物/部件，不新增本地初值或战斗计算。目标槽位、`slotCount`、装饰/标记实例、
`bindings` 与说明来自 Equipment 确认与真实 Inventory；装备槽图标、binding 名称、
说明与模型入口保持原消费者，图标按 Home 装备页既有
`set:daoju0 image:data\ui\daoju\NNNNN.tga` 规则显示，空槽不画图。

## 装配置换与持久

既有 targeted `EQUIP`/`UNEQUIP` 请求继续携带该目标 `tankInstanceId`，请求权限、
槽位写入规则与事务顺序不变，成功/拒绝后按服务端确认刷新 Inventory/OwnedRoles。
持久化以账户与拥有战车实例为键，`tank_equipment` 对账户内装备实例唯一；装备页切换
战车投影其独立槽位，保存仅在目标也是当前出击战车时更新账户战斗 profile。不临时
调用 `selectRole`、不写装备槽以外的账户状态，不新增 API、schema、后端、wallet 或
grant。

## 生命周期

查询 pending 与查询 failed 是两个独立终态。四请求 bundle 任一失败时进入 query
failed 并写入现 status 错误文本，失败不当作确认空数据；资源就绪而查询失败时结束
`aria-busy`，对话框不再永久标记为载入中。现错误区提供当前 `tankInstanceId` 的
“重试”，仅递增 attempt 触发同一 useEffect 完整重载四请求，重试沿用原 target、仍
严格校验响应目标，不把目标重置为当前实例；重试与首查共用同一 session/generation
与卸载取消，无额外计时、轮询、cache 或 framework。资源加载的独立 pending 生命周期
保持，其错误仍走既有资源反馈区域。

## 创意点与未知控件

两页 `txtOriginality` 绑定普通 `RoleProfile`：优先 `growth.originality`，其次真实
已存 `playerSummary.originality`；真实 `0` 显示 `0`，两者缺失留空。不读取 raw
`profile+0x9c` 冒充最新 growth，不用默认成长对象造 `0`，不涉及 wallet/grant/持久写
或外部 API。该显示明确为 Web 采用的账户成长，不是原 Home `txtOriginality` producer
的恢复。`txtTankStatus` 无确认字段语义、offset 或 producer，保持留空。

## 明确未知与限制

原 `txtOriginality`/`txtTankStatus` producer、原 owned 四攻防 setter 与成长过程、
原动态数量 producer、部件详情 destination/producer、完整 93 控件 1:1 与高清字距均
未取得。说明区采用 Web-readable 深色文字与普通滚动，原说明最终色/字形/滚动条绘制
未证明。本批只做 production 接线与静态走查，未运行 unit、test、browser、build、
typecheck、lint 或 generator，不把代码走查当作页面/HD/持久/source 实测。战车/装备
整页、保存重启、双端与完整父页范围仍未验收，M5-07/UI-32/M6-01 父项保持未勾。
