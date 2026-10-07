# 进入游戏前加载图片

正式入口与validation入口先显示图片加载页，完整图片目录就绪后再初始化场景、登录页面和游戏音频。进度显示已就绪图片数量、本地复用数量、资源大小和完成比例，资源大小不表示实际网络流量；任一下载或加载页图片解码失败均保留加载页，可重试并复用已完成图片。离开页面终止当前下载。

首次加载与进入正式对局共用 `interface/resources/loading-page.tsx` 和同一套样式，均采用800×600原坐标布局、4:3等比缩放和画面内叠加。背景复用原Data/ui/loading/1–5.jpg的已发布PNG，每次进入从五张中选择一张，重试保持同一张；先解码当前背景、键位图、战车图和两张进度图，再开始全量下载。背景按左上800×600有效画面裁切，去除1024×1024纹理的黑色填充。键位图位于144/100，战车图位于右下，256×64进度词距底30；状态、图片数量与下载大小位于左下状态区，失败时在其下显示重新载入按钮。原loading_1是深色底图，loading_2按完成比例从左到右裁切叠加，不压缩文字。原客户端0x45a56e–0x45a58b分别将两图加载到对象0xec/0x128；0x458277回调中的0x4582c0–0x4582f8根据亮图宽度与进度计算至少1像素的裁切宽度，0x458375–0x4583a4先绘底图再绘裁切亮图。网页共用组件在零进度时完全隐藏亮图，完成时显示完整亮图。

入口持有单个React根，图片就绪后由 `startGame` 在同一个根内切换到游戏页面；页面离开时卸载当前页面。

Vite的image-assets-plugin从CDTANK_WEB_ASSETS指定的资源目录（缺省recovery/output/web-assets）生成image-assets.json，覆盖全部发布图片，包括界面图集、字形、战车迷彩和场景／效果纹理。开发服务直接提供目录及image-cache-worker.js，正式构建将二者一起发布；无需额外资产导出步骤。下载并发为8，只解码当前加载页使用的图片，其余图片在页面实际使用时由浏览器解码；游戏入口等待实际使用的字体加载。

HTTPS与localhost使用浏览器Cache Storage保存完整图片响应及已完成资源目录，Service Worker向后续页面和纹理请求提供本地图片。再次进入时一次读取目录与缓存条目列表，按文件修改时间识别缺失或更新图片，已缓存且未改变的图片直接计入就绪进度，无需逐张读取响应或重新解码。已有图片响应按更新标识复用，下载全部完成后保存目录；缓存条目缺失时重新下载。普通远程HTTP在localStorage保存已完成资源目录，未改变的图片以force-cache读取浏览器HTTP缓存，缺失时由浏览器下载，更新图片重新校验；读取图片响应不触发全量解码。持久存储不可用时仍可完成资源下载。

当前本批采用合同改为IndexedDB：`assets/image-cache.ts` 为图片缓存唯一owner，共享 `decodeImage` 对非abort失败按绝对URL登记该失败URL，下一次现有显式重试只对该失败URL经该owner以no-cache重新获取、按同version写入IndexedDB Blob并替换该URL的PreparedImage Blob URL，后续DOM、引擎 `imageResourceUrl` 与背景使用新图；成功图片的decoderPromise、PreparedImage与IndexedDB版本保持，不自动重试、不清空全部缓存、不改动成功图片；HTTPS与localhost及普通远程HTTP统一使用IndexedDB，不使用Service Worker／CacheStorage或请求头。上文Service Worker／CacheStorage叙述为旧历史行为，不作为本批终态。首次加载出现的PNG解码失败原因仍未确定，本范围不作为稳定性或修复的实测结论。完整合同见 [image-decode-retry-runtime.md](image-decode-retry-runtime.md)。

## 验证范围

本改动未运行测试、浏览器验收、构建或类型检查。加载页首次下载、再次进入时复用、失败重试及实际页面切换观感尚需运行验收。共享失败URL恢复按有限采用范围登记；firstload、新retry与高清实测缺口保持未勾，首次PNG解码失败原因仍未确定。
