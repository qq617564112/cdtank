# 地图0002整体实现范围

地图02全部整体修改完成后才统一浏览器验证。禁止小批次推进、单消费者运行、失败补证与局部证据封装。现有证据复用，独立driver、wrapper和rootreview队列停止。地图02完成前不切换地图。

## 全部实现范围

本图包含terrain、water/waves、60 Breach（25×16、26×10、27×6、22×8、28×20）、29 Plant05413、四BG声音、Castle304/305，以及这些对象的碰撞、状态、普通事件、round恢复、退出与同房重连。合法模式1/2/3加载和状态边界按正式目录；目前mode1的Castle/ENV伤害许可不自动扩展到其他模式。

正式代码已接全部具名资源、Breach Preview状态、Castle伤害表现、Plant隐藏snapshot/root、water动画、BG生命周期、正常Rematch/Leave、同账户30s重建恢复。上述模块属于整图基线，未观察到独立像素不等于缺少实现。

## 实际代码缺环与责任

| 范围 | 当前代码与来源 | 整体实现所需接口 | 责任 |
|---|---|---|---|
| 原场景环境光 | scene-runtime.ts使用White与重建sky灯；Plant材质消费scene.ambientColor。原SetAmbientLight业务caller/颜色producer尚缺 | 原场景ambient provider及其load/clear时序；来源充分后统一传入所有受影响材质 | Root共享render；Map环境消费者；FX来源 |
| 原选灯与toon资格 | Map02 ctl零记录、默认灯[0,200,0]/toon0.bmp及角色SetLight方向已有来源；现代码无完整原选灯/effect资格消费者 | 普通Attach显式effect caller及几何s_texToon填入producer确定后，统一角色与对应几何的选灯/采样接口 | Root共享render与FX，不无条件替换全部shader |
| 水/Plant画面与碰撞导航 | water纹理/offset与Plant状态/sway已实现；新岸边driver途中route unavailable，host327重启无draw仅观察范围 | 整图可见性/culling/相机与NAV静态碰撞的一致性需具名代码原因后修改；目前无已证生产缺陷可指派 | Map源码分析，Root共享camera/World |
| 重连原规则 | 正式同账户30s保留/自动恢复已实现 | 原期限与身份策略来源仍需闭合，现接口存在；不能以原来源未明宣称缺producer | Root协议/World/network |
| 高清性能 | 当前观察设备SwiftShader；环境advance毫秒级，帧间隔可达秒级 | 真GPU运行环境与具体瓶颈归属；不由软件慢帧推断某shader错误 | Root工程环境与共享renderer |

## 共享World接口需求

已存在的sceneObjects、scenePlants、Castle事务、round与同房恢复接口继续复用。当前没有具名来源证明还需要新增World字段、对象ID或event；不为画面观察不足添加状态或放宽伤害许可。

若整图源码分析证实NAV与World权威碰撞不一致，提供具体placement ID、支持的移动输入、权威OBB路径及planner路径差异，由Root统一修正对应接口。现route unavailable原raw不包含失败瞬间完整状态，不能据其指定碰撞patch。

## 整图统一验证入口

所有来源充分的生产修改完成并统一工程发布后，再以固定Map02整体场景、合法玩法、多人一致状态、自然round/Rematch、正常Leave与重入/重连、1920/3840真实尺寸和设备性能统一验证。观察文件只作为整图读数工具，不独立启动，不形成单消费者验收队列。
