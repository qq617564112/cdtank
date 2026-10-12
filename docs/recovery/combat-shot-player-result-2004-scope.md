# M4-09 / M4-10 速射弹受害者原007

| 范围 | 当前状态 |
|---|---|
| 原来源 | 原2004→4020/Trigger8/007/SE30映射已核，完整资源和分派复用普通2001已接受证据 |
| 模块实现 | TankShotPlayerResult追加2004资格，原tag0/oneShottrue及SE30 selector1边界PASS_MODULE_ONLY |
| 普通实战触发 | 同一正式2004 hit、受害者HP200→157已验 |
| 双端可辨/可听 | 320×180真实帧中原007烟/爆/光、SE30波形/自然end与Leave已验；远端2448未提交 |

首`browser-combat-shot-player-result-2004-2026-10-04T19-14-30-048Z.json`自动结果为PASS_LIMITED_PLAYER_SCOPE，原raw状态保留。亲看first/smoke双端完整画布没有可辨007，故独立`combat-shot-player-result-2004-first-visual-gap.json`准确降为INCOMPLETE_VISUAL。普通同hit、原007/tag0、2433/34/35实际draw、SE30双postgain0.543285/0.706269、自然end和正常Leave四0有效；draw不证明可见。命中附近真实帧间隔含.7–1.06秒，不据此宣称原资源或生产缺陷。

专属第二必要视觉补段只将软件3D降至320×180并记录最多18个原树活跃帧、实际elapsed/phase和整画布。原时长、delta、角色/相机/位置和事件均不改。若仍无可辨输出保存停止，不第三同入口；2447/2448短节点覆盖单独记录。

`browser-combat-shot-player-result-2004-2026-10-04T19-16-53-707Z.json`为PASS_LIMITED_PLAYER_SCOPE。两端同一普通2004 hit，受害者原007活tag0，每端一棵结果树和SE30声音，有限自然ended及正常Leave后instances/meshes/Battlevoices/skillvoices全0；SE30 selector1单次playing/ended，实际postgain0.528140485/0.703730166。

两端frame0/frame1完整320×180画布已亲看，爆炸/烟与环状原光效可辨；真实elapsed分别为远端.157/.637099981、本机.145400003/.616699994。原root2432，远端实际2433/34/35/2447，本机五节点含2448均实际提交。远端2448实际覆盖不足，不以本机或既有2001五节点证据冒作2004全节点双端通过，不再补第三run。首非可见图保留，不改其raw自动状态。

`tests/combat-shot-player-result-2004-actual.cts`生成actual.json/log，PASS_LIMITED_PLAYER_SCOPE明确缺失节点、低分辨率像素、正式事务、声音和清理范围。原007/native/资源继续只复用，未新增resource/runtime验收。

原item2004的ItemSkill1/2/3为2004/4020/0；4020 TriggerType8、Effect7/SE30/tag0/method3。`combat-shot-player-result-2004-source.json/log`只证明这一原item/skill映射，完整007树和原材质纹理声音、424614/4886aa受害者分派沿`combat-shot-player-result-native.json`、`combat-shot-player-result-accepted.json`、`ordinary2001-immediate-accepted.json`复用，无重复source/native/runtime验收。

正式World已为正常弹药命中附shotPlayerResult.itemId，Battle已有受害者调用；原消息读取当前弹药和Web权威冻结itemId的差异沿现重建接口边界。消费者仅增加2004资格，保留当前本机/远端、一次效果裁剪与独立空间声顺序；不接持续或其他未知特殊弹。

专属`tests/combat-shot-player-result-2004.cts`验证原007/tag0/oneShottrue、SE30 selector1及localView透传，未知2005/2006/持续2007保持此一次结果分支静默。其他已新增2002/2003测试负例同步为尚未支持弹种，不把它们继续当未恢复。

首验采用合法map7/mode4双普通Account、host单射手/guest观察，正常Digit2/Arrow/Space，首次结果停火，实际first/smoke/full画布与节点覆盖分别保存，有限自然结束及正常Leave检查。预房原tank1/pet1及2004库存15/实例77/slot2为显式夹具，非正式BUY；不注入活跃位置、相机、HP、伤害、时间、事件或结局。

原2004炮口同053但原fire分派GA07区别已有来源，不从Item.Sound1的GA08改变真实原fire分派；本片只受害者007/SE30，未新增炮口验收。主线class3有限消费独立推进，本片不修改数量政策或伤害/flight。完整弹种、BUY、原服务端政策、HD及M4父项保持未完成。
