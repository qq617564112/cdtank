# 我方存量技能501效果

M4-10-I501聚焦测试通过。原skill501首槽为Effect12、SE13、Tag0、Method3；测试读取原技能表并核对发布目录，经普通playSkillEffect通知进入正式EffectRuntime。

Effect12根节点2461的非保留树为2461、2561、2600、2609、2610、2611、2612、2613、2614、2615、2616。八个绘制节点2561、2600、2609、2611、2612、2613、2614、2615全部提交实际几何，类型为1、1、1、7、7、7、7、7，引用的纹理均已发布。Tag0对应tag_efcenter，实例使用实时挂点矩阵；移动矩阵后圈顶点随之移动。外层首槽SE13选择单次播放，发布音频为audio/sound/SE13.wav。自然到期、显式停止、detach与runtime.stop释放实例、网格与材质；声音结束及runtime.stop清空声音句柄。

运行`npx tsx tests/team-life-effect.cts`生成`recovery/output/team-life-effect.json`。

## 缺口合同

树内Type4节点2616保留原ww051引用。沿用ww051-loader-native.json的原加载边界证据：原源文件不存在，播放描述符无效，finished为true，stop直接返回而不触及设备。当前发布目录没有该声音，运行树产生静默完成，不替换资源。此合同允许本技能业务路径验收；ww051声音内容仍属于M4-08/M4-11未完成项。最小恢复入口是取得原data/sound/ww051.wav并发布原引用。

本测试使用NullEngine夹具纹理及媒体/WebAudio夹具，证明生产通知、树、几何、挂点、声音选择和释放；实际浏览器绘制、设备音频与原像素精确对照由浏览器证据验证。
