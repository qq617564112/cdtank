# 页面音乐调用入口

原资源UIM01/UIM02已发布，页面根身份直接静态来源已补齐。BattleMusic已提供大厅/等待页consumer，正式页面生命周期接线及普通实际归主线。

| 原activation | vtable+18入口 | 原调用 | 曲目 | 循环参数 |
|---|---|---|---|---|
| 4c51f1 | 5cfa88 | 4c5293→4d9517 | ID183/UIM01 | -1 |
| 5095a1 | 5d4b00 | 5095f3→4d9517 | ID183/UIM01 | -1 |
| 50ea9c | 5d6658 | 50eae6→4d9517 | ID184/UIM02 | -1 |

page-music-source.py及output JSON/log为PASS_STATIC_PAGE_MUSIC_CALLS_ONLY，保存原EXE真实指令字节、直接call和原musicstring.dat映射。共用4d9517曲目相同不重播、换曲停止及原MP3发布证据复用audio-runtime.md；本片没有原native执行或普通播放验收。

前台page/lobby生命周期由主线拥有，音乐consumer归FX。独立login/胜负曲、完整音乐和M3-11父项保持未完成。

## 页面根身份

`page-music-root-source.py` 直接读取同一原vtable的初始化槽+38与active槽+18。初始化构造准确布局路径，调用原root加载后保存至同一对象+8：

| vtable | 初始化 | 根路径push / root保存 | 根 | active / 曲目 |
|---|---|---|---|---|
|5cfa70|4c1361|4c13b2 / 4c13ee|login.xml|4c51f1 / UIM01(183)|
|5d4ae8|507503|50754f / 50758b|roomlist.xml|5095a1 / UIM01(183)|
|5d6640|50a117|50a163 / 50a19f|room_main.xml|50ea9c / UIM02(184)|

这是直接同对象虚表关系；`page-music-root-source.json/log` 保存原指令地址和字节，状态PASS_STATIC_PAGE_ROOT_MUSIC_MAPPING。独立原登录业务尚未交付，本轮只接正式roomlist大厅与room_main等待页，战场原模式/地图音乐链沿既有来源。

## 音乐consumer

BattleMusic.playPage('lobby'|'waiting')从现audio.json.music查原UIM01/UIM02，play(mode,map)、setVolume与stop接口保持。原4d9517同曲去重映射为当前desired音乐ID相同时不暂停、不清src、不重置currentTime；换曲先停止旧媒体，所有曲目loop=true。最新目录请求序号阻止已切页面的旧加载选择曲目。dispose停止并移除audio与pointer/key/error监听，禁止晚目录完成或后续play重新启动。

page-music-consumer.cts/json/log为PASS_MODULE_LIFECYCLE_ONLY：真BattleMusic配recording HTML媒体，验证同曲currentTime17保留、183→184→战场选择、音量0跨切曲、最新请求覆盖旧请求、晚加载销毁无播放及监听释放。模块不证明浏览器输出或音频波形，原14MP3/174WAV解码与资源来源不重跑。主线拥有Battle/main正式lobby→WAITING→PLAYING/返回及scene销毁接线和唯一普通actual，FX不并行跑页面验收。

## 首普通播放有效范围

主线browser-page-music-lifecycle-consumers-2026-10-04T21-23-52-479Z.json保留FAIL：末导航about:blank未收到dispose观察结果，未据此改播放器或替raw写整体PASS。其正常用户手势解锁后大厅183/UIM01、普通Create等待页184/UIM02、普通Ready mode1/map7的199/GAM08、Leave返回183及Home原slider音量0均已真实执行。

三曲captureStream媒体峰分别0.1127580777/0.3144407272/0.2539831698，mediaVolume均0.5，playing/loop/单audio有效；这是媒体采样，不是最终扬声器postmaster输出。等待页资源加载完成后同184/currentTime从2.171606推进至7.157128，不重置。音量0记录HTML媒体volume0，不冒非零媒体采样为静音失败或最终设备静音测量。

dispose普通尾段由主线仅一次独立观察收取；在确证前保持browser销毁未验。三曲、Ready、来源与模块不重复运行。

## 正式生命周期验收

`PageMusic` 按正式活动页面路由到唯一BattleMusic：启动roomlist为183，成功Create/Join后WAITING为184，普通Ready后PLAYING按原mode/map表选曲，FINISHED沿用当前地图曲，正式Leave回183。拒绝Create/Join不切页，validation保原战场验收入口。重复快照不请求重播；scene销毁经dispose停止并释放音乐节点与监听器。

`page-music-business-accepted.json` 接受首实际结果中的玩家流程：原媒体策略先拒绝，实际鼠标输入后183播放；普通创建房间184，三CPU/地图资源准备期间同曲时间继续；普通Ready得到mode1/map7的199/GAM08，正常Leave回183；普通Home设置滑杆调0。音乐默认0.5，三首真实captureStream分别peak0.112758、0.314441、0.253983，均来自只读采样支路，不是最终扬声器测量。没有新增购买或活跃状态注入。

### 未完成范围

首实际raw21-23-52整体FAIL中的页面切曲/返回/音量段有效；末原生页面导航的dispose观察没有载荷。定向21-25-19只观察销毁仍未取得载荷，两个raw保持FAIL，停止重复该尾段。scene销毁接线和原媒体模块释放已由独立模块证据验证，不冒浏览器销毁实证。原独立登录流程、结果曲、混音时序和完整音乐/高清父项保持开放。
