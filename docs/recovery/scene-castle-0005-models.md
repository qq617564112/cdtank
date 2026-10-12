# 0005 原 Castle 入场表现

正式mode1/map5普通移动已能看到原Castle129/obj05447的n1模型，两个网页均显示CAT城堡正面、木门、墙体、塔楼和雕像底座。两原Castle128/obj05448、129/obj05447接入已验证的SceneCastleVisual，以名字选择原动作并复用原45dd2d n1(mode0)初始化。模型源和通用状态消费者沿0002已验依据复用，不新增受损资格。

地图线拥有 `export_scene_castle05.py`、`scene-castle-0005.json`、`export_scenes.py` 独立 import/call、ScenePreview仅0005库选择，以及专属source/browser/actual/accepted文档。现状态消费者、FX runtime、round/dispose和Babylon主生命周期未新增实现。

| 原身份 | 型号 | 原position | 原五动作 |
| --- | --- | --- | --- |
| 128 | obj05448 | [1614.289429,0,-469.391846] | c1,c2,c3,n1,n2 |
| 129 | obj05447 | [1588.122681,-2,442.486877] | c1,c2,c3,n1,n2 |

`scene-castle05-source.json/.log` PASS核原CAS完整position/matrix/model，五动作库与已验0002同型号逐字段完全相等；几何、UV/morph、原DDS像素、材质及五命名挂点使用 `scene-castle02-source.json`。source充分且不重复模型底层取证。

## 普通玩家与实际画面

`browser-scene-castle05-2026-10-04T16-23-03-730Z.json` 首验PASS：正式React选择mode1/map5→建房/卡片加入→两CPU/Ready→122组普通A/D/W输入→双方接近原129至700范围且各移动超过50→原n1实际绘制→普通Leave。未写活跃位置、相机、伤害、时间或场景事件。

完整 `-natural-1.png` 中CAT木门、四塔、墙面和雕像底座清晰；雕像上部超出普通相机画面。`-natural-2.png` 中同一正面可辨，左侧原树遮挡部分墙体。原129 world位置[-1588.122681,-2,442.486877]为原坐标X反射，缩放1，旋转沿原matrix。当前视角不同是普通移动造成的，两端原放置与材质相同。

`scene-castle05-actual.json/.log`验证实际提交绘制的原n1 XYZ/UV、材质17float、原纹理引用与世界矩阵；摘要仅渲染/生命周期。实际可见资格由完整PNG审图及 `scene-castle05-player-accepted.json` 组合给出，不把draw调用单独当作可见证明。双方Leave后 Castle instances/roots/meshes均0；`scene-castle05-process-cleanup.json`核3329/5359/9559关闭、server/chrome退出、临时目录释放；Web types通过。原环境声音/常驻042、普通地图消费者及通用重入生命周期复用已有限定证据。

## 原位建议与未完成范围

主线在M3-08下登记/勾选限定Castle05原129 n1可见入场/普通移动/Leave子项；保留M3-08及整图父项未勾。128仅原资源、入场状态和同消费者覆盖，未独立截图。没有普通受损/死亡、伤害授权、原碰撞规则、同房再战或高清性能声明。场景可见状态n1不赋予Castle HP/攻击事务资格，该接口仍由主线负责。
