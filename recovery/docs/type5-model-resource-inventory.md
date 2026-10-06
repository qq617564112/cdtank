# 类型5模型引用的本地资源范围

原资源目录及现有目录索引中的匹配结果：

| 引用 | 匹配结果 |
| --- | --- |
| youlincat.POL | `recovery/output/verified/assets/data/Data/effect/effect/youlincat.POL`，来源data.cpk，catalog逻辑路径`effect/effect/youlincat.pol` |
| bat/bianfu.cvd | 未找到对应文件名或逻辑路径 |
| bing/bing_1.pol至bing/bing_13.pol | 未找到对应文件名或逻辑路径 |
| m120.TGA及同名DDS/PNG | 未找到对应文件名或逻辑路径 |

检索覆盖原`CDTank/`现有文件路径、`recovery/output/verified/`已解包文件，以及`recovery/output/catalog/inventory.json`的4665个逻辑路径和所有版本。catalog包含已解包archive层、207个loose版本与32个download补丁候选；匹配忽略大小写并检查basename及路径变体。原目录现有CPK仅`CDTank/Data/data.cpk`和`CDTank/Data/music/music.cpk`，现有manifest分别为`verified/manifests/data.json`和`music.json`。

32个download候选的文件名已纳入索引，补丁payload尚未完整解码；本结果不证明其未解码内容或历史未保留文件中不存在这些资源。Dracula.log、CPKUpdate.log未检出上述名字。没有改动原文件、重新解包全档、制作替代模型或生成占位纹理。

类型5生产恢复应以找到的实际源资源为依据；缺失引用不能算作已经精确复刻的资产。
