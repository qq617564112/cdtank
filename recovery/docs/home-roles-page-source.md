# 我的家战车与宠物根页面

正式角色页使用`myhome.xml`625×404根框架，`HomeSourceRoot`由库存和角色两个页面消费。四个原StaticImage左右图框/蓝条、Player/Pet/Tank原RadioButton与原Close来自同一源布局和共享资源消费者；选中图态随当前角色页切换。

`myhome_panzerpage.xml`与`myhome_petpage.xml`的SheetWindow顶边为36。现有角色坐标解析包含完整父链，进入根页后不另加偏移：

| 原区域 | 战车根坐标 | 宠物根坐标 |
| --- | --- | --- |
| 拥有列表lstTank/lstPet | 12,50–204,330 | 12,50–204,330 |
| 模型区picModel | 225,52–443,270 | 225,52–443,270 |
| 名称txtTankName/txtPetName | 455,49–588,66 | 447,49–537,66 |
| 出击btnUse/btnUseMe | 217,287–447,330 | 217,268–447,311 |
| heseditu背景 | 219,45–599,388 | 219,44–599,387 |

拥有列表、角色名称、原出击图及背景继续消费已有子页资源。坦克预览保留已有218×218拥有record来源、源组件与迷彩读取、镜头/旋转/渲染和生命周期规则；本页只改变其周围根布局。Root缩放仍为min(viewportWidth/800,viewportHeight/600)。

拥有资料查询和选择确认沿`Battle.ownedRoles/roleProfile/selectRole`，现有session/pending/confirmed状态及焦点规则保持。根Pet/Tank页签在当前已加载账户角色页面切换分类；Player回已交付库存根页。源Close和Escape返回大厅。底部保留已有迷彩编辑入口；提示置于根右下区。

## 限制

页签/Close的网页导航绑定、列表文字及选择保存流程是现有账户投影，不据布局声称原全部事件调用链。原宠物模型/技能、坦克装备附件/属性、改装费用/耐久和完整93控件未恢复；宠物页不伪造模型。迷彩拥有编辑沿既有商城源控件映射。原WindowsGPU、字体全精度和完整投影/光照仍属父项。
