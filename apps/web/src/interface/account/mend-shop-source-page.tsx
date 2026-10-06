import type {ResPartMaintenance} from '../../../../shared/protocols/PtlPartMaintenance';
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
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {SourceButton} from '../resources/source-button';
import {sourceProps} from '../resources/source-ui-props';

const suffix = 'shop_mendpage.xml';
type PartCategory = 'Common' | 'Hat' | 'Mark';
interface MendEntry {id: number; name: string; itemTableId?: number; iconId?: number; ownedQuantity?: number; tankId?: number; tankType?: number; durationMinutes?: number;}

/** Maintenance sheet consumes confirmed ownership and authoritative Tank maintenance results. */
export function MendShopSourcePage({ui, catalog, source, onBusy}: {
  ui: HomeSourceUi; catalog?: CombatCatalog; source: ShopSource; onBusy(busy: boolean): void;
}) {
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
  const [status, setStatus] = useState('载入拥有资料…');
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
    return {id: fields.get(0x1c)!, name: record.name, tankId, durationMinutes: fields.get(0x34),
      tankType: catalog?.tankTypes?.find(tank => tank.tankId === tankId)?.tankType};
  }) : (inventory?.records ?? []).filter(record => {
    const type = classifyItemId(record.itemTableId);
    return category === 'Common' ? type >= 8 && type <= 12 : type === (category === 'Hat' ? 5 : 7);
  }).map(record => {
    const item = catalog?.items.find(item => item.itemTableId === record.itemTableId);
    return {id: record.instanceId, name: item?.name ?? String(record.itemTableId),
      itemTableId: record.itemTableId, iconId: item?.iconId, ownedQuantity: record.ownedQuantity};
  });
  const selectedPart = partMaintenance?.parts.find(part => part.instanceId === selected);
  const selectedQuotes = page === 'Tank'
    ? maintenance?.tanks.find(tank => tank.instanceId === selected)?.quotes : selectedPart?.quotes;
  const canMaintain = page === 'Tank' ? Boolean(source.tankMaintenance) : Boolean(source.partMaintenance && selectedPart?.canMaintain);
  async function maintain(quote: TankMaintenanceQuote) {
    if (!canMaintain || selected === undefined || busy || submitting.current) return;
    const current = generation.current;
    submitting.current = true; setBusy(true); onBusy(true); setStatus('正在确认保养…');
    try {
      const request = {operation: 'MAINTAIN' as const, instanceId: selected,
        days: quote.days, currency: quote.currency, requestId: crypto.randomUUID().replaceAll('-', '')};
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
    txtCoin: bytes ? String(bytes.getUint32(0x74, true)) : '',
    txtListQuantity: owned && inventory ? String(entries.length) : ''};
  for (const currency of ['Coin', 'Money'] as const) {
    ([1, 7, 30] as const).forEach((days, index) => {
      const quote = selectedQuotes?.find(value => value.days === days && value.currency === (currency === 'Coin' ? 0 : 1));
      values[`txt${currency}${index}`] = quote?.displayCost ?? '';
    });
  }
  const partNames = new Set(['picPartPagePanel', 'heseditu2']);
  const controls = ui.layouts.find(value => value.path.endsWith(suffix))!.windows;
  return <>
    <div className="mend-shop-source" data-mend-shop-page="" data-mend-page={page} aria-busy={busy}>
      {(['Coin', 'Money'] as const).flatMap(currency => ([1, 7, 30] as const).map((days, index) => {
        const quote = selectedQuotes?.find(value => value.days === days && value.currency === (currency === 'Coin' ? 0 : 1));
        return <SourceButton key={`${currency}${index}`} ui={ui} layout={layout} suffix={suffix}
          source={`btn${currency}Mend${index}`} disabled={busy || !quote || !canMaintain} data-mend-repair=""
          data-mend-repair-binding={quote ? page === 'Tank' ? 'tank-maintenance-confirmed-quote' : 'part-maintenance-confirmed-quote' : 'unbound'}
          data-mend-repair-days={days} data-mend-repair-currency={currency === 'Coin' ? 0 : 1}
          aria-label={`${currency === 'Coin' ? '代币' : '金币'}保养${days}天`}
          onClick={() => {if (quote) void maintain(quote);}} />;
      }))}
      {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
        <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name}
          hidden={control.name === 'dankequ' ? page !== 'Tank' : partNames.has(control.name) ? page !== 'Part' : undefined}
          aria-hidden="true" />)}
      {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control =>
        <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name}
          text={values[control.name] ?? ''} data-mend-text-binding={/^txt(Coin|Money)[0-2]$/.test(control.name)
            ? selectedQuotes ? page === 'Tank' ? 'tank-maintenance-source-display-cost' : 'part-maintenance-source-display-cost' : 'unbound'
            : control.name in values ? 'web-confirmed-account' : 'unbound'} />)}
      {(['Tank', 'Part'] as const).map(kind => <SourceButton key={kind} ui={ui} layout={layout} suffix={suffix}
        source={`rdo${kind}Page`} selected={page === kind} data-mend-select-page={kind}
        aria-label={kind === 'Tank' ? '拥有战车' : '拥有部件'} aria-pressed={page === kind} disabled={busy}
        onClick={() => {generation.current++; setPage(kind); setSelected(undefined);}} />)}
      {page === 'Part' && (['Common', 'Hat', 'Mark'] as const).map(kind => <SourceButton key={kind} ui={ui} layout={layout} suffix={suffix}
        source={`rdo${kind}Page`} selected={category === kind} data-mend-category={kind}
        aria-label={kind === 'Common' ? '一般部件' : kind === 'Hat' ? '装饰' : '标记'}
        aria-pressed={category === kind} disabled={busy} onClick={() => {generation.current++; setCategory(kind); setSelected(undefined);}} />)}
      <div {...sourceProps(ui, layout, suffix, page === 'Tank' ? 'lstPart' : 'lstTank')} hidden aria-hidden="true" />
      <div {...sourceProps(ui, layout, suffix, page === 'Tank' ? 'lstTank' : 'lstPart')}
        className="mend-shop-list" data-mend-owned-list="" role="listbox" aria-label={page === 'Tank' ? '拥有战车名单' : '拥有部件名单'}>
        {entries.map((entry, index) => <button key={entry.id} type="button" role="option"
          data-mend-owned-instance={entry.id} data-home-owned-tank-row={page === 'Tank' ? entry.id : undefined}
          data-mend-owned-tank-row={page === 'Tank' ? entry.id : undefined} data-mend-owned-part-row={page === 'Part' ? '' : undefined} aria-selected={entry.id === selected} disabled={busy}
          tabIndex={selected === entry.id || selected === undefined && index === 0 ? 0 : -1}
          style={entry.id === selected ? {backgroundImage: sourceProps(ui, layout, suffix,
            page === 'Tank' ? 'lstTank' : 'lstPart', layout.control(page === 'Tank' ? 'lstTank' : 'lstPart').properties.SelectionImage).style.backgroundImage} : undefined}
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
          }}>{page === 'Part' ? <MendPartRowContent ui={ui} name={entry.name}
            itemTableId={entry.itemTableId!} iconId={entry.iconId} ownedQuantity={entry.ownedQuantity!} /> : <HomeOwnedTankRowContent ui={ui} name={entry.name}
              tankId={entry.tankId} tankType={entry.tankType} durationMinutes={entry.durationMinutes} />}</button>)}
      </div>
    </div>
    <output className="mend-shop-status" data-mend-status="" role="status" aria-live="polite">{status}</output>
  </>;
}
