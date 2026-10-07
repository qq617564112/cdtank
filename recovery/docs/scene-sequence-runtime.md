# obj05023 Sequence运行时合同

本文记录0008/0013四条`SYcScnObjSequence`放置的当前普通生产接口、资源、生命周期与边界。
原来源事实保留在[scene-sequence05023-source.md](scene-sequence05023-source.md)，本文不把
Web采用时钟、metadata出版状态或尚未执行的页面实测写成原Windows等价。

## 范围

- `0008`：`sourcePlacementId` `446`、`447`。
- `0013`：`sourcePlacementId` `204`、`205`。
- 四条放置的`className`均为`SYcScnObjSequence`，`model`均为`obj05023`，原`enabled`
  均为`1`。
- 0008与0013不同时加载；当前各图支持mode仍以[tasklist.md](tasklist.md)的
  `MAP-EXT-*`为准，本功能不增加或删除模式组合。

## Producer与JSON

Producer为`recovery/export_scene_sequence05023.py`，由`recovery/export_scenes.py`
按现有导出入口调用。输出固定为：

`recovery/output/web-assets/scene-sequence05023.json`

JSON顶层接口：

```ts
interface SceneSequenceLibrary {
  schemaVersion: 1;
  className: 'SYcScnObjSequence';
  model: 'obj05023';
  source: {
    vtable: '0x5c77e0';
    loader: '0x460bcd';
    update: '0x45f298';
    screenNodes: '0x44ef5e';
    textureAssign: '0x5c09b8';
  };
  base: {
    reference: 'Data/scnobj/obj05023/obj05023.POL';
    asset: 'Data/scnobj/obj05023/obj05023.glb';
    texture: 'Data/scnobj/obj05023/obj05023.png';
  };
  screen: {
    reference: 'Data/scnobj/obj05023/scr.POL';
    asset: 'Data/scnobj/obj05023/scr.glb';
  };
  frames: { reference: string; asset: string }[];
  delay: {
    sourceValue: 100;
    sourceMultiplierF32: number;
    seconds: number;
  };
  placements: {
    mapId: '0008' | '0013';
    sourcePlacementId: string;
  }[];
}
```

`frames`固定按原`001.dds`至`004.dds`顺序对应
`Data/scnobj/obj05023/001.png`至`004.png`。`delay.seconds`为原INI整数100乘原
f32 `0.0010000000474974513`。`placements`只登记上述四条精确
`(mapId, sourcePlacementId)`，不以名称前缀或整目录匹配代替。

Producer不向`scene-placements.json`记录写`asset`、`animation`或其它伪造字段。
`export_scenes.py`只把四个精确放置键加入既有`resolved`判定；`enabled`不改变
`resolved`，四项不再计入“记录待接入”的M，且不新增server stats、RPC、协议或UI表单。

## 已发布资源

| 角色 | 原路径 | 已发布路径 |
| --- | --- | --- |
| 静态主体 | `Data/scnobj/obj05023/obj05023.POL` | `Data/scnobj/obj05023/obj05023.glb` |
| 静态主体纹理 | `Data/scnobj/obj05023/obj05023.dds` | `Data/scnobj/obj05023/obj05023.png` |
| screen模型 | `Data/scnobj/obj05023/scr.POL` | `Data/scnobj/obj05023/scr.glb` |
| 帧1 | `Data/scnobj/obj05023/001.dds` | `Data/scnobj/obj05023/001.png` |
| 帧2 | `Data/scnobj/obj05023/002.dds` | `Data/scnobj/obj05023/002.png` |
| 帧3 | `Data/scnobj/obj05023/003.dds` | `Data/scnobj/obj05023/003.png` |
| 帧4 | `Data/scnobj/obj05023/004.dds` | `Data/scnobj/obj05023/004.png` |

上述普通GLB/PNG复用既有出版物，不另造纹理、材质或音频。`obj05023.POL`与`scr.POL`
仍是静态主体与screen模型两个角色；不能按名称合并成同一GLB，也不能只加载screen。

## 消费接口

Shared类型位于`apps/shared/maps/scene-sequence.ts`，只定义JSON类型，不加载资源、不持有
场景、不执行动画。运行时`apps/web/src/assets/scenes/scene-sequence.ts`的`SceneSequence`
只暴露：

```ts
load(mapId: '0008' | '0013', placements: readonly SourceSequencePlacement[]): Promise<void>;
advance(deltaSeconds: number): void;
clear(): void;
```

`SourceSequencePlacement`是`scene-placements.json`当前`Placement`的精确子集：
`id`、`className`、`model`、`position`、`rotation`、`matrix`、`enabled`。消费者从
`/scene-sequence05023.json`的`placements`筛选当前`mapId`记录，并按
`sourcePlacementId === placement.id`关联；不从JSON复制`position`、`rotation`、
`matrix`或`enabled`。

`apps/web/src/assets/scenes/scene-preview.ts`只在0008/0013且存在精确Sequence键时接入：
新增`private sequence?: SceneSequence`，在异步`load()`前登记，`advance()`转交当前
Sequence，`clear()`调用并置空。该接入不改Castle、Breach、Plant、Crush、Water、
terrain或CVD分支。

## 放置与矩阵

每个放置创建一个`TransformNode`；base与screen容器都挂在同一root：

- `root.position = (-position[0], position[1], position[2])`。
- `matrix`经`Matrix.FromArray(...).decompose()`后只取scale。
- rotation设为`Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w)`。
- `matrix`的translation是原转换后的bounds center，不叠加到root；`position`保持几何
  原点。
- screen不添加未恢复的局部偏移、socket或挂点猜测。

base与screen各加载一次，并分别为当前map的每个放置实例化。`base.texture`只登记原静态
主体纹理，不当作帧纹理。

## 播放与时钟

- 初始帧索引为0，加载完成后先赋`frames[0]`。
- Web运行时采用`performance.now()/1000`单调秒时钟；不使用网络时间，也不把传入
  `deltaSeconds`当作原计时器。
- `advance()`仅在elapsed严格大于`delay.seconds`时把计时起点重置到当前时刻、索引加1，
  并在4处回零。一次调用最多前进一帧，不补漏帧。
- 当前帧纹理赋给screen容器所有现有screen mesh的已有基础色纹理槽。不得创建新材质，
  不推断alpha、blend、unlit、shader、挂点、声音或碰撞语义。
- 若screen GLB没有可复用的既有纹理槽，沿`load()`错误路径失败，不做材质替身。

## 生命周期

- 普通加载经`loadStaticJson('/scene-sequence05023.json')`复用现有`static-resources.ts`
  request/parse cache；本功能不拥有或修改该文件，不新建资源缓存。
- 新Sequence在第一个异步请求前登记到`ScenePreview.sequence`。每个`await`后检查
  disposed与`ScenePreview.revision`；晚完成的container、texture、instance或root由
  Sequence自身dispose。
- screen实例克隆的既有原基色纹理在首次换帧前登记owner，正常clear与失败清理释放；
  base container与源container纹理保持原owner。
- `load()`失败且revision仍为当前世代时，沿现有`ScenePreview.load()`错误路径清理并重新
  抛出；revision已失效时，自身dispose后不覆盖当前场景。
- `clear()`设置disposed，释放base/screen container、四帧texture、全部实例与root，
  清空索引；重复调用保持幂等。
- `enabled=false`的原记录仍先完整加载并登记资源所有权，只影响root可见性，不跳过清理。

## 当前实现与出版状态

- 唯一producer、`export_scenes.py`的四条精确`resolved`扩展，以及
  `apps/shared/maps/scene-sequence.ts`纯JSON类型已接入。
- `apps/web/src/assets/scenes/scene-sequence.ts`运行时与`scene-preview.ts`的
  load/advance/clear接口已接入。
- base、screen与`001–004`普通GLB/PNG为已出版资源，直接复用。
- `scene-sequence05023.json`的producer代码尚未执行，metadata尚未出版；因此不能声称
  实际页面资源已可加载、可见或完成普通运行验收。
- 本批最终范围已完成一次集中静态走查，不代替实际页面、双端、高清或原来源验收。

## Hook与WaterFall

`SYcScnObjHook`与`SYcScnObjWaterFall`仍有原精确placement和源资源，但缺原
loader/update/draw、时序、节点赋值、挂点、材质或循环事实。本范围不实现、不按名称造
Gate/Switch、不补材质或挂点，也不把0016 WaterFall当作0002 `SceneWater`替名。0002
`SceneWater`已完成，本范围不追加其验收或改动。

## Limitations

- `scene-sequence05023.json`未在producer实际执行中出版，实际页面加载、可见性与
  `resolved`后的普通运行尚未实测。
- 原Windows性能计数器provider、单位与首帧时刻未恢复；`performance.now()`是明确Web
  采用时钟，不声明原Windows等价。
- 四放置逐项像素、双端phase、1920/3840高清、GPU材质精度、原性能特征及完整场景运行
  未验。
- 原screen模型初始材质赋值、额外shader/混合/挂点/声音/碰撞语义未从来源恢复，本范围
  不推断。
- Hook/WaterFall的原loader/update/draw与placement行为合同仍开放。
