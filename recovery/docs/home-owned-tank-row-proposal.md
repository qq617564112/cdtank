# 我的家拥有战车主要名单原行

UI32 / M5-07。MyTank/lstTank→controller+138，4eccfd原列宽161，4ecd7b对同MyTank记录分别调用4d7e10、4d960f、4d88f1，传实例+1c给独立4bb3bc。vtable5cef2c getSize4b923b为161×56，draw4bb6cf底图161×51，icon5/8、name44/12、type44/28、days104/28。不是商城4bbd0a行。

名称直接复制同拥有记录字符串。type由MyTank+24查TankTable，调用同4d87bb类型游戏字符串。days读取MyTank+34无符号分钟，div1440并按余数进位，输出（%d天）。root确认OwnedRoles.name/完整fields原样传递；+1c实例、+24战车定义、+34分钟与现线序一致，type由CombatCatalog.tankTypes完整21条TankTable.ID/TankType同原Tablegetter取得。真实现记录实例1/游骑兵/定义3及实例2/飞毛腿/定义4的分钟均0，显示（0天）；不借商城默认耐久度或修订账户期限。

模块API为HomeOwnedRoleListEntry增加可选tankId/tankType/durationMinutes；root负责HomeRoles正式import/mount与原field透传。UI四文件补丁home-owned-tank-row-consumer.patch已atomic，仅独立rowdisplay/content/CSS与现source-list Tank分支。Pet分支、滚动模块、选择、角色使用和preview生命周期保持。额外inUse状态位图见已确认current接线。

已确认 current 使用标识已按原状态3→`N`、`SmallHT`、point `(5,8)`、region `ui/regions/11/10.png` 接入，详 home-owned-role-current-presentation.md；原状态1/2/4的producer/含义与其它页面状态仍未恢复。

未来首验复用合法保存账户，不BUY、不角色保存，三分辨率只新行名称/图标/类型/真实0天/源几何/选择与Close；旧六PNG不含本状态标识实测，不以其扩展范围。旧滚动、Common装备与完整角色事务证据直接复用。完整UI32/93控件和1:1父仍未完成。
