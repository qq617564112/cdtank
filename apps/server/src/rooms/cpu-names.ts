const CPU_NAMES: readonly string[] = [
  '喵喵炮手', '汪汪队长', '橘猫冲锋', '奶牛猫长',
  '胖橘装甲', '狸花游侠', '布偶突击', '黑猫潜行',
  '白猫哨兵', '三花快车', '柴犬开炮', '柯基履带',
  '二哈拆家', '金毛重炮', '斑点狗王', '奶狗出击',
  '猫爪榴弹', '骨头加农', '肉垫铁骑', '尾巴漂移',
  '鱼干弹夹', '罐头骑士', '猫薄荷炮', '骨头火箭',
  '小鱼雷达', '牛奶装甲', '布丁炮台', '奶糖车长',
  '爆米花炮', '芝士履带', '南瓜炮王', '木桶伏兵',
  '西瓜轰轰', '豆包冲锋', '蛋挞坦克', '麻薯快跑',
  '饭团突袭', '薯条开炮', '汽水装填', '饼干堡垒',
  '滚滚铁罐', '迷路炮弹', '炮口冒泡', '履带打滑',
  '倒车大师', '草丛蹲蹲', '转角放炮', '瞄准月亮',
  '炮弹迟到', '装甲漏风', '别打尾巴', '一炮喵呜',
  '轰隆汪汪', '拐弯翻车', '满载小鱼', '软星游侠',
  '仙剑小猫', '田园车神', '工厂巡汪', '沙漠胖橘',
];

/** The room's twelve participant slots leave unused names in the sixty-name pool. */
export function randomCpuName(occupied: Iterable<string>): string {
  const used = new Set(occupied);
  const available = CPU_NAMES.map(name => `${name}[bot]`).filter(name => !used.has(name));
  return available[Math.floor(Math.random() * available.length)];
}
