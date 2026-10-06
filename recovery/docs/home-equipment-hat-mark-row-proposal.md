# 我的家帽子与标志原名单行

UI32 / M5-07。原4e8621类别1到4e8865、类别2到4e8651，43bd09读取MyItem+c定义ID并调4396e0，10001..12000返回3，12001..13000返回4。两分支分别调用同4d8366名称、4d83b3类别、4d849e天数，使用同4b9e77原构造器。当前完整目录包含40帽子、45标志、0气球，完整原category3涵盖Hat10001..11000与Balloon11001..12000，category4为Mark12001..13000；原gamestring690为坦克帽子、691为坦克气球、692为坦克标志。

准备home-equipment-hat-mark-row-consumer.patch三文件，复用已接受Common内容和161×56几何，添加可选kindLabel并在Hat/Balloon/Mark分支传原标签。主线程负责HomeEquipment仅DECORATION category5或6只读过滤，与原coarse gate3一致。Common原DOM保持，库存过滤、选择、EQUIP、provider、槽与账号事务保持。没有重复生成几何或兼容组件。字段天数仅同MyItem+10原显示，不推期限政策。

## 取得与验收缺口

现正式Shop QUERY不提供Hat/Mark，两类没有已确认合法正记录存档。目录定义不能代替拥有记录，不能构造记录或新增可售列表。三文件补丁已正式atomic（15:43:45.613806885 UTC），等待共享统一工程。当前只有operator提供原ownership记录的导入通路，没有普通页面Import或publicgrant；Inventory记录与目录name/iconId字段身份已确认，正式来源消费可以先接入，positive实际验收保持pending，不构造存档。后继实际仅新两类别正常导航与合法正记录行文字、图标、选择、关闭，三分辨率完整图；已收Common几何和旧槽事务不重跑。额外已装状态与完整UI32/整页1:1保持未完成。
