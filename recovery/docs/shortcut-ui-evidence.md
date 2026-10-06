# 原快捷槽界面来源

现存布局是`recovery/output/verified/assets/data/Data/ui/layouts/myhome_playerpage.xml`，不是单独myplayer.xml。已导出`recovery/output/web-assets/ui.json`的同名布局；catalog标记patchPending=true，download覆盖内容仍需恢复，不能以此基准布局宣称最终外观完成。

原EXE包含控件路径`MyPlayer/picShortcutPanel`（VA5d23b0）。布局中picShortcutPanel位于jinqiandaibilan下，AbsoluteRect为(7,0)–(201,77)。

| 控件 | 类型 | 相对面板的原AbsoluteRect |
| --- | --- | --- |
| picWeapon0 / picItem0 | WindowsLook/StaticImage | (16,36)–(48,68) |
| picWeapon1 / picItem1 | WindowsLook/StaticImage | (60,36)–(92,68) |
| picWeapon2 / picItem2 | WindowsLook/StaticImage | (104,36)–(136,68) |
| picWeapon3 / picItem3 | WindowsLook/StaticImage | (148,36)–(180,68) |
| txtQuantity0..3 | WindowsLook/StaticText | 对应四图标下方，RightAligned |
| txtItemQuantity | WindowsLook/StaticText | (139,0)–(182,15) |
| lstPlayerItem | WindowsLook/MultiColumnList | zuobianbufen下(12,15)–(204,239) |
| rdoWeapon / rdoItem | WindowsLook/RadioButton | zuobianbufen下分别(0,-36)–(66,15)、(66,-36)–(132,15) |

picWeapon与picItem两组四图标占据相同位置，不能画成同时排列的八个配置格。zhutu背景引用`set:mycabin00 image:data\\ui\\mycabin0\\kuaijielan0.tga`；武器占位图引用`set:gy0 image:data\\ui\\gy\\wuqitubiao.tga`，数量区域shuliangditu引用同imageset的shuliangditu.tga。

原4e1956/4e199f调用43dcc3配置实例与槽；4e19d2调用43cbe3取消。取消UI入口实际检查索引>0且<8，再把缓存slot字段传给系统，并清自己的图标缓存/设置重绘标记。角色数组仍由后续确认回调更新，见kitbag-configuration.md。因此系统请求“不修改角色槽位”不等于原UI完全没有即时缓存更新。

原4e0dfa–4e0e1b实际循环把七数组的前三项写入UI缓存+d0/d8/e0，对应配置slot1–3；4e11c0–4e11df从数组+c开始，把后四项写入缓存+e8/f0/f8/100，对应slot4–7。武器页四位置为默认弹药及slot1–3，道具页四位置为slot4–7；正常战斗键号分别1–4与5–8。tests/shortcut-ui-source.py实际执行这两块原指令、比较unsigned实例与slot映射，并核对四组AbsoluteRect重叠，输出shortcut-ui-source.json。原5cee40/5cee4c格式串为%s%.5d.tga与data\\ui\\daoju\\；图标目录使用item表D2值，导出为combat-catalog.items.iconId。


## M1-06库存配置页

HomeInventory复用myhome_playerpage.xml左侧库存列表、两radio和快捷栏的原AbsoluteRect与图集区域，武器/道具始终只显示四个位置。库存行显示账户持有记录的原图标、名称和拥有数量；默认炮弹独立，另外七槽可选择物品后点击或拖放配置，右键/Delete取消。列表的键盘选择与按钮确认可用。只有服务器成功确认后更新槽位；失败保留原槽并显示原因。无库存的账户显示暂无物品。

正常入口为网页“我的家：物品”；原窗口按800×600基准等比例zoom，在1080p/4K维持原图块相对位置与点击区域。`test:home:browser`创建隔离Web/服务器和两个浏览器上下文，以明确测试fixture验证图标/数量、切换、保存、取消、隔离、刷新/服务端重启及普通Digit2选择弹药。截图home-inventory-1920.png/home-inventory-3840.png。它是M1-06的库存配置功能交付，不是65布局或完整我的家页面验收；UI-36与M5-09保持未完成，32补丁及全部字体/资料/贵重品等仍需按清单推进。
