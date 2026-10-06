# 原角色命令向量与 actor 姿态生产（M2-03 / M3-03）

原 `UMsgPrPlayerCmdVector`（`0x3aa6`）经 `0x428348` 查找角色，远端分支完整进入 `0x42823e`，从消息写角色位置和两个方向，再通过原 getter 和 wrapper 提交 actor 目标或即时姿态。真实 factory、bit codec、接收分派、角色 setter/getter、actor `0x466efb/0x464513` 已连续执行。该消息生产链有明确参数来源。

## 消息与参数

`0x42b7e7` 注册消息 `0x3aa6` 至 `0x428348`。原 factory `0x42d1ec` 分配 28 字节，构造 `0x42d238` 安装 vtable `0x5c3d80` 并建立空向量。完整 writer `0x41de69`、reader `0x41e323` 采用 LSB-first：先 uint32 元素数，每个元素再写 192 位。

| 位数 | 元素字段 | 原元素内存 |
|---|---|---|
| 32 | 对象 ID | +0 |
| 32 | X float32 | +0xc |
| 32 | Z float32 | +0x10 |
| 16 | 前进方向角，unsigned 解码 | +0x18 |
| 16 | 朝向角，unsigned 解码 | +0x14 |
| 16 | 命令 | +4 |
| 16 | 状态 | +8 |
| 32 | 时间字段 float32 | +0x1c |

向量元素间隔 40 字节。上表偏移包括对象 ID；命令状态结构自身位于元素 +4，其中时间字段为结构 +0x18。最后两个 float32 不在线路内。这里保留时间的 float32 位值；本姿态分支不把它用作 actor delta。单元素总长度为 224 位，空向量长度为 32 位。

`0x428348` 按对象 ID 调用 `0x48a226`。缺角色跳过；owner +0x3c 缺本机角色时整个入口返回。对象 ID 等于本机且 owner +0x39 为 0 时进入本机修正 `0x428167`；其余进入远端 `0x42823e`。

远端原顺序：

1. 消息状态为 3 且记录状态为 2 时，以命令调用 `0x432013/0x422adf`，准备命令方向及标志。
2. float setter selector 2/3 将 X/Z 写入 role +0x25c/+0x264，Y 保留 role +0x260。整数 setter selector 18/19 经 `0x433250` 将朝向/前进角转换为 role +0x274/+0x280。
3. `0x431fd2/0x431fd9/0x431fe0` 返回朝向、前进、位置指针。调用参数顺序为 position、forward、look。
4. 状态 0/1 调 `0x4229cd`，继续 actor virtual +0x98（`0x464513`），即时复制三向量并清 +0x1c8；其他状态调 `0x42298b`，仅 record +0x90 为 2 且 actor 存在时进入 virtual +0x94（`0x466efb`）。目标 setter 的 +0x19c 门禁随后生效。
5. actor 提交之后调用 `0x426b92`，随后入口分别处理状态 0/1 的业务回调。

`record+0x90` 是角色状态，getter 为 `0x43293d`；它与战车定义、TankType4、actor 派生类不是同一个字段。`0x4229cd` 在记录状态非 2 时写日志，但仍向存在的 actor 提交即时姿态。

## 坐标与方向

X/Z 为原 float32 世界坐标；Y 不由该消息提供。未证实原世界坐标与米的换算，不添加比例。角单位为半度：`0x41d7e3` 将 signed32 输入乘原 float32 `0x5c286c = -0.008726646192371845`，交完整 `0x57454b` 绕 +Y 旋转。消息解码先清 uint32 再读 uint16，因此收到的角为 0–65535 的非负数；setter 本身接受 signed32。

原方向从 +X 朝 +Z 旋转：0 为 +X，180 为 +Z，360 为 -X，540 为 -Z。取证向量表达为 cos(f32(angle×正半度尺度)) / sin(f32(angle×正半度尺度))，与原负角矩阵的输出相同。保留 float32 弧度和三角函数结果，不把轴向小分量强行归零。原角向量转换与网页 `sin(yaw)/cos(yaw)` 前进定义不同，调用方应明确转换。

`recovery/evidence/role-pose/role-pose-command-sol.ts` 提供已证实的原消息编码/解码、半度方向和远端 pose 分派合同。来源显式给出角色存在、actor 存在、记录状态、现有 Y 和 actor 目标门禁。其返回模式仅表示 pose 提交；outer 状态业务、属性 setter 通知、矩阵更新和服务器命令生产仍由各自入口负责。

## 具体 actor 与停止/死亡

原 actor factory `0x451aa4` 读取角色 getter selector 29 的定义 ID，以 unsigned `>150` 选择三组件 actor `0x46880a`、vtable `0x5c8688`；其余选择四组件 `0x46c1e3`、vtable `0x5c88c8`。两表的 virtual +0x94/+0x98 均为 `0x466efb/0x464513`，四组件本轮完整生产测试采用原 `0x5c88c8`。三组件 tick/phase/render 为 `0x468aed/0x46aaef/0x4695bf`，具体构造和更新证据由 role-actor-global-clock-sol 合同覆盖。

完整 `0x46495d` 设置 +0xd8=1、清 +0xc0 三向量和 +0x23c。保留目标曲线 +0x120、目标位置和累计 +0x1c8。完整四组件死亡 `0x46c3de` 设置 +0x19c=1；恢复 `0x46c406` 清 +0x19c。其动作/visual 回调供给边界；这两个入口本身没有清移动向量或设置停止标志。

完整前进/后退 `0x4670de/0x467175` 以当前位置和指针输入建立两点曲线，设置 +0xd8=0、+0x124=1/-1，保留已有累计 +0x1c8。这些输入是目标位置向量，不能用消息的前进角代替。完整停止状态下朝向 setter `0x4645dc` 清累计并写 +0x1b0；运动状态下它重新提交 actor virtual +0x94 的静态调用路径见 role-track-spatial-sol。3aa6 远端路径直接提交完整姿态，不经过前进/后退/朝向单独入口。

## 验证

消息helper与CTS位于`recovery/evidence/role-pose/`，只用于原程序对照；正式两端当前没有消费者，服务端发行产物不包含它。

```sh
recovery/.venv/bin/python recovery/evidence/role-pose/role-pose-producer-sol-native.py
npx tsx recovery/evidence/role-pose/role-pose-command-sol.cts
npx tsc --noEmit
```

192 组原 factory/codec 覆盖 6 状态、4 角组合和全部 bit offset。80 组真正 writer→reader→handler→role→actor 连续执行覆盖角色缺失、4 记录状态、5 消息状态及目标门禁，验证 Y 保留、目标当前位置保持、即时复制、累计归零与曲线来源。另有 10 个角（0/1/179/180/359/360/719/720/32768/65535）经完整消息至 actor 验证两方向；7 个完整方向转换、3 个停止/死亡/恢复及3个单独运动/朝向入口。取证 codec 与 192 原 payload 逐 byte 相同，80 分派与原输出一致，全部角向量分量误差小于 1e-7。证据为 `recovery/output/role-pose-producer-sol-native.json`。

这些检查检测消息位序、方向次序、错误角单位、X/Z 互换、Y 丢失、把 record 状态当战车型别、错误即时/目标门禁以及死亡/停止误清状态；差异应修正消息 helper 或调用参数来源。

## 限制

本机修正 `0x428167` 的完整入口与原单peer分离另见 `role-local-pose-correction-sol.md`；state0 的 `424be9` 观察者参数合同与正式注册链另见 `role-scene-position-observer-source.md`。原网络 socket/服务器发消息时刻、多peer树生产与顺序、状态 0/1 的完整业务及资源生命周期仍未完成。供给边界为分配/释放、角色查找、日志、矩阵副作用 `0x433073`、曲线构造、post-pose 和 visual 回调；核心 codec、角色字段更新与 actor pose 原指令保留。此证据证明原 3aa6 远端参数链，不将重建 TSRPC snapshot 标为原消息；页面接入须声明自己的坐标/方向转换、状态来源及时间合同。
