# 装备页当前拥有战车属性

M5-07/UI-32。正式HomeEquipment同myhome_panzerpage.xml的txtAttack/Extra、txtPanzer/Extra消费当前已确认拥有记录+3c/+40/+4c/+50。当前实例来自Equipment QUERY profile+a8，与OwnedRoles实例+1c匹配；未匹配记录或缺字段不填值。来源复用home-tank-owned-attributes-source.json及已接受Home战车字段消费者；原字段setter与最终战斗属性不在本范围。

UI归属home-tank-source-page.tsx仅抽共享HomeTankOwnedAttributes（原HomeRoles现有呈现不变）、home-equipment.tsx现tank/fields分支只读调用与home.css equipment-stage该属性深字。保留cleanup焦点、原源导航、session owner、EQUIP/UNEQUIP/save、候选及preview生命周期，不改网络/协议/账户/数值。

专属tests/browser-home-equipment-owned-attributes.mjs只读复用home-tank-active-marker-browser-fixture.json及对应合法checkpoint，先只读查role_records为2，再复制临时库运行；token保密。正式Home→Tank→Equip读取当前战车四值，对照真实Equipment/OwnedRoles响应；普通Mark分类保当前属性，源Close严格大厅Home焦点。仅相关1920整页，旧三res、购买、选出击、装配数值与持久不重跑。原颜色未知保持Web可读适配，完整93控件/装备页1:1父未完成。

实际验收：browser-home-equipment-owned-attributes-2026-10-04T20-22-17-848Z.json首PASS。合法checkpoint只读count2，当前实例1游骑兵；四值122/78/17/44与本次真实OwnedRoles响应一一相同，正常Mark分类保持当前实例与字段。1920完整图已查看，模型ready/原框/名单/五槽/深色属性存在，源Close严格大厅Home焦点。0BUY/SelectRole/装备写/Textures/对局。高清字距和其余参数未知仍开放，不称整页还原完成。focused types exit0；本片待下一主线统一工程集成，未独立fullbuild。

代码/source/raw/PNG索引home-equipment-owned-attributes-accepted.json待主审，M5-07/UI32原位建议只登记该确认字段范围，不勾父项。专属3411/5441/9641与临时目录均清理，保留checkpoint未写。
