# Map7 Breach 完好模型绘制入口

合法 map7 的 obj05462 为原79/81/82三个油桶。既有 `scene-breach20-05462-native.json` 已确认原 POL/c9 loader；本片复用该执行，不重新运行破坏或加载验收。

Breach vtable5c7450 的 render+1c=45ee7f、loader+34=4610f1。完好 object+dc 使用 gbPlantNode；461201 开启 SetRotationY(true)，设置 node+100。45ee7f 在当前 object+e4 等于完好 node 时读取矩阵栈 GetTop，再将 object+78 的 translation 传给 SetViewPosition；此入参不是具名相机矩阵。10018050 保存16浮点矩阵及xyz。Attach10019510 在 rotationY 分支临时使用已保存的矩阵栈值，并提交xyz和 node+150 为参数w。

原 `rotationy80.gbf` 按w绕Y旋转局部顶点，再加xyz，纹理乘ambient、AlphaTest GREATER50、SRCALPHA/INVSRCALPHA、CLAMP。该原类不能套用 General 的 geom_c1 静态材质资格，也不能仅凭 SetRotationY 名称称为随相机转向。

来源 `tests/scene-breach07-intact-render-source.py` 与 output 同名 json/log 为 SOURCE_INTACT_PLANT_RENDER_INPUTS_ONLY，保存具名原指令、三个放置与shader文本。未改生产、无新普通玩家输出。

## 未完成范围

461329具名producer读取object+6c源yaw，乘5c73c0原弧度系数后SetParameter10018090写node+150。此为固定原朝向，当前静态放置已保留同yaw，不新增常驻动画。仍需要明确原effect flag到rotationy shader登记及ambient provider才可接原材质。Plant02旧ambient GPU缺口仍复用现记录，不重其两次失败入口。完好油桶继续使用当前已发布几何；不将原静态材质或绕Y表现标为恢复，不扩大服务器碰撞或c9破坏消费者。
