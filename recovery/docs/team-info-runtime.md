# 团队模式信息存量反馈（M5-05-T）

原game_main_info_team.xml八控件按原115×103面板与父内矩形加载。Self固定蓝战车、Enemy固定红战车；乘号和数字来自BigHT原字体图块，计时沿已有五模式独立原计时消费者。完整原4cb6cb七组消费者及两种本队标志生产块已经原指令执行PASS。原4cb6cb按HUD+932将CatsInfo/DogsInfo对应到self/enemy，整数格式为%d；上游本机位于猫/狗数组写对应方向。原Info字段与TankNumb是不同字段，不能据原Info名认定完整原生命次数规则。

本片明确重建数据适配：Web team0/1采用当前权威RoomSnapshot.match.teamLives映射本队/对队；不写原teamScores，也不声称原CatsInfo生产规则恢复。仅当前团队模式PLAYING/FINISHED且本机team合法、两队存量为非负整数时显示；缺字段或非法数据隐藏计数，不补0或猜队伍。WAITING隐藏，FINISHED保留权威最终数，普通再战刷新新状态。离房清除数字图块和值标记，防止重入展示旧数。

正式team-info模块只做客户端权威快照投影；BattleHud复用源layout/picture/bitmapText与既有每帧update，无服务器规则、协议或账户写入变更。源图与取证均没有被复制为生产新资源。所有八控件可以在源布局上验图态和矩形；数字由原图块实际解码，不使用普通文本替代原字体。CEGUI framebuffer精确混合/完整原广播规则不由本片声称完成。

验收：test:hud:team-info覆盖真实开局快照方位、WAITING/FINISHED门禁、缺字段/畸形存量隐藏与不修改快照；test:hud:team-info:browser普通双网页/CPU自然击毁与实际数值变化、原图字实绘和1080p4K、退出清理/再战。源完整消费者原执行另见team-info-source.md/json。类型/运行边界/Web发行；未改server、生命/伤害/道具/账户持久，复用有效CPU连续两局及账户保存基线，实际模式1自然对局另验。
