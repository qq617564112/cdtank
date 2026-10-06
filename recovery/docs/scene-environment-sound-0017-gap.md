# 0017 魔王山迷宫原环境声音实际输出缺口

原Sound215/BG06、230/BG12、231/BG11三声音source已恢复，独立export17、共享export_scenes hook与MapEnvironmentSound map17资格已接。source17 JSON/log PASS原位置、完整tail、enabled1/gain1/interval0/random0与三WAV字节，公共空间循环来源复用。合法mode4/map17正式React普通建房加入/两CPU/准备进入四人对局已完成。

两次普通输入实际段均保留整体FAIL：`browser-scene-environment-sound17-2026-10-04T15-55-06-437Z.json` 与第二次raw（browser-run2.log记录路径）。四十秒原NAV规划KeyA/D/W接近，再普通托管，第二次只改短按转向与六十秒输入窗口，没有修改玩家状态、相机、伤害、声音距离或场景时钟。三voice都实际playing/自然循环，但至少一个网页未取得非零master输出；不能以loop或音量值替代声音结果。

独立cleanup17.json确认3326/5356/9556关闭、专属process/tmp0。没有第三次run、没有降低双端输出条件。Leave/重入/再Leave阶段在声音gate之后，未执行，保持未完成。缺失入口是能使第二网页通过普通输入进入原声音实际有效距离的玩家流程，不是WAV或consumer源缺失。

离线复核以每个原始样本的 Web Audio listener 坐标计算距离，并逐样本重算 `MapEnvironmentSound.update()` 的 `referenceDistance=100`、`maxDistance=1600`、`rolloffFactor=2` 合同。正增益的实际边界是距离小于850；两次 raw 的观测增益与该公式一致（第一次 P1 对 BG06/BG12 分别约0.630/0.012，第二次最近样本约891仍为0）。因此当前失败不是 listener 变换或增益实现错误，也没有可安全修改的声音 source hunk。详细复算见 `scene-environment-sound17-gap-analysis.json`。

M3-05-SOUND17如需登记应保持未勾；保存来源与接线代码、两份原raw与输入/输出有效范围，整图/高清性能父项未完成。地图线转向合法0005原常驻Effect042缺失内容，不继续反复补验本声音缺口。tasklist/progress由主线维护。
