# 模型渲染验证入口

类型5模型浏览器验证由 `tests/render/effect-model/index.html` 与 `main.ts` 承载。验证代码直接导入 `apps/web/src` 中的生产组件，使用 `recovery/output/web-assets` 中的原纹理、native 样本和生产源树资源。

`npm run render:model:dev` 在 `http://127.0.0.1:5204/` 启动独立 Vite root。配置允许访问仓库中的生产模块，资源目录使用绝对路径，不需要游戏服务端。

`npm run render:model:build` 将验证入口输出到 `dist/validation/effect-model`。正式 Web 构建入口为 `apps/web/index.html`，输出到 `dist/web`；模型验证使用独立配置与输出目录。

## 浏览器验证

启动独立 Chromium CDP 进程后执行：

```sh
npm run test:effects:model:browser -- <Chromium CDP WebSocket URL>
```

runner 默认访问 `http://127.0.0.1:5204/`，`CDTANK_RENDER_MODEL_URL` 可指定另一验证服务地址。CDP 地址由调用者供给。runner 创建并关闭自己的页面，记录 `recovery/output/browser-effect-model.json`。

原有断言覆盖 44 个 native 矩阵与顶点样本、RGB 最大误差不超过 2、三个生产模型源的可见像素，以及清理后的 mesh 残留为 0。source 激活属于诊断调用，`serverSkillTriggered=false`。

验证服务、Chromium 进程及 profile 由调用者关闭和清理。独立端口使用 Vite 5204、Chromium CDP 9257。

| 独立入口验证 | 结果 |
| --- | --- |
| 44 帧 native RGB 对照 | 最大误差 0，改变像素 4283–4741 |
| 生产 source 91／1175／2827 | 改变像素 1230／13／174 |
| 模型清理 | mesh 残留 0 |
| 独立验证构建 | 3172 modules，输出 `dist/validation/effect-model` |
