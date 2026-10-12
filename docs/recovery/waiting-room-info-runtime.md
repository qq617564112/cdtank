# M5-03-I 原等待房间资料

正常等待面板现在显示权威房间名称、原地图名称与说明、实际生效时长和加锁图。房间名称来自服务器RoomState，不从建房草稿重造；地图资料来自对应mode/map的原m001–m005表MapName/MapInfo。有效时长由World现有timeLimit政策提供，WAITING.remaining=0不会覆盖房间配置；显式运行参数覆盖原表Time时，显示实际有效参数。

## 正式边界

config.ts只增加可选ModeMapConfig.description及原MapInfo加载。rooms/snapshot.ts只读RoomState，生成可选roomInfo；共享协议RoomInfoSnapshot承载name/mapId/mapName/mapDescription/timeLimitSeconds/hasPassword，serviceProto重新生成。快照不暴露密码、salt或hash；hasPassword为布尔值，沿既有普通Join校验。

WaitingRoom读取快照通过waitingRoomInfo纯投影，将文字textContent填入room_main.xml原txtRoomName/txtMapName/edtMapDesc/txtGameTime及picLocked。原描述区域保留源矩形，长文本可滚动且键盘可聚焦；不解释HTML。源短名称区域保留原矩形且textContent完整，可聚焦并以原生title读取完整名字，不改变源控件位置。

旧快照没有roomInfo时名称为“资料不可用”，时间为“—”，描述为“服务器未提供房间资料”；空说明显示“暂无地图说明”。不从roomId/remaining/历史选择推断地图信息。key包含资料，因此换房或资料变化重绘；clear清理旧资料，不保留前房地图说明。资料一致的正常tick不会持续重置滚动。

## 来源与未完成边界

源布局和固定图片沿M5-03-W的room_main原153控件及源资源验证。原地图表字段有现存内容可对照；Web roomInfo/TSRPC及控件适配为明确重建接线，**未恢复原房间网络记录、原资料回调与控件数据生产的完整因果链**。有语义不明的原txtRemainTank及其他生命/存量字段继续不接；头像/称号/房主开始与邀请仍由完整M5-03恢复。本片不把原静态字段映射当作原WindowsUI逐像素等价。

## 验收范围

`npm run test:rooms:waiting-info`覆盖26真实mode/map的原名称说明Time、正式World快照及目录房间名对应、密码错误不入房、秘密无下发、投影独立无副作用、显式17秒覆盖区别于表300秒、旧快照无猜测、空说明及HTML字面字符串。结果waiting-room-info-rules.json/log。

`npm run test:rooms:waiting-info:browser`验证真实独立双网页密码建房/拒绝/正确Join后的源资料同步，原控件实际图像/源文字及1080p4K，离房后新建另一模式地图公开房资料更新/解锁与无旧文字。browser-waiting-room-info.json以及waiting-room-info-browser.md保存具体执行与限制。

协议生成、全仓类型、267正式模块依赖边界、两侧独立发行记录在waiting-room-info-{protocol,types,boundaries,build-server,build-web}.log。此片仅资料读取与表现，不修改战斗生命周期、CPU普通输入或账户保存；使用既有连续两局及重启恢复基线，不为新增快照描述重复这些检查。
