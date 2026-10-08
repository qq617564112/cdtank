# 普通城堡受损表现接线

普通Castle身份、权威生命、攻击／恢复结果和Web受损消费者已接通。服务端使用源Castle身份及HP数据和项目采用的命中政策；Battle把sceneObjectHit／sceneObjectHealed中的castleDamage交给ScenePreview，后者按本Castle消费动作、效果、声音与伤害浮字。

| 地图／对象 | 原来源 | 当前消费者 |
| --- | --- | --- |
| 0002 Castle304/305 | 原obj05447/obj05448，CAS尾HP2000、组1/2；INI c1/c2/c3/n1/n2五动作 | 权威生命与普通伤害、SceneCastleState／Presentation／Visual、原挂点效果与独立声音已接；两型号普通受损／死亡有限证据见scene-castle02-presentation.md |
| 全部22 Castle | 位于0001/0002/0003/0005/0006/0008/0010/0011/0012/0013/0023，各两实例 | 使用本图发布资源和共同Castle状态／表现消费者；完整逐图实测范围沿各地图父项 |

0018／0020／0021三图.cas均空，0007亦无Castle；其普通Breach沿独立目标和破损消费者执行。

## 原入口与生产合同

`45d16f`为原Castle受损入口：扣减currentHP，必要时提高上限，限制下界，再按整数max/3及max/5处理动作、五挂点效果与声音。`castle-damage-native.json`已记录完整入口、14个HP边界及8个连续事务，具体命令见[scene-castle02-presentation.md](scene-castle02-presentation.md)。

SceneCastleState只消费已接受的currentHP／maxHP／delta；SceneCastlePresentation负责实时挂点、039/040/041树与GA48／SE03／SE07，SceneCastleVisual负责原五动作模型。正式Battle受损／恢复事件、快照重连、换局与离房清理均有消费者；建筑工具使用本队Castle恢复链。

## 未完成范围

原服务端伤害、可攻击资格和死后碰撞规则仍属已登记的项目采用政策。完整逐地图、原Windows像素和高清性能验收保持开放，既有304/305有限证据不扩大范围。041树内ww098已发布独立补作并映射audio.json，原声音内容与新增实际输出待验，详[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)；独立GA48／SE03／SE07的既有播放证据保持。
