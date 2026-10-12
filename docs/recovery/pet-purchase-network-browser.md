# 首只付费宠物购买、选用与生命权威

正式商城以3500金币购买宠物2「大麦」，事务新增完整base拥有记录并扣款。我的家普通选择新实例后，既有角色重算在正常Ready入场生成700生命；真实CPU命中后的657生命由两连接收到同tick一致状态。正常Leave与同数据库真实服务器重启后，原token恢复拥有记录、选中宠物和500金币余额。

本片对应M6-06-P02。原来源见`pet-purchase-source.md`：pet2配置金钱3500、代币350、MaxHP700、Critical20、Lucky8；原所见购买入口仅验证金钱及拥有宠物数少于10。本片只开放MONEY，完整成功建档采用明确重建的未成长购买规则，不宣称原服务器购买构造已恢复。

## 夹具与完整建档

owner初始4000金币／1000软星币，已有pet1实例73、tank1实例74；目标pet2不存在。既有角色使用已测源字段布局，pet1生命600。余额不足peer资金3000／1000且有同既有角色；容量账户资金4000／1000、10个明确pet1夹具。道具库存为空，pet2实例只由正式BUY产生。战斗没有位置、生命、伤害、事件或结果注入。

| 建档内容 | 实测 |
| --- | --- |
| 交易 | MONEY4000→500、TOKENS1000不变；名称「大麦」，实例1 |
| 完整拥有记录 | 31数值字段；+0=1、+8=2 |
| 基础数值 | +2c=700、+34=20、+3c=8 |
| 六技能 | 10211／10221／10231／10241／10251／10261 |
| 六等级 | 5／1／5／5／1／0；0级保持0 |
| 其他字段 | 未确定成长及其他构造字段按明确重建初值清0 |
| 无自动选中 | BUY后profile+a4仍73，普通SelectRole后为1 |

购买建档中六技能与等级是原表复制的重建政策。当前独立boundGear绑定并不由该购买建立，不将保存的技能字段声明为六个被动效果均已自动生效。

## 正式交易与持久恢复

`tests/pet-purchase-network.cts`使用独立index3243与SQLite，通过正式Account／PetShop／OwnedRoles／RoleProfile／SelectRole验证业务。

| 项目 | 实测 |
| --- | --- |
| 查询 | 唯一pet2商品、大麦、金钱3500、表代币350 |
| 请求拒绝 | 未认证、TOKENS、非出售pet1、短requestId、余额不足、PLAYING购买拒绝 |
| 容量拒绝 | 10宠物账户BUY拒绝，仍10个base记录、资金4000／1000 |
| 幂等 | 同requestId重放返回同实例1、replayed=true、资金仍500／1000 |
| 改请求拒绝 | 同requestId改TOKENS请求拒绝 |
| 账户隔离 | peer只有原pet1，资金3000／1000；不能选择owner实例1 |
| 正常拥有选用 | owner两条base，其中实例1完整字段与BUY一致，普通选择写profile+a4=1 |
| 同DB真实重启 | 停止并重新启动index，同原token恢复完整base1、profile+a4=1、资金500／1000 |

容量与事务回滚的独立规则覆盖沿正式PetShop规则证据，本片以真实网络容量拒绝和状态不变为业务证据。

## 普通入场、自然伤害与双连接同步

owner正常创建mode4／map7房间，peer正常Join，房主添加一个CPU，双方普通Ready。选用购买pet2的owner初始HP700／maxHp700；仍选pet1的peer初始HP600／maxHp600。owner普通PlayerInput移动约130.01世界单位并产生真实2001 fire事件。

CPU3自然命中owner，hit伤害43。tick251两账户连接收到同一owner状态，HP657／maxHp700，坐标及其余player字段一致。普通Leave后执行真实持久重启。拥有记录+8=2、profile+a4=1与正常重算生命700共同确认选用定义；公开PlayerSnapshot没有独立petId字段，不将快照描述成直接返回pet2定义。

网络有效PASS为`recovery/output/pet-purchase-network-2026-10-04T12-47-30-481Z.json`及`.log`。

## 正式网页入口与生命显示

`tests/browser-pet-purchase.mjs`使用index3244、正式Vite5404、独立Chromium9604。一张普通账户页面点击原商城Pet分类与原btnBuy，真实购入大麦；返回Item页余额500／1000。我的家Pet页仍初选实例73，点新拥有实例1及原出击按钮后确认「大麦 · 当前」「角色选择已保存」。

网页正常创建mode4／map7、添加CPU并Ready，使用普通KeyW和Space。owner初始HP700／maxHp700，实际移动约117.01世界单位，收到真实owner fire skill2001。CPU2自然命中伤43后公开owner生命657／700，原source-life-progress的aria-valuenow657、aria-valuemax700、title657/700。普通Leave成功，battle-status.world清空。

网页有效PASS为`recovery/output/browser-pet-purchase-2026-10-04T12-47-30-789Z.json`及`.log`。同一记录画面：

- `-purchased.png`：原Pet商城、大麦购买确认与500金币余额。
- `-home-pet2.png`：我的家「大麦 · 当前」、正常选择保存确认与源出击按钮。
- `-battle-pet2-health.png`：正常map7战车、宠物HUD及受击生命显示；数值657／700以同时保存的源生命控件属性为证。

## 已知边界

本片只完成pet2金钱购买与未成长拥有建档，不扩其它宠物、宠物成长、技能绑定或出售。Shop与Home宠物模型区域为空，本片不包含宠物模型恢复。当前HUD使用既有犬头像，原pet2形象映射未核；该头像不作为pet2原形象同步证据，本片双端同步结论限权威生命。原普通2001射击完整FX与声音链不由本片重新验证。网页承担普通入口和生命显示，网络承担双连接同步及真同DB恢复。

## 清理

所有专属index、Vite、Chromium和连接已停止，临时SQLite及浏览器目录已删除。3243、3244、5404、9604无监听进程，`/tmp/cdtank-pet-purchase-*`无残留。本片网络与网页均首次真实运行PASS，独立原始记录和画面已保存。
