# 普通受击三部件与四部件代表

151的M/X/Y三部件原05–08均已通过普通map7命中的双网页实绘来源核验：正式hurtSelector1–4选择对应动作，三个原网格实际绘制，原morph帧与真实clock采样一致，双端普通受击动作可辨，单动作自然完成后恢复基础动作。001四部件代表复用既有四个普通方向的独立source/actual证据。本片没有修改生产消费者。

## 原来源

`combat-hurt-representatives-source.json/.log`核001的M/U/X/Y与151的M/X/Y全部05–08：原INI字段、MV3 duration、定时消息、所有mesh/part、发布GLB基础POSITION与全部morph POSITION delta、展开UV及LINEAR时间/权重逐值对应。151U原INI仅MV3注释，无动作、无几何部件，不用替代炮塔补齐。两车型原hurt duration2561，停止时间2461。151仅M在time160发送effect1，X/Y无该消息；两车型完整ELK均无05–08绑定，受击效果与声音保持原静默。

方向及原派发复用`combat-hit-native.json`的435745/431fe7/4059de分类、464e72→46897a/46c396三/四部件1–4→05–08以及flags4证据。原分类读取角色look，未以炮塔弹丸方向或位置向量替代。正式链为World普通hit.hurtSelector→Battle→BattlePlayers.hurt→TankView.hurt；原整数clock推进实际GLB采样，全部部件完成后回基础动作。

## 普通三部件实战

两个正式网页选择151与001，普通mode4/map7房间正常加入两个CPU满足默认minimum4。151账户在建房前导入`world-role-attributes-native.json`的原角色记录，保持账户选择流程；没有写入战斗位置、yaw、HP、clock、相机或事件。CPU通过正式追击与普通开火命中。151网页普通A/D保持自身look与实际CPU look的π、0、+π/2、−π/2差，分别取得selector1、2、3、4。第二网页以普通W/A/D观察目标，正常相机跟随角色，不设置截图相机。

05取`browser-combat-hurt151-2026-10-04T04-54-17-695Z.json`的普通CPU命中；06/07取`browser-combat-hurt151-visible-2026-10-04T05-07-34-879Z.json`的普通玩家命中；08取`browser-combat-hurt151-visible-2026-10-04T05-09-39-504Z.json`的普通玩家单发命中。玩家射击局以两个认证协议玩家通过Account、Join、Ready满足四人资格并维持正式心跳，没有CPU；观察网页以普通W/A/D驶近同源出生位置并朝向151，Space发射真实弹丸。08以80ms按键脉冲只发一次43伤害，目标157HP，停止射击后观察自然完成与基础恢复。三方向近距目标处于正常相机视野中。

每个动作完整capture的目标均为P1，全部M/X/Y源节点来自同目标；两个网页的正式hurtSelector命中事件逐方向相同。raw整体状态及接受范围见下表，不将其他目标或CPU151网格计入目标P1。

| 原selector / 动作 | 本地/观察端capture frame | 每部件实际draw本地/观察端 | 每部件morph状态本地/观察端 |
| --- | --- | --- | --- |
| 1 / 05 | 210 / 137 | 18 / 17 | 15 / 11 |
| 2 / 06 | 162 / 84 | 9 / 8 | 8 / 6 |
| 3 / 07 | 204 / 124 | 8 / 9 | 8 / 8 |
| 4 / 08 | 162 / 88 | 4 / 6 | 3 / 5 |

只读观察器记录实际mesh draw的源asset、M/X/Y、完整几何、UV、非索引拓扑、全部morph目标、当前权重、clock和worldMatrix，以及实际相机view/projection与原canvas。独立actual按原MV3全部展开顶点及帧逐值核几何，再按真实clock独立核线性权重；每个组件多个真实morph状态且非零。三部件均完成over2461后自然回01/02，原M effect1及完成消息派发前后instances、effect voices与skill voices不变。

原图与实际相机源投影候选确认双端四个动作均可辨：05原车体受击轮廓、06双炮口与正面回弹、07左倾、08右倾。观察网页近距角色轮廓遮挡目标部分下缘，目标上部车体与方向动作仍可辨；完整三部件实际提交另由源核验承担。全部原展开POSITION、morph目标及UV与观察几何逐值相同，线性采样权重最大误差6.661338147750939e−16。画布为640×360软件渲染。

`combat-hurt151-material-observation.json`只读记录独立生命周期局的P1原151模型材质与ready纹理状态，范围为该局实际观察时刻；历史hurt截帧没有逐draw材质URL记录。

## 独立生命周期

`browser-combat-hurt151-2026-10-04T05-02-09-745Z.json`使用明确60秒配置、相同普通mode4/map7双网页及两个CPU，未重跑受击方向，自然TIME_LIMIT后正常Rematch使同房进入round2。两端全部玩家alive、目标151为01且恢复200HP；CPU正常开始新局并开火03。正常Leave后players、instances、effect meshes、effect voices、scene voices、battle voices六项计数均0。专用3310/5340/9540无监听，三次运行的临时目录已清理。

`combat-hurt151-actual.json/.log`联合独立验收PASS范围为三部件完整source提交、原采样、静默、自然基础恢复和生命周期；`combat-hurt151-visual-review.json`双端原图/投影候选审查PASS。`combat-hurt151-accepted-index.json`保留各raw整体状态及其有效段。

## 接受索引

| raw | 整体状态 | 接受范围 |
| --- | --- | --- |
| `browser-combat-hurt151-2026-10-04T04-54-17-695Z.json` | FAIL | 05普通CPU命中、双端source实绘/可辨、自然基础恢复 |
| `browser-combat-hurt151-2026-10-04T04-58-39-644Z.json` | FAIL | 普通死亡09/满血复活01、自然OBJECTIVE结算 |
| `browser-combat-hurt151-2026-10-04T05-02-09-745Z.json` | PASS | 明确60秒自然TIME_LIMIT、同房再战、正常Leave |
| `browser-combat-hurt151-visible-2026-10-04T05-07-34-879Z.json` | FAIL | 06/07普通玩家命中、双端source实绘/可辨、自然基础恢复 |
| `browser-combat-hurt151-visible-2026-10-04T05-09-39-504Z.json` | PASS | 08普通单发玩家命中、双端source实绘/可辨、自然基础恢复、正常Leave |

## 四部件证据

001四部件普通05–08分别复用`combat-hit-t01-0020-actual.json`、`combat-hit-t01-06-0020-actual.json`、`combat-hit-t01-07-0020-actual.json`、`combat-hit-t01-08-0020-actual.json`及对应source文件。其普通双端事件、全部M/U/X/Y原几何绘制、真实morph采样、自然完成/基础恢复和原ELK静默已独立验收PASS，本片只将其列入代表索引。

## 限制

Web按最近开火/受击事件调度并在全部部件完成后恢复，不声称恢复原完整动作混合或角色回调顺序。原三部件本地受击相机响应仍未关闭。本片覆盖151新增普通四方向及既有001代表证据，不代表其余十九车型全部实战；软件画布不证明原Windows GPU像素一致或高清性能。原伤害与玩法数值沿现重建规则。
