# M1-09 至 M1-13 首件缺口审计

本审计只回答两件事：首件宠物饲料在重建服务中的接线状态，以及原版验收仍缺什么。已有专题证据不在此重复展开；证据索引见 `healing-item-runtime.md`、`healing-dispatch-sol.md` 和对应 `recovery/output/m1-first-item-*.{json,log}`。

## 状态

| 项目 | 已接线并可直接关闭的重建子项 | 仍未恢复的原版部分 |
| --- | --- | --- |
| M1-09 | M1-09-B：槽号请求进入 World，按当前账户实例执行自用、缺血判定、恢复和拒绝；双连接通过。 | 原 3c9e 服务端处理器、FuncType2 执行者、Target1 权威含义/权限、满血/死亡成功条件和 `field10/field14` 语义未知。客户端请求入口不提供这些因果证据。 |
| M1-10 | 建议补列并关闭 M1-10-B：成功先提交数量事务，再改生命并广播；CAS、保存失败、满血、旧序列均不扣量；重启和账户隔离通过。 | 原 3c92 的产生条件、成功回包与扣量/施放的绑定未知；当前事务是重建规则。 |
| M1-11 | M1-11-B：显式 fixture CPU 和本人账户托管均沿普通 `useItem` 输入，按缺血自主使用，逐实例消费，两局结算/重启不回补。 | 独立 CPU 持久账户的配置/库存来源及原客户端托管依据未恢复。该项不阻塞首件重建闭环，属于父项原版范围。 |
| M1-12 | 首件 Effect11/GA15 已由正式 World 通知驱动双网页：五个实际绘制节点、`tag_efcenter` 挂点、播放/自然结束/停止/离场清理均通过。 | 全部技能/物件组合、逐像素与混音精度仍属 M4/M7；这些不是首件接线缺口。 |
| M1-13 | M1-13-B：库存→槽4→开局→自然受伤→普通输入→扣量/效果→结算→刷新/重启→剩余库存重入再次使用已通过，含双网页和 CPU/托管分支。 | 原版父项仍继承 M1-09/M1-10 的未知权威因果；不能把重建闭环当作原版父项完成。 |

## 接线结论

首件重建链已经闭合：`inventory → kitbag → useItem request → World authority (rebuild) → account CAS → itemUsed/effect notification → both clients → settlement/restart`。没有发现需要再次研究客户端请求编码、效果挂点或普通 CPU 输入的独立缺口。

现有正式代码合同对应：`apps/server/src/battle/accept-input.ts` 调用普通槽位分派和 `applyHealingItem`；`battle/healing.ts` 从原定义读取恢复量，消费回调成功后才修改生命/数量并发效果；`account-store.ts` 在账户/实例/定义/预期数量匹配的事务中扣量；`battle/cpu/controller.ts` 将 `healingHotkey` 结果写入普通输入；`apps/web/src/match/skills/battle-skill-effects.ts` 接收正式事件中的效果通知。M1-10-B 是本审计建议增列的重建子项，其代码和通过证据已经具备，不需新增实现或重复测试。

原服务端未知项是同一条阻塞链，而不是五个相互独立的任务：`3c9e receive/dispatch → FuncType2/Target1 rule → success result (3c92) → authoritative consume/effect`. 现有客户端 3c9e 发送不会进入已找到的接收 reader；继续在同一入口取样不会增加信息。

## 唯一下一步阻塞

取得原服务端程序/协议记录，或建立一个确实进入原 3c9e 处理器的新调用入口，并一次性确认 FuncType2、Target1、成功条件、3c92 产生与数量提交的因果关系。在该证据到达前，保持 M1-09、M1-10 及依赖它们的 M1-13 原版父项未勾选；首件重建子项可直接关闭，且不应再扩大客户端同入口取证。
