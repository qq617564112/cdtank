# pet2六技能的正式角色绑定缺口

现有原证据没有证明Home选中pet2后，拥有宠物的六组技能会绑定到角色+a0。角色+2a4是PetTable定义指针；角色+a0是433466另行取得的拥有技能记录。两者不能因都涉及宠物或使用相同记录类型而合并。当前正式生命/精通与宠物头像来源成立，不代表六技能已经装配或产生作用。

## 已经成立的消费合同

完整4335b5–4337d7经真实getter4227d8取角色+a0，存在时从+44..+58读取六个技能baseId、从+5c..+70读取rank。共享唯一消费者为 `apps/server/src/battle/roles/skill-sources.ts` 的readRoleSkillSources，明确参数boundGear。`skills.ts`按baseId+rank−1查SkillTable，只追加原passive predicate通过且不在当前16槽中的技能；不能把六个表配置一律当六个生效被动，也不能把它们塞入当前16槽来绕过原筛选。

pet2原表的六ID为10211/10221/10231/10241/10251/10261，等级5/1/5/5/1/0。购买记录复制这些列是已经明确的重建建档政策；这份拥有记录存在、profile+a4选择它、正式base生命读取它，与角色+a0指向它是不同事实。

## 已执行的入口与唯一缺口

| 原入口 | 有效既有证据 | 对独立绑定的结论 |
| --- | --- | --- |
| 422f66 / 3aa5 | role-owned-receive-native.json | 把message+10/+c依次存manager+20/+24；不写角色、不重算 |
| 4264c4完整角色到达 | battle-role-receive-native.json及combat-field-inventory.md“联网角色完整到达与记录绑定” | 绑定record+2a0并按定义写+2a4/+2a8；不写角色+a0/+a4，保留已有引用 |
| 42f808本机property31观察者 | role-recompute-native.json observerStage | 从owner源getter取重算参数；并不建立+a0 |
| 4227d8 / 4335b5 | 完整重算与技能来源已有oracle | 消费已绑定+a0，不证明其生产者 |

唯一尚缺的生产入口是：正常Home选择或正式开局时，哪个真实caller将合法拥有宠物记录（或副本）赋到角色+a0，以及该caller的对象/阶段/所有权与替换生命周期。现有选中宠物实例→拥有base来源→PetTable/生命路径不能填补它。角色析构433e26–433e63释放+a0只是生命周期消费者，也不是赋值producer。

构造及原DLL矩阵初始化、选择请求与确认、profile拥有树解析、3aab批次传播和本机相机/UI选择均已沿各原对象身份核对，详 `role-binding-hit-critical-investigation.md`。帧重算调用者42b563直接转发manager+20/+24，不安装角色+a0；开局42b6a5→422bb2复位内嵌移动控制器。上述证据限定已核入口，不能证明其它初始化、别名或消息路径不存在。原客户端运行时选宠物/入房/开局的地址写断点尚未执行。

## 玩家交付受阻范围

“普通Home选pet2→正式开局真实技能作用”仍不能以原绑定规则完成：服务器目前显式保持boundGear缺失，合法拥有宠物只能提供已有基础生命/精通/外观来源。把selected base直接赋boundGear可以形成新的重建服务端装配政策，但它不是已恢复原绑定，且还须逐个满足passive筛选和实际作用验收；本次没有提出或实施这种政策。

本片不重复角色重算、全宠物/全技能矩阵或既有native。需要后续出现上述具体生产caller证据才继续原绑定恢复；已有548/564重算fixture预填+a0的成功结果不能关闭玩家装配缺口。
