# 完整正常来源动态运动正式切片

完整属性的正常角色现经原动态预测/OBB门禁后执行既有原NAV运动。碰撞许可、原重叠分离与已保存运动命令进入真实World；普通AI与人类仍通过相同输入门槛。此片不代表所有角色、静态通知和完整运动复刻完成。

## 正式归属与顺序

- `battle/roles/obb-intersection.ts`、`movement-obb-prediction.ts`、`movement-controller.ts`、`movement-separation.ts`持有已核对原执行的数值规则。
- `battle/movement.ts`持有原姿态/参数与NAV步进；`battle/dynamic-movement.ts`组装完整来源角色的动态门禁和姿态安装后的分离，不将原算法放入shared。
- `battle/actors.ts`先普通输入/aim，再预测、拒绝或提交，最后射击。动态拒绝保持位置/方向且已保存command归0；许可拒绝保持旧command。未输入的其他角色以已保存command预测，不能用尚未接受的新input替代原role+258。
- `battle/start.ts`在首局与再战姿态安装后调用分离；`battle/life.ts`复活清command/向量，World生命周期回调只对复活角色调用分离，其他角色不因一次复活被额外挪动。
- `battle/cpu/controller.ts`以同一动态门禁/NAV预测拟发输入。前进和转向均被拒绝时，只在普通倒退同样通过门禁的情况下发倒退input，不改位置/伤害/碰撞尺寸。

有地图时控制器固定预测f32(.3)，原预测不查NAV，经包装上限f32(.2)。实际步进才查NAV，并继续保留明确重建的Y贴地。姿态矩阵按原forward.z夹取、acos、近似2π、度数与engine精度构造，保留原六面轴/交叉轴特殊返回，接触也算重叠。

## 重叠分离

原426b92只处理树顺序的首个重叠，60单位候选只验NAV，失败设为对方位置再递归至深度51。coincident由原GetTickCount→srand/rand生成X分量；小值可能被原normalize归零而仍重叠，未加额外修正。

原规则模块的12完整原执行及网络pose state0对照通过，另见role-movement-separation.md。正式服务器以既有World clock供应跨平台时钟，以当前房间成员顺序组装角色，不宣称原OS uptime/TLS或原入场RB-tree顺序已恢复。此片只处理完整正常来源参与者；其他角色未补造原预测属性。首局/复活接线是重建权威生命周期使用原规则，不能当原网络入场全部状态分派完成。

## 验收

| 范围 | 结果与产物 |
| --- | --- |
| 原规则模块 | 1,139原engine核、18矩阵/23预测/10控制器矩阵、19控制器/5原链输出、288完整命令拒绝/停止与12分离输出；movement-obb-module-suite.log、movement-separation-module-native.log与movement-separation-module.log及各层JSON |
| 正常World动态输入 | 四个真实人类角色、显式完整原拥有来源、map20复用原出生点分离60单位，普通接近输入在NAV可以前进时被原动态门禁拒绝并清command；普通倒退可离开，aim和fire独立通过。其他未命令角色始终command0。world-dynamic-movement.json、movement-dynamic-world.log |
| 既有水平与转向 | 21车84次World步进、首局/复活/再战、12次离散转向、原0020八段墙角与独立普通撞墙拒绝；movement-dynamic-world-suite.log |
| 完整来源自然对局 | 五模式各两局普通移动/射击/命中/复活、库存消耗/重启、结算冻结/再战/清房全部通过；mode5两局必须OBJECTIVE且117目标全清。movement-dynamic-two-rounds.log/json |
| 编译发行 | 服务端独立构建，编译World完整来源mode5两局117目标全清；编译服务账户/迷彩保存与重启和原型来源五模式两局。movement-dynamic-{build,compiled-native,compiled}.log、compiled-native.json |
| 类型与工程边界 | 全仓类型及229可达正式模块无取证/渲染入口依赖；movement-dynamic-{types,boundaries}.log |
| 既有CPU与联机 | CPU规则/原窄口/真实墙角与原型来源五模式两局，普通双连接身份/隔离/输入/射击/结算/再战；movement-dynamic-{cpu-rules,network}.log |

运行`npm run test:combat:movement-obb`、`npm run test:combat:movement-dynamic-world`、`npm run test:runtime:original-movement-two-rounds`。双网页仍由独立3138/5193与CDP9258执行`test:combat:movement:browser -- "$CDTANK_CDP" --autopilot --reentry --hd --original-movement`，读取显式完整属性的两个真实账户，默认CPU来源不完整。

双网页最终1080p两局自然结束30987/55933ms，同tick快照20/35次一致，两真实账户观察bodyYaw、治疗Effect11/GA15与迷彩/战车资源、退出instances/voices归0、重启重进库存与快捷槽保留通过。证据为movement-dynamic-browser.log/json及两张movement-dynamic-battle截图。自启3138/5193/9258已停止。

## 剩余范围

已新增完整拥有来源VIP的独立movement前缀，供动态门禁和分离使用，完整属性ready仍为false；原VIP生命倍率来源仍未知。1134原对照/21车84真实World运动/普通输入双向碰撞及再战撤源检查通过，见vip-movement-native.json、world-vip-movement.json。用户将主线转为M1首件道具，VIP进一步取证已停止；缺属性peer仍不参加本原动态分支，默认原型角色不被宣称原碰撞完成。静态type100通知及超过8诊断已核验规则模块，但场景容器成员生产、实际通知下游尚未接入；正式动态组装不伪造静态事件。

最终各车OBB尺寸、全部原入场/网络pose分派和RB-tree顺序、OS随机时钟、垂直/斜坡及地图loader继续恢复。动态门禁/分离本身不会保证所有布局/全地图可达性，普通CPU十局通过不代表原AI。M2-03与原动态OBB完整正式切片保持未勾选。
