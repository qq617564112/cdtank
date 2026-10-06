# 战斗坦克环境光

M3-03-L。正式Web场景设置scene.ambientColor=[1,1,1]，MV3 ShaderMaterial使用当前场景环境光乘源diffuse与贴图。场景未设置环境光时仍使用原初始化0.2，mv3Ambient原float32计算不变；材质metadata记录实际ambient。地图POL/CVD材料、贴图、UV、法线、动画、混合和剔除保持既有路径。

初始0.2环境光乘贴图导致坦克接近黑色，Babylon的HemisphericLight不进入该自定义shader。原gbengine的SetAmbientLight导出100033b0复制RGBA到GfxManager+1a8；CDTank还存在角色SetLight调用：46a571/46a580/46a58f和46da60/46da6f/46da7e/46da8d给组件传mode1、方向和纹理。gbengine100099b0保存到actor+94/+98/+a4，10009f80在已选效果条件下提交lightdir和texToon。因此初始无selected lights样本不能证明完整战斗场景的光照。

## 验收

node tests/browser-tank-daylight.mjs：隔离Vite5298/Chrome9368，正式main模块的scene ambient1，原0007地图和实际TankView1；同镜头/同姿态分别经正式加载路径使用0.2与1，1920×1080真实帧缓冲对照。25997像素发生变化且全部变亮；平均RGB亮度15.725→74.238。8个实际动作材质均有源贴图和ambient1；地图和相机不变。截图tank-daylight-before.png、tank-daylight-after.png及对比tank-daylight-comparison.png，数据tank-daylight-browser.json。静态渲染夹具不声明联机或对局验收。

原材质颜色/透明阈值100与101/LINEAR-WRAP双线性及循环/UV/morph/cull真实像素基线通过（tank-daylight-source-pixels.log）。全仓TypeScript通过（tank-daylight-types.log）；Web正式Vite配置隔离输出至/tmp/cdtank-lighting-dist的发行构建通过（tank-daylight-web-build.log）。未运行无相关规则改动的账户重启、CPU比赛或网络回归。

## 未完成来源

白色日光曝光是为修正当前过暗而采用的重建场景设置。尚未恢复原场景选灯、方向计算/texToon、完整shader选择与原D3D framebuffer，不把亮度修正标为精确原光照。后续依据登记M3-03/M4-07，本次不扩大到所有场景或全部光照取证。
