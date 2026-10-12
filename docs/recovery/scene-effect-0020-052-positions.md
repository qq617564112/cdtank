# 0020 Effect052五位置实际绘制

原269–273五放置在两个普通网页各实际提交两个原sprite，逐sprite三组自然不同顶点、原中心、尺寸、纹理、UV和packed alpha全部PASS。十张实际canvas PNG保存，两端五位置合计二十组sprite资格闭合。本片复用已保存普通双001/两CPU实战观察，无生产改动。

## 五位置双端

| 放置 | 网页1实际draw 2988/2989 | 网页2实际draw 2988/2989 | 网页1/2实际capture frame |
| --- | --- | --- | --- |
| 269 | 997 / 998 | 307 / 308 | 269 / 228 |
| 270 | 1199 / 1197 | 476 / 480 | 269 / 228 |
| 271 | 656 / 673 | 219 / 219 | 367 / 1990 |
| 272 | 28 / 28 | 357 / 357 | 2440 / 240 |
| 273 | 133 / 140 | 1044 / 1044 | 292 / 236 |

每放置每网页的2988、2989均保存三组不同自然顶点及递增frame，capture含同一实际提交帧的两个source节点。实际六顶点三角形centre对应原placement position的Web X反射，误差小于0.001；sprite边长分别80与90，对应原scale40与45。UV均为全纹理两三角形(0,0)/(1,0)/(0,1)、(0,1)/(1,0)/(1,1)，白RGB，packed alpha为102/255与168/255；材质纹理为原发布`Data/effect/xy/FlareBrightOrange_yellow3.png`。

`scene-effect20-052-positions-269-page1.png`至`scene-effect20-052-positions-273-page2.png`共十张PNG直接由真实canvas dataURL解码保存，均320×180，无重绘。`scene-effect20-052-positions-contact-sheet.png`只将十张原图按位置与网页排列。图中正常开火烟光与052来源由实际draw metadata区分。

## 普通业务来源

运行`tests/browser-scene-effect20-052.mjs --round-only`使用普通mode5/0020建房、两网页原001、两个CPU、双方Ready与正常autopilot按钮。浏览器Input.dispatchMouseEvent点击既有UI，nativeSelect使用真实键盘；观察只包装原spawn/release/audio调用并读取实际Babylon mesh.onBeforeRenderObservable、canvas与真实world，没有position/camera/HP/time/通知注入。

保存的initial两端实际world为PLAYING、mapLoaded20、四人/两CPU/全001。finishedWorld为第一局自然FINISHED，两个人类isAutopilot=true；serverTrace556行保存正常原子弹命中和实际服务tick1–3549。两端各五次原名spawn与源matrix严格对应269–273。姿态与位置捕获来自正常autopilot移动后的自然相机；源sprite角速度15/−10度每秒及不重启合同复用既有052 native/source/normal/round验证。

## 证据索引

`tests/scene-effect20-052-positions-actual.py`独立核上述二十组sprite、三自然姿态、同帧双sprite PNG、矩阵与实际业务world，`recovery/output/scene-effect20-052-positions-actual.json`为PASS。

| 原运行 | 原整体状态 | 本片接受范围 |
| --- | --- | --- |
| `browser-scene-effect20-052-round-2026-10-04T01-54-54-541Z.json` | FAIL：再战gate等待WAITING；实际round2已PLAYING | 保留的catch.observed中五位置双端实际draw/capture，initial/finishedWorld与serverTrace |
| `browser-scene-effect20-052-round-run.log` | 保存原gate错误与运行结束 | 原专属进程退出日志 |
| `scene-effect20-052-round-interrupted.json` | INTERRUPTED：独立补验143 | 无位置或再战PASS结论 |
| `scene-effect20-052-process-cleanup-final.json` | PASS | 3302/5332/9532无监听、专属临时目录无残留 |
| `scene-effect20-052-round-actual.json` | PASS | 后续正常自然再战保留与第二局draw，复用不重跑 |

原整体FAIL与143记录保留不覆盖；本片只为既有有效五位置观察段建立独立资格，没有运行新对局、未改生产、未复跑source/完整清理/长两局。

## 限制

原记录没有逐capture玩家坐标，只保存实际frame及initial/finishedWorld，不将它们当作捕获时玩家坐标。实际draw提交与canvas PNG不证明原GPU像素或高清性能；完整原NAV及历史客户端再战producer沿既有明确边界。
