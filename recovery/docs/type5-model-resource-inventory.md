# 类型5模型引用的本地资源范围

原资源目录及现有目录索引中的匹配结果：

| 引用 | 匹配结果 |
| --- | --- |
| youlincat.POL | `recovery/output/verified/assets/data/Data/effect/effect/youlincat.POL`，来源data.cpk，catalog逻辑路径`effect/effect/youlincat.pol` |
| bat/bianfu.cvd | 原实体未找到；现以`reconstructed`低多边形9帧振翅模型发布 |
| bing/bing_1.pol至bing/bing_13.pol | 原实体未找到；现以13种`reconstructed`棱晶/碎片模型发布，纹理依据为现存`bing.POL`风格及缺失的`bing.TGA` |
| m120.TGA及同名DDS/PNG | 原实体未找到；由`reconstruct_battle_media.export_m120`提供`reconstructed/battle/m120.png` |

检索覆盖原`CDTank/`现有文件路径、`recovery/output/verified/`已解包文件，以及`recovery/output/catalog/inventory.json`的4665个逻辑路径和所有版本。catalog包含已解包archive层、207个loose版本与32个download补丁候选；匹配忽略大小写并检查basename及路径变体。原目录现有CPK仅`CDTank/Data/data.cpk`和`CDTank/Data/music/music.cpk`，现有manifest分别为`verified/manifests/data.json`和`music.json`。

32个download候选已按原`CPKUpdate.exe`的XXTEA解码到`recovery/output/patch-sol-decoded`，16个XML/imageset可解析；全部候选与活归档逐字节相同。`Data/effect/effect.sav`的payload只在其中保留`data\effect\effect\bat\bianfu.cvd`与`bing_1.pol`等引用，未出现对应文件实体。`data.cpk`与`music.cpk`全索引查询也没有这些名称。`youlincat.POL`只有`m120.TGA`材质引用，没有同名TGA/DDS/PNG实体。Dracula.log、CPKUpdate.log未检出上述名字。补作只写当前worktree的`effect-models.json`与`reconstructed/battle/`，不伪造POL/CVD到原来源，也不改动`verified`。

类型5生产恢复区分原实体与补作：8个引用来自原实体，缺失的蝙蝠、13块冰和m120纹理以`provenance.kind='reconstructed'`发布，不能算作已经精确复刻的资产。

资源搜索的机器可读结果见`recovery/output/resource-search-missing/missing-battle-resources.json`。该报告把CPK/loose实体、下载解码实体和payload可打印引用分开；引用命中不提升为实体命中。
