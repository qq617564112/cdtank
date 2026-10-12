# 动态OBB规则模块与正式接线前提

本片恢复服务端battle/roles下三个相邻职责：真实原OBB相交、原预测姿态、原控制器过滤与通知。每个模块只消费正式数值合同，不导入取证代码；本专题记录模块验收；后续完整正常来源World接线见role-movement-dynamic-world.md，不能据本专题单独宣称全部角色动态碰撞完成。

## 规则与来源

`obb-intersection.ts`的`RoleObb`承载原16浮点矩阵与三全尺寸，`intersectsOriginalObb`执行原10032ce0六面轴判定。1,139完整engine样本与TS一致，精确接触包含，次一float分离，含高度、旋转、非单位正交轴、世界坐标舍入。20个只在交叉轴分离的斜盒仍返回相交，保留原分支。CRT0x027f与0x037f样本一致；Unicorn默认0在4边界不同，来源与限制见role-obb-kernel.md。

`movement-obb-prediction.ts`恢复433d1c与433073：低于f32(.001)只复制，其他通过已证水平数学且无NAV/.2上限；原forward.z夹取/acos、负x用原近似2π、原度数乘积及engine不同cos/sin输入精度构造matrix。18完整原矩阵、23预测、10控制器输出matrix均观察误差0。详见role-movement-obb-prediction.md。

`movement-controller.ts`恢复4272d7：有地图固定f32(.3)预测本人请求命令与其他角色已保存command，无地图读currentOBB；status3、同ID、源X/Z距离任一大于200跳过，边界200进入原相交核。首个动态重叠立即返回false，静态不再通知。无动态拒绝时，静态顺序检查，以静态盒为left、预测角色为right，重叠发送type100；超过8条仅diagnostic，仍允许。19完整原controller决策、预测调用参数、静态通知/诊断及5完整原预测+engineOBB结果相同；TS额外验动态拒绝不发静态通知。来源对象、容器和原树次序由调用方提供，不将记录捕获当业务接线。

## 命令拒绝与生命周期

新增完整426a54+4269f4的288原流转样本：许可拒绝保留旧command；动态gate拒绝调用停止、清command为0和actor停止，不进入433190；通过gate后仍发布姿态和命令，即使NAV wrapper返回false。每层供应端点明示，实际422adf/4320c7命令写入执行，不宣称完整controller+OBB+运动一条链全执行。

直接给当前actors加gate不足以保真。真实map20初局四参与者时，第一个与第四个复用出生点；原4272d7会拒绝已重叠角色，不能通过“已重叠则放行”改变原规则。原426b92在428218入场/姿态处理与42833d网络pose之后调用，另有失败递归。其原60单位分离、coincident随机方向、NAV失败回退和上限必须恢复，已登记tasklist。其他角色预测使用已保存command，不能简单读取尚未接受的新input；正式快照/生命重置也须闭合该状态。

## 复现与验收

- `npm run test:combat:movement-obb`：原1,139核+TS、18原matrix+23predict/10matrix TS、19完整controller+TS及5原链输出、288完整commandstop。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:server`通过：movement-obb-module-{types,boundaries,build}.log。
- 汇总日志movement-obb-module-suite.log；各层独立原oracle与精度边界见专题。旧controller fixture现显式0x027f，新增保存yaw/shift/candidate以使TS按相同输入复现；19返回结果未变。

本模块片先保持正式actors不变；后续已恢复原重叠分离并接完整正常来源World、首局/复活/再战与已保存command，实际对局证据独立见role-movement-dynamic-world.md。完整M2-03和全角色/静态通知的动态OBB切片仍开放；不能把分层模块通过直接当完整正式接线。
