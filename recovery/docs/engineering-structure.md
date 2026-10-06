# 工程结构整理与首个业务切片

完整复刻范围不变。E-01从已经具备真实账户、联机和页面验收的迷彩配置贯穿业务开始；每次迁移保留相同协议、交易与渲染规则。E-02至E-06按tasklist逐阶段落实，不一次改写整个仓库。

## 已落实的职责

| 位置 | 负责的行为 | 依赖和限制 |
| --- | --- | --- |
| apps/server/src/accounts/tank-textures.ts | 原目录加载、可用组件/资源资格、账户鉴权、准备阶段许可、完整TankTextures请求与确认后房间同步 | 原子账户事务仍由AccountStore持有；使用现有World公开方法，不读取其内部状态 |
| apps/server/src/index.ts | 注册迷彩模块、组装连接账户/房间映射与广播回调 | 其余账户/房间处理逐片迁移，未宣称整个启动入口已整理完成 |
| apps/web/src/network/accounts.ts | 七个现有账户/库存/资料/装备请求的连接等待、错误和确认处理 | 复用Battle拥有的同一已认证连接，不新增连接或第二套账户身份 |
| apps/web/src/interface/home/ | 战车/宠物原界面及迷彩草稿、预览、服务端确认与释放 | 当前其他原界面/预览/图集仍留旧位置，后续以功能依赖迁移 |
| recovery/evidence/tank-textures/ 与 role-pose/ | 原执行codec/确认/费用/拥有字段取证与对照 | 与正式服务不同入口，输出仍为recovery/output，没有源脚本复制或兼容空壳 |
| tests/render/effect-model/ | 独立模型渲染验证HTML/代码/Vite配置 | 引用实际生产渲染模块；独立dist/validation/effect-model，与dist/web分开 |

Battle暂保留既有账户方法作为页面迁移期间的调用入口，实现已委托AccountConnection；下一片迁移剩余界面时再收缩该入口。World没有在本片拆分，房间、战斗、玩法和结算的拆分继续通过现有业务验收分别实施。

## 命令与入口

- `npm run build`：现有正式Web构建与全仓类型检查，输出dist/web。
- `npm run dev:server`：现有正式服务启动。E-05已提供build:server/start:server及独立CommonJS发行package，部署与运行配置见runtime-deployment.md。
- `npm run render:model:dev` / `render:model:build`：模型验证的独立启动/构建。
- `npm run test:runtime:account-textures`：账户事务与真实双连接/服务重启验收。
- `npm run test:runtime:cpu-two-rounds`：五模式CPU/本人托管普通输入各连续两局。
- `npm run test:evidence:tank-textures`：移出的原native与CTS合同对照。
- `npm run test:architecture`：检查正式main/index可达的本地静态依赖，不允许导入tests、evidence或render-check。

依赖检查覆盖相对静态import、export-from和字符串动态import；不证明变量拼接的动态路径、所有资源引用或全部未接入模块。现有其他render-check仍留在客户端目录但不由正式main导入，继续迁移属于E-03。当前main仍包含历史资产查看操作，正式发行页面与查看器的完整隔离另按E-03/E-05交付。

## 迁移后的验收

真实账户迷彩事务与网络验收保留原费用、所有记录/资料字节、回滚、拒绝无写入、WAITING取消准备/双端同步、PLAYING拒绝及服务重启恢复。正常网页须验证实际预览URL、确认和余额、拒绝恢复、账户隔离、刷新重启与释放。独立模型验证保留44原样本像素和生产源树清理；CPU保留五模式两局普通输入自然终局/再战/清房。详细命令与结果在E-01原位登记。

本片迁移后记录：engineering-account-network.log、engineering-texture-browser.log、engineering-cpu-two-rounds.log、engineering-texture-evidence.log、engineering-pose-evidence.log、engineering-runtime-boundaries.log、engineering-slice-final-types.log、engineering-slice-build.log。模型独立构建与44帧实载证据见engineering-render-entry.md和browser-effect-model.json。

下一阶段账户处理已收拢accounts/api，房间API和输入注册继续收拢rooms/api与battle/input，index缩至137行；结算计算移入settlement/match-result，World其余拆分仍在E-02进行；E-05独立构建与仓库外全新生产依赖部署验证已通过，详见runtime-deployment.md。
