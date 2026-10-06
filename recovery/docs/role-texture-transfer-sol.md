# 战车迷彩选择请求与成功确认（M3-03 / M6-01 / M6-03）

原完整选择入口 `0x493b5c` 将拥有战车实例和请求 U/M/XY 交给消息 `0x3f98`；原 `0x3f99` 成功回调 `0x495a69` 将服务器返回的三槽写入该拥有战车 `+0x28/+0x2c/+0x30`，同时更新资料代币和金钱余额。这条链确认拥有选择的更新来源，角色 `OdlPlayer` 属性32的生产写入仍未建立。

## 原请求与费用来源

`0x493b5c` 只在阶段2处理选择。三个请求槽全0或与拥有记录逐槽相等时不发消息；有监听者时报告0。非空请求通过实例查询原 `0x421f36`，并取得原资料 provider `0x4269c4`。

每个非零且与对应拥有字段不同的 ID 查询 `tanktexture`。原 getter `0x413ccb` 取得资源 manager `+0x88`；表记录 `+0x48` 是稀有度，`+0x4c/+0x50` 是原表的“购买金钱价/购买代币价”。稀有度0停止请求；稀有度1累加金钱价；稀有度2累加代币价。原资料 scalar7（字段 `+0x74`）检查代币，scalar26（字段 `+0x70`）检查金钱，不足时向监听者分别报告1或2。

检查通过后，`0x493d0c–0x493d45` 执行真实 `0x492a56` 构造，将实例和请求三槽放入消息 `+0x0c/+0x10/+0x14/+0x18`，调用运输入口并析构。请求不会先写拥有选择或扣余额。原类型 getter `0x492107` 返回 `0x3f98`；完整 writer `0x492a89` 和 reader `0x492ae6` 使用四个 unsigned32，没有把0回填成默认迷彩。

## 原成功确认

`0x49941d` 返回类型 `0x3f99`，完整 reader `0x4993a4` 依次读取实例、U、M、XY、代币余额、金钱余额六个 unsigned32，以及 unsigned8 结果码。原注册 `0x49712c–0x49715b` 将 `0x495a69` 安装到对应监听对象。

完整回调只在阶段2进入；结果3且实例查找成功时，先复制返回三槽到拥有记录，再通过真实资料 virtual scalar setter `0x42fdea → 0x420551` 写入 scalar7/26。末端监听者收到结果时已经读到确认后的选择与余额。其他结果或实例缺失保留选择和余额；阶段2的监听者仍收到结果。其他阶段不通知。

## 确认与取证入口

[role-texture-transfer-sol.ts](../evidence/tank-textures/role-texture-transfer-sol.ts) 提供原请求 writer 和原确认 reader；[tank-texture-change.ts](../../apps/server/src/accounts/tank-texture-change.ts) 提供 `applyRoleTankTextureConfirmation` 和 `evaluateRoleTankTextureRequest`。费用检查按原DWORD累加与unsigned余额比较执行，1422实际表请求与高位余额/同DWORD表示对照通过；零值或未变化不查表。接收函数按结果3与实例匹配更新拥有记录三个字段及资料 `+0x74/+0x70`；替换记录保留名称和其他字段，通知发生在更新后。它接收已经确认的余额，没有计算服务端价格或给账户增加拥有记录。

## 验证

```sh
recovery/.venv/bin/python recovery/evidence/tank-textures/role-texture-transfer-sol-native.py
npx tsx recovery/evidence/tank-textures/role-texture-transfer-sol.cts
npx tsx recovery/evidence/tank-textures/role-texture-request-cost.cts
```

PASS：48个原请求/确认 codec 用例覆盖8种 bit alignment、零值、真实迷彩三槽和 unsigned高位；216个完整成功回调用例覆盖三个阶段、六种结果、拥有实例存在/缺失和监听者存在/缺失；原711条 `tanktexture` 的每条记录分别执行余额充足/为0的完整请求，共1422例。全0和已有三槽请求另验证不发送。共享 reader/writer、确认字段、余额及通知时刻与原执行输出逐项一致。证据输出 `recovery/output/role-texture-transfer-sol-native.json`。

检查用于发现消息宽度/顺序、三槽偏移、费用币种、成功结果码、阶段门禁或通知顺序错误；出现这些错误时应阻止接入确认后的拥有选择存储。原完整请求构造/析构、请求/确认 codecs、成功回调、资源 getter、拥有 getter、资料 provider及 scalar getter/setter执行真实指令；阶段 provider、拥有 map节点查找、表查找、运输和末端通知由边界供给。表价格和稀有度使用已解码原表，输入三槽与余额为明确夹具。

## 限定范围

原客户端请求门禁与费用比较不等于服务器授权规则。本结果没有执行购买运输、服务器扣费、账户保存或网页选择控件。成功确认更新的是拥有记录，未证明原创建/广播如何把三槽写入 `OdlPlayer+0x110`；重建服务器已有快照传递不能作为该原 producer 的证据。资料 selector44仍是帽子装饰实例。
