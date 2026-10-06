# 赤焰怒火17033／13503原033表现

原item17033「赤焰怒火」为分类12五部件槽，价格1500金币／150软星，关联13503。原skill13503 Trigger0／Target1／Func1.t65535，首槽033／Sound0／tag0／method3；现角色通知13501..13506原队列机制直接复用。

queued-part13503-source.py从原item.dat／skill.dat及原effect.sav验证完整033树[2605,2606,2607]记录、控制器和发布库相等。原a.dds与yan1.dds逐RGBA对应发布PNG。2605原delay0.6000000238，2606无限发射、2607控制器始于0.2秒，均lifetime0；不把原表65535秒移作效果时长。Sound0为原静默，未创建替代音效。

queued-part13503-runtime.cts通过真实EffectRuntime及原解码纹理，在NullEngine中建立033两个粒子几何，保持实时actor tag0引用；五秒后仍非quiescent，显式stop后原尾段自然结束清零，detach与runtime stop清理0。模块状态PASS_13503_033_PERSISTENT_TREE_MODULE_ONLY，不证明玩家触发或实际像素。

主线现已把passive-part-effects.ts资格仅扩13503，queued13503-production-server-build.log出口0、新资格选择检查通过，13503正式快照已贯通。FX不修改World／协议／Battle，不从表自行注入资格。Shop目录已有原17033，现通用部件确认与选择链复用。

browser-queued-part13503.mjs已准备3473／5503／9703，复用正常购入tank3／pet2检查点与其披露资金，正常Shop API购买17033、PART槽0装备及双React mode4/map7 Ready；只读观察原2605／2606／2607挂点、至多三真实onAfterRender完整640画布、Sound0／实际voice0及双正常SourceClose清理。首次普通actual已执行；角色购买、原队列native及旧单项／复活证据复用。

文件：tests/queued-part13503-source.py、tests/queued-part13503-runtime.cts、tests/browser-queued-part13503.mjs；对应recovery/output/queued-part13503-source.json/log与queued-part13503-runtime.json/log。M4-09／M4-10完整父仍开放。


## 普通玩家实际

browser-queued-part13503-2026-10-05T03-33-31-209Z.json通过正常认证Shop BUY17033实例4／PART槽0装备与双React mode4/map7 Ready。两端正式P1 queuedPartSkillIds=[13503]，各一次原2605树挂player-P1，原2606／2607实际submit。六张640×360真实onAfterRender完整画布中两端frame1／2红黄色火焰可辨，frame0尚无可辨效果；不把两节点draw当独立完整烟尘像素证明。原Sound0激活请求，无tree声音请求，各capture skillvoices／treevoices均0。双正常SourceClose后worldnull与实例／网格／skillvoices／treevoices／Battlevoices全0，进程及临时库清理完成。

实际核验tests/queued-part13503-actual.py通过，包装recovery/output/queued-part13503-actual.json。有限范围为真实购买装备／正式资格／双原033可辨火焰／静默／正常Leave；自然复活、队列轮换、HD及完整父项未关闭。
