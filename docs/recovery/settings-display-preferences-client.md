# 设置页显示偏好

系统设置保留窗口/全屏、FPS显示、卡通描边、抗锯齿，以及独立的怀旧/HD战斗素材选项。FPS显示位于卡通描边上方。右栏提供音乐音量、音效音量、亮度、饱和度、对比度和渲染分辨率六个滑动条。

## 原字段

`CDTank/Config/SystemSetting.ini` 的 `[Display]` 记录 `HighPrecision = 1`、`Silhouette = 1`。`settings.xml` 中 `rdoLow` 与 `rdoHigh` 是 `GroupID=2` 的 RadioButton，`rdoHigh` 对应 HighPrecision；`chkSilhouette` 是独立 Checkbox。

原 `Silhouette` INI→manager布尔→Render效果选择的静态来源见 `scene-actor-toon-runtime.md`。原 Windows 完整界面回调、HighPrecision含义与D3D framebuffer仍开放。Web 的显示参数按当前界面定义，原字段不作为新参数的原生实现证据。

## Web 合同

`apps/web/src/interface/settings/display-preferences.ts` 的持久类型为：

```ts
export interface DisplayPreferences {
  renderScale: .25 | .5 | 1 | 1.5 | 2;
  silhouette: boolean;
  msaa4x: boolean;
  showFps: boolean;
}
```

默认值为 `{renderScale: 1, silhouette: true, msaa4x: false, showFps: false}`，沿用存储键 `cdtank.display-settings.v1`。既有保存仅有 `highPrecision` 时，false对应0.5档，其余对应1档；缺少MSAA或FPS字段时默认关闭。非法新字段恢复默认显示设置，并保留不可读或损坏存储的反馈。本机浏览器偏好不进入账户、服务器或网络协议。

`startGame` 在创建WebGPU引擎前恢复显示偏好，之后由 `initializeSettings` 继续恢复键位、快捷聊天、音量、亮度、饱和度、对比度和战斗素材偏好。设置页每次打开持有独立草稿；所有控件只修改草稿，恢复默认也只还原草稿。点击确认后才应用窗口/全屏并逐项保存、应用其余设置；取消、关闭和Escape丢弃未确认草稿，再次打开读取最后确认值。全屏切换等待期间禁用编辑及关闭按钮；切换失败保留面板并提示重试。显示范围保存成功即应用渲染分辨率、FPS显示、卡通描边及MSAA。点击确认时，已保存MSAA与本会话初始引擎配置不同，或已保存战斗素材画质发生变化，直接执行页面刷新。若素材保存失败而MSAA已经成功保存且改变，仍立即刷新以应用MSAA；其它保存失败保留面板并提示重试，已经成功的范围保持生效。

FPS显示默认关闭，确认后在页面右上角显示原生帧循环的每秒帧数，每秒更新一次，刷新后恢复已保存的开关值。读数共用现有帧计数采样，不增加计时器或GPU回读，不随3D渲染倍率缩放；运行时释放时移除读数并解绑显示偏好订阅。

## 战斗3D分辨率

渲染分辨率为五档 `.25 / .5 / 1 / 1.5 / 2`，倍率同时作用于3D目标的宽、高。原生DPR画布尺寸、CSS视口和浏览器界面不随倍率改变。

`scene-runtime.ts` 只为战斗场景相机附加 `PassPostProcess`，其输入目标按倍率分配，世界3D绘制完成后以双线性采样合成回原生帧缓冲。倍率更改时释放旧pass并建立新pass，窗口resize由引擎和pass重新分配目标；scene dispose沿相机释放pass和纹理。主渲染顺序为世界3D、原生尺寸的玩家名字/小地图utility layers、主战斗HUD。utility layers关闭postprocess，设置页、大厅、模型预览和战斗UI保持原有分辨率。独立预览使用自己的引擎和相机，不读取战斗渲染倍率。

Type8与legacy屏幕特效仍用原生画布尺寸定义顶点和viewport，NDC覆盖范围不随目标倍率改变；作为世界场景特效进入3D目标。玩家HUD与文字走独立utility layer，在合成之后绘制。

## 4× MSAA与卡通描边

抗锯齿默认关闭。选中并确认后，WebGPU引擎以 `antialias: true` 创建4样本主帧缓冲；战斗世界pass的 `samples` 同时设为4，关闭时为1。重新载入后从已保存偏好创建主引擎及模型预览引擎。

卡通描边调整已注册合格Mesh的 `renderOutline`，保持黑色RGB、Ink 0.65、InstancedMesh source、动画、morph、alpha混合与planar alpha-test排除规则，地形不描边。已加载模型、实际克隆及异步新增模型读取当前active值；Mesh/Scene dispose释放注册和clone observer。模型toon光照按图级资格独立应用，卡通描边只控制轮廓。

## 源界面与图标

页面保留800×599根、原顶部与底部按钮，左栏保留键位设置。右上显示选项，右下六个滑动条替代原F5–F12编辑区；原保存快捷聊天仍由启动设置读取。滑动条支持指针、方向键和Home/End，分辨率按整数索引选档。图标内文字表示调节项，轨道旁显示当前数值。

亮度柴犬头、饱和度哈士奇头、对比度猫头和渲染分辨率猫头通过生图API使用现音乐猫作为画风及文字样式参考；图标带黄字粗黑描边中文，不带身体、爪子或道具。发布文件在 `apps/web/public/ui/settings/`。

## 验证范围

本批仅静态走查，未运行tests、browser、build、typecheck、native或高清实测。新布局、FPS显示、五档分辨率、MSAA、对比度及确认刷新表现未纳入既有实测证据。原0007/战车1轮廓、角色toon来源与历史设置页面证据保持各自范围，M5-14、UI-50、M3-03、M4-07与M7父项保持未完成。
