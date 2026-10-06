# 首件饲料效果验收

物件1绑定技能1；第一效果槽为Effect11、GA15、Tag0、Method3。正式通知经BattleSkillEffects、createSkillEffectNotifications和EffectRuntime.spawnAttachedEffect进入`_root\online\011`。Tag0对应原`tag_efcenter`，生产运行树保留其矩阵引用并随角色挂点变化提交几何。

## 原资源与实际绘制

原递归创建证据`effect-tree-create-native.json`的2637非保留树包含9节点：2637、2643、2663、2664、2665、2666、2667、2830、2834。实际绘制为三个Type1精灵2664/2665/2667和两个Type6粒子发射器2830/2834，其余四个为容器。Effect11没有Type5模型控制器或CVD模型引用。五个绘制节点全部使用已发布原纹理：shuiwen、go、FlareBrightOrange_r2和FlareBrightOrange；shuiwen由两个节点共用。

`tests/healing-effect-fidelity.cts`通过正式itemUsed通知创建上述非保留树，核对原创建顺序、五个绘制节点、已发布资源和GA15单次声音分派。NullEngine实际提交五节点的顶点；移动原Tag0矩阵20单位后，恢复圈最新四边形的Web X坐标相应移动20单位。自然到期、显式stopEffect、角色detach和runtime.stop后，实例、网格、材质全部归零。没有发现需要修改生产效果代码的缺陷。

已有双网页实战`browser-healing-item.json`记录本机和旁观端各一个Effect11、Tag0、once=true、五个绘制节点；两端GA15真实playing、非循环、自然ended、声音归零，Effect11自然消失，离房实例/声音归零。该历史记录的`parent`字段检查`tag_body`，不能单独证明Tag0；Tag0的名称和实际矩阵跟随由本次生产运行测试验证。

## 验证

| 命令 | 检测内容与结果 |
| --- | --- |
| `npx tsx tests/healing-effect-fidelity.cts` | 首件正式通知到实际几何、原递归树、活挂点、声音分派及四种清理通过；输出healing-effect-fidelity.json |
| `npx tsx tests/effect-sprite-lifecycles.cts` | 843个原Type1非路径生命周期通过，包含2664/2665/2667 |
| `npx tsx tests/effect-particle-all-lifecycles.cts` | 649个原Type6非目标/非路径生命周期通过，包含2830 |
| `npx tsx tests/effect-particle-target-parent-lifecycles.cts` | 20个原Type6目标/父矩阵生命周期通过，包含2834 |
| `npx tsx tests/skill-effect-runtime.cts` | 18个原角色创建/裁剪/Tag索引案例及生产通知、递归停止和网格释放通过 |

M1-12所列“正式World施放通知驱动两端原模型、挂点、声音、停止与清理”在首件饲料范围内具备闭合证据：原模型在此效果中实际是精灵/粒子几何，原条目没有缺失。M1-12的任务范围为首件，此范围验收后可勾选；全部技能组合由M4-10继续验收；原服务端施放成功条件仍属于M1-09的独立待恢复工作。

## 剩余精度范围

M4的原逐像素、音频精确对照与全部效果组合尚未证明。本次NullEngine使用白色夹具纹理，只验证生产顶点和资源引用，不测原纹理像素、混合后的帧缓冲或实际WebAudio输出。双网页证据证明GA15真实播放与自然停止，不证明原音频混音和空间衰减逐样本一致；画布426×240的既有实战记录也不证明高清性能。此范围不阻断上述首件流程验收。

本轮修正浏览器监测，使用生产EFFECT_PRIMARY_TAGS把数值0映射tag_efcenter，核对两端实际树parentMatrix与view.primaryTag的身份一致；普通Digit5施放、五节点、GA15 playing/ended、自然消失/退出实例声音0全部通过（m1-first-item-attachment-browser.log、browser-healing-item-hd-effect-only.json）。完整业务两局及剩余库存重入再消费/再次重启通过m1-first-item-browser.log/json，实际画布1920×1080；不据此宣称软件渲染性能达标。
