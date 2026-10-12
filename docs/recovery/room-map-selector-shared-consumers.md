# 模式地图选择整页共用消费者

UI-48/UI-49，复用M5-02-MS真实ListMaps、五模式身份、八槽目录与确认草稿业务。原来源为selectgamemode.xml/selectgamemode_icon.xml与room-map-selector-source.json；不重新执行原图片生产者。

原SheetWindow在800×600基准中为(62,80)–(736,515)。picBackgroundMask相对根(-62,-80)–(738,519)，原gy遮罩覆盖800×599。hongsexiaodi与xiamianfenhongtiao包含左右框；youbiandaditu包含八片框与中心图。当前简化span只画Image，遗漏框；当前Web金框、padding及cap2缩放不是原根依据。

拟归属room-map-selector.tsx/css：使用SourceStaticImage恢复原静态根、遮罩与框；五模式/Close/翻页使用共享SourceButton。基准舞台800×600等比居中，源坐标保持；框采用SourceImageScale现有消费规则。选择卡片仍为正常键鼠button，真实map.name与106×86预览保持，选中outline明确Web反馈。txtPage继续消费实际八件分页状态。无元数据的推荐/活动/新图/节日标记不生成。

共享SourceButton suffix selectgamemode.xml仅type由主线提供；不改room-controls、room-map-options、网络、房间规则或App。confirm(mode,mapId):boolean保持，确认区是保留当前玩家能力的Web业务适配，原确认producer尚未证明。原MapID上游loader、完整原回调、字体与全1:1仍未完成。

验收仅本次相关整页800×600/1920×1080/3840×2160、原框/资源/文字/层级、真实ListMaps模式与卡片普通选中、取消/确认草稿、Close/Escape隔离与入口焦点。0创建RPC/Ready/BUY/对局；M5-02-MS旧普通CreateRoom→WAITING证据复用，不重复26目录与producer调查。

## 实际交付

room-map-selector.tsx/css原静态根、真实gy遮罩、12frame、模式/Close/分页共享按钮已稳定。网页外层金框/padding移除，800×600舞台完整居中，源SheetWindow仍674×435@(62,80)。资源提交后仅body/dialog才聚焦原Close，不覆盖玩家已选焦点；Escape先stopPropagation/preventDefault再关闭，原callback及草稿owner保持。

20-55-09首次raw PASS核800×600/1920×1080/3840×2160：23源控件、12frame、真实图片加载、根/遮罩/名单/确认区在视口；实际ListMaps团队7项逐一姓名与ID一致，页码1/1、两翻页Disabled。正常选择占领map2后源Close取消，再开仍团队map2；nativeEscape前btnClose在dialog，window键[]并严格回大厅Create。确认占领map2进入现正式建房田野路，关闭后再开地图选择保存占领map2。没有CreateRoom/Join/BUY/Ready/SelectRole或对局请求；旧完整建房事务基线复用。

最终1920整图与20-56-30定向raw PASS证明模式按钮透明、Normal/Hover/Pushed原图、Selected额外CheckMarkImage。resolutions=[]，无三res或完整草稿导航重放，只有最终1920PNG。三首图保留原几何/资源与业务证据；最终透明样式800/4K没有另拍，不把首图浅灰按钮当最终视觉。四张实际图均查看，原主要区域与中文地图名/确认文字可读。

交付索引room-map-selector-shared-consumers-accepted.json为主线已接受组合限定可用范围，保mainReview。UI48主要根/23controls已映射，UI49只恢复当前3个信息消费者，四徽章缺元数据不造；两原完整页面父不建议关闭。旧M5-02-MS已接受业务不重新勾选。工程为本次focused Webtypes exit0，最终CSS透明修正由主线下一必要batch统一发行，不独立全build。两个专属run的3415/5445/9645和临时数据库/浏览器目录均清理。
