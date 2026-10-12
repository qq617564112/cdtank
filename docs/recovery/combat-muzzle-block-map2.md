# 0002近障碍炮口射击

正式0002普通近障碍开火已验证：权威炮口阻挡的实际surface坐标双端一致，发射者没有弹丸；场景即时007原效果在两个网页实际帧中可见，SE30播放结束，效果自然到期，离房清空表现资源。

## 来源与消费者

正式普通开火先发送场景/自由瞄准的`fire.shotDisplay`，再检查角色到炮口30单位的重建阻挡段。段内阻挡时`terrainHit`携带实际surface坐标，不生成该发射者的权威弹丸。

源消费者`TankShotDisplay`沿原423956/489ba8，以item2001的第二技能4020显示`_root\online\007`及SE30。场景原4288fe端点算术将显示Y设25；重建炮口段使用角色Y+20。两事件使用不同查询及用途，各自坐标不要求相等。

`muzzle-hit-world.json`已证明原spawn、普通转向/237次移动/开火可达map2 route5 surface，真实terrainHit位于(-1463.986493,20,1195.174123)，该发射者无bullet。正式网页沿相同近地形区域，以普通键盘动作验证现消费者，不注入相机、世界状态或伤害。

## 双端屏内表现

`browser-muzzle-block-map2-first-shot-visual.json/.log`为独立首轮射击表现PASS。`tests/muzzle-block-first-visual.py`从已记录实际数据断言source玩家P1、双方capture handle2、fire.shotDisplay与实例origin严格相等、相同terrainHit载荷、owner bullet0、原几何实际提交、自然到期、SE30播放结束。

源数据为`browser-muzzle-block-map2-2026-10-03T21-11-18-383Z.json`的`firstShot`与对应`observed`完成状态。四个普通网页Ready满足原人数门槛4，两页正常转向/移动/开火，另两页静止；浏览器使用默认自动播放策略。Space经实际50ms输入采样在同一点产生两个正常装填射击，双方截图对应同一个第二实例handle2。

| 消费/事件 | 实际坐标或结果 |
| --- | --- |
| fire.shotDisplay | (-1465.763916015625,25,1194.7513427734375)，item2001 |
| terrainHit | (-1465.7639562160282,20,1194.7513226223725)，target terrain，双端载荷严格一致 |
| 发射者弹丸 | 0，双方事件及实际帧快照均无弹丸 |
| 007实例origin | 双端为同一shotDisplay点，逐float32相等 |
| 实际几何 | 双端2433烟粒子、2434及2435原爆炸sprite提交；主端另有2447光sprite提交 |
| 原纹理 | yan1.png、baozha1111.png；实际材质、顶点及自然到期完整记录 |
| SE30 | 双端原WAV、参数1、非循环、音量0.5，playing及ended，1.172426s |

`-first-1.png`与`-first-2.png`为双方该实例原效果的实际帧：主端黄色爆炸在本炮口上方，客端黄色/白色爆炸在远端蓝坦克背后清楚可辨。几何提交与屏内可辨截图均有对应source事件和同一端点，未用spawn计数代替实际绘制。

## 离房清理

同生产模块、同路线的`browser-muzzle-block-map2-2026-10-03T21-07-02-232Z.json`及`browser-muzzle-block-map2-run8.log`为完整PASS。权威terrainHit双端为(-1466.248474243187,20,1194.6360715610017)，即时显示为(-1466.24853515625,25,1194.6361083984375)；双端原烟/爆炸几何实际提交并自然到期，SE30播放结束。四页正式离房后instances/effectMeshes/effectVoices/battleVoices/players均为0，清理范围单独关联到首轮视觉manifest。

验收脚本`browser-muzzle-block-map2.mjs`使用独立3288/5318/9518、临时账户与浏览器目录；只读网页快照和正式地图surface用于正常键盘控制。每次产物有独立时间戳，原成功及失败记录完整保留。专用进程及监听已关闭，生产表现模块未修改。

## 限制

即时shotDisplay不是弹丸碰撞效果。场景/坦克查询几何、炮口段/伤害保持已注明重建范围；原terrainHit独立消费者和飞行消费者未恢复。源图的全部五draw描述符不等于同帧五几何节点可见。

`browser-muzzle-block-map2-2026-10-03T21-11-18-383Z.json`整体保持FAIL：独立首轮已完成，后续客端侧移受地形阻挡、额外射击在客端被裁剪；该后续范围不属于首轮视觉PASS。原整体状态未修改。
