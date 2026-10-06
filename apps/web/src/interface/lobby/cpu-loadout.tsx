import './cpu-loadout.css';
import {useEffect, useRef, useState} from 'react';
import type {PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {CpuLoadoutItem} from '../../../../shared/protocols/PtlCpu';
import type {CombatCatalog, CombatItemDefinition} from '../../../../shared/combat/catalog';
import {CPU_LOADOUT_ITEM_IDS} from '../../../../shared/combat/cpu-loadout';

interface CpuLoadoutViewProps {
  player: PlayerSnapshot;
  busy: boolean;
  configure: (loadout: CpuLoadoutItem[]) => Promise<void>;
}
interface SlotDraft {slot: number; itemTableId: number; quantity: string;}
const SLOTS = [2, 3, 4, 5, 6, 7, 8];

export function CpuLoadoutView(props: CpuLoadoutViewProps) {
  return <CpuLoadoutEditor key={props.player.id} {...props}/>;
}

function CpuLoadoutEditor({player, busy, configure}: CpuLoadoutViewProps) {
  const [items, setItems] = useState<CombatItemDefinition[]>();
  const [draft, setDraft] = useState<SlotDraft[]>(() => SLOTS.map(slot => {
    const item = player.cpuLoadout?.find(value => value.slot === slot);
    return {slot, itemTableId: item?.itemTableId ?? 0, quantity: String(item?.quantity || 1)};
  }));
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const requestPending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    void fetch('/combat-catalog.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error(`道具目录读取失败：${response.status}`);
      const catalog: CombatCatalog = await response.json();
      if (generation.current === current) {
        setItems(catalog.items.filter(item => CPU_LOADOUT_ITEM_IDS.includes(item.itemTableId)));
      }
    }).catch(error => {
      if (!controller.signal.aborted && generation.current === current) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    });
    return () => {generation.current++; controller.abort();};
  }, []);
  const allowed = (slot: number) => items?.filter(item => slot <= 4
    ? item.itemTableId === 2007 || item.itemTableId === 2011
    : item.itemTableId >= 1 && item.itemTableId <= 9) ?? [];
  async function save() {
    if (busy || requestPending.current || !items) return;
    const loadout: CpuLoadoutItem[] = [];
    for (const row of draft) {
      if (!row.itemTableId) continue;
      const item = allowed(row.slot).find(value => value.itemTableId === row.itemTableId);
      const quantity = Number(row.quantity);
      if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.battleUseMax) {
        setStatus(`槽${row.slot}数量须为1到${item?.battleUseMax ?? 0}的整数`);
        return;
      }
      loadout.push({slot: row.slot, itemTableId: row.itemTableId, quantity});
    }
    const current = generation.current;
    requestPending.current = true; setPending(true); setStatus('正在确认配给…');
    try {
      await configure(loadout);
      if (generation.current === current) setStatus('配给已确认');
    } catch (error) {
      if (generation.current === current) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      requestPending.current = false;
      if (generation.current === current) setPending(false);
    }
  }
  return <details className="cpu-loadout" data-cpu-loadout={player.id}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <summary>CPU道具 · {player.name}</summary>
    <form onSubmit={event => {event.preventDefault(); void save();}}>
      <div className="cpu-loadout-slots">
        {draft.map(row => {
          const item = items?.find(value => value.itemTableId === row.itemTableId);
          const confirmed = player.cpuLoadout?.find(value => value.slot === row.slot);
          return <div key={row.slot} data-cpu-loadout-slot={row.slot}>
            <label>槽{row.slot} {row.slot <= 4 ? '弹药' : '道具'}
              <select data-cpu-loadout-item="" value={row.itemTableId} disabled={busy || pending || !items}
                onChange={event => {
                  const id = Number(event.currentTarget.value);
                  setDraft(value => value.map(entry => entry.slot === row.slot
                    ? {...entry, itemTableId: id, quantity: '1'} : entry));
                }}>
                <option value={0}>空</option>
                {allowed(row.slot).map(value => <option key={value.itemTableId} value={value.itemTableId}>{value.name}</option>)}
              </select>
            </label>
            <label>数量<input data-cpu-loadout-quantity="" type="number" min={1} max={item?.battleUseMax}
              step={1} value={row.quantity} disabled={busy || pending || !item}
              onChange={event => {
                const quantity = event.currentTarget.value;
                setDraft(value => value.map(entry => entry.slot === row.slot ? {...entry, quantity} : entry));
              }}/></label>
            <span data-cpu-loadout-confirmed="">{confirmed
              ? `余量：${items?.find(value => value.itemTableId === confirmed.itemTableId)?.name ?? confirmed.itemTableId} ×${confirmed.quantity}`
              : '已确认：空'}</span>
          </div>;
        })}
      </div>
      <button type="submit" data-cpu-loadout-save="" disabled={busy || pending || !items}>确认CPU配给</button>
      <output role="status" data-cpu-loadout-status="">{status || (!items ? '正在载入道具目录…' : '')}</output>
    </form>
  </details>;
}
