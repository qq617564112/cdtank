# 账户昵称玩家闭环

M6-05-N完成正式大厅中文昵称确认、权威身份同步和真实重启恢复。昵称编辑归React；唯一认证运输归GameConnection/AccountConnection；独立账户表归AccountDisplayName；房间加入、创建、快速匹配和大厅聊天、在线名单读取服务端确认名。请求中的旧名字不产生权威身份。

原角色姓名字段及改名费用没有恢复。独立表、1–16 Unicode码点、禁止控制字符、同账户任何连接在房拒绝改名、允许同名均为重建规则。账户ID仍是身份，不覆盖原资料两字符串或368bytes。

`npx tsx tests/browser-display-name.mjs`实际双网页PASS，证据browser-display-name-lifecycle.json/log。普通中文输入/确认、组合输入Enter不发送、空名拒绝保留草稿、普通Enter成功、双端名单与聊天、普通建房到自动等待及源Leave、网页刷新与真实服务关启后两账户恢复通过。截图browser-display-name-waiting.png、browser-display-name-restored.png。

`npx tsx tests/display-name-network.cts`实际3201网络与重启PASS，证据display-name-network.json/log。边界、同账户多连接在房拒绝、房间请求冒名覆盖、账户隔离和原资料/库存/余额保持见display-name-server.md。相关类型、正式依赖门禁及两端发行集成结果引用tasklist对应本轮证据。未改战斗运动、消费或结算，既有CPU连续两局与首件道具证据复用。
