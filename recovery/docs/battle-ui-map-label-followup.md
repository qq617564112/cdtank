# 小地图与坦克头顶标签补齐（M5-04 / M5-05）

范围：战斗 HUD 的小地图（`picMiniMap`/`picMiniMapBound`）与坦克头顶标签。只接现有权威
快照字段，不改网络、服务端、共享观察规则，不重做已正确的摄像机与战斗场景。

来源：

- `game_main.xml` 的 `picMiniMap`(608,408,800,600) 与 `picMiniMapBound`
  八边框引用 `ditukuang1..8.tga`，以及 `picMiniMap` Alpha 0.5。
- `recovery/output/current-exe.asm`：小地图初始化 `0x47285c`（本人 `wotanke.tga` `0x5c9308`
  颜色 `FF5DF587`；选择子1/2 `danke.tga` `0x5c92ec` 颜色 `FF80ACF7`/`FFF57E78`，字符串
  `0x1c9308`/`0x1c92ec`；`viptanke.tga` `0x1c9324`），世界位置链 `0x4cc791→0x471684`，
  原192.0常量 `0x5c92c4` 与居中0.5 `0x5cd00c`。
- `hud-minimap-coordinate-source.md` 与 `hud-minimap-map-mappings.json`：25图 NAV/RPT 并集
  固定正方形范围与同一投影 `pixelX=192×(x-minX)/(maxX-minX)`、`pixelY=192×(maxZ-z)/(maxZ-minZ)`。
- `battle-hud-title-source.md`、`battle-hud-confirmed-rules.md`、`battle-player-nameplate-presentation.md`：
  真实称号优先（缺值默认 ID1“嗷嗷待哺”）、模式3 `isVIP` 王徽章、96×4 原血条与观察距离
  温和缩放。账户称号持有/选用与持久投影，以及 `PlayerSnapshot.title` 到 `HudPlayer.title`
  的接线见 UI-39 与 `battle-hud.ts`（`player.title?.name`）。
- `battle-hud-authority-state.md`：小地图快照只携带权威世界坐标，头顶标签消费
  `PlayerSnapshot` 的 `name`/`hp`/`maxHp`/`isVIP`/`title`。

已实施：

- 小地图标记不再以俯视底图已就绪为前提。只要收到权威快照且地图ID已有固定边界，即按
  `hudMinimapPosition` 投影玩家和占领/破坏目标；俯视底图仍按原 Alpha 0.5 随 `picMiniMap`
  一起绘制，底图未加载时权威坐标与目标不再被吞掉。
- 25图边界 lookup 与 `hud-minimap-map-mappings.json` 逐图双精度一致（25/25 无差异）。
  底图与标记共用同一份每图边界，未知地图ID不显示底图或标记。
- 目标/占领归属按本机队伍着色，与本机使用 `wotanke.tga`（`#5df587`）、本队 `danke.tga`
  （`#80acf7`）、敌方 `danke.tga`（`#f57e78`）一致；中立/个人模式显示为无归属。毁灭目标
  保留 `data-objective-destroyed` 低透明呈现，`contested` 覆盖白色描边。
- 模式3 的 `isVIP` 王附加原 `viptanke.tga`；坦克轮廓按 `bodyYaw`（缺省 `yaw`）旋转，原
  朝上箭头映射原世界方向 `(sin(yaw), cos(yaw))`，旋转只作用于轮廓、不作用于定位/王徽章。
- 完整八边框按原 `TopLeft/TopRight/BottomLeft/BottomRight/Top/Bottom/Left/Right` 引用绘制，
  父窗口 `overflow: hidden` 完成192×192裁剪。
- 头顶标签修正血条与生命数字的叠放：生命数字改为血条的同层后继行，标签盒高回到源
  44px（12标题+2+14姓名+4血条+1+11生命），底部锚点不再与模型重叠。当前主仓库明确
  隐藏本人头顶标签（`BattlePlayerLabels` 渲染循环排除 localPlayerId），本批尊重该策略，
  仅显示其它玩家/队友与敌人，含血量、名字、称号。保留个人模式其它玩家为敌方、真实称号
  优先（缺值默认 ID1“嗷嗷待哺”）、模式3 原22×12王徽章 `wanjiatouxiang_vip.tga`、姓名、
  原96×4 `wanjiaxuecao.tga`/`wanjiaxuecao_jindukuai.tga` 血条与当前/最大生命。
- 标签渲染入口为 `BattlePlayers.render → BattlePlayerLabels.render`；死亡、角色伪装替身、
  敌方有效光学迷彩隐藏，离房/再战经 `resetRound`/`clear` 移除旧条目，换模型经
  `entry.view` 重算模型顶边偏移。未新增静态 DOM。本批标签数字布局与 map 改动为本批最终
  记录，不写模型/AI marker 或过渡修正历史。

限制：

- 未运行测试、构建、类型检查或浏览器验收；完整高清/原版视觉仍待实测，M5-04/M5-05 父项
  保持未勾选。
- 原动态小地图纹理生成相机与整数矩形的完整producer仍未恢复；当前 25 图范围是本项目采用
  的 NAV/RPT 并集固定窗口，不是原整数矩形的逐值复现。
- 原世界标签的文字字体、精确高度与像素规则未取得；当前布局为“美观优先”的重建呈现，
  不声明为原世界标签规则。无独立勋章来源，未添加勋章。
- 乱斗第二加数 `DogsInfo` 含义仍未确定，与本批小地图/标签无关，按既有规则保持本人击毁数。
