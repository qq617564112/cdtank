# 我的家战车当前出击状态

M5-07/UI-32。原myhome_panzerpage.xml的picAlreadyUsed与btnUse均为SheetWindow子控件，矩形217,251–447,294；picAlreadyUsed引用mycabin00/chuji4.tga，btnUse提供chuji2正常/chuji1悬停/chuji3按下而无DisabledImage。

归属HomeTankSourcePage新增alreadyUsed与原SourceStaticImage消费，HomeRoles仅tank prop按当前实际候选OwnedRoles.equipment+1c==确认RoleProfile+a8投影。确认前不改出击标识，候选切换不保存；保原SelectRole权威确认、事务owner、焦点cleanup和预览生命周期。显隐为Web确认状态消费，原setter事件未证。基准800×600与现整页等比居中沿已接受主页面。

tests/browser-home-tank-active-marker.mjs仅相关1920整页当前/非当前两状态、普通源选择确认/候选回返和源Close严格Home焦点；既有三res、选择持久和实际入场证据复用。无可复用拥有fixture，专属账户初始余额20000/1000为夹具，拥有为空；正常BUY3/4后一次源SelectRole建立真实出击状态，不夹具写拥有或出击实例。不重Ready/对局/装备/纹理。

原完整93控件、动态原setter、高清字体/照明/像素1:1保持未完成。当前标识只代表已确认账户选择，不能据它称全页还原完成。

## 实际状态与整页证据

19-49-43-197Z raw PASS：普通BUY3/4得到实例1/2，源SelectRole3唯一一次服务确认Profile+a8=1。当前实例1显示原chuji4（69/16）且与btnUse矩形一致，按钮禁用；浏览实例2无当前图/按钮可用，回实例1复现标识，Close严格Home焦点。当前状态1920整图亲看“出击中”可辨。候选首次图预览尚loading，保留但不作为最终候选整页证据。focused Webtypes exit0。

合法账户fixture在server停止后checkpoint并复制，readonly role_records=2已核；保留secret token不输出。19-53-44-699Z --preview-only raw PASS仅只读复用确认同身份，候选实例2/tank4模型status ready、无当前图/按钮可用、profile出击仍1，最终candidate-ready-1920整图亲看模型与“出击”按钮完整可辨，Close严格Home焦点。0新BUY/SelectRole，未重三res/持久/对局。原全93控件/动态setter/高清字体与照明父项不闭，accepted组合引用明确有限范围。
