# role/001 原皮肤覆盖合同（M3-03）

role/001 的 20 个旧纹理名动作引用有明确的组件皮肤覆盖来源。选定原皮肤记录时，原角色以记录中的文件名加载纹理并设置 actor 级覆盖；渲染传递这个覆盖纹理，不按旧 dipan/pao/lvdai 名称寻找替代。原纹理加载器明确把请求扩展名改为 `.dds`，40 条源路径均对应已安装的选定 DDS。

| 原旧名 | 原 INI 组件 | 已验证选择示例 | 原请求 | 原 DDS 请求 | 覆盖引用数 |
| --- | --- | ---: | --- | --- | ---: |
| dipan.TGA | 001M.ini / M | 10012 | data\role\001\001M_001.tga | role/001/001M_001.dds | 5 |
| pao.TGA | 001U.ini / U | 10011 | data\role\001\001U_001.tga | role/001/001U_001.dds | 5 |
| lvdai.TGA | 001X.ini、001Y.ini / X、Y | 10013 | data\role\001\001XY_001_A.tga | role/001/001XY_001_A.dds | 10 |

上述映射是**已选择记录时的组件覆盖**。同一旧名可以使用不同原皮肤记录，不能把示例写成转换器固定材质别名。

## 原调用链

1. EXE `0x41bc92–0x41bcdb` 构造 `tanktexture` 表路径并交给资源管理器 `+0x88`。原 getter `0x413ccb` 读取全局 manager `+0x114`，随后读取 `+0x88`。
2. 完整角色皮肤分派 `0x43c8aa` 调用角色 vtable `+0x20`，参数 3，取得三槽纹理数组。四 actor 分支依序读取数组 `[0]=U、[1]=M、[2]=XY`，每个非零 ID 通过 `0x413ccb → 0x411068` 查记录，再读取记录 `+0x30` 的文件名（含原 SSO/heap string 分支）。没有记录的槽位跳过。
3. 四组件 actor 加载 `0x46d3dd–0x46d4e2` 按 M/U/X/Y 构造各自 INI 路径并存入角色 `+0x2a8/+0x2ac/+0x2b0/+0x2b4`。源 `001M/U/X/Y.ini` 明确提供相应旧名模型动作；逐动作检查关联出 20 个引用。
4. `0x46cc73` 给 U actor 设置纹理，`0x46cd15` 给 M actor 设置纹理，路径格式均是原字符串 `data\role\%s\%s`。`0x46cdb7` 加载 XY 的 A 文件，随后 `0x46ce5f` 将已构造路径倒数第 5 个字符改为 `B`，另加载 B 文件。`0x46ce82–0x46cea2` 在此入口把 A 纹理同时设置给 X/Y actor。
5. IAT `0x5c0908` 是 `gbActor::SetTexture`；实际 DLL `0x10009f70` 将纹理指针写入 actor `+0xa8`。完整 actor 渲染入口 `0x10009f80` 的正常路径在 `0x1000a01a–0x1000a028` 将该覆盖指针作为第三参数交给模型源 vtable `+0x18`。
6. DLL 完整纹理加载 `0x1002b160` 在 `0x1002b19e–0x1002b1bd` 查原请求最后的点并把后缀改为常量 `0x100411b0` 的 `.dds`，随后 `0x1002b1d5` 请求该文件；已打开内存块通过 `0x1002b1f1–0x1002b1fc` 交给纹理对象的原内存上传接口。

## 验证

```sh
recovery/.venv/bin/python tests/role-skin-texture-sol-native.py
```

结果 `PASS 36 role001 selected skin rows, 40 texture paths, 20 legacy references and actor render override submissions`。证据位于 `recovery/output/role-skin-texture-sol-native.json`，保留原皮肤 recordId、文件名、数组槽、实际 TGA/DDS 请求、选定 DDS 字节数、所覆组件、实际 render 提交及每个旧名引用的 INI section/模型/材质索引。

测试执行完整 `0x43c8aa`、原 `0x413ccb` getter、三个四组件皮肤入口、DLL 真实 setter、完整 `0x1002b160` 和完整 `0x10009f80`。边界供给为角色纹理数组 getter、四组件类型 getter、已解析的原表记录查找、CRT 字符串函数、读取选定原 DDS 字节、D3D 上传和图形矩阵栈。检查可发现数组槽/组件误绑、原文件名误用、XY A/B 路径变更、DDS 解析路径错误，以及 actor 设置与实际 render 提交脱节；发生任何一种都必须阻止该映射进入页面应用。

## 生产应用

明确拥有战车记录+28/+2c/+30已通过原消息/getter验证，详情见owned-tank-textures-sol.md。页面按三槽使用tank-textures.json的精确DDS来源，HomeTankPreview与TankView以角色实例持有选定Texture，在每次动作加载时保持组件级覆盖；原GLB材质名称与静态用途缺口不变。

M选定10012时，不论动作材质原名是当前编号名还是dipan.TGA，M actor首纹理使用原001M_001.dds导出的PNG，材质保留原17字段及ambient/alpha合同。每实例资源独立，动作释放保留选定Texture，整实例异步清理后释放。初始XY A同时覆盖X/Y；B资源已按原请求导出，运动切换来源仍待恢复。

验证涵盖两种迷彩五动作/资源隔离与释放、实际framebuffer透明100/101、21拥有战车正常页面预览及双网页普通输入CPU两局，详见owned-tank-textures-runtime.md。快照传递为重建服务器入口，角色属性32原生产链未证。

## 剩余验收

本结果限定 role/001 选定皮肤路径和正常 actor 渲染提交合同，原完整账户授权、默认纹理初始化、左右履带 A/B 切换、原 D3D 实际绘制及全部皮肤组合仍待验收。生产网页接入与其明确来源和实际验证范围见owned-tank-textures-runtime.md，20 个缺口的条件覆盖来源已确认，原全局纹理索引仍保持未解决，不把它们直接删去。
