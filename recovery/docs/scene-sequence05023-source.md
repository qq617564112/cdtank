# 原Sequence05023加载与时钟来源

原vtable5c77e0的virtual+c指向45f811，该函数直接使用SYcScnObjSequence字符串5c7874；同表virtual+34为460bcd加载器、virtual+18为45f298更新器。身份来自同一虚表的实际指针及命名函数，不以邻字符串或资源名称代替类归属。

460bcd以%s/%s/%03d与.dds枚举序列，从1开始，另加载%s\%s\scr.pol。obj05023目录现有001–004.dds、scr.POL与obj05023.POL。加载尾461015读INI delay，461020乘原float32常量，写object+10c；461029将序列索引object+108置0。原INI delay100与四源纹理均存在。

45f298要求object+f0非空，然后object+f8经574e1e读取原性能计数器计时，不使用传入delta作为换帧时钟。仅elapsed严格大于object+10c才重置计时器，索引增加1并按vector+dc长度归零；单次update不补多个遗漏帧。44ef5e取得screen-model节点，再经5c09b8把vector+e0[index]纹理逐节点赋值。

scene-sequence05023-source.py/json/log保存原精确指令范围、三虚槽、路径模板、INI时基乘数及0008/0013原四placement。状态STATIC_SEQUENCE_LOADER_CLOCK_SOURCE_PLAYER_ENTRY_GAP仅为静态来源，不是完整loader/native/module或玩家表现PASS。

当前正式MAPS不允许8/13。没有合法普通玩家入口，不注册新图、不接进口renderer、不执行非法图actual。原完整计时单位provider、初始材质赋值及screen POL绑定仍需要消费者合同；该项保留为M3-08来源/入口缺口，不扩大底层执行或将资源存在当作正式交付。
