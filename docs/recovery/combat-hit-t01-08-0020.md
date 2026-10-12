# 0020普通001方向08受击

普通0020双001、两CPU与真实Ready实战通过：双端同P1→P4非致死selector4命中，四个原08组件实际绘制、自然morph变化与源采样一致，完成后恢复01。原M/U effect1消息不产生受击效果或声音；普通Leave六项资源计数归零。生产消费者无需修改。

## 原来源与正式入口

`combat-hit-t01-08-0020-source.json/.log`为PASS。四原INI的08字段分别对应08M/U/X/Y.MV3；duration均2561，每原mesh16帧。M为Box109、U为Box120、X为Box110、Y为Box111，各一源mesh，共四。发布GLB基帧POSITION、十五morph POSITION delta、展开UV与LINEAR动画时间/权重逐值对应原MV3；原metadata duration与tags一致。

M/U各有time160 effect1/1416378268，X/Y没有该定时消息。完整692字节001.elk与发布groups一致，仅03/attack1→`_root\online\004`，无08绑定；08无受击声音或替代效果。

方向分类、selector1..4分派与flags4、正常actor clock复用既有`combat-hit-native.json`和`tank-actor-clock-runtime.md`依据。正式业务链为World普通hit.hurtSelector4→Battle→BattlePlayers.hurt→TankView.hurt→预载原08四组件时钟→EffectRuntime.message。起始clock1、事件以previous < eventTime <= current跨越触发，回调time为当前clock；time160是资源keyframe。

## 普通双端实战

`browser-combat-hit-t01-08-0020-2026-10-04T02-30-00-285Z.json`与`browser-combat-hit-t01-08-0020-run.log`完整PASS。普通mode5/0020建房/加入，双001与两CPU满足min4，双方Ready。50条实际world/输入样本保存：S拉开距离，A/D将双方look差对齐至−π/2，方向键瞄准，Space普通射击。未写玩家位置、HP、clock、相机或事件。

两端记录相同P1→P4两次selector4/value43，均非致死，无destroy。两端capture分别frame322/266，目标HP257、alive，实际提交全部M/U/X/Y原08网格；实际近景原001倾斜受击姿态和远端目标截图保存。

| 网页 | 每组件实际draw | 每组件morph状态 | 最大原采样权重误差 |
| --- | --- | --- | --- |
| 1 | 10 | 7 | 5.551115123125783e−16 |
| 2 | 10 | 9 | 1.2212453270876722e−15 |

`tests/combat-hit-t01-08-0020-actual.py`按真实mesh名选择原08 MV3节点，以每节点16原帧的GLB float32时间和当前clock逐draw计算线性morph权重，四源网格均实际draw且权重非恒定/非零。`combat-hit-t01-08-0020-actual.json/.log`为PASS；两真实capture.canvas PNG为`combat-hit-t01-08-0020-accepted-1.png`与`-2.png`。

M/U两次原effect1回调均为跨越后的真实clock：主端1089/704，客端354/659；调用前后instances/effect voices/skill voices完全一致。scene052原五树与普通开火效果独立存在，未计作受击新效果。四组件over1870030194在2461完成；主端frame325恢复01/HP257，客端frame276恢复01/HP214，均alive。完成消息也不产生额外效果或声音。

## 清理与范围

双方普通Leave后players、effect instances、effect meshes、effect voices、scene voices、battle voices六计数全0。独立`combat-hit-t01-08-0020-process-cleanup.json`核3304/5334/9534无监听、专属临时目录无残留。

本片无生产修改，无需重新构建。001同map自然结算/再战与死亡/复活复用既有`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`和`combat-death-t01-actual.json`；本片完成selector4/08受击表现与普通Leave，不重跑账户或长两局。

## 限制

内部软件画布320×180，原GPU像素与高清性能不由本片证明；其他战车、完整动作混合优先级及原伤害规则仍为既有边界。服务弹丸和43伤害沿现重建规则，本片只关闭实际08方向表现。
