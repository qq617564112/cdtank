# 我的家战车与宠物拥有名单

M5-07 / M5-08 / UI32 / UI34。原 lstTank/lstPet 均为192×280 MultiColumnList，SelectionImage 与纵栏图片、MinExtent53明确。当前名单只有真实角色名字与当前标记，独立消费者保留原记录ID/name/selected/current，名单选择不执行SelectRole。预览、属性、技能、出击按钮及HomeRoles加载/事务/关闭合同保持。

新三个独立模块 home-owned-role-source-list/list-scrollbar/css 尚未import；parent范围仅home-roles.tsx旧名单JSX。无字体/Home父CSS变更。仅文字名单按自然文字行高呈现，minimum18/箭头步长18/8.5栏宽/DOMextent明确Webprovider；不套用带32图标的装备38行高来制造长名单。原动态列/工厂默认尺寸未知。

marker既有14000资金不足各六新增角色（最便宜tank3=2500、pet2=3500，合计36000），没有运行购买或资金注入。长名单首次实际依赖合法资金足checkpoint，或后续明确账户前提。准备与来源不等于runtime或完整1:1验收。

精确 parent JSX 候选保存 home-owned-role-source-list-candidate.patch，未写已import母模块；current 可选沿现 profile 尚未确认状态。短名单无overflow不代替长名单验收，不新增短list浏览器run。正常真实至少16名字行后才验新栏完整鼠键/capture/三res，source仅证明图片/界限，不关闭原筛选/动态列/1:1。
