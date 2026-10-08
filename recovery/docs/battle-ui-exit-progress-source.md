# 战场退出确认与结算经验条

战场退出按钮先通过 Leave.quoteOnly 取得服务端处罚报价，再显示 `confirm_dialog.xml`；计数不超过7时使用 gamestring829「你真的要从战场中退出吗？」，超过7时使用 gamestring593并显示实际可扣积分。确认金额后才发送 `Leave` 请求并实际扣分；取消或 Escape 关闭确认框并恢复退出按钮焦点。请求期间禁用重复确认与取消，失败保留确认框及服务端错误，成功沿当前离房流程清理。离开 PLAYING 时卸载对话框，换局不会显示上一局确认。

结算 `prgExp` 与生命、装填、弹匣条共用 `resources/source-progress.tsx`。原背景及进度图片按 imageset 的 AutoScaled/NativeHorzRes/NativeVertRes 缩放并取整后平铺，物理裁切长度为 `floor(f32(length × scale) × fraction + 0.5)`。水平从左向右、竖直从下向上裁切，颜色沿原三段阈值。结算不再把进度图拉伸后按 CSS 百分比裁切。

## 原来源

| 范围 | 直接读取的来源 |
| --- | --- |
| 战场退出分支 | `0x4cf8af–0x4cf9dc`：读取当前阶段对象的 virtual +0x18 getter selector0x15，选 gamestring593 或829，构造确认回调 `0x4ce1dd` 后调用 `0x4d8238` 打开原确认框。 |
| 确认后的退出 | `0x4ce1dd–0x4ce21d` 清理当前战斗状态并进入既有离场动作。 |
| 经验控件 | `game_summary.xml/prgExp` 原矩形718×17，背景 `jindutiaoditu.tga`、进度 `jindutiao.tga`；优先 DDS imageset 发布切片59/13、59/14。 |
| 进度绘制 | 复用 `life-draw-source.md`、`reload-draw-source.md` 中原 `WLProgressBar::drawSelf 0x1001bff0–0x1001c50c` 的取整、平铺和裁切合同及已有证据。 |
| 动态字体 | `attachment-font.md`：普通文字、计数和 HUD 使用香蕉字体，伤害/治疗/暴击继续使用原数字图片。本消费者保留现有动态字体。 |

## 结算奖励通信链

`UMsgFtGameOver` 的 PE 名称位于 `0x5c4b3c`，注册 descriptor 为 `0x6354f8`。`0x437733–0x437795` 将它绑定到 `0x436678`；该处理器依次调用 `0x436233`、`0x42721f`、`0x488693`、`0x43cd7e`。`0x42721f–0x4272d4` 遍历场上对象做结束处理并转交观察者，没有选择奖励定义或计算发放概率。

原结果消费者 `0x4ac736` 从消息 `+e0` 取得道具记录集合、`+e4` 取得坦克记录集合、`+ec/+f0` 取得新称号队列。`0x4aa7ab` 按道具记录 `+0x0c` 查 ItemTableID，`0x4aa998` 按坦克记录 `+0x24` 取型号与实例名称；gamestring140 显示实际获得记录。两类装备是服务器已经发放的拥有记录，不能由获胜或奖章数量自行生成。

原五模式表提供玩法和计分列，DataScale31–42提供金钱/星币/技能点/创意点的结果倍率；它们均未提供额外道具/坦克发放条件。Item.GGet 是获取显示字段，Tankshop赠品列属于购买记录，DropItem 为地面模型及金额区间，不能替代战斗装备奖励规则。

## 未完成范围

原处罚提示593在 getter 的 selector0x15 值大于7时使用，并显示该值乘100。它调用 virtual `+0x18`，与击毁/破坏统计使用的 `+0x14` 不同；`0x4269c4` 还随当前阶段选择不同对象。联网角色 getter `0x422b64` 对 selector0x15读取`role+0x314`，该字段在`0x424807`的非类型2场景对象事件中递增；其完整业务名及服务端扣分事务仍未取得，见`battle-ui-remaining-source.md`。当前退出已接权威报价、原593/829正文和账户积分扣减；采用成功场景破坏事件计数、原门槛>7与×100倍率，按余额扣至0并同步等级。金额变化要求重新确认，详见battle-equipment-exit-melee-rules.md。

额外道具/坦克奖励实际发放和乱斗 CatsInfo/DogsInfo 生产已按battle-equipment-exit-melee-rules.md的项目规则实现；其原服务端规则仍未取得。GM人工回复与家族路由未实现。新的退出交互与结算条高清视觉尚未实测；仅进行一次集中静态代码走查，未运行测试、浏览器、构建、类型检查或生成器。M5-04/M5-05/M5-06 父项保持未完成。
