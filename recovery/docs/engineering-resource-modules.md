# 共用场景与战车资源职责

正式地图载入与原破坏表现归assets/scenes的scene-preview、scene-breach-state；战车实例/动作/挂点资源与拥有迷彩归assets/tanks的tank-view、tank-textures；MV3原材质与shader归render/materials/mv3-material。源实现、导出合同、资源URL、缓存和清理逻辑保持，旧平铺入口删除。

Battle、BattlePlayers、技能/通用效果、我的家战车预览/迷彩、首页战车目录引用同一生产实现。tools/asset-viewer直接使用正式ScenePreview与材质；五个既有渲染诊断入口直接使用正式TankView。CTS、浏览器源码URL、原时钟@fs入口和性能采样发现路径同步迁移，没有为诊断复制生产资源代码或建立旧路径别名。

## 验收入口

- `test:scene:objects`：1144原Breach数据、原破坏/渐隐严格边界、156原执行状态、25图2235记录/矩阵与城堡和碰撞记录。
- `test:assets:mv3-material`：3264原材质/flag渲染参数和实际MV3 ambient合同。
- `tests/browser-scenes.mjs <CDP> [工具origin]`：三地图原矩阵、旋转及实际顶点对照；不将它当纹理像素证明。
- `tests/browser-mv3-material-sol.mjs <CDP> [正式origin]`：实际LINEAR/WRAP采样、颜色/透明/position morph像素。
- `tests/browser-owned-tank-textures.mjs <CDP> [正式origin]`：两种真实拥有迷彩/组件URL、原shader/动作、实例隔离和资源释放。GLB载入会创建场景共用BRDF，夹具先用真实PBRMaterial建立场景基线并保存BRDF身份，再严格检查战车释放后的数量与纹理对象身份；场景共用资源由scene.dispose释放。
- `test:tanks:actor-clock:browser`：原delta与12动作/60组件tick逐时钟、正常生产TankView帧入口及长帧/通知/释放。
- `tests/browser-life.mjs <CDP> [正式origin]`：实际原死亡动作/复活、晚到战车/地图释放、提交顺序与退出隔离。
- 正常CPU资源失败重试/地图战车准备/运动返回；装备1080p/4K操作/拒绝/隔离/刷新重启；双网页不同迷彩与本人托管自然两局、冻结结算/再战、原Effect11/GA15及音频释放、账户服务重启保存重进；编译账户联机与CPU五模式各两局。
- 全仓类型、正式运行依赖、Web/tool独立构建、七渲染入口构建与玩家资源夹具。

证据在engineering-resource-modules-{objects,material-source,scenes,material,textures,clock,life,cpu,equipment,two-rounds,compiled,types,boundaries,build,tool-build,render-builds}.log。以上命令全部退出0，211正式可达模块边界通过。正式Web构建2分56秒、工具构建2分54秒完成，七个独立渲染构建全部通过；它们证明入口构建，实际像素证据来自所列地图/材质/迷彩浏览器夹具。双网页两局自然结束约78秒与103秒，服务重启正常重进通过。构建主包体积提示仍在，性能按M7-02继续验收。

## 范围

资源模块组织和迁移验收不证明所有原资产/动画/材质/皮肤/场景物件或高清实战完成。三地图矩阵、选定迷彩实际像素、原时钟与动作、原地图破坏生命周期各自保留其范围；双网页缩小画布不证明高清全内容性能。后续E-03继续归拢效果/技能、音频与目标表现，原完整恢复仍按M项推进。
