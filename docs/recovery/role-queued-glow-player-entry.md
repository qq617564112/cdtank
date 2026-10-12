# 被动闪光队列普通玩家入口

原17031「黄金之光」与17032「天堂之光」分别提供skill13501/13502，原Effect31/32均静默。现角色队列、复活启动、五秒轮换、移除和退出清理已有来源及模块/Chromium消费者证据；正常装备产生队列通知与真实复活因果尚未验。

## 已充分来源

combat-catalog原item17031/17032的skillIds为[13501,0,0]/[13502,0,0]，itemType12。两skill均Trigger0、Target1、首槽tag0/method3、Sound0，Func1.t65535。effects-role-queue-reentry.md、skill-effect-message.md及skill-effect-queue-native.json已证普通通知先入队不启动，真实复活启动首项，多条注册五秒单次任务，下一正delta轮换，角色/全量清理取消任务。资源和原生命周期直接复用，不重跑native。

## 正式入口边界

classifyItemId(17031/17032)=12；AccountStore.configureEquipment的正常EQUIP接受8..12，并核归属、数量、原五槽资格和同类重复。它们应走Home五部件槽；configureCosmetic的DECORATION/MARK仅接受class5/7，不适用于本片。

主线已核readRoleSkillSources/selectRoleItemSkills可从array2选择原被动技能，接手合法归属冻结→队列通知→出生/复活消费前顺序的正式producer。BattleSkillEffects已有event→queue、revive、frame与clear消费者；FX不修改World/Battle。

role-queued-glow-source.cts及同名JSON/log为PASS_ITEM_QUEUE_MAPPING_ONLY，核原item.dat两字段映射及真实分类/价格，复用旧队列树资源记录，不重跑queue-native/render专项。browser-role-queued-glow.mjs准备3383/5413/9613，node语法检查通过，未启动：预房原tank1/pet1拥有及资金2000/0明确夹具、部件库存空，正式Part BUY17031→真实库存instance→Home五部件槽0 EQUIP→四正常Account map7/mode1 Ready。observer记录13501真实通知、原2500树/2601与2882实际draw、最多三整幅320×180自然画布及Leave实例/树声/skill声/Battle声。render自动结果保持待像素亲审，不把draw当可辨证明。

## 最小实际范围

接口稳定后，沿正常拥有/购入资格、Home真实部件EQUIP和普通Ready，观察静默原31/32挂点、首次真实复活启动或已证正式入场生命周期、自然轮换与Leave清理。单一部件不证明双条轮换；原同类重复资格未明确时不同时装备两相同类别实例来强行制造轮换。源module及旧专项像素复用，新增只证明真实队列生产与玩家因果。

## 首普通玩家范围

browser-role-queued-glow-2026-10-04T20-54-09-190Z.json保原状态PASS_RENDER_PENDING_PIXEL_REVIEW。正常Part BUY17031×1后，Home真实instance1装备槽0；四普通认证Account/Ready进入map7/mode1。双端P1快照queuedPartSkillIds=[13501]，各创建原2500唯一handle4、owner player-P1，2601/2882实际提交。两端三张完整320×180自然画布已检查，host周围黄色粒子与guest视角远端绿色host周围黄光点可辨。正常Leave双端instances/meshes/skillVoices/treeVoices/BattleVoices全0/worldnull，辅助账户与专属进程临时资源清理。

role-queued-glow-actual.cts/json/log为PASS_LIMITED_PURCHASE_EQUIP_RENDER_LEAVE_SCOPE。观测包在BattleSkillEffects.play，而reconcileQueuedParts直接调用内层notifications.play，因此raw.notifications为空；源码与模块已证play先于revive，但本片不宣记录了普通完整载荷顺序。原skill Sound0及树无声音节点继续复用；raw仅记录Leave声音owner0，没有在PLAYING期间单独采集声音创建轨迹。购买页面成功及归属装备真实，余额数值与真实重启没有在本FX片新增观测。

本runner仅17031单条入场，不宣13502、双条轮换、自然死亡复活或再战已验。原服务端通知授权、HD/逐像素、未采声音轨迹及完整父M4-09/M4-10保持未完成；不重复renderer/native或扩大同入口运行。
