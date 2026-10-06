# 我的家装备整页主要区域

M5-07/UI-32的装备页面使用myhome.xml625×404原根框及myhome_panzerpage.xml的原子页。子页顶边36由完整父链累加；按800×600基准采用现Web统一比例居中。

HomeTankSourceRegions在角色页和装备页复用同36个StaticImage，恢复模型底图、右侧属性框与图字、底部参数框与移动/转向/射击/装填图字、左下数量余额图条。装备特有的heseditu2及七个部件/装饰/标记背景同样消费SourceStaticImage，不用CSS框代原资源。

原rdoTank/rdoEquip用于在已存在的角色页和装备页间导航；rdoCommon/rdoHat/rdoMark分类使用共享SourceButton，选择图态、悬停、按下和禁用沿已恢复原消费者。lstEquip选中项使用原SelectionImage；列表文字/行高和浏览器滚动仍为Web接线。

React session继续拥有候选、pending和确认projection；Battle.equipment仍是唯一装卸事务入口，协议、账户写入、槽资格和预览生命周期不变。原txtTankName由已确认拥有角色名称驱动；模型picModel仍消费当前选择及原迷彩。候选说明与状态提示位于原框下方，保留业务说明且不遮原属性/参数区。

归属：UI线home-equipment.tsx、home.css装备限定样式、home-tank-source-page.tsx同源区域提取、browser-home-equipment-source-page.mjs及本片文档。现App onRolePage/onEquipmentPage无需新的共享接线。

## 实际页面验收

browser-home-equipment-source-page-2026-10-04T15-48-32-309Z.json为PASS11，同前缀-equipment-800/-equipment-1920/-equipment-3840.png全部已实际查看。三分辨率完整根框、右属性/底参数/左余额图条及模型区域在场，候选说明/保存提示不覆盖参数。

普通鼠标选择库存81（13001生锈的强力炮管）→原部件槽0→Equipment EQUIP成功，源槽显示81且服务器库存state2；普通Delete→UNEQUIP成功，槽清零且库存state0。源战车/装备导航恢复当前已保存战车与选中装备分类；三分类切换保持预览与权威选择。关于我、Pet、Tank及源Close/Escape路径通过，旧preview DOM/engine/scene释放并停止帧更新。

账户夹具显式导入role-owned-pair-native.json rows[0]的战车72/宠物71，战车定义2、三个原迷彩、容量3及装备81库存1，不冒普通取得流程。未改账户写入和资格，既有拒绝/pending/持久证据沿E-R02-E复用，不重跑服务重启或对局。

Webtype通过home-equipment-source-page-types.log；专属3363/5413/9613服务、浏览器、Vite及临时目录清理四项true。实际检查范围是本片整页与正常装卸/导航，不代表完整93控件与1:1通过。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-home-equipment-source-page.mjs
```

## 限制

属性数值、余额producer、改装与耐久、原列表全部渲染/滚动细节和完整93控件仍未完成。右侧静态区域不证明属性业务完整，原同状态Windows截图与GPU/字体/高清锚点未闭合，M5-07/UI-32父项保持未勾。验收拥有和装备库存夹具不冒称普通购买获得。
