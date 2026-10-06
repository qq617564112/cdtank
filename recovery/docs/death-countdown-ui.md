# 原死亡倒计时HUD

M2-05正式BattleHudView选入game_main.xml的txtCountdown：原矩形(319,206)，160×120，Countdown字体、四角FFFFFFFF与水平居中。Countdown.font映射daojishi_sz_0.imageset原数字图；1为28×70的ui/regions/4/9.png，2–5各50×70，对应ui/regions/4/1.png至4/4.png。绘制复用既有BitmapGlyphs，默认BigHT定时器不变，死亡控件显式选择Countdown，无系统字体替代。

控件读取HudSnapshot.deathCountdown，主线只供给1–5或undefined；undefined隐藏并清空图字，数字在原窗口内水平、垂直居中，随现800×600 HUD统一缩放。React仅呈现状态；原死亡观察者与客户端调度由主线来源和状态模块负责，不在组件内创建计时器。原死亡owner+60正数显示、+64/+68隐藏的来源复用本轮主线证据，不重复observer取证。

自然CPU死亡/复活的实际页面显隐由主线安排；本片不增加面板、默认按钮或其他HUD控件，不作为完整原HUD精度通过。

主线状态契约落地后Web项目TypeScript检查通过：npx tsc --noEmit --project apps/web/tsconfig.json。实际死亡/复活页面证据待主线验收，不以类型检查替代显隐验证。
