# Type10 旧屏幕效果 Web 采用与生命周期合同

## 结论

原 type10 四个旧 source 的原生命周期已经恢复：激活调用 `SYcScreenEffect::Select(5,0)`，结束调用 `Clear`。当前二进制没有初始化 index5 子效果列表，也没有可取得的 index5 原 shader、纹理或参数，因此不能把这四个节点声明为原 postprocess 像素恢复。

生产 Web 当前在 `apps/web/src/render/effects/runtime/effect-runtime.ts` 的 `createTree` 中把 type10 的 `selectEffect` 写成显式 throw。该 throw 应移除，并替换为每 scene 唯一的 Web 屏幕效果后端。后端采用一个明确标注的全屏中性黑 25% 遮罩，不冒充原模糊、闪光、烟雾或其他未恢复语义。

当前 342 条技能记录中没有可达 type10 节点，现有可达 371 节点中 type10 数量为 0。本设计不新增战斗入口、技能、调试按钮或测试入口，也不宣称像素等价。

## 原来源事实

`recovery/docs/effect-screen-postprocess.md` 与 `recovery/output/effect-postprocess-manager-native.json` 已证明：

- `SYcScreenEffect` 构造后的 begin/end/capacity 为 `0/0/0`，selected 为 `-1`。
- `Select(5,0)` 先 clear，再读取 begin + 5 * 4，即地址 `0x14`；该 fixture 在该原读取指令处停止。
- vtable `0x5c9e70` 的 create 返回 true，update 返回 true，render 从所选 vector 项调用 virtual + 8。
- 全 EXE executable section 中 singleton global `0x6d2958` 只由 getter 内一次写入和一次读取访问。
- getter `0x4855ec` 只有两个直接调用者，分别来自 type10 start `0x47ee9a` 与 end `0x47eea7`。
- 当前未找到创建 index5 对象的代码，也未找到原 index5 shader、纹理或运行参数。

四个旧 source 的库内事实如下。resource 字段均为空，名称与生命周期以外的外观字段没有可用来源。

| 节点 index | 节点 ID | 原名称 | 直接父 | delay | lifetime | controllers |
|---:|---:|---|---|---:|---:|---|
| 810 | 2248496824 | `_root\other\1000\11014\s2\4\mohu` | 809 `_root\other\1000\11014\s2\4` | 0 | 0 | `[0,0,flag0]` |
| 901 | 2515697551 | `_root\other\1000\11007\s3\mohu` | 当前子图无现存父 | 0 | 1.0299999713897705 | `[0,0,flag0]` |
| 2187 | 3696309925 | `_root\other\1000\11008\s3\1\mohu` | 2186 `_root\other\1000\11008\s3\1` | 0.8999999761581421 | 0.4000000059604645 | `[0,0,flag0]` |
| 2258 | 1966552762 | `_root\other\1000\11013\s2\dong` | 798 `_root\other\1000\11013\s2` | 0.6000000238418579 | 2.299999952316284 | `[0,0,flag0]` |

节点 810 的 `_root\other\1000\11014\s2\4` 由 809 持有，809 属于 802。节点 2187 的父链包含 2186 与 2180。节点 2258 的父链只定位到 798；当前导出图中没有名字恰为 `_root\other\1000\11013` 的根。节点 901 没有现存节点把它列为 child。以上四条旧分支没有完整根到叶的可达链可被当作当前正式技能引用。

## 原生命周期顺序

现有 `EffectScreenNodeState` 与 `EffectNodeLifecycle` 已按原执行顺序保留下列行为：

1. type10 节点在 lifecycle 从 phase1 进入 phase2 的 activation 钩子中调用一次 `selectEffect(5,0)`。
2. type10 在 lifetime 结束时调用 `clearEffect()`。
3. 父节点显式 stop 或树销毁时，节点 end 钩子执行同一个 clear。
4. 节点没有子节点且 `retainWhenEnded` 为 false 时，release 从 lifecycle 父列表移除并释放状态。
5. 节点 810 的 lifetime 为 0，现有原生命周期对照不会自动 clear；它需要父树 stop、round 清理或 scene 销毁。
6. 节点 901、2187、2258 的自动结束点分别为总 elapsed 1.0299999713897705、1.2999999821186066 和 2.899999976158142。

`recovery/output/effect-screen-lifecycles-native.json` 已验证四者的 select、clear、release 与 phase/controller 顺序。该结果只证明 backend 调用合同，不证明原 postprocess 绘制。

## Web 采用视觉

采用方案为：使用现有全屏 overlay 入口绘制一个无纹理的屏幕空间四边形，统一填充 `RGBA=(0,0,0,0.25)`。激活后保持常量 alpha 到 clear，不做淡入、淡出、模糊、颜色映射或纹理采样。

理由：

- 四个节点的 resource 均为空。没有原 shader、纹理、颜色、帧或参数可以限定外观。
- type10 原语义是 scene 级屏幕选择，不是世界空间 sprite。现成 `EffectOverlayMesh` 已经有真实全屏 XYZRHW quad、正交 viewport 和 renderingGroupId=2 入口，复用它的代码边界最小。
- 常量中性黑不借名称 `mohu` 推断模糊，也不借 `dong` 推断其它含义。它只提供明确可见的 Web 采用反馈。
- 不新增 texture、PostProcess pipeline、GBF 兼容层或原资源替代，后续若取得原 index5 对象，只替换后端视觉类，不改变生命周期、所有权或业务入口。

这不是原恢复。
## fixed-screen-contract

### 固定接口

`EffectScreenBackend` 增加激活 owner，用于重叠树隔离：

```ts
export interface EffectScreenBackend {
  selectEffect(index: number, parameter: number, owner: symbol): void;
  clearEffect(owner: symbol): void;
  shake(parameter: number, lifetime: number, strength: number): void;
}
```

`EffectScreenNodeState` 在每次 type10 activation 时创建一个新 symbol，并保存为当前 owner：

```ts
private activation?: symbol;

activate(lifetime: number): void {
  if (this.config.type === 10) {
    const owner = Symbol();
    this.activation = owner;
    this.backend.selectEffect(5, 0, owner);
  } else if (lifetime > 0) {
    this.backend.shake(this.config.parameter, Math.fround(lifetime), this.config.strength);
  }
}

end(): void {
  if (this.config.type !== 10 || !this.activation) return;
  const owner = this.activation;
  this.activation = undefined;
  this.backend.clearEffect(owner);
}
```

每次 activation 都使用新 owner。这样同一节点重新激活时，旧 activation 的延迟 clear 不会清掉新 activation。

### Scene 唯一所有权

- 每个 `EffectRuntime` 实例只创建一个 `LegacyScreenEffectBackend`。`EffectRuntime` 已按 scene 创建，因此后端也按 scene 唯一。
- 后端不得放在模块全局、跨 scene WeakMap 或共享 singleton 中。
- 同一 scene 同时最多存在一个已选中的屏幕效果。新 `selectEffect` 是 replacement，不是叠加。
- 一个 1x1 Web 自有 texture 与一个 `EffectOverlayDrawState` 可由后端按需复用；每个 active overlay mesh/material 在 clear 或 replacement 时释放。

### 重叠 tree

- 任意 tree 调用的 `selectEffect(5,0,owner)` 先释放当前 active overlay，再创建该 owner 的 overlay，并把它记为当前 owner。
- 当前 owner 调用的 `clearEffect(owner)` 释放 overlay 并清空 owner。
- 非当前 owner 的 clear 是 stale clear，不再释放当前 overlay。该规则避免已结束的旧 tree 清掉后来 tree 的效果。
- type10 controller 的本地 controller 数固定为 0，不参与屏幕效果切换；选择只由 activation 与 owner 生命周期决定。
- clear 必须幂等。重复 end、replacement 后旧 owner 的 end、显式 stop 后再次 end 都不得产生第二次释放。

### 失败合同

- `selectEffect` 收到 index 不是 5 或 parameter 不是 0 时，抛出明确错误，例如 `Unsupported legacy screen effect selection`。不能静默忽略。
- scene dispose 后收到 select，抛出明确错误，例如 `Legacy screen effect backend is disposed`。不能静默忽略。
- 创建 texture、rectangle、material、mesh 或 shader 任一步失败时，释放该次创建已经产生的部分对象，保持 owner 为空，然后把原错误继续抛出。
- 当前 active 在 replacement 开始时已按原 Select 的 clear-first 顺序释放。创建失败的 replacement 不留下半初始化 mesh，也不把失败选择记成 active。
- stale clear 的成功 no-op 是 owner 合同，不是 unsupported selection 的成功 no-op。

### 销毁与清理

- 正常 lifetime end：lifecycle end 调用 `clearEffect(owner)`。
- 父树 stop：父 lifecycle 逆序 stop 子节点，type10 end 调用 `clearEffect(owner)`。
- round 清理、角色 detach、scene clear：`EffectRuntime.remove` 调 `tree.dispose()`。`EffectRuntimeTree.dispose()` 必须在 `releaseState()` 前调用 `screen?.end()`，确保没有 active 屏幕效果继续持有已移除树的 owner。
- `EffectRuntime.clear` 在移除全部 instance 后调用 `screenBackend.clear()`，强制释放任何未由 tree end 释放的 active overlay。
- scene `onDisposeObservable` 的现有 `stop()` 路径清理 active，随后调用 `screenBackend.dispose()`，释放共享 1x1 texture，并使后续 select 走 disposed 错误。
- 退出后不得残留 mesh、material、texture、owner 或 scene observer。

### 绘制入口

后端只复用以下现有有效入口：

- `EffectOverlayDrawState.draw([0,0,0,0.25], false, [0,0,1,1])` 生成全屏像素矩形。
- `EffectOverlayMesh` 生成 XYZRHW 全屏 quad，renderingGroupId=2，禁用 depth write，使用 SRCALPHA/INVSRCALPHA。
- `EffectRuntime.update` 在 render 前调用后端的尺寸同步。后端缓存 `engine.getRenderWidth()` 与 `getRenderHeight()`，尺寸变化时 resize 并重新提交矩形。

不修改现有 `EffectOverlayMesh` 的原 type8 语义。若需要无纹理颜色，优先给该 mesh 一个专用 pass 或使用 1x1 白 texture 乘以固定顶点色，不能改变 type8 的纹理采样、UV 或原 pass 状态。

## 实现范围

后续生产实现限定在以下文件：

- 新增 `apps/web/src/render/effects/runtime/legacy-screen-effect.ts`，只实现 scene 唯一后端、常量全屏遮罩、owner、失败清理和 dispose。
- `apps/web/src/render/effects/runtime/effect-screen-node.ts`，只增加 activation owner 并保持 type10 的 `Select(5,0)`、`Clear` 顺序。
- `apps/web/src/render/effects/runtime/effect-runtime-tree.ts`，只在 `dispose()` 增加 `screen?.end()`，保持原节点创建、顺序、释放和其它类型行为不变。
- `apps/web/src/render/effects/runtime/effect-runtime.ts`，只把 index5 throw 替换为真实 backend，传入 tree，并在 update/clear/dispose 生命周期调用 backend。

不得新增或修改：

- 战斗技能表、ELK 链接、skill notification、消息协议或新战斗入口。
- 测试、浏览器、调试按钮、fixture 按钮或开发者 UI。
- 原 GBF、原 texture、原 shader 或像素等价声明。
- 当前 342 技能可达集合和 type10 可达数量的既有事实。

## 局限

当前事实保持：原 index5 初始化来源未知，原 shader/纹理/参数不可达，342 条技能中 type10 可达数量为 0，Web 采用视觉不是原恢复。
