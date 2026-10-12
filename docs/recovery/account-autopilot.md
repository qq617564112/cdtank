# 本人账户战车AI托管

对应M1-11/M1-13。正常玩家先在我的家配置自己拥有的道具，再加入房间，点击“AI托管我的战车”。托管使用当前参与者和账户，不创建库存、不赠送物件、不复制玩家物件给独立CPU。按钮可以切回本人操作。这是重建的自动操作入口，尚无原客户端托管功能依据。

## 正式链路

Autopilot请求仅含当前round及enabled；服务端从当前连接解析自己的playerId，不接受目标玩家或账户ID。World核对房间/回合及非CPU参与者，切换BotController并清空原移动/开火输入。准备阶段切换取消该玩家准备；托管者仍属于真人，必须正常准备、同意再战，不参与CPU自动投票。

模拟节拍使用与独立CPU相同的BotController，破坏目标协调读取CPU与托管队友当前目标，读取实际位置、生命、服务器上限、快捷槽和库存，发普通移动/瞄准/开火/useItem输入，再由World原权威入口处理。托管输入与本人输入各有序列水位，托管期间忽略本人输入，结束后不让AI序列阻挡本人低序列。再战保留托管选择，重建策略控制器并重置AI水位；本人网络水位仍保留，以拒绝上一局旧包。退出删除参与者，重新入房默认本人操作。

原饲料施放门禁、恢复量、事务及效果处理仍共用healing-item-runtime.md的正式链路。消费回调从原真人连接解析账户并提交真实持久事务；普通新增CPU仍为空库存，没有伪装真人账户或持久消费来源。

## 当前验证

- `npm run test:cpu:autopilot:modes`：五模式各两局，托管本人均正常移动/开火/命中，所有局自然终局/冻结/再战/清房，保存原float位值及逐局剩余数量；模式1/4自主耗尽3份并在第二局保持0，模式2本次消费1份并保持剩余2份，模式3/5本次样本未消费、重开数据库仍3。时限/生命/伤害不覆盖，允许自然超时；破坏图0020两局自然超时仍有未清目标，不把自然超时算全清。证据autopilot-match.json、各autopilot-match-mode文件、autopilot-five-modes.log。此为World模拟节拍，非五模式网页/原规则验收。

- `npx tsx tests/account-autopilot.cts`：明确账户迁移三份饲料及保存第4槽；本人托管沿普通输入自主战斗、自然受伤、消费三份，两局自然终局，再战数量不补回，真人投票保持，离房清理及数据库重开一致。关闭托管后sequence1普通移动仍生效，AI没有占用本人水位。证据account-autopilot.json。
- `npx tsx tests/account-autopilot-network.cts`：隔离3139正式服务器、两独立账户，正常Autopilot/Ready请求，AI自主开火并受到自然命中后使用唯一一份饲料。两端施放/效果相同，另一账户不被托管；托管期间sequence1000本人输入被忽略，关闭后sequence1正常移动通过。拥有/本局1→0、重启数量0及原float位值/槽4保持、账户隔离通过。证据account-autopilot-network.json/log。
- `npm run test:cpu` 与 `npm run test:combat:healing`：五模式CPU两局及既有饲料施放/消费/自然两局回归通过。日志autopilot-cpu-regression.log、autopilot-healing-regression.log。生产构建与最终类型检查通过，见autopilot-final-build.log、autopilot-final-types.log。

`npm run test:cpu:autopilot:browser -- <CDP>`：两个独立正常网页，明确迁移唯一一份库存，经我的家正常配置第4槽、房间添加三CPU、本人点击托管按钮与真实鼠标准备。无真人移动/开火/道具键；AI自主恢复200生命并消费1→0，双端Effect11各5实际绘制节点/tag_body挂点、GA15真实playing/自然ended和效果自然结束通过。两局CPU/托管正常战斗均自然目标终局，53/69次同tick玩家状态匹配、五人结果一致；房主加三CPU4票仍FINISHED，另一真人同意才再战，托管保持但库存拥有/本局0、不再施放。退出全特效instances/voices均0，重启服务器/新网页加载后正常库存页“宠物饲料 ×0”、槽4实例77/token保持。证据browser-account-autopilot.json、account-autopilot-reentry-browser.log、autopilot-battle-1.png/2.png。本次命令包含`--reentry`（package脚本已默认带入）：重启后经正常新房/三CPU/另一网页加入与准备再次开局，拥有/本局0和槽4实例77保持；新入房默认手动操作，正常再次点击托管后自然命中、没有itemUsed，双端正常退出。此处证明托管零库存分支，非托管剩余库存分支的双网页重入尚未执行。实际画布426×240，仅流程/资源验收，不代表高清性能或原像素精确。此入口支持本人账户自动操作，独立CPU持久账户/库存管理、原施放规则、全部道具和高清精确效果仍未完成，M1-11/M1-13保持未勾选。

## 双网页1080p自然两局

`npm run test:cpu:autopilot:hd -- <CDP>`保留以上正常输入/两局/重启重入流程，两网页均1920×1080实际canvas，DPR1、hardwareScaling1，无后备降采样。当前原ambient-only MV3接入后两局分别约67.8/86.4秒自然目标终局，35/52次同tick状态匹配，库存1→0并跨局/重启/正常新房保持、Effects11/GA15双端绘制播放/自然结束通过。证据`browser-account-autopilot-hd.json`、`mv3-sampler-autopilot-hd-browser.log`和`autopilot-battle-1-hd.png`/`autopilot-battle-2-hd.png`。

SwiftShader软件WebGL2、两端同时运行且与构建/另一软件渲染实验并行下共380/384战斗帧，帧间隔p50约393.2/388.7ms、p95约1041.4/1041.6ms。流程通过，但当前环境性能不满足流畅实时；不能当作独立显卡性能结论或全部M7-02通过。1440p/4K/DPR2完整对局、全内容/组合和内存成本仍待验收。

本次旁观网页经正常滚轮拉远并等待半径≥4000及惯性偏移<1，避免把原画面外特效裁剪计为未绘制；准备前仅正常镜头操作，没有战斗/效果/相机状态注入。镜头与运行负载不同，帧间隔变化不作为严格材质性能收益证明。
