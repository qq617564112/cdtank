# 正式对局界面职责

原HUD、头像状态、等待/结算面板和房间聊天集中到interface/battle，保留Battle的既有回调合同和DOM选择器。原HUD仍负责800×600布局缩放、计时字形、原头像表达、生命条和消息；BattleMatch仍负责准备/取消、换队、CPU/托管、目标指向、结算与再战；BattleChat仍负责输入法组合、发送状态、日志、键盘释放及退出代号。它们不创建网络连接、不计算权威玩法。

hud.css、match.css、chat.css分别由所属正式视图导入，选择器、声明值和内部覆盖顺序保持。根style.css保留页面/画布/大厅及in-battle控件布局。source-control/progress选择器由HUD使用；我的家仍有自己的home.css。

HUD和我的家共用的source-ui-fonts归interface/resources，保留同一目录载入promise、FontFace加载/注册、失败重试和导出合同。三个我的家消费者和HUD使用同一生产实现，没有重复字体库。旧平铺源码已删除，运行依赖门禁检查正式路径且禁止取证/工具/诊断入口进入正式代码。

## 验收

- `test:portraits`：原头像状态优先级、帧取整、严格到期、死亡/复活与高低位保留。
- `tests/browser-hud.mjs <CDP> [origin]`：实际原图集/计时字形解码、生命条裁剪、消息和十二人名单加入/死亡/复活/退出，1080p/1440p/4K/DPR2的原布局、关闭清理。
- `tests/browser-rooms.mjs <CDP> [origin]`：四网页正常密码房、原地图/物件加载、准备/取消/换队/名册、中文IME与纯文本聊天、焦点/移动键隔离、Escape、结束聊天与退出清理。
- `tests/browser-source-fonts.mjs <CDP>`：原中文字体、12定义/122字形、失败重试、高清/4K库存文字。
- `tests/browser-home-equipment.mjs <CDP>`：原装备操作/拒绝/隔离、1080p/4K、刷新与服务重启保存；覆盖共用字体消费者。
- 正常CPU入口重试/准备/运动返回、双网页不同拥有迷彩和本人托管普通输入自然两局、冻结结算再战、原Effect11/GA15与声音释放、账户服务重启保存重进；编译账户联机保存及CPU五模式各两局。
- 最终类型、211正式可达模块依赖与独立Web构建。性能采样入口沿实际Battle→BattlePlayers→TankView定位生产实例，HUD从interface/battle定位，支持隔离origin。

本片日志为engineering-battle-interface-{portraits,hud,rooms,fonts,equipment,cpu,two-rounds,compiled,types,boundaries,build,profile}.log；全部命令退出0；依赖门禁覆盖211正式可达模块，正式Web构建2分31秒完成。性能采样状态为MEASURED，SwiftShader下1080p平均381.4ms、降到960×540为97.5ms、恢复1080p为335.4ms，HUD update约0.4ms；本次存在宿主并行验收负载，GPU计时不可用。原HUD/聊天浏览器入口接受可选origin，测试服务与现有3001/5173分离。

## 范围

已有对局界面的工程归属与所列行为经过迁移验收，全部原界面、频道/好友和玩法仍按M项恢复。原HUD高清布局与CPU性能采样范围分别保留：缩小画布的双网页验收不证明高清全内容性能，性能采样输出也不等于达到目标帧率。
