# 正式交易主页面消费者

TradeSourcePage按state、pending、status、act和close消费主线稳定合同。自身身份来自state.account.accountId，双party保inviter/invitee顺序；peer显示只读正式session及party.records。主页面沿原trade.xml的框架、四页签、候选区域、双方各12提供物格、姓名与状态、钱/创意点/技能点、展示/交易/取消/关闭控件。

本地金额和记录数量只作为draft；仅session.id或确认own.offer内容变化时重置，普通QUERY返回新对象不覆盖编辑。原展示按钮校验金额整数后携带draft offer和expectedRevision发送SHOW，由主线原子更新与展示。已展示且无draft变化时切UNSHOW，双方shown后本人可CONFIRM；显示与确认标记只取服务端。任何提供物调整后的shown/confirmed状态以新revision结果为准。两端格子的数量读取确认ref.quantity，不用本地持有量替代peer提供量。

专属详情复用trade_partdesc.xml、trade_petdesc.xml、trade_tankdesc.xml。显示已资格同记录name、Pet属性和实际技能rank、Tank四项确认攻防属性/剩余分钟天数、CommonPart类别/天数与原表介绍。缺字段保持空白。原布局内部坐标及DDS优先图集映射复用；根弹层居中与独立status区为Web装配，未冒原attachment资格。当前确认字段、原表说明及键盘滚动范围见`trade-detail-fields-implementation.md`。

生产文件包括：trade-source-page.tsx、trade-source-page.css、trade-source-detail.tsx，以及SourceButton仅新增四个Trade suffix字面量。未更改共享按钮行为、账户或协议，未独立运行type/build。正式统一工程见 `recovery/output/trade-engineering.json`。

浏览器有限实证见 `recovery/output/trade-source-page-browser-accepted.json`，最终主审回链 `recovery/output/trade-root-review.json`（`PASS_FINITE_BILATERAL_TRADE_INVITE_SHOW_TRANSFER_DUAL_SOURCE_RESTART_PAGE_CLOSE_SCOPE`），首轮主页审阅保留 `recovery/output/trade-browser-first-root-review.json`。双端普通邀请、拒绝/接受、轮询保留编辑、SHOW/UNSHOW、对方隐藏后详情关闭、部分堆叠物品与完整Pet提供物、双确认结算及三分辨率完整主页已实际覆盖。确认钱包为本方94060钱/48创意/210技能点、对方86350钱/27创意/90技能点，Item1持有量为5/2。

持久化尾段从已提交checkpoint与原身份启动编译服务，完整QUERY、原profile、owned记录全部字段与inventory一致。普通新零提供物会话完成双SHOW/CONFIRM后完整账户不变，双端严格Close通过；这是新会话，不恢复已结束会话。尾段未注入余额/记录、未BUY、未重做原提供物交易、未新增截图。session83297实际退出0，Chrome、server、Vite及临时目录清理完成，3608/5638/9838端口空。

## 尚存范围

对方三项金额保持白字与shared `SourceStaticText`/用户选字体，仅在原浅条带范围内加scoped深色backing（无shadow），不改全局字体、不改黑字、不用`!important`，原65×13右对齐与图片几何不动，不声明原最终颜色；详情与主页面使用同一viewport scale，Web关闭控件位于原底框之外，二者当前实现成立但同scale/关闭位置仍待新实测，当前生产范围见`trade-ui-readability.md`。新详情字段与说明没有浏览器验收证据，完整原参数、attachment/callback和逐控件1:1仍未完成。测试预置创意/技能点不证明正常取得来源。
