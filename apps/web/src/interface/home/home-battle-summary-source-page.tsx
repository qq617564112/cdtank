import './home-battle-summary-source-page.css';
import {useEffect, useRef, useState} from 'react';
import type {AccountHistorySource} from '../account/history';
import type {MatchHistoryRecord} from '../../../../shared/protocols/PtlHistory';
import type {AccountStatistics} from '../../../../shared/protocols/PtlRoleProfile';
import type {HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'myhome_playerpage_battlesummary.xml';
/** Source static-text controls in their original layout order, keyed by their business field. */
const FIELDS = [
  {control: 'txtWinCount', key: 'wins'}, {control: 'txtLoseCount', key: 'losses'},
  {control: 'txtDrawCount', key: 'draws'}, {control: 'txtComboWinCount', key: 'winStreak'},
  {control: 'txtComboLoseCount', key: 'loseStreak'}, {control: 'txtHitCount', key: 'hits'},
  {control: 'txtShootCount', key: 'shots'}, {control: 'txtMaxComboCount', key: 'killCombo'},
  {control: 'txtDestroyCount', key: 'kills'}, {control: 'txtBeDestroyCount', key: 'deaths'},
  {control: 'txtTotalDamage', key: 'damage'}, {control: 'txtTotalDays', key: 'totalDays'},
  {control: 'txtTotalTime', key: 'totalTime'}, {control: 'txtHitRate', key: 'hitRate'},
] as const;
type Field = typeof FIELDS[number]['key'];
type DisplayValues = Partial<Record<Field, string>>;
/** Fields the saved-history projection can still supply when the profile has no statistics. */
const FALLBACK = new Set<Field>(['wins', 'losses', 'draws', 'kills', 'deaths']);
interface SavedTotals {count: number; wins: number; losses: number; draws: number; kills: number; deaths: number;}

function summarize(records: readonly MatchHistoryRecord[]): SavedTotals {
  return records.reduce((totals, record) => {
    totals.count++;
    if (record.result.outcome === 'WIN') totals.wins++;
    if (record.result.outcome === 'LOSE') totals.losses++;
    if (record.result.outcome === 'DRAW') totals.draws++;
    totals.kills += record.result.kills;
    totals.deaths += record.result.deaths;
    return totals;
  }, {count: 0, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0});
}

/** Authoritative lifetime statistics plus the confirmed win/loss fields projected from saved matches. */
function fromStats(stats: AccountStatistics): DisplayValues {
  const value = (input: number | undefined) => input === undefined ? undefined : String(input);
  const days = Math.floor(stats.battleSeconds / 86400);
  const hours = Math.floor((stats.battleSeconds % 86400) / 3600);
  const hitRate = stats.shots === undefined || stats.hits === undefined
    ? undefined : stats.shots === 0 ? '0%' : `${Math.round((stats.hits / stats.shots) * 100)}%`;
  return {
    wins: String(stats.wins), losses: String(stats.losses), draws: String(stats.draws),
    winStreak: String(stats.winStreak), loseStreak: String(stats.loseStreak),
    kills: String(stats.kills), deaths: String(stats.deaths),
    hits: value(stats.hits), shots: value(stats.shots),
    damage: value(stats.damage), killCombo: value(stats.killCombo),
    totalDays: String(days), totalTime: String(hours), hitRate,
  };
}

function fromTotals(totals: SavedTotals): DisplayValues {
  return {
    wins: String(totals.wins), losses: String(totals.losses), draws: String(totals.draws),
    kills: String(totals.kills), deaths: String(totals.deaths),
  };
}

/**
 * Confirmed profile statistics drive the full source region; when the profile carries no
 * lifetime statistics the five win/loss fields fall back to the saved-history projection.
 */
export function HomeBattleSummarySourcePage({source, statistics, onError}: {
  ui: HomeSourceUi; source: AccountHistorySource; statistics?: AccountStatistics; onError(message: string): void;
}) {
  const errorCallback = useRef(onError); errorCallback.current = onError;
  const [totals, setTotals] = useState<SavedTotals>();
  const [pending, setPending] = useState(true);
  const [status, setStatus] = useState('载入已保存对局统计…');
  const owner = useRef({active: false, pending: false});
  useEffect(() => {
    const current = {active: true, pending: false};
    owner.current = current;
    if (!statistics) void load(current);
    else setPending(false);
    return () => {current.active = false;};
  }, [source, statistics]);

  useEffect(() => {
    if (statistics) {setStatus('账户统计'); setTotals(undefined);}
  }, [statistics]);

  async function load(current = owner.current) {
    if (statistics) return;
    if (!current.active || current.pending) return;
    current.pending = true; setPending(true); setStatus('载入已保存对局统计…');
    try {
      const records: MatchHistoryRecord[] = [];
      let total: number;
      do {
        const response = await source.history(records.length, 50);
        if (!current.active) return;
        total = response.total;
        if (!response.records.length && records.length < total) throw new Error('对局记录分页未完整返回');
        records.push(...response.records);
      } while (records.length < total);
      setTotals(summarize(records));
      setStatus(`已保存对局统计 · ${records.length} 场`);
    } catch (error) {
      if (current.active) {
        const message = `统计载入失败：${error instanceof Error ? error.message : String(error)}`;
        setStatus(message); errorCallback.current(message);
      }
    } finally {
      current.pending = false;
      if (current.active) setPending(false);
    }
  }
  const queryFailed = status.startsWith('统计载入失败：');
  const values: DisplayValues = statistics ? fromStats(statistics) : totals ? fromTotals(totals) : {};
  return <section className="home-battle-summary-source" data-home-saved-summary="" aria-label="已保存对局统计" aria-busy={pending}>
    <HomeBattleStatistics values={values}/>
    <output hidden data-home-saved-summary-status="" data-summary-query-error={queryFailed || undefined}>{status}</output>
  </section>;
}

/** The same lifetime-statistics table serves the account and public player cards. */
export function HomeBattleStatistics({statistics, values = statistics ? fromStats(statistics) : {}}: {
  statistics?: AccountStatistics; values?: DisplayValues;
}) {
  const stat = (key: Field) => <span className="home-stat-value" data-source-control={FIELDS.find(field => field.key === key)!.control}
    data-source-layout={`ui/layouts/${SUFFIX}`} data-summary-statistics={key} data-summary-statistics-value={values[key]}
    data-saved-summary-field={FALLBACK.has(key) ? key : undefined}
    data-saved-summary-value={FALLBACK.has(key) ? values[key] : undefined}>{values[key] ?? ''}</span>;
  return <div className="home-battle-statistics-grid">
    <div className="home-stat-card home-stat-results">
      <div><span>获胜</span>{stat('wins')}</div>
      <div><span>失败</span>{stat('losses')}</div>
      <div><span>打和</span>{stat('draws')}</div>
    </div>
    <div className="home-stat-card home-stat-accuracy">
      <div className="home-stat-fraction"><div><span>命中</span>{stat('hits')}</div>
        <div><span>发射</span>{stat('shots')}</div></div>
      <span className="home-stat-hit-rate">={stat('hitRate')}</span>
      <div className="home-stat-combo"><span>连续击毁</span>{stat('killCombo')}</div>
    </div>
    <div className="home-stat-card home-stat-total"><span>总伤害值</span>{stat('damage')}</div>
    <div className="home-stat-card home-stat-streaks">
      <div><span>连胜</span>{stat('winStreak')}</div>
      <div><span>连败</span>{stat('loseStreak')}</div>
    </div>
    <div className="home-stat-card home-stat-kills">
      <div><span>击毁数</span>{stat('kills')}</div>
      <div><span>被击毁</span>{stat('deaths')}</div>
    </div>
    <div className="home-stat-card home-stat-total"><span>总战斗时间</span>
      <span className="home-stat-duration">{stat('totalDays')}天{stat('totalTime')}时</span>
    </div>
  </div>;
}
