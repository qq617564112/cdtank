# M2-01/02/03/04固定tank1数值验收

固定tank1、小勇士、pet1阿呆、part0、默认选择2001、map7的真实账户普通输入验收PASS。两个独立WebSocket账户通过正式Account/CreateRoom/Join/Ready、PlayerInput与Autopilot，186个相同tick的players/bullets及全部事件逐值一致。没有注入位置、生命、伤害、事件或胜负；未执行双网页绘制或原Windows客户端实测。

## 来源与装配

新Account不自动拥有角色。测试通过已有显式账户导入接口准备完整拥有字段，再走真实业务API；这证明明确装配向量，不证明原账户初值producer。完整字段和值保存于network.json.fixture。

| 装配字段 | 测试值与依据 |
| --- | --- |
| base+0/+8 | 73实例身份、1宠物定义；实例73是显式夹具身份 |
| base+2c/+34/+3c | 600/5/10，pet1原MaxHP/Critical/Lucky |
| equipment+1c/+24 | 74实例身份、1战车定义；实例74是显式夹具身份 |
| equipment+3c/+40/+4c/+50 | 100/70/15/30，tank1原Atk/AtkBonus/Def/DefBonus |
| equipment+34 | 0实验条件，原字段producer/默认语义未知；原消费者据此四精通减1并最低1 |
| equipment+58 | 2001显式道具字段；本配置当前被动技能筛选没有选中skill2001，不把默认快捷选择当自动技能绑定 |
| 其余拥有字段 | 依原reader完整字段集合显式0，包括成长/强化、纹理、其他道具；零值是实验条件，不能宣称原构造初值 |
| profile+a4/+a8 | 73/74；五part实例槽均0；资料其余字段0且两字符串空为夹具条件 |

pet1四精通原值3；+34=0使有效精通2。tank1源Move10/Turn8经datascale14移动下界12后分别参与精通公式。技能目录、限制、精通和f32转换直接复用已正式接线的完整433466模块与原执行成果，没有增加第二套数值计算。原执行覆盖及误差见combat-field-inventory.md、role-movement-modules.md、world-role-attributes-native.json。

## 实际数值与误差

| 项目 | 直接来源/正式规则 | 实际network观测 |
| --- | --- | --- |
| 前进与倒退 | 完整重算move140；4344e7同速度、倒退向量翻转；无独立加减速状态 | 各17连续50ms步、约7单位；最大位置误差0.008637，最大相对距离误差0.001153 |
| 停止 | 原command0复制姿态 | 7连续步实际位移0；源输出f32与0.01投影最大误差0.0000147 |
| look转向/车体对齐 | turn0.6806783676147461；原Type1方向对齐 | 17转向步最大look角误差0.0000661rad；实际50ms约0.034rad |
| 独立炮塔aim | 现input.aim×0.9×dt重建输入规则 | 17步每50ms0.045rad，最大投影误差小于0.00016；无原输入单位依据 |
| 连续射间隔 | 角色+50=0.5秒，原flag11/f32 deadline分派；默认选择不自动施放skill2001 | 8间隔0.502–0.522秒，均在源duration及下一50ms步内 |
| 生命 | 原合成MaxHP600，正式出生生命同步 | 两端600；自然命中600→557、实际hit.value43一致 |
| 攻防字段 | 原合成Atk0.7999999523、Def0.1199999973、Side0.6999999881、Back0.5；两个Bonus70/30 | 合成值不证明命中伤害公式；现伤害仍TankAtk100进入35+Atk×.08得到43 |
| 尺寸 | 原constructor footprint49×52与原NAV/动态OBB消费者 | 本次测量段无阻挡步；最终按车尺寸producer及球体命中半径仍未知 |
| 弹丸 | 当前重建360单位/秒、2.2秒TTL、30/20出生偏移 | 同bullet ID逐tick实际轨迹对照360，距离误差最大4.3e-14；自然B10首次观测→hit0.35秒、创建→hit观测区间0.35–0.4秒 |

50ms来自正式runtime/tick固定delta，不用客户端接收墙钟代替模拟dt；连续射击startedAt采用服务端实际毫秒时钟。快照坐标舍入0.01、角度0.0001；measure逐步以原f32数学对照并区分观测阻挡，当前前后向样本均无阻挡。飞时由相同ID弹丸出现/移除及同tickHP变化关联，未取得细于tick的真实碰撞时间。

## 唯一关键来源缺口与停止

独立炮塔input.aim的原控制生产入口/单位转换仍未取得。原431fd2仅返回role+274朝向；431fd9返回+280前向。完整4344e7与433190/435088更新运动look和车体forward，不能据此给网页独立input.aim赋0.9原来源；原427d0a/427d11的TurnLeft/TurnRight仅调试文本，不是控制生产。原actor46d061/46cb49消费炮塔与车身角用于模型枢轴，不能反推输入速度。取得独立输入caller前，现0.9保持明确重建。

原弹速/伤害的服务端创建、更新和命中公式仍未知；复用ordinary-2001-flight-chain-gap.md的最小链：2001第二技能4020→007/SE30是即时射击端点显示，不能转作飞行或命中资源。源码位置battle/projectiles.ts的360/TTL/伤害表达式只是当前重建消费者。本轮没有为这些未知入口重复开发或修改生产参数。

已批准的tank-numeric-sol.ts位置本轮不创建：已证规则已有正式消费者，独立炮塔缺关键原caller，没有必要重复包装旧成果。root无需新接线hunk；以后取得原输入合同才替换actors.ts的`player.aim += input.aim * 0.9 * dt`。本轮停止于一车已有源充分数值的真实输入/双连接验收；原server/完整M2父项及双网页/原客户端测量仍未完成。

复现：

```sh
npx tsx tests/tank-numeric-sol-network.cts
npx tsx tests/tank-numeric-sol-measure.cts
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop tests/tank-numeric-sol-network.cts tests/tank-numeric-sol-measure.cts
```

证据：tank-numeric-sol-network.json/log、tank-numeric-sol-measure.json/log、tank-numeric-sol-types.log及专属server.log。3417子服务及临时数据库已清理。初次房名超过正式8字限制的拒绝样本另存network-room-name-fail.json，不覆盖有效运行。

## 拥有期限字段来源补充

`owned-tank-duration-mastery-source.json` 通过原MyTank getter4d88f1与3aab handler428ec5/gamestring875，确认owned+34为剩余分钟；0条件的四类精通减1下限1仍复用原数值消费者。原购入初值、期限扣减和维修恢复producer未确认，现BUY写0仍明确重建。字段含义不再列为未知；不扩大已验角色组合或改变正式数值行为。
