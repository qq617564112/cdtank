# 我的家装备页当前范围

M5-07/UI-32装备整页已经使用myhome.xml625×404原根与myhome_panzerpage.xml。当前源目录无独立myhome_equip布局；UI-37实际为myhome_playerpage_awardsummary.xml，不能用于装备编号。现文件与原控件映射保存在home-equipment-current-scope.json。

当前HomeEquipment消费HomeSourceRoot原框与导航、HomeTankSourceRegions同36主要原图、8装备背景，rdoTank/rdoEquip/rdoCommon/rdoHat/rdoMark五源按钮、lstEquip原SelectionImage与真实Inventory名单。五部件槽分别是picInternalPart0/1和picExternalPart0/1/2，另有picHatIcon/picMarkIcon。它们仍经Battle.equipment QUERY/EQUIP/UNEQUIP，响应slotCount/slots/decorationInstanceId/markInstanceId/profile为唯一确认，未从布局推造槽资格。当前+a8与OwnedRoles实例+1c匹配原picModel预览，不改其生命周期。

灰色Web外框已经移除，home.css装备根透明无border/padding，主要静态区域与名单/槽位已有正式页面证据。home-equipment-source-page.md记录15-48-32三res与装卸/源导航有效范围；Part17-21有效段补真实新账户取得16001与装配，17-27补生产关闭焦点。以上复用，不重截图、旧交易或数值组合。

选中部件说明与事务提示仍为原框下Web区，右侧四个拥有字段txtAttack/Extra与txtPanzer/Extra已接真实OwnedRoles，见home-equipment-owned-attributes.md；当前战车介绍消费真实TankShop QUERY匹配info、金币消费Equipment profile+70，见home-equipment-confirmed-description.md；其余参数及完整原字段未恢复。edtTankDesc是战车说明控件，现没有充分依据把部件说明填进去。取得新的原目标控件/事件依据后，可由UI线拥有home-equipment.tsx仅该呈现及home.css装备限定hunk；必须保留主线此前cleanup焦点资格、session owner、pending、事务和预览。

已恢复根框/名单/五槽复用现有证据。四字段范围只读复用原消费者；准确缺口为其余原参数、部件详情destination/producer、动态列表/滚动、全93控件与1:1。父项保持未完成。
