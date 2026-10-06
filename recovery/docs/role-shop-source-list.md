# 商城战车与宠物目录

UI56 / UI57 / M5-10。两原 lstTank/lstPet 为192×279 MultiColumnList，SelectionImage、纵栏图片及 ThumbMinExtent53有布局与资源来源。现商品目录使用4px容器和10px行 padding，独立候选恢复自然文字行到原名单边界，保现确认名字/价格与选项 callback。

role-shop-source-list、role-shop-list-scrollbar 和独立 CSS 已按 root 精确释放的 lst 呈现 hunk 接入 TankShop/PetShop；不改交易、余额、属性、介绍、预览、字体或共享布局。

18px最低文字行、8.5px栏宽/步长18与DOM extent为明确 Webprovider。真实目录不足以 overflow 时隐藏栏，不增行或提高行高制造滚动。price-label沿当前确认业务投影，不称原多列 producer；动态列与factory来源留未完成。

`role-shop-source-list-web-types.log` exit0。`browser-role-shop-source-list-2026-10-05T03-40-48-173Z.json` PASS。普通账户进入 Shop，两确认目录IDs与权威 TankShop/PetShop QUERY一致，战车10/宠物8项，鼠标候选与原生 Home/End选择，Close严格回Shop入口。Shop/TankShop/PetShop QUERY only，0BUY/Equip/room。两页800/1920/3840六完整PNG已亲看，名单文字与原选中图在源框内清晰可辨。

两目录clientHeight/scrollHeight均279，纵栏正确隐藏，本片不claim overflow滚动、箭头或thumb capture。runner exit0，3463/5493/9693无listener，Chrome/Vite/server/temp清理。root 已亲看六完整图并有限主审接受确认目录/选择/焦点范围，accepted.status=PASS_LIMITED_ROLE_SHOP_SOURCE_LIST_SCOPE；统一 `trap3005-terrain11-role-shop-production-web-build.log` types/build exit0、Vite1m56，已含最终消费者并发行。完整UI56/UI57和1:1父项未完成。
