# AI 训练

训练主机为 `192.168.10.179`，GPU 为 RTX 2080 Ti（计算能力 7.5，驱动报告 22528 MiB 显存）。数据、模拟源码、依赖、缓存、训练日志和模型全部保存在 `D:/ai/cdtank`。Python 使用该目录的虚拟环境，复用主机已有的 PyTorch 2.3.1+cu118；Node 使用该目录的便携版 22.15.0。

## 数据来源

账户数据库 `match_history` 只保存结算，没有逐帧操作。`scripts/learning/export_history.py` 以只读事务读取数据库，根据房间、回合、地图、模式、结束时间关联 `state/cpu-traces/*.ndjson*`，选择最后采样距结算不超过 3 秒的进程会话。导出仅保留结算参与者中标记为 `HUMAN` 的状态与普通输入，不导出账号、令牌、凭据或显示名。托管 `AUTOPILOT` 和脚本 `CPU` 不作为真人标签。

历史轨迹约每 500ms 在模拟推进后采样。它不能提供按键发生前的完整观察；初始模型使用当前自身状态预测下一采样点的移动、转向和炮塔操作，作为动作习惯先验。训练不从这些记录推断未记录的视线、道具效果或子弹。整场比赛划入同一个训练或验证集合，连续死亡、控制切换及采样间隔中断处切断序列。

历史 `HUMAN` 标签表示未启用托管，不包含客户端是人工操作还是自动脚本的来源证明。数据文件保留这一来源标记。

2026-10-17 的导出读取到 101 个结算回合，关联到 36 个轨迹会话，其中保留 4966 个真人标签采样点、4646 个存活采样点。其余 65 个回合没有符合时间匹配条件的轨迹。

## 模拟与模型接口

`scripts/learning/environment.ts` 在独立 Node 进程中创建真实 `World`，注入固定时钟和按种子生成的 `Math.random`。模拟每次推进 50ms，模型每 100ms 提交一次普通 `MsgPlayerInput`。训练进程不连接账户库，不写线上库存或战绩。

输入和输出逐行使用 JSON：

```json
{"type":"reset","seed":179,"mode":4,"mapId":7,"players":2,"controlled":1,"lesson":"navigation"}
{"type":"step","actions":[[2,1,1,0,0]]}
```

动作有五个离散头：移动 3 类、车体转向 3 类、炮塔转向 3 类、开火 2 类、道具槽位 0–8。前三类按 `0/1/2 → -1/0/1` 映射。输入资格、库存扣量、碰撞、弹道和结算继续由现有战斗实现执行。

`World.learningFrame()` 返回 128 维观察和动作掩码：自身状态与上一动作、局部 NAV 探针、可见敌人与队友、可见弹丸、公开模式目标、模式身份、库存槽位和练习路点。敌人经过距离、场景视线和隐身状态过滤。奖励统计与观察分开，策略不能读取它们。

移动课程从真实出生点选择 60–180 单位内可直达的路点，关闭开火和道具动作，以距离进展、到达和受阻情况计奖励；到达或 15 秒结束一个练习。战斗课程使用正常 60 秒对局，以实际伤害、击毁、死亡和胜负计奖励，模式 2/3/5 分别加入堡垒伤害、VIP 伤害和目标摧毁数。

`train_motion.py` 使用 64 维 GRU 和三个动作头。`train_combat.py` 扩展为 128 维观察、64 维 GRU、五个动作头和价值头，继承动作先验，以 recurrent PPO 训练。回合结束和死亡清理记忆；PPO 以 32 步序列优化，保存优化器、训练步数、配置和检查点。续训通过 `--resume` 加载参数及优化器，模拟从新种子回合开始。

## 运行

远程基础环境：

```bash
python3 scripts/learning/remote.py scripts/learning/setup.ps1
```

数据导出支持将压缩流直接通过 SSH 交给远程 `receive.py`，无需在本地保存新增数据。模拟源码包包含 `apps/server/src`、`apps/shared`、训练脚本和服务器资源，存入远程 `data/` 后由 `runtime.ps1` 解压；依赖缓存也在 `D:/ai/cdtank/cache`。解压源码包后同步对应提交的训练脚本和观察模块。

远程命令示例：

```powershell
D:/ai/cdtank/venv/Scripts/python.exe D:/ai/cdtank/game/scripts/learning/train_motion.py --data D:/ai/cdtank/data/history-20261017.jsonl.gz --output D:/ai/cdtank/runs/motion-001
D:/ai/cdtank/venv/Scripts/python.exe D:/ai/cdtank/game/scripts/learning/train_combat.py --game D:/ai/cdtank/game --node D:/ai/cdtank/tools/node/node.exe --output D:/ai/cdtank/runs/navigation-001 --prior D:/ai/cdtank/runs/motion-20261017-001/best.pt --lesson navigation --steps 100000
```

通过 SSH 持续运行时调用 `start-training.ps1 -RunName <新目录名> -Lesson navigation -Steps 100000`。启动信息写入 `runs/<目录名>.launch.json`，标准输出和错误分别写入同目录名的 `.stdout.log`、`.stderr.log`；进程独立于 SSH 会话存活。

每次运行使用新目录。`config.json` 保存数据划分、软件版本和超参数；`metrics.jsonl` 保存训练指标；`latest.pt` 用于续训，动作预训练另保存 `best.pt` 和 `result.json`。训练完成不代表满足接入条件。

## 迭代范围

- [x] 远程 GPU、CUDA 和 `D:/ai` 环境。
- [x] 数据库结算与历史轨迹关联，排除 CPU 和托管。
- [x] 动作先验预训练，按比赛划分验证集并与保持上一动作比较。
- [x] 真实 World、固定时钟、局部观察及 recurrent PPO 训练入口。
- [ ] 基础移动课程达到稳定路点到达率，扩展到绕障和脱困。
- [ ] 静止靶、移动靶、对射、躲避和完整 1v1 战斗课程。
- [ ] 按输入发生时刻记录高频观察、人工输入及控制来源。
- [ ] 道具逐类解锁，观察加入效果状态和使用资格。
- [ ] 2v2、3v3 团队训练，集中价值网络与本地执行策略。
- [ ] 历史对手池、自博弈、地图划分和战车/配给随机化。
- [ ] 共享主干与五模式策略头，按真实模式胜负训练。
- [ ] 真人行为约束、不同风格与难度校准。
- [x] 训练基础设施集中静态代码走查。
- [ ] 训练对局评估和 CPU 策略接入。

## 当前结果与限制

首轮动作先验在 GPU 上完成 100 epoch，最佳验证交叉熵为 0.73356。验证集 549 条连续动作中，移动、转向和炮塔操作准确率分别约 69.2%、77.2%、67.4%；保持上一动作基线为 69.2%、74.5%、63.6%。这是粗采样动作预测结果，不代表交战或对人胜率。

首轮 100000 步导航训练运行目录为 `D:/ai/cdtank/runs/navigation-20261017-002`，使用四个模拟进程，检查点随每次 PPO 更新保存。后续课程须依据训练结果推进。

当前课程尚未证明跨机器完全确定的回放、复杂绕障、道具价值、团队配合和五模式能力。历史数据规模较小且人工操作来源未确认。未运行单元测试、浏览器验收、构建或类型检查；训练运行和训练集验证指标记录各自的实际范围。
