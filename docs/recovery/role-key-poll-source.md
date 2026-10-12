# 原按键轮询生产链

原 `424242` 的13个定向执行条件通过。`SystemSetting.ini` 中 MainUp/Down/Left/Right 为200/208/203/205，AttachedUp/Down/Left/Right 为17/31/30/32。主键与附键分别对应方向键与W/S/A/D，两组进入相同运动输入位。

| 原配置字段 | settings偏移 | 输入位 | 已有原命令消费者 |
| --- | --- | --- | --- |
| MainUp / AttachedUp | +4 / +14 | 0 | command1，组合优先6/5 |
| MainDown / AttachedDown | +8 / +18 | 1 | command2，组合优先8/7 |
| MainLeft / AttachedLeft | +c / +1c | 2 | command3 |
| MainRight / AttachedRight | +10 / +20 | 3 | command4 |
| Shoot / AttachedShoot | +24 / +3c | 8 | 原42b1ab→42aede射击入口 |

settings加载段 `41cf6c–41cffc` 按字段名读取Main与Attached配置并写上述槽；getter `41c756` 读取 `settings+4+index*4`。轮询 `424242` 经该getter取得主键，按键不成立才查附键。方向使用 `408713` 的当前按下查询，射击使用 `408398`；成功经 `4047b1→41784e` 写 `6350f4` 对应位。controller+38为0时整个轮询不执行。

新增测试执行完整轮询、getter和位写入，只供应已初始化settings singleton和物理按键查询。13条件覆盖八方向独立按键、无按键、主附同向、四向同时按下、射击与关闭轮询；settings数值直接读取安装配置。既有 `role-movement-input-clock-native.json` 的64个命令映射条件复用，不重跑权限/碰撞/网络。

当前正式A/D车体、左右方向键独立炮塔映射仍为重建。该原轮询明确把方向键与W/S/A/D并入相同运动位，不能用安装键名给现独立炮塔控制赋原来源。正式 `aim-turn.ts` 已使用合成role turn；旧文档中的固定0.9只描述此前实现，不是本次当前参数。

已有 `movement-commands-native.json` 复用四条同向姿态、delta0.2、turn0.5的原向量：左右command3/4的look旋转−/+0.1rad。Type1的forward仍为[1,0,0]，Type4的forward复制旋转后的look。原模型46d061/46cb49按炮塔角减车体角绘制，来源已在tank-runtime.md验收。因此这条原按键入口已能经已有命令数学解释先转look与Type4车体跟随，不必为了方向键再猜一个固定炮塔速度。当前静止A/D同时转两方向、Arrow独立input.aim仍与该原按键生产合同不同；正式映射的接线由主线协调。

这四条原向量只读收拢到 `role-key-direction-source-composition.json`；不是新的native或普通对局验收。

## 停止、混合键与主附冲突

`role-key-source-composition.json` 将13条新轮询来源与已有64条分派向量组合为12个具名情形。组合验证没有再次执行原程序；每条明确标为来源组合，不称连续物理键盘实测。

| 安装键组合 | 合并低四位 | 原command |
| --- | --- | --- |
| ArrowUp+A | 5 | 6 |
| W+ArrowRight | 9 | 5 |
| ArrowDown+A | 6 | 8 |
| S+ArrowRight | 10 | 7 |
| ArrowUp+S或W+ArrowDown | 3 | 1 |
| ArrowRight+A或D+ArrowLeft | 12 | 3 |
| ArrowLeft+A | 4 | 3 |
| 两组四方向全部按下 | 15 | 6 |

原主附绑定是同一逻辑方向的两个入口，主键已按下便不再查询对应附键。相反方向在不同逻辑位同时成立时不抵消：bit0优先于bit1，bit2优先于bit3。停止沿已有分派原证据：没有输入且previousMoving=0只调用idle4269f4，不派command0；previousMoving=1则同时派command0。两种delta0.05/0.2都保持此选择，分派尾清6350f4并更新61e590。

这些停止条件仅复用已有低四位/无其他位样本。松移动同时射击、焦点丢失、操作系统事件顺序、自定义绑定写回及旁观者+39分支尚无本片联合证据；现正式双通道输入的冲突策略不由上述表自动更改。原KeySetting初始化加载的完整执行也不在13轮询条件内，加载字段对照属于反汇编直接确认。

## 尚缺来源

本链没有独立炮塔方向位或独立角速输出。原 `431fd2/431fd9` 分别返回look/forward，原运动更新与actor枢轴显示已有来源；若继续保留当前额外独立input.aim通道，该通道仍需不同控制事件caller及目标字段才有原依据。此次没有修改正式控制。

本次继续核到具名角色显示桥 `422c4d→433190→42298b→actor virtual+94`：422c90/422c97分别传role+274 look与role+280 forward。四部件actor原表5c88c8的+94为466efb，输入forward/look分别复制到actor+1a4/+1b0，死亡actor+19c非零拒绝；这是角色姿态消费和插值桥，未发现独立按键或角速生产，不能据此增加另一套控制器。actor+34c炮塔显示角在46ca4d–46cad8由已有方向求角，46d092消费它减车体角；这些显示端入口不替代额外input.aim的控制来源。

字段归属须区分：role+288是从role+280开始的forward三向量第三分量，不是独立角度。actor+288由464a67读取byte参数后写整数位模式，actor+28c由464910资源加载支路写资源指针，也不是role方向角生产。三/四部件actor原表的virtual+74均为4646b0：输入float经57454b绕actor+10轴旋转[0,0,1]，再调virtual+78朝向setter4645dc。该角度入口存在，但本轮没有取得玩家input调用它的原caller；不据virtual槽存在推定Arrow独立控制。键盘poll的主附同位已充分，额外aim caller缺口到此保存，停止该显示地址范围的重复扫描。

安装Data中的八TXT属于RPGViewer说明与更新记录，其中ChangeLog/FutureWork/Readme_en为UTF-16，其他按GB18030读取；不能作为CDTank战斗说明。CPKUpdate.log只有`Open log failed`，Dracula.log只有Singleton构造行，qqgamelog只有登录时间，场景0022的17字节EngineLog为补丁运输文件，当前未取得数值运行记录。

证据：`recovery/output/role-key-poll-source-native.json`、`role-key-poll-source.disasm.txt`。复现：`recovery/.venv/bin/python tests/role-key-poll-source-native.py`。此片仅原来源验收，不关闭M2-03或原控制父项。
