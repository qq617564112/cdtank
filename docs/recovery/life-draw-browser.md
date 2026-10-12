# 原生命条正式网页验收

最终 `browser-life-draw-2026-10-04T00-32-24-924Z.json` PASS6，六张正式整页截图与独立 opaque/边界像素 PASS；索引为 `browser-life-draw-accepted.json`。

正式 React 生命条消费原 float32 比例、0.34/0.67 三段色、原进度图 RGB 和整数物理裁剪长度。`tests/browser-life-draw.mjs` 用独立两个账户、两个 CPU 的 mode1/map7 普通 Create/Join/Ready、普通 autopilot 驱动实际服务器战斗。账户装备数据使用已执行原 tank1/part0 属性，命中、死亡及复活全部来自普通战斗。

800×600 自然 HP 状态保存红、黄、绿实际整页截图。`tests/life-draw-pixels.py` 核截图中原 77/21 的 opaque 白点经过实际颜色乘法后的红/黄/绿结果，并核部分生命时裁剪边界内一像素为原选择颜色、外一像素为实际背景。满血红队竖条原 77/105 的非白 opaque 点 (5,1)=(255,4,8) 在真实页面保持原 RGB。77/21 的 14 个非白边缘点仅 B 通道变化，三种源色 B 均为零，不能用于区分完整 RGB 乘法和单色 mask 的可见差异；竖条非白点提供实际区别。

800×600、1920×1080、3840×2160 等待实际源 HUD resize，然后核本地与两队竖条真实 HP/maxHp、原颜色和正确队伍图片、平铺尺寸及物理 clip extent，并保存整页 PNG。像素颜色证据来自自然 800×600 三状态，大尺寸截图验收实际几何与绘制，没有在每个分辨率穷举全部 HP 状态。HUD pointer-events 保持 none；普通 autopilot 与最后 Leave 验证 Web 操作仍可用。

实际网络记录保存双方 RoomEvent hit/destroy/respawn；本地玩家自然死亡后满 HP 复活的观察序列证明同一正式消费者恢复。两页普通 Leave 后 world 清空、HUD 隐藏、观察时钟清理。独立服务3286、Vite5316、Chromium9516和临时账户目录由 runner 清理。软件 3D 渲染使用内部 hardwareScaling6，UI 视口保持原尺寸。

## 限制

此片证明源生命图、普通权威 HP、真实原色与裁剪在正式网页闭环可见；没有 Windows/GPU framebuffer 等价或大分辨率 3D 性能结论。原 phase 显隐来源、完整 HUD 字体和其余 UI 父项保持独立缺口。历史未通过结果保留，验收索引只引用最终 PASS。

集成检查：root独立实际HP/三色/死亡复活/三分辨率及PNG复核见`life-draw-root-verifier.json`、`life-draw-root-pixels-final.json`；32ratio/108draw规则对照为`life-progress-rules.log`。独立Web类型`life-draw-web-types.log`、唯一生产构建`life-draw-web-build.log`（1m41s）及313模块运行边界`life-draw-boundaries.log`全部通过；无服务端或账户改动，已有CPU两局和保存证据复用。
