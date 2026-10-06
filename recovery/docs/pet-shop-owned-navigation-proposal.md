# 宠物商城原拥有名单导航

UI56 / M5-10。原CastlePage/rdoBuy存owner+48，rdoSell存+4c。selected事件4b1bd4检查原radio状态，Sell写mode+20=1、隐藏btnBuy+58、显示btnSell+5c并调用4b18e2；Buy写mode0，回4af876商品名单。4b1a36拥有工厂分别调用4d7e34名称、4d8e07 Size+Type、4d9657第三行，传实例+0与owned1到同4bd110。拥有行沿商城原44/4、44/18、44/32与161×56，不采用Home4bc86b的两行位置。

正式PetShopView通过既有ShopSource.ownedRoles接口接入拥有导航，无需新协议。PetShopView使用局部localmode与selected-owned实例状态、同RoleShopSourceList共享构造器owned分支和PetShopRowContent几何复用；正常QUERY时取得原OwnedRoles.base完整name/fields，与完整PetTable10按+8查Size/Type。切Sell只显示真实拥有名单与选择，返回Buy保持原商品选择和已有购买业务。原btnSell事务authority未确认，保持disabled，不提供SELL实现。

合法Pet2存档已保存，可复用home-pet-skill-source-browser.sqlite和同fixture；现普通账号记录实例1/大麦。后继三分辨率只新radio互斥、真实owned名单与两条已确认文本、返回Buy和strictShopClose。第三getter4d9657→4d8e82原输出未完成，缺字段空，不能借购买价或擅算折扣；已有商品几何与HomePet原行验收直接复用。

三文件正式接线共同mtime为2026-10-05 16:03:16.078302914 UTC。Buy/Sell按mode条件挂载，Sell保持禁用，共享SourceButton/CSS不变。统一工程与实际验收待完成：Map3589清理后，UI3590/5620/9820执行一次新拥有导航首验。
