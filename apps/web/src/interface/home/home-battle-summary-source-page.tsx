import './home-battle-summary-source-page.css';
import {useEffect, useRef, useState} from 'react';
import type {AccountHistorySource} from '../account/history';
import type {MatchHistoryRecord} from '../../../../shared/protocols/PtlHistory';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'myhome_playerpage_battlesummary.xml';
const FIELDS = {
  txtWinCount: 'wins', txtLoseCount: 'losses', txtDrawCount: 'draws',
  txtDestroyCount: 'kills', txtBeDestroyCount: 'deaths',
} as const;
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

/** Confirmed saved matches populate five source fields, without lifetime/reward authority. */
export function HomeBattleSummarySourcePage({ui, source}: {ui: HomeSourceUi; source: AccountHistorySource}) {
  const [totals, setTotals] = useState<SavedTotals>();
  const [pending, setPending] = useState(true);
  const [status, setStatus] = useState('载入已保存对局统计…');
  const owner = useRef({active: false, pending: false});
  useEffect(() => {
    const current = {active: true, pending: false};
    owner.current = current;
    void load(current);
    return () => {current.active = false;};
  }, [source]);

  async function load(current = owner.current) {
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
      if (current.active) setStatus(`统计载入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      current.pending = false;
      if (current.active) setPending(false);
    }
  }
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const queryFailed = status.startsWith('统计载入失败：');
  return <section className="home-battle-summary-source" data-home-saved-summary="" aria-label="已保存对局统计" aria-busy={pending}>
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="xiamiandeditu" aria-hidden="true" />
    <SourceImageScale value={1}>{Object.entries(FIELDS).map(([name, field]) => <SourceStaticText key={name} ui={ui} layout={layout}
      suffix={SUFFIX} name={name} text={totals ? String(totals[field]) : ''}
      data-saved-summary-field={field} data-saved-summary-value={totals?.[field]} />)}</SourceImageScale>
    <output role="status" className="home-battle-summary-status" data-home-saved-summary-status=""
      data-summary-query-error={queryFailed || undefined} tabIndex={queryFailed ? 0 : undefined}
      title={queryFailed ? status : undefined}>{status}</output>
    <button type="button" className="home-battle-summary-refresh" data-home-saved-summary-refresh="" disabled={pending}
      onClick={() => {void load();}}>刷新统计</button>
  </section>;
}
