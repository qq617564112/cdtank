# React对局首片所有权

唯一React根在main.ts，App承载大厅和BattleMatchView。大厅基础表单、原卡片/建房/地图/招募窗口、原等待名单/按钮与对局目标/CPU托管/结算再战均为React JSX。对应旧room-controls、room-cards、room-create-dialog、room-map-selector、room-invitations、waiting-room、battle-match DOM实现已删除，保留纯资源/规则消费者和CSS。

GameConnection仍拥有唯一TSRPC连接及账户token，账户与房间接口共用认证；RoomFeed拥有权威快照和有序事件，Battle负责输入、地图/角色/弹丸/特效与声音。React组件不计算伤害或预写准备、换队、结算成功。LobbyView拥有目录分页/草稿/密码/pending/当前页面；BattleMatch无DOM创建，只发布界面语义投影，由其View useSyncExternalStore独立订阅。世界tick/弹丸/逐帧位置不发布到根；目标方向每server秒更新，对应必要目标/boost/结果变化才触发对局组件。

Babylon独立scene-runtime负责Engine、Scene、camera、灯光、resize与renderLoop。进入/退出/再战仍复用Battle的session门禁、RoomFeed、技能清理与来源库存。React等待组件按roomId/round区分生命周期，未完成请求不会回填新房；邀请订阅明确unsubscribe。页面终端pagehide先Battle.leave，再React卸载和Scene/Engine销毁。常规离房不销毁应用或场景，重进继续复用同一账户会话。特效终端释放专线以Scene.dispose作为永久清理边界，区别于常规stop。

E-R01交付时HUD/聊天/我的家/库存/商城/设置与通用notice保持既有实现及入口，列入后续迁移；本片不称全UI已React。battle-status是独立外部渲染诊断/无障碍输出，React只挂载固定host，界面不订阅每帧JSON。保持源资源名/控件selectors/布局CSS使既有真实验收可直接检查替换后的组件。

验收以tasklist E-R01为准：源窗口/等待相关真实鼠键资源和高清，统一双网页自然CPU两局、普通道具/效果声音、结算冻结/再战/余量保存服务重启恢复；组件或store检查只锁订阅与过期请求边界，不替代真实流程。取证与服务端基线无修改则复用，避免逐模块重复跨系统套件。

原生dialog顶层与React卸载边界：取消/Escape由React受控close入口处理，卸载前同步调用dialog.close及恢复打开按钮焦点；不用异步旧onClose回调修改新窗口状态，也不在后续RAF抢回已转移焦点。真实快捷取消后重开/模式键盘选择纳入原网页验收。

统一命令：`npm run test:ui:react:store`检验语义订阅；`npm run test:ui:react:browser -- --ui-only`、`--healing-only`或`--disconnect-only`按改动范围选择真实业务子集。完整入口无选项时串行覆盖全部；已通过证据按tasklist复用，不因目录或文档修改复跑。

E-R02-I集成：App拥有inventoryOpen与普通#open-home JSX入口，HomeInventoryView拥有每次打开的请求/选中/确认槽/pending；关闭卸载session使旧请求不回填新窗口。账户transport与库存、资格、CAS数量权威仍复用Battle和服务端；registerAccountControls不再实例化HomeInventory或注册库存点击监听。其他我的家页面按后续片迁移。

E-R02-E集成：App拥有equipmentOpen和普通#open-equipment JSX入口；HomeEquipmentView session拥有候选/分类/pending/服务确认profile。HomeEquipmentPreview只按tankId/实例及U/M/XY变化建立独立Babylon场景；候选、分类、保存响应不重建。canvas/output是JSX，关闭解除ResizeObserver/window resize/待执行RAF并停止loop、释放TankView/Scene/Engine。旧HomeEquipment类与account-controls构造监听已删除，其他HomeRoles旧preview待后续迁移。命令npm run test:ui:react:equipment。
