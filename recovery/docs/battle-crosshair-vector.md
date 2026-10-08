# 战斗准星原图绘制

`battle-crosshair-geometry.ts` 引用原77/47、77/48的50×37 PNG，灰色背景与黄色
前景由 `BattleCrosshairRenderer` 独立绘制。原图片的颜色、透明边缘和轮廓直接使用。

```sh
python3 recovery/export_battle_hud_vectors.py
```

原基准位置373,234、窗口 Alpha 0.6和黄色自下向上揭示保持。AutoScaled 尺寸
按 float32 缩放后取整，裁剪边界采用 `trunc(height × progress + 0.5)`。
装填进度取服务端 `reload.remaining` 与服务器时钟投影，使用项目冷却时长，视觉
延迟为0。DOM 保留装填进度与可访问属性；死亡、加载、换局、断线和离场清理沿
既有生命周期执行，场景销毁移除覆盖层。

## 验证范围

完成原图引用、源尺寸及源码调用静态核对；未执行测试、浏览器验收、构建或类型检查。
