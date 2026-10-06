# 装备页当前战车主要资料

M5-07/UI-32。原myhome_panzerpage.xml edtTankDesc（tankeshengjiqu内122×45）接当前确认战车ID+24匹配真实TankShop QUERY产品info；原txtMoney接现Equipment QUERY.profile+70。当前战车依现profile+a8与OwnedRoles实例+1c匹配。目录读取独立于装配QUERY，使用当前session active限制迟到响应，读取失败留空，不锁装备事务。介绍是原战车目录资料，不填部件详情，不推造剩余天数/成长/侧背参数或最终战斗数值。

归属home-equipment.tsx只读目录/描述/余额、home-tank-source-page.tsx只抽原HomeTankDescription共用与home.css equipment-stage介绍深字/滚动。HomeRoles消费同一既有description div，原表现不变；source rect/字体provider、cleanup focus、owner/save/EQUIP/UNEQUIP、预览、App/网络/账户规则保持。介绍可读色为Web适配，原最终色未知。

专属tests/browser-home-equipment-confirmed-description.mjs正常Home→Tank→Equip，只读复用已保存合法active-marker checkpoint；原库只读count2后复制临时库，保密token不输出。browser-home-equipment-confirmed-description-2026-10-04T20-26-43-501Z.json首PASS：当前实例1游骑兵的完整介绍与真实QUERY一致，profile金币14000；原edtTankDesc45高/scrollHeight60，普通鼠标滚动至scrollTop15末尾，文本与当前模型ready保持。源Close严格大厅Home焦点。最终1920完整图已查看，四拥有属性/介绍/余额与原框、模型、五槽同页可辨。0BUY/SelectRole/装配写/Textures/对局。

四字段确认及分类保持直接复用home-equipment-owned-attributes-accepted.json，不重四值/Mark；原三res、装卸及持久数值链沿已审证据复用。本次主要资料区一起交片，后续不逐小字段重复补图。focused types home-equipment-confirmed-description-web-types.log exit0，未独立fullbuild，待下一主线必要batch。索引home-equipment-confirmed-description-accepted.json待主审；原setter/其余参数/动态名单/93控件与整页1:1父保持未完成。3412/5442/9642及临时目录清理，保留checkpoint未写。
