# 战车actor原时钟浏览器验收

生产 `TankView` 的 `scene.onBeforeRenderObservable` 驱动路径与原actor执行结果一致：战车1的M/U/X/Y四组件，待机01、长帧发射03和直接传入原始delta三组共60个组件时钟步骤，其时间、完成消息和定时事件全部相同。根节点的action/actionClocks元数据同步一致。

`tests/browser-tank-actor-clock-sol.mjs` 使用正常资产查看页面的Babylon场景，加载真实生产 `TankView.loadPreview` 和原战车组件。停止场景render loop后临时覆写engine.getDeltaTime，逐样本通知实际onBeforeRender observable；待机和长帧发射未直接调用advanceAnimations。输入来自独立源时钟回放，不修改战斗生命、位置或结果。

| 浏览器帧秒数 | 原GetDeltaTime规则 | scene保存的float32 | 每步actor tick |
| --- | --- | --- | ---: |
| 0 | 0 | 0 | 0 |
| 0.016 | 0.016 | 0.01600000075995922 | 76 |
| 0.499999999 | 保留 | 0.5 | 2400 |
| 0.5 / 0.75 / 2 | 0.1 | 0.10000000149011612 | 480 |

阈值比较发生在scene的float32保存之前。略小于0.5的输入保留后舍入为0.5，而恰好0.5及以上先替换为0.1。原getter11条执行样本另与生产effectModelEngineDelta逐一对照。

发射03在每个长帧只增加480tick，第4次通知产生真实源effect1/attack1事件，第6次达到动作结束：四组件time固定为duration−100=2781，overMessage变为0，完成消息各发一次，firing清除。后续通知不再产生完成消息。独立直接API用例advanceAnimations(2)按调用者给定的2秒立即完成，证明浏览器帧过滤只位于onBeforeRender入口。

`tests/tank-actor-clock-native-sol.py` 重用原gbengine.dll映射执行actor1000a7b0和真实timed-message查询/通知，读取源战车1的01/03时长和事件，生成12条组件/action序列、60个步骤。输入按已恢复的GetDeltaTime规则和scene float32保存转换，直接API用例保留原始2秒。它不通过生产JavaScript时钟计算期望值。原getter及scene调用链独立执行证据分别见effect-model-source-state-native.json及role-actor-global-clock-sol-native.json。

每组关闭TankView后等待异步释放，mesh/material/texture和onBeforeRender observer数量恢复基线2/2/3/1。finally恢复engine.getDeltaTime、原mesh启用状态和原render loop，关闭测试页面与专用Vite。

## 复现与证据

```bash
recovery/.venv/bin/python tests/tank-actor-clock-native-sol.py
```

启动专用Chrome：

```bash
/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome \
  --headless --no-sandbox --disable-dev-shm-usage \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --remote-debugging-port=9255 --user-data-dir=/tmp/cdtank-actor-clock-chrome-9255 about:blank
```

从 `http://127.0.0.1:9255/json/version` 读取webSocketDebuggerUrl后：

```bash
node tests/browser-tank-actor-clock-sol.mjs '<CDP-WebSocket-URL>'
```

脚本自行启动并停止Vite5202，无需服务器。完成后停止Chrome9255。运行证据为recovery/output/tank-actor-clock-native-sol.json、browser-tank-actor-clock-sol.json和tank-actor-clock-browser.log；现有3001/5173服务不受影响。

## 验证边界

这是独立的原时钟功能回放。浏览器墙钟近似、完整原scene阶段门禁与浏览器渲染调度仍有差异；不证明完整原D3D场景执行顺序、所有战车动作或高清完整对局性能。本次getter原执行样本没有负delta，未补造负输入用例。
