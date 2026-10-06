# 已学宠物部件槽权限页面消费者

Pet3实拥实例6的current10311、rank1在普通Home显示“多带一个1”。已选Tank3原容量2，经已学权限后Equipment权威slotCount3；部件14003实例7占据槽2并可用，槽3及槽4仍禁用。

普通Home→战车页→原`myhome_panzerpage.xml/rdoEquip`进入部件页，普通Delete成功卸下槽2；选择同一实拥库存行后，槽2重新装备实例7。两次真实Equipment确认分别为UNEQUIP/EQUIP，最终StrictClose返回普通大厅焦点。

最终combined主审：`recovery/output/pet-part-slot-learning-root-review.json`，状态`PASS_FINITE_PET3_ORDINARY_LEARN10311_SLOT_PERMISSION_SOURCE_READY_DUAL_STATE_NATIVE_RESTART_PAGE_CLOSE_SCOPE`；浏览器主审：`recovery/output/pet-part-slot-permission-browser-root-review.json`。主审确认两次原Equipment请求、最终confirmed全文恢复initial与原生profile/同部件保存。

证据汇总：`recovery/output/pet-part-slot-permission-browser-accepted.json`。Pet当前等级来源：`recovery/output/browser-pet-part-slot-permission-2026-10-05T21-17-40-282Z.json`；装卸范围：`recovery/output/browser-pet-part-slot-permission-2026-10-05T21-20-06-094Z.json`，session50523实际exit0。运行无Runtime异常，Chrome、server、Vite及临时目录清理完成，亲核3622/5652/9852端口为空。

驱动`tests/browser-pet-part-slot-permission.mjs`复用真实账户库及private accounts，身份与实例动态读取。compiled服务由`scripts/start-server.mjs`启动，沿现Web运行。

## 限制

本次覆盖已学10311的页面权限与两次装卸；没有新增BUY、LEARN、资金、Point、截图、重启、CPU、维修或出售。技能点取得与整页视觉父范围独立保留。
