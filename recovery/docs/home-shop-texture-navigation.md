# 我的家到正式迷彩页导航

UI-32/UI-59的我的家“更换迷彩”现在复用正式Tank商城页。HomeRolesView通过onTexturePage(instanceId)提交所选确认拥有实例；App关闭Roles并传AccountShopView.initialTextureInstance，Shop首次直接打开Tank Texture模式。商城Close回到Home tank，initialSelectedInstance仅在确认equipment存在时恢复候选，并把焦点移回拥有行。普通Home关闭由App清返回origin，普通商城打开不使用Home返回入口。

正式Home不再挂载HomeTankTextureSelection临时弹窗，其文件保留。原Home入口属于已记录的Web导航映射，转入原商城rdoTexture布局消费；不把这一导航声明为原客户端事件绑定。两个入口共享同一真实拥有查询、候选与配置页面，现迷彩业务保留。

## 归属

UI线home-roles.tsx仅入口/返回候选和焦点、shop.tsx initialTextureInstance合同透传、tank-shop.tsx首次mode/实例初始化；专属browser-home-shop-texture-navigation.mjs和本文/输出。App的textureOriginInstance、关闭/返回开关及普通打开清origin由主线拥有。旧Home纹理事务文件未修改，网络、账户事务和Babylon生命周期未修改。

## 实际操作

browser-home-shop-texture-navigation-2026-10-04T17-04-14-204Z.json PASS。新Account显式资金20000/200，正常购买tank3实例1与tank4实例2；大厅我的家→原tank页→选择实例1出击→候选实例2飞毛腿→更换迷彩。正式商城拥有名单选中2，原picModel实际renderedTankId4、确认默认U40211/M40212/XY40013，临时Home弹窗不存在。-formal-from-home.png已实际查看，候选/名单/模型可辨。

普通车身原箭头改变未保存候选→Close回Home，确认新拥有查询、候选仍实例2/模型仍tank4，出击实例仍1，焦点恢复实例2。商城预览element已断开、engine/scene释放。-returned-home.png已实际查看，飞毛腿候选与游骑兵当前出击标签分离。再次从Home进入正式Texture保实例2且为原确认三槽，未保存草稿丢弃；返回Home并正常Close恢复大厅我的家焦点。全程0TankTextures，不重复迷彩成功/拒绝交易或三res验收。专属3371/5421/9621/temp清理四项true。

home-shop-texture-navigation-types.log记录本片页端类型通过，主线当前App生产Webtype亦通过。发行和其余batch检查由主线统一。

```sh
node --import tsx tests/browser-home-shop-texture-navigation.mjs
```

## 未完成

该证据仅证明实际购买的两拥有实例间正常导航、未保存返回状态与焦点。原Home入口事件、原商城父附着、币种图状态、参数数值和完整页面1:1仍未完成；沿tank-shop-texture-page.md准确限定UI-59父项，不以导航PASS勾完整UI-32/UI-59或商城。
