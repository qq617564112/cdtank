# 原结果奖励显示字段

原 `game_summary` 回调 `4ac736` 接收四个奖励显示值。`result-reward-display-native.json` 对四条原显示段各执行六组输入，共24组通过。范围是原字段读取、x87显示门禁与格式化输入合同。

| 原消息字段 | 原控件 | 控制器字段 | 原格式化调用 |
| --- | --- | --- | --- |
| `+c0` | `GameSummaryAward/txtMoney` 金钱 | `+2bc` | `4acc7c` |
| `+c4` | `GameSummaryAward/txtCoin` 星币 | `+2c4` | `4accfc` |
| `+c8` | `GameSummaryAward/txtOriginality` 创意点 | `+2c0` | `4acbf6` |
| `+cc` | `GameSummaryAward/txtTech` 技能点 | `+2c8` | `4acd7c` |

控件绑定由初始化 `4a9f47–4aa027` 确认。四条格式化路径均直接将对应消息32位值传给 `57c0d6`，使用 `5c83d4="%d"`、缓冲长度32；高位值按有符号十进制解释。原显示段没有将该收到值乘DataScale比例。

## 结果与显示门禁

复用 `result-music-semantics-source.json` 的原结果字段身份：消息 `+d4` 写入同控制器 `+510`，1/2/3分别选择WIN/LOSE/DRAW。对应DataScale为31..34、39..42、35..38，各组按金钱、星币、技能点、创意点排列。原表相应比例为50/-50/0。

原 `439184` 用表记录 `+2c` 的有符号整数乘 `5c2bd8` 比例常量。结果分支随后加 `5ccffc` 的float32常量1。显示段与 `5e6868` 的float32零比较，再执行 `test ah,44` 与 `jnp`。有限输入下倍率非零显示消息值，倍率为零显示 `5c7244="0"`。实际原指令已覆盖1.5、0.5、1、0、-1以及高位消息值。创意倍率由前段留在x87栈，其余三倍率使用局部float32槽。

这一客户端显示门禁不能证明服务端采用同一比例计算奖励。

## 回调身份

`51c95f–51c991` 将 `4ac736` 与所属控制器 `+2500` 交给 `51c02c` 绑定，并将克隆回调交给房间控制器 `4cbdc5` 的 `+900` 槽。绑定对象vtable `5d7504` 的调用方法 `49f571` 从对象 `+c` 恢复owner并跳入 `+8` 回调。该链确认显示回调的对象身份。

## 验证边界与缺口

测试供给结果消息和前段倍率，执行原四条显示段；在原snprintf或CEGUI字符串构造边界记录输入。未执行完整格式化库、完整结算接收器或网络对局。

M6-02仍缺消息 `+c0/+c4/+c8/+cc` 的服务端producer：基础奖励输入、资格、比例应用、舍入与账户写入。原transport消息类型/codec及账户成长持久关联也未由此回调链确认。四字段没有证明经验输入或等级换算。

当前 `settlement/match-result.ts` 的重建战斗积分、地图胜平负加分和 `totalScore` 不能充当原奖励或经验；`finish-round` 一次结算门禁不能提供缺失计算规则。此证据只支持已有权威奖励值的展示字段，不提出账户发奖公式。

来源：`CDTank/CDTank.exe`；复用 `recovery/output/result-music-semantics-source.json` 与 `result-music-source.json`；新执行脚本 `recovery/evidence/settlement/result-reward-display-native.py`，新结果 `recovery/output/result-reward-display-native.json`。
