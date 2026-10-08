# 落樱缤纷17035／13505原035

当前13505正式资格与035绘制已接，ww101／ww102已补作发布并映射audio.json；原延迟0／1.5及队列生命周期保持。补作来源与参数见[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)，原内容与新增实际输出待验。

原item17035分类12，价格1500金币／150软星，提供13505；原Trigger0／Target1／Func1.t65535，首槽035／Sound0／tag0／method3。原队列13501..13506消费者与生命周期已实现，旧来源与实际证据直接复用。

queued-part13505-source.py已核原item.dat／skill.dat和完整035九节点[2668,2669,2670,2884,2671,2672,2673,2674,2883]SAV与发布记录相等，五drawable引用原sakula／qiu2逐RGBA对应发布PNG。原type4树声2672=ww102／delay1.5、2673=ww101／delay0，均parameter0。技能Sound0不等于整树静默；现174声音目录与4665项原catalog inventory无ww101／ww102资源，保存确切缺口，不添加替声或猜原失败行为。

queued-part13505-runtime.cts通过真实EffectRuntime／原纹理／NullEngine，五drawable2670／2671／2674／2883／2884建立，实时tag0引用，五秒持续，stop后原尾quiescent清0，detach／runtime stop0；原树声请求ww101／ww102被记录，缺asset不形成实际音频。PASS_13505_035_PERSISTENT_TREE_MODULE_ONLY只证明运行树与清理，不证明玩家触发／像素／完整声音。

正式snapshot13505装备资格已接：服务端从确认部件与外观技能筛选`runtime.queuedEffect`，Web队列消费快照并按存活状态启动／清理原035树。实际购买、装备与双端绘制证据见下文；ww101／ww102原内容仍缺，项目补作已发布，集中登记于[reachable-effect-audio-gaps.md](reachable-effect-audio-gaps.md)。完整M4-09／M4-10父保持未勾。

文件：tests/queued-part13505-source.py、tests/queued-part13505-runtime.cts及recovery/output对应source/runtime.json/log。

普通入口证据由browser-queued-part13505.mjs及queued-part13505-actual.py取得：正常BUYtank3pet2检查点、API BUY17035／EQUIP槽0、双React map7mode4 Ready，记录五drawable、自然elapsed、原delay1.5的ww102请求与ww101请求，再正常Leave。其范围为原花瓣表现及请求生命周期，未覆盖当前补作声音输出。


正式资格已由root仅扩13505，queued13505-qualification.json新规则PASS，必要serverbuild出口0。首browser-queued-part13505-2026-10-05T04-03-53-381Z.json通过真实BUY17035／EQUIP槽0与双React PLAYING，P1资格[13505]，两端唯一2668挂player-P1，五drawable全部submit。六张640×360真实onAfterRender完整图已亲看，host与guest各frame1／2原粉色sakula花瓣明确，frame0无可辨花瓣；不据五draw称五节点独立像素全验。

两端原ww101／ww102各请求一次，后者自然delay1.5后出现，slot声音0调用。该证据的原声音输入缺资源，实际音频未形成，不证明当前补作声音输出。双正常SourceClose后worldnull和instances／meshes／skillvoices／treevoices／Battlevoices全0，进程GPU清理完成。核验tests/queued-part13505-actual.py通过并包装queued-part13505-actual.json，有限真实购买装备／双原花瓣／声音请求时序／Leave；树声原内容、补作实际输出、复活／輪换／HD及M4-09／M4-10完整父开放。
