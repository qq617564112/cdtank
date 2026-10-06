# 维修中心拥有战车名单

正式 Mend Tank 名单复用 HomeOwnedTankRowContent，按原51a094的161像素列与4bb3bc构造器呈现161×56行。名称来自 OwnedRoles.name，车型来自原+24，剩余分钟来自+34；类别取完整21项 CombatCatalog.tankTypes，天数按原 unsigned ceil1440，真实0显示（0天）。Tank页面的Part分类按钮按模式条件挂载。

两文件最终mtime为2026-10-05 16:34:32.769325218 UTC。统一工程为 recovery/output/map02-full-session-mend-engineering.json：Web65506 type/build实际0，构建1m57，copy4316实际0。

唯一只读首验74517实际exit0，raw为 recovery/output/browser-mend-owned-tank-row-2026-10-05T16-38-57-453Z.json。真实保存副本中的实例1/车型3游骑兵与实例2/车型4飞毛腿，在800、1920、3840三分辨率六张完整截图确认名称、图标、轻型坦克、（0天）和selection。Tank↔Part导航、六个维修按钮disabled及strictShopClose通过，未发生BUY、维修、槽或房间写入。raw的strictHomeOpener字段对应关闭Shop后返回data-room-card-shop。

Chrome、server、Vite及临时副本清理完成，3594/5624/9824亲检全空。有限验收索引为 recovery/output/mend-owned-tank-row-accepted.json；root独立主审为 recovery/output/mend-owned-tank-row-root-review.json，状态PASS_FINITE_MEND_OWNED_TANK_SOURCE_ROW_SELECTION_NAVIGATION_CLOSE_SCOPE。

## 未完成范围

维修与费用authority、额外已装图标、完整UI54和全Shop精度保持开放。
