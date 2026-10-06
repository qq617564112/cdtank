# 原战斗第三人称相机（M2-CAM）

正式对局读取现存原资源 Config/ClientRender.ini 的 ThirdPersonCamera 参数合同：distance174、altitude0.17056541弧度、azimuth0、lookat_offset[0,35,60]、水平FOV60°，near10/far5000。生产规则位于 apps/web/src/render/battle-camera.ts，正式Battle入场清除Babylon镜头输入，每帧由BattlePlayers使用实际渲染角色位置和车身朝向跟随。鼠标拖拽/滚轮、上下方向键不改变镜头；左右方向键发送普通aim输入，Q/E不再瞄准。大厅按键提示及使用旧按键的六个浏览器对局验收同步更新。

来源：解包原配置 recovery/output/verified/assets/data/config/ClientRender.ini；初始化45654d取七项配置，455859写FOV，457189建立轨道；456674从绑定actor virtual+14读取朝向、virtual+1c读取位置，旋转目标偏移，以朝向+180°建立眼点及up，再提交完整eye/target/right/up。actor468b23读取+bc角度，46903d–469100从车体forward求acos、按X符号选角，再乘原度数常量；不读取炮塔瞄准角。原角度转换使用0.01745，保留180°时微小非零X，不人为对齐轴线。

gbengine.dll 1002c430用FOV半角求近平面半宽，再按height/width求半高，因此采用Babylon水平FOV固定，不能采用默认垂直FOV。455ef1初始化near10/far5000并执行真实gbCamera尺寸/绑定。

验证命令：

- recovery/.venv/bin/python recovery/evidence/camera/battle-camera-native.py：完整原45654d配置组装（INI服务供应原资源值）、456674更新、原getter与旋转/归一化、455ef1绑定，12姿态、5车体朝向及四分辨率原投影，battle-camera-native.json。
- npx tsx tests/battle-camera.cts：12原姿态最大绝对误差0.00000762939453125，原actor方向转换、四分辨率Babylon投影、无镜头输入、原裁剪面、新局姿态恢复、抖动改变/恢复，battle-camera-rules.log。
- node --import tsx tests/browser-battle-camera.mjs：隔离3149/5199/9273，正常建房/准备，真实键盘左右转炮塔、W/D移动转向，鼠标/滚轮/上下/QE无镜头或炮塔作用，1080p/4K实际画面、退出/重入，battle-camera-browser.json及截图。另调用明确抖动诊断和browser-battle-input回归。
- 全仓typecheck（battle-camera-all-types.log）、客户端typecheck（battle-camera-types.log）、正式Web隔离产物构建（battle-camera-build.log，/tmp/cdtank-camera-web-build）、234模块正式依赖门禁（battle-camera-boundaries.log），既有BattlePlayers生命周期（battle-camera-players.log）与90组/540次原抖动规则回归（battle-camera-shake.log）。

边界：网络快照到渲染车体仍沿用现有位置/朝向插值；这是网页联机呈现规则，不宣称原actor运动插值恢复。原程序相机数学和投影已对照原指令输出；未获取原Windows同地图战斗framebuffer，截图是正式网页表现证据，完整D3D画面像素等价仍属M4/M7。再战相机重置验证为生产模块生命周期检查，浏览器覆盖普通退出重入。
