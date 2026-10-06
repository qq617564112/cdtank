# 原团队模式信息显示来源

原团队模式将`OdlBattlefieldBulletin.m_iCatsInfo/m_iDogsInfo`以`%d`显示到本队、敌队两个控件。本机在猫队时本队显示CatsInfo，在狗队时本队显示DogsInfo。`recovery/.venv/bin/python recovery/evidence/rooms/team-info-source.py`：PASS；结果为`recovery/output/team-info-source.json`。

## 显示消费者

`game_main_info_team.xml`的`txtSelfInfo`、`txtEnemyInfo`分别绑定HUD`+0x640/+0x644`，原名字常量为`0x5cfea0/0x5cfe80`；初始化绑定见`0x4c9e3a–0x4c9eac`。

更新消费者`0x4cb6cb`要求输入公告非空、HUD根控件`+8`非空。它复制公告`+0xc/+0x10`到HUD`+0x38/+0x3c`。HUD模式`+0x80=0`才写团队的两个控件；其他模式有独立控件分支。

格式常量`0x5c83d4`为`%d`，没有前缀、单位、补零或颜色操作。两整数直接格式化，没有除法、扣减或与TankNumb组合。

| HUD本队标志`+0x932` | txtSelfInfo | txtEnemyInfo |
| --- | --- | --- |
| 非零 | CatsInfo（公告`+0xc`） | DogsInfo（公告`+0x10`） |
| 零 | DogsInfo（公告`+0x10`） | CatsInfo（公告`+0xc`） |

初始化`0x4d05bd–0x4d05ce`取得本机角色属性`0x11`。属性为1时查找猫队六槽`HUD+0x40`，找到本机ID后`0x4d0640`置本队标志1；其他属性查狗队六槽`HUD+0x58`，找到后`0x4d0669`置0。初始化显示`0x4d25f9–0x4d271d`使用同一标志与同一`%d`格式。

## 原布局图态

团队信息面板在原800×600坐标(642,0)–(757,103)。本队数字相对面板(72,9)–(101,30)，敌队数字(72,43)–(101,64)，均使用BigHT。XML的`picSelfIcon`引用蓝战车`zhandou00/lantanke.tga`，`picEnemyIcon`引用红战车`zhandou00/hongtanke.tga`；两行另有`*`标签。完整更新消费者只写文本，不改这些图或文本颜色；猫狗映射改变的是整数落入哪行。

## 执行证据与语义边界

取证完整执行原`0x4cb6cb`到返回，覆盖猫/狗两种本队标志、9/23及0/12两组输入、空公告、无HUD根控件，以及非团队模式1。四组团队输入均产生准确两次文本写入；空公告/无HUD不写，模式1不写团队控件。另执行`0x4d0618–0x4d0670`，验证本机角色在两组六槽中的选择和本队标志设置。

角色/属性通知及CEGUI边界由夹具供应；格式钩子消费原`%d`字符串与原有符号整数参数。公告复制、分支、控件选择与完整回调返回均执行原指令。GUI图块属性由原XML记录，未启动完整CEGUI。

已有`bulletin-schema.json`明确将`+0xc/+0x10`命名为`m_iCatsInfo/m_iDogsInfo`；`m_iDogTankNumb/m_iCatTankNumb`是独立`+0x14/+0x18`字段。当前必要上游来源只确定游戏对象`+0x30`提供公告（`0x43535a`），初始化读取与公告更新通知复制同一对Info；没有明确命名为剩余生命或生命次数。团队模式Info的初值/变更生产和耗尽结算仍是缺失入口。

Web权威`teamLives`可按本队/敌队位置进行重建显示，但它到原CatsInfo/DogsInfo的语义接线仍须标为重建映射；本消费者恢复不证明原团队生命规则完成。
