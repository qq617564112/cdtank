# 原建房窗口浏览器验收

结果：PASS。运行 `node --import tsx tests/browser-room-create-dialog.mjs`，使用独立3194服务、5229 Vite、9299 Chromium。

真实网页通过原 createroom.xml 控件矩形、源图片与 PNG 解码检查；1080p/4K 均可见。原生输入支持32字房名、64字密码掩码，草稿取消、Escape、关闭保留外层表单。人数箭头保持最少≤最多并按地图源边界禁用；模式4以上友伤禁用。

Tab 控制字符密码真实 CreateRoom 请求得到服务端 `ROOM_CONFLICT`，拒绝后窗口、所有草稿与密码焦点保留；替换合法密码后普通建房进入权威 WAITING。第二浏览器错误密码被 `ROOM_JOIN_REJECTED` 拒绝，正确密码加入相同 WAITING 房间并观察到相同人数与友伤配置。证据见 `recovery/output/browser-room-create-dialog.json`、日志及1080p/4K截图。
