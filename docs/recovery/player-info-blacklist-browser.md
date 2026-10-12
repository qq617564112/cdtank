# 玩家资料屏蔽状态浏览器验收

`tests/browser-player-info-blacklist.mjs`通过6项真实正式页面检查，证据`browser-player-info-blacklist-2026-10-04T07-51-30-745Z.json`。同前缀`-blocked-800/-blocked-1920/-blocked-3840.png`与`-unblocked-3840.png`四张完整实际图片均已查看。根布局来源与旧完整父框验收复用R-PAGE。

两个普通网页认证账户进入正式目录，选择真实另一玩家、右键打开源资料页。点击原屏蔽按钮发送`Blacklist ADD`，目标为当前资料accountId；确认后切换btnRemoveBlacklist原“允许”图并保持该动作焦点。800×600/1080p/4K新增屏蔽状态均按缩放1/1.8/3.6显示同源81×42按钮，未知资料保持原空白。800/1080p图片可见“已屏蔽”确认提示；权威查询刷新后不保留旧确认提示。

可信Enter触发`Blacklist REMOVE`，确认后同位置恢复btnAddBlacklist，按钮矩形完全一致、焦点为该屏蔽动作，4K实际图显示键盘焦点轮廓；没有移到好友按钮。原Close回正在查看的真实玩家目录行焦点。实际网络解码确认ADD/REMOVE均为同目标accountId。

专用server3328、Vite5352、Chromium9552与临时数据库/浏览器目录全部清理。Web类型检查通过。好友流程/账户重启/聊天阻挡业务由对应已存在或本轮业务专项验收，本UI一轮不重复。

## 限制

统计、QQ、交易及其余原资料未知字段与字体/GPU精度继续保持父项。未据UI资源宣称原服务器黑名单过滤语义；当前账户关系和阻挡业务来源见对应业务文档。
