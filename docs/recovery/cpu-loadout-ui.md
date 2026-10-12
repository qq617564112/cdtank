# CPU道具配置

M1-11-L的CpuLoadoutView是Web重建CPU训练控件，在正式WAITING管理区按CPU展开。原CPU配给界面与回调来源未取得；该组件不代表原等待房间控件或完整1:1恢复。

组件接收PlayerSnapshot、busy和configure(loadout)异步回调。槽2–4选择燃烧弹2007或问候炮弹2011，槽5–8选择已交付道具1–8，每槽可空；名称和数量上限来自combat-catalog.json，数量必须为1至原battleUseMax的整数。目录范围沿共享CPU_LOADOUT_ITEM_IDS。目录加载在卸载时abort，迟回复不更新组件。

表单草稿与权威余量分开：余量只读取player.cpuLoadout快照，确认请求不乐观改量；拒绝与折叠保留草稿。pending同步阻止重复提交，忙碌时禁止修改；CPU身份变化创建独立草稿，卸载隔离请求迟回复。原生select/number用于这项重建管理功能，键盘事件在组件内停止冒泡。

选择器为data-cpu-loadout=CPU身份、data-cpu-loadout-slot、data-cpu-loadout-item、data-cpu-loadout-quantity、data-cpu-loadout-save、data-cpu-loadout-confirmed和data-cpu-loadout-status。正式入口接线与首次普通鼠键业务验收由主线完成，不重复等待房间三分辨率或字体取证。

组件strict TypeScript小片检查通过，使用ES2022、Bundler模块解析与react-jsx；检查范围包含组件及其共享协议/目录类型。正式鼠键配置和权威快照余量尚待首次业务页面证据，不据类型检查声明业务已验收。
