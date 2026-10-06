# React 战车、宠物与迷彩浏览器验收

运行入口：

```sh
node tests/browser-react-roles.mjs
```

`--roles-only` 只运行角色 fixture，`--camouflage-only` 只运行迷彩 fixture。组合入口使用独立临时 Chromium profile 和系统分配的空闲 CDP 端口，串行运行两个真实网页 fixture。角色 fixture 使用服务 3133 / Vite 5192，迷彩 fixture 使用服务 3019 / Vite 5200。每项使用自己的临时 SQLite 账户库；关闭页面、浏览器 context、Vite 和服务后删除临时库，组合入口关闭 Chromium 并删除 profile。任何失败保留具体等待条件、页面诊断、服务日志和完整 stdout/stderr。

生产入口为 `main.ts → App → LobbyView → HomeRolesView → HomeTankTextureSelectionView`。页面建立一个 React root；两个视图的对话框、源控件和事件由 JSX 管理。组合入口核对单 root 和两个 JSX 边界。浏览器通过真实 CDP 鼠标、Tab / Enter / Escape 操作正常页面；点击前滚动、等待 RAF 并核对实际 hit target。服务 pending 使用真实进程 SIGSTOP / SIGCONT，持久化验证使用真实服务退出、重启和页面 reload。

角色覆盖战车鼠标确认、宠物键盘确认、未拥有账户隔离、过期拥有记录的服务拒绝、刷新与服务重启恢复、pending 单请求、关闭重开隔离和焦点恢复。21 款原战车逐一载入实际模型，要求真实网格和渲染帧。战车和宠物源控件在 1920×1080、3840×2160 下按原 `ui.json` 的 AbsoluteRect 和 parent 偏移核对位置与尺寸，原 PNG 实际 decode；模型 canvas 像素匹配视口尺寸。关闭后旧预览 element 离开 DOM，Engine / Scene 释放，旧 frame 计数停止。

迷彩覆盖 U / M / XY 普通按钮草稿选择、余额与价格、服务确认扣款、未变化不扣款、代币不足回退、两个账户隔离、关闭未保存草稿后重新打开恢复、刷新与服务重启恢复。真实三槽变化、pending、确认和拒绝回退保持相同预览 element / Engine / Scene；变化只替换 TankView。支付 pending 只发一个请求，保留确认前余额，并保持对话框直到确认。原 shop / texture 控件在 1080p / 4K 下核对源坐标和 PNG；picModel 为原 218×217，canvas 像素匹配实际可见尺寸。

迷彩资源验证包括成功 HTTP 响应以及实际启用网格的 ShaderMaterial active textures：确认后的炮塔、车身和履带 A 纹理 URL 均 ready。重启后从普通大厅创建进入 WAITING，实际本地玩家为战车 2，owned 三槽为 U=21011 / M=21012 / XY=20023，玩家网格材质继续绑定这些纹理，随后正常退出。

## 夹具来源

两个 fixture 从 `recovery/output/role-owned-pair-native.json` 的第一条原生恢复样本，经 `readOwnedRolePairMessage` 解析，再明确设置服务器拥有记录。正常新账户本身没有战车拥有权；验收不将商店购买和角色建档作为已完成能力。

角色夹具为宠物 instance 71 / 类型 1、战车 instance 72 / tankId 2，纹理 20011 / 20012 / 20013。profile 为 0x170 字节，宠物确认槽 0xa4、战车确认槽 0xa8。另导入过期选择和 21 款模型记录，用于实际服务拒绝及预览范围。

迷彩两个账户各导入战车 instance 72 / tankId 2；profile 0xa8 选择该拥有战车，0x70 金钱为 2000，0x74 代币分别为 200 和 0。正常三槽确认费用为 110 代币，付款账户余量 90，金钱仍为 2000；另一账户不足拒绝后纹理和余额保持原值。这些是明确的服务器数据库夹具，浏览器不注入 Battle 状态、业务响应或 React 状态。Babylon 对象只用于观察真实 renderer、材质和资源释放。

## 已通过的证据

| 范围 | 原始证据 |
| --- | --- |
| 角色、宠物、21 模型、源 1080p / 4K、pending 隔离与释放 | `react-roles-2026-10-03T15-34-22-391Z-roles.json` |
| 迷彩原坐标、三槽付款与不足、源 1080p / 4K、同引擎与真实重启后 WAITING 材质 | `react-roles-2026-10-03T15-40-41-111Z-summary.json` / `react-roles-2026-10-03T15-40-41-111Z-camouflage.json` |
| 共享 preview 的装备关联回归 | `react-equipment-2026-10-03T15-37-27-485Z-summary.json` |

角色行列出角色子项 PASS；其同次组合汇总为 FAIL。迷彩独立汇总仅覆盖迷彩，为 PASS；装备关联汇总为 PASS。保留各运行的原始结果、FAIL 汇总和诊断，不将局部通过写为全组合通过。文件位于 `recovery/output/`，对应 PNG、服务日志与组合运行日志保留实际结果。两局 CPU 自然对局及双端 Effect11 / GA15 使用已有 `react-match-browser.md` 的 E-R01 证据。

## 限制

当前实际 selectable 迷彩目录均为 rarity 2，正常页面付款覆盖代币，未声称覆盖金钱购买。XY-B 资源真实载入；当前恢复的原生 XY setter 将 A 绑定两侧履带。普通 WAITING 重入验证确认后的拥有战车及材质，不重复整套五模式或两局自然对局。

本次角色、迷彩、装备的专属服务 / Vite / Chromium 端口均已关闭，临时数据库和 Chromium profile 已删除。
