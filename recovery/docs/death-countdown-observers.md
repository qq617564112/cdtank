# 本机死亡计数的原界面观察者

原死亡计数使用`GameMain/txtCountdown`，显示纯十进制数字5、4、3、2、1。没有“复活剩余”文字、秒单位或0帧显示。n=0回调不改变控件文字或可见性；控件在复活、角色缺失或角色已为状态2的后续观察者通知中隐藏。此显示不提供服务端复活授权。

## 注册与控件

| 服务字段 | 实际注册与setter | UI方法 | 行为 |
| --- | --- | --- | --- |
| owner+60 | 4d457d注册4cc99e；49162a写+60 | 4cc99e | n>0按`%d`设置文字，再setVisible(true)；n<=0无UI调用 |
| owner+68 | 4d45a9注册4cca3f；4363bb写+68 | 4cca3f | setVisible(false) |
| owner+64 | 4d45db注册4cca4e；491646写+64 | 4cca4e | 隐藏倒计时，同时处理其他原开局UI可见状态 |

注册回调保存同一UI owner实例。4c7aa9以5d0e08字符串`GameMain/txtCountdown`取得控件，4c7ad1写UI owner+728；三个目标都操作该字段。原IAT5c0240为CEGUI Window::setText，5c0260为Window::setVisible。4cc99e格式5c83d4为`%d`，其正数分支先设置文字、后显示。

## 原显示资源

`game_main.xml`内txtCountdown为WindowsLook/StaticText，800×600原布局矩形[319,206,479,326]，宽160、高120，水平居中，白色FFFFFFFF、无框，字体Countdown。布局默认Text为1，不代表死亡入口立即显示1。

Countdown.font使用Static图字字体、原生800×600、AutoScaled=true；0..9引用daojishi_sz原图片。正式`ui-fonts.json`已有Countdown及十个glyph，资源在`ui/regions/4/`。game_main_info_team/conquer/vip/melee/destroy的txtRemainTime是模式时钟，不是这个死亡计数控件；本片不将倒计时写入模式计时或战斗日志。

## 触发资格与正式接入范围

复用death-runtime-bridge-sol已执行合同：本机角色死亡才启动原初值5、间隔参数1；每个计数回调先要求当前客户端状态类型4。角色存在且状态不为2时通知owner+60(n)，包括0；角色缺失或已状态2通知owner+68。本机复活先取消调度再通知owner+64。原角色与当前客户端状态类型映射由主线协调。

正式消费归`apps/web/src/interface/battle/battle-hud.ts`的HUD语义状态与`battle-hud-view.tsx`的原控件选择/图字绘制。现HudLayout没有选择txtCountdown，HUD状态也没有其死亡计数消费者。可提供change(n)/hide两类UI通知：change只在n>0更新数字并显示，n<=0保留；owner+64和+68均隐藏这一控件。使用独立可见字段，不能用n>0的派生条件在0回调自动隐藏。字体需明确选择已有Countdown，不用默认BigHT或MediumHT。

owner+64的其他开局面板变化不属于单独倒计时显示消费者，主线已有状态面板按其生命周期处理。4cc99e还调用独立4d6524反馈入口，本片仅恢复三个观察者的UI目标，不从该调用猜测声音名称。

## 来源范围

`death-countdown-observers-source.json/.log`保存上述真实原注册、setter、目标、控件lookup的逐指令字节，以及layout/font与IAT名称。生成器为`recovery/evidence/combat/death-countdown-observers-source.py`，仅静态来源捕获；没有重复72组死亡bridge执行，也不宣称Windows控件draw或网页实战已通过。服务端复活条件/出生选择及调度器内部授权不属于该UI来源。
