# 地雷3002原资源消费者

M4-09／M4-10。普通取得、放置、接触伤害与生命周期政策由主线持有，见`mine3002-policy.md`；原字段复用`mine3002-source-preparation.json`。原Func12／Func2调度、Range80与原接触几何未恢复。

## 地面模型

原安装资源为Data/scnobj/03002/03002.POL及同目录03002A.dds。发布03002.glb包含cylinder01/0与03002A.tga材质、嵌入PNG。`Trap3002Visual`只加载该原GLB，位置来自正式GroundTrap快照；现native X反射及yaw0／scale1为明确Webtransform。`GroundTrapsPresentation`新增modelId3002分派，复用快照存在／移除／scope切换清理，不自行执行接触、寿命或伤害。

`tests/trap3002-visual.cts`与`trap3002-visual-module.json/.log`证明原发布模型身份、实际3002分派、NullEngine位置／缩放、挂载及移除后迟到资源释放。加载边界使用AssetContainer夹具，不证明普通放置或GPU画面。

## 具名效果通知

原skill3002首槽Effect10／SE02，skill4023首槽Effect8／SE31。正式Websender已冻结：placement3002的roleId为owner数字ID，contact4023的roleId为target数字ID；两者effectIndex0／duration0／xBits0／zBits0。现SkillEffectNotifications因此使用actor绑定3／tag0／oneShot分支，分别按owner位置播放SE02、target位置播放SE31。通知映射为Web重建，不证明原Func12 caller；无需新增效果消费者。

010／008两棵原树完整children均无type4声音节点，但本片非零roleId分支仍有独立外层角色声音，不以树内静默代替SE02／SE31实际声音验收。零roleId世界分支合同不用于本片正式通知。

世界树type4后端为EffectRuntime.sound／EffectSound，角色外层声音后端为skillSound，观察者不得混用。实际模型通过groundTrapId／sourceModel及原asset mesh的onBeforeRender归属。效果观察以同一次SkillEffectNotifications.play的skillId／roleId上下文，读取spawnAttachedEffect返回handle及runtime.instances中对应tree／draw mesh；owner3002与target4023分别关联实际view身份。声音读取playSkillSound返回handle→runtime.skillSound.voices.get(handle)，保留reference、voice.audio、voice.position／gain及真实playing／ended；短媒体在update前结束时保存play当下引用及ended监听，不从任意全局声音补证。返回0如实记录资源／AudioContext门禁，不称声音已播放。到期、消失及Leave清理沿现owner计数。

## 普通放置与接触有限交付

`contact-mine-root-review.json`及`contact-mine-browser-root-review.json`接受普通BUY3002／Kitbag、唯一敌方接触直接HP−300、原模型及角色010／008实际绘制、双端SE02／SE31实际playing／ended与空间gain、自然效果结束和正常Leave资源清零。425个共同完整snapshot及各网页own tick的players／match一致；地面原模型双端28／31次实际绘制，attached节点顶点alpha正值有实际归属记录。

首FAIL及其购买／已消费instance20证据保持；补段只配置剩余instance19，不新增BUY。原生库仅明确19消费与slot1、正常settlement＋1／history＋2变化，旧20及全部receipt保存，其余表按独立expected全文相等；同DB真实stop-start后的双账户查询相等。该范围不称full session、原Func12／Func2生产入口、Range80用途、原几何、完整像素或高清资格，父项保持开放。
