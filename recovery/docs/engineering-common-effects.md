# 共用效果规则与专有状态职责

跨效果族共用的原空间、变换、颜色、quad、帧时钟、路径时钟、绘制选择和sprite网格归apps/web/src/render/effects/common。EffectRuntime保留唯一deviceStates与有序提交，common不持有各族生命周期。

| 归属 | 真实职责 |
|---|---|
| common/types | EffectVec3、EffectColor跨族类型 |
| common/motion、delta | Sprite与model共用的原半隐式积分与唯一delta校验，保留Z分量f32暂存 |
| common/orbit | 各族共用的轴归一化、原四元数和局部+Z半径轨道 |
| sprites/appearance | Type1初始外观、缩放/角度更新与颜色减量 |
| particles/effect-emitter-space | Type6启动、重置、父/世界空间积分、路径覆盖轨道 |
| common其余八模块 | 原矩阵/颜色/角点/帧路径规则、绘制选择及实际sprite后端；quad持有各族共用条带顶点契约与交替绕序索引 |

所有正式、取证CTS、七渲染验证入口和资源工具直接引用实际所有者；旧平铺入口删除。函数运算顺序、浮点精度和随机流保持原合同，无转发兼容层。

## 验收条件与入口

`for file in tests/effect*.cts; do npx tsx "$file" || exit; done`及`npx tsx tests/skill-effect-runtime.cts`运行本片70项CTS。原数学与各族生命周期CTS检测运算、坐标和更新时序改变；effect-family-draw.cts检测实际网格/UV/颜色/索引/释放改变；effect-manager-order.cts和技能树夹具检测跨族状态顺序和清理改变。沿用已有原程序取证输出进行比较。

七独立渲染页面通过browser-effect-model、browser-effect-bolt、browser-effects、browser-effect-particles、browser-effect-overlay、browser-skill-effect、browser-effect-camera-shake检查生产像素、寿命、声音与释放。七独立构建和正式Web构建检查每个入口的实际依赖解析；全仓类型和test:architecture检查旧入口残留及诊断进入发行依赖。

browser-cpu-entry与browser-healing-item --autopilot --reentry --owned-textures检查正常资源重试、CPU输入运动、双网页自然连续两局、冻结结算/再战、治疗表现和账户重启保存。test:server:compiled检查编译账户/迷彩联机重启与五模式各两局。

## 当前状态

迁移已完成：八个模块归common，sprite-state与emitter-space按实际跨族职责拆分，条带顶点/索引归common，全部生产和验证消费者引用更新。70项CTS全部通过；Web类型及218个正式可达模块边界通过，common禁止导入七专有族。七实际Chromium像素/寿命/释放通过，指定模型44组、bolt6组、overlay19组、爆炸16帧及粒子/Skill12/抖动均沿用同一生产实现，清场无残留。CPU正常入场/资源失败重试/自动准备运动返回、正式离房恢复及编译账户保存/CPU五模式两局通过。

正式Web与七独立渲染构建全部通过，分别耗时2分03秒、1分56秒、1分19秒、1分17秒、1分17秒、1分18秒、1分19秒、1分17秒；全仓类型通过。双网页两局自然结束分别等待57201和116027毫秒；结算冻结/再战、原治疗Effect11/GA15释放、账户服务重启重进、库存与快捷槽保留均通过。编译服务真实账户/迷彩网络保存重启与CPU五模式各两局通过。所有本片命令退出0；证据见engineering-common-effects-{rules,pixels,cpu,two-rounds,leave,build,compiled,types}.log与七族browser JSON。

## 范围

工程职责与已有原规则验收不等于全部技能、资产和高清实战性能已恢复。渲染入口的指定效果诊断与服务器原技能触发资格分别验收。
