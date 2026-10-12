# 零伤害提示

角色受击文字格式化后的整数为 0 时，显示“闪避”图片。普通和暴击的零值都进入普通伤害文字队列，沿用数字的世界位置、缩放、飘动和淡出。非零值继续使用对应的 Damage 或 Critical 数字字体。

`TankDamageTextRenderer` 提供零值图片；`SceneCastleDamageTextRenderer.create` 仅在整段文字为 `0` 时选择它，`10`、`100` 等数字中的零仍使用数字字形。

| 文件 | 用途 |
| --- | --- |
| `art/hd/ui/battle/dodge.png` | 透明底 HD 原图，1262×675 |
| `art/compressed/ui/battle/dodge.webp` | 压缩成品，209×112 |
| `apps/web/public/ui/battle/dodge.webp` | 当前运行图片 |

字样以现有 Damage 数字为生图 API 参考，采用亮黄色渐变、深棕描边、左上高光和右倾字形。显示高度使用 Damage 字体的原生 28 像素；压缩配方按 UI 四倍显示密度处理，保持宽高比例，使用 near80 并保留 Alpha。该图片属于 UI，怀旧／HD战斗素材切换共用它。

配方位于 `scripts/asset_compression/recipe.json`。重建单图使用 `npm run assets:compressed -- --image ui/battle/dodge.webp`；完整 UI 发布使用 `npm run assets:sprites`，将该图片纳入图集并保持原 URL 引用。

编码器已核对最终尺寸与 Alpha，RGB 每通道最大变化为 1/255。游戏内视觉表现尚未验收。
