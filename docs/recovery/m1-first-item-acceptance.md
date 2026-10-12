# M1 首件饲料最小验收

从仓库根目录运行：

```bash
npx tsx tests/m1-first-item-acceptance.cts
```

入口串行运行三个现有夹具：`healing-item-world.cts`、`cpu-healing-item.cts`、`healing-item-network.cts`。每个夹具必须退出码为零、输出 `PASS` 并写出 `status: PASS` 的证据；任一失败立即停止。汇总证据写入 `recovery/output/m1-first-item-acceptance.json`。

验收覆盖自然战斗造成伤害后的普通饲料成功施放与数量扣减，满血、存储/CAS失败和重复序列拒绝；第一、第二局自然结算、再战库存保留、CPU在第二局耗尽后不补货；两个真实TSRPC客户端收到相同施放事件和同tick快照；服务端重启恢复拥有数量与快捷槽，并保持账户隔离。

本入口只验证重建服务端的首件闭环。原始服务端 `FuncType2`/`3c9e` 语义、浏览器像素与音频精度不在此最小验收内。
