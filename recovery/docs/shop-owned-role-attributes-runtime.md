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

## Buy 与 Owned

Buy 模式保持原商品目录视图：Pet 继续使用`petShopDirectoryDetails(petId)`；Tank 继续使用`TANK_SHOP_SOURCE_ATTRIBUTES`与`TankShopBuyParametersView`。拥有属性接线不改变 Buy 的目录属性、价格、容量或默认纹理。

Owned 模式沿用当前拥有列表选择、出售报价、购买/出售事务、pending/replay、来源生命周期与 read-only 状态。属性呈现继续使用`SourceFeedbackStaticText` alias、用户选字体、白字、原控件布局、`SourceImageScale value={1}`及现有 CSS 类。

## 既有字段边界

Pet 的六组技能、生命值、说明与预览保持既有确认记录接线：技能 base 从`0x44 + slot * 4`、rank 从`0x5c + slot * 4`读取，按实际 ID 查询战斗技能目录；生命值为`0x2c`；说明和预览按确认记录定义选择。技能弹窗、复制来源和只读状态不在本批改变。

Pet 熟练度仍为`petShopMastery(petId)`的原始宠物目录值。当前没有 confirmed OwnedRoles 熟练度映射，不使用猜测偏移或公式。

Tank 拥有侧的攻击/装甲额外值、侧后装甲、速度、转向、发射间隔与容量不在本批补值。

## 未证边界

这些字段是当前确认拥有记录的 Web 投影，原控件 setter 行为未证，不宣原成长、原服务器确认逻辑或当前战斗最终属性。原固定图中的单位、格式和附带符号不追加计算公式。

新商城拥有属性页面、Buy/Owned 切换、无拥有记录/缺字段/零值组合、高清与 4K 显示，以及原服务器客户端交互仍需实际页面和原始来源验收。本文件记录静态代码接线边界，不把静态代码当作实测证据。
