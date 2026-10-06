# 原运动输入与时间生产

正式运动仍使用原型规则。本片恢复可复现的普通角色输入及elapsed生产合同，与完整命令数学对照分开；未接碰撞、控制器权限或正式World运动。

原42b563调用422f0d，后者从全局633588的时钟对象(+10)通过40607b读取秒数，再减角色+30的double起点。40607b支持QueryPerformanceCounter除对象+8频率，以及timeGetTime无符号毫秒乘double0.001；timeGetTime高位为1的样本也执行原补4294967296分支。Windows导入身份由原PE导入表确认，不凭字段名称推断单位。

42b563首次将当前时间作为previous，因此delta=0；其后current−previous存f32，负delta归零，同时更新全局6351fc。delta1.5不会在本入口截断。原42b5f3将delta和相对时间戳传给42b1ab，之后经426fe3进入426a54；更下游433190/435088的1/.2限幅已分别原执行验证（role-movement-dispatch.md、role-movement-wrapper.md），不能认为每个长帧都推进1.5秒。

## 普通角色命令映射

输入位为6350f4的bit0..3；这不是键盘按键绑定取证。bit0优先于bit1，bit2优先于bit3。完整原42b1ab与4047b1位访问执行。

| 运动位 | 命令 |
| --- | --- |
| bit0 | 1 |
| bit1 | 2 |
| bit2 | 3 |
| bit3 | 4 |
| bit0+bit3 | 5 |
| bit0+bit2 | 6 |
| bit1+bit3 | 7 |
| bit1+bit2 | 8 |
| 无运动位且上次61e590状态为1 | 0，停止 |

无输入时还会先通知4269f4时间戳；此前未运动则不发送command0。每次普通输入处理后清6350f4，运动状态61e590按有无运动位更新。64组合覆盖所有低四位（含相反位同时设置）、上次运动0/1与两delta。

## 验证与边界

`npm run test:evidence:movement`。本脚本为`recovery/evidence/movement/role-movement-input-clock-native.py`，产物`recovery/output/movement-input-clock-native.json/log`。64输入样本断言命令、时间参数、停止、位清除及返回栈；6时钟样本断言秒数与delta，含首帧/倒退/长帧/QPC与无符号timeGetTime。

输入执行到426fe3/4269f4捕获端点，未执行实际命令许可、位置更新或碰撞；旁观者+39=1及其他输入位未纳入。时钟执行原40607b/422f0d/42b563到42b1ab调用边界；仅供应Windows API返回值，4254d1/424242角色更新副作用绕过。时钟频率、角色起点及previous状态由夹具供应，其初始化、暂停和倍率来源未证。完整数学执行的方向/弧线范围见role-movement-commands.md。
