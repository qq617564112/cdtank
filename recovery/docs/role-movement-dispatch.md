# 原运动角色与控制器参数分派

完整433190实际调用4321e3的selector10/11，分别读记录+48移动、+4c转向。84原执行样本覆盖delta负/零/.05/.2/.20000002/1/1.5，记录存在/缺失，TankType缺定义/1/4及包装返回0/1。非正delta直接返回1且无包装或matrix调用；正delta截到最大1；无战车定义默认type1，缺角色记录getter提供零；包装结果原样返回，并在两种结果后均调用433073更新matrix。

包装捕获验证position+25c、look+274、forward+280、command+258、tankType、move/turn/delta、matrix+2b8、center+28c及world全部实参顺序；无需getter服务替代。435088与433073本片为捕获端点，不证明碰撞或矩阵服务。

完整426fe3的72样本覆盖阶段0–5、角色存在/缺失、role+234零/非零以及command0/1/6。只有阶段virtual+4返回4且角色存在才分派；role+234为零将delta归零但仍进入命令处理，不能简单认为所有后续状态都不更新。command0仅给4269f4传时间戳，非零给426a54传command/delta/时间戳。阶段查询以及426a54/4269f4为供应捕获边界，未执行426a54的virtual+40控制器许可。

复现：`recovery/.venv/bin/python recovery/evidence/movement/role-movement-dispatch-native.py`。产物movement-dispatch-native.json/log。原输入时钟生产见role-movement-input-clock.md，全命令数学见role-movement-commands.md，已接正式角色许可见role-movement-permission.md。
