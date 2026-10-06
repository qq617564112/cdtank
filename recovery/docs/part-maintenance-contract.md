# kind4 部件维修合同

M6-03 / UI-54。原5183b3的按钮6..11以days1/7/30、currency0/1和选中部件row+9c调用4935dc(kind4)。请求3f90与确认3f91的codec直接复用既有维修证据；kind4使用Inventory43d1a5按实例查找，再以owned+c查同ItemTable，不能借战车实例或Tank表价格。

Item原loader439b55的已核20..23列继续推进到24，直接写record+fc，字段为Break。原sender的Break==3拒绝映射反馈(kind4,result3)。owned+10在此分支是剩余分钟，新增days×1440后uint32值不能超过367200；不足原coin/money分别反馈0/1，期限上限反馈2。

wire的ownedQuantity只是原MyItem+10的24bit通用字段名，不代表各类别都是件数。14003的Inventory分类为5（原4396e0，ID13001..18000部件）；shortcut分类9为装甲；维修请求kind4是另一枚举。已收mend-owned-row-source.json与mend-owned-part-row-root-review.json证明同14003记录交4d849e，读取+10并unsigned ceil(/1440)，按gamestring624“（%d天）”显示。原Tradekind2/3才可部分数量，其他耐久记录整实例交易且保原+10。维修只更新同实例剩余分钟，保持state/battleQuantity/其他bits与实例件数；不把新增1440分钟解释为1440件。当前正常BUY raw1属于明示重建购入初值，对此维修一天成为raw1441分钟，原时长初值与自然递减仍未恢复。

原439898费用：一周raw coin为ItemCoin；一周money为ItemMoney×DataScale48.Max的32位低乘积。1天费用无符号整除5、7天取一周、30天左移一位。这里的unsigned div区别于原Tank费用signed除法，不直接偷换函数。14003表Money2000/Coin200/Break1，原DataScale48.Max50，因此1天money20000或rawcoin40。

UI选中setter519d0b取原Itemrecord，439aa5把uint32 ItemCoin乘.02/.1/.2、经%.1f和43079b转换后交三个coin文本，14003一天显示4；三个money文本直接使用439898整数。显示单位和请求raw单位分开。成功4的495612先写完整coin/money余额，再kind4按实例查拥有物品，将+10加days×1440。成功UI回调按当前部件/装饰/标记类别查实例，4d849e重算剩余天数字并刷新原行。

[来源索引](/workspace/cdtank/recovery/output/part-maintenance-contract-source.json)保留新分支与字段；[纯报价准备](/workspace/cdtank/recovery/prepared/part-maintenance.ts)未导入生产。最小正式输入为instanceId、days、currency、requestId；输出为原raw余额、完整Inventory和维修实例的新剩余分钟。原服务授权/原子扣款/持久为明示Web重建，原时间递减仍缺，不能从维修成功推期限自然生效。
