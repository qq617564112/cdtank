# 破坏模型载入就绪

SceneBreachVisual 载入原纹理后，以已提供的原放置矩阵、blend1、alpha1、priority-1创建破坏模型网格，立即隐藏，并等待每个材质的 forceCompilationAsync(mesh) 完成。原动画 rate0/time0 保持；首次普通破坏沿既有 advance 开始，不延长淡出或修改伤害规则。

准备补丁：recovery/prepared/scene-breach-resource-ready.patch。准备实现：recovery/prepared/scene-breach-resource-ready.ts。仅 SceneBreachVisual.load 的新增就绪步骤，现公开 meshes 接口足够，不增加 EffectModelRenderer 接口。主线已正式应用该 load hunk，文件最终时间2026-10-05T15:31:04.801309868Z；加载生命周期由主线负责。

专属验证 tests/scene-breach-resource-ready-prepared.cts 一次实际 exit0，证据 scene-breach-resource-ready-prepared.json/.log，状态 PASS_PREPARED_BREACH_HIDDEN_RESOURCE_READY_LIFECYCLE。直接执行准备实现和真实 EffectModelRenderer，确认八个原05425网格各36顶点、编译回调时隐藏、加载等待全部回调、time/rate0、随后 advance 复用网格与材质，以及等待期间 dispose 后网格/材质/纹理归零。

NullEngine 提供纹理与几何后端；编译完成使用明确延迟替身。该验证不证明 GPU 编译耗时、真实首帧就绪或普通破坏动画姿态覆盖。Map05 两份及 Map10 首份 INCOMPLETE 保留，不由此关闭姿态/像素缺口。Map02/05428 五节点 GA30 新消费者已获正式资格，服务端36415构建及副本exit0；统一Web57040含类型检查实际exit0/1m52，发行副本exit0，index时间2026-10-05T15:33:04.699930053Z；工程证据map02-resource-ready-engineering.json。唯一3586首次普通破坏实际exit0，有限验收见下节。

## 首次普通实战

browser-breach02-05428-2026-10-05T15-36-16-029Z.json 为 PASS。正式模式1/map2 的 ENV:214 普通破坏后，双端原05428五节点获得多个真实绘制姿态。首次破坏 draw 前后已有五网格，耗时1.3/1.1毫秒；各自在同一帧39/34进入实际绘制，实际帧材质就绪为true。调用前后的 getEffect() 观察值仍为空，不能据此认定调用前已读到就绪状态。

亲看四张完整画布：双天然图可辨半透明棕色碎片整体，五节点独立像素与原GPU等价未验。GA30实voice1双端播放并自然结束，duration0.993832秒、loopfalse；输出峰值0.5267653465/0.2370183617。双正常Leave后breakables、brokenMeshes、instances、sceneVoices、battleVoices均0。

本次新消费者证实提前网格复用、同帧实际绘制及多个原姿态，不反向关闭Map05两份与Map10原INCOMPLETE，也不证明原漏采的唯一原因。地图专属helper/wrapper与主线review负责本次事件范围，本文仅关联载入就绪实现的有限实际证据。

主线主审：recovery/output/scene-breach02-05428-destruction-root-review.json，状态 PASS_FINITE_MAP02_HOST214_C9_GA30_POSE_DUAL_LEAVE_SCOPE。关联原raw、一次actual helper、runner55461实际exit0及map02-resource-ready-engineering.json工程出口。其余19放置仅load，原ENV authority、HD、全图与M3-08仍保留范围缺口。

## 下一普通破坏消费者：Map02/05427

| 环节 | 当前证据 |
| --- | --- |
| 原来源 | Map 专属 scene-breach02-05427-c9-prepared-source.json 已核六节点原 c9 与 DDS；原 44e24c→44e36a 对应 GA32。 |
| 模块与消费者 | 共用载入就绪模块已发布；新 05427 库导出、Preview 分支与 GA32 选择已正式接线，主线 mode1/map2 ENV 已追加六个05427，与原20个05428及Castle304/305共存。 |
| 普通实战 | browser-breach02-05427-2026-10-05T15-56-07-949Z.json 为新普通source126破坏PASS，Map确认runner实际exit0与专属三端口清空。 |
| 双端画面、声音与结束 | 主机六节点多帧真实姿态，双端GA32实际输出/自然结束和正常Leave成立；客机破坏节点实际draw未收，远端007实例/像素未收。 |

FX 只读 tests/observers/scene-breach02-model27-browser.mjs 合同：首draw限定 source126 的真实 broken.renderer；真实 mesh 回调限定 source126/obj05427；画布编码等待第二不同真实姿态且六节点同帧。GA32 在 destroyObject 同步调用范围记录实际返回voicehandle，previous/finally恢复归属；实际验收须筛选 sourcePlacementId126。调用前后 getEffect 读值与实际绘制帧ready分别保留。

Map 拥有专属runner、observer、一次actual helper及wrapper；FX提供原图、声音与就绪事实的独立只读意见。此新消费者归 M3-08，不改变已收05428、原Castle304/305或旧Map05/10范围。

05427正式工程出口：recovery/output/map02-model27-hat-mark-engineering.json，Web7967含types实际exit0、build1m50s/copy0；server88336实际exit0/copy0，compiled Castle2+ENV26/source126 PASS。3588唯一普通首验已由主线明确释放，Map负责执行，实际画声结论尚待原raw。

## 05427首次普通实战

原raw browser-breach02-05427-2026-10-05T15-56-07-949Z.json 为PASS。FX亲看natural-1及actual-1/2三张完整画布：主机近车半透明深色木碎片整体可辨，车体部分遮挡；客机未取得source126独立破坏像素。

主机firstDraw网格6→6、1.5ms，同帧36真实六节点材质readytrue，frames36..39有多姿态。客机firstDraw6→6、1.4ms，但actualFrames为空，不能称双端六节点绘制。两端firstDraw前后getEffect读值均null。GA32 source126实际voice1，双端playing/ended、nonloop，duration0.941678秒；峰值0.5668913722/0.5831280351，输出gain0.8004009128/0.8337149024，master0.5。

同局正式普通结果message2001端点[-1426.167236328125,25,792.2783203125]：本机feedback0且结果effect/sound0；远端feedback1、SE30实际handle6播放/结束、GA07 sound48与ENV126正式事务关联并结束。双方resultEffects均为空，未证明远端007实例创建或绘制；SE30本次未测输出峰值。双正常Leave后breakables、brokenMeshes、instances、sceneVoices、battleVoices均0。专属一次actual helper与wrapper由Map负责，主线主审另持；本文记录FX独立只读范围，不新增运行。

05427主线主审已落 recovery/output/scene-breach02-05427-destruction-root-review.json，状态 PASS_FINITE_MAP02_HOST126_C9_GA32_POSE_DUAL_LEAVE_SCOPE；关联 scene-breach02-05427-actual.json 的一次几何/矩阵误差0证据与正式工程。客机actualFrames空、resultEffects空和SE30输出峰值未测按主审保留。
 
## 地图2其余型号合并普通实战

工程 map02-all-breach-pet-owned-engineering.json：Web48344含types/build实际exit0、1m54s/copy0，server16533/copy0，ENV60+Castle2。唯一raw browser-breach02-remaining-2026-10-05T16-08-10-867Z.json 为PASS，Map确认runner实际exit0及3589/5619/9819清空。普通2001单局依次自然破坏117/05425、123/05426、401/05422，双端事务一致，双正常Leave五项资源0。

| 源物件 | 主机实际节点与帧 | 首draw已有网格/耗时 | 原声音与双端输出峰值 |
| --- | --- | --- | --- |
| 117/05425 | 8节点，48..53多姿态 | 8→8，1.5ms | GA32，0.5965818167/0.4624250233 |
| 123/05426 | 6节点，117..122多姿态 | 6→6，1.5ms | GA32，0.5850400329/0.5523933172 |
| 401/05422 | 10节点，194..199多姿态 | 10→10，0.7ms | GA13，0.5888397694/0.1648739576 |

每个主机实际帧材质readytrue；firstdraw前后getEffect均null。三声音分别真实voice1/2/3、selector1及原物件坐标，双端playing/ended、nonloop；GA32 duration0.941678秒，GA13 duration0.701814秒。FX亲看natural-117/123/401三张完整画布，主机近车半透明木碎片或木板整体可辨，部分受车体遮挡。客机actualFrames为空，独立节点像素与客机破坏绘制未收。

同局三次普通结果本机feedback0且无结果effect/sound；远端feedback各1，SE30真实handle6/12/18播放并结束，GA07 sound48各关联对应ENV事务并结束。远端spawnWorldEffect原007真实返回0共三次，resultEffects为空；返回原因未观察，不称生产缺失，也不称远端007实际绘制。SE30本次输出峰值未测。专属一次几何helper/wrapper由Map负责，主线持有限主审；整图环境动画、两局/重入与高清范围仍以地图2整图清单为准。

剩余型号主线主审已落 recovery/output/map02-remaining-breach-root-review.json，状态 PASS_FINITE_MAP02_REMAINING25_26_22_C9_POSE_DUAL_AUDIO_LEAVE_SCOPE；一次 scene-breach02-remaining-actual.json 核原几何/UV/indices/texture/worldmatrix误差0。主线保客机绘制、007返回原因、环境/305/重入/HD范围，本文按同一有限终态关联。
