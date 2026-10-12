# actor 全局时钟与 Type4 履带合同（M2-03 / M3-03）

场景 actor tick 接收引擎全局计时器产生的秒数。引擎先用时间倍率缩放 wall-clock 差，`gbGfxManager::GetDeltaTime` 在 double 值达到 0.5 时返回 double 的 0.1；场景再将返回值存为 float32，以该值调用所有角色的 virtual `+0x0c`。TankType4 使用三组件 actor 的独立字段，但履带相位规则与四组件一致。

## 时钟生产与传递

| 原入口 / 字段 | 合同 |
| --- | --- |
| DLL `0x10005060` | 获取 `gbTimeManager` singleton `0x10053340`；首次初始化倍率 double 1、delta double 0、累计时间 double 0 |
| `0x10001040` | `SetTimeScale(float)` 将 float32 参数拓宽为 double，写 singleton `+0x00` |
| `0x10035380` | `gbUpdateCurTime` 使用 QPC 64 位计数 / QPC frequency，返回秒数并写 double 全局 `0x1005b120`；没有 QPC 时走原 CRT `clock()` / 1000 分支 |
| `0x10028070` | `gbGfxManager::BeginScene(bool)`；参数非零时把 gfx `+0x1f0` 旧时间存到 `+0x1e8`，取得当前秒数，并算新旧时间差 |
| `0x10028144–0x10028150` | 时间差乘 singleton double 倍率；写 `+0x08` double delta，并累加 `+0x18` double 时间 |
| `0x1002807f → 0x1002818c` | 参数为零时跳过时钟更新，保留 singleton 上次的 delta、累计时间和 gfx 上次采样时间；本分支不会把 delta 设为零 |
| `0x10028030`，EXE IAT `0x5c0b24` | `GetDeltaTime` 读 singleton `+0x08`；double delta `< 0.5` 时原值返回，`>= 0.5` 时返回 double `0.1` |
| EXE `0x45004a / 0x450054 / 0x45005a` | 完整场景更新从 gfx `+0x08` 调用实际 getter，以 `fstp DWORD [scene+0x14]` 舍入为 float32 |
| `0x4500e1–0x4500ec`、`0x4500ff–0x45010a`、`0x450114–0x45011d` | 远端、本地、可选 actor 均从同一场景 `+0x14` 读取并按 float32 入栈，调用 actor virtual `+0x0c` |

顺序必须是 **double 比较 → getter 输出 → float32 存储 → actor tick**。`0.499999999` 秒通过 getter 后舍入为 float32 `0.5`，仍按 `0.5` 调用 actor；`0.5`、`0.75`、`2` 秒均改为 float32 `0.10000000149011612`。不能将舍入后的值再次送入 getter。这里的 0.1 是长帧替代值，不是逐帧上限：0.25、0.499999999 都正常通过。

`BeginScene(false)` 是入口参数的实际合同，不能自动解释为网页暂停。若随后场景更新仍执行，getter 会读到保留的上次 delta。完整窗口暂停、失焦及外层 render 调度是否跳过该调用的来源还没有闭合。倍率 0 则在一次实际采样后产生 delta 0。

现有 `effectModelEngineDelta` 提供 getter 的 double 截断规则；`TankView.animate` 使用 `Math.fround(effectModelEngineDelta(browserDeltaSeconds))` 作为重建页面的 actor 动画时间输入。原引擎 QPC / 倍率生产与浏览器 frame 时间是两种入口，页面尚未恢复原 client 时钟倍率控制。

## 场景与初始化门控

完整 `0x45004a` 不按传入参数解释 delta：测试入口参数为 `0x12345678`，actor 仍收到从实际引擎 getter 生产的 float32 秒数。

场景 `+0x10` 仅为 4 时运行角色分支：

1. 从 `scene+0x5c` 经完整 getter `0x455ed8` 读取 provider `+0x14` 的本地 actor。
2. 本地 actor 存在时，遍历 `scene+0x6c` 的角色 map，依次 tick 各 actor，再 tick 本地 actor。本地 actor 不存在时，整个角色 map 也跳过。
3. `scene+0x60` 可选 actor 非空时单独 tick；本地 actor 缺失不会阻止这一次调用。

`scene+0x10` 的写入入口为完整 `0x447262`，不是当前房间 wire 的 PLAYING / WAITING：原 `SYcGameStage::_OnInitial()` `0x442a45` 在 `0x442a87–0x442a89` 写 4；`SYcLobbyStage::_OnInitial()` 在 `0x4449e3–0x4449e5` 写 2；两个阶段初始化路径 `0x446720 / 0x446dd0` 写 1 / 3。GameStage 的原字符串来自 `0x5c5820`，LobbyStage 的原字符串来自 `0x5c5bfc`。

完整 GameStage 更新 `0x442af0` 要求 stage `+0x0c` 和 `+0x2c` 均非零，才遍历 application `+0x94` 子系统 vector 并调用每项 virtual `+0x08`。任何一项为零都尾调用 `_OnInitial()`，该调用可能在之后完成初始化。场景 vtable `0x5c6c48 + 0x08 = 0x45004a` 是实际 actor 时钟传递入口。外层 application 更新 `0x415da6` 又在当前 stage `+0x0c=0` 时调用 stage virtual `+0x18`，只有初始化后非零才调用 stage `+0x08`；本证据未执行完整 application 调度。

门控作用于 **tick 是否被调用**。停止、目标已到达等空间门控在 actor tick 内执行，不能用 room phase、死亡显示或网页 moving 布尔值替代。

## Type4 构造、字段与提交

原 actor factory `0x451aa4` 从角色 virtual `+0x18`、selector `0x1d` 取得战车定义 ID。`0x451ae9–0x451b34` 用 unsigned 比较 150：

| 定义 ID / 构造 | 实际 actor |
| --- | --- |
| `<=150`，分配 `0x378`，完整构造 `0x46c1e3` | vtable `0x5c88c8`；tick `0x46c483`；空间/相位 `+0x64 = 0x46e0e3`；render `0x46cec7` |
| `>150`，分配 `0x2d8`，完整构造 `0x46880a` | vtable `0x5c8688`；tick `0x468aed`；空间/相位 `+0x64 = 0x46aaef`；render `0x4695bf` |

三组件 actor 的 `+0x2a8 / +0x2ac / +0x2b0` 分别是 M / X / Y，不含 U。构造写 `+0x2c0=0.0f`、`+0x2c4=0`，分别为相位累计值和索引；A / B 纹理指针为 `+0x2cc / +0x2d0`。

完整 tick `0x468aed` 先调用 visual virtual `+0xc8`，随后将相同 float32 delta 交给 `0x46753f`，再在 `+0x254` 非空时更新其效果。四组件入口 `0x46c483` 的 visual `+0xc8` 则在 `0x46753f` 之后。两者共用 `0x46753f → 0x4660a5` 的目标门控：停止标志 `+0xd8` 非零、`+0x120` 无目标、或水平目标距离达到 float32 `0.001` 时，调用基础空间入口 `0x464fb3` 并冻结履带累计与相位；否则调用具体 virtual `+0x64`。

完整 `0x46aaef` 先调用空间更新 `0x4654f1`，随后用 x87 加 delta 与 `+0x2c0`。比较使用未舍入的和，字段存储为 float32。严格超过 float32 `0.1` 时累计归零，索引 `(index+1)%2`；大 delta 只切一次，余量丢弃。完整 `0x4695bf` 分别读取同一索引为 X / Y 调用实际 DLL `SetTexture` `0x10009f70`，再提交各 actor render。

实际停止入口 `0x46495d` 同样保留 Type4 累计值与索引，并设置 `+0xd8=1`、清空移动向量。死亡是否必然调用停止入口尚未证明。已找到的直接停止调用位于 `0x4148d9 / 0x4269b1 / 0x427242`，分别是阶段/角色移除及遍历停止路径；它们不能证明击毁本身会设置门控。

## 验证

```sh
recovery/.venv/bin/python tests/role-actor-global-clock-sol-native.py
```

结果：`PASS 10 clock cases, 20 scene gates, 4 GameStage gates, 32 Type4 tick/render steps`；同时复用四组件 harness，原有 7 组 / 70 次相位与绘制检查通过。证据为 `recovery/output/role-actor-global-clock-sol-native.json`。

执行完整 QPC 时钟生产、倍率写入、引擎 getter、场景更新和实际本地 getter / map iterator；独立保存六组 scene delta，包括舍入后为 0.5 的原 double。20 组场景覆盖所有已使用的 0–4 状态与本地/可选 actor 存在组合；四组 GameStage 覆盖两个初始化字段的组合。两种具体完整构造与 factory 原分配/分支片段确认 1 / 150 / 151 / 158 的 actor 类别。Type4 执行完整 tick / 目标门控 / 相位和 render，覆盖 pending / stopped / absent target / arrived，以及阈值相等、微小越界、长 delta、零 delta；执行实际停止入口并证明非零相位保留。

这些对照可发现倍率遗漏、double 比较与 float32 舍入顺序错误、以传入场景参数充当 actor delta、无本地 actor 时错误 tick 远端 map、将阶段状态等同房间状态、Type4 字段错套或左右履带不同步。出现差异时应修正对应合同，不能把未满足门控的帧接入履带更新。

## 限制

QPC OS 查询、音频/UI/效果终端、GameStage `_OnInitial` 返回边界、基础 actor 构造与矩阵构造、空间运动/getter/sqrt及图形提交由 harness 供给。QPC 分支执行实际 64 位计数除频率；无 QPC 的 CRT `clock()` 分支仅记录原代码，未执行。factory 只执行 getter 返回之后的原分配和具体构造分支，不把其他角色 getter / 注册来源补为确定。

原 client 倍率 setter 的业务调用者、外层暂停/失焦/加载调度、完整死亡门控、以及页面 snapshot 与原目标曲线 setter 的对应关系仍缺。原场景数值 4 不能直接映射到网页 room phase；仅凭浏览器帧时间、死亡显示或角色两帧位移不足以启用原目标门控下的 A/B 切换。
