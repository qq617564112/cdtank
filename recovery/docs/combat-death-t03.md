# 战车003死亡表现来源与正式加载缺口

对应M3-04/M4-09既有全车型动作范围，不新增已完成子项。数值线拥有专属source/browser/doc/output；通用TankView/EffectRuntime、UI、场景生命周期和服务端规则未修改。本片与战车001/105已验范围分别记录。

## 原来源

`tests/combat-death-t03-source.py` 对原003四INI、MV3事件与完整692字节003.elk解析结果和已发布资产逐值比对，`combat-death-t03-source.json/.log` PASS。

| 部件 | 原死亡动作 | duration | 定时消息 |
| --- | --- | --- | --- |
| M | Data/role/003/09M.MV3 | 5601 | time160 effect1/1416378268 |
| U | Data/role/003/09U.MV3 | 5601 | 无 |
| X | Data/role/003/09X.MV3 | 5601 | 无 |
| Y | Data/role/003/09Y.MV3 | 5601 | 无 |

四01原动作duration3201。完整003.elk仅03/attack1→online004/tag_efattack/bindingMode3，没有09组。既有正式life(false)→09时钟/消息consumer应保持死亡lookup为空，不添加105的006/GA12或通用替代爆炸。原时钟、尾帧5501与alive复活切01引用已有通用消费者证据，本片没有新的Windows测量，也没有新的服务端死亡/复活政策。

## 正式验收入口

`tests/browser-combat-death-t03.mjs` 独立3461/5491/9691，复制正常BUY3/pet2/SelectRole形成的原生SQLite checkpoint，通过私有已有身份认证。未注入拥有、库存、profile、活跃位置、HP、事件或时钟。普通React mode4/map7建房、CPU加入、另一账户Join，之后计划用普通Space/炮塔输入自然击毁、双端四09/原尾帧与自然复活01、死亡静默及Leave清理。软件640×360仅表现范围，不代表HD性能。

`combat-death-t03-player-gap.json` 保存全部原始FAIL与具名范围。当前最后记录01-54-12已到正常三玩家WAITING，客端显示购买tank3/pet2、HP700/700，但mapLoaded=false/renderedPlayers=0，未Ready，未发送战斗输入，未观察死亡/复活。原输入入口已经能到CreateRoom→AddCpu→Join→RoomSnapshot；缺的是Battle.enter的地图/角色资源完成→render/reconcile→mapLoaded/renderedPlayers发布，原因尚未确认。下一待查入口为运行时异常或资源加载错误；专属runner已增加Runtime.exceptionThrown/Log.entryAdded只读记录，未在无新依据时重跑。

3461/5491/9691监听关闭，本线运行进程0、临时目录0。该清理仅是进程清理，不冒充页面Leave或资源计数验收。所有raw保留FAIL，没有accepted索引、death像素或实际声音通过结论。停止同加载入口复跑；具名原因或正式接口修复出现后才恢复受影响范围，M3-04/M4-09与全部车型父项保持未完成。

当前依赖闭集已按实际购买字段核对：003入场01/05/06/07/08/09与map0007 terrain/placements共32个GLB，119项图像/缓冲引用以及所选30041/30042/30013的四PNG均存在。此检查只排除当前磁盘缺失，不证明HTTP成功、浏览器解码或模型入场完成。

专属仪器在正常建房前读取并观察ScenePreview.load、MapSceneEffects.load、MapEnvironmentSound.load和BattlePlayers.loadPlayer，记录调用参数、performance时刻、pending/resolved/rejected与错误。包装器调用原方法一次并返回原Promise；不改变结果、快照、状态、事件、输入或渲染。与Runtime/Log错误一起，在失败finally保存各端阶段记录。语法检查通过，增加阶段观察后未重跑对局；下次受明确修复影响的验收须先据此定位阶段，不能仅将45秒仪器超时改大并宣称加载问题已解决。
