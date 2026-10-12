# Map02 Plant 正常再战恢复合同

M3-05/M7-02：新范围为 source327 在同scene内普通接触隐藏后，下一自然round快照与root恢复可见。现有 mode1 aggregate 的327始终hidden=false，不能覆盖这个转换；既有接触、摆动、water与BG资格直接复用。

## 准备接口

`tests/helpers/map02-plant-round-reset-prepared.mjs` 导出 `hideMap02PlantForRoundReset`。Map拥有该独立helper；root拥有整局driver与正式房间流程。调用位置为map2合法四账户Ready进入round1 PLAYING后、启用普通Autopilot前。显式 `modeId` 默认1；可指定2使用合法自然OBJECTIVE终局。Plant快照/普通type100接触沿正式 modes1/2/3 资格，不扩大mode1-only Castle/ENV伤害权限。

参数 `readWorld` 只读正式页面world，`focus` 只将host页置前，`setKeys` 发送真实W/A/D keyDown/keyUp，`findPath` 复用当前原NAV消费者与正式阻挡，`goal` 来自已发布source327 placement中心。默认最多60s导航，停止条件为实际快照hidden、离开PLAYING或角色死亡；finally松开全部按键。返回输入与真实world，不能将未达接触当恢复PASS。

双页Login后Create/Join前安装既有 `installScenePlant02ContactObserver`，复用当前正确 `roomInfo.mapId` 与不限samples的累计drawcount，不主动load或重播环境声音。

需要新round真实绘制归属时，同入口追加独立 `installMap02PlantRoundResetObserver`（`tests/observers/map02-plant-round-reset-prepared-browser.mjs`）。该观察器仅source327原mesh的onBeforeRender，以ScenePreview revision/round累计实际count与first/lastFrame，另记正式reconcile后的hidden/rootEnabled。它不修改源数据、可见性、时钟或调用主动draw，保留原函数参数/返回值。现有contact observer不变。

## 实际范围

1. 双端当前round的PLANT:327实际snapshot hidden=true与rootEnabled=false作为新恢复前提；sourceEnabled原值不变。
2. 普通Autopilot与原规则自然终局，正常Rematch进入下一PLAYING；不注入时钟、事件、位置或胜负。
3. 双端下一round正式snapshot hidden=false、rootEnabled=true、sourceEnabled=true、29roots仍存在。按原source-ID与round归属，不以消息回放恢复。
4. 同scene环境owner/BG正常续用；不用新load或换voice作再战条件。正常双Leave后的原资源/ledger清理复用整局合同。

未达接触或没有自然下一round时保存有限记录，并完成普通Leave。此范围不追加旧327 pixelgate、water可见性、HD截图、旧Breach/Castle检查或声音输出门禁。root整局driver当前冻结；该helper仅prepared，尚未运行浏览器或取得再战恢复实际证据。

离线入口 `tests/helpers/map02-plant-round-reset-evidence.mjs` 的 `summarizeMap02PlantRoundReset` 读取保存的 `window.plantRoundReset`。它要求同一revision、连续round的hidden/rootfalse→visible/roottrue，原29roots与sourceEnabled保持；实际draw使用恢复round且lastFrame不早于恢复帧。状态恢复与实际绘制分别输出，不将guest无draw补成像素证据。该入口不发PASS，也不替代正常房间结果/双Leave主审。
