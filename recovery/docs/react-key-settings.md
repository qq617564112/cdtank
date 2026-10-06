# React 键位设置

对应 `E-R04-S` 的键位设置部分。`apps/web/src/interface/settings/key-settings.tsx` 提供 `KeySettingsView` 和 `KeyBindingsHint`，页面控件与提示由同一 React 应用管理。现有浏览器键位编辑功能为 Web 重建规则，迁移不增加原客户端来源声明。

## 所有权与接线

`KeySettingsView({open, close, battle, initial, onSaved})` 在每次打开时建立独立会话，从 `battle.getKeyBindings()` 克隆当前已生效键位。`initial.loadMessage` 展示启动读取结果；成功保存后清除此提示，关闭重开不再显示已解决的读取问题。启动读取和应用保存值由已接入 main/App 的 `settings-startup.ts` 在界面可操作前完成。组件不读取存储来覆盖启动键位。

关闭后会话卸载，草稿、捕获目标和窗口捕获监听一并释放。原生 dialog 提供焦点限制与键盘导航，卸载时关闭 dialog 并恢复仍存在的打开前焦点。键位编辑期间的事件不能进入对局输入。

`KeyBindingsHint({bindings})` 直接从已生效绑定渲染 `#battle-key-hint`。`onSaved` 在成功保存并应用后通知 App 更新提示，不使用页面 DOM 查询。

## 编辑行为

保留主键、备用键、清除备用键和原选择器。选择新键时检查已有主/备用冲突，支持范围复用 `input-bindings.ts`。组合键、重复事件及不支持的特殊键不能修改草稿；中文组合输入不被捕获为键位。捕获期间 Esc 取消选择，非捕获 Esc 关闭页面。Tab 结束捕获，同时保留原生焦点导航。

恢复默认与清除备用键仅修改草稿。取消关闭页面并舍弃草稿。保存复用完整绑定校验，先写入 `KEY_BINDINGS_STORAGE_KEY`，写入成功后调用 `battle.setKeyBindings` 和 `onSaved`；写入失败保留现行对局键位及草稿，显示失败状态。

## 验收范围

本部分需联合 `E-R04-S` 主线验证真实鼠键修改、备用键与冲突、中文与键盘隔离、取消/默认草稿、保存后对局输入及刷新恢复、存储失败、关闭重开监听清理、1080p/4K 布局。组件实现及类型检查不能替代这些玩家操作验收。
