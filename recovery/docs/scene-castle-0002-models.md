# 田野路原 Castle 模型映射

0002 原 Castle304/obj05447 与 Castle305/obj05448 的十个动作资源已发布到独立 `scene-castle-0002.json`。五动作均来自各自原 INI 和同目录 MV3，不用 Breach 或新模型替代。该资源库供正式 Castle 状态消费者选择；当前资源核对不代表普通受损玩家流程完成。

`recovery/export_scene_castle02.py` 保留原 CAS sourcePlacementId、model、position、matrix；每个 action 保存原名字、MV3 logical file、既有正式 GLB asset、可用状态、各 mesh 原 bounds、durationMs、tags 与完整 attachment tracks。`export_scenes.py` 仅增加独立 import/call，原 map 场景记录不改。

| 型号 | c1 | c2 | c3 | n1 | n2 |
| --- | --- | --- | --- | --- | --- |
| obj05447 | 19 parts / 20 frames | 3 / 20 | 1 / 20 | 3 / 12 | 1 / 12 |
| obj05448 | 3 / 20 | 1 / 2 | 1 / 2 | 3 / 12 | 1 / 12 |

obj05447 的 c1/c2/c3 duration3201ms，n1/n2 为1921ms；obj05448 的 c1 为3201ms、c2 为1921ms、c3 为16001ms、n1/n2 为1921ms。全部有五条 `tag_spout1..5` 原矩阵轨道，tags数组为空。obj05448 c1/n1 的轨道序列为1/2/3/5/4，消费者必须按名字取轨道。原 GLB extras 已保留全部轨道、tags和时长，资源库逐值复制。

`tests/scene-castle02-source.py` 与 `scene-castle02-source.json/.log` PASS：两原CAS位置与矩阵、INI五动作、十MV3完整读取、全部帧扩展顶点/UV/morph delta、原材质17float/纹理名、GLB内嵌PNG与同目录DDS解码RGBA，以及全部轨道逐值相同。GLB直接复用已恢复的正式MV3转换资产，没有重复全仓转换。

## 接线与未完成范围

地图线拥有资源export/source；特效线拥有 `45d16f` 原受损执行、动作选择和模型/事件效果消费者；主线提供正式 Castle 身份、currentHP/maxHP、已接受普通攻击结果及权威生命周期。特效线 castle-damage-native.json 的完整45bdcb loader执行已确认 slot0..4实际GetTag名字为tag_spout1..5；source验证核该五名字在十动作的tracks中全部存在，按名字读取原矩阵。动作切换按独立45d16f原执行结果供给，不按INI序号或字段偏移猜测。当前库不携带猜测阈值、HP资格、服务伤害或效果。

M3-08 下 Castle 子项由主线登记集成；普通玩家攻击后的原模型状态、双端绘制、声音与退出/再战仍待消费者和接口交付后验收。源资源PASS不关闭M3-08父项，也不证明原碰撞或高清性能。城堡事件与源服务端producer缺口见 `ordinary-castle-presentation-gap.md`。
