import {GameMessage} from '../resources/game-message';
import {GameSelectionHighlight} from '../resources/game-selection-highlight';
import type {ResPartMaintenance} from '../../../../shared/protocols/PtlPartMaintenance';
import {createRequestId} from '../../network/request-id';
import './mend-shop-source.css';
import {HomeOwnedTankRowContent} from '../home/home-owned-tank-row-content';
import {MendPartRowContent} from './mend-part-row-content';
import {useEffect, useRef, useState} from 'react';
import type {ResTankMaintenance, TankMaintenanceQuote} from '../../../../shared/protocols/PtlTankMaintenance';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {ShopSource} from './shop';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {ShopOwnedPanel, ShopSourceBackground as SourceStaticImage} from './shop-source-background';
import {HomeStaticText as SourceStaticText} from '../home/home-text';
import {ShopSourceButton as SourceButton} from './shop-source-button';
import {sourceProps} from '../resources/source-ui-props';
import {GameScrollbar} from '../resources/game-scrollbar';
import {MendMaintenanceOptions} from './mend-maintenance-options';

const suffix = 'shop_mendpage.xml';
const legacyCoinImages = new Set([
  'Qbi', 'Qbi0', 'Qbi1', 'Qbi2',
  'yongdaibibaoyang', 'yongdaibibaoyang2', 'yongdaibibaoyang3',
]);
type PartCategory = 'Common' | 'Hat' | 'Mark';
interface MendEntry {id: number; name: string; itemTableId?: number; iconId?: number; ownedQuantity?: number; installed?: boolean; tankId?: number; tankType?: number; durationMinutes?: number;}

/** Current-role install equality from the read-only profile projection. */
function profileInstalled(profile: {bytes: number[]} | undefined, category: PartCategory, instanceId: number): boolean {
  if (!profile) return false;
  const bytes = Uint8Array.from(profile.bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read = (offset: number) => bytes.byteLength >= offset + 4 ? view.getUint32(offset, true) : undefined;
  const id = instanceId >>> 0;
  if (category === 'Hat') return read(0x118) === id;
  if (category === 'Mark') return read(0x13c) === id;
  for (let slot = 0; slot < 5; slot++) if (read(0x148 + slot * 4) === id) return true;
  return false;
}

/** Maintenance sheet consumes confirmed ownership and authoritative Tank maintenance results. */
export function MendShopSourcePage({ui, catalog, source, onBusy}: {
  ui: HomeSourceUi; catalog?: CombatCatalog; source: ShopSource; onBusy(busy: boolean): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [profile, setProfile] = useState<ResRoleProfile>();
  const [maintenance, setMaintenance] = useState<ResTankMaintenance>();
  const [partMaintenance, setPartMaintenance] = useState<ResPartMaintenance>();
  const generation = useRef(0);
  const submitting = useRef(false);
  const [page, setPage] = useState<'Tank' | 'Part'>('Tank');
  const [category, setCategory] = useState<PartCategory>('Common');
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const layout = new HomeSourceLayout(ui, suffix);
  useEffect(() => {
    let active = true;
    ++generation.current;
    setMaintenance(undefined); setPartMaintenance(undefined);
    setBusy(true); onBusy(true);
    void (async () => {
      if (!source.ownedRoles || !source.inventory || !source.roleProfile) throw new Error('拥有资料接口不可用');
      const [tankResult, partResult] = await Promise.all([
        source.tankMaintenance?.({operation: 'QUERY'}), source.partMaintenance?.({operation: 'QUERY'})]);
      const [roles, items, account] = await Promise.all([
        tankResult?.owned ?? source.ownedRoles(), partResult?.inventory ?? source.inventory(),
        tankResult ? {profile: tankResult.profile} : partResult ? {profile: partResult.profile} : source.roleProfile()]);
      if (!active) return;
      setMaintenance(tankResult); setPartMaintenance(partResult);
      setOwned(roles); setInventory(items); setProfile(account); setStatus('');
    })().catch(error => {if (active) setStatus(error instanceof Error ? error.message : String(error));})
      .finally(() => {if (active) {setBusy(false); onBusy(false);}});
    return () => {active = false; ++generation.current; onBusy(false);};
  }, [source, onBusy]);
  const entries: MendEntry[] = page === 'Tank' ? (owned?.equipment ?? []).map(record => {
    const fields = new Map(record.fields), tankId = fields.get(0x24);
    const instanceId = fields.get(0x1c)!;
    const currentTank = maintenance?.tanks.find(tank => tank.instanceId === instanceId);
    return {id: instanceId, name: record.name, tankId, durationMinutes: currentTank?.remainingMinutes ?? fields.get(0x34),
      tankType: catalog?.tankTypes?.find(tank => tank.tankId === tankId)?.tankType};
  }) : (inventory?.records ?? []).filter(record => {
    const type = classifyItemId(record.itemTableId);
    return category === 'Common' ? type >= 8 && type <= 12 : category === 'Hat' ? type === 5 || type === 6 : type === 7;
  }).map(record => {
    const item = catalog?.items.find(item => item.itemTableId === record.itemTableId);
    const currentPart = partMaintenance?.parts.find(part => part.instanceId === record.instanceId);
    return {id: record.instanceId, name: item?.name ?? String(record.itemTableId),
      itemTableId: record.itemTableId, iconId: item?.iconId, installed: profileInstalled(profile?.profile, category, record.instanceId),
      ownedQuantity: currentPart?.remainingMinutes ?? record.ownedQuantity};
  });
  const selectedPart = partMaintenance?.parts.find(part => part.instanceId === selected);
  const selectedQuotes = page === 'Tank'
    ? maintenance?.tanks.find(tank => tank.instanceId === selected)?.quotes : selectedPart?.quotes;
  const canMaintain = page === 'Tank' ? Boolean(source.tankMaintenance) : Boolean(source.partMaintenance && selectedPart?.canMaintain);
  async function maintain(quote: TankMaintenanceQuote) {
    if (!canMaintain || selected === undefined || busy || submitting.current) return;
    const current = generation.current;
    submitting.current = true; setBusy(true); onBusy(true); setStatus('');
    try {
      const request = {operation: 'MAINTAIN' as const, instanceId: selected,
        days: quote.days, currency: quote.currency, requestId: createRequestId()};
      if (page === 'Tank') {
        const result = await source.tankMaintenance!(request);
        if (current !== generation.current) return;
        setMaintenance(result); setOwned(result.owned); setProfile({profile: result.profile});
      } else {
        const result = await source.partMaintenance!(request);
        if (current !== generation.current) return;
        setPartMaintenance(result); setInventory(result.inventory); setProfile({profile: result.profile});
      }
      setStatus('保养已确认');
    } catch (error) {
      if (current === generation.current) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      submitting.current = false;
      if (current === generation.current) {setBusy(false); onBusy(false);}
    }
  }
  const bytes = profile?.profile ? new DataView(Uint8Array.from(profile.profile.bytes).buffer) : undefined;
  const values: Record<string, string> = {txtMoney: bytes ? String(bytes.getUint32(0x70, true)) : '',
    txtCoin: bytes ? String(bytes.getUint32(0x74, true)) : ''};
  const partNames = new Set(['picPartPagePanel', 'heseditu2']);
  const controls = ui.layouts.find(value => value.path.endsWith(suffix))!.windows.filter(control =>
    !/^btn(?:Coin|Money)Mend[0-2]$/.test(control.parent ?? ''));
  return <>
    <ShopOwnedPanel ui={ui} suffix={suffix} tab={`rdo${page}Page`}/>
    <div className="mend-shop-source" data-mend-shop-page="" data-mend-page={page} aria-busy={busy}>
      {selected !== undefined && <MendMaintenanceOptions quotes={selectedQuotes} page={page}
        busy={busy} canMaintain={canMaintain} maintain={quote => {void maintain(quote);}}/>}
      {controls.filter(control => control.type === 'WindowsLook/StaticImage'
        && !legacyCoinImages.has(control.name)).map(control =>
        <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name}
          hidden={control.name === 'dankequ' ? page !== 'Tank' : partNames.has(control.name) ? page !== 'Part' : undefined}
          aria-hidden="true" />)}
      {controls.filter(control => control.type === 'WindowsLook/StaticText' && control.name !== 'txtListQuantity').map(control =>
        <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name}
          text={values[control.name] ?? ''}
          data-mend-text-binding={control.name in values ? 'web-confirmed-account' : 'unbound'} />)}
      {(['Tank', 'Part'] as const).map(kind => <SourceButton key={kind} ui={ui} layout={layout} suffix={suffix}
        source={`rdo${kind}Page`} selected={page === kind} data-mend-select-page={kind}
        aria-label={kind === 'Tank' ? '拥有战车' : '拥有部件'} aria-pressed={page === kind} disabled={busy} aria-busy={busy}
        onClick={() => {generation.current++; setPage(kind); setSelected(undefined);}} />)}
      {page === 'Part' && (['Common', 'Hat', 'Mark'] as const).map(kind => <SourceButton key={kind} ui={ui} layout={layout} suffix={suffix}
        source={`rdo${kind}Page`} selected={category === kind} data-mend-category={kind}
        aria-label={kind === 'Common' ? '一般部件' : kind === 'Hat' ? '装饰' : '标记'}
        aria-pressed={category === kind} disabled={busy} aria-busy={busy} onClick={() => {generation.current++; setCategory(kind); setSelected(undefined);}} />)}
      <div {...sourceProps(ui, layout, suffix, page === 'Tank' ? 'lstPart' : 'lstTank')} hidden aria-hidden="true" />
      <div {...sourceProps(ui, layout, suffix, page === 'Tank' ? 'lstTank' : 'lstPart')}
        className="mend-shop-list-scroll-shell">
      <div ref={list} className="mend-shop-list" data-mend-owned-list="" role="listbox" aria-label={page === 'Tank' ? '拥有战车名单' : '拥有部件名单'}>
        {entries.map((entry, index) => <button key={entry.id} type="button" role="option"
          data-mend-owned-instance={entry.id} data-home-owned-tank-row={page === 'Tank' ? entry.id : undefined}
          data-mend-owned-tank-row={page === 'Tank' ? entry.id : undefined} data-mend-owned-part-row={page === 'Part' ? '' : undefined} aria-selected={entry.id === selected} disabled={busy}
          tabIndex={selected === entry.id || selected === undefined && index === 0 ? 0 : -1}
          onClick={() => setSelected(entry.id)} onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
            if (next === undefined) return;
            event.preventDefault();
            const value = entries[Math.max(0, Math.min(next, entries.length - 1))];
            if (!value) return;
            setSelected(value.id);
            const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mend-owned-instance="${value.id}"]`);
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }}>
          {entry.id === selected && <GameSelectionHighlight/>}
          {page === 'Part' ? <MendPartRowContent ui={ui} name={entry.name}
            itemTableId={entry.itemTableId!} iconId={entry.iconId} ownedQuantity={entry.ownedQuantity!} installed={entry.installed} /> : <HomeOwnedTankRowContent ui={ui} name={entry.name}
              tankId={entry.tankId} tankType={entry.tankType} durationMinutes={entry.durationMinutes} />}</button>)}
      </div>
      <GameScrollbar list={list} step={48} label={page === 'Tank' ? '拥有战车名单' : '拥有部件名单'}/>
      </div>
    </div>
    <GameMessage data-mend-status="" text={status} tone={busy ? 'pending' : 'info'}/>
  </>;
}
