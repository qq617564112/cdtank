# 商城拥有战车剩余参数与拥有宠物熟练度原显示源

M5-10/UI-56/UI-57。来源为`recovery/output/current-exe.asm`原指令与
`shop_tankpage.xml`/`shop_petpage.xml`原控件。本文只记原事实、VA调用路径、每控件
来源/算术/格式与当前确切接线合同；不宣原设备像素、原setter最终色或原server已恢复。

## 战车页成员与控件

原页面装载`4b2ff0`起用`LabPage/`前缀绑定`shop_tankpage.xml`，`4b3058`–`4b3557`逐个
把控件存入页成员：

| 成员 | 控件 | 成员 | 控件 |
| --- | --- | --- | --- |
| 0x34 | lstTank | 0x6c | txtPanzerSide |
| 0x44 | txtName | 0x70 | txtPanzerBack |
| 0x48 | txtType | 0x74 | txtMoveSpeed |
| 0x4c | txtDurable | 0x78 | txtRotateSpeed |
| 0x50 | edtDescription | 0x7c | txtShootInterval |
| 0x54 | txtAttackLevel | 0x80 | prgLoadingTime |
| 0x58 | txtAttack | 0x118 | rdoBuy |
| 0x5c | txtAttackExtra | 0x11c | rdoSell |
| 0x60 | txtPanzerLevel | 0x120 | rdoTexture |
| 0x64 | txtPanzer | | |
| 0x68 | txtPanzerExtra | | |

页面选择更新`4b7fd3`调用`4b6ce1`；模式成员`+1a8`由Buy分支置0（`4b5c49`）、由另一
列表分支置1（`4b5f60`），故`4b6ce1`的mode1分支（`4b73ec`–`4b7996`前）就是拥有显示。

## mode1 选中 instance→record→table

`4b73f5`把选中实例id存入`[esi+0x1a0]`，`4b7417`用`421f36(manager+0x40, id)`取
当前选中owned equipment记录并存入`[ebp+8]`；`4b741e`取该记录`+0x24`为战车定义id，
`4b7427`–`4b7432`经`413c95`（资源管理器`+0xc`）与`411068`按id查到Tank表行存入
`[ebp-0x10]`。`4b75ef`调用`429e41(out, 427ba2(manager), owned记录)`把聚合传给
`[ebp-0x24]`，聚合指针落在`[ebp-0x20]`（out+4）。

`%d`格式常量`5c83d4`，`%1.1f`格式常量`5ced44`，射击间隔scale`5c3370`为f32 0.1。

| 控件(成员) | mode1源 | 格式/算术 |
| --- | --- | --- |
| txtAttack (0x58) | 聚合+0x1c | `%d` |
| txtAttackExtra (0x5c) | 聚合+0x20 | `%d` |
| txtPanzer (0x64) | 聚合+0x24 | `%d` |
| txtPanzerExtra (0x68) | 聚合+0x28 | `%d` |
| txtPanzerSide (0x6c) | 聚合+0x2c | `%d` |
| txtPanzerBack (0x70) | 聚合+0x30 | `%d` |
| txtMoveSpeed (0x74) | 聚合+0x34 | `%d` |
| txtRotateSpeed (0x78) | 聚合+0x38 | `%d` |
| txtShootInterval (0x7c) | 聚合+0x3c | `%1.1f`(整型×f32 0.1) |
| txtAttackLevel (0x54) | owned eq +0x44 | `%d` |
| txtPanzerLevel (0x60) | owned eq +0x54 | `%d` |
| txtName (0x44) | owned eq名串 | — |
| txtType (0x48) | `4d960f(owned eq)` | — |
| txtDurable (0x4c) | `4d88f1(owned eq)` | — |
| edtDescription (0x50) | Tank定义行说明串 | — |

来源归纳：等级、名称、类型、期限直接读选中owned记录（`+0x44/+0x54`、名称、`4d960f`、
`4d88f1`）；六项攻防/侧后/运动参数按owned记录`+0x24`定义查到的Tank表行再经`429e41`
聚合（见下），说明按同一表行定义。`txtAttack`/`txtAttackExtra`/`txtPanzer`/
`txtPanzerExtra`原指令读聚合，不是owned记录原始`+0x3c/+0x40/+0x4c/+0x50`。

`prgLoadingTime`（0x80）在mode1**没有赋值指令**。旁侧容量标记由`4b7442`调用
`4b2635(Tank表行+0x98)`置，表`+0x98`为TankPartSlot（见loader），`4b2635`对页
`+0x90`/`+0xa4`两组各若干子控件按该值置1/0。

## 429e41聚合与复用

`429e41`就是Home拥有的`txtPanzerSide/txtPanzerBack/txtMoveSpeed/txtRotationSpeed/
txtShootInterval/prgLoadBullet`使用的原`4e8f88 -> 429e41`显示投影，已由Home侧恢复为
`apps/web/src/interface/home/home-tank-parameters.ts`。其键
`HOME_TANK_PARAMETER_BASES`=(TankType,TankMove,TankTurn,TankDelay,TankBullet,
SideDef,BackDef)对应Tank行`+0x50/+0x84/+0x88/+0x8c/+0x90/+0xa4/+0xa8`；函数体
给出侧/后=表值+加成并按dataScale 12/13夹取，移动=(TankMove+加成+精通+2)×10，
回转=(TankTurn+加成+精通)×4−1，间隔=TankDelay×f32(0.1)的`%1.1f`。原指令`42a437`–
`42a4d3`逐项印证这些字段与夹取，`429f8a`–`429fb7`写入聚合四项熟练度。

因此商城owned剩余五项（txtPanzerSide/txtPanzerBack/txtMoveSpeed/txtRotateSpeed/
txtShootInterval）可直接复用`homeTankParameters`，输入record=选中owned equipment、
pet、catalog、equippedItemIds、alreadyUsed与Home一致；容量进度按helper的capacity/6，
与Buy的TankBullet/6区分。

## 429e41入口参数与局部定义

调用约定（`4b75ef`Tank、`4b14a9`Pet）：`ecx=this`=发起页对象；
`arg0=[ebp+8]=out`（≥25个int的本地向量，末尾拷贝回调用者）；`arg1=[ebp+0xc]`；
`arg2=[ebp+0x10]`。字节级入口：

```
00429e56 mov esi, ecx           ; esi = this
00429e5b mov [ebp-0x34], edi    ; edi=0：out向量的数据指针初值
00429e6e lea ecx,[ebp-0x38]; call 42995c   ; 建25个int(out模板)
00429e76 cmp [ebp+0xc], 0 je 42a4f4        ; arg1为空→空路径
00429e7f mov ebx, [ebp+0x10]               ; ebx = arg2
00429e82 cmp ebx, 0 je 42a4f4
```

三个局部对象/指针对应（字节与用法）：

- `esi=[ebp-0x34]`：`out`模板向量的数据指针（`429f8a`–`429fb7`的目的地）。`42995c`
  以`push 0; push 0x19`建立25个int的向量，数据落在`[esi+0..0x60]`；索引21..24即
  `+0x54/+0x58/+0x5c/+0x60`，就是四组熟练度。
- `edi=[ebp-0x44]`：加成累加器`A`的数据指针。`A`由`4298e0`从`this+0x44`
  复制而来（`429e94` `lea eax,[esi+0x44]`）。`429714`以属性索引把被动技能字段累加
  进`A`；`[edi+0x54..0x60]`=`A[21..24]`。
- `ebx=arg2`：提供三个装备槽`+0x58/+0x5c/+0x60`与当前门禁键`+0x1c`的记录。

## 429eb6 current候选门禁

```
00429ea4 mov ecx,esi; call 427bf9     ; eax = 当前记录
00429eab mov ecx,[ebx+0x1c]
00429eae cmp ecx,[eax+0x1c]           ; arg2实例键 vs 当前实例键
00429eb4 je 429edb                    ; 相等→保留A初值
00429eb6..00429ed9                    ; 不等→A每个int清0（operator[] 41896d）
```

`427bf9(this)`按当前role记录的`get(0x1d)`取回一条原始记录；比较字段`+0x1c`是该
记录的实例键。门禁语义：`arg2`不是当前选中实例时，`this+0x44`带出的角色技能加成被
清零，只保留随后由`arg2`自身装备槽加入的加成。

`427bf9`与`427ba2`都先从`[0x633588]`取当前模式，只在模式2（`4269c4`返回非空）时
继续；`427ba2`走`41e99c`（键`roleRecord->get(0x1c)`），`427bf9`走`421f36`
（键`roleRecord->get(0x1d)`）。`41e99c`/`421f36`都是同一记录映射的取值函数，返回条目
`+0x10`的原始记录指针：`41e9f1`把该记录`+8`定义为宠物定义经`413c83`查Pet表行，
`421f88`把该记录`+0x24`定义为战车定义经`413c95`查Tank表行。故两条记录都带
`+0x1c`实例键，前者代表宠物/基础记录，后者代表战车/装备记录。

## 429f8a–429fb7真实加数producer

```
00429f68 mov eax,[ebp+0xc]   ; arg1
00429f6b mov esi,[eax+8]     ; arg1+8 = 宠物定义
00429f6e call 413c83         ; Pet表管理器
00429f77 call 411068         ; Pet表行
00429f8a mov ecx,[eax+0x7c]  ; STankMastery
00429f8d add ecx,[edi+0x54]  ; + A[21]
00429f90 mov [esi+0x54],ecx  ; out[21]
...  +0x80/+0x84/+0x88 与 [edi+0x58/+0x5c/+0x60] 同理，写 out[22..24]
```

`A`的两部分真实来源：

- `429e8a push [ebp+0xc]; mov ecx,esi; call 429cf3`先把`this+0x44`清空，并在
  `arg1[0]==427ba2(this)[0]`时用`arg1`的技能填充`this+0x44`：`429ded`起对
  `arg1+0x44`的6个技能槽读`[esi]`(base)与`[esi+0x18]`(rank)合成索引，经
  `[0x633588+0x114]+0x78`取技能定义，调`429714`累加；`429d65`另遍历
  `[0x633588+0x120]`一项角色技能表，经`+0x7c`取定义后同样调`429714`。
- `429edb`–`429f66`对`arg2+0x58/+0x5c/+0x60`三个装备槽：`413c74`取物品定义，
  读物品`+0x108/+0x10c/+0x110`三个技能id，`413c65`取技能定义后调`429714`累加。

`429714`只在`skill+0x2c==0`（被动）时累加，把技能字段逐索引加入`A`：索引
`0..20`对应`skill+0xe8..+0x138`，索引`21..24`对应`skill+0x148/+0x14c/+0x150/+0x154`
（即四组坦克精通加成）。

结论：`out`四组熟练度 = `Pet表(arg1+8定义)+0x7c/+0x80/+0x84/+0x88` +
`A[21..24]`，而`A[21..24]`=（`arg2`为当前实例时`arg1`六技能/角色技能表带来的精通加成，
否则0）+ `arg2`三装备槽物品技能的被动精通加成。

## Buy对照（mode0）

`4b6ce1`–`4b73ec`按所选商品查Tank表行直接赋六项：txtPanzerSide=表+0xa4、txtPanzerBack=
表+0xa8（`4b717b`/`4b71c9`）；txtMoveSpeed=(表+0x84+5)×10（`4b7214`）；txtRotateSpeed=
表+0x88×4+11（`4b726b`）；txtShootInterval=`%1.1f`(表+0x8c×f32 0.1)（`4b72c1`）；
prgLoadingTime=表+0x90×f32(1/6)（`4b731e`）；txtAttack/txtAttackExtra/txtPanzer/
txtPanzerExtra=表`+0x54/+0x60/+0x6c/+0x78`。Buy的+5/+11等价于精通=3。侧/后在场
Buy与Owned同源（Tank表SideDef/BackDef），Owned仅另加加成并按dataScale夹取，故无加成
时Side/Back目录值与Owned相同。

## Pet页成员与熟练度

原页面`4b0312`起用`CastlePage/`前缀装载`shop_petpage.xml`，控件存入页成员：0x6c
txtHP、0x70 txtCritical、0x74 txtLucky、0x78/0x7c/0x80/0x84/0x88/0x8c
txtSkillName0..5、0x90..0xa4 txtSkillLevel0..5、0xc8 prgLightTank、0xcc
prgMediumTank、0xd0 prgHeavyTank、0xd4 prgCruiser。选择更新`4b1150`，模式成员
`[esi+0x20]`（0=Buy，1=Owned）。

Owned（`4b1180`起）：选中项`+0x9c`实例id→`41e99c(manager+0x40+0x10,id)`得owned base
记录存入`[esi+0x28]`（定义`+8`）；`4b14a9`调用`429e41(&[ebp-0x50], [esi+0x28],
427bf9(manager))`：`arg0=&out`、`arg1=[esi+0x28]`=选中owned base、`arg2=427bf9`=当前
记录（`4b1150`把`427bf9`先push、`[esi+0x28]`次push、`&out`末push，故末push为arg0）。
聚合指针`[ebp-0x4c]`即out数据。`4b160d`–`4b1744`：
txtHP=聚合+0、txtCritical=聚合+0x10、txtLucky=聚合+0x14；熟练度=聚合
`+0x54/+0x58/+0x5c/+0x60`，进度=f32(值×`5c4794`=0.2)依次写prgLightTank/
prgMediumTank/prgHeavyTank/prgCruiser。

Buy（`4b14c3`：mode=0）：选中项`+0x9c`宠物id→`413c83`+`411068`查Pet表行存入
`[esi+0x2c]`（`4b11bf`–`4b11dd`）；`4b14ce`–`4b15ff`：txtHP=表+0x58、
txtCritical=表+0x64、txtLucky=表+0x70，熟练度=表`+0x7c/+0x80/+0x84/+0x88`×0.2写同样
四进度。`+0x7c..+0x88`即Pet表列STankMastery/MTankMastery/LTankMastery/STugMastery。

`429e41`内`429f68`–`429fb7`：`arg1+8`宠物定义经`413c83`查Pet表行，聚合熟练度=Pet表
`+0x7c/+0x80/+0x84/+0x88` + 累加器`A[21..24]`（`[edi+0x54..0x60]`）。对Pet页，
`arg2=427bf9(this)`就是当前记录，`429eb6`门禁`arg2+0x1c==427bf9(this)+0x1c`恒成立，
`A`保留`this+0x44`（由`arg1`=选中base的六技能`+0x44/+0x5c`与角色技能表`429cf3`填充），
再叠`arg2`三装备槽`+0x58/+0x5c/+0x60`的物品技能（物品`+0x108/+0x10c/+0x110`）。
即Owned熟练度不是原目录纯值，而是Pet表基值叠选中宠技能与当前战车部件技能；Buy只给原
目录值。当前`pet-shop-mastery.ts`与`petShopMastery(petId)`只映射Pet表目录值，等于Buy语义。

对Tank页（`4b75ef`），`arg1=427ba2(this)`=当前宠物记录、`arg2=owned equipment`：
`429eb6`门禁比较owned装备实例与当前装备实例，非当前则清空`arg1`带来的技能加成，只留
owned装备自身部件技能。故Tank页展示的精通来自当前宠物技能+被选战车部件技能，与Pet页
同一函数、不同arg角色。

## 当前确切接线合同

- BH已接（禁改）：Tank owned txtAttack/txtAttackExtra/txtPanzer/txtPanzerExtra/
  txtAttackLevel/txtPanzerLevel读owned equipment `+0x3c/+0x40/+0x4c/+0x50/+0x44/+0x54`，
  Pet Crit/Lucky读base `+0x34/+0x3c`，HP读base `+0x2c`。
- 本批补：Tank owned txtPanzerSide/txtPanzerBack/txtMoveSpeed/txtRotateSpeed/
  txtShootInterval按`homeTankParameters`（`429e41`）接线；prgLoadingTime无mode1 setter，
  容量标记原读TankPartSlot，故按helper的capacity或明确空，不发明mode1进度公式。
- Pet熟练度：Owned需`429e41`聚合（目录+角色/成长），Buy为Pet表目录值。当前
  `petShopMastery(petId)`仅能接Buy；若确认owned记录未含`429e41`聚合所需角色/成长字段，
  保持现目录映射并明示，不猜偏移或成品数值。
- 现有确认`OwnedRoles`字段能接即接；不新增wire/API/cache/QUERY，不改费用/库存/学习/
  战斗规则。缺记录/缺字段留空，实际0显示0。

### Pet熟练度聚合的可实施输入缝

原`4b1150`Owned传给`429e41`的输入对应现确认来源：

| 原输入 | 现来源 |
| --- | --- |
| `arg1`=选中owned base记录 | 当前`ownedSelection`匹配的`OwnedRoles.base`记录 |
| `arg1+8`宠物定义 | 该base记录`fields`的`8` |
| `arg1+0x44/+0x5c`6技能base/rank | 该base记录`fields`的`0x44+slot*4`/`0x5c+slot*4` |
| `arg2`=当前记录 | 当前出击战车的`OwnedRoles.equipment`记录（与profile当前实例匹配） |
| `arg2+0x58/+0x5c/+0x60`部件物品 | 该equipment记录`fields`的`0x58/0x5c/0x60` |
| 物品`+0x108/+0x10c/+0x110`技能 | `Inventory`确认物品的技能id（`catalog`物品定义skillIds） |
| 技能`+0x148..+0x154`精通加成 | `catalog`技能定义的四项坦克精通属性 |
| Pet表`+0x7c..+0x88`精通基值 | 宠物定义（`fields.get(8)`）的STank/MTank/LTank/StugMastery |

可实施方案（四组一次给出）：

```
petOwnedMastery({selectedBase, currentTank, isCurrent, catalog, equippedItemIds})
  base[0..3] = petTable(selectedBase.fields.get(8))[0x7c,0x80,0x84,0x88]
  bonus = [0,0,0,0]
  if (isCurrent)                       // 429eb6门禁通过
    for slot in 0..5:
      baseId=selectedBase.fields.get(0x44+slot*4); rank=selectedBase.fields.get(0x5c+slot*4)
      addSkillMastery(bonus, catalog.skill(rankedPetSkillId(baseId,rank)))   // 429cf3+429714
  for item in currentTank.fields.get([0x58,0x5c,0x60]):                     // 429edb式
    addSkillMastery(bonus, catalog.item(item).skillIds)
  mastery[0..3] = base[0..3] + bonus[0..3]
  progress[0..3] = f32(mastery[0..3] * f32(0.2))     // 写prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser
```

采用与资格规则：

- 只有在`selectedBase`（当前选中base）与`currentTank`（当前出击/选中战车）都已确认为
  合法记录、且`catalog`已含相应技能精通属性与物品技能id时，才显示四组聚合值；某槽缺
  confirmation则该组保持unknown（空），不用纯目录值`petShopMastery(petId)`冒称Owned。
- `isCurrent`=选中base/战车是否为当前角色实例（对应`429eb6`门禁：只有当前实例才并入
  选中侧六技能加成；`4b1150`Pet页`arg2`恒为当前记录，故Pet页等价于恒并入）。
- 技能加成只取`skill+0x2c==0`被动技能四项坦克精通属性；物品取三部件槽`+0x58/+0x5c/+0x60`
  的`+0x108/+0x10c/+0x110`三个技能id。`429cf3`另遍历角色技能表`[0x633588+0x120]`一项，
  若现确认记录未覆盖该来源，该部分保持unknown，不猜偏移。
- 现实0显示0；缺必需confirmation留空。不新增wire/API/cache/QUERY。

## 未证边界

`429cf3`中角色技能表`[0x633588+0x120]`的条目身份与构造、`429714`技能`+0xe8..+0x154`
全25属性的目录映射、`4d960f`/`4d88f1`完整文本、原setter最终色/字形/高清、TankPartSlot
标记与prgLoadingTime的关联细节、Pet Owned加成字段是否全部存在于现确认记录、原server
规则与对战最终属性均未证。聚合为原Home显示投影，不等于当前战斗最终属性。本批无测试/
浏览器/build/typecheck/native/导出，未宣原设备像素或原server已恢复。
