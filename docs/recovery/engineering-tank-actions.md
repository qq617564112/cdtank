# 战车动作、时钟与挂点职责

六个原动作/时钟/标签/炮塔轴规则与客户端专有弹药动作视觉规则归apps/web/src/assets/tanks。TankView和EffectRuntime直接消费同一实现，六旧平铺入口及shared/role-ammo-visual删除，不留转发副本。

| 模块 | 实际职责 |
|---|---|
| effect-action-events、effect-actor-clock | 原事件区间、演员步长、GotoAction开始值、结束消息及超时状态 |
| effect-tag-sampler | 原标签关键帧/插值采样 |
| effect-tag-world、effect-tag-matrices | 原车体/炮塔世界矩阵、七主挂点稳定引用和缺失标签行为 |
| effect-turret-pivot | 炮塔轴与角度修正 |
| role-ammo-visual | 原有符号DWORD效果名和03/attack1逐记录覆盖范围；只有客户端执行 |

common仍持有矩阵/向量规则，runtime仍持有实际树/随机/资源和提交顺序。本片不改变动作、float32运算、主挂点身份或回收行为。

## 验收入口

六原规则CTS及tank-tags、role-ammo-visual、item-effects、skill-effect-runtime、effect-manager-order、effect-family-draw对比既有native输出，检查动作时序/标签采样/世界与父矩阵/炮塔轴/名称覆盖、生产通知树和绘制顺序。全仓类型与test:architecture检查悬空引用及旧入口残留。

browser-tanks检查21车实际组件/顶点/炮塔/动画/原结束/死亡/挂点/延迟销毁；browser-owned-tank-textures与browser-life检查正式迷彩/生死资源表现；browser-tank-actor-clock-sol使用原时钟输出比较实际TankView，并检查资源释放。七效果browser命令检查TankView/runtimes实际动作消费者、像素/寿命和清场。

CPU正常入场/资源重试/运动返回、双网页托管自然连续两局/冻结结算/再战/治疗释放和账户重启库存/快捷槽保存作为正式回归。正式Web、五个消费TankView或runtime的model/bolt/overlay/skill/shake诊断与资源工具独立构建检查实际依赖。服务端独立构建后检查发行JS/map不含客户端专有role-ammo-visual，并运行编译账户/迷彩保存与CPU五模式各两局。

## 当前状态

七规则模块和所有消费者迁移完成；12相关CTS、全仓类型/218可达模块边界通过。5780原事件区间/100步长、304原动作/5168演员tick、77挂点轨道/8570矩阵、2079世界矩阵、144炮塔补偿及1861轨道/14888采样矩阵通过。实际21车组件/顶点/炮塔/动画/死亡复活与延迟销毁、拥有迷彩独立身份/表现/异步清理、正式Battle死亡模型/退出和HUD隔离通过；原getter11样本与生产beforeRender 60组件tick/事件/长帧f32/异步清理通过。七族像素/生命周期/零残留、CPU入场/重试运动返回、正式离房和编译账户迷彩保存/CPU五模式两局通过。新服务端308个发行JS/map均不含role-ammo-visual及两个导出函数（engineering-tank-actions-server-boundary.log）。

双网页自然两局分别等待60233和99991毫秒，冻结结算/再战、原治疗Effect11/GA15释放、账户重启重进与库存/快捷槽保留通过。正式Web构建通过，五个实际效果消费者model/bolt/overlay/skill/shake与资源工具独立构建全部通过，正式Web与客户端/服务端相关构建和本片各验收命令均退出0，证据见engineering-tank-actions-{rules,tanks,textures,life,clock,pixels,cpu,two-rounds,leave,build,server-build,server-boundary}.log。

## 范围

弹药视觉名称和ELK覆盖范围已有客户端适配，生产确认消息完整弹药切换接线仍由M2-02恢复。此片工程归属及现有动作/挂点验收不代表原移动/姿态全部生产接线或高清全内容联机性能完成。
