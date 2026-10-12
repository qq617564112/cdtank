# 原04动作的玩家入口缺口

原三部件和四部件 actor 均将动作索引3映射为04。直接初始化使用原字符串5c8768「04」；三部件468bdd→468be6写6d26c4，四部件46c522→46c52b写6d2740。两表分别从6d26b8/6d2734按index×4取字符串ID。现已发布原配置共76份部件04动作，来源路径、时间和原消息逐条保存在tank-action04-source.json。

三部件46897a及四部件46c396的selector0分支分别在4689b3/46c3cf压flags4、actionIndex3，再调用原动作切换46888f/46c2ab。方向selector1/2/3/4分别选择05/06/07/08；不能以04编号猜装填、刹车或其他动作。

现已证普通受击入口422877仅接受方向0/1/2/3，转为actor selector1/2/3/4后调用virtual+88。它不产生actor selector0。现正式hit.hurtSelector沿这一方向来源实现1–4，TankView.hurt相应消费05–08，当前普通链正确，不为04修改此门禁。

缺失的是合法普通业务到actor selector0的原caller身份。专属检查仅保存上述原直接字节/反汇编和原资源索引，不执行新native、不改World/Battle/协议/动画消费者，也不启动玩家验收。M3-04完整动作父仍开放；本轮限定来源结束，不据孤立可调用分支新增免费触发。

来源命令：recovery/.venv/bin/python tests/tank-action04-source.py。状态STATIC_ACTION04_SELECTOR0_ORDINARY_CALLER_GAP；产物recovery/output/tank-action04-source.json/log。
