# React 战斗 HUD

对应 `E-R05-H`。`battle-hud.ts` 保留 Battle 使用的 `load/event/update/clear` 合同，改为无 DOM 语义控制器。`battle-hud-view.tsx` 用 JSX 管理全部源控件、进度条、BigHT 位图字图和红色 SVG 颜色过滤器；源 800×600 舞台统一缩放，进入、退出和 resize 由 React 生命周期管理。

## 投影边界

`getSnapshot/subscribe` 仅在可见投影变化时发布：玩家名字、生命、头像表达式与资产、计时字图与颜色、模式、团队存量和五条战斗消息。位置、tick、分数等不使用的字段不触发 HUD 更新。`getReloadSnapshot/subscribeReload` 单独通知装填子树，使逐帧装填进度不重绘整个 HUD 或 App。

本机头像保持原团队 slot0 交换顺序；其他玩家保留原远端静态头像。表达式、死亡/复活、低生命状态和事件优先级继续使用 `PortraitState`；装填 continue 使用 `ReloadProgress` 的原 float32 计时规则，阶段、死亡和 round 切换重置。团队面板继续使用现有服务端权威存量重建映射。

计时器保留原 `<30` 的红白交替和 `>=30` 不写颜色规则；`clear` 清除颜色过滤、团队字图状态和日志，重置上一更新时间、头像记录与装填轮次。原布局层级、选择器、字图尺寸、生命颜色插值和掩膜保持现有表现。

## 资源和清理

载入 UI 使用 AbortController 与载入代际。`clear` 取消未完成载入，迟到响应不发布资源；已完成的源资源复用于下一次进入。React 管理舞台和控件 DOM，无旧节点注册路径。resize 监听随 view 卸载释放，控制器不注册窗口事件。

## 验收

`tests/react-hud-store.cts` 使用现存源 UI 资源检查语义快照、不可见字段不通知、slot 交换、生命/死亡/复活、原头像事件、装填独立通知、计时颜色保留、五条消息、clear 及迟到资源隔离。`tests/portrait-state.cts` 校验原肖像规则。真实源字图与几何、普通开火进度、CPU 对局生命/复活和高清显示由本项浏览器验收提供；控制器测试不能替代实际页面绘制与操作。

`tests/browser-hud.mjs` 保留原来源几何、字图、计时颜色、12 人 roster 与全部肖像状态断言及截图，改用独立 React fixture root 渲染 `BattleHudView`。该专项明确供给权威状态与头像时间，不使用正式 App 对局 store，不作为真实联机实战证据；每次状态供给和 resize 等待 React 提交后读取页面，结束卸载 fixture root。本次维护仅执行 `node --check tests/browser-hud.mjs`，运行级结果由后续此专项执行记录确认。
