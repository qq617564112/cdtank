# 原 actor 空间更新与目标位置（M3-03 / M6-03）

完整原 `0x4654f1` 更新位置采用持续修正当前坐标的加权混合。权重来自角色累计 delta，默认周期为 float32 `0.1`，加上 float32 `0.05` 后裁剪到 `[0,1]`。目标设置不立即改变当前坐标；原履带门禁在位置更新前比较当前坐标与目标曲线最后一点。

## 位置合同

`0x46753f` 每次接收 float32 delta 时将其写入 `+0xb4`，按 float32 加法累加 `+0x1c8`。`0x4654f1` 先执行完整 `0x464fb3`：根据 `+0xc0 × +0x124` 和当前 `+0x1c` 构造、混合并归一化前进方向，再混合归一化 `+0x88` 朝向。随后 `0x464e83` 更新位置：

```text
weight = clamp(float32(elapsed / period + float32(0.05)), 0, 1)
inverse = float32(1 - weight)
position[i] = float32(float32(target[i] * weight)
                      + float32(current[i] * inverse))
```

这里 `elapsed=+0x1c8`、`period=+0x198`、`current=+0x28`、`target=+0x1bc`。初始化 `0x4685e8` 写周期 `0x3dcccccd`。每次更新使用上次输出作为 current，不固定使用初始起点。`0x464e83` 最后清 `+0xc0` 移动向量。基础 `0x464fb3` 只更新方向，不改变位置；履带门禁返回 true 的分支只运行该基础更新。

`blendRoleSpatialPosition` 实现位置混合。其 elapsed 必须是原累计 delta 语义，不能由网络消息时间差或页面动画时间另行假定。

## 目标设置合同

完整 `0x466efb` 是四组件 actor vtable `0x5c88c8 + 0x94`。三个指针参数依序为目标位置、前进方向、朝向。`+0x19c` 非零时入口跳过更新；否则：

- 将三个输入向量复制到 `+0x1bc/+0x1a4/+0x1b0`。
- 清 `+0x1c8`，设置 `+0xd8=0`。
- 从当前 `+0x28` 和目标位置构造两点曲线，交给 `0x46c0d9`，写 `+0x120=&actor+0xdc`。
- 当前 `+0x28` 在该 setter 内保持不变。
- 根据 `(target-current) · currentLook` 的符号设置 `+0x124`：严格负为 -1，其余为 1。

原目标 getter `0x46ae9c` 返回容器本身；`0x465c6e` 按容器 `+0xc/+0x10` 的最后元素索引调用 `0x464c1d`，得到最后一点。原门禁 `0x4660a5` 使用该点，而非直接读取 `+0x1bc`。

已定位唯一静态 virtual `+0x94` 调用点 `0x4646a3`：朝向 setter `0x4645dc` 在 `+0xd8=0` 时，将当前目标位置、目标前进方向和当前朝向重新提交。原前进/后退入口 `0x4670de/0x467175` 同样构建当前位置到输入目标的两点曲线，分别设置 `+0x124=1/-1`。这些地址不能单独证明网络姿态消息或页面 snapshot 是该入口的生产源。

## 验证

```sh
recovery/.venv/bin/python tests/role-track-spatial-sol-native.py
```

35 组完整 `0x4654f1/0x464fb3/0x464e83/0x464f1f` 与向量数学执行涵盖正向、反向、同位置转向、静止、含高度位置及 7 个累计值；完整原目标 getter 验证两点容器末点。另有 6 组完整 `0x466efb`，验证目标字段、当前位置保持、累计归零、停止标志、曲线输入、方向符号和 `+0x19c` 跳过分支。证据为 `recovery/output/role-track-spatial-sol-native.json`。

检查可发现固定起点插值、错误周期/偏移、舍入次序错误、同位置目标误生成移动、setter 立即跳坐标、目标曲线起点误绑和门禁最后点误读；出现差异应修正位置 helper 或调用参数来源。

## 限制

测试供给 CRT sqrt 的 x87 返回、临时容器分配、曲线构造、visual 回调和释放边界。原 setter 的点复制与 `+0x120` 写入，以及完整原 getter 和位置计算保留实际执行。未执行完整曲线构造数学、网络 pose 生产链、全局 delta 时钟、死亡调用链和 TankType4 生命周期。因此本合同可用于具备明确参数来源的空间函数调用，尚不足以把页面 snapshot 自动标为原目标 setter，也不足以在页面按重建位移启用履带门禁。
