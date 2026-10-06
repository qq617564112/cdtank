# M2-05 本机死亡倒计时普通玩家范围

原控件、图字与调度来源已恢复，正式LocalDeathCountdown/BattleHud/View已接线；普通CPU自然死亡后的原图字显示、真实复活取消与Leave尚未取得实际证据。来源和模块直接复用`death-countdown-observers-source.json`、`death-runtime-bridge-sol-native.json`、`local-death-countdown.log`、`death-countdown-hud-store.log`及`death-countdown-ui.md`。

FX仅拥有`tests/browser-death-countdown.mjs`与专属output/docs。正式mode4/map7、两React与两正常CPU、预房tank1/pet1原拥有记录，计划正常托管自然命中/死亡/复活；没有改React/Battle、HP、时间或权威复活规则。原客户端delay1秒、5至1不授权服务器复活；当前权威3秒可能只覆盖5/4，未实际出现的值保持未验。

`death-countdown-player-gap.json`保存两次WAITING raw及第二次完整failure PNG：四角色已绘制、mapLoadedtrue，但准备调用仍遭“请等待地图和战车载入完成”门禁；guest提示模态未关闭，busy持续。两份raw均未记录实际resourcesReady/loadingError，无法区分早点击的载入时序与真实资源失败，不认定生产资源错误。未PLAYING、未自然死亡，不证明Countdown显示或取消。进程/temp已清理，不冒称普通Leave倒计时清理PASS。同入口不第三次运行。

专属脚本已加入透传Battle.render观察绑定，未来准备前须明确mapLoaded、players.resourcesReady且无loadingError，并确认本机真实Ready快照；失败保存资源错误与提示，通过原确认按钮关闭后才普通Leave。该准备修正仅syntax检查，无新增实际PASS。共享Ready时序与载入观测缺口交主线，来源和图字不重跑。

主线新增真实资源Ready UI门禁后，唯一新接口18-30-00-662Z尝试在更早普通ADDCPU处停止：点击后仍两玩家，无提示，未调用Ready、未死亡。两完整failure图保存，原控制可见但实际pointer target/请求未捕获，不能判生产CPU错误或Ready资源失败。观察绑定在CPU后，资源字段null为缺观测。新接口与旧两次WAITING原notice区别保存，不再自动追加运行；正常源控件点击合同交主线协调。

## 限定普通玩家有效段

主线新增资源Ready门禁后，18-34-24-960Z严格CPU点击入口成功：等待create/notice关闭、按钮enabled、scroll后两帧、elementFromPoint命中，两ReqCpu ADD透传success，人数2→4，正常Ready进入PLAYING。正常CPU自然击毁P2，原Countdown5/4从精确/ui/regions/4/4.png与4/3.png实际加载显示，native尺寸50×70，源160×120窗口按UI尺度呈192×144。完整natural-2.png亲审黄色原5清楚；权威满HP200复活后取消，双Leave worldnull/visiblefalse/valueempty。数字3只在复活边界DOM采样，未独立捕获可辨画布，不当其像素PASS。

原raw整体INCOMPLETE保留，失败项仅host没有自然死亡/捕图，本片不重跑同模块以补host。独立death-countdown-player-actual.json/log接受P2限定范围；glyph1/2在3秒权威复活前未到，保持未验，不延长复活时限造5秒fixture。原服务器复活授权、全部状态与M2-05父项未完成。两旧WAITING及新接口ADDCPU缺点击观测失败raw均保留，当前严格CPU证据不倒填旧文件。
