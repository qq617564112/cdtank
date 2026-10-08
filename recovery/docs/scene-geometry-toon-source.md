# 原普通几何toon资格

随包普通几何路径的`gbGeomNode::s_texToon`保持为空，自动材质选择不追加`0x1000`。当前场景几何保持既有普通材质；战车的显式toon来自独立的角色Attach与SetLight链，见[角色toon运行时](scene-actor-toon-runtime.md)。

## 全局槽与模块来源

`gbengine.dll`导出ordinal1040为`s_texToon`，地址`100534b4`；镜像初值为四字节0，无加载重定位。可执行段中的直接引用为`100108ab`和`10012108`两次读取。类构造、析构和相邻全局对象没有覆盖该槽的写入。方向`s_vLightDir`位于`100534b8`，初值为零向量，亦没有写入。

随包PE模块中，`CDTank.exe`和`GameBoxRenderer.dll`分别按名字导入187和23个gbengine符号，均不导入这两个数据槽；其它随包模块没有该依赖，也没有ordinal1040/1041导入。原EXE的六个GetProcAddress引用点解析CRT、IME与Windows接口，没有解析这两个几何符号。地址材料化、邻接全局和普通几何生命周期的静态来源见`scene-geometry-toon-source.json`。

## 选择与提交

`gbGeomNode::AttachSelf`的自动选择仅在`s_texToon`非空、flags不含`0x006`或`0x800`时追加`0x1000`。随后`_light`名称将flags改为`0x4000`，`_water`名称追加`0x8000`；显式effect分支直接采用effect flags并绕过此资格。

几何`0x1001/0x1011`对应`geom_cartoon.gbf/geom_cartoon_f2.gbf`。Render仅在flags含`0x1000`时上传上述全局方向与纹理。GBF声明参数而不加载纹理文件。角色SetLight`100099b0`只写actor实例的mode、方向和纹理，不写几何全局。原Silhouette门禁属于角色效果选择。

## 验收范围

本结论覆盖随包模块与已定位普通几何路径的静态来源。原D3D设备、像素及实际场景表现仍由对应实测父项追踪；本项未执行native、测试、浏览器、构建或类型检查。
