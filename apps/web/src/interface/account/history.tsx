import './history.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ResHistory} from '../../../../shared/protocols/PtlHistory';

export interface AccountHistorySource {
  history(offset?: number, limit?: number): Promise<ResHistory>;
}

export interface AccountHistoryViewProps {
  open: boolean;
  close: () => void;
  source: AccountHistorySource;
}

const MODE_NAMES = ['未知', '团队', '占领', '擒王', '混战', '破坏'];
const OUTCOME_NAMES = {WIN: '胜利', LOSE: '失败', DRAW: '平局'};
const REASON_NAMES = {TIME_LIMIT: '时间结束', OBJECTIVE: '目标完成', FORFEIT: '退出结束'};
const PAGE_LIMIT = 20;

/** Rebuilt account window displays only server-confirmed match settlement records. */
export function AccountHistoryView({open, close, source}: AccountHistoryViewProps) {
  return open ? <HistorySession close={close} source={source} /> : null;
}

function HistorySession({close, source}: Omit<AccountHistoryViewProps, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useRef({active: false, pending: false, generation: 0});
  const requestFocus = useRef<HTMLElement | null>(null);
  const [confirmed, setConfirmed] = useState<ResHistory>();
  const [pending, setPending] = useState(true);
  const [status, setStatus] = useState('载入对局记录…');

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const current = {active: true, pending: false, generation: 0};
    session.current = current;
    setConfirmed(undefined);
    void load(0, current);
    return () => {current.active = false; current.generation++;};
  }, [source]);

  useLayoutEffect(() => {
    if (pending || !requestFocus.current) return;
    const target = requestFocus.current;
    requestFocus.current = null;
    if (target.isConnected && (document.activeElement === document.body
        || document.activeElement === dialog.current || document.activeElement === target)) target.focus();
  }, [pending]);

  async function load(offset: number, current = session.current) {
    if (!current.active || current.pending) return;
    const focused = document.activeElement;
    requestFocus.current = focused instanceof HTMLElement && dialog.current?.contains(focused) ? focused : null;
    const generation = ++current.generation;
    current.pending = true;
    setPending(true);
    setStatus('载入对局记录…');
    try {
      const response = await source.history(offset, PAGE_LIMIT);
      if (!current.active || generation !== current.generation) return;
      setConfirmed(response);
      setStatus(response.total ? `共 ${response.total} 场已保存比赛` : '还没有已保存的对局记录');
    } catch (error) {
      if (current.active && generation === current.generation) {
        setStatus(`对局记录载入失败：${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      if (current.active && generation === current.generation) {
        current.pending = false;
        setPending(false);
      }
    }
  }

  function requestClose() {
    const current = session.current;
    current.active = false;
    current.generation++;
    dialog.current?.close();
    close();
  }

  const offset = confirmed?.offset ?? 0;
  const total = confirmed?.total ?? 0;
  const records = confirmed?.records ?? [];
  return <dialog ref={dialog} id="account-history" aria-labelledby="account-history-title" aria-busy={pending}
    onCancel={event => {event.preventDefault(); requestClose();}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <h2 id="account-history-title">我的对局记录</h2>
    <p className="account-history-description">账户保存的比赛结算</p>
    <output data-history-status="" role="status" aria-live="polite">{status}</output>
    <div className="account-history-scroll">
      <table aria-label="已结束的比赛">
        <thead><tr>{['时间', '模式 / 地图', '胜负 / 排名', '击杀 / 死亡', '目标', '得分', '结束原因'].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody data-history-rows="">{records.map(record => {
          const result = record.result;
          return <tr key={record.matchId} data-history-match={record.matchId}>
            <td>{new Date(record.endedAt).toLocaleString('zh-CN')}</td>
            <td>{MODE_NAMES[record.mode] ?? '未知'} / {record.mapId}</td>
            <td>{OUTCOME_NAMES[result.outcome]} / 第 {result.rank} 名</td>
            <td>{result.kills} / {result.deaths}</td>
            <td>{result.objectivesDestroyed}</td>
            <td>{result.totalScore}（战斗 {result.combatScore} + 结算 {result.outcomeBonus}）</td>
            <td>{REASON_NAMES[record.reason]}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <nav aria-label="对局记录分页">
      <button type="button" data-history-previous="" disabled={pending || !confirmed || offset === 0}
        onClick={() => {void load(Math.max(0, offset - PAGE_LIMIT));}}>上一页</button>
      <span data-history-page="">{confirmed && `第 ${Math.floor(offset / PAGE_LIMIT) + 1} / ${Math.max(1, Math.ceil(total / PAGE_LIMIT))} 页`}</span>
      <button type="button" data-history-next="" disabled={pending || !confirmed || offset + records.length >= total}
        onClick={() => {void load(offset + PAGE_LIMIT);}}>下一页</button>
      <button type="button" data-history-refresh="" disabled={pending}
        onClick={() => {void load(offset);}}>刷新 / 重试</button>
    </nav>
    <button type="button" data-history-close="" onClick={requestClose}>返回</button>
  </dialog>;
}
