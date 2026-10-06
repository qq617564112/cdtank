# 原建房窗口业务边界（M5-02-CR）

正式入口为大厅“原建房窗口”。`interface/lobby/room-create-dialog`只管理原布局与独立草稿；`room-create-draft`校验已选择地图的有效人数范围；`room-controls`把确认接到既有 `Battle.createRoom`。窗口不直接写服务器或账户。

玩家可编辑房名、遮蔽密码、开局人数、房间容量和团队友伤；OK只发普通CreateRoom，成功进入权威WAITING，失败保留草稿并恢复最近输入字段焦点。取消、关闭和Escape不回写外层表单。提交中禁用控制与取消，避免重复创建。成功后外层配置反映确认结果并清除密码。

原矩形与静态图来自`ui/layouts/createroom.xml`，使用现有HomeSourceLayout解析资源。显示舞台裁切后保留原相对矩形，窗口按视口缩放。模式与地图沿用已完成M5-02-MS选择结果，团队/个人标记只读；尚未取得CatVsDog独立配置与完整原建房回调依据，不新增切换语义。

服务器资格、密码格式、人数容量及幂等创建沿用现有重建房间模块；这属于Web重建接线，不宣称原网络回调复原。该片不改变战斗、CPU、账户持久与资源加载；既有相关基线继续有效。

验收命令：`node --import tsx tests/browser-room-create-dialog.mjs`、`npx tsc --noEmit`、`npm run test:architecture`、`npm run build --prefix apps/server`、`npm run build --prefix apps/web`。浏览器详细证据见room-create-dialog-browser.md及browser-room-create-dialog.json。
