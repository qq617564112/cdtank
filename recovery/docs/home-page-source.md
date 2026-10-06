# 我的家根页面

正式库存入口采用`ui/layouts/myhome.xml`根布局。SheetWindow为625×403；右图框底边404决定网页内容高度625×404。原player、pet、panzer子页根顶边均为36，库存子页继续使用这一偏移。

| 原控件 | 原根坐标 | 网页消费 |
| --- | --- | --- |
| anniuditu | 1,0–209,43 | gy0/lantiao3中心及lantiao1/2左右图 |
| zkb | 0,35–216,403 | mycabin00/zkd九块图框 |
| hongsexiaodi | 209,0–606,45 | gy0/lantiao3中心及lantiao1/2左右图 |
| youbiandaditu | 209,34–614,404 | mycabin00/zkd九块图框 |
| rdoPlayerPage | 209,0–288,51 | guanyuwo三个状态及CheckMark |
| rdoPetPage | 301,0–367,51 | maogou三个状态及CheckMark |
| rdoTankPage | 379,0–445,51 | tanke三个状态及CheckMark |
| btnClose | 570,-2–607,35 | gy0/xiaoquxiaoanniu三个状态 |

原图框中心Image与Top/Bottom/Left/Right及四角属性直接进入共享SourceStaticImage，复用既有原StaticImage绘制消费证据。按钮使用共享SourceButton的原ButtonBase/RadioButton图态规则。导出资源选择同名DDS图集，沿用现有网页解析。子页库存武器/道具页签、拥有物品与四个快捷槽的源坐标和账户事务保持现有实现。

网页窗口居中，以min(viewportWidth/800,viewportHeight/600)统一缩放；图框边块沿共享源图缩放规则。源Close与Escape返回大厅入口并恢复焦点；原关闭事件绑定的全部调用链尚未恢复，网页使用已有退出库存动作。宠物和战车源页签分别打开已有账户角色页对应分类，账户资料/拥有查询及保存沿现有页面。

## 限制

原页签已贯通玩家、宠物、战车及装备页面；框下重复角色/部件入口已移除，见[导航范围](/workspace/cdtank/recovery/docs/home-source-navigation.md)。保存战绩与原奖章区域已接入，见[玩家页覆盖](/workspace/cdtank/recovery/docs/home-player-source-page.md)。记录、高级键位、设置入口及业务提示仍是保留玩家能力的Web投影。

等级、称号、家族、成长点、个人介绍及奖章权威数据仍缺来源，不填造值。原字体全精度、原窗口管理/GPU像素、原DDS/TGA管理器选择及完整Home个人资料父项仍未完成。
