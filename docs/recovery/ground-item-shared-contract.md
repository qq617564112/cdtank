# 地面掉落共享契约 (M2-10)

本文记录地面掉落与拾取当前已落地的 shared 类型、手工协议字段和房间快照投影。
对应业务规则见 `ground-item-business-design.md`；本文只闭合 shared 契约，持久化、
domain 与 UI producer 的状态以其专题文档为准。

## 类型契约

`apps/shared/protocols/MsgRoomSnapshot.ts`：

```ts
export interface GroundItemSnapshot {
  id: string;
  itemTableId: number;
  quantity: number;
  modelId: string;
  texture: 'A' | 'B';
  soundId: string;
  effectId: string;
  x: number;
  y: number;
  z: number;
  source: 'BREACH' | 'DISCARD';
  ownerId?: string;
  createdAt: number;
}
```

`MatchSnapshot.groundItems?: GroundItemSnapshot[]` 为后加可选数组；旧快照 fixture
与旧 server 可继续省略它。`PlayerSnapshot.respawnProtection` 是 Func6 的唯一 shared
新增字段：

```ts
respawnProtection?: {skillId: number; expiresAt: number};
```

该字段对应来源技能 30001 的真实复活保护 policy；`expiresAt` 使用服务端
true clock 毫秒。现有 `selectedSkillIds` 继续承担其他 skill function 的来源投影，
不增加 radar 或额外状态字段。

`apps/shared/protocols/MsgRoomEvent.ts` 保持 `type: string` 与既有 envelope 不变，
只追加：

```ts
groundItemDropped?: GroundItemSnapshot;
groundItemPickedUp?: {id: string; playerId: string; itemTableId: number; quantity: number};
groundItemRemoved?: {id: string};
```

`groundItemDropped` 的视觉字段来自服务端在建实体时选定的 drop visual；
`groundItemPickedUp` 只在权威库存事务成功后产生，不把场景模型消失当成取得。

## Action 100

`apps/shared/protocols/MsgPlayerAction.ts` 保留原有 `sequence/action/value/clientTime`
字段并追加 `roomId` 与 `round`。导出：

```ts
export const GroundItemAction = {
  DISCARD: 100,
} as const;
```

当前选中合法实例的 instanceId 放在既有 `value`。服务端必须按认证 session 解析
player/room/round，再要求该实例属于 current selected、ownedQuantity > 0 且
battleQuantity > 0，并从该实例扣 1；client 提供的 clientTime 不参与时钟或 HP 判定。
不借用旧 action 1/2，也不在本批增加拾取 action。

## 房间投影

`RoomState.groundItems` 使用 `GroundItemSnapshot[]` 作为房间权威数组，
`createWaitingRoom` 初始化为 `[]`，`roomSnapshot` 对 source array 做逐项浅 clone
到 `match.groundItems`。当前 shared 层不依赖新的 GroundItemState class，也不在
snapshot 中派生或伪造未知来源记录。

World 的 create/discard/pickup 生产桥（88b726a）、账户事务（be579f9）与 web renderer
producer（fc83778）均已接入：真实 mode5 Breach HP 归零建掉落、接触半径40拾取、
普通 action100 丢弃，房间快照的 `groundItems` 承载权威数组。shared 层本身仍只承载
类型与投影，不派生或伪造未知来源记录。

## 手工 schema

`apps/shared/protocols/serviceProto.ts` 以 actual dirty 的 version 105 为 authority，
本轮只加 1 到 version 106，不运行 generator。旧 services、type names、property IDs
与 field semantics 保持不变；新增字段按 actual dirty 的各结构最大 ID 后追加：

| 结构 | 新增字段 | field ID | 形状 |
| --- | --- | --- | --- |
| `MsgPlayerAction/MsgPlayerAction` | `roomId` | 4 | String |
| `MsgPlayerAction/MsgPlayerAction` | `round` | 5 | Number |
| `MsgRoomSnapshot/PlayerSnapshot` | `respawnProtection` | 44 | Interface |
| `MsgRoomSnapshot/MatchSnapshot` | `groundItems` | 17 | Array<GroundItemSnapshot> |
| `MsgRoomEvent/MsgRoomEvent` | `groundItemDropped` | 25 | GroundItemSnapshot |
| `MsgRoomEvent/MsgRoomEvent` | `groundItemPickedUp` | 26 | inline Interface |
| `MsgRoomEvent/MsgRoomEvent` | `groundItemRemoved` | 27 | inline Interface |

`respawnProtection` 的 skillId 和 expiresAt 分别为 nested field 0/1。
`groundItemPickedUp` 的 id/playerId/itemTableId/quantity 为 nested field 0/1/2/3；
`groundItemRemoved` 的 id 为 nested field 0。

新增 `MsgRoomSnapshot/GroundItemSnapshot` 按声明顺序使用 property ID 0–12：
`id/itemTableId/quantity/modelId/texture/soundId/effectId/x/y/z/source/ownerId/createdAt`，
其中 `ownerId` optional，其余 required；`texture` 与 `source` 使用字符串 literal union。

source branch 早于部分 actual dirty 用户字段，branch 内不提交这些字段。字段号以
actual dirty 的最大 ID 后追加，实际补丁与 shared-current-source 的目标编号一致。
来源的 Treasure 0x58 记录未映射到本文任何 owned/ground 字段。

## Limitations

- 本批未运行 build、typecheck、测试、生成器或真实联机验收；本报告不替代实测。
- 掉落概率、dropitem 档位到具体 itemTableId 的映射、类别 6 入账和接触半径仍是
  `ground-item-business-design.md` 中的采用规则，不是原 Windows 服务端逐行为证明。
