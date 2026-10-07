# 我的家拥有宠物原名单行

UI34 / M5-08。MyPet/lstPet字符串5d1ac4经4ddc84绑定controller+18c。4de3b6工厂调用4d7e34直接复制MyPet+10字符串与4d8e07读取MyPet+8查PetTable并调用4d8c0b原Size+Type，传同owned record到独立4bc86b。vtable5cef78 getSize4b923b为161×56，draw4bcb65..4bd100底图161×51、图标5/8、名称44/12、第二行44/28。owned图标从41e99c同实例取MyPet+8，再查PetTable.ID+c并格式化data\ui\gy\maogou_%d.tga。

准备三文件补丁home-owned-pet-row-consumer.patch，包含独立rowcontent/CSS与HomeOwnedRoleSourceList仅Pet分支，Tank原行不变。接口新增可选petId/petType/petSize；name沿原拥有记录。复用原sourcePetKind，字段缺失空；不加价格、期限或业务动作。主线程拥有HomeRoles Pet正式挂载与原字段透传。主线程已确认OwnedRoles.base.name/+8完整线序，CombatCatalog.petTypes完整10条PetType/PetSize原元数据供同Tablegetter。

验收拟复用现有合法保存Pet记录，正常Home→Pet，800×600/1920×1080/3840×2160仅新行名称、图标、Size+Type、几何、选择及Close。没有BUY、SelectRole或旧Tank/滚动套件。端口与运行窗口由共享队列确定。三文件补丁已atomic，未启动Chrome，等待统一发行与Map3584亲清理。

## 未完成范围

已确认 current 使用标识（原状态3→`N`、`SmallHT`、point `(5,8)`、region `ui/regions/11/10.png`）已接入并随父 scale 显示，详 home-owned-role-current-presentation.md。原状态1/2/4绘制E/S/B及完整状态producer待核；当前使用记录工厂调用4bd103(3)仅有具名证据，不外推其他政策。旧15-22三PNG只覆盖新名单行本身，不含本状态标识实测；完整UI34与我的家Pet整页仍未完成。
