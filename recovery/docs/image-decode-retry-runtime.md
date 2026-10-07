# 图片解码失败后的重试恢复

本改动让下一次显式重试对解码失败的图片真正重新取得响应，同时不动已经成功的图片。入口启动/重试页曾出现PNG解码失败、之后新开页面可进入登录，这里不把它当作已定位的原因或已实测修好的结论，只描述失败后的恢复路径。

启动加载的全部解码都经过 `assets/image-resources.ts` 的 `decodeImage`，覆盖发布目录图片、源码打包图片和加载页图片，不限于 `image-assets.json` 里的URL，按绝对URL记录。图片的下载、版本、Blob与BlobURL由 `assets/image-cache.ts` 单一持有：`loadImageResource` 以版本读写 IndexedDB（`cdtank-image-assets`/`images`）并生成 `preparedImages` 里的BlobURL，DOM、`imageResourceUrl`/`imageResourceBackground` 与Babylon纹理都使用该准备图。任何一次非中止的解码失败只把该URL标记为需要重新取得响应，并只清除该URL在内存中的解码Promise；其它成功URL的decoderPromise、准备图与IndexedDB版本原样保留，不因单张失败清空整个缓存。离开页面的中止不改变该标记。

下一次对同一绝对URL调用 `decodeImage` 时，若它已被标记，走图片缓存的重新取得路径：`image-cache.ts` 的 `loadFreshImage` 只对该URL以 `cache: 'no-cache'` 发起 fetch，按Web规则重新校验HTTP缓存并取得当前网络body（Blob），不读取、也不改动现有准备图。取得实际body后，`image-resources.ts` 把该Blob转成临时objectURL交给 `HTMLImageElement` 解码；解码成功后由 `image-cache.ts` 的 `commitFreshImage` 在同一版本下写入该URL的IndexedDB Blob，并释放旧准备URL、登记指向新Blob的准备URL，删除该URL的fresh标记。解码先于替换完成，因此只有实际body解码成功才替换；fetch、响应体与解码迟到于中止或超时时不会安装准备图或替换URL。临时objectURL在本尝试所有出口（成功、失败、中止）及时撤销，成功准备的解码位图不依赖已撤销URL的再次读取。返回合同仍是解码完成的 `HTMLImageElement`。

HTTPS、localhost 与普通HTTP都使用同一套 IndexedDB + 准备BlobURL归属；重新取得只替换失败URL那一条同版本记录，其它URL的准备图与存储不动。之后通过原URL取得 `imageResourceUrl`/`imageResourceBackground` 的DOM与引擎消费者会用到这次重新取得并已替换的准备图。

失败与中止仍以原样reject，由 `ImageLoadingScreen` 显示“重新载入”按钮触发下一次显式重试，不会在同一调用内自动重试。网络请求与解码沿用 `static-resources.ts` 的30秒资源超时。

## 验证范围

本次改动未运行测试、浏览器验收、构建或类型检查，也没有新的页面实测。集中静态走查尚未开始，按流程由root在整批完成后安排一次；首次加载稳定性与高清资源仍待验证，首次PNG解码失败的原因仍为未确定。
