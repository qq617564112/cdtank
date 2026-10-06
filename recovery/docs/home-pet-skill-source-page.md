# 拥有宠物技能只读详情页

UI35 / M5-08。六个原btnViewSkill入口消费myhome_petpage_skill.xml十四控件、800×599根与200×272主框。独立portal按800×600基准同比呈现原框、技能名称、确认等级、介绍、下级介绍、费用、学习与关闭区域。

数据精确读取真实OwnedRoles技能ID字段0x44+4×index和等级字段0x5c+4×index，按combat-catalog的skillId匹配name/info。介绍为原表元数据，等级为服务确认拥有级别的Web投影。下级介绍、费用和缺少原Text的标签留空，学习禁用。名称与等级采用本模块SourceImageScale=1的96raster后随stage缩放，为Web基准可读适配。

文件为home-pet-owned-details.tsx六按钮消费者及pet-skill-source-view.tsx/css。共享SourceButton已加入myhome_petpage_skill.xml类型。实例变化关闭旧详情；鼠键关闭恢复当前原查看按钮；原Home角色选择、预览与账户事务保持既有合同。

实际证据为 `recovery/output/browser-home-pet-skill-source-page-2026-10-04T23-31-21-627Z.json`，状态PASS。800×600、1920×1080、3840×2160三完整截图已查看，十四控件均在视口内，八frame层映射。实例1的技能10221“大麦偷袭”、等级1与介绍精确匹配服务资料及目录；下一等级介绍、费用为空，学习禁用。源关闭按钮按下取得capture，外部保持捕获后释放回Normal且窗口保持；nativeEscape没有window漏键，恢复同一查看按钮。技能10211可另开并由nativeEnter关闭，恢复该查看按钮；角色页退出恢复可操作Home入口。

上下文明确使用资金-only夹具：新账户RoleProfile长度0x170，money+0x70=10000、tokens+0x74=1000，其余bytes为0，strings为空。资金不是普通业务取得。一次真实PetShop BUY pet2生成拥有资料，未注入角色、技能或库存，未执行SelectRole、学习、装备或对局。SQLite原生backup保存含WAL的后继库 `recovery/output/home-pet-skill-source-browser.sqlite`；私有token fixture权限0600，未输出token；该副本未作恢复验收。

全Web focused types `home-pet-skill-source-page-web-types.log` exit0。来源与验收封装为 `home-pet-skill-source-page-source.json`、`home-pet-skill-source-page-accepted.json`。root已亲审代码、raw和三完整图，accepted为PASS_CONFIRMED_PET_SKILL_READONLY_SCOPE并附mainReview。统一Webtypes/Vite构建 lobby-feedback-pet-skill-production-web-build.log exit0，2m50，包含最终consumer与共享suffix。

原查看callback、动态附着、等级相关公式/说明、学习费用与资格、原字体/framebuffer仍未知；长文本滚动与OS IME未验。此次仅确认只读消费者，UI35/M5-08完整父项保持开放。
