# 正式音频资源职责

正式音乐、战斗事件声、空间技能声及Type4播放资源归apps/web/src/audio。battle-music、battle-sound、effect-skill-sound三个旧平铺入口删除；EffectRuntime中的实际Type4资源表、HTMLAudio实例、句柄、音量及清理提取为EffectSound，没有旧字段转发或诊断副本。

| 所有者 | 实际职责 |
|---|---|
| BattleMusic | 原模式/地图音乐选择、循环、音量、交互重试及取消晚到载入 |
| BattleSound | 原射击/死亡和玩法击杀事件、缓冲解码、空间坐标/监听器、音量及清场 |
| EffectSkillSound | 原角色位置声音、一次/循环选择、100/2/1600空间衰减、音量和声音节点释放 |
| EffectSound | Type4大小写无关资源查找、真实媒体播放、单调句柄、结束/拒绝完成、停止、当前/后续声音音量、完成清理与共享描述符 |

Type4节点的原首次更新启动、stopPrevious、生命周期结束和重复stop时序仍由effect-sound-node及效果树负责。EffectRuntime仅配置音频目录、把真实backend/shared交给树、逐帧清理已完成声音并组装清场；先清空间技能声，再释放树，最后停剩余Type4声音并复位shared.last。句柄序号跨清场保持。设置音量先于目录载入保持，未覆盖时使用原目录默认值。

## 验收入口

- `npx tsx tests/effect-sound-lifecycles.cts`：460原Type4生命周期及backend调用序列；依据effect-sound-lifecycles-native.json。
- `npx tsx tests/effect-online006-tree.cts`：原在线混合效果树的Type4接线/顺序与清理。
- `npm run test:combat:effect-runtime`：真实技能通知到生产树、角色挂点、网格和句柄清理。
- `npm run test:audio:browser -- <CDP> [正式origin]`：真实音乐和战斗声解码、事件/空间衰减/音量/停播/晚到取消；默认正式origin为5173。
- `npm run test:audio:effects:browser -- <CDP> [正式origin]`：实际Type4 HTMLAudio播放、原资源大小写查找、默认/载入前/活动及后续音量、自然结束、拒绝、停止、清场/共享句柄和混合树；默认5173。
- 独立技能诊断运行后执行`node tests/browser-skill-effect.mjs <CDP>`：原空间技能声/循环/停止、实际树像素/到期/队列与零残留；诊断浏览器须允许音频播放。
- 正常CPU入口重试/自动准备/运动返回，以及双网页本人托管自然连续两局、原治疗效果/声音与退出释放、账户重启保存重进。
- 全仓类型、架构门禁、正式Web与独立技能入口构建、编译服务账户/迷彩联机重启及五模式各两局。

## 原时序与真实音频证据

460组原Type4生命周期、原online006混合树13完整tick、6236原树创建/35218节点及18角色挂点与真实生产通知清理通过（engineering-audio-modules-rules.log）。

真实浏览器音乐/战斗声通过：14个MP3、174个WAV解码，26原模式地图选择，21战车/原射击选声，实际音乐、原击杀声音图输出、100/1600/2空间衰减、音量、停播、重进和晚到载入取消（engineering-audio-modules-sound.log及browser-audio专题输出）。

真实Type4使用原GA01，媒体时长0.940408秒，分析器采样峰值0.5049017668；自然ended事件完成后逐帧释放，默认音量0.5、活动/后续音量0.25、载入前覆盖0.375保持。未知引用完成、缺媒体真实拒绝、stop/clear暂停删除、句柄1–7单调与共享描述符复位通过。原online006的17节点混合树经真实backend播放GA12，先停旧声音再播放新声音，树释放后无播放实例（engineering-audio-modules-type4.log、browser-effect-sound.json）。音频浏览器由真实鼠标交互激活，没有自动播放策略绕过。

正常CPU资源失败反馈/重试/自动准备/运动返回通过。双网页本人托管及不同拥有迷彩两局自然结束，夹具终局等待50156毫秒与82597毫秒；结算冻结/再战、库存数量、原Effect11/GA15与音频释放、账户服务重启正常重进通过。独立技能页面的Skill12原树像素、GA35空间声、保留到期/复活队列及零残留通过（engineering-audio-modules-{cpu,two-rounds,browser,pixels}.log）。

全仓类型、212个正式可达模块边界、正式Web和独立技能诊断构建、编译服务真实账户/迷彩联机重启保存与CPU五模式各两局全部通过。Web构建1分58秒、技能构建1分52秒；证据为engineering-audio-modules-build.log及server-build-{runtime,autopilot-match}.json。所有本片验收命令退出0。

## 范围

Type4原指令oracle使用记录backend，真实HTMLAudio由独立浏览器验收证明；混合树的stopPrevious分支由显式诊断夹具启用，缺媒体资源为拒绝路径夹具。技能通知诊断仍明确serverSkillTriggered=false。声音模块的职责和迁移验收不证明全部原技能资格、全部音效分派、资产及高清实战内容已恢复。原Type4浏览器播放backend仍不使用parameter改变音频属性，保持本片之前的实际行为；完整原参数恢复继续归M项。
