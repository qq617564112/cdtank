# 商城拥有角色属性运行时边界

## 八个拥有字段

商城拥有模式只投影当前确认的`OwnedRoles`记录，不从商品目录、当前已装备角色或战斗最终属性补值。

Pet 使用当前选中的`owned.base`记录，实例键为字段 0：

| 原控件 | OwnedRoles 字段 |
| --- | ---: |
| `txtCritical` | `0x34` |
| `txtLucky` | `0x3c` |

Pet Buy/目录模式继续调用`petShopDirectoryDetails(petId)`，显示原宠物目录的 critical/lucky。

Tank 使用当前选中的`owned.equipment`记录，实例键为字段`0x1c`：

| 原控件 | OwnedRoles 字段 |
| --- | ---: |
| `txtAttack` | `0x3c` |
| `txtAttackExtra` | `0x40` |
| `txtPanzer` | `0x4c` |
| `txtPanzerExtra` | `0x50` |
| `txtAttackLevel` | `0x44` |
| `txtPanzerLevel` | `0x54` |

这些 Tank 字段仅在 Owned 模式渲染。实际字段值为 0 时显示`0`；缺少记录、缺少字段或无法确定当前选中实例时显示空字符串，不以目录值、装备值或战斗最终值回填。

BH 已确认的投影保持不复算：Tank Raw6（`txtAttack`/`txtAttackExtra`/`txtPanzer`/`txtPanzerExtra`/`txtAttackLevel`/`txtPanzerLevel`）按上表字段，Pet Raw2（`txtCritical`/`txtLucky`）按 base `0x34`/`0x3c`，Pet HP base `0x2c`。本批不把 Tank Owned 攻防聚合宣称为已恢复；Tank 侧现采用 `homeTankParameters` 的原 `429e41` 显示投影，原聚合是否等价于原战斗最终属性未证（见下“Tank Owned 五项聚合”的 Raw4 有限采用）。

## Tank Owned 五项聚合

原 mode1 的 `txtPanzerSide`/`txtPanzerBack`/`txtMoveSpeed`/`txtRotateSpeed`/`txtShootInterval` 读 `429e41` 聚合（`4b75ef`），与 Home 的 `4e8f88 -> 429e41` 同一投影，复用于 `apps/web/src/interface/account/tank-shop-owned-parameters.ts`，输入交 `homeTankParameters`（`apps/web/src/interface/home/home-tank-parameters.ts`）。

- 输入：选中 owned equipment 记录定义 `0x24`；当前 Pet=profile `+0xa4` 在 owned base 中匹配 `fields.get(0)`；现 Tank=profile `+0xa8` 对选中实例；五部件=profile `+0x148 + 4*slot`（`slot` 0..4）经现 `source.inventory` 过滤 `state===2 && ownedQuantity>0` 后取 `itemTableId`；`partEquipment` 按 exact target 合格门禁同步；`alreadyUsed`=profile `+0xa8` 等于选中实例。
- 输出：`txtPanzerSide`=`side`（表 `SideDef`+`SideDef`加成按 dataScale 12 夹取）、`txtPanzerBack`=`back`（`BackDef`加成按 dataScale 13 夹取）、`txtMoveSpeed`=`(TankMove+ItemMove加成+精通+2)×10`、`txtRotateSpeed`=原 Home `txtRotationSpeed`=`(TankTurn+ItemTurn加成+精通)×4−1`、`txtShootInterval`=`TankDelay×f32(0.1)`的`%1.1f`。
- 控件映射：Shop 控件名 `txtRotateSpeed` 取 helper 的 Home 键 `txtRotationSpeed`，其余同键；`TankShopOwnedParametersView` 仅渲染 Owned，缺任一确认源（`owned`/`record`/`profile`/`partEquipment`/`inventory`/`catalog`）时五项均空，不用 Buy 目录回退。
- 来源确认：交 `homeTankParameters` 前先确认实际消费来源。选中 Tank 三物品槽 `+0x58`/`+0x5c`/`+0x60` 要求真实 item 定义与非空技能定义；`alreadyUsed` 时当前 Pet 六 `base`/`rank` 对要求可解析真实技能、安装部件 `itemTableId` 要求真实 item/技能定义。缺字段或未定义非零 ID 返回空，不交 helper；确认空槽、技能 0、rank 0、空 item ID 为合法 no-op，不产生加成。
- 容量：原 mode1 无 `prgLoadingTime` setter（`4b2635`旁侧容量标记另走 Tank 表 `+0x98` TankPartSlot），本批不绘 Owned 容量进度、不复用 Buy `TankBullet/6`；`homeTankParameters.capacity` 只是 Home helper 独立输出，不冒为 Shop 值。
- Raw4 有限采用：`txtAttack`/`txtAttackExtra`/`txtPanzer`/`txtPanzerExtra`原指令读聚合 `+0x1c/+0x20/+0x24/+0x28`，当前按上文 BH Raw 记录字段显示，不宣 Owned 原攻击四项等于聚合或战斗最终属性；Raw4 采用为有限，原聚合完整身份与外层输入归属未证。

## Pet Owned 四组熟练度

Pet Owned 四组 `prgLightTank`/`prgMediumTank`/`prgHeavyTank`/`prgCruiser`（原 PetTable `+0x7c..+0x88`，`4b1150` 写聚合 `+0x54..+0x60`）由 `apps/web/src/interface/account/pet-shop-mastery.ts` 的 `petOwnedMastery({selectedBase, currentTank, isCurrent, catalog})` 给出。

- base：`selectedBase` 定义字段 8 的 PetTable 四组 `STankMastery`/`MTankMastery`/`LTankMastery`/`StugMastery`。
- 主宠临时被动：`isCurrent`（profile `+0xa4` 等于选中 base 实例 `fields.get(0)`）为独立采用资格，不与原 `429eb6` 的 `arg2+0x1c` 门禁等同；成立时并入该 base 六技能槽 `0x44+slot*4`/`0x5c+slot*4` 的被动（`rankedPetSkillId`+`triggerType===0`）精通；`rank0` 不借 `rank1`（`rank===0` 直continue）。
- 现战车被动：并入当前 Tank `fields.get(0x58/0x5c/0x60)` 三真实物品 ID 经 `catalog.items.skillIds` 的合法被动精通；物品 `skillIds===0` 跳过，非零缺定义仍 unknown。
- 进度：`progress=f32(mastery*f32(0.2))`，四原控件沿冻结 `ui.json` 源 background/progress 图与原 geometry，视觉 `clipPath: inset(0 … 0 0)` 只夹 0..1，原值保留；数字 readout 保持既有 geometry/font，不新增标签。
- unknown：未确认 skill/item/table 记录、缺必要字段或确认定义时四组空（不用 `petShopMastery(petId)` 纯目录值冒称 Owned），现实 0 显示 0。Owned base `+0x54..+0x60` 未确认为熟练度来源，采用原 setter/role 技能表未证。

## 派生与生命周期

新增五项与 Pet `profile`/`currentTank` 输入由组件内 `ownedConfirmed` 身份门禁，且必须属于当轮 Owned 请求与 source/owner context：进入/重复 Owned、离开 Owned 到 Buy/Texture、source/owner context effect 重跑立即使新投影输入失效；仅当轮 OwnedRoleSale `QUERY` 成功或 `SELL` 成功且 generation ticket 匹配、active session 时恢复。失败保持空，迟到响应不恢复。`mode`/`target`/`selected`/上下文更新按纯派生处理，`pet-shop.tsx`/`tank-shop.tsx` 现 session 生命周期清旧目标。不额外发 RoleProfile/Inventory QUERY、API、cache 或 schema；本批无业务写，不改费用、库存、学习、出售或战斗规则。

## Buy 与 Owned

Buy 模式保持原商品目录视图：Pet 继续使用`petShopDirectoryDetails(petId)`；Tank 继续使用`TANK_SHOP_SOURCE_ATTRIBUTES`与`TankShopBuyParametersView`。拥有属性接线不改变 Buy 的目录属性、价格、容量或默认纹理。

Owned 模式沿用当前拥有列表选择、出售报价、购买/出售事务、pending/replay、来源生命周期与 read-only 状态。属性呈现继续使用`SourceFeedbackStaticText` alias、用户选字体、白字、原控件布局、`SourceImageScale value={1}`及现有 CSS 类。Pet Buy 保持目录 `petShopDirectoryDetails(petId)`/`petShopMastery(petId)`；Tank Buy 保持 `TANK_SHOP_SOURCE_ATTRIBUTES`与`TankShopBuyParametersView`原 values 不变，不新增 Owned `prgLoadingTime`，不使用原 mode1 无 setter 的容量。

## 既有字段边界

Pet 的六组技能、生命值、说明与预览保持既有确认记录接线：技能 base 从`0x44 + slot * 4`、rank 从`0x5c + slot * 4`读取，按实际 ID 查询战斗技能目录；生命值为`0x2c`；说明和预览按确认记录定义选择。技能弹窗、复制来源和只读状态不在本批改变。

## 未证边界

Tank Owned 五项与 Pet Owned 四组熟练度都是当前确认为可复用 `429e41` 显示投影的 Web 采用。原 `429cf3` 的 `arg1[0]==427ba2(this)[0]` 等式只控制 `[0x633588+0x120]` 角色技能表遍历，两条分支在六技能循环前汇合、循环无条件执行；`429eb6` 另比较 `arg2+0x1c` 与 `427bf9(this)+0x1c`；Web `isCurrent`=`profile+a4` 是采用条件，不与 `429eb6` 等同，原 role 表 identity 未证。原 `429e41` 聚合的完整身份、外层输入归属、`429714` 技能 25 属性到目录映射、`429cf3` 角色技能表 `[0x633588+0x120]` 条目身份、Pet 记录映射的具体存储实例未证；不宣 Owned 原攻击四项等于聚合、不宣原角色技能表实例已证、不猜 Tank base `+0x54..+0x60`。原 server 规则、原 setter 最终色/字形/高清未恢复，聚合不等价于原服务器精准属性或当前战斗最终属性。

这些字段是当前确认拥有记录与 `429e41` 采用规则的 Web 投影，原控件 setter 行为未证。原固定图中的单位、格式和附带符号不追加计算公式。

新商城拥有属性页面、Buy/Owned 切换、无拥有记录/缺字段/零值组合、高清与 4K 显示，以及原服务器客户端交互仍需实际页面和原始来源验收。本批未宣 `unit`/runtime/restart/page/HD 通过，未运行测试、浏览器、build、typecheck。一次集中静态走查已完成，M5-10-OWNED-PARAMETERS 与本文件记录静态代码接线边界；本文件不把静态走查当作实测证据，所有来源/实测/页面/HD 未满足子项与父项保持 `[ ]`。
