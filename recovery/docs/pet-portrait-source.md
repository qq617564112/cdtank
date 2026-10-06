# 战斗头像的宠物定义来源

原战斗头像使用角色绑定的 **PetTable定义ID**，不是TankTable定义ID。现有 `export_ui.py` 遍历tank表并把映射命名为tankId，正式 `battle-hud.ts` 根据player.tankId取头像，是与原选择入口不符的假设。购入pet2并选用后，必须把选中宠物定义2传到正式HUD，才能显示大麦头像与本机表情；只完成购买、生命重算仍不能交付正确宠物头像。

## 有限入口链

原角色创建 `0x426509–0x42651e` 从消息+78取定义，调用真实413c83获取PetTable、411068查询，命中后写角色+2a4。旁边 `0x426524–0x426539` 才用413c95取TankTable并写角色+2a8。既有role-table-binding-native.json执行了这两段区分；role-pet-base-native.json的完整43a91c加载确认PetTable记录+c为ID。这些既有结果本轮直接引用。

头像初始化 `0x4d0801–0x4d080f` 按槽位esi是否0分支，读取角色+2a4到eax，再取同一表记录+c作为格式化编号。槽位0走本机大头像，其他槽跳转4d0f62。该位置直接读取PetTable记录，不读取当前拥有实例、tank类型、tank定义、PetType或名称。最终 `0x4d155f–0x4d156e` 调用4c7633选择已初始化图片槽，再通过IAT5c013c调用CEGUI StaticImage::setImage；资源定义与表情状态机是两层来源。

## 本机和其他槽资源合同

| 槽位 | 原图集 | 原图片名称 |
| --- | --- | --- |
| 本机槽0 | `%d0`，参数为pet定义ID | `data\ui\%d\%d%s.tga`，两个%d都为pet定义ID，%s为原表情后缀 |
| 其他槽 | `zhandou00` | `data\ui\zhandou\%d_normal1.tga`，%d为pet定义ID |

静态读取实际EXE常量5d12c8/5d12a8/5d1264/5d1248/5c8264，确认上述格式。攻击初始化4d0832–4d0849另取同一PetTable+c，使用5d12c0常量`_attack`；既有normal/wound/yeah等表情资源与状态机保持同一宠物编号。远端初始化将小normal1图复制到表情槽，不能给远端换成本机大表情图。

因此大麦pet2本机图集20，正常资源 `data\ui\2\2_normal.tga`，攻击 `data\ui\2\2_attack.tga`，其他槽 `zhandou00` / `data\ui\zhandou\2_normal1.tga`。本机/远端死亡图沿既有统一die/die_2资源，与宠物编号无关。

## 可直接接线与当前缺环

资源导出应以原pet表ID构建头像映射，资源名称公式保持原值；正式snapshot需携带当前账户确认选中宠物的PetTable定义ID。此值从拥有base+8及已绑定宠物定义取得，随WAITING选择确认、正式入场和再战源生命周期同步；客户端不能从tankId推定宠物。生产PlayerSnapshot当前只有tankId而没有宠物定义字段，HUD也以tankId选图，需补这条正式来源再接UI。

同tank不同pet应产生各自宠物图，同pet不同tank应保持同图。客户端按本机槽/其他槽分别用上述资源，沿既有PortraitState处理攻击、受击、击毁、死亡与复活；切换pet定义时清旧头像资源/状态的时机可沿当前tank切换清理机制改为正确来源。缺账户宠物来源应保留缺失，不自动选pet1或把tankId当后备头像编号。

原定义选择入口已足够接线；运输选中pet定义的snapshot字段及Web资源索引名称是重建跨端表达，原原型字段与资源公式有直接来源。若不解决这个入口，普通玩家“买大麦→Home选用→进入对局显示大麦头像”仍会错误显示战车编号对应图，双端正确宠物显示无法完成。

## 范围

本轮一次静态入口核对并保存原EXE字符串到 `recovery/output/pet-portrait-source-sol.json`。未重跑表情状态native、atlas裁剪/像素或全图，也未修改生产。此前ui-runtime.md把该编号称为tankId的描述应在生产修正时同步改为pet定义；既有tank编号夹具浏览器通过不能证明原头像来源正确。完整Windows像素、其他HUD业务与原排序保持原验收范围。
