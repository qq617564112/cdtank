# 原坦克运动烟尘

原三、四部件坦克均保留 `_root\online\001`，在未完成目标位置运动的更新分支中，使用 `tag_efsoot` 世界位置启动该效果。网页 `TankView.advanceAnimations` 现已在同一履带周期消费该启动，不增加生命比例或服务端事件。

| 原入口 | 合同 |
| --- | --- |
| `46a21a–46a244` / `46d709–46d733` | 模型加载后查 `_root\online\001`，取效果对象并登记至 actor `+1fc` 保留向量 |
| `5be560–5be56a` | `5c85e0` 的原字符串 `tag_efsoot` 构造到 `6d22e4`；不是按名字猜效果身份 |
| `46753f` | 已证目标位置门禁 `4660a5` 为 false 时调用 virtual `+64`；停止或无目标不调用运动周期分支 |
| `46aaef` / `46e0e3` | 累计严格超过 float32 `.1`，累计归零并切一次履带相位，随后查 `6d22e4` 挂点 |
| `46ab5c–46ab94` / `46e150–46e188` | 挂点存在且矩阵非单位矩阵才转换零向量，取得世界位置 |
| `46ab9a–46abc4` / `46e18e–46e1b8` | 遍历 `+1fc` 保留向量，每个效果 virtual `+38(position)` 启动；不是每次重新创建效果 |
| `47eed3` | world-position 启动将三坐标复制到效果 `+14/+18/+1c` |
| `46995d` | 模型清理遍历保留向量，依次调用 `47f3c4`、`47f262`，最后清向量 |

原效果库根节点2424；子组2814；四个粒子节点2425、2455、2815、2816均使用原 `data\effect\effect\yan1.tga`。资源树身份由原模型加载查找直接确定，未从纹理名推导触发条件。

`tests/role-movement-dust-source.py` 保存上述原指令字节，并执行完整 `46aaef` / `46e0e3` 的新效果分支。八个定向边界记录包括三、四部件的正常启动、缺挂点、单位矩阵和未到周期；真实调用参数均为供给的挂点转换输出 `[123,7,-456]`。结果 `PASS_ORIGINAL_MOVEMENT_EMISSION_BOUNDARY`，证据 `recovery/output/role-movement-dust-source.json` 与同名日志。原目标运动门禁和周期时基直接复用已验履带合同，不重跑该专项。

`role-movement-dust-tree-native.py/json/log` 执行完整原001六节点树的两次 world-start、粒子更新、自然尾段和显式停止。原modifiers由实际loader读入，所有节点保留；两次启动之间已有粒子沿原逻辑保留，尾段没有子节点释放。空间分配、child table、确定性CRT随机及管理器单位矩阵为明确边界。

`EffectRuntime` 提供 `retainMovementEffect(view)`、`startMovementEffect(handle,worldPosition)`、`releaseMovementEffect(handle)`。角色attach准备一棵不启动的保留树；角色有源挂点、非单位矩阵、存活且现目标运动周期切换时，TankView更新挂点后通知世界位置。重复启动复用handle，停止移动后不新启动，粒子自然结束但句柄保留。detach、round clear、Leave clear显式结束并释放树；晚资源准备只消费之后的新运动周期，不回放旧周期。

`tests/role-movement-dust.cts` 对比原重复启动各步的phase、controller、粒子数和位置，并核真TankView周期/缺挂点/单位矩阵/死亡门禁及runtime单owner保留/重复启动/释放后不启动。结果 `PASS_RETAINED001_CONSUMER_MODULE`；原001无声音节点，模块音频边界若收到play即失败。Web strict types通过。普通玩家实际绘制与离房证据独立验收。

## 普通玩家证据

`browser-role-movement-dust-2026-10-05T01-20-13-111Z.json` 为合法mode1/map7四正常Account、双React正常Ready及原生W移动。预房原tank1/pet1拥有为明确fixture，库存为空。两端共同记录P1从原出生点到 `(-77.94,348.99)`，P2到 `(103.48,379.15)`；没有活跃位置、HP、相机、时间或事件注入。每端P1重复使用同handle，四原粒子2425/2455/2815/2816真实提交。全片tree sound play记录0；停止移动后四粒子phase3、count0，保留树仍归原角色；双Leave instances/meshes/skillVoices/treeVoices/battleVoices全0、world为空。验收文件 `role-movement-dust-actual.cts/json/log` 只接受普通触发、draw、静默、自然尾段及Leave。

`browser-role-movement-dust-visual-2026-10-05T01-22-47-702Z.json` 为唯一必要画布补段：host普通W800ms，guest观察，沿原时基采六张640×360自然完整帧。P1树elapsed分别为host `.5401/.9522/1.0129`、guest `.5588/.7567/1.1485`，活跃粒子数9或10，原节点真实draw；双Leave同六0。两次画布亲审都未取得足够可辨的独立烟尘像素，视觉保持未通过，停止第三次同入口采图。原raw保留 `PASS_RENDER_PENDING_PIXEL_REVIEW` 的仪器范围，不改为像素PASS。

## 限制

触发入口执行供给空间积分、挂点查找/矩阵转换、保留向量和效果启动边界；没有宣称完整模型loader已执行。普通双端独立可辨烟尘像素、HD、死亡/复活/再战像素仍未验。本合同没有读取HP，不证明低血烟雾或独立残骸；原受击 `467209` 使用 `%d` / `+%d`，属于伤害数字格式化。网页目标运动门禁沿现权威快照插值目标，区别于原3aa6命令。
