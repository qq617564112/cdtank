# 永久炮管的正式攻击消费者

M2-01/M4-10/M6-01：正式商城已允许普通取得13001，装备确认后原技能13001经统一来源、432951重算、限幅、精通与float32比例转换进入攻击字段。Atk20累加到角色+74，AtkBase在+70，AtkBonus在+78；原资格与字段合成复用既有重算来源。

正式射击仅在armorReady且recoveredArmor存在时使用这三个已资格字段。当前Web攻击输入政策为Math.round(Math.max(0,attackBase*attackPercent+attackBonus))，作为命中原始攻击或新弹丸攻击输入，不乘战车目录攻击值；已资格目标的最终减伤另由permanent-armor-policy.md定义。attackPercent已经包含ownedAtk的精通贡献；临时攻击饮料作为当前技能进入同一重算，不再次叠加attackBoost。已创建弹丸保留创建时的攻击，资格撤回忽略旧重算值。缺失资格的参与者继续使用现有原型攻击输入。

Root归属projectiles.ts/actors.ts及consumer测试，Numeric归属qualified-shot-attack.ts、纯数值来源与普通网络取得验收。无协议、页面或数据库格式改动，旧普通2001结果/受击资源直接复用。

工程依据为permanent-barrel-attack-engineering.json：消费者实际命中回调、永久加成、饮料一次计入、撤回/缺失资格和弹丸数值保存通过；类型、普通射击World、饮料资格/到期与自然CPU两局及服务端构建通过。正常账户购买装备与网络实际证据单独登记，不以此消费者夹具代替。

## 实际玩家范围

permanent-barrel-attack-root-review.json合审普通BUY13001实例8、同Tank3/Pet3/2001未装与装备后的单次命中176→196。实际攻击base100、bonus78、percent .975999951→1.175999999；装备确认取消双方Ready并加入技能13001。两房88/87共同完整快照、四次正常Leave、原生完整部件/资料/购买receipt与双方冷态QUERY同库服务重启相等。

正式网页Home Tank装备页确认原实例，方向键瞄准与原生空格一次2001命中196，双端命中、完整快照和页面状态相同。退出范围另由普通新房双Ready、peer PLAYING Leave、host FINISHED原summary Leave及双HomeClose证实；该退出房间没有再次射击。equipped-barrel-attack-browser-root-review.json记录页面范围。

qualified-shot-attack-modes.json覆盖五模式各两自然模拟局、161次本人命中196、结算/再战/退出；50ms模拟tick属于World集成证据，实际网络和网页证据独立登记。

## 未完成范围

攻击字段组合、取整、服务端伤害与目标处理属于Web重建，原最终伤害公式尚缺。原防御/Critical、全部弹药与其他装备的完整实际覆盖仍在父项。完整页面和高清表现不由本片工程证明。
