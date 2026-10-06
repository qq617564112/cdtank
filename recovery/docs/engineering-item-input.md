# 道具输入的服务端执行与协议边界

E-04本片沿实际输入链整理职责：网页或BotController生成MsgPlayerInput，battle/accept-input执行阶段、身份、序号和托管门禁，再调用battle/items/item-request-dispatch。分派使用双端共同的快捷槽与库存查询规则，服务端独占道具与弹药请求门槛；被接受的道具请求通过MsgRoomEvent通知，治疗成功与库存事务仍由battle/healing及账户模块处理。没有新增框架、复制规则或保留旧入口转发。

| 所有者 | 文件 | 职责 |
|---|---|---|
| 共同协议 | apps/shared/protocols/MsgRoomEvent.ts | ItemUseRequest仅含kind/instanceId，不依赖server或执行算法 |
| 服务端战斗 | apps/server/src/battle/items/item-request-dispatch.ts | 真实快捷槽分派；accept-input实际调用 |
| 服务端战斗 | apps/server/src/battle/items/item-use.ts | 原角色状态/库存/陷阱许可和场景门槛；请求不等于消费 |
| 服务端战斗 | apps/server/src/battle/items/role-ammo-request.ts | 原弹药槽请求条件；自身不修改选择或数量 |
| 服务端战斗 | apps/server/src/battle/items/inventory.ts | 唯一KitbagInventory类型；正式算法与取证CTS消费 |
| 独立取证 | recovery/evidence/inventory/inventory-notifications.ts | 原440fd7删除通知算法，仅两个CTS执行 |

四个旧shared文件已删除，所有实际生产及测试消费者改用所属模块。三执行函数体和原删除算法保持不变，unsigned数量/查找顺序/重复请求等语义不改。角色状态等其他服务端专有shared规则仍待后续业务切片迁移，E-04保持未勾选。

## 协议兼容

先保存迁移前serviceProto，再运行npm run protocol:generate。生成版本23→24；仅ItemUseRequest类型定义key及引用从../combat/item-request-dispatch/ItemUseRequest改为MsgRoomEvent/ItemUseRequest。全部服务ID、字段ID、联合成员ID及结构完全一致。9种消息（请求缺省、两种kind与0/1/2147483648/4294967295实例）编码字节一致，旧新codec双向解码保持相同值。

证据：engineering-item-input-proto-before.json、engineering-item-input-wire-check.mjs、engineering-item-input-wire.json/log，均位于recovery/output。运行node --import tsx recovery/output/engineering-item-input-wire-check.mjs重新验证所保留的迁移前schema；它是本次迁移的比较工件，不参与正式发行。

## 逐项验收

- 原执行门槛和原程序codec：9个原CTS覆盖item-use、role-item-timers、role-ammo-request、inventory-notifications、inventory-query、item-request-world、healing-item-world、cpu-healing-item及account-network；另验证384原item-use包、160默认槽门槛和160原弹药请求codec。检查可发现查找/uint32/角色与场景许可、数量、重复选择或源通知行为改变；原native输出未重写。
- 全仓类型与正式依赖：npx tsc --noEmit和npm run test:architecture；检查请求契约断链、旧入口以及runtime导入tests/tools/evidence。边界覆盖219可达模块，新迁移路径加入已有门禁。
- 两端独立构建：npm run build:server和npm run build:web。新服务端JS/map审查确认库存删除取证被排除，三执行模块存在且accept-input实际引用新dispatcher。
- 编译服务：npm run test:server:compiled；检查独立发行的真实账户/迷彩网络及重启保存、五模式CPU各两局/冻结结算/再战/清房。
- 真实双网页：node --import tsx tests/browser-healing-item.mjs <CDP> --autopilot --reentry --owned-textures；CPU沿普通输入链自然受伤、自主施放，两局自然终局与再战，原Effect11/GA15、双端迷彩与离场资源声音释放，账户重启后库存/快捷槽保存与普通控制恢复。使用显式fixture库存，未注入战斗状态；降低画布分辨率仅用于业务回归，不证明高清全内容性能。

原规则、兼容、类型/边界、两端构建、发行依赖及编译联机验收已通过：engineering-item-input-{rules,native-wire,wire,types,boundaries,server-build,web-build,artifacts,compiled}.log。双网页本次两局自然终局（85718/91709ms）及重启重进全部通过：engineering-item-input-two-rounds.log、engineering-item-input-browser.log和browser-account-autopilot-owned-textures.json；普通消费、同局双端原Effect11/GA15与拥有迷彩、清理、库存快捷槽保存及控制恢复均通过。全部本片执行检查退出0，临时服务/Vite/Chromium已关闭。此片证明职责迁移与既有业务回归，不证明完整原技能/玩法或高清全资产性能。
