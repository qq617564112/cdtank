# 首只宠物正式模型预览网页验收

对应M6-04-PREVIEW。正式Home宠物候选大麦与商城Pet2原picModel区域均真实绘制原n1模型、11005材质及动画。普通候选切换、角色选用、商城刷新、购买成功和不足拒绝保持各自scene；切分类或关闭释放engine、scene和模型，重开恢复实际绘制。

原加载来源见`pet-model-preview-source.md`，正式入口见`pet-model-preview-ui.md`。本片复用已通过的购买、头像、生命与持久恢复，不增加战斗、账户重启、网络业务或原生复验。

`tests/browser-pet-model-preview.mjs`使用专属index3246、正式Vite5406、Chromium9606和一个正常页面。开局夹具仅设置资金4000金币／1000软星币、完整已有pet1实例73／pet2实例75／tank1实例74，初选pet1。Home候选字段+8定义2而非实例75传给模型；商城使用正式PetShop商品定义2。

## 实际资源与动画

有效首次PASS为`recovery/output/browser-pet-model-preview-2026-10-04T13-30-09-844Z.json`及`.log`。

| 观察项 | Home | Shop |
| --- | --- | --- |
| 原模型 | Data/Pet/002/n1.glb | Data/Pet/002/n1.glb |
| 实际网格 | Mesh02/0，1848顶点 | Mesh02/0，1848顶点 |
| 实际材质 | original-mv3-material／newgeom | original-mv3-material／newgeom |
| 纹理 | 11005.tga (Base Color)，ready=true | 11005.tga (Base Color)，ready=true |
| Morph目标 | 39 | 39 |
| 初次实际绘制 | draw6 | draw7 |
| 跨帧动画 | 7组不同morph influence样本，n1 time260→659 | 8组不同morph influence样本，n1 time238→641 |
| 确认后累计绘制 | draw123 | draw149 |

实际纹理为GLB嵌入PNG的Blob引用；原GLB材质11005.tga、sourceMV3属性与运行纹理名称／ready状态共同确认来源，不将Blob地址伪称外部11005.png路径。原转换n1时长6401复用现有资源。

观察脚本只从EngineStore读取现有canvas所属engine／scene，订阅实际mesh.onAfterRender、读取材质纹理及morph influence／root metadata。未改写模型、相机、姿态、事件或动画状态。Home自动orbit有原MyPet caller来源，Shop未套用Home自动转动。

## 原picModel矩形与真实画布

两入口基准位置均(225,52)，Home源区域218×218，Shop源区域218×217。普通Resize沿正式页面缩放并保持同engine／scene。

| 视口 | Scale | Home区域／Canvas像素 | Shop区域／Canvas像素 |
| --- | --- | --- | --- |
| 800×600 | 1 | 218×218／218×218 | 218×217／218×217 |
| 1920×1080 | 1.8 | 392.39×392.39／392×392 | 392.39×390.59／392×391 |
| 3840×2160 | 3.6 | 784.80×784.80／785×785 | 784.80×781.19／785×781 |

源相对stage位置依次225／52、405／93.59、810／187.19。Canvas像素等于区域尺寸四舍五入；源rect误差小于1像素。

同PASS的`-home-800.png`、`-home-1920.png`、`-home-3840.png`及`-shop-800.png`、`-shop-1920.png`、`-shop-3840.png`保存正常整页实际模型画面；`-shop-confirmed.png`记录购买后不足拒绝且预览仍存在。

## 普通业务与生命周期

Home正常点击pet2候选、切pet1再切pet2，engine／scene均保持；模型跟随定义替换。普通原出击按钮提交SelectRole实例75并确认后仍同scene。切Tank卸载，切回Pet重新绘制；关闭Home后再通过正常入口打开，模型再次实际绘制。

Shop正常刷新、点击原btnBuy一次成功后资金500／1000，再点击得到余额不足，所有busy true／false观察样本均保持原element／engine和未释放scene。切Item卸载，切回Pet重新绘制；关闭并重开商城再次实际绘制。

| 释放入口 | engine／scene | element | 帧计数停止值 |
| --- | --- | --- | --- |
| Home切Tank | disposed／disposed | 断开 | 158 |
| Home关闭 | disposed／disposed | 断开 | 23 |
| Home重开后最终关闭 | disposed／disposed | 断开 | 23 |
| Shop切Item | disposed／disposed | 断开 | 177 |
| Shop关闭 | disposed／disposed | 断开 | 22 |
| Shop重开后最终关闭 | disposed／disposed | 断开 | 20 |

帧计数在跨两次requestAnimationFrame观察后保持不变。候选更换复用scene的合同与独立模型资源释放由正式组件承担，本片以实际候选替换、绘制和页面卸载证据验收，不将此记录扩大成所有晚加载竞争条件穷举。

## 真实晚加载关闭

限定尾部PASS为`recovery/output/browser-pet-model-preview-late-only-2026-10-04T13-34-20-478Z.json`及`.log`，仅补加载时关闭与迟到完成。CDP Fetch在真实pet2 n1.glb响应200阶段暂停，普通Home候选仍loading、mesh0；正常源关闭后旧engine／scene释放、element断开、帧计数19停止。继续原响应后监听同networkId的真实`Network.loadingFinished`，requestId36802.949、encodedDataLength1865047，再跨两次requestAnimationFrame确认旧engine不在EngineStore、旧scene已释放、没有迟到picModel挂载、帧数仍19。普通重开Homepet2后模型ready、实际draw6，最终关闭engine／scene再次释放、帧数42停止。

较早限定记录`browser-pet-model-preview-late-only-2026-10-04T13-33-07-949Z.json`保存关闭／重开有效范围；真实请求终态结论使用上述13-34记录。等待响应仅控制网络交付时机，未修改资源内容、模型、相机或角色状态。

## 已知边界

原默认n1模型与11005源材质已实际使用，Home .0075 orbit caller有直接来源；相机、灯光、框取和循环呈现仍是Web重建展示。画面模型偏暗，未宣称原Windows像素或完整原光照一致。n1 morph变化证明正常动画可见，不证明原循环／插值精度。未扩全部宠物动作、技能或其它商品。

## 清理

专属index、Vite、Chromium及连接全部停止，临时数据库和浏览器目录已删除。3246、5406、9606无监听进程，`/tmp/cdtank-pet-model-preview-*`无残留。完整页面scope首次运行PASS，晚加载尾部采用独立限定记录补齐，没有重跑已通过页面scope。
