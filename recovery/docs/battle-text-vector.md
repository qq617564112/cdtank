# 战斗伤害、回血、暴击与 Combo 原图绘制

`battle-text-vector-geometry.ts` 引用 Damage、Benefit、Critical、Combo 四套原静态
数字字体的0–9 PNG，以及原 `1_baojishuziditu`、`2_baojixianshidanwei` 的
TGA/DDS 发布标记区域，共44项原图路径与尺寸。原颜色、渐变、描边和字形直接
取发布图片。

```sh
python3 recovery/export_battle_text_vectors.py
```

`SceneCastleDamageTextRenderer` 为坦克、城堡、回血、暴击和 Combo 提供
`load/create/draw/release/dispose` 接口。原字符映射与18–25×28字形尺寸保持；
未映射正负号继续留空。暴击标记110×82、Combo 标记128×99；标记和数字按原
alphaIndex 0/1排序，处于世界之上、HUD 与模态页面之下。

原事件投影、本机 Y−100、相机深度缩放、每秒40的 Y 推进、0.5秒后淡出和1秒
释放由原记录队列驱动。Combo 数字46/17偏移和累计字宽居中保持。原图复用图片
解码缓存；记录释放移除图形，场景销毁移除覆盖层。

## 验证范围

完成原图引用、源尺寸及源码调用静态核对；未执行测试、浏览器验收、构建或类型检查。
