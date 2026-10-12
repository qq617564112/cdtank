# 缺失战斗资源搜索

本片只核对原包、loose 文件、32 份 download 运输文件与补丁解码结果，并将“实体存在”“payload 引用”“材质引用”分开记录。机器结果在 `recovery/output/resource-search-missing/missing-battle-resources.json`。

## 源覆盖

`data.cpk`活索引含 4,459 个文件，`music.cpk`含 14 个文件。download 有 32 个运输候选；按原`CPKUpdate.exe:0x438c50 → 0x43b330` XXTEA 解码后，16 个 XML/imageset 可解析，全部候选与活归档逐字节相同。`recovery/output/patch-sol-decoded`仅是本 worktree 的运输解码副本，不是额外资源实体来源。

搜索同时读取`recovery/output/verified/assets/data`及其子目录，包含`Data/scn/0002/0002.nav`等场景文件；未通过输出根目录的链接扫描。`CDTank.rar`在当前可读工作区不存在，唯一的`CDTank_1.0.5.torrent`是旧安装包元数据，不含本次目标 payload。

## 结果

| 目标 | 实体命中 | 引用命中 | 结论 |
| --- | ---: | ---: | --- |
| `bat/bianfu.cvd` | 0 | `Data/effect/effect.sav` | 保留原引用；无模型实物 |
| `bing/bing_1.pol`..`bing_13.pol` | 0 | `Data/effect/effect.sav` | 保留原引用；无 13 个模型实物 |
| `youlincat.POL` | 1，`Data/effect/effect/youlincat.POL` | 其本身 | 模型已有原实体并已发布 `youlincat.glb` |
| `m120.TGA`及同名 DDS/PNG | 0 | `youlincat.POL`偏移11252 | 原实体仍缺；已按原 POL UV 发布补作 `reconstructed/battle/m120.png`，不冒充原纹理 |
| map0018 `BG07.wav` | 0 | `Data/scn/0018/0018.obj`的 6 条 Sound 记录 | 原位置/参数已有；原 WAV 仍缺，已发布补作 `reconstructed/battle/BG07.wav`，不冒充原声 |
| `obj05438/c9.CVD` | 1，85,461 字节 | — | `data.cpk`活索引实体；非缺失 |
| `obj05440/c9.CVD` | 1，127,901 字节 | — | `data.cpk`活索引实体；非缺失 |
| `obj05441/c9.CVD` | 1，168,962 字节 | — | `data.cpk`活索引实体；非缺失 |

`data.cpk`全索引共有 40 个 live `C9.CVD` 文件槽位，覆盖 40 个型号目录。`05438/05440/05441`只是大小写显示与旧文档记录不一致，实物在包内；对应 98 个 Breach fallback 放置由 breach 分支处理。

## 剩余

- `bianfu.cvd`、`bing_1..13.pol`没有真实实体，不能以占位模型冒充。
- `m120`和`BG07`原实体仍缺；当前补作分别标记`provenance.kind='reconstructed'`，按原模型UV或原Sound消费者发布，不计入原命中。
- `effect.sav`内 15 条目标引用仅证明原 effect 定义引用过这些名称，不证明当前包内仍有对应文件。
- `youlincat.POL`已按现有 effect 模型链发布模型；其 `m120.TGA`补作由 `export_effect_models` 从 `reconstruct_battle_media` 调用 `export_m120`，写入 `part.asset`/`part.textureProvenance`，原模型和搜索报告不改。
- 当前`EffectModelRenderer`对`resolution !== 'published'`和缺少`part.asset`的 type5 资源直接拒绝，`MapEnvironmentSound`只在 `audio.json` 存在同名资源时建立 voice；补作经明确`asset`/catalog接入，不静默降级为其它模型或声音。
- 本次没有搜索网络发行版或推测其它历史版本；未解码/未保留文件不在结论范围内。
