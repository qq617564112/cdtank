# 已购问候炮弹Autopilot的正常与末发期限

M2-02复用tank-ammo11-purchased-ai-network-2026-10-05T04-27-49-730Z.json的真实BUY2011/普通Autopilot对局，只补首次deadline分析，未运行新对局。原购买来源、有限量、普通续射、双端和正常Leave由原已接受范围复用。

专属tests/tank-ammo11-purchased-ai-deadline-analysis.cts使用原raw实际tank3拥有字段与相同技能reader重新计算源公式，普通2001与2011均capacity7、normal1.5、last4.5，和raw源值一致。按实际reload.startedAt变化定位三次开火，不把没有时戳的事件接收顺序当时间：2011首发tick86留1、2011末发tick116留0、普通2001续射tick207留6。

| 区段 | 模拟秒 | 服务器秒 | 快照接收墙钟秒 |
| --- | ---: | ---: | ---: |
| 首发→第二发 | 1.5 | 1.504 | 1.501 |
| 末发→普通续射 | 4.55 | 4.574 | 4.565 |

正常deadline首eligible为tick116，开火晚于deadline4ms。末发deadline期间始终保留原startedAt及duration4.5，tick205仍未就绪；tick206为首eligible，remaining0、自动回普通7/7但未开火，tick207才自主射击。末发续射晚于deadline74ms，距首eligible多一tick，服务器差51ms、接收墙钟差54ms；不把这一tick当原装填公式或精确实时性能上界。raw没有生成AI命令日志，不能确定额外等待的具体controller分支。

207次共同PLAYING完整players观察与5个指定fire/ammoConsumed事件双同。两个round1 Leave仅引用原同raw实际成功回执；当前分析不增加玩家对局交付，也不重验交易、库存保存、FX或生命周期。输出tank-ammo11-purchased-ai-deadline-analysis.json/log；status和主审mainReview分别保留本次检查与审收范围。

原客户端423092的precount==1末发选择及统一限幅/f32换算来源复用；特殊库存投影、自动回普通、AI机会选择与服务端时间门禁仍为现明示重建。reload.source原标签original-normal在该raw不能区别正常与末发，分析以实际count、duration和源公式判定。墙钟数字为快照接收时刻，不宣称原Windows客户端测量或全部实时性能。
