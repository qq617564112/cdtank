# M5-14-C 动作备用键

本片让现有Web动作同时接受主键和一个可清除的备用键。正常键位页面每行提供主键、备用键与清除按钮；编辑只改变草稿，保存成功后同时更新生效配置。冲突、非法键和保存失败保留当前配置；取消丢弃草稿，恢复默认须另行保存。键位提示显示当前主/辅键。

当前原文件 `CDTank/Config/SystemSetting.ini` 中确有 `AttachedShoot/AttachedUseItem/AttachedPrevBullet/AttachedNextBullet/AttachedPrevItem/AttachedNextItem` 六个值为0的附属键字段；`MainUp/MainDown/MainLeft/MainRight` 和 `AttachedUp/Down/Left/Right` 也存在，但仅字段不能证明这两组都属于同一动作备用键。原完整主/附属方向语义、设置回调和全部DirectInput数值映射尚未恢复。本片的所有现有Web动作双键、无重复冲突策略及localStorage保存明确为重建规则，不伪造原函数或称完整原键位恢复。

旧 `cdtank.key-bindings.v1` 全主键配置继续有效，保留全部自选主键；新增可选 `secondary` 对象只含配置过的动作。没有配置备用键时行为与原Web单键一致。数据校验保持完整主键要求，新增备用键只能采用支持的code且不能与任何主/辅键重复；深复制避免未保存草稿修改当前配置。

BattleInput按每个动作的主/辅键是否至少一个按住计算输入，两个键不把移动/转向放大；释放其中一个仍保持动作，两个均释放才停止。配置替换、控件焦点及离场仍清按住状态。快捷键沿原普通useItem输入，以每次真实按下请求，repeat不追加；不改服务端库存、技能资格、数量或效果。本人托管隔离与现有50ms/序号行为保持。

正式文件归match/input-bindings与BattleInput、interface/settings；shared与服务端协议无需扩充。验收入口为专项 `tests/secondary-input.cts` 与正常真实网页 `tests/browser-secondary-keys.mjs`；页面与网络动作不可由Node夹具替代。完整原设置及教学继续由M5-14/UI-50逐项恢复。
