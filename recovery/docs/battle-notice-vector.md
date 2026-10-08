# 战斗开局、Fight与胜负提示原图绘制

`battle-notice-vector-geometry.ts` 保存原 `game_main.xml` 的 Fight、模式爆花、五种
模式说明、各模式的两张标题图片，以及 `game_summary.xml` 的胜、负、平局，
共二十项原始 PNG 路径及尺寸。
原布局的 Image 属性决定图片引用，优先选择 DDS imageset 发布区域。

```sh
python3 recovery/export_battle_notice_vectors.py
```

开局图片由 `BattleHudVectorRenderer` 在屏幕覆盖层显示；原控件位置和
`HudSnapshot.introStage` 阶段保持：模式说明2秒、Fight 1秒。
爆花、模式说明及标题图片在同一 WebGL 覆盖层按背景、说明、标题的顺序绘制；标题沿用
原子控件相对父控件的位置与尺寸。DOM 控件保留阶段及可访问性绑定，图片由覆盖层显示。
`BattleNoticeArtwork` 保留模态结束页与结算页的布局及资源绑定，图片由统一 WebGL
绘制层显示；容器继续控制位置、透明度和缩放动画。所有图片载入复用解码缓存。

结算胜／负／平局保持232×87、281×86、346×86尺寸及700毫秒入场动画。
结束页复用213×153模式爆花；等待时长、账户回执、键盘门禁与淡入由既有逻辑控制。

## 验证范围

完成原图引用、源尺寸及源码调用静态核对；未执行测试、浏览器验收、构建或类型检查。
