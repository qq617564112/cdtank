# 我的家角色查询失败时保留原根

M5-07/UI-32与M5-08/UI-34。HomeRoles的ui.json和原字体资源独立于OwnedRoles/RoleProfile查询加载，原myhome根、战车/宠物静态主要区域、页签与Close不依赖账户查询成功。busy仅表示真实业务pending；查询结束失败后导航可操作。缺资料时名称、余额、数量与拥有值留空，不生成拥有/预览/出击状态。错误说明为Web业务反馈，切战车/宠物保留真实原因。

归属仅home-roles.tsx资源/业务加载与ui-only根渲染hunk，保session active/abort、SelectRole权威save、confirmed preview、cleanup原焦点、初始候选返回逻辑。resources commit在body/dialog时条件focus Close沿已接受hunk，不覆盖主动焦点；HomeSourceRoot共享模块/App/协议/房间规则不改。字体/原producer不再调查。

专属tests/browser-home-role-resource-error.mjs以空普通账户正常打开Home，实际停止独立server后打开tank使真实连接查询失败；ui/fonts仍从正常Vite资源取得。验源根/错误/可用pet页签，两个子页未知资料留空，最后一张1920实际错误整页与原生Escape漏键空/严格Home焦点。0BUY/SelectRole/Equip写入/Ready/对局；基准与既有三res、正常拥有与save业务证据复用。本片不关闭完整93/64控件或原页面1:1父项。

## 实际交付

19-58-13-729Z 唯一首raw PASS：真实server停止后连接创建失败，tank/pet两个源根Close皆来自myhome.xml，页签enabled、名称空、owned名单0、无preview/临时loadingClose，切页仍保留同原因。原生Escape时activeElement在dialog内，window漏键[]，关闭后严格Home可操作焦点。最终pet-error-1920整图亲看源主要区/页签/Close完整，白字错误可辨，不将框下Web原因当原callback恢复。focused Webtypes exit0，3387/5437/9637和临时目录清理。accepted有限范围交主线，父不勾；既有正常拥有选择/三res和事务不重跑。
