# 建房文字正式验收（UI-07-R-TEXT）

正式页面与长地图名展示夹具均为PASS，各6项检查。两次运行的server、Chrome、Vite和临时目录均完成清理。

`node --import tsx tests/browser-room-create-visual.mjs --text-only`通过正式大厅入口在800×600、1080p、4K核对33个源控件、三文字区域overflow/nowrap/center、原frame没有受到文字overflow样式影响、所有按钮中心命中。原生输入实际录入中文房名和中文密码，密码type=password保持；普通Escape卸载，再从正式入口打开下一分辨率。

长地图名另在独立展示路由挂载同一个正式RoomCreateDialog组件，提供明确超长中文map.name props，三分辨率确认scrollWidth超过clientWidth两倍而区域overflow:hidden；实际截图观察文字局限于地图源框，frame与按钮保持。该夹具只证明生产组件呈现范围，不代表原网络存在长地图名。

原文字clip前缀实际执行见room-create-text-source.md；display/metrics生产缺口见room-create-display-source.md。正常/hover/down/disabled/selected源状态复用已通过证据，本片没有更改按钮图像或网络规则，没有重跑建房事务、账户和五模式。

正式页面证据为`recovery/output/browser-room-create-text-formal.json`，截图为`browser-room-create-text-{800x600,1080p,4k}-open.png`。展示夹具证据为`recovery/output/browser-room-create-text-fixture.json`，截图为`browser-room-create-text-fixture-{800x600,1080p,4k}-long-map-fixture.png`。800×600与4K夹具截图可见地图文字局限于源文字框，frame和按钮完整；1080p具有同一组几何与overflow断言。
