# 宠物技能子弹窗键盘生命周期

UI35 / M5-08 / M5-10。Home拥有技能与Shop目录技能共享PetSkillSourceView。Escape按下记录，释放时消费事件后关闭技能子弹窗；父页保持打开，焦点返回原技能按钮。下一次Escape正常关闭父页。原native cancel、组合输入保护、详情binding、附件字体及焦点cleanup保持。

证据见pet-skill-escape-release-accepted.json，root主审ACCEPTED_HOME_SHOP_CHILD_ESCAPE_RELEASE_FOCUS_PARENT_LIFECYCLE。04-44-31-888Z实际两入口均记录down打开/焦点在子页/keys[]，up父页保持/strictOpener，以及下一Escape关闭父页。保存网络仅Inventory、OwnedRoles与Shop/TankShop/PetShop QUERY，无购买、装备写、角色选择或房间事务。原raw FAIL保留，末驱动断言将正常Shop QUERY误作写事务；已按原网络复核并修正断言。

使用既有真实购买pet2 checkpoint的只读SQLite备份副本，严格token身份匹配。原checkpoint有资金fixture，本次无新资金、角色或库存注入。无截图、旧技能全文或预览业务重验。3488/5518/9718端口与Chrome/Vite/server/temp已清。

pet-skill-escape-release-web-types.log exit0。生产构建待下一必要统一batch，不引用先前构建覆盖本次新hunk。

未完成范围：完整原UI35/页面1:1、Learning事务、完整OS IME。
