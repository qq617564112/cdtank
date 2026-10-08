# 地图物件放置记录

`recovery/scene.py`解析原包内25个 `Data/scn/NNNN/NNNN.obj`。全部读取至文件尾，共2235条，数量与各文件u32声明一致。分类为Breach 1144、Plant 919、Sound 73、General 46、Effect 31、Crush 16、Sequence 4、Hook 1、WaterFall 1。

## 字段结构

文件头u32 count；每条记录依次为u32 kind、长度前缀GBK className、u32 stamp、长度前缀ID、长度前缀model、3×f32 position、u8标志、3×f32 rotation、16×f32矩阵、3×f32字段、分类尾部。所有长度为u32LE，数字为小端。

已观察到的分类尾部字节数：Plant/Crush 30，Sound 35，Breach/General/Sequence/WaterFall 26，Effect/Hook 42。原字节保存为hex；stamp、标志、末尾3个float及分类尾部的业务含义仍待反汇编确认。字段名bounds目前仅作为记录名称，不用于碰撞。

矩阵示例：田野路首条 `obj05425` 为单位旋转与平移(-1547.8717,24.38693,797.0954)，独立position为(-1548.3126,0,796.8494)。POL模型包围盒中心为(0.4408646,24.3869324,0.245956)，矩阵平移等于position加旋转后的中心。查看器采用独立position作为几何原点，并保留矩阵的旋转/缩放。对2113条匹配记录的整体顶点包围盒中心核对，2067条误差小于0.01，其余46条最大误差0.152原始单位；多网格/资源选择行为仍需确认。

记录边界由25个文件中className长度、下一条className位置、声明数量和文件尾交叉确认；`tests/scene-placements.py`逐条对照源矩阵并确认对应GLB存在。原EXE注册字符串 `SYcScnObjBreach` VA 0x5c7050，引用包括0x45b896、0x45f858和0x5bde2e；场景载入分类链附近0x45b850调用0x45897c，再调用0x45b3ea。当前记录布局来自本地完整样本，完整序列化器行为仍需追踪。

## 地图组合查看

`recovery/export_scenes.py`生成 `scene-placements.json`。原25图2235条OBJ与22座Castle中，2135条有静态asset，12条有CVD animation，4条Sequence有精确普通入口，Hook/WaterFall各1条有special，共2153条可见物件已绑定。73条Sound与31条Effect由独立地图owner及各图metadata消费，未计入resolved不代表未接。转换清单保留全部原记录。25张地图均有基础地形入口；十二图1814个原地形分片材质metadata已发布并由SceneTerrainMaterial消费，见battle-remaining-integration.md P。

`apps/web/src/assets/scenes/scene-preview.ts`按资产缓存载入和实例化物件，采用几何原点及矩阵旋转/缩放，并对放置变换作X轴反射以匹配Babylon glTF AUTO导入空间。导入器源码 `glTFLoader.pure.js::_createRootNode` 设置Y轴半圈旋转及Z轴负缩放，合成结果反射X。田野路0002既有截图显示89个静态物件及2座城堡；4条声音现由MapEnvironmentSound消费，截图 `recovery/output/scene-0002.png` 不证明当前全部声音或表现验收。

## 已知限制

正式ScenePreview已有独立CVD动画、Castle动作/状态消费者、Breach几何切换、Crush原051消费、水面及Plant摆动owner；声音与常驻Effect由对应地图owner管理。各模块只在具名来源充分的原地图/原对象范围接线，具体资格、普通玩家证据与未完成范围以 [tasklist](tasklist.md) 为准。资源或owner存在不代表全部放置可见或玩法许可恢复。

可见物件绑定与分类消费者已齐；完整GPU材质/过滤/CW精度、全部逐实例像素与高清多人性能仍未完成。Sequence、Hook及WaterFall所在地图已有正式入口，消费者与metadata已接；普通表现与完整来源边界见scene-sequence-runtime.md、scene-hook-waterfall-runtime.md。Plant当前原25图919条均有图级metadata，401条原合法放置的旧数据证据仍按scene-plant-legal-data-coverage.json限定范围使用；八图新增518株发布见extended-scene-resources-runtime.md。map04普通双端自然摆动有限通过，map05首验保留客端持续可见性缺口。

原几何和放置源矩阵验证不替代服务端碰撞/伤害授权。Castle、Breach及Crush的正式状态与事务由主线管理，地图模块负责原模型映射和视图owner清理。联机地图接入及静态碰撞验证见 [原地图运行说明](battlefield-runtime.md)。

## 浏览器坐标验证

`tests/browser-scenes.mjs`载入0002、0001、0010，用Babylon实际世界矩阵变换每个静态物件顶点，再独立计算源记录position加源矩阵线性部分作用于模型顶点的结果，并反射X。共184个实例、47,502顶点；最大坐标误差0.0000037原始单位，包含68个非零旋转记录。相机以地面为目标、保留轨道设置并从上方查看；截图等待场景就绪后采集。结果保存到 `recovery/output/scene-browser-verification.json`，0002截图保存到 `recovery/output/scene-0002.png`。这验证渲染放置变换，不证明原版碰撞及玩法已还原。

## 城堡与虚拟盒体

25份.cas包含22条SYcCastle记录，25份.box包含2058条SYcVirtualBox记录。它们复用.obj的记录头；城堡尾部12字节为3个u32，虚拟盒体尾部80字节为u32标记、16个f32局部矩阵和3个f32尺寸。全部文件按声明数量读取至EOF。2058条盒体的尾部尺寸与记录头末尾3个f32逐项相等。局部矩阵通常向Y轴平移半个高度；原矩阵组合和碰撞查询逻辑仍待核对。

导出清单增加castles和collisionBoxes，保留全部源字节。22座城堡按原INI的action_1引用现有MV3转换资产，共2135条可显示模型引用。obj05449的action_1为c2，另外三种城堡为c1。城堡尾部后两项常见2000与1/2，尚不作为已确认的血量及队伍规则。`tests/scene-placements.py`验证全部.cas/.box记录、盒体矩阵/尺寸原字节和城堡GLB引用。这些盒体已参与服务端移动/弹丸扫掠；原导航及动态行为仍待还原。
