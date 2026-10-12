# 拥有商城来源显示合批

UI56/57/58。owned-shop-source-display-combined-consumer.patch是一份八文件React补丁：拥有Tank原部件子页只渲染Hat/Mark背景与具名TankPartSlot条件部件背景；Pet原第三行和Tank原第四行显示具名原表Money的signed half出售价。共用RoleShopListEntry一次增加petMoney/tankMoney与对应props，两个正式main均按选中的原定义ID查完整catalog。图标、名称、类别、天数、几何与商品价保现已收消费者。

该补丁供下一个明确共享窗口使用，替代UI58/Pet分立补丁，不叠加应用。UI owns其中八React files；root ownsCombatCatalog声明及normal exporter的完整21Tank/10Pet来源字段、统一type/build/copy。需要tankTypes.partSlotCount/TankPartSlot、tankTypes.tankMoney/TankMoney、petTypes.petMoney/PetMoney；无新网络API。当前只临时staging应用原prepared hunks和生成diff，正式文件未写。

原来源分别见tank-shop-part-parent-source.json、pet-shop-owned-price-native.json、tank-shop-owned-price-native.json。两Money文本的数字转换后124条指令与已资格Item出售价拼接同序列；10/21真实记录具名单字段与signed half实际执行通过，CEGUI绘制未执行。七个部件动态图缺所选实例provider保持未绑定，Equipment activeprofile不能替代候选实例。

专属driver tests/browser-owned-shop-source-display.mjs已准备，显式root协调的server/Vite/CDP参数，当前无端口预留或Chrome运行。一个Chrome串行两份已有合法数据库副本，中间关闭前context与server，再替换临时副本并启动同端口server。Tank合法实例1/2（三res）只新背景、slot条件与第四价字bounds，Pet合法实例1/定义2（三res）只第三价字bounds，两次strictShopClose。九张完整图覆盖新文字与主要区域关系，旧row/icon/type/day/arrow/BUY/SELL/SelectRole套件不复验。启动前离线完整source metadata核对；缺provider不启动浏览器。

本批只增加原已有位置的只读显示，不关闭完整UI56/57/58或整个商城。出售authority、所选实例slot动态图、整页原高清精度与原GPU/framebuffer对应仍保持缺口。

正式八文件已应用，共同mtime2026-10-05 18:02:59.005653597 UTC。统一73852 Webtype/build0与82916copy0，root完整metadata source equalityPASS。实际唯一consumer-directed56197退出0，raw18-07-35-154Z及九张800/1920/3840完整图已逐张查看：两Tank拥有行出售价1250/1750和Pet2出售价1750清楚，文字bounds不交name/kind/day；Hat/Mark与两部件背景按原count显示，其余三部件背景不存在、七dynamic未绑定，Buy返回卸载。两合法保存副本只读、两strictShopClose、四finally清理通过，亲3598/5628/9828三空后已直交root。索引owned-shop-source-display-accepted.json已回链root独立主审owned-shop-source-display-root-review.json / PASS_FINITE_OWNED_SHOP_SOURCE_BACKGROUNDS_PRICE_TEXT_CLOSE_SCOPE，不因有限PASS关闭完整父页。
