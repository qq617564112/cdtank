# M3-08 map6 Castle消费者切片

玩家交付：正式mode1/map6普通2001命中一座原Castle，初始原n1及原低血c2、原挂点反馈与声音。现SceneCastleVisual按动作name与tag_spout名消费，原05449 INI首c2不决定启动动作；复用45d16f与原场景初始化n1合同。

## 当前依赖

来源：scene-castle-0006.json及scene-castle06-source.json由地图线交付；81/05449和82/05450十动作已验证。模块：地图线领取ScenePreview仅0002/0006路径选择hunk，FX state/visual/presentation无需复造。普通实战触发及双端实际画面/输出尚未验。

权威缺环：主线已将battle/environment.ts初始化范围接mode1/map2与map6，读取原81/82身份与CAS HP；复用现sceneObjectHit/castleDamage事务。主线负责map6资格、原CAS HP事务与碰撞，不由FX修改或注入。正式接口已交付，当前首次普通81受损实战验收。

## 独立归属与验收

FX仅专属tests/browser-castle02.mjs --map6 --c2-only --nav-castle路线：正常四账户Create/Join/Ready，单射手普通移动/瞄准/Space至原低血门槛后停火，双端事务与原模型实际绘制。主线入口不动；原source/state与map2死亡停止/再战owner证据复用，不逐动作截图。若目标身份/权威事务缺失，具体记录接口，模型存在不算普通触发。

## 首次普通路线缺口

16-17-58-499Z raw INCOMPLETE：四正常账户PLAYING，目标81 HP2000且接受Castle事务0；双端实际前方原围墙，不能宣受损或无遮挡。普通guest(-622.24,-1539.98)射向81原场景首碰撞69，host(671.26,-1522.77)首174。原画布与raw保存，普通Leave原Castle meshes0；其余cleanup未取得实例引用，不能当释放失败或成功。

第二定向路线仅按现NAV普通键盘绕入庭院内部±120/-1400再单射手开火，不改变位置、原碰撞、HP或事件。观察器随现ScenePreview.advance/EffectRuntime.update只读绑定实例，零命中也可取得正式释放记录。原模型启动、来源、死亡与再战基线沿既有证据，不第三次重复同入口。

## 交付证据

第二段16-23-28-069Z raw PASS：84组普通NAV输入绕墙入庭院，单guest普通Space，32完全同值事务2000→624，两端原81/n1实际draw1124，首次低血c2实际draw60/59。low-1/2实际画布已查看，原庭院城堡及受损原烟火无遮挡可辨。事务32所在实际帧1136/1129，后续没有下一事务覆盖，未加表现延迟。

双端GA48 played32、se03 played3、se07 played1；se03 postgain三循环波形各非零，最大peak0.13660/0.23282。GA48/se07本地图仅playing，map2逐声实际输出合同证据引用castle02-composed-evidence.json；不声称新地图全部输出波形。正常Leave两端castles/instances/voices/meshes全0。

组合索引castle06-composed-evidence.json保留首段INCOMPLETE及原墙69/174入口，地图线startup只PASS_RENDER_LIFECYCLE范围明确复用。源十模型、45d16f、state/presentation及map2死亡/再战清理不复跑。

## tasklist原位建议与未完成范围

M3-08-CASTLE06追加上述81普通首受损视觉/声音playing/se03实输出/Leave证据，限定玩家片交主线审图；首失败不改PASS。82普通受损、map6死亡再战、高清和原伤害浮字未验，完整父项保持未勾。原权威规则及类型由主线交付，不计算伤害或改变资格。
