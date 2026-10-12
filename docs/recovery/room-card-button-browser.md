# 房间卡片原捕获按钮验收（M5-02-C-BUTTON）

`browser-room-card-button-accepted.json` 汇总6个已完成检查范围与建房共享按钮的3个完成状态样本，最终16张实际 PNG。索引逐条指定 raw文件、有效 checkIndices 与作用范围；raw FAIL 保持原状态，未完成检查不采纳。原消费者来源为 `room-card-button-native.json`：8个完整 custom image/alpha 向量和5个 captured-state 向量 PASS。

800×600、1920×1080、3840×2160逐正式 RoomCards 卡片验证 Normal/Hover/Pushed 图层对应原资产、alpha1、pointer-events:none、传入卡片 class、四个原 StaticText 子控件继续显示。普通鼠标移入、内部按下、捕获拖出、外部释放、拖回后内部释放均实际运行；拖出保持 pushed=true 且原 Hover 图，外部释放保留R7，内部释放选择R6。永久目录选房身份仍为 aria-pressed=true，指针移出回原 Normal，不据未知 selected 生产者固定 Pushed。满员禁卡零 custom image draw且不能改变选择。

可信 touchStart/touchCancel 实际产生 isTrusted pointercancel 并清捕获，无选房。普通 Tab/Space 选择R7，焦点留在R7；普通 focused Enter 选择R6并保留焦点。原尺寸数字「1」的 mono alpha 与实际截图对照保持每样本12个源白色像素、32个原透明背景样本；相关有限字形消费者沿上片来源。原未知字仍是 SIMSUN Web fallback，原OS/GPU像素等价未声明。

共享回归限定默认分支：普通展开建房 details，打开原窗口，Cancel 的 Hover/Pushed/外部释放 Normal 图态正确且窗口保持；普通卡片 Join 进入同R7与权威 playerId 的 WAITING。等待源 Ready 控件完成加载后，Hover/Pushed/外部释放 Normal 正确且未 Ready，正常 Leave 清 world。没有重新执行整套建房/准备业务、五模式或账户回归；既有错密码/草稿保持闭环复用 `browser-room-card-text-accepted.json`。

## 禁卡实际合成

`browser-room-card-button-2026-10-04T02-00-45-123Z.json` PASS补片直接观察满员与普通两客户端 Ready 后的 PLAYING 禁卡。原 DisabledImage 缺失对应零 image层；卡片背景透明，独立模式、队伍、名称、人数和 PLAYING 子图保留。实际 child-free 点(455,305)在两张截图均为当前父面板 RGB(38,59,73)，证明没有 UA 替代灰板；两数字同时分别通过12个源白/32个源透明样本。原完整 Windows 父背景未取得，不把当前 Web 面板颜色称为原背景。

旧禁卡 PNG 保留在索引 historicalDisabledScreenshots，最终图列表使用上述透明底色补片。原文字 glyph/源属性、非禁用捕获状态及普通操作证据继续有效。3310/5331/9531 与各临时目录全部清理；共享Web工程由主agent统一检查。永久选中图态、完整原目录回调、原全屏缩放、外框和工具栏仍留 M5-02 父项。

主线集成最终：scene052-card-button-web-build.log Web类型与正式构建1m23s PASS，scene052-card-button-boundaries.log316运行模块边界PASS；两个限定切片共享同一工程证据。root独立saved业务与实际PNG核验见scene-effect20-052-root-review.json/room-card-button-root-review.json及scene-effect20-052-round-root-verifier.log。无账户/服务规则变更，不复跑五模式、账户重启或serverbuild。
