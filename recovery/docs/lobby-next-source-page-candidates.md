# 大厅后续源页候选

来源索引 `lobby-next-source-page-candidates.json` 收录UI28 keyboard.xml的55控件与160处图片引用、UI64 tut_settings.xml的4控件与9处引用、UI43 playerlist_QQ_number.xml的3控件与9处引用。图片引用均能解析至当前正式源PNG。该索引仅说明原布局/资源可用，未构成生产消费者或运行验收。

keyboard.xml原根(401,86)–(793,224)，是包含数字/字母/标点及shift/caps的屏幕键盘，不能据其文件名当作高级15键配置页。原打开入口、附着、插入字符回调与候选处理仍需确定；不得在大厅随意增新按钮或借其映射修改现持久KeySettings。

tut_settings.xml原根800×57，原btnTutorial、btnSettings、btnClose有三state资源。教程内容/原Close路由及原挂载入口未建立，现系统设置业务仍由已接受Home入口提供，不凭这三个图片重新定义游戏退出或教程。

playerlist_QQ_number.xml原151×59小页，txtQQnumber缺真实玩家QQ数据producer。当前目录只有权威accountId/name，不能拿它们填QQ号码，也不新增账户字段。

当前优先的大厅历史纵栏与商城名单纵栏已生产稳定，实际等待主线性能lane与统一工程检查。此候选来源不修改生产或协议，不关闭UI28/UI43/UI64父项。
