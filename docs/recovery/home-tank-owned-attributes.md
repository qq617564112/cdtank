# Home 战车拥有属性

M5-07/UI32。正式拥有战车页的 txtAttack、txtAttackExtra、txtPanzer、txtPanzerExtra 原位置分别接当前候选 OwnedRoles.equipment.fields 的 0x3c、0x40、0x4c、0x50。正常 TankShop 建档已从原表赋这些字段，建档规则明确重建；本页只查询现确认数据，不读取商品目录当作当前拥有值。

UI owns home-tank-source-page.tsx 四值呈现与 record prop、home-roles.tsx displayed prop 透传、home.css 本页可读样式和专属 browser/source/doc。无 App/shared/协议/账户事务/战斗数值/场景生命周期改动。未确认记录保持空白，原 setter、成长/侧背/运动参数未知，不按零猜补；原图自带单位符号不追加公式。浅底深字用 Web 可读呈现，原字体颜色和最终 1:1 精度未证。

基准800×600，沿现正式原根/父链/等比居中。首次必要范围为普通真实购买两个战车实例作为拥有上下文，候选切换时四值与实际 OwnedRoles 一致，主要资料区800/1920/3840整页图及源关闭严格大厅Home焦点。0SelectRole/Textures/Equip/对局，不重余额/持久/战斗。保留本次临时数据库的证据副本和保密token文件，供后续必要只读复用；原输出不打印token。

完整 UI32 页面、原 setter、全部属性与 1:1 父项保持未完成；完成后交主线限定审查，不自勾父项。

## 实际交付

19-24-49-056Z 首 raw PASS，正常BUY3/4仅本页必要拥有上下文；当前候选游骑兵122/78/17/44、飞毛腿110/70/15/33均与OwnedRoles实际field和文本相同。三整图已亲看，原根/模型/主要名单/描述/攻击装甲四值在场，深色可读；高清字距/4K物理字号仍有旧缺口，不称原版1:1。0SelectRole/装备写/Textures/对局，源Close严格回Home。focused Webtypes exit0。

原表建档值明确重建，本页没有根据目录自行补拥有值或装备加成。其余参数/成长未知留空，父项不勾。代码/三图/raw/source及accepted索引交主线审查，工程沿统一batch。

### 证据数据库限制

raw的 fixtureSavedForReadOnlyReuse=true 只记录文件复制成功，不能证明副本完整。随后只读SQLite核查显示副本无role_records表：本轮server采用WAL，直接复制main文件没有提交完整页。保留副本与fixture并显式usableForReadOnlyReuse=false，不作为后继真实账号基线；token不输出。runner未来保存前先执行wal_checkpoint(TRUNCATE)，本轮不重跑BUY/图来修副本。该保存边界不影响此前浏览器真实网络OwnedRoles/候选/整图证据，但后继只读复用条件未完成。

专属3383/5433/9633已关闭，临时库与Chrome目录清理。
