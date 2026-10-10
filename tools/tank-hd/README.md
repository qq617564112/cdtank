# 坦克皮肤高清处理

素材来自 `art/original/tank-textures/role`，UV 来自运行模型的全部 mesh / primitive。坐标统一为归一化的 256×256 atlas，最终保留原模型的 UV。履带另行使用原有素材。

每车型维护 `output/tank-hd/<车型>/details.json`：非迷彩零件用栅格几何手绘，外缘使用 `uvTriangles` 对应的真实 UV 并集。孔槽、格栅、螺栓、铰链、把手、舱盖、接缝等按原图位置标注。彩绘和皮肤专属标志保留在底图。

处理顺序为 Bilinear 拉伸到 512×512、局部清除旧硬件、补底色、算法插值到 2048×2048、叠加透明细节层、UV 外补色、Lanczos 压缩到 1024×1024。透明细节层使用中性黑白明暗及独立硬件色，不携带默认皮肤迷彩；同车型的所有皮肤复用同一层。

```sh
python3 /workspace/cdtank/tools/tank-hd/process.py inspect 001 --output /tmp/tank-001-inspect
python3 /workspace/cdtank/tools/tank-hd/process.py render 001 --workspace <worktree>
```

`inspect` 输出 UV 图、三角形编号、候选连续轮廓、原图与各皮肤缩略图。`render` 从指定 worktree 读取细节定义，读取原工作区的原始素材，输出透明 PNG、清理掩码、代表皮肤 2048 合成、对照图以及全部最终贴图。运行 PNG 置于 `apps/web/public/tank-audit/hd/<车型>/`。
