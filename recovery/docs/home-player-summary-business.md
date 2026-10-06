# Home玩家数字只读接口

M5-08。Home的积分、原创力、技术来自同账户已保存RoleProfile的368字节资料。原MyPlayer更新4e333b调用真实getter并按signed int32 `%d`显示；payload偏移分别5c、9c、a0，来源home-player-profile-numeric-native.json包含18真实原getter执行结果。

服务端profile/player-summary.ts只读三字段，RoleProfile API在资料存在时返回可选playerSummary；无资料时省略，不造零值或从History推导。协议保留既有profile.bytes/strings，UI消费命名字段进入三个原StaticText。账户写入与收益规则不变。

home-player-summary-api.json验证18原getter值、signed边界、同账户/无资料/未登录分支、368bytes读取不变及生成协议往返。明确临时库source-value显示fixture并非earned值。browser-home-player-profile-numbers-2026-10-05T08-17-28-601Z.json首次正常1920页面通过：真实已保存三0、fresh缺profile空白及明确临时DB正式import源值17/123456789/-1均可读；原其它368bytes与strings不变，sourceClose严格回Homeopener、同token重开、无业务写。root亲三完整1920图有限接受home-player-profile-numbers-root-review.json。

## 未完成范围

积分、原创力和技术的赚取与更新权威政策、原服务端初值、其他尚无getter字段、完整Home与HD父范围仍开放。
