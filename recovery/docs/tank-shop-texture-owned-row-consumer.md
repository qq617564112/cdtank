# 迷彩页拥有战车名单与箭头边界

UI59 / M5-10。正式 TankShopTextureView 的拥有名单复用 HomeOwnedTankRowContent，消费同 OwnedRoles.name、车型+24、剩余分钟+34及完整21项 CombatCatalog.tankTypes。原mode2工厂调用4d7e10/4d960f/4d88f1后，将实例+1c与owned1交4bb3bc；原列宽161，行161×56，选中图161×51。缺值空白，真实分钟0显示（0天）。现列表4px inset保持。

原六个EventClicked回调在候选首/末边界停止。正式箭头改用有限索引，不跨端循环；现候选目录、报价、SAVE事务及模型生命周期保持既有合同。原候选vector成员/顺序资格与全套禁用图状态仍未完成。

两生产文件为 apps/web/src/interface/account/tank-shop-texture.tsx 与 tank-shop.css，共同最终mtime2026-10-05 17:09:43.681610885 UTC。精确补丁和源证据分别见 tank-shop-texture-owned-row-consumer.patch、tank-shop-texture-arrow-bounds-consumer.patch、tank-shop-texture-owned-row-source-preparation.json、tank-shop-texture-arrow-source.json。

统一工程 recovery/output/map02-texture-owned-engineering.json：Web11404 type/build实际0，构建1m51，copy78142实际0。唯一3596/5626/9826验收器为 tests/browser-tank-shop-texture-owned-row.mjs --combined-new-row-arrow-bounds：同一浏览器会话先验两真实保存实例1/3与2/4的新名单三分辨率完整页，再回1920实例1验各可操作组件有限候选边界，正常Close并核无BUY/SAVE/SelectRole。该次不复验旧SAVE、Home导航、完整preview或Q/X。

## 未完成范围

完整UI59和商城父项保持开放。Q/X正式配置provider、原费用formatter、原候选成员/顺序、额外已装图标、原列表inset、字体及最终framebuffer精度尚未完整证明。原子页通过addChildWindow挂Tank根及偏移0/36已取得直接来源，见 tank-shop-texture-parent-source.json。

## 有限实际

10851实际exit0，raw browser-tank-shop-texture-owned-row-2026-10-05T17-15-46-024Z.json PASS。两真实保存实例1/车型3游骑兵与2/车型4飞毛腿，800/1920/3840六张完整图已亲看；原161×56名单、图集身份、轻型坦克、（0天）及selection/focus通过。1920实例1的当前正式U10/M10/XY4候选逐步原生点击，首末边界保持，strictShopClose/只读通过。部分完整图preview尚在加载，该范围不宣模型全状态ready或全页通过。

finally Chrome/server/Vite/temp四项清理true，3596/5626/9826亲检全空，GPU已直交Map3597/root。有限验收索引为 tank-shop-texture-owned-row-accepted.json，root独立主审已落 recovery/output/tank-shop-texture-owned-row-root-review.json，状态PASS_FINITE_TANK_SHOP_TEXTURE_OWNED_ROWS_ARROW_BOUNDS_CLOSE_SCOPE。
