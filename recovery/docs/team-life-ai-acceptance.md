# M4-10-I501-AI 队伍生命自主使用验收

普通 CPU 和本人账户 Autopilot 在团队生命自然损失后，使用已分配且已有数量的 501；每次普通 `useItem` 接受只增加本队生命 1，库存有限且重赛不补回。mode1、双方生命正数、本人存活且角色 status2、本队生命低于地图 `tankLimit` 为重建 AI 策略资格。治疗、无敌和防护优先于 501，501 优先于攻击饮料。原有药效与资源沿用 I501 验收。

| 验收 | 场景与结果 | PASS 证据 |
| --- | --- | --- |
| CPU | mode1/map7 两个自然完整局；3 个 CPU 各开局归属 3 颗，首局共用 6 颗、次局共用 3 颗，各库存 3→1→0；709 次命中、99 次自然死亡 | `recovery/output/cpu-team-life.json` |
| 本人 Autopilot | 账户显式归属 3 颗，两自然完整局自动用 2+1 颗；3 次持久 CAS 提交均发生于生命增加前；787 次命中、110 次死亡、本人 25 次复活；数据库重开库存 0、原分配与原始字段保持 | `recovery/output/team-life-ai-world.json` |
| 真实网络 | 独立 :3185 两账户，正常房间、Cpu、Autopilot、Ready API；主人在真实炮弹造成团队死亡后自动用 1 颗，双端相同事件和施放快照 tick333（castTicks=[333,333]），库存归零；关闭托管后 sequence1 恢复实际移动；真实服务器 kill/start 后库存保持，另一账户库存为空 | `recovery/output/team-life-ai-network.json` |

CPU 验收在每次普通消耗边界读取权威快照，核对每个 controller 的生命数量已经包含前一个 controller 的施放结果。本人与 CPU 两局都逐 tick 以自然 `destroy` 减 1、接受的 `itemUsed501` 加 1，核对整个团队生命数组。只有本队生命低于本局初始值才有自主施放，双方正数且本队施放后不超过初始值。

本人高 sequence 手动 `PlayerInput/useItem5` 在托管期间不能触发施放或抢占控制。关闭托管后的低 sequence1 可恢复正常位移。世界重入通过正常添加 CPU 和 Ready 开局，并明确核对 PLAYING；耗尽库存没有额外使用事件。网络记录双端收到施放事件时各自最新权威 snapshot tick，严格取该相同 tick 的快照核对双方生命与参与者状态。

仅开局前用 `AccountStore.replaceInventory/assign` 明确测试账户的已有归属、用 `World.bindInventory` 明确 CPU 的有限测试库存。验收不写战中 HP、位置、生命、phase 或胜负，不添加免费商城途径。网络服务器在 finally 中断开双客户端并终止，临时数据库删除。

运行：

```sh
node --import tsx tests/cpu-team-life.cts
node --import tsx tests/team-life-ai-world.cts
node --import tsx tests/team-life-ai-network.cts
npx tsc --noEmit
```

本次网络施放前已有 34 个自然命中事件、1 个本队自然死亡事件；施放后同 tick 双端生命 `[30,27]`，人工恢复位移 3.0052。`npx tsc --noEmit` 通过，结束后 :3185 无监听进程。
