# 正式坦克履带动画（M3-03）

全部坦克共用原 A/B 履带相位。正式 TankView 向 X/Y 的原 MV3 ShaderMaterial 提交当前帧，动作切换保留相位；M/U 材质不参与切换。

## 来源和正式接口

- 原四组件 `46e0e3/46cec7`、三组件 `46aaef/4695bf`：同一实例的 X/Y 共用索引；累计和严格大于 float32(0.1) 切一次，累计归零，长帧不补多次，停止保留索引和累计。
- 原场景时钟 `45004a` 和引擎 `10028030` 已恢复。沿用 TankView 的原时间转换，未修改游戏或服务端运动速度。
- 既有来源见 `role-track-texture-sol.md`、`role-actor-global-clock-sol.md`、`role-pose-producer-sol.md`。生产相位位于 `apps/web/src/assets/tanks/role-track-texture.ts`，不从取证目录导入运行代码。
- **重建接口**：RoomSnapshot 坐标作为现有网页插值的目标；在每帧位置更新之前，水平距离大于 float32(0.001) 时允许该帧累计。它不是原 3aa6 消息，不使用按键、动作编号或 `moving` 布尔值充当原门禁。没有本帧目标更新时冻结，断线停止提交不会留下持续滚动。
- 死亡冻结；复活和轮次位置重置清除待移动状态，保留实例相位；新实例从 A 开始。销毁移除原帧观察者并释放两张借用纹理。
- 已选 XY 迷彩复用当前账户来源的原 A/B 资源。未选迷彩或 CPU 默认模型，从模型材质自身的原 A 文件名精确匹配原纹理表中的配对帧，21 定义均有唯一匹配，不推断商城默认、不写账户皮肤字段、不改变 M/U 外观。
- 前进和倒退共用原 A/B 顺序；原相位更新不读取前进/后退符号。原地仅旋转而没有位置目标时不滚动。

## 文件归属

正式代码：`assets/tanks/role-track-texture.ts`、`tank-view.ts`、`tank-textures.ts`、`render/battle-players.ts`。

专项检查：`tests/role-track-texture.cts`、`tank-track-lifecycle.cts`、`battle-players.cts`、`browser-tank-tracks.mjs`、`browser-tank-track-resources.mjs`。服务端、协议、React 页面、场景主入口和已有业务规则未修改。

## 验收入口

```sh
npx tsx tests/role-track-texture.cts
npx tsx tests/tank-track-lifecycle.cts
npx tsx tests/battle-players.cts
npx tsc --noEmit -p apps/web/tsconfig.json
node --import tsx tests/browser-tank-tracks.mjs
node tests/browser-tank-track-resources.mjs <CDP WebSocket URL> <web origin>
```

普通对局脚本自建独立服务、SQLite 账户、Vite 和 Chromium，端口 3261/5421/9621。拥有记录仅在建房之前提供明确来源夹具，通过正式 React Home 选择战车、建房/加入/Ready；前进/倒退由普通键盘输入驱动，不写活跃位置、伤害、事件或胜负。`CDTANK_TRACK_TANKS` 可限定尚未验过的真实定义 ID。小画布用于软件渲染的动画功能检查，不代表高清性能验收。

独立资源脚本只证明全部默认模型的实际 WebGL 消费者、动作材质和释放，不代表普通输入或服务器动作触发。生命周期专项只证明消费者合同，双端玩家流程另由普通对局证据证明。

## 当前证据

原生向量：生产实现对照原程序既有四组件70阶段及Type4 32阶段，共102阶段通过，见 `tank-tracks-native-vectors.log`。

生命周期、双向车体/炮塔及异步角色替换基线：`tank-tracks-lifecycle.log`、`tank-tracks-players.log`。

全部21默认模型真实WebGL：`browser-tank-track-resources-2026-10-04T15-26-46-531Z.json`，每车X/Y原A/B实际绘制、8种动作消费者和完整实例释放通过。

正式双端普通输入：全部21定义通过明确范围。小勇士 `browser-tank-tracks-2026-10-04T15-22-16-411Z.json` 接受两页W/S实际A/B绘制、停止冻结与244共同tick，最终hostLeave未验；19车 `browser-tank-tracks-2026-10-04T15-23-38-725Z.json` 接受已完整结束的19例及双Leave，最后158之前浏览器无响应不算通过；酋长新浏览器 `browser-tank-tracks-2026-10-04T15-38-27-445Z.json` 首补验完整PASS。合计4789同tick两端全players相等，原始整轮FAIL保持，完成范围由 `tank-tracks-accepted.json` 明确索引。

Web类型、专项测试类型与独立发行构建通过，见 `tank-tracks-types.log`、`tank-tracks-web-types.log`、`tank-tracks-web-build.log`；隔离产物 `/tmp/cdtank-track-web-dist` 含本帧待移动消费及默认B加载。专属服务、浏览器、Vite与临时数据库均清理。

M3-03完整纹理、光照、全内容性能和原网络插值父项保持未完成。
