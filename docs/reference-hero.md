# 银红蓝角色模型

根据 `nanobanana-preview-original-2026-10-07T03-03-04-732Z.png` 的正面、右侧、背面和 45° 俯视图，在 Babylon.js 9.29 中重建 T 字站姿角色。

## 查看

在仓库根目录启动现有前端开发服务：

```sh
npm run dev:web
```

打开 `http://localhost:5173/reference-hero.html`。页面提供正面、右侧、背面、45° 俯视、拖动旋转、滚轮与双指缩放、自动旋转、线框、深浅背景、原图放大、PNG 截图和 `.babylon` 模型导出。

画布获得焦点后，按 `1` 至 `4` 切换四个参考视角，按 `R` 恢复所选参考视角。

## 模型

入口为 `apps/web/src/models/reference-hero/model.ts` 中的 `createReferenceHero(scene)`，返回角色根节点、网格集合和尺寸信息。角色前方为 `-Z`，上方为 `+Y`，原点位于双脚之间的地面。

- 躯干、头盔、四肢和长靴使用按三视图比例定义的截面曲面，具有平滑法线和圆周 UV。
- 银色、红色和深蓝色花纹使用 1024 × 1024 颜色贴图和对应的金属度、粗糙度贴图。
- 金银双层胸饰、蓝绿宝石、额头饰片、乳白眼罩、嘴部凹槽、耳部嵌片和后背中缝为独立网格。
- 双手包含手掌、四指和拇指，模型保持对称 T 字站姿。
- `.babylon` 导出包含角色根节点、角色网格、UV、法线、材质及嵌入的贴图。

可以在已有 Babylon.js 场景中复用：

```ts
import {createReferenceHero} from './models/reference-hero/model';

const hero = createReferenceHero(scene);
hero.root.position.set(0, 0, 0);
hero.root.scaling.setAll(0.5);
```

PBR 金属材质需要场景环境光照。展示页使用本地 `studio.envmap`，通过 `CubeTexture.CreateFromPrefilteredData(url, scene, '.env')` 读取。该资源来自 [Babylon.js 官方资源库](https://assets.babylonjs.com/environments/studio.env)。

## 限制

参考图未标注真实尺寸，模型以 2.00 m 高度归一化，双臂跨度约 1.96 m。被遮挡部分及曲面深度根据三视图重建；当前交付为静态角色，不包含动画骨骼。尚未进行运行和视觉验收，像素级匹配程度未实测。
