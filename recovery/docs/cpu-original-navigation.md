# CPU路线消费正式原运动尺寸

完整属性角色的CPU路径规划现消费与正式运动共用的49×52原构造尺寸及原434cee采样核。它不再用原型中心扫掠/20半径替代已接线的水平运动。CPU规划仍是重建AI，原AI及所有地图可达性不由本片证明。

## 模块与合同

`battle/movement.ts`提供唯一原构造尺寸及正式预测；`battle/cpu/original-navigation.ts`将原水平采样包装为CPU路线通行合同。`battle/cpu/navigation.ts`继续提供分步A*，接收数值半径或实际规则策略，缓存键明确区分半径与原尺寸；`battle/cpu/controller.ts`在规划、脱困、弯角跳点、待搜索前缀与候选接近点共用该合同。`battle/actors.ts`只选择完整来源的策略，缺属性/VIP沿用明确原型。

原路线采样使用路线朝向，前进command1与不大于6原单位的间隔，中心必须有效，地面高度取实际NAV。它假设车体已对齐，是重建规划约束，未宣称任意车体姿态或连续扫掠精确可达。实际look/forward不在规划里伪造；转向和前进仍经普通输入及正式原wrapper。执行时预测当前完整姿态，圆弧不前进时可尝试普通直行，不修改碰撞、位置或伤害。

原运动将输入解释为离散命令。CPU用半个原turn×dt作为最接近朝向的停止转向阈值，避免小模拟转向被解释成整步左右摆动；步进与正式射击之前的预测路径仍唯一。原世界运动算法、协议和客户端没有复制。旧根目录bot-controller/bot-navigation与临时battle/navigation入口已删除，正式CPU功能全部归battle/cpu；账户托管、首局/再战与房间CPU管理消费唯一控制器。

## 验收

- `npm run test:cpu:original-navigation`：窄24单位NAV口原型中心路线可过但原采样拒绝；宽口绕行每段独立调用原command1核校验；渐进/完整规划一致；不同尺寸、规则及数值半径缓存隔离；不可达不返回直穿路线。原输入12次小角度直行保持不抖动，真实0020自然出生点经8段墙角路线到达目标9单位内；另有普通输入直接撞墙的独立拒绝见证，避免要求安全路线每次必然撞墙。既有真实地图墙角脱困、原0020弯角、目标射击/协调/慢车/待搜索移动保持回归。
- `npm run test:runtime:original-movement-two-rounds`：完整拥有来源五模式各两局，普通移动/射击/命中、治疗库存与重启、结算冻结/再战/清房。mode5原0020两局各清完117原场景目标，result必须OBJECTIVE，禁止以TIME_LIMIT通过。复活随机源固定测试种子0xcd7a2026，只控制普通随机选择，不注入出生点或状态；路线规划保留实际2ms预算。旧无种子夹具曾出现团队模式本人未移动断言失败，随后独立运行通过；固定seed使来源及复活选择可复现，未删减移动断言。
- `npm run test:combat:movement-world`：21车84次正式水平接线、双方向快照与渲染/生命周期保持通过。
- 普通双连接、编译服务账户迷彩保存/重启与原型来源五模式两局；另单独从临时目录导入发行World/account-store执行完整来源mode5两局，均必须OBJECTIVE且全部117目标清空，见cpu-original-navigation-compiled-native.log/json；224正式依赖边界、全仓类型与服务端独立构建按本片日志验收。Web生产源码未改变，搬迁后双网页1080p两局自然结束77264/100012ms，同tick快照53/68次一致，Effect11/GA15及迷彩/战车资源保持，退出实例/声音归零及账户重启重进通过。

模块搬迁后的最终规则、两局、编译与浏览器验收分别见`cpu-original-navigation-final-{rules,two-rounds,compiled,browser}.log`；原路线探针拒绝次数受2ms调度影响，不将它作为安全路线必撞墙的门槛，拒绝证据由独立普通撞墙输入保持。

本片日志为`cpu-original-navigation-{footprint,legacy,targeting,two-rounds,world,types,boundaries,server-build,network,compiled,browser}.log`。本片保存cpu-original-navigation-two-rounds.json、cpu-original-navigation-browser.json及初轮截图；迁移后浏览器单独保存cpu-original-navigation-final-browser.json及final-battle两张截图，编译完整来源mode5保存compiled-native.json；原专题通用输出继续表示最新正式实现，之前的通过记录保留各片独立日志。

## 剩余

团队模式允许规则规定的TIME_LIMIT，不能由两局通过宣称全部对抗模式的导航/战斗效率已完成。全部原地图/车体尺寸变化/动态角色OBB/斜坡垂直处理/原AI仍需各自门禁。当前尺寸是已证构造值，不宣称最终每车尺寸；场景物体的完整动态阻挡尚未正式接线。后续已接完整正常来源的原动态OBB与首局/复活重叠分离，见role-movement-dynamic-world.md；全角色来源/静态通知/原入场顺序及最终尺寸和垂直数据仍待恢复。完整M2-03仍不勾选。
