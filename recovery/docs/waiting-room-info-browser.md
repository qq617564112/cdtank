# 原等待房间资料浏览器验收

最终PASS：两个独立正常网页、17项检查、五张截图。密码房和公开房的原资料均匹配权威网络快照及原地图表，普通Close/Leave清空两页资料；专用服务、Vite、Chromium和临时目录全部清理。

运行 `node --import tsx tests/browser-waiting-room-info.mjs`。脚本使用独立服务端3193、Vite5228、Chromium CDP9298、临时账户数据库和两个独立正常网页；保留3001/5173服务。

两个网页通过普通账户、建房、密码输入、房间选择、Join、查看原等待房间、Close和Leave操作验收。二进制WebSocket请求、响应和RoomSnapshot按实际协议解码。密码房最低人数为原表下限四人，公开房最低人数为原表下限四人，两真人保持WAITING。

验收内容：

- 普通UI创建模式1、地图6密码房；错误密码Join被拒绝，拒绝页无世界快照或原等待面板，正确密码Join成功。
- 两页原`txtRoomName`、`txtMapName`、`edtMapDesc`、`txtGameTime`和`picLocked`逐项匹配权威`roomInfo`及解码网络快照。地图名称、完整说明和秒数同时匹配当前模式原始`m001`表。
- 房名中的HTML形式文本使用权威返回房名并通过`textContent`呈现，无HTML子节点。
- 1920×1080及3840×2160检查`room_main.xml`控件累计坐标、实际屏幕边界、原固定/按钮裁片和PNG解码。完整地图说明使用可聚焦原生滚动区域。模式1地图6的完整原说明在102像素高区域内全部显示，无溢出；脚本在实际溢出时验证End键滚动。
- 两页普通Close、Leave清除原资料；随后普通UI创建模式5、地图20公开房并重新Join，重开两页原面板。新房名、地图说明、180秒时限及隐藏密码锁匹配`m005`表和新快照，无旧房字符串。

证据写入 `recovery/output/browser-waiting-room-info.json`、`.log`及同名前缀PNG。脚本不注入房间或角色状态；结束时关闭专用服务、Vite和浏览器，并删除临时目录。

## 恢复边界

资料来源是重建服务端权威RoomState、当前模式地图原表和有效时限；本验收仅覆盖WAITING资料，不触发战斗、Ready或Restart。旧快照未携带可选`roomInfo`的明确占位由单元测试覆盖。
