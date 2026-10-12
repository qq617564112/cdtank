# 原角色普通受击浮字

| 层次 | 当前范围 |
| --- | --- |
| 原来源 | 普通hit selector1、signed文本、本机屏幕偏移与actor独立队列具名；符号分支已原执行，其余静态合同与既有record/font来源复用 |
| 独立模块 | TankDamageText及共用Damage renderer已准备，专属组合检查通过 |
| 正式事件 | 主线Battle/Players已接真实hit一次调用、每actor投影/更新/队列及round/remove/Leave清理；最终类型/构建/复制已通过 |
| 普通双端实战 | 唯一13-34-17普通hit43、两端原43图字、自然到期和双正常Leave已取得；主线有限画面评审原位关联 |

原角色拥有独立actor+240文字队列，普通受击入口422877在hurt状态门禁前将signed damage取负，以selector1调用467209。该分支使用%d或+%d格式，正数显式加号，负数保持负号，零显示0。466d09当次投影actor virtual+1c位置，经44ef2c/44ef47转换整数屏幕坐标；actor+258等于4269c4返回本机role时，屏幕Y再减100。坐标只在入队时保存。

原selector1字体为Damage，0为Benefit、2为Critical。selector1的0.5秒淡出、1秒到期、Y速度40与已接受Castle记录完全相同。共享记录46449f/465196的更新、绘制和字体合同直接复用，不重复原执行或glyph采样。Damage只有十个原数字图字，未映射负号保持blank；逻辑文本仍保存负号，不将原负值改成正值。

46753f把本帧f32 delta存actor+b4，再调用4673b7推进队列；两种actor更新时钟沿既有tank-actor-clock-runtime与role-actor-global-clock-sol来源。4673b7使用actor+28当前位置变换所得viewZ计算250/abs(viewZ)+.2。actor+28位置身份复用role-pose-producer-sol原写入证据。465c40绘制队列；actor析构46840e→468414以actor+240调用既有45caa0释放记录。

专属tests/actor-damage-text-source.py输出actor-damage-text-source.json/log。十二次实际原467209分支覆盖负/零/正值与四个selector，格式化CRT与最终enqueue为记录服务。其余enqueue、本机偏移、hit路由、clock和析构为具名原指令证据，不把静态路径宣称为完整原actor运行。

## 正式消费者接口

本片先交付普通hit的selector1。FX owns独立assets/tanks/tank-damage-text.ts及render/tank-damage-text-renderer.ts、专属CTS/runner/doc；主线ownsBattle事件与BattlePlayers/TankView生命周期接线。每角色独立队列，接口为new TankDamageText(renderer)、show(screenX,screenY,damage,isLocal)、advance(actorDeltaSeconds,viewZ)、draw(viewport)、clear()与dispose()。show只对已接受hit调用一次，将damage按signed32取负格式化，在本机当次screenY减100；renderer直接复用已发布ui-fonts.json的Damage原图字和现字体绘制实现。shader/纹理采样沿现明确Web供应边界。

主线复用现hit.targetId/value和该角色已加载view位置，不新增快照差值producer、不借CastleId分配角色队列。事件入队在hurt动作门禁前；snapshot/alive变化不重播。BattlePlayers.damage当次整数投影、每frame同角色动画f32 delta与当前相机viewZ已接；remove/换车释放所属actorqueue，round清队列，Leave和Scene销毁释放整体renderer。原死亡没有独立浮字清除依据，维持自然一秒到期。

首次普通受击浮字只需复用原合法射击流程产生新文本事件，观察双端各一条同值文本、一次捕获坐标、本机Y偏移、自然淡出/到期和双正常Leave资源释放。声音、2001旧效果树与hurt动作不重复验收。

## 模块与首次验收准备

TankDamageText组成现有SceneCastleDamageText原record队列；TankDamageTextRenderer为同一原Damage绘制provider，不复制字体/纹理采样或记录算法。每角色dispose只clear本队列，整体player presentation owner独立dispose共享renderer。tests/tank-damage-text.cts已actualexit0，tank-damage-text-consumer.json/log为PASS_ACTOR_DAMAGE_TEXT_MODULE_ONLY：原符号selector1三个值、双actor本机/远端偏移、交错推进、单actor移除不跨毁、自然到期与round clear均通过。

专属tests/browser-tank-damage-text.mjs使用3570/5600/9800。合法map7/mode4四认证、明确原tank1/pet1预房资料沿既有流程；host普通Arrow瞄准/Space，guest首次真实HP下降即释放输入。只读RoomEvent账本关联targetId/value与Players.damage同步调用、实际show及renderer返回handle；原glyph mesh回调保存640×360完整early/fade/late画布，原minus缺图不产生假glyph。advance前后同handle记录消失核一秒到期，实际Y核入队捕获值、本机偏移和原Y速率。文字门禁结果记录后仍先双正式battle/summary Leave，再aux Leave，最后关进程。

## 普通受击浮字证据

browser-tank-damage-text-2026-10-05T13-34-17-630Z.json为PASS_FINITE_ACTOR_DAMAGE_TEXT_NORMAL_LEAVE，权威runner60710 exit0。双端收到同一P1→P2普通2001 hit，实际damage43、各一次show与逻辑文本-43；字体没有minus图片，各10次真实digit mesh提交仅codepoint51/52。host远端当次屏幕坐标320/206，guest本机当次320/384后减100；文本X保持捕获值，Y沿原速率40推进。

六张完整640×360callback画布已亲看。两端early/fade黄色43可辨，guest late仍较淡可辨；host late叠在车身纹样处，不据此声明每字形独立精度。原文本不是逐帧贴挂点，而是入队投影后固定屏幕X/Y，再按当前viewZ缩放。

host到期步为elapsed0.98689997196加delta0.01799999923，guest为0.91570001841加0.09690000117，原一秒阈值后自然移除。双正式Leave后worldnull、textmesh/material/texture全部0；process PASS、服务器SIGTERM、Chrome exit0、临时目录已清，主线亲核3570/5600/9800三空。tank-damage-text-actual.json由专属actual.py离线组合，保rawStatus及mainReview/engineering原位字段。

最终工程32513 actualexit0，构建内Webtype0、Webbuild1m28、releasecopy0、index mtime2026-10-05T13:32:59.729737019Z；构建日志tank-damage-text-production-web-build.log。主线tank-damage-text-root-review.json已有限接受六whole640数字43/下移/淡出、原signed逻辑与自然到期/双Leave范围，actual的mainReview/engineering已原位关联。SceneDispose清理由当前正式接线证明，不冒本次实战已执行Scene销毁。M4效果父项保持未勾。旧2001效果、受击动作和声音直接复用，不重新验收。

## 未完成范围

原CEGUI GPU等价、高清与所有浮字selector未完成，全部combat父项保持开放。critical字段与Benefit/healing不由本片实际证据证明，不把当前playerHealed自动映射selector0。另具名HP增加observer来源仅供下一独立消费者准备。
