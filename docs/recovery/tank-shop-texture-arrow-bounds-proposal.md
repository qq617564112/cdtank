# 迷彩候选箭头边界

UI59原六个EventClicked回调只在mode2推进有限候选索引；Dec在index<=0停止，Inc在index+1>=count停止。证据为 recovery/output/tank-shop-texture-arrow-source.json。现正式React用取模跨越首末项，普通玩家点击可达该不一致。

prepared独立补丁 recovery/output/tank-shop-texture-arrow-bounds-consumer.patch 只将取模改为有限范围guard，不改变当前候选来源/顺序、报价、SAVE事务或模型生命周期。原候选vector成员与原禁用按钮最终显示仍未完整证明。

只读验收采用 tests/browser-tank-shop-texture-owned-row.mjs --arrow-bounds-only：复用真实saved车型3，普通进入Texture后对每个可操作组件验证首项Dec保持、逐项Inc到末项再Inc保持、逐项Dec返回首项；正常Close及网络无SAVE。使用当前正式目录计算候选，证据不外推原全部目录资格。该模式不重名单三res、图标、geometry或旧SAVE业务。边界hunk已同名单两文件于2026-10-05 17:09:43.681610885 UTC原子接线。3596使用--combined-new-row-arrow-bounds在唯一会话内顺序验新名单与箭头边界，runner待root统一发行后启动。
