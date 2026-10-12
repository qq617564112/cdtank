# Gate/Switch 原入口缺口

M3-08需要不同原class的开关/运动消费者。当前具名Gate/Switch候选尚未定位原入口，不能据英文名称创建新class或权威许可。

`scene-gate-switch-entry-gap.json`记录限定来源核查：现有原`scene-placements.json`没有className匹配Gate/Switch的记录；原`CDTank.exe`没有`SYcScnObjGate`、`SYcScnObjSwitch`字符串，也没有同时含Scn与Gate/Switch的可打印字符串。现`scene.py`没有这两个专用尾部解析分支。结果不证明其他原class没有开关行为。

具体缺少原placement/model身份及具名loader或state/event入口，尚不能确定合法地图、原状态映射、玩家触发方式或向主线提出可实施的权威接口。生产ScenePreview、共享hook与服务器均未修改，无native或玩家运行。本候选保存为SOURCE_ENTRY_NOT_LOCATED，M3-08父项保持开放。
