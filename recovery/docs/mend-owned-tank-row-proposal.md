# 维修中心拥有战车名单

UI54 / M5-10。正式MendShopSourcePage当前Tank分支只显示名称。原51a094建立owner+58的161像素列，51a0fa工厂对同MyTank调用4d7e10名称、4d960f类别、4d88f1天数，再传实例+1c与owned1到4bb3bc。来源见mend-owned-tank-row-source-preparation.json；同构造器的161×56、图标5/8、名称44/12、类别44/28、天数104/28已由Home原行验证。

下一范围拟复用HomeOwnedTankRowContent与原display helper，MendEntry透传现OwnedRoles.name、+24车型、+34原剩余分钟，类别取完整CombatCatalog.tankTypes21。组件内部已有missingblank与unsigned ceil1440，0显示0天；不从TankShop默认期限取值。Mend名单外层精确补原161×56与selection161×51，不复制span几何。

精确补丁仅需MendShopSourcePage及其CSS，直接复用共享HomeOwnedTankRowContent/CSS，不改共享Home文件。现CSS绝对定位span依赖data-home-owned-tank-row，Mend外层将使用同构造器标记，新增Mend限定的父行几何，不改变Home父selector。Part行与原维修按钮保留。页面Tank时Part三个radio改条件挂载，以满足原模式隐藏；当前SourceButton的display:block会覆盖hidden默认样式。

后继只读合法两辆已购战车名单、新源文本、Tank↔Part导航与Close三分辨率实际；维修事务、费用、额外已装图标、完整控件与1:1仍未完成。当前精确两文件mend-owned-tank-row-consumer.patch已通过应用检查，两文件正式接线finalmtime2026-10-05 16:34:32.769325218 UTC，统一工程与首验待完成，不重复既有MendPart、HomeTank或购买套件。
