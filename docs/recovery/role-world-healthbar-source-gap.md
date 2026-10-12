# 原角色画面生命条资源合同

M4-09普通受击后原角色生命条尚缺正式表现；当前玩家HP已经权威进入hurt与HUD。FX拥有独立source与未来visual，Battle/React、伤害与生命周期接口由主线负责。

原EXE三部件初始化在46a158写actor+25c、46a1c9写+260；四部件46d647/46d6b8同槽写入。字符串5c87f0为`data\ui\zhandou\wanjiaxuecao.tga`背景，5c87c4为`data\ui\zhandou\wanjiaxuecao_jindukuai.tga`进度块，两者容器名5c8264为`zhandou00`。465b62读取actor+29c缓存HP，role getter16最大HP，465b84比值改变原进度对象宽度；465b92/465ba8按原float32 .34/.67选择红/黄/绿。

`role-world-healthbar-source-gap.json`保留四producer写入附近原指令与字符串、阈值。现CDTank文件、verified解包路径、4665条catalog所有版本及web-assets中没有wanjiaxuecao两个资源名。现阶段是静态producer引用取得，非完整native/纹理来源或普通实际恢复。

缺口为两原图字节/尺寸/透明度与原容器加载来源，以及完整绘制资格、投影与停止合同。未以HUD图片、彩色矩形或通用生命条替代。正式消费者需原资源合同充分后，通过已有权威普通hurt/HP呈现并验证双端实际画面及相关死亡/复活/Leave清理。

M4-09原位建议保持未完成；新增上述明确原资源producer与引用缺口，已验普通射击/相机/原受害者007及Castle来源直接复用。该资料不新增局部PASS编号，也不代父项完成。
