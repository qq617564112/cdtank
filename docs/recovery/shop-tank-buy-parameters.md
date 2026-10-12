# 商城战车购买页参数

正式商城选中商品后，六项显示使用原 `shop_tankpage.xml` 购买页分支。火力等级、装甲等级由原分支明确赋字符串 `0`；移动、回旋、间隔、容量读取当前商品 TankTable，不读取出击角色、装备、宠物精通或已拥有实例。

原页面载入入口 `4b2ff0` 对应 LabPage，`rdoBuy` 位于该对象 `+118`。选中购买页经 `4b5c49` 将模式 `+1a8` 设为 0，商品选择 `4b7fd3` 调用 `4b6ce1`。此函数的模式 0 分支按所选商品定义查 TankTable，再设置页面文字与容量进度。

| 控件 | 原购买页赋值 |
| --- | --- |
| txtAttackLevel | 字符串 0，4b7388–4b73a8 |
| txtPanzerLevel | 字符串 0，4b73ba–4b73d5 |
| txtMoveSpeed | (TankMove + 5) × 10，4b7214–4b7259 |
| txtRotateSpeed | TankTurn × 4 + 11，4b726b–4b72af |
| txtShootInterval | TankDelay × float32(0.1)，按 `%1.1f` 格式显示，4b72c1–4b730c |
| prgLoadingTime | float32(TankBullet × float32(1/6))，4b731e–4b7337 |

炮弹容量按原 BackgroundImage/ProgressImage 显示进度，旁边的数值读数是 Web 呈现适配，内容为该商品 TankBullet。容量及间隔是原商品目录参数，实战由炮弹、装备和角色来源合成；目录中的负间隔保留原显示。

`shop-tank-buy-parameters-native.py` 在原执行地址计算全部 21 条 TankTable 向量，输出 `shop-tank-buy-parameters-native.json`。原 snprintf 为格式记录边界。表字段映射复用完整 `43b62a` 原 loader 的既有来源。生产 metadata 仅按当前 TankShop QUERY 确认的 tankId 消费，不扩大可售目录或改变交易。

游骑兵3对应 0/0、150、47、−0.2、容量1；飞狼4对应 0/0、170、51、−0.2、容量0；战车104对应 0/0、80、35、0.6、容量3。

## 页面验证

`browser-shop-tank-buy-parameters-2026-10-05T03-59-22-481Z.json` 实际 PASS。普通账户复用合法持久身份，从大厅原商店入口只读 QUERY，依次选择商品3/4/104；六项数值严格与原执行输出一致。商品3覆盖800、1920、3840整页，商品4/104覆盖1920整页，五张图片已全部查看。关闭后焦点严格回商店入口；本片没有购买、准备或新建房间。完整 Web 类型检查通过。统一生产构建证据收录于 `shop-tank-buy-parameters-accepted.json`。

统一生产 Web 类型检查与构建通过（Vite 2m2），最终页面已同步 `dist/release`。主审已查看五张完整图及原来源、21条原执行向量和实际三车型 QUERY，接受该六项购买页显示范围。
