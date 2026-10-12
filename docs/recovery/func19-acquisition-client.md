# Func19 获取与客户端入口

item12501/02/03 的原 ID 分类为 7，商品页因此归入 Mark，而不是 Common 部件。
普通 Shop QUERY 同时返回这三行真实商品时，Part 页的 Mark 页签启用，并按当前分类
显示 QUERY 返回的 `itemTableId/name/info/iconId/moneyPrice/tokenPrice`。Common 原有商品
保持显示；Hat 没有商品时保持禁用；客户端不合成商品、模型、字体或布局。

选中 Mark 商品后，仅在该商品的正价渠道中选择币种。只有软星币为正价时选择
`TOKENS`；零价渠道不列出、不提交。购买仍发送现有 `ReqShop {operation:'BUY',
itemTableId, quantity:1, currency, requestId}`，请求 ID、失败重试、库存重查和余额确认
沿用普通 Shop 事务。客户端不在失败时写入拥有记录、技能或本地奖励。

正常取得路径为：普通 Shop 购买真实 item12501/02/03 → 账户 inventory 产生 owned
记录 → Home 装备页在 Mark 页签选择实例并调用现有 `Equipment` 保存入口 → 真实角色
技能来源经现有 `selectRoleSkills` 解析 item 的 `ItemSkill1` → 结算时由现有 World 冻结
路径调用 `readResultRewardModifiers` 使用真实 `selectedSkillIds` 的 Func19 倍率。
原有服务端 writer 未在本轮恢复，购买后不会自动装备或自动选择技能；本文件不声明
购买即产生结算倍率，也不替代尚未执行的实测。
