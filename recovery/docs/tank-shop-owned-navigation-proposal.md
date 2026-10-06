# 战车商城拥有名单导航

UI57 / M5-10。原LabPage/rdoBuy绑定owner+118，rdoSell绑定+11c；4b5f36匹配Sell并把mode+1a8写为1。4b6103拥有工厂消费同MyTank名称4d7e10、类别4d960f、天数4d88f1与第四行4d9633，传instance+1c和owned1到既有4bbd0a。构造器4bbdea按owned分支通过421f36取得MyTank，再按+24查TankTable，格式%s%.3d.tga使用原TankTable.ID图标。

当前正式TankShopView仅Buy/Texture。下一范围拟复用既有OwnedRoles查询与完整CombatCatalog.tankTypes，拥有名称沿原record.name，instance和tankId分开，分钟+34沿已确认unsigned ceil1440呈剩余天数。共享RoleShopSourceList和TankShopRowContent复用原4bbd0a几何，不复制布局；owned第四行缺输出合同保持空。普通返回Buy保留商品选择，Sell按钮禁用，不改变购买或纹理配置事务。

来源记录见recovery/output/tank-shop-owned-navigation-source-preparation.json。三文件已正式接线，最终共同mtime2026-10-05 16:19:26.422494608 UTC，统一工程及首次实际验收待完成；原4b73ec的mode1选中分支通过实例查MyTank，再按+24查TankTable；名称直接复制MyTank string+0，模型按TankTable.ID。其它拥有参数producer仍未资格，不能拿售卖默认耐久度替代拥有剩余时间。后继合法保存Tank记录只读导航与Close验收待主线协调文件边界和统一发行，不重验已接受商品几何、Home拥有名单或BUY。

精确三文件补丁tank-shop-owned-navigation-consumer.patch已准备并通过应用检查，已应用。拥有预览复用同OwnedRoles记录的readOwnedTankTextures，不使用商品默认外观。只读驱动tests/browser-tank-shop-owned-navigation.mjs语法检查通过，拟3592/5622/9822；合法两辆已购战车存档复用，三分辨率仅新导航、名称/类别/剩余天数、第四行空、选择与正常关闭，不复验旧Home行或购买套件。
