# 玩家资料屏蔽状态

正式`playerlist_playerinfo.xml`的btnAddBlacklist与btnRemoveBlacklist共用根坐标81,194–162,236。Add原lobby_anniu0/pingbi正常2、悬停1、按下3、禁用4；Remove原yunxu正常2、悬停1、按下3，没有禁用图。共享SourceButton继续消费原ButtonBase hover/pushed/capture和空DisabledImage，不另造灰化图态。

PlayerInfoPlayer新增权威isBlocked，界面在同位置渲染对应源按钮；pending统一禁用好友和屏蔽关系操作。onAddBlacklist/onRemoveBlacklist由root接账户业务。焦点请求记录操作种类friend或blacklist，确认后在对应源位置恢复，而不把屏蔽操作焦点移到好友按钮。Close仍回原玩家行。

完整根35控件、图框/遮罩/字体有限消费来源沿player-info-page-source.md；本项不重新恢复父框。已显示姓名/连接状态沿当前账户，其他资料保持空白。

## 限制

原屏蔽确认/服务器关系权限与过滤语义由业务源/运行文档界定；UI只消费账户确认，不据按钮资源声称原聊天规则。统计子页附着、QQ、交易、邀请、完整资料字段和原WindowsGPU/字体精度仍保持父项。
