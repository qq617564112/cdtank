import type {TitleDefinition, TitleStats} from './title';

/** New title IDs follow the original catalog's 1–158 without changing its source table. */
export const CREATIVE_TITLE_DEFINITIONS: readonly TitleDefinition[] = [
  {id: 159, name: '别急，我在装填', description: '单场发射至少80发炮弹，命中对手至少30次。'},
  {id: 160, name: '炮弹包邮', description: '正常完赛累计发射至少5000发炮弹。'},
  {id: 161, name: '炮口很有礼貌', description: '单场射击至少30次，未命中任何对手。'},
  {id: 162, name: '我的炮有想法', description: '单场连续至少10次未命中后，紧接着的一炮击毁对手。'},
  {id: 163, name: '弹道艺术家', description: '连续50次射击中，至少45次命中对手。'},
  {id: 164, name: '打中了，但没完全打中', description: '单场命中对手至少30次，击毁数为0。'},
  {id: 165, name: '铁皮小强', description: '单场被击毁至少6次、击毁对手至少5次，最终获胜。'},
  {id: 166, name: '你先笑，我先赢', description: '单场首次击毁对手前已被击毁至少3次，最终击毁数至少8并获胜。'},
  {id: 167, name: '嘴硬装甲', description: '连续失败至少3场后，紧接着连续获胜5场。'},
  {id: 168, name: '今天炮很顺', description: '连续5场获胜，每场击毁数至少5。'},
  {id: 169, name: '全场请看炮', description: '连续20场战斗中，至少15场获得MVP。'},
  {id: 170, name: '履带劳模', description: '累计完成至少500场非弃权战斗。'},
  {id: 171, name: '差一炮就下班', description: '乱斗模式单场击毁数至少10，结算时失败且击毁数比胜者少1次。'},
  {id: 172, name: '奖杯塞不下了', description: '单场获得至少5种战斗奖项。'},
  {id: 173, name: '赢得比较含蓄', description: '团队模式单场命中对手至少30次、未击毁对手，队伍仍然获胜。'},
  {id: 174, name: '炮声就是自我介绍', description: '单场有至少4名对手，且击毁过每一名对手。'},
  {id: 175, name: '这把我熟', description: '同一张地图累计正常完赛获胜至少100场。'},
  {id: 176, name: '下一位！', description: '单场连续三次射击，每次都击毁一名对手。'},
  {id: 177, name: '这炮不白打', description: '单场射击至少15次，每次都命中对手，且击毁数至少3。'},
  {id: 178, name: '专治不服', description: '单场击毁同一名对手至少8次。'},
  {id: 179, name: '试着开一炮', description: '正常完赛累计发射至少200发炮弹。'},
  {id: 180, name: '火力批发商', description: '正常完赛累计发射至少25000发炮弹。'},
  {id: 181, name: '本人就是炮台', description: '正常完赛累计发射至少100000发炮弹。'},
].map(title => ({...title, description: `${title.description}须正常完赛，弃权或中途离场不计。`,
  condition: {kind: 'creative' as const, id: title.id}, conditionAvailable: true}));

/** Evaluate recorded battle events and rolling windows once for the settlement's whole catalog. */
export function evaluateCreativeTitleGrants(stats: TitleStats): ReadonlySet<number> {
  const eligible = new Set<number>();
  let losses = 0, comebackWins = 0, armedRounds = 0, completedRounds = 0, shots = 0;
  let recentShots = '';
  const recentMvp: boolean[] = [];
  const winsByMap = new Map<number, number>();
  for (const match of stats.history ?? []) {
    const result = match.result;
    const round = result.roundStats;
    if (match.reason === 'FORFEIT' || round?.completedRound !== true) {
      losses = 0;
      comebackWins = 0;
      armedRounds = 0;
      recentShots = '';
      recentMvp.length = 0;
      continue;
    }
    completedRounds++;
    shots += round.shots;
    const won = result.outcome === 'WIN';
    if (!won) comebackWins = 0;
    else if (losses >= 3) comebackWins = 1;
    else if (comebackWins > 0) comebackWins++;
    if (comebackWins >= 5) eligible.add(167);
    losses = result.outcome === 'LOSE' ? losses + 1 : 0;
    armedRounds = won && result.kills >= 5 ? armedRounds + 1 : 0;
    if (armedRounds >= 5) eligible.add(168);
    if (completedRounds >= 500) eligible.add(170);

    recentMvp.push(result.awards?.some(award => award.type === 'mvp') === true);
    if (recentMvp.length > 20) recentMvp.shift();
    if (recentMvp.length === 20 && recentMvp.filter(value => value).length >= 15) eligible.add(169);
    if (new Set(result.awards?.map(award => award.type)).size >= 5) eligible.add(172);

    if (won) {
      const mapWins = (winsByMap.get(match.mapId) ?? 0) + 1;
      winsByMap.set(match.mapId, mapWins);
      if (mapWins >= 100) eligible.add(175);
      if (result.deaths >= 6 && result.kills >= 5) eligible.add(165);
      if (match.mode <= 3 && result.kills === 0 && round.hits >= 30) eligible.add(173);
      if (result.kills >= 8 && round.openingDeaths !== undefined && round.openingDeaths >= 3) {
        eligible.add(166);
      }
    }
    if (round.shots >= 80 && round.hits >= 30) eligible.add(159);
    if (round.shots >= 30 && round.hits === 0) eligible.add(161);
    if (round.hits >= 30 && result.kills === 0) eligible.add(164);
    if (round.shots >= 15 && round.hits === round.shots && result.kills >= 3) eligible.add(177);
    if (round.maxMissesBeforeShotKill !== undefined && round.maxMissesBeforeShotKill >= 10) {
      eligible.add(162);
    }
    if (round.maxConsecutiveShotKills !== undefined && round.maxConsecutiveShotKills >= 3) {
      eligible.add(176);
    }
    if (round.killedAllOpponents === true && (round.killedOpponentIds?.length ?? 0) >= 4) {
      eligible.add(174);
    }
    if (round.maxKillsAgainstOpponent !== undefined && round.maxKillsAgainstOpponent >= 8) {
      eligible.add(178);
    }
    if (result.outcome === 'LOSE' && match.mode === 4 && result.kills >= 10
        && round.oneKillBehindWinner === true) {
      eligible.add(171);
    }

    // Missing legacy shot order breaks the window; it never contributes invented hits or misses.
    if (round.shotHits === undefined) {
      recentShots = '';
      continue;
    }
    for (const hit of round.shotHits) {
      recentShots = (recentShots + hit).slice(-50);
      if (recentShots.length === 50 && [...recentShots].filter(value => value === '1').length >= 45) {
        eligible.add(163);
      }
    }
  }
  if (shots >= 200) eligible.add(179);
  if (shots >= 5000) eligible.add(160);
  if (shots >= 25000) eligible.add(180);
  if (shots >= 100000) eligible.add(181);
  return eligible;
}
