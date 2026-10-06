# M5-03-W 原等待房间玩家操作

正常房间进入WAITING后，“查看原等待房间”打开room_main.xml面板。十二个原玩家位置显示服务器名单、名字、战车图和已准备图；猫狗队伍选择、准备和取消均调用现有Battle.ready/Battle.changeTeam及正常TSRPC请求。无客户端预写准备成功、换队成功或开战。

源位置之外的成员保留在面板下方附加名单，避免当前服务器容量/队伍不平衡时隐去实际玩家。团队模式按当前权威team0/1各六位置，个人模式按快照顺序十二位置；**此分组是重建规则**。原消费者只读房间两组六位置数组，并不证明服务器数组和Web队伍排序等价。

## 接线与生命周期

WaitingRoom归interface/lobby，只管源控件、实时投影和请求确认；BattleMatch组装面板并共用其现有准备/换队回调与pending门禁。地图和战车资源资格仍由Battle.ready检查，服务器Ready/ChangeTeam仍负责真实权限和准备状态。源按钮pending/同队/已准备禁换队，Ready确认后切换为原Cancel图片。相同权威快照不替换控件，名单或准备变化时恢复同业务按钮焦点。

M5-03-X已更新关闭X：原btnClose经50c165→42704e发送3a9e离房请求，Web接显式Leave权威确认后清理并返回大厅；Escape仅收起本次浏览面板，是明确Web交互。外层“退出房间”共用确认业务，详见waiting-room-exit-runtime.md。PLAYING/FINISHED自动隐藏面板；清房/断线clear清理旧名单、状态与草稿，旧请求不能回填新房。这里没有新增原房主开始、踢人、邀请或CPU管理语义，继续使用已验收的普通CPU控制。

## 原来源边界

原room_main.xml十二PlayerPanel/picReady/picNA、猫狗按钮、Ready/Cancel及原矩形/固定图片已发布。原50ded9消费者按room+1c..30及+34..48读十二位置；原准备getter返回1才显示picReady，原局部缓存路径仍依原事件来源。Web准备读取match.readyPlayerIds，属于重建权威映射，不把它宣称原角色状态字段。

原50e14d/50e5cc使用role+2a8→定义+c经tanke0/data\\ui\\tanke\\%.3d.tga选择战车图，252原执行通过；上游定义/原网络构造未证。Web当前已恢复坦克catalog的tankId作为图片整数，明确为重建适配。21个整数均存在原32×32DDS图像地区73，不使用模型截图或新绘制图替代。原猫狗回调实参1/2不能直接称Webteam0/1，Web数值仍按现有协议。房间/地图名称、MapInfo说明、有效设置时长及锁图现由M5-03-I正式roomInfo资料接线，详见waiting-room-info-runtime.md；原存量、头像、称号、阶级的业务来源仍缺，不造数据；当前最小提示与“你”标记属于重建文本，不冒称原称号。

来源详见waiting-room-source.md及JSON；限定缺失入口保存后停止，不扩大完整房间协议探索。

## 验收

- `npm run test:rooms:waiting`：十二固定名单/准备/空位图、五种按钮图态、21种战车图、分组/个人/空名单及明确溢出显示规则、不修改输入。
- `npm run test:rooms:waiting:browser`：实际独立双网页普通建房/Join→原面板→准备/取消/换队/对端快照确认→普通全员准备开战→离房清理；原生键鼠/焦点与1080p4K固定矩形、实际源PNG显示。详细机器证据browser-waiting-room.json及waiting-room-browser.md。
- waiting-room-types.log、waiting-room-boundaries.log、waiting-room-build-web.log：新增生产模块类型、正式依赖隔离与Web发行。

未修改服务端战斗/账户持久、资源生产或CPU算法，CPU连续两局及账户重启使用既有有效基线；本片不代替M5-03/UI原房间完整业务或全量像素保真。
