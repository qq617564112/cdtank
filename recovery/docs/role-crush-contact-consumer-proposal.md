# 原Crush运动接触消费者提案

当前已接线：服务端按 `scene-placements.json` 的真实 Crush 目录创建 `sceneCrushes`，`querySceneCrush(start,end,states,mapId)` 按房间地图查询；Plant/Crush 静态通知按 Plant 后 Crush 顺序进入同一个普通运动消费者。Crush 首次接触隐藏、释放当前 NAV/动态渲染碰撞并继续普通运动；Web 对 `sceneCrushed.sceneCrush` 独立消费隐藏与保留 051，不再要求 `shotItemResult`。仍保留“普通运动接触的双端实际呈现未验收”的原始限制，未把静态接线写成实测。

Map7 的现 Crush76/77 既有正式普通2001射击消费者；原 `4272d7` 的 `scene+1e8` 分类同时包含 Plant/Crush，静态预测 OBB相交后的 type100 会调用 `44e081→45efb3→461dd9`。首次立即隐藏、可选051启动；已隐藏重复通知静默。当前代码已把该运动通知接到正式消费者。`role-static-contact-provider-source.json` 与 `role-static-contact-receiver-native.json` 直接复用，不重复原 loader/controller 或射击验收。Breach在另一个+1d8集合，不进入本消费者。

## 最小正式接口

共享负责人已在 `scene-crush.ts` 和 `world.ts` 接线：在已有Plant之后追加当前房间真实 enabled且未hidden的Crush源OBB作为原controller静态对象，顺序保持 Plant 后 Crush。通知100沿现隐藏状态与`sceneCrushed/sceneCrush.placementId`产生事件、立即释放当前NAV/动态碰撞贡献，并继续已许可运动；不射击、不HP扣减、不添加shotItemResult或射击积分。Map7当前源75disabled/hidden与76/77enabled，Map1的13个enabled obj05459同样来自发布的 `scene-placements.json`；字符串身份适配和NAV占用沿现明示重建，不新建协议或购入规则。

现Web `match/battle.ts` 已改为由sceneCrush本身的正式隐藏事件调用原051消费者；有shotItemResult时仍单独消费既有射击显示。运动接触不伪造普通射击，也不把射击结果显示当作隐藏门禁。

现 `SceneCrushPresentation.crush()` 已执行 view.hide() 与 retained051 start，reset/dispose 生命周期复用；`ScenePreview.crush(placementId)` 已有 enabled 与一次消费门禁。正式接线让 `sceneCrushed+sceneCrush` 独立调用该消费者，原 `shotItemResult` 显示和 SE30 分支继续按真实字段消费，无需新增特效模块或 API。ScenePreview 对 Plant 的 enabled 快照同步和 Crush 目录资格均改为读取当前 `scene-placements.json` 的真实记录，只对已具名 loader 分支的 obj05420/obj05459 保留 051 消费者。

## 正式实现与旧 runner

正式实现已接入：服务端普通运动静态接触消费者按 Plant 后 Crush 顺序进入现有 authority 隐藏路径，Web 从 `sceneCrushed.sceneCrush` 独立消费隐藏与 051 保留。`tests/role-crush-contact-network.cts` 是旧专属 runner，未运行syntax/types或服务器，也未作为业务 PASS。

旧 runner 覆盖 sourceOBB 与全输入、同 tick 双完整 players/sceneCrushes、一次 sceneCrushed 完整事件且无 shotItemResult、HP/score/ammo 保持、继续运动和隐藏不重复、两条 round1 Leave 及完整 serverlog/真正进程退出。独立端口由 `CRUSH_CONTACT_PORT` 在编译发行/服务窗口稳定后提供；当前仍未启动，不把旧 runner 写成实测。

## 限制

本片不恢复原enabled运行producer、uint32对象ID、完整NAV清理内核或原服务器许可，不涵盖Breach、未具名其它模型或全车型。原051资源和射击表现直接复用；新运动接触的双端实际呈现尚未验收。完整运动和场景父保持未完成。
