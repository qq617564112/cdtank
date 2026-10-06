# 已选角色来源读取与原请求取证

E-04本片沿实际AccountStore读取已选profile字段→查找本账户拥有记录→向房间/对局绑定拥有来源整理职责。账户readRoleProfileSelection有正式执行消费者，仅验证setRoleProfileSelection没有；原tank/pet请求同样只被原对照CTS执行。以这些实际值消费者判定所有权，不把拥有记录类型边当作双端运行。

| 所有者 | 模块 | 实际职责 |
|---|---|---|
| server/accounts/profile | selection.ts | 唯一readRoleProfileSelection，原selectors28/29字段读取与uint32结果 |
| recovery/evidence/roles | role-profile-selection.ts | 唯一setRoleProfileSelection，原字段setter对照，不承担账户资格/持久化 |
| recovery/evidence/roles | role-tank-selection.ts | 原对象身份比较、3ab4请求，只供CTS |
| recovery/evidence/roles | role-pet-selection.ts | 原对象身份比较、提示顺序、3ab3请求，只供CTS |
| shared/protocols | PtlOwnedRoles、PtlSelectRole、PtlRoleProfile | 真正双端拥有/选择/profile协议，保持原样 |

AccountStore实际selectedRoleSources直接引用新生产读取；selectRole仍按账户拥有资格写profile字节并持久化，不调用原请求模拟。BattleRoleSources实际receiveRoleOwnedPair与owned记录/重算规则保持原链，后续再按事务分离。3个旧shared入口删除，没有副本或转发，函数体保持原样。

两组tank/pet native+CTS及selection-callback native归evidence/roles；ROOT按新目录parents[3]解析，oracle输出原路径不变。Callback native只依赖原程序/recovery辅助，不读取其他oracle。test:combat:equipment改用迁移入口。账户/profile/recompute CTS分别导入实际server读取与独立evidence setter；原profile更新CTS也引用同一生产读取。

## 验收与限制

5条原命令检查身份比较、unsigned实例值、提示/发送顺序、原页面callback登记及触发，结果见engineering-role-selection-boundary-evidence.log。原请求/回调不证明原服务器资格、成功确认或账户持久化，这些由实际账户与正常网页验收。

4条业务CTS覆盖账户profile更新持久化/隔离/CLI、实际拥有角色记录和选择来源/重启、原recompute selectors与typed实例搜索、96原profile位流/264更新后读取；类型与运行依赖检查防止生产导入取证或shared反向依赖server。证据为engineering-role-selection-boundary-{rules,types,boundaries}.log。

集成验收：三个跨端协议与serviceProto SHA不变；两端独立构建；正式JS/map排除仅验证setter和原tank/pet请求且AccountStore引用实际server读取；编译服务账户选择联机/重启保存及五模式CPU各两局；正常选车宠物页面键鼠/拒绝隔离/刷新重启及1080p4K；双网页AI沿普通输入自然两局/Effect11与GA15/拥有迷彩、退出实例声音归零和服务重启库存快捷槽/控制恢复。原16tank/32pet请求及原callback绑定、4业务CTS、全仓类型/218边界通过；协议SHA不变，294发行JS/map排除原请求/setter且实际AccountStore引用server读取、编译联机保存/五模式各两局和正常网页选车宠物/1080p4K通过。证据为engineering-role-selection-boundary-{evidence,rules,types,boundaries,protocol,artifacts,server-build,compiled,roles-browser}.log；Web独立构建及双网页AI自然两局74349/102893ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零与重启库存快捷槽/控制恢复全部通过（engineering-role-selection-boundary-{web-build,two-rounds,browser}.log及独立engineering-role-selection-boundary-browser.json）。全部本片执行检查退出0，临时服务/Vite/Chromium已关闭。

本片保持现有拥有角色与对局链，不代表完整原选择UI及全部原认证/技能/玩法已恢复；整体E-04与完整资产/高清联机性能继续按tasklist推进。
