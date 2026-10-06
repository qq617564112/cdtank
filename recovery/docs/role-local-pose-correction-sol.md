# 本机角色姿态修正入口

`0x428167` 是 `3aa6` 命令向量进入本机角色时的专属入口。它先要求 owner 的 `+0x3c` 本机角色存在，再只接受消息 state 0 或 1；其他状态直接返回0，不改角色或actor。

对接受的消息，原顺序为：

1. 用消息 command 调角色命令 setter `0x422adf`。
2. 调 `0x43314a` 写 X/Z；该入口把 Y 写为0，并以旧位置保存 previous，再构造原 `0x433073` OBB矩阵。
3. 用 selector18/19 和 `0x433250→0x41d7e3` 写朝向/look 与 forward，角字段按原 signed32 半度单位转 +Y 向量。
4. 调 `0x4229cd→actor virtual+98 (0x464513)` 发布即时姿态，然后调用 `0x426b92` 做原角色重叠分离。
5. 分离完成后把收到的36字节状态缓存到 role+234；收到的后两个 float 不参与姿态或速度。最后 `0x422f0d→0x40607b` 取得本机相对秒，将缓存时间字段覆盖为该相对秒。

本轮 `tests/role-local-pose-correction-native.py` 首次执行7个条件：缺角色、state2/3拒绝、state0/state1即时提交、record state3仍即时提交、重叠分离后缓存保持收到位置。使用既有原NAV/OBB/分离来源，不重跑旧分离套件；原实测中重叠角色从收到位置 `[other.x+10,0,other.z]` 分离到 `[other.x+60,0,other.z]`，但缓存仍保留收到的 `[other.x+10,0,other.z]`。本机时钟夹具得到缓存时间2.5秒。

`role-local-pose-correction-sol.ts` 提供等价的纯合同，provider 明确承担角色 setter、actor即时发布、重叠树、缓存和本机时钟。合同测试读取已保存7条原生结果，对照接受门禁、收到位置、两方向、完整缓存字节和provider调用顺序；相对时钟与分离由provider供给，不重复执行原分离算法。未接正式World、socket、账户或网页，也没有注入活动位置、生命、事件或胜负。

| 来源 | 结论 |
| --- | --- |
| 反汇编 `428167/43314a/433250/4229cd/426b92/422f0d` | 入口顺序、state门禁、Y=0、方向setter、分离后缓存和相对秒覆盖 |
| 已有 `movement-separation-native.json` | 原NAV/OBB分离数值复用，不新增分离规则 |
| 本轮 native output | 7个本机入口条件，角色/actor字段和缓存差异逐项记录 |
| 尚未恢复 | 原socket传输与运行初始化、owner树真实生产、OS时钟初始化、多角色顺序、state2+本机业务及正常多人验收 |

证据：`recovery/output/role-local-pose-correction-native.json`、`tests/role-local-pose-correction-native.py`、`recovery/evidence/role-pose/role-local-pose-correction-sol.ts`。复现：

```sh
recovery/.venv/bin/python tests/role-local-pose-correction-native.py
npx tsx recovery/evidence/role-pose/role-local-pose-correction-sol.cts
```

独立NodeNext严格类型检查通过，仅检查新增合同与测试。原3aa6→428348本机/远端分派已有role-pose-producer-sol来源，本轮不复跑该codec与dispatcher。
