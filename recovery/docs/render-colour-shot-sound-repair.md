# 战车亮度、地图颜色与射击声音

战斗角色在地图加载完成后进入 `BattlePlayers.reconcile`。待机、移动与单次动作的 MV3 材质使用当前场景环境光；材质绑定重新读取当前环境，不保留已经清除或替换的地图灯光。原材质的 float32 环境光乘项、动画、贴图和透明度公式保持原路径。

全部地图的地形与普通场景模型、Castle、Hook 及战车 GLB 加载使用 `useSRGBBuffers=false`。原自定义 shader 直接按纹理颜色乘源材质或顶点颜色输出，不经过 glTF sRGB GPU 纹理的线性解码。仍使用 PBR 的模型由其材质完成颜色转换。原纹理文件、顶点颜色、UV 与原采样规则保持原值。

Type4 与二维 Shot 声音在战场资源加载阶段解码为 AudioBuffer，复用已有特效 AudioContext。声音触发直接创建 BufferSource 并开始单次播放；结束、停止、换局和场景释放保留各自声音句柄的生命周期。挂起期间的一次性声音丢弃，后续交互不补播。源 Type4 的请求次数、树内延迟及共享停止规则保持原路径。服务器接受射击后的约 400ms 查询延迟、`beforeShot` 动作和 `fire` 通知顺序保持原规则。

## 来源与精度范围

原地形 `geom_c1` 与 `geom_t_c1` 使用纹理乘 packed diffuse；原普通 MV3 使用 `globalAmbientRGB * properties[4:7] + emissive * properties[12:15]`。来源见 `scene-terrain02-material.md`、`mv3-normal-d3d-state-sol.md`。射击时序与声音身份见 `battle-non-ui-shots.md`、`audio-runtime.md` 与 `combat-shot.md`。

原地图配置 `Data/scn/<id>/<id>.ini` 提供 fog enable、start、end、density 与 RGB。角色 `.ctl` 的零记录分支及默认 toon 灯位置、纹理已有来源，见 `scene-actor-light-provider-gap.md`；完整选灯、显式 toon effect 安装和实际场景 ambient producer 尚未闭合。当前 `scene-environment.ts` 中的采用参数不代表全地图原客户端光照已经精确还原。

本次交付为代码修复。未运行测试、浏览器、构建或类型检查，未登记运行验收通过。
