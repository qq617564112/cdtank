# 服务端职责整理验收

E-02最后一片将破坏目标伤害/命中及摧毁计分/时间和事件写入收进modes/objectives.ts；角色属性、部件被动技能、技能来源及复制库存投影收进battle/projection.ts；托管切换的CPU门禁、重复设置、控制器创建、输入与独立序号重置及等待确认取消收进battle/autopilot.ts。

World保持唯一房间注册表、ID分配、成员/局号/阶段门禁与事务编排。step先判断截止，模拟按角色、弹丸、目标推进；弹丸伤害回调同步提交决定性结果，弹丸循环读FINISHED停止；开局先重置阶段/时钟和模式/角色，再创建依赖出生点的目标并补等待房间。finish只有正式提交成功才补房。小型列表与直接来源读取仍在World，不增加无实际需要的查询层。

index只读取配置、构造存储/World/TSRPC、组装绑定/传输和消费依赖、注册账户/房间/战斗/消息、启动tick与服务。原有账户、场景、目录、导航、控制器模块各有独立职责，不以移动全部文件或压低行数作为验收标准。当前index55行、World421行只是规模说明。

## E-02要求与证据

| 要求 | 正式职责与验收 |
| --- | --- |
| 账户 | accounts/api、tank-textures、battle-binding；编译真实账户选车/装备库存/迷彩原子事务、隔离及服务重启保存通过 |
| 房间 | rooms/create、admission、membership、cpu、departure、availability、quick-match、preparation、snapshot、chat、transport；26模式地图、密码/满员/幂等回滚、迁移身份、准备/换队/再战、CPU增删、完整离场结果/断线、最后真人CPU清房逐片通过 |
| 战斗 | battle/catalog、attributes、preparation、projection、accept-input、autopilot、actors、life、projectiles、start；拥有来源冻结/原完整属性、序号拒绝/托管隔离、自然输入施放消费、碰撞/死亡复活、两局状态重置通过 |
| 玩法 | modes/start、outcomes、objectives；VIP/队伍生命/击杀弃权、占领与破坏目标实际命中/结果/再战通过，原玩法依据仍属M2 |
| 结算 | settlement/match-result、finish-round；一次性冻结/赢家/时间/完整结果、同步清弹丸/停止步进通过 |
| 运行与依赖 | runtime/config、content-paths、tick及独立构建/启动；207正式可达模块无取证/渲染验证依赖，服务端与Web构建和类型通过 |
| 迁移持续业务 | 各专题保留逐片日志；最后正式编译账户迷彩联机重启和CPU五模式各连续两局、正常网页地图战车加载/准备取消/换队/退出通过 |

最后一片tests/match-rules.cts补充真实原OBB弹丸命中后的实际HP差/末次截断、原hitScore和destroyScore、事件坐标及destroyedAt断言，不直接注入命中结果。source/attribute夹具覆盖126原属性及21战车生命装填；本人AI自然两局和实时双连接托管输入隔离/恢复、消费/效果、重启通过。两局为编译World模拟时钟；实时双连接托管不是完整两局浏览器证明。

最后日志engineering-server-boundaries-{build,web-build,sources,attributes,match,terrain,autopilot,autopilot-network,compiled,browser,types,boundaries}.log。完整逐片合同详见tasklist中E-02引用的专题，当前结构验收不代替全部原规则、全部资产/界面功能、全内容高清与实时多端验收。

E-02可按上述结构和持续回归范围完成；完整复刻继续按M1–M8恢复。后续工程主线转E-03正式资源查看工具与验证入口隔离，并继续E-04真实共享消费者审查，新功能只能进入对应模块。
