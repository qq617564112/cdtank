# 原Crush运动接触消费者提案

本提案为 prepared/unapplied。固定 Map02 整图、自然两局 Rematch、普通 Leave 与新 Create/Join 重入、高清及 Castle305 状态范围优先；Map7 接触消费者和专属 runner 暂缓，未占用服务或浏览器窗口。

Map7 的现 Crush76/77 仅正式普通2001射击触发；原 `4272d7` 的 `scene+1e8` 分类同时包含 Plant/Crush，静态预测 OBB相交后的 type100 会调用 `44e081→45efb3→461dd9`。首次立即隐藏、可选051启动；已隐藏重复通知静默。`role-static-contact-provider-source.json` 与 `role-static-contact-receiver-native.json` 直接复用，不重复原 loader/controller 或射击验收。Breach在另一个+1d8集合，不进入本提案。

## 最小正式接口

共享负责人接管 `scene-crush.ts` 和 `world.ts`：在已有Plant之后追加当前合法Map7/模式1或3、enabled且未hidden的Crush源OBB作为原controller静态对象。通知100沿现隐藏状态与`sceneCrushed/sceneCrush.placementId`产生事件、立即释放当前NAV/动态碰撞贡献，并继续已许可运动；不射击、不HP扣减、不添加shotItemResult或射击积分。当前源75disabled/hidden与76/77enabled参与政策、字符串身份适配和NAV占用沿现明示重建，不新建协议或购入规则。

现Web `match/battle.ts` 的Crush事件门禁要求shotItemResult。运动接触没有该字段，需由共享负责人使sceneCrush本身的正式隐藏事件调用原051消费者；有shotItemResult时仍单独消费既有射击显示。不能伪造一发普通射击来满足表现门禁。

现 `SceneCrushPresentation.crush()` 已执行 view.hide() 与 retained051 start，reset/dispose 生命周期可复用；`ScenePreview.crush(placementId)` 已有 enabled 与一次消费门禁。未来正式接线只需让 `sceneCrushed+sceneCrush` 独立调用该消费者，原 `shotItemResult` 显示和 SE30 分支继续按真实字段消费，无需新增特效模块或 API。

## 新普通网络准备

`tests/role-crush-contact-network.cts` 为专属准备，未运行syntax/types或服务器。两正常已购tank3/pet2身份直接复用同原native checkpoint，不重新BUY或写入profile/拥有/库存。Map7/mode1两Ready，以当前源76矩阵生成普通NAV近点和接触目标，通过递增sequence正常body/move输入触碰76。

保存sourceOBB与全输入、同tick双完整players/sceneCrushes、一次sceneCrushed完整事件且无shotItemResult、HP/score/ammo保持、继续运动和隐藏不重复、两条round1 Leave及完整serverlog/真正进程退出。独立端口由`CRUSH_CONTACT_PORT`在编译发行/服务窗口稳定后提供；此前不启动、不将准备文件作为业务PASS。

## 限制

本片不恢复原enabled运行producer、uint32对象ID、完整NAV清理内核或原服务器许可，不涵盖Breach、其他地图/实例或全车型。原051资源和射击表现直接复用；新运动接触的双端实际呈现尚未验收。完整运动和场景父保持未完成。
