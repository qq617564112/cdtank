# 地图0018整体实现

对应MAP-4-0018及M3场景资源。原m004目录授权本图混战模式，正式房间资格由mode4/mapId18解析和创建校验；原最低4人、最多12人、时限300秒。

## 整图实现

原34个启用Breach包含05424×18、05442×16。`scene-placements.json`保留全部原放置；服务端在mode4/map18经`createSceneObjects`从`getSceneBreakables`中按这两个型号创建34个`ENV:<sourceId>`场景物件，每个初始200HP，普通弹丸以原OBB参与命中并写入HP及`sceneObjectHit`/`sceneObjectDestroyed`事件，快照随`sceneObjects`发送双端。

现存重建政策为：命中依次扣减HP，归零后标记`destroyedAt`、停止继续受击，破后2秒内保留原完好包围盒，随后由`syncSceneObjectCollision`移除动态碰撞；新局在`startRoom`按新`createSceneObjects`快照恢复全部34个物件与200HP，Leave经`resetSceneObjectCollision`释放动态碰撞。该政策明确为Web重建，`damageSceneObject`不新增分数、奖励或原刷新。

原4个General obj05018沿`scene-animation-0018.json`与SceneCvdAnimation的正式动画消费者；原地形Data/map/0018/0018.glb与六条BG07环境声音按各自既有加载入口。原BG07实体仍缺，现由`reconstructed/battle/BG07.wav`明确标记补作经`audio.json`解析到共享`MapEnvironmentSound`；六条原位置/参数不改。本图无Castle、Crush、Plant、水面或常驻Effect，不新增这些消费者。

## 独立消费者与加载入口

Breach完好材质/破损c9由`scene-breach-0018.json`（05424、05442）与ScenePreview的`SYcScnObjBreach`分支消费；General动画、地形材质与场景声音分别由SceneCvdAnimation、SceneTerrainMaterial、MapEnvironmentSound按mapId0018资格加载；ScenePreview正式load已含0018，常驻effects与environment sound已实现。

## 验收范围

原34条放置与源身份、两型号完好材质/c9、General动画、原地形及六原环境声音按各自既有证据范围复用。本图整图生产接线已按现metadata、放置链与场景消费者静态核对；本片只增加缺失BG07补作及共享catalog条目，未改运行消费者。未运行测试、浏览器、构建或类型检查。原服务器授权、HP、伤害资格、销毁时序、刷新/掉落、动态NAV、原BG07实体及高清父范围保持未完成。
