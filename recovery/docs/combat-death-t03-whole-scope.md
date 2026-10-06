# 战车003普通死亡与复活消费端

M3-04／M4-09原来源复用combat-death-t03-source.json：四09 duration5601，M定时time160／identifier1416378268，原003.elk无09组；四01 duration3201。已有13502自然生命实际只证明对应队列停止／复活，不证明战车003四部件时钟及原死亡消息消费者。

拟使用真实BUY3／pet2检查点、双普通玩家mode4／map7、正常2001输入自然击毁，观察四09实际绘制／动作时钟／M消息，09无ELK新增效果或树声音，随后自然复活01及正常SourceClose。角色数值、事件、姿态、相机和时基不修改，旧三人CPU加载FAIL原因不由新双人成功替代。

原09 duration5601与尾5501使用动作刻度。既有原gbActor时钟按每秒4800刻度推进，5501尾约1.146秒，因此当前正式3秒自然复活期间可以到达原尾帧。原事件time160也是刻度，约0.033秒；实际派发时刻依渲染帧越过门槛，不应承诺首帧恰160。

主线已确认本片独立验收归属；tests/browser-combat-death-t03-whole.mjs使用3502／5532／9732，只读记录真实clockSamples／消息／原动作资产／完整死亡与复活帧。首actual06-00-58-109Z保存FAIL：正常自然死亡与复活已成立，双四09初draw481、尾5501/over0与每部件9／8尾帧成立，原M160消息在481派发且09不新增实例或树声音。死亡完整图已独立从原raw保存；首次lastRevive图对应worldalivefalse的异步01过渡，不能证明复活像素。正常Leave因早段仪器断言未执行，保持未验。FX仅拥有新的独立browser／doc／output；旧source及数值线验收文件不修改。


唯一仪器定向补段 `browser-combat-death-t03-whole-2026-10-05T06-05-19-853Z.json` 保留FAIL，双destroy／respawn事件一致；双四09实际draw及5501／over0尾成立，M160消息在首本机460／观察端975刻度派发，09无新ELK实例或树声音。本机真实复活worldalive700／deaths1／respawn事件后四01同frame213 draw／clock763，640完整复活图已保存；观察端life记录alive700／action01但无01 actualdraw及capture，原因未证，不作远端像素或复活四几何PASS。

补段五原完整图从原raw导出同stem `-preserved-1-lastDraw/lastTail/lastRevive.png` 与 `-preserved-2-lastDraw/lastTail.png`：双死亡部件分离、尾帧塌落可辨。本机复活车体可见，炮塔黑色面细节保持精度未验。正常Leave被综合观察门禁阻止，不能用finally进程清理替代；两raw皆原样FAIL。process端口全空／tempRemoved与Chrome退出有效，停止第三同入口。

组合范围索引 `combat-death-t03-whole-actual.json` 保原时钟4800刻度／秒与首单位误判释义、有效draw／消息／画面及远端01／normalLeave缺口。本片无生产修复，不关闭全车型动作父项。
