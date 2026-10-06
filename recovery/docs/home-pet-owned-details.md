# Home 宠物拥有资料整页

## 范围与来源

M5-08/UI34。HomePetSourcePage 原主要资料区消费当前候选的真实 OwnedRoles base 记录：生命字段 0x2c、凶猛 0x34、好运 0x3c，六组技能 ID 从 0x44 起、等级从 0x5c 起各四字节。原 myhome_petpage.xml 的 txtLife/txtCritical/txtLucky 和 txtSkillName0..5/txtSkillLevel0..5 提供对应位置。技能名称只按实际 ID 查询原 combat-catalog.skills；介绍按确认记录的定义字段8调用共用`sourcePetDescription`，原10条PetInfo均可显示，不受可售目录过滤。完整说明来源和接线见`home-role-original-descriptions.md`。

这些值是当前拥有记录的 Web 投影，原控件 setter 未证。购买建档初值沿现明确重建业务，不宣原成长或当前战斗最终属性。原固定图内的符号不再追加单位或计算公式。未知宠物类型、熟练度、学习费用和奖励不填。

home-pet-source-page.tsx负责资料呈现，home-roles.tsx持有确认候选、只读combat-catalog及displayed候选props，home.css提供资料可读样式。React保有候选与状态；App、协议、账户/SelectRole、模型生命周期及shared catalog合同沿既有实现。原六技能行图片用原NormalImage作为只读背景；学习页UI35的完整原业务保持未完成。

原基准800×600，沿现源主要根的等比居中与父链坐标。资料浅底的深色字为明确 Web 可读呈现；原颜色/字形/4K间距未证，完整1:1父项仍开放。

## 首次必要验收

原主要区三分辨率整图；通过正常列表切两个实际拥有宠物，名称、生命/凶猛/好运、六技能名称/等级和介绍与当前确认记录一致，旧候选信息不残留。未知 ID 不猜名称。保正常名单键盘/滚动与关闭大厅焦点，复用既有选用/购买/保存/自然对局与 preview 生命周期范围，不重复旧链。

实际账户若无可保留合法拥有基线，则本次两只宠物只经真实 PetShop BUY 取得，资金初始化明确测试上下文，不导入假拥有字段。仅本页查询呈现，不因名单显示冒称学习/六技能战斗绑定有效。代码与实际证据交主线主审，父项不勾。

## 实际交付与证据

HomePetOwnedDetails消费确认候选fields，HomeRoles只读载入combat-catalog，关闭/切页失活晚返回。介绍从确认定义ID直接选择原说明，没有独立说明请求。原六技能行NormalImage保持只读背景。生命/凶猛/好运和技能等级深字用限定brightness(.15)，介绍#253740为Web可读映射。原学习业务、费用、熟练度未知值保持空白。

首19-18-47 raw FAIL 是 DOM 仪器表达式 syntax，保留；正常购买取得与确认拥有已在，但不冒整页通过。19-19-18 raw PASS 实际普通 BUY2/103 后查询完整拥有记录，通过普通名单点击两个候选，实际大麦700/20/8、黄金母舰750/10/14，六技能名称/等级按实际字段和 catalog 对齐，介绍按返回目录对齐；0SelectRole、源Close严格Home焦点。账户初始10000金币/1000代币是必要测试资金，未导入拥有或改成长。

首800/1920/3840三整图均亲看，属性与介绍可辨，但技能文字挤页顶，不能接受为最终技能区域视觉。修正嵌套 SourceStaticText 绝对定位后，19-20-40 --layout-only raw PASS 与唯一1920实图已亲看，六名称/等级均位于各源行且清楚可读；仅正常BUY103构成必要拥有上下文，不复验双候选业务/SelectRole或完整交易，三旧图保留原边界。此补充不是最终三res全量视觉通过，4K字体间距/字形仍开放。

accepted 索引保存上述组合有效范围与原失败，不把任一局部raw称完整UI34恢复。focused Webtypes exit0，纯CSS定位修正不涉及类型；主线统一必要发行。专属3382/5432/9632进程与临时数据库/Chrome目录已清理，原父项仍未勾。
