# 商城 Item / Weapon 双向分类导航

UI53 / M5-10。原商城左右 radio 分类联动，选中任一侧会选择另一侧的对应类别。

owned handler 4a1564 检查 selectedWindow+38c：Item owner+48 调用 4a0d84 后选择 product owner+54；Weapon owner+4c 调用 4a1003 后选择 product owner+58。4a15f5 检查目标 selected flag，4a15fd push1，4a15ff 调用 RadioButton::setSelected(bool)。

product handler 4a03c7 的 Item 工厂尾部 4a05d4 读取 owned owner+48，4a05d7 检查 selected flag，4a05e6 转至 4a0933；Weapon 工厂尾部 4a075e 读取 owned owner+4c，转至 4a092a。公共尾部 4a0933 push1，4a0935 调用同一 setSelected 导入。原指令保存在 shop-radio-coupling-source.json。

当前 React 左右分类独立。shop-radio-coupling-consumer.patch 准备共用选择函数：两侧类别同步，类别实际变化时清除旧 owned selection 或选择当前 QUERY 中对应首商品；重复选择同类保留现选择。库存和购买接口保持现有语义。

Valuable 两按钮原初始化 setVisible(false)，本次只接可见 Item / Weapon。可见性修正另见 shop-valuable-initial-hidden-consumer.patch。缺少后续可见 producer 与正 Valuable 消费者来源。

两生产补丁已由主线应用，Web类型检查通过。browser-shop-valuable-initial-hidden-2026-10-05T12-36-46-416Z.json 在800×600、1920×1080、3840×2160验证隐藏按钮不绘制、两方向Item/Weapon分类同步且互斥及普通Close回商城入口焦点；三个完整截图已查看。使用保存的合法checkpoint副本，网络只读，清理四项通过。有限主审见shop-valuable-initial-hidden-root-review.json，wrapper见shop-valuable-initial-hidden-accepted.json。完整页面几何、字体与贵重品可见producer仍未验收。
