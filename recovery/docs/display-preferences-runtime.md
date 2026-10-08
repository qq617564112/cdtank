# 显示设置运行时

原 `Config/SystemSetting.ini` 的 `[Display]` 记录 `HighPrecision=1`、`Silhouette=1`。原设置界面的 `rdoLow`、`rdoHigh`、`chkSilhouette` 对应低画质、高画质和卡通描边三个真实控件。原 `cartoon.gbf` 的黑色法线外扩与 `Ink0.65` 已由 `cartoon-outline.md` 记录并复用现有 Babylon `Mesh.renderOutline` 入口。

本批把这些控件接到 Web 侧显示偏好。高画质保持 `Engine(canvas, true, {}, true)` 的设备像素比后备缓冲比例；低画质在相同 CSS 视口和当前 `devicePixelRatio` 下使用一半宽高，即硬件缩放值为高画质的两倍。比例使用浏览器真实 `window.devicePixelRatio || 1`，不设 DPR 下限。切换会立即更新当前 engine 并 `resize`，后续窗口尺寸或 DPR 变化继续按当前选档计算，不写固定硬件缩放值。

`display-preferences.ts` 提供唯一公开存储与内存合同：

```ts
export interface DisplayPreferences {
  highPrecision: boolean;
  silhouette: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: Readonly<DisplayPreferences>;
export const DISPLAY_PREFERENCES_STORAGE_KEY = 'cdtank.display-settings.v1';
export function validateDisplayPreferences(value: unknown): DisplayPreferences | undefined;
export function readDisplayPreferences(storage: Pick<Storage, 'getItem'>):
  {preferences: DisplayPreferences; storageAvailable: boolean; loadMessage: string};
export function writeDisplayPreferences(storage: Pick<Storage, 'setItem'>,
  preferences: DisplayPreferences): boolean;
export function getDisplayPreferences(): Readonly<DisplayPreferences>;
export function applyDisplayPreferences(preferences: DisplayPreferences): void;
export function subscribeDisplayPreferences(listener: () => void): () => void;
```

无保存时恢复默认 `highPrecision=true`、`silhouette=true`；坏 JSON 或非法布尔恢复默认并给出损坏提示；读取失败给出不可读提示。写入只接受两个完整布尔并返回是否保存成功，不自动改变 active 内存。`applyDisplayPreferences` 只更新 active 并通知订阅者，不写 storage。

`initializeSettings` 保持原签名，在恢复键位、快捷聊天和音量时读取显示偏好并应用到 active，返回值新增 `display`，供 `InitialSettings` 消费者使用。

`scene-runtime` 读取 active 偏好并订阅变化。高画质缩放为 `1 / currentDPR`，低画质为 `2 / currentDPR`；窗口 resize 后重新应用同一比例。`start-game` 中的 runtime、battle 和 settings 初始化仍在同一个同步调用链内完成，第一帧渲染前 active 已恢复。

`cartoon-outline` 修改已注册合格 `Mesh` 的 `renderOutline`、`outlineWidth=0.65` 和黑色 `outlineColor`。实际 source mesh 只注册一次，`InstancedMesh` 沿用 source；已注册 source 通过 `onClonedObservable` 将实际生成且仍符合资格的克隆 Mesh 纳入同一注册表，不新增 Mesh/Material、不复制 geometry，也不逐帧扫描 scene。alpha 混合和 planar alpha-test 排除规则、地形不调用入口的边界保持不变。mesh 或 scene dispose 会解绑自身 observer、clone observer 与 scene observer，并释放注册引用；偏好监听在最后一个注册释放后解除。已有模型、实际 clone、后续动作和异步新增对象都读取当前 active 值。

Type8 屏幕 overlay 的 `EffectOverlayDrawState` 增加尺寸更新，绘制时读取实际 engine 后备缓冲宽高。UV retention、颜色打包、float32 尺寸和原 native vertex 顺序保持不变，不重新创建材质或纹理。

## 范围

原完整 D3D 高精度 producer 未恢复；本批高低画质是明确的 Web engine 后备缓冲策略。silhouette 复用已采用的 Web 轮廓入口，不把该入口扩展声明为完整原 `cartoon.gbf` 逐设备状态恢复。未运行测试、浏览器、构建或类型检查，也未做高清性能验收。

同一silhouette偏好同时控制原25图TankView组件的原toon采样，方向来自默认灯[0,200,0]与统一角色中心；已加载和后续动作绑定时读取当前值，资源由ScenePreview图级owner释放，详scene-actor-toon-runtime.md。
