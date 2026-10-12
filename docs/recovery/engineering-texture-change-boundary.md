# 迷彩更换事务与确认边界

E-04本片整理正常账户更换迷彩→资格/费用→原子事务→共同确认→网页与房间同步。RoleTankTextureConfirmation唯一契约归shared/contracts/tank-textures；PtlTankTextures和AccountStore只消费共同type。OwnedTankTextures仍由真实双端规则使用，保持shared/combat/role-owned-textures。

applyRoleTankTextureConfirmation/evaluateRoleTankTextureRequest及内部Price/RequestDecision归server/accounts/tank-texture-change。原函数体、uint32费用累计/余额门槛、phase2/success3/通知顺序保持。AccountStore现有BEGIN IMMEDIATE/资格查验/确认应用/owned及profile更新/COMMIT或ROLLBACK事务直接使用新owner，没有抽象包装或转发。原reader/writer只供CTS对照，归evidence/tank-textures/role-texture-transfer-sol；旧shared混合入口删除，两个CTS按真正owner导入。

## 验收条件与结果

48原位对齐codec、216完整确认、1422真实表费用门槛通过（engineering-texture-change-boundary-evidence.log）。协议生成将确认schema移至唯一contracts定义；40组旧新请求/响应字节一致和双向解码、service编号不变通过（-protocol.log，迁移前完整schema保存在-protocol-before.json）。覆盖uint32高位实例/余额/三槽、各result、中文拥有记录与profile。

实际SQLite资格/原价格/110代币扣费、无变化/清槽/零价/拒绝/字段保留/第二次写失败回滚/重启通过（-accounts.log）。真实双连接确认扣费、WAITING刷新、PLAYING拒绝、隔离重启持久化通过（-network.log）。这两项证明实际账户事务及房间同步，不以codec对照代替服务端业务。

全仓类型、216正式可达模块无取证依赖、独立server构建通过（-types/-boundaries/-server-build.log）；296个JS/map发行检查原codec/旧shared入口不存在，唯一账户判定/应用保留且实际消费（-artifacts.log）。

独立Web构建与编译服务账户/迷彩联机重启保存、五模式CPU各两局通过（-web-build/-compiled.log）。正常网页付费更换/重复保存不扣费/不足拒绝/URLs/隔离/刷新重启/关闭释放通过（-selection-browser.log及独立-selection-browser.json）；正常战车宠物选择键鼠/来源控制/1080p4K/隔离拒绝/刷新重启通过（-roles-browser.log及独立-roles-browser.json）。

双网页AI普通输入两局90354/116118ms自然结束，结算一致与再战门槛、原Effect11/GA15及拥有迷彩保持；双方退出instances/voices均为0，服务重启后库存/快捷槽及重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。自然两局采用流程验收渲染设置，高清页面验证不证明高清全内容对局性能。

本片已验收勾选。下一E-04按准备/开局完整属性计算与发布的实际调用链整理，先拆必要基表/技能目录纯契约；剩余重算与验证helper以及完整技能/界面/玩法/高清多人仍按清单推进。
