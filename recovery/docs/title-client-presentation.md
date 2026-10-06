# 称号客户端展示

## 结论

称号数据由服务端账户权威生成并通过 `RoleProfile` 返回。客户端只呈现已确认的拥有清单与当前佩戴称号，不本地授予、不推算等级或累计成就，也不伪造默认称号。

## 数据来源

- `PtlRoleProfile`：`ResRoleProfile.titles?: AccountTitles`，`owned: OwnedTitle[]` 只含真正已授称号，`selectedTitleId` 为当前佩戴。`ReqRoleProfile.selectTitleId?: number` 表示带值选择、`0` 主动清空、缺省为查询。
- `MsgRoomSnapshot.PlayerSnapshot.title?: PlayerTitle`：仅在佩戴时出现，CPU 无真实账户不生成称号。
- `PtlLobbyPlayers`、`PtlFriends`、`PtlBlacklist` 的玩家记录各自带 `title?: PlayerTitle`，供普通玩家资料展示。

## 采用与佩戴交互

- 我的家 `myhome_playerpage.xml` 的 `txtPlayerTitle` 显示 `owned` 中当前 `selectedTitleId` 对应的名称；无选中称号保持空白，不填模板或 `0` 名称。
- 原 `rdoTitleSummary` 页签打开原 `myhome_playerpage_titlesummary.xml` 的 `lstTitles` 几何，逐项列出拥有称号名称与原始描述，空清单保持空列表。
- 选择一条称号经 `battle.roleProfile(selectedId)` 提交；服务端确认返回新的 `titles` 后才更新列表高亮、正文与当前称号。`0` 主动清空通过列表外的“清空称号”动作触发。
- 请求进行中或遭拒绝时保留当前选择，错误信息沿我的家既有反馈区展示；焦点在确认后仍留在原控件。

## 其他消费者

- 大厅社交资料把玩家记录中的 `title` 透传到 `PlayerInfoPlayer.title`，`playerlist_playerinfo.xml` 的 `txtPlayerTitle` 显示其名称；离线好友称号沿用既有好友回包，不猜昵称或战绩，不额外请求原资料 `privatebits`。
- 等待房 `room_main.xml` 的 `txtPlayerTitle0..11` 按每位玩家 `title?.name` 显示，无则空白；CPU、托管与“你”等既有标记仍由原控件承担，不当作称号授权。
- 战斗 HUD `game_main.xml` 的 `txtPlayerTitle0..11` 映射 `PlayerSnapshot.title.name`；无称号保持空白，不使用固定模板当作已授成就。

## 限制

- 原“选择/佩戴称号”请求 opcode 与成功回包字段未恢复，选择运输按 `RoleProfile.selectTitleId` 重建。
- 称号授予、选择/清空三态与双端持久化未在真实联网、双端页面与重启场景下验收。
- HUD 与等待房的实际像素对齐、跨分辨率表现未做浏览器实测。
