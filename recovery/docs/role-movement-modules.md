# 原水平运动、采样与包装模块

原运动规则现有三个相邻的服务端模块，均在battle/roles，不放进shared，不引用原执行代码。本专题记录规则模块与原执行对照；后续正常World水平运动接线和独立方向合同见role-movement-world.md，动态OBB与垂直处理仍待恢复。

| 模块 | 实际职责 |
| --- | --- |
| movement-math.ts | 完整水平4344e7及转心/原地转向/方向对齐数学，新pose输出，不修改源pose |
| movement-navigation.ts | 434cee在试算姿态后的原多点生成/旋转/平移/查询、侧边与内部失败code |
| movement-wrapper.ts | 435088限幅、复制试算、成功提交、组合命令退化重试、失败部分方向转动 |

完整数学11808原样本覆盖四TankType、多朝向/夹角与长度、最小/非限制/非整除半径及保持/旋转/越过分支。TS方向误差0，最大位置误差0.0000152587890625；容差与精度边界见role-movement-directions.md。forward对齐不是统一最短角平滑，组合含2倍转角与3倍阈值。模块提供原normalize与Y轴rotate供wrapper复用。

采样432组原434cee覆盖四世界朝向、48×48/49×52/72×84供应尺寸、命令0–8及全通/全阻/X条带/Z条带。TS逐次对照原查询点（容差.0001）、下标、通行值、顺序、提前返回及失败code，不只是总返回值。原61e5f8角常量为6.283180236816406；用Math.PI×2会造成点偏差，模块保留原常量。当前只支持水平预测及原固定10×10栈数组容量内、至少一列一行的形状；未证范围明确RangeError。

组合wrapper另外通过255完整原包装结果，包括null地图、负/零/长时间、静态单侧/内部阻挡与重试，再对全部25原NAV的4518真实原包装样本核对成功/失败、最终command、位置/look/forward。地图读取实际正式Battlefield.navigation；使用48×48显式夹具，不用其证明最终车辆尺寸。wrapper只消费NavigationGrid，不调用原型中心扫掠，不添加临时盒体或半径。非正时间的正式角色拒绝由既有movement-time处理；raw wrapper自身保留原负时间行为。

## 复现与剩余接线

- `npm run test:combat:movement-math`：11808原数学与TS。
- `npm run test:combat:movement-wrapper`：432原采样与TS、255合成/4518真实地图wrapper对照。
- `npm run test:evidence:movement-prediction`：23直接预测及5完整控制器预测/原engine矩阵与OBB。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:server`通过。

日志：movement-math-runtime.log、movement-wrapper-runtime.log、movement-prediction-suite.log。此片没有变更正式actors调用、协议、页面或资源，未把前轮CPU/账户/浏览器通过当作新几何正式接线验收。

下一片必须分开动态角色OBB预测（原433d1c传NULL地图）与实际运动NAV碰撞，明确移动look和车体forward的独立状态以及快照/客户端渲染对应，核对最终尺寸与角色属性move/turn来源；然后接正常World，验CPU自然两局、联机、账户保持、渲染方向和资源。圆弧外部中心、非水平/斜坡、原acos错误路径、最终footprint及真实地图loader仍待恢复。不得将此模块测试通过等同M2-03完成。
