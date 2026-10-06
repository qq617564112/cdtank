# M5-02-S 房间排序与选择

原roomlist.xml具有btnSortByID及btnSortByEmpty，两者处于同一矩形。它们证明原界面存在编号/空房间排序操作；本片使用正常网页选择器接通功能，不宣称原按钮回调、原卡片分页布局或完整房间界面恢复。

客户端interface/lobby/room-directory集中目录比较与可加入选择。编号按R后安全整数自然升序，R2在R10前；非标准ID在标准数字编号之后按固定字符串顺序，不依赖机器locale。空房间优先先排当前可加入（不是PLAYING且有空位），再按剩余位降序、人数升序、编号升序。此比较和刷新选择保留策略为明确重建规则，不伪造原回调来源。

切换排序或刷新目录保留当前仍合法的选择；如果选中房间变满或正在战斗，回退至首个可加入房；无可加入房时清选择并禁Join。密码房仍可选择，密码校验留真实服务器；错误密码保留输入/选择/排序，改正后经普通Join进入WAITING。目录状态只保存于当前页面，不新增本地持久设置。加入期间排序/刷新不得解除加入门禁。

验收失败假设：字符串排序把R10放R2前；按人数而非实际空位比较；排序或刷新丢合法选择；满员后仍启用Join；排序在pending时允许并发加入；密码失败清掉输入；源码新模块没有进入正式发行。专项覆盖比较/不变原数组/门禁/选择回退；真实浏览器使用正常创建与加入API提供多人目录，实际鼠键验证排序、刷新、满员、失败与成功和1080p4K。没有修改服务器/战斗/账户保存，不扩大CPU两局或重启回归。

结果：room-directory-rules.log纯专项PASS；browser-room-directory.json六组正常服务器与页面检查PASS，含R6–R10真实不同容量/人数与满员、R10密码拒绝ROOM_JOIN_REJECTED且保留草稿、正确Join玩家身份/WAITING，1080p4K截图。room-directory-types.log最终全仓类型PASS；room-directory-boundaries.log 260正式模块边界PASS；room-directory-build-web.log正式独立Web发行1m32s PASS，既有大chunk提示保留。专用3184/5221/9291及临时profile/数据库清理。命令test:rooms:directory及:browser；网页详情见room-directory-browser.md。空目录与全不可加入只由专项覆盖，不冒称正常服务器空目录。
