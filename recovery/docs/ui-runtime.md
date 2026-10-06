# 原界面资源与战斗HUD

`recovery/export_ui.py`从catalog清单导出65布局/2,000控件、78份imageset/4,347图块和12份字体定义到ui.json。布局保留原属性、父节点和事件。图块按原X/Y/Width/Height逐项裁剪为PNG；DDS先上下翻转，使其与CEGUI顶端原点矩形一致。原文件不修改。重复图集名保留两个来源，HUD优先imagesets_dds；补丁覆盖顺序尚待确认。

`battle-hud.ts`目前恢复game_main.xml的prgLife、picBattleInfoPanel/edtBattleInfo，以及12个picPlayer/picPlayerPanel/picPlayerIconBg/txtPlayerName/prgPlayerLife槽位，以及game_main_info_team.xml的txtRemainTime。生命条使用原背景/进度图块、原红/黄/绿三段颜色，染色通过进度图块的alpha遮罩保留透明轮廓；按权威hp/maxHp裁切。计时器使用BigHT.font的字符映射与原数字图块，按权威remaining显示分钟/秒。战斗信息区显示服务端hit/destroy/respawn/finish/leave/chat/friendlyFire消息，并保留最近五条；确切原文本排版/日志容量仍待还原。

玩家侧栏按权威快照显示名字、生命、死亡/复活，空槽位隐藏、离开玩家清除。竖生命条按原ProgressFormat从下向上填充。当前排列策略为本机优先、同队在左/其余在右，任一侧超过六人时溢出到另一侧的空槽，总计12槽；原模式队伍与槽位排序调用链待校准。侧栏第0槽头像使用petId对应的独立normal图块，其余11槽改用zhandou00中的小头像（%d_normal1.tga），与原初始化分支一致。两类各有宠物1–5、101–105共10种直接匹配；缺账户来源时保留空位；换宠物或离开清除旧图。tanke0图集包含全部21种选车图标，但原战斗头像初始化并未引用它，不能据此补替战斗头像。源映射由test:ui验证；test:hud:browser覆盖10种宠物ID在第0槽和远端槽的实际头像解码/不同图块/未知空位/换宠物清理及四种高清配置下的本机和远端原矩形，test:combat:browser核对双方实际头像与战斗/退出。称号、VIP等业务仍待恢复。

原800×600坐标采用统一比例缩放到视口可容纳的最大4:3区域，宽屏左右留出空间，画布仍覆盖完整视口。DOM文本/ARIA保持可访问性；中文使用系统SimSun字体，原动态字体MINGLIU.TTC尚未接入。此缩放策略保留比例，原客户端宽屏锚点行为仍待校准。

验证：`npm run test:ui`逐图块核对4,347份PNG的RGBA字节与源翻转atlas，逐项核对65布局/2,000控件及12字体定义。`npm run test:hud:browser -- <CDP>`使用显式状态验证1080p、1440p、4K和1080p/DPR2的生命槽矩形、裁切/颜色、字体图块实际解码、战斗消息、死亡生命0、12槽位/队伍不均衡/远端死亡复活离开及退出清理。证据browser-hud.json/.png。实际联机HUD绑定通过test:combat:browser验证。联机测试使用960×540视口与降低的画布后备分辨率，以减轻软件GPU负载；高清HUD验证使用正常DPR和独立尺寸检查。

## 未完成

导出全部布局不代表其业务已实现。称号、小地图、道具、技能、聊天输入、模式信息/目标、结算、大厅/账号/商城/成长/社交窗口及原动态字体尚未接入。计时器已按权威mode使用五份原信息布局的位置；其他模式信息控件与语义需随原规则逐项恢复。战斗现有工具面板仍保留，完整原界面尚未恢复。

## 头像状态机证据

EXE 0x4c8390–0x4c83b8获取GameMain/picPlayerIcon0并存入对象+0x1a8，其余11控件依次缓存。0x4d155f–0x4d156e通过0x4c7633选择Image并调用导入0x5c013c（CEGUI StaticImage::setImage）。0x4c7633根据状态位选择对象+0x10、+0x14等图片槽，包含双帧与四帧循环。0x4ced87–0x4cee77读取角色属性0xf/0x10的比例并更新头像状态；具体图片槽初始化与宠物定义生产与资源选择见pet-portrait-source.md。Web按槽位使用直接命名匹配的头像；受击、死亡与复活表情已接入，攻击触发仍待恢复，击毁胜利表情已接入。


### 初始化分支与图片槽（本轮确认）

0x4d0801对esi（槽位索引）作零判断；0x4d0806从角色+0x2a4取记录，使用记录+0xc格式化头像编号。槽0使用0x5d12c8的`%d0`图集名，以及0x5d12a8的`data\ui\%d\%d%s.tga`路径；非零槽跳转0x4d0f62，使用0x5d1264的`normal1`、0x5d1248的`data\ui\zhandou\%d_%s.tga`、0x5c8264的`zhandou00`。非零槽将同一小头像复制到各表情图片槽，因此不能将槽0的大头像用于所有玩家。test:ui直接读取EXE中的格式字符串，并逐一核对导出图块来源。

槽0状态记录基址为对象+0x208，原调用写入：+0x10 normal（0x4d0937）、+0x14/+0x18 normal（0x4d09a3/0x4d0a0f）、+0x1c attack（0x4d08a5）、+0x20/+0x24 yeah1/yeah2（0x4d0e27/0x4d0eb9）、+0x28/+0x2c wound（0x4d0d29/0x4d0d95）、+0x30至+0x3c normal（0x4d0a7b至0x4d0bbf）、+0x40 zhandou00的die（0x4d0f41）。这也说明低生命的四帧状态暂不等同于wound图：其初始化为normal，尚需查明后续覆盖。0x4ced87–0x4cee77在生命比率float32(0.3)以下切低生命高位、恢复至阈值及以上切normal，已接入；宠物定义与全部10族资源映射已确认，正式实战见M5-04-PET。

静态资源分支及受击/死亡/复活动态状态沿既有原消费者恢复。角色+2a4由PetTable定义绑定，记录+c为宠物定义ID；本机和远端共10族现存原头像全部映射。当前账户已选宠物定义通过权威快照petId接入，不能由战车定义推定头像。完整原队伍排序、全部事件生产与Windows像素精度保留父项范围。

资源与规则：pet-portrait-catalog.json核对全部10族原图集/名称/文件引用，react-hud-store.cts验证正式petId消费者、local/remote区别、换pet重置与无来源保空；原状态机证据直接复用。真实双网页结果归M5-04-PET及其专属验收文档，不以目录或旧tank编号夹具替代实际选用。

## 受击、死亡与复活表情恢复

`portrait-state.ts`复现0x4c75f6的高/低位合并与守卫：设置任意状态先清elapsed；yeah(bit4)阻止attack(bit2)覆盖，但仍清计时；非normal高位阻止自动idle(bit1)。0x4c7633按trunc(elapsed/0.5+0.5)选帧，优先级idle→attack→yeah→wound→normal高位→低生命高位→dead。0x4c76ac双帧瞬态严格elapsed>1秒才清，attack严格>0.5秒才清；normal初始2秒触发idle，后续等待由原rand()*float32(8/32767)+15计算。原rand函数0x57cbcb确认输出0..32767。Web使用同范围随机分布，不承诺复现原随机序列。

事件证据：0x4d42da注册0x4ceebd到游戏对象callback+0x80（setter0x42338f），0x424700–0x424711受击路径调用该callback，0x4ceef7设置bit8/wound。0x4d430c注册0x4cef02到callback+0x84（setter0x4233b8），0x4259de/0x4259f6状态3路径调用角色vtable+0x50后调用callback；0x4cef5d设置高位0x04000000，显示fallback死亡图。0x4d43c8注册0x4cf26f到callback+0x88（setter0x423485），0x425a2a/0x425a5c状态2路径调用角色vtable+0x4c后调用callback；0x4cf2af恢复高位0x01000000。

Web以权威hit事件设置wound，以destroy/快照alive=false设置死亡，以复活事件/快照alive=true恢复normal。死亡高位保留未结束的wound低位，约1秒后切死亡图片，与原setter行为一致。第0槽死亡图来自zhandou00/die，其余槽来自die_2（0x4d14ba格式字符串0x5d1240、0x4d1528写入fallback）；即使战车normal映射未知，死亡图仍可显示。玩家离开、换车和退出清理表情记录，避免复用旧状态。

生命比率在float32(0.3)以下切0x02000000，恢复至阈值以上或相等切0x01000000；两者均保留瞬态低位。当前低生命四帧仍是源初始化normal图块，未猜测后续覆盖。attack/yeah图片与状态选择已导出；yeah已确认攻击者归属并绑定destroy，开火已根据原技能callback+0x8c接入，详见下节。宠物覆盖仍未恢复。

`test:portraits`检查源状态计时边界、frame舍入、yeah抑制attack且重置elapsed、高低位保留及死亡/复活；浏览器HUD测试增加实际wound/death PNG解码、严格1秒期限、低生命、未结束受击转死亡、本机/远端不同死亡图和复活/退出清理。该显式状态测试与真实联机回归分别保留证据。

本轮验证结果：test:ui、test:portraits、test:hud:browser、test:combat:browser及build通过。browser-combat.json的expressions保存双方真实受击与死亡图，确认双方死亡图不同、受击图与死亡图不同；对局继续完成满血重生及退出。


## 击毁胜利表情

原通知0x4364c4从消息+0x10/+0xc取角色ID并传给0x429443；后者分别通过0x48a226查找角色。0x42955b–0x429560将第二个角色对象（原消息+0xc）作为0x429101的第三参数。0x42912e–0x429136在该对象是本机时递增其+0x28/+0x30计数，0x429139–0x429149调用游戏对象callback+0x90并传该角色。其后0x429186读取gamestring ID591（0x24f）：`你击毁...，获得...积分`，并使用第一角色的名字格式化文本，明确第三参数为击毁者、第二参数为被击毁者。

callback+0x90由0x4d4364–0x4d4391注册0x4cf12c（setter0x42340a）。0x4cf185按角色对象找头像槽，0x4cf1e9–0x4cf1f2设置bit4；因此Web在权威destroy事件对playerId设置4，对targetId保留死亡高位。原selector按trunc(elapsed/0.5+0.5)%2选择yeah1/yeah2，elapsed严格超过1秒才恢复高位基础图。远端槽两帧仍显示同一原小头像，与其初始化一致。原模式3/4的声音分支不同，但都汇合到同一头像状态调用；击毁音效已按原模式分支接入，见audio-runtime.md。

浏览器显式状态验证击毁者归属、0/0.25/0.5/0.75/1/1.001秒选帧与恢复，并实际解码两张yeah PNG。实战测试记录两端观察到的攻击者yeah1/yeah2，要求本机两帧图片不同、远端两帧图片相同，保持原槽位差异。

本轮胜利表情验证：test:portraits、test:hud:browser、test:combat:browser和build通过。真实双方yeah帧资源保存在browser-combat.json的expressions[].victory；完整击毁/重生/退出继续通过。

五模式计时器布局和严格<30秒奇红偶白警示已恢复，加载/选择分支、权威mode契约与验证见mode-runtime.md。使用原BigHT图块与SVG sRGB颜色乘法保留透明轮廓；所有高清模式组合检查31/30/29.99/29/28/1/0秒、截断格式、>=30跳过颜色写入及退出重入清理。

玩家栏本机首槽行为进一步校准：0x4d0632/0x4d065b使用交换，Web不再将其余同队成员整体顺移。浏览器检查完整猫/狗本机排序及死亡/复活/离开后清理。原公告六ID数组已定位，见mode-runtime.md；当前权威玩家数组、空槽与超六人布局仍待恢复，不能将交换规则通过当作原服务器排序全部恢复。

## 原开火攻击表情

0x4d4338–0x4d435f注册0x4cefc9；0x4233e1存入游戏对象callback+0x8c。0x42312d–0x423143调用该回调并传角色/技能ID。默认开火0x428cb2–0x428cbc使用2001，原网络角色技能入口0x4245c9–0x424609也把消息角色/skillId送入同一函数。0x4cefc9按原玩家栏找到角色，0x4cf009–0x4cf01d重置表情计时，yeah(bit4)阻止attack覆盖，其余情况保留高位并设置bit2；其后分派技能音效。Web在权威fire时用PortraitState.set(2)连接此行为，不由本地Space键提前播放。

真实双浏览器键盘开火后双方均记录攻击者attack图块，受击/击毁胜利/死亡/复活回归通过，证据browser-combat.json的expressions[].attack。test:portraits检查原严格0.5秒到期及yeah阻止attack仍重置elapsed；test:hud:browser增加原attack PNG实际解码和0.5/0.501秒边界，全部通过，并保持五模式×1080p/1440p/4K/DPR2及倒计时/玩家栏回归。远端槽仍用原小头像。

## 原字体资产与当前网页接入

`npm run assets:fonts`直接发布12份原.font定义：11份位图字体共122个Codepoint/图块/宽高映射，以及动态SIMSUN的MINGLIU.TTC。集合第0面为MingLiU，第1面为PMingLiU；当前发布第0面为独立SIMSUN.ttf，22185个cmap映射及glyf/hmtx/hhea/maxp编译数据与原面一致。所有原文件保持不变；FontTools版本固定在recovery/requirements.txt。`npm run assets:ui`裁剪图块后自动发布字体目录ui-fonts.json。

source-ui-fonts.ts通过FontFace实际载入CDTank-SIMSUN。库存页在构建原左栏前等待字体；BattleHud在接受ui.json前等待字体。加载失败显示页面既有错误，清除加载Promise后允许重试。源库存左栏和HUD以该原字体绘制中文，避免依赖操作系统是否安装SimSun。已有BigHT倒计时继续使用源图块；其余位图字体尚需连到各原控件和动态业务。

验收命令`npm run test:fonts:browser -- <CDP>`：阻断字体失败、清除阻断重试、真实加载22185映射的字库、122张字形图实际解码/宽高、明确导入普通炮弹的原中文名称与数量在源字体下显示、1920/3840截图。证据browser-source-fonts.json及source-fonts-home-1920.png/3840.png。一键CPU入口额外回归验证HUD加载不会阻塞对局，证据source-fonts-cpu-entry.log。原FreeType选面/度量、AntiAlias=false像素、所有字体在全部控件上的使用和中文组合输入仍待验证，M3-10不勾选。
