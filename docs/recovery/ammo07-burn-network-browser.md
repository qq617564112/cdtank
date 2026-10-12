# 2007弹药持续伤害与生命周期验收

2007真实发射命中后的持续伤害闭环通过。正常托管输入发射2007，关闭托管停火后保留实际投射物命中；首伤43之后，4005在3、6、9秒各扣70HP，拥有角色夹具生命600降至347。9秒后没有第四次伤害，两轮自然TIME_LIMIT及正常再战清除旧持续作用。正式双网页接收相同战斗事件，目标本人HUD生命黄条显示347／600对应比例。

## 真实网络到期链

`tests/ammo07-burn-network.cts`使用实际index3227、临时SQLite、正常Account/Kitbag/CreateRoom/Join/Autopilot/Ready。两名玩家合法mode4/map7，无CPU干扰；主账户初始持有未售2007×1／实例77，通过Kitbag配置槽1（战斗Digit2）。只有主账户启用Autopilot，2007自然fire后正常关闭托管并发送停火PlayerInput，目标保持正常无输入状态。

拥有角色为已验`tests/tank-numeric-sol-network.cts`源充分pet1／tank1夹具：完整字段布局复用`world-role-attributes-native.json`，显式base0x2c=600、equipment攻击100，正常属性重算获得最大生命600。没有修改运行生命、位置、伤害、事件或胜负。

| 事件 | tick | 伤害 | 目标HP |
| --- | --- | --- | --- |
| 真实2007命中 | 71 | 43 | 557 |
| 4005第1周期 | 131 | 70 | 487 |
| 4005第2周期 | 191 | 70 | 417 |
| 4005第3周期 | 251 | 70 | 347 |

每次周期距实际hit分别60／120／180tick，即3／6／9秒。4005事件保留原攻击者与目标，未添加hurtSelector；两端事件完整相等。到期后继续等待超过3秒仍只有三次周期伤害。两轮自然TIME_LIMIT，Rematch双方HP600且第二轮无旧4005事件，正常Leave。

原始PASS：`recovery/output/ammo07-burn-network-2026-10-04T10-41-01-029Z.json`及`.log`。

## 自然死亡与复活清理

同一网络脚本`--death-only`使用显式拥有记录base0x2c=200，数值输入来自`world-role-attributes-native.json`原夹具，正常属性重算获得HP200；不把此输入称为pet1默认生命。初始2007×2，主账户正常托管发射两颗后关闭托管停火，真实两次命中各43，目标200→157→114；4005在tick131／191各扣70，目标114→44→0，正常死亡。正常复活至HP200后持续观察到tick451，仍HP200，没有9秒第三跳或复活继承伤害。双端事件相等，正常Leave；该短链不重复两局或持久消费。

原始PASS：`recovery/output/ammo07-burn-network-death-2026-10-04T10-45-10-697Z.json`及`.log`。

## 正式双网页

`tests/browser-ammo07-burn.mjs`使用实际index3228、正式Vite5388、独立Chromium9588和两张隔离1280×720页面。普通Home点击2007×1配置槽1，普通建房／加入，主账户点击Autopilot并Ready，自然发射后在对局控制中关闭托管。正式输入组件按正常50ms频率发送停火输入，未注入自定义投射物或伤害。

| 玩家可见业务 | 实测 |
| --- | --- |
| 真实命中与持续 | 43伤害及4005三次70，目标HP600→347 |
| 双端一致 | fire、hit、ammoConsumed、finish共8个战斗事件完全相等 |
| HUD消费 | 目标本人底部生命黄条约57.8%，顶部4hit反馈可见 |
| 到期与再战 | 无第四次4005；两轮TIME_LIMIT，再战双方HP600 |
| 正常Leave | 两页实例0、声音源0、状态stopped |

原始记录：`recovery/output/browser-ammo07-burn-business-2026-10-04T10-42-32-414Z.json`及`.log`。同一原始业务轨迹的独立战斗事件核对：`recovery/output/browser-ammo07-burn-business-2026-10-04T10-42-32-414Z-verification.json`。目标本人HUD截图：`recovery/output/browser-ammo07-burn-business-2026-10-04T10-42-32-414Z-burn-expired.png`。

再战HUD单次DOM读取为`recovery/output/browser-ammo07-burn-hud-2026-10-04T10-43-28-004Z.json`，两页生命控件aria-valuenow=600、aria-valuemax=600、title=600/600，证明正常再战恢复。

## 范围与已知限制

原表4005说明提供每3秒70HP、持续9秒；计时器、禁止叠加／刷新与服务器伤害权威为重建策略。持续伤害复用普通生命、防御、免疫、友伤、计分与死亡路径。绘声直接依赖既有`ammo-ai-network-browser.md`和2007有限消费绘声证据；本轮只记录实际持续扣HP与Leave资源清理，没有新增火焰动画、飞行或音频取样。2007仍未出售，初始持有记录为显式测试夹具。

浏览器原始整体状态为FAIL：正常Leave通知只发送仍在房内的另一页面，完整RoomEvent数组因该通知不同；保存的战斗事件及两轮／到期／清理业务均成立，独立核对文件只确认这些实际范围。347的HUD证据为真实截图；单次DOM读取在再战阶段，不作为燃烧期间347的DOM测量。

## 清理

正常Leave并断开连接，关闭index、Vite与Chromium，删除专属临时SQLite和浏览器目录。3227、3228、5388、9588无监听进程；专属临时目录无残留。原始FAIL与PASS记录独立保留。
