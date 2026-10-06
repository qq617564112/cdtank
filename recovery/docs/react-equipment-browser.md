# React 部件装备浏览器验收

E-R02-E 真实浏览器专项通过。`node tests/browser-react-equipment.mjs` 自启动专属 Chromium、3134 服务端和 5193 Web，使用独立数据库、账号与浏览器 profile。最终运行21秒，完成原部件／装饰／标记操作、1080p／4K布局、请求隔离、预览生命周期、真实服务重启和普通入房／退出。

最终证据：

- `recovery/output/react-equipment-2026-10-03T15-21-44-375Z-summary.json`
- `recovery/output/react-equipment-2026-10-03T15-21-44-375Z.json`
- 同前缀 `.log`、`-server.log`、`-chrome.log`
- 同前缀 `-1920.png`、`-3840.png`

## 已验收行为

单个 React root 和 `interface/home/home-equipment.tsx` JSX dialog 边界通过源码检查。Babylon 从正式 `render/scene-runtime.ts` 模块发现；鼠标和键盘均通过普通 CDP 输入事件操作。选择库存行或页签后，等待 `aria-pressed` 的 React commit，再点击槽位；滚动、帧提交和真实命中检查确保鼠标点击可见控件。

显式所有权来源为 `role-owned-pair-native.json` 的首条原角色记录。夹具选择宠物实例71、战车实例72，战车表ID2，拥有容量3，原纹理U／M／XY为20011／20012／20013。库存实例81–86分别对应13001、13002、14001、10001、10002、12001，数量均为1。普通部件页、装饰页和标记页使用原物品图与数量；容量外槽3／4禁用。

鼠标装备、跨槽移动、Delete卸下、同类冲突拒绝、装饰替换、装饰／标记类别拒绝和已失去所有权拒绝均通过真实服务器与数据库断言。拒绝保留已确认槽值。刷新及实际停止／重启服务端后，原账户token、普通槽实例83、装饰实例85、标记实例86及数据库装备state2保持。另一个浏览器上下文的账号没有角色资料和库存，无法访问首个账号的装备。

1920×1080和3840×2160弹窗完整位于屏幕内，全部23个原XML控件标识和坐标匹配 `myhome_panzerpage.xml`。引用原图全部成功解码。预览显示原战车实例72、表ID2和5个有效网格；模型窗口分别约392.4和784.8 CSS像素，canvas分别为392×392和785×785。普通窗口缩放读取当前React提交后的尺寸，同一个Babylon engine完成像素尺寸更新。

模型帧计数持续增加。只读引用证明选择物品、切换页签和保存部件期间预览DOM、engine、scene保持同一实例。Escape关闭后焦点返回普通装备入口，预览DOM移除，engine与scene均disposed，关闭后的帧计数停止。重新打开只创建一个新预览engine，最终关闭清理该engine和scene。

真实服务进程SIGSTOP暂停请求处理时，保存状态可见，槽位保留已确认值，控件禁用。重复点击只发送一条WebSocket请求。关闭并立即重开后，SIGCONT恢复处理，新窗口使用新查询读取已保存装备，旧mutation不覆盖新窗口状态或选择；重复点击的第二目标槽保持空。随后普通Delete卸下，恢复原确认配置。

最终数据库profile的五部件槽为 `[0,83,0,0,0]`。普通页面建房进入WAITING后，真实RoomSnapshot显示战车表ID2与选中拥有战车的原纹理20011／20012／20013。入房完成后的React控件提交满足返回按钮可见、普通大厅控件隐藏及创建请求结束，再通过普通返回按钮离房。

专属3134、5193、9364端口最终无监听；临时数据库和Chrome profile已清理，验收证据和日志保留。

## 复用证据与限制

实际部件表映射、204个部件定义分类、原被动技能与World绑定由 `tests/account-battle-part-definitions.cts` 及主线程 `recovery/output/react-equipment-battle-binding.log` 覆盖。当前RoomSnapshot没有部件来源或属性字段投影，浏览器本片验证profile保存和真实入房的拥有战车来源，不将纹理投影视作战斗部件绑定证据。

E-R01的 `recovery/docs/react-match-browser.md` 已覆盖两个自然局、双页面原Effect11／GA15和资源清理，本片复用这些结论。入房的战斗渲染内部降采样为3，1080p／4K断言针对原装备界面和独立模型预览。WAITING时真实HUD显示HP308／maxHp204；角色HP与已绑定maxHp的生命周期仍归后续M2属性工作，本片不扩张服务器战斗保真结论。
