# 商店坦克详情顶部类型栏

商店坦克详情中，名称下方、`剩余天数`上方的浅色横框显示**坦克类型**。截图所选小旅鼠的原 `TankType=1`，对应文字为**轻型坦克**。来源为原布局 `txtType`、原 Tank 表及商城详情赋值指令。

## 布局与文字

原 [shop_tankpage.xml](../../recovery/output/verified/assets/data/Data/ui/layouts/shop_tankpage.xml#L334) 中，浅框是 `tankeshengjiqu/hangditu1`，相对父区域矩形 `(5,6)–(145,29)`；覆盖它的 [txtType](../../recovery/output/verified/assets/data/Data/ui/layouts/shop_tankpage.xml#L350) 为 `(9,10)–(74,29)`，横向居中于自己的文字控件。原文字控件占浅框左半部分，不能据背景宽度推定文字要在整框中央。

[Tank 表](../../recovery/output/verified/tables/tank.csv#L3) 的小旅鼠为 ID2、TankType1。原 [gamestring 表](../../recovery/output/verified/tables/gamestring.csv#L588) 给出四类文案：

| TankType | gamestring ID | 显示文字 |
| --- | --- | --- |
| 1 | 680 | 轻型坦克 |
| 2 | 681 | 中型坦克 |
| 3 | 682 | 重型坦克 |
| 4 | 683 | 突击炮 |

## 原商城详情赋值

原页面在 `0x4b3171–0x4b3199` 绑定控件并保存到页面成员 `+0x48`，见 [原指令](../../recovery/output/current-exe.asm#L245569)。购买与拥有模式都为此成员设置类型文字：

- 购买模式：`0x4b6eef` 读取所选 Tank 定义行 `+0x50`，按 1/2/3/4 选择 gamestring 680/681/682/683；`0x4b7005` 取页面 `+0x48`，`0x4b700f` 调用文字 setter。见 [类别分支](../../recovery/output/current-exe.asm#L249925)及 [setter](../../recovery/output/current-exe.asm#L250008)。
- 拥有模式：`0x4b75ab` 调用 `4d960f`，`0x4b75b2` 取同一页面 `+0x48`，`0x4b75bc` 设置文字。`4d960f` 按拥有记录 `+0x24` 查 Tank 定义，再调用同一类型 getter `4d87bb`。见 [拥有 setter](../../recovery/output/current-exe.asm#L250400)及 [定义查询 wrapper](../../recovery/output/current-exe.asm#L289762)。

## 相邻期限栏与当前接线

下一行的 `剩余天数` 是独立图片 [shengyutianshu](../../recovery/output/verified/assets/data/Data/ui/layouts/shop_tankpage.xml#L443)，矩形 `(9,32)–(74,49)`；其数值在右侧独立 [txtDurable](../../recovery/output/verified/assets/data/Data/ui/layouts/shop_tankpage.xml#L365)，矩形 `(83,34)–(142,50)`。它不占顶部类型框。

当前 [TankShopSourceRegions](../../apps/web/src/interface/account/tank-shop-source-regions.tsx#L8) 绘制 `hangditu1` 和期限标签；[TankShopView](../../apps/web/src/interface/account/tank-shop.tsx#L258) 通过同名称文字组件挂载 `txtType`，沿原控件坐标和字体显示类别。购买模式读取当前确认商品的 `tankType`；拥有模式按所选实例的 `+0x24` 定义 ID，在完整 `CombatCatalog.tankTypes` 中查询类别。两者复用左侧名单的 [sourceTankKind](../../apps/web/src/interface/account/tank-shop-row-display.ts#L1) 四类文案映射，随选择直接派生；缺值或未知类型显示空白。

## 限制

本结论确认控件用途、文案、布局和原客户端赋值路径；没有原 Windows 客户端像素截图验证。本次接线未运行测试、浏览器验收、构建或类型检查。小旅鼠存在于原 Tank 定义表，但原 [tankshop 表](../../recovery/output/verified/tables/tankshop.csv#L1) 无 ID2 行；原类型规则支持其显示“轻型坦克”，不构成原商城曾上架小旅鼠或其购买期限的证据。当前新增上架策略见 [全部付费坦克商城目录](tank-shop-full-catalog.md)。
