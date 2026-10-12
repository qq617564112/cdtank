# 原静态接触正式网络有限验收

Map02/mode1 的完整已购 tank3/pet2 玩家通过普通移动接触 Plant327，原预测 OBB 静态通知的正式消费者首次隐藏植物并允许继续运动。四正常认证账户124个唯一共同 PLAYING 键的完整 players 与 scenePlants 全量相等，`scenePlantHidden/PLANT:327` 完整事件四端一致且各仅一次；四条 round1 Leave 成功，编译服务退出，3591监听为空。

专属 runner：`tests/role-static-contact-network.cts`。原 raw `role-static-contact-network-2026-10-05T16-27-09-674Z.json` 及同前缀 server.log，actual session15540 exit0；专属严格类型 session18062 exit0，日志 `role-static-contact-network-types.log`。封装 `role-static-contact-player-evidence.json` 已回链独立主审 `role-static-contact-root-review.json`，状态 `PASS_FINITE_MAP02_ORDINARY_PLANT_CONTACT_DUAL_NETWORK_SCOPE`。

## 来源与正式行为

复用 `tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z-checkpoint.sqlite` 的两位真实购入 tank3/pet2 身份。另两位正常新空账户沿现普通 tank1 入场资格提供原四人最低人数，本 run 没有 BUY、SelectRole、拥有/profile/库存写入。只有完整来源第一玩家发送58条递增 sequence 的普通移动/停止输入，所有输入 fire=false/useItem=0；无托管或活跃位置、生命、事件注入。

普通路径从原出生进入原 NAV 近点 `(-1984.56,520)`，再靠近 Plant327 的原放置位置 `(-1984.5618,404.0834)`。初始29个正式 Plant 均 enabled/visible，snapshot身份为 `PLANT:327`、sourcePlacementId327、sourceModel obj05413。raw 最早观察隐藏为 tick110，serverTime1791217636053；阶段快照为 tick111，两者分别保存。

接触后普通直行 tick116→124 前进51.9975403264原坐标单位；模拟0.4秒，服务器0.402秒，接收帧墙钟0.402秒，输入发出至停止墙钟0.404秒。该量只证明隐藏后正常运动继续，不作为墙钟性能门限。目标保持 hidden，仅一条指定事件，所有玩家生命上限/当前生命、积分、击毁和死亡计数不变；没有 fire/hit/destroy 事件。第一玩家 HP700、普通弹匣7保持。

原 `4272d7` 静态通知与 `44e081→45efb3→461dd9` 合同见 `role-static-contact-receiver.md`，复用两个专属 native/source证据，不重跑原 loader/controller。主线正式接口：`snapshot.match.scenePlants[] {id,sourcePlacementId,sourceModel,enabled,hidden}`；event.type scenePlantHidden、targetId PLANT:327、scenePlant.placementId327。工程复用 `plant-contact-tank-owned-engineering.json`。

## 限制

Map02本29 enabled Plant参与资格、原引用到现字符串放置身份适配及服务器隐藏/通知/回合重建为明确重建。本 run 不证明原 uint32对象ID和 enabled 运行 producer、Crush/Breach 接触、原完整 NAV 清理内核、声画、终局/再战/重启或全部车型/29逐实例；当前 browser验收独立进行，M2-03完整运动父保持未完成。
