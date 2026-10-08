# 实体内容定义

宠物、战车、道具／炮弹／陷阱／装备及技能的正式定义统一维护在 `apps/shared/content/definitions/`。服务端与客户端读取同一来源，实体名单、名称、说明、价格、属性、等级技能引用、资源路径和实体到处理器的路由由 JSON 提供。

## 目录与读取

| 文件 | 内容 |
| --- | --- |
| `index.json` | 各类实体文件索引、属性限值、结算装备奖励与地面掉落规则 |
| `pets/{id}.json` | 10 只宠物，各一份定义 |
| `tanks/{id}.json` | 21 辆战车，各一份定义 |
| `items/{id}.json` | 204 个道具、炮弹、陷阱与装备，各一份定义 |
| `skills/{skillId}.json` | 342 条技能，各等级分别维护参数、效果与学习费用 |

`apps/shared/content/types.ts` 定义结构；`catalog.ts` 建立运行时查询及现有协议所需投影。旧合并目录和原表保留为来源资料，正式实体消费者读取上述定义。地图、称号和通用战车改装费用表仍使用现有资料入口。

服务端 `apps/server/src/content.ts` 在进程启动时同步读取并缓存。客户端 `apps/web/src/content.ts` 在进入游戏前读取 `/content/index.json` 与索引中的文件，同一页面会话共享缓存。修改定义后须重新启动对应服务端并刷新客户端，当前没有热重载。

Vite 的 `content-plugin.ts` 在开发时提供 `/content/`，发行时将 JSON 作为独立文件输出到 Web 包的 `content/`。服务端发行脚本复制同一目录到 `dist/server/shared/content/definitions/`；JSON 不嵌入 JavaScript。两端须使用同一批定义。

## 宠物与技能

宠物的 `name`、`description`、`prices`、`attributes` 与 `growth` 定义身份、价格和数值；`shop.available`、`starter` 与 `defaultSelected` 决定商城开放、注册发放及初始选用。CPU 新生角色也使用对应定义。

每个宠物技能槽维护 `baseId`、`initialRank`、`rankCap`、`levels`、`event`、`handler`、`target` 与可选 `condition`。等级通过 `levels[rank - 1]` 查找，技能函数、属性与效果由该等级的技能 JSON 提供。例如大麦得意：

```json
{
  "baseId": 10211,
  "initialRank": 0,
  "rankCap": 5,
  "levels": [10211, 10212, 10213, 10214, 10215],
  "event": "kill",
  "handler": "heal",
  "target": "self"
}
```

大麦四级对应 `skills/10214.json` 的 `attributes.HP = 160`。新购、注册与 CPU 的初始等级读取 `initialRank`，不使用等级上限代替已学等级。未开放第六槽保留空 `levels` 与零上限，不生成执行规则。

`PlayerState.petBattle` 接收实际受击、最终击毁、死亡、真实复活、生命与运动变化，并按配置分发。处理器名称选择通用执行函数；通用函数实现保留在代码中，实体 ID 与函数的对应关系维护在 JSON。支持已有处理器的新实体无需增加按实体 ID 判断的分支；新作用机制须实现对应处理器并登记名称。

`SkillDefinition.learning` 提供技能组、等级与费用。`runtime` 配置持续效果、角色队列周期、世界声音事件和奖励修饰字段，供技能展示、声音及结算消费者查询。

## 战车与道具

战车 `attributes` 与 `growth` 提供基础属性及改装成长；`prices` 为商城价格，`basePrices` 保留售卖／维护等业务所需基础报价；`textures` 为拥有记录的 U／M／XY 迷彩编号。`runtime.fixedTurret` 决定炮塔是否跟车体转动，`runtime.handler` 选择客户端模型加载器，当前使用 `tank`。`battleReward` 决定是否进入结算战车池。

道具的 `runtime.skillRoles.primary/secondary/tertiary` 引用技能定义，现有协议需要的 `skillIds` 由此投影，JSON 不再维护第二份引用数组。`runtime.use`、`hit`、`trap`、`passive` 分别路由主动使用、炮弹后效、陷阱与被动装备。使用事件读取玩家实际库存，命中事件读取实际弹药，装备事件读取实际装配槽位。

道具 `category`、`inventoryCategory`、`equipmentTarget`、`equipmentGroup`、`cpuAvailable`、`shop` 与 `runtime.values` 供快捷槽、仓库、装备、CPU、商品数量及奖励／掉落池使用。弹药查询方式、射程、速度、炮口偏移及项目攻防公式的补充参数同样读取 JSON。函数类型、协议字段偏移与通用战斗算法属于执行规则。

## 模型与贴图路径

路径相对于 Web 资源根目录，JSON 中不写开头的 `/`。实际加载字段如下：

| 实体 | 模型字段 | 贴图字段 |
| --- | --- | --- |
| 宠物 | `resources.model` | `resources.textures[0]`，传入 MV3 材质 |
| 战车 | `resources.components[].actions[].model`，按部件与动作加载 | `resources.textures` 按原材质名称映射默认路径；已选迷彩使用 `resources.textureVariants[].textures.A/B.asset` |
| 地面陷阱／饰品 | `resources.model` | `resources.texturePath` 为当前选用路径；`resources.textures` 保留导出资源目录 |
| 伪装替身 | `resources.disguise.model` | `resources.disguise.textures[0]`；`meshName` 与 `transparent` 配置材质目标及透明规则 |

战车由 M／U／X／Y 等部件及多个动作组成，没有代表完整战车的单个模型字段。改某动作的模型时修改对应 `actions[].model`，不能只替换车体模型。默认贴图按材质名称分别绑定，三部件战车中车体内的多材质也保留独立路径。`resources.trackTextures.A/B` 引用 `resources.textures` 的两个名称，控制默认履带帧；已选 XY 迷彩使用该迷彩自己的两帧。

宠物与战车的 `resources.animationSpeed` 参与动作时钟。弹药开火与战车击毁声音分别读取 `resources.fireSound`、`resources.destroySound`；通用音量和空间衰减仍由原声音目录提供。

道具 `modelId`、`modelType`、`texture`、`sourceModel` 与 `modelStatus` 保留原资源身份及导出状态。尚未找到导出资源时 `model`／`texturePath` 为 `null`，不拼接一个不存在的路径。炮弹的现有表现由定义中的技能特效驱动，独立模型缺失不等于该弹药没有战斗表现。

## 修改与新增

修改现有实体，编辑对应 JSON；修改某级技能，编辑该级 `skills/{skillId}.json`。技能路由、等级数组、道具技能引用和模型材质名须保持对应。价格与数值变化不会改写玩家已保存的拥有记录；新购、学习及实际重算各自沿原事务入口读取定义。

新增实体时创建对应文件并加入 `index.json`，配置资源、商城／取得资格及已有处理器名称。索引决定两端加载名单。默认选用宠物、默认选用战车和默认弹药分别保持唯一；默认选用角色须属于注册发放集合。

## 验证范围

已核对索引与原实体目录、道具字段／技能引用及已解析资源文件，迁移源码完成静态走查。2026-10-07 两端类型检查、服务端独立编译、Web 构建及 578 份独立 JSON 发布验证通过；编译服务的注册／商城／仓库请求与定义 HTTP 下载通过。十只宠物 50 个开放技能槽的最高级生命周期分发、大麦一级 40／四级 160 最终击毁回血、21 辆战车与 10 只宠物及已接陷阱／伪装／饰品的实际模型贴图加载和释放通过。测试条件、完整范围与证据见 [game-content-validation.md](game-content-validation.md)。

## 限制

正常首页的新页面已进入登录页，先前图片预加载的解码失败原因未确定，首次加载稳定性仍待验。生命周期检查使用明确技能与战斗夹具，不代表全部等级的自然联机实战；未发布或更新用户当前运行服务。

- 原 item3006 引用 skill4027，原 342 条技能表也没有该技能；定义以 `unresolvedSkillReferences` 登记，当前没有配置生产使用路由。
- 140 个独立 D3 模型引用没有对应导出 GLB，主要为炮弹、内部部件与标志，保持 `modelStatus: "unresolved"`。
- 5 辆战车的动作模型含 7 个未独立解析的原材质名称，以 `resources.unresolvedTextures` 登记。部分属于已有 XY 贴图覆盖的履带材质；登记不代表这些动作都缺显示，也不代表原材质资源已齐。
- 原始服务端规则、未开放技能、全部内容实战、原特效及高清资源父任务继续按 tasklist 保持待验状态。
