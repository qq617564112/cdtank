# HUD 八槽快捷栏

M5-04 / UI-09。原八槽消费者与确认数量业务已由主线亲审接受限定范围；整页父项保持未完成。

## 原布局与资源

`game_main.xml` 的 `all` 根为 800×600；`daojulan` 位于 (0,0)，300×47。背景采用原 `zhandou00/daojutubiao.tga`。八组 `picItem0..7` 各含 `daoju1..8`、`lblItem0..7`、`txtItemCount0..7` 和 `lengque1..8`，合计 41 控件。完整原属性保存在 `recovery/output/hud-item-source-page-source.json`。

原标签 Text 为 1–8、字体 SmallHT。数量控件 Text 为 `#`、字体 Cheap；该占位文字不作为真实数量。冷却控件使用原 `lengqueshijian.tga`，其绑定尚未确认。

## 已确认业务合同

`Battle.inventory(): Promise<ResInventory>` 调用现账户模块。`ResInventory` 包含 `records: InventoryWireRecord[]`、`hotkeys: number[]`；记录包含 `instanceId`、`itemTableId`、`ownedQuantity`、`battleQuantity`、`state` 与保留原偏移的字段。

默认键位 Digit1–8 通过 BattleInput 发送 `useItem: 1..8`。Digit1 直接选择默认炮弹，不查询实例；当前 Home 默认炮弹目录 ID 为 2001。Digit2–8 对应 `hotkeys[digit-2]`，按实例 ID 查真实库存记录。房内 Inventory API 采用 `world.inventory`，复制当前玩家库存和角色快捷槽数组；拥有数量与本局可用数量保持不同字段。

商品定义来自 `/combat-catalog.json` 的 `CombatItemDefinition`，以 `itemTableId` 查找，使用 `name` 和可选 `iconId`。图标路径为 `set:daoju0 image:data\ui\daoju\{iconId五位}.tga`；缺少定义或 iconId 时留空，不以 itemTableId 猜图。

## 页面归属与接线提案

UI 拥有独立 `hud-item-source-view.tsx/css`、BattleHudView 的可选 items 订阅及只读目录载入、专属来源/文档/浏览验收文件。纯呈现组件消费现 `SourceUi`、`CombatCatalog` 与可选 `ResInventory`。主线拥有 App / Battle 生命周期接线与独立 BattleItemInventory store：入局按房间/轮次/玩家查询，本人 itemUsed/ammoConsumed 成功后重新查询，清理与换房隔离晚响应，无轮询或本地扣量。

Digit2–8 数量显示真实 Inventory.battleQuantity，明确标记 `web-confirmed-battle-quantity`，为 Web 确认投影，原数量 setter 尚未恢复。默认炮弹数量、冷却、选中状态及鼠标点击行为仍未确认，保持空白或未绑定。原数字标签使用布局文字，不能作为自定义键位的业务指示。

## 实际验收

`browser-hud-item-source-page-2026-10-04T22-14-36-965Z.json` PASS。复制保留的合法 `home-tank-active-marker-browser.sqlite`，严格核同账户 token 身份，未向原库写入，未新增资金/角色/库存夹具。正常购买攻击提升剂 4 两份，Home Item 页真实配置 slot4 / Digit5；模式1/地图7、三普通CPU，资源 ready 后 Ready。

800×600、1920×1080、3840×2160 三张完整 PLAYING 页已逐张查看。原300×47栏、41控件、八原标签与 glyph、默认2001图及真实实例4图可辨，资源解码和 viewport 门槛通过。默认数量留空，冷却八槽未绑定且隐藏。

普通 Digit5 产生本人 itemUsed，随后真实 Inventory 查询确认 battleQuantity 2→1，HUD 更新为1；重复 Digit5 收到“攻击提升效果已生效”拒绝，HUD保持1且无拒绝触发的库存查询。Leave 后 HUD 隐藏、库存 store 清空、大厅建房按钮严格获得可操作焦点。没有用户伤害、旧FX/重启/五模式或结算重复验收。

首 `22-12-57-447Z` raw FAIL 保留，购买前账户未绑定到 checkpoint。驱动补 Page.enable 后严格验证私有 token 身份，不输出 token；该段不作为页面成功证据。专属类型 exit0 与主线统一 `hud-item-source-production-web-build.log` 标准生产构建 exit0/1m27 作为工程证据。

交片索引：`recovery/output/hud-item-source-page-accepted.json`。原数量 setter、默认数量/冷却/选中/鼠标 callback 尚未确认，该消费者不构成 UI-09、M5-04 或完整1:1完成。
