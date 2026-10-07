import './trade-source-page.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {ReqTrade, ResTrade, TradeOffer, TradeParty, TradeRecordRef, TradeRecordView} from '../../../../shared/protocols/PtlTrade';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {TradeSourceDetail, hasTradeRecordDetail, tradeRecordPresentation} from './trade-source-detail';
import {TradeCandidateRowContent} from './trade-candidate-row-content';

export interface TradeSourcePageProps {
  state: ResTrade; pending: boolean; status: string; act(request: ReqTrade): void; close(): void;
  queryProfile(): Promise<ResRoleProfile>; accountGeneration: number;
}
type Tab = 'item' | 'equipment' | 'pet' | 'tank';
const suffix = 'trade.xml';
const keyOf = (record: TradeRecordRef) => `${record.kind}:${record.instanceId}`;
const partyStatus = (party?: TradeParty) => party?.confirmed ? '已确认' : party?.shown ? '已展示' : party ? '编辑中' : '';
type TradeCandidateRowData = {
  'data-home-owned-tank-row'?: number;
  'data-home-owned-pet-row'?: number;
  'data-home-source-item-row'?: number;
  'data-home-source-weapon-row'?: number;
  'data-home-source-valuable-row'?: number;
  'data-home-equipment-common-row'?: number;
  'data-home-equipment-hat-mark-row'?: number;
};
const candidateRowData = (record: TradeRecordView): TradeCandidateRowData | undefined => {
  if (record.kind === 'tank') return {'data-home-owned-tank-row': record.instanceId};
  if (record.kind === 'pet') return {'data-home-owned-pet-row': record.instanceId};
  if (!record.item) return undefined;
  const category = classifyInventoryCategory(record.item.itemTableId);
  if (category === 1) return {'data-home-source-item-row': record.instanceId};
  if (category === 2) return {'data-home-source-weapon-row': record.instanceId};
  if (category === 6) return {'data-home-source-valuable-row': record.instanceId};
  if (category === 5 || category === 7) return {'data-home-equipment-common-row': record.instanceId};
  if (category === 3 || category === 4) return {'data-home-equipment-hat-mark-row': record.instanceId};
  return undefined;
};

/** Source Trade regions consume confirmed party state; editable offers remain local drafts. */
export function TradeSourcePage({state, pending, status, act, close, queryProfile, accountGeneration}: TradeSourcePageProps) {
  const session = state.session;
  const own = session?.parties.find(party => party.accountId === state.account.accountId);
  const peer = session?.parties.find(party => party.accountId !== state.account.accountId);
  const [ui, setUi] = useState<HomeSourceUi>();
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [resourceError, setResourceError] = useState('');
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const [localError, setLocalError] = useState('');
  const [tab, setTab] = useState<Tab>('item');
  const [subtab, setSubtab] = useState(1);
  const [draft, setDraft] = useState<TradeOffer>({money: 0, originality: 0, skillPoints: 0, records: []});
  const [amounts, setAmounts] = useState({money: '0', originality: '0', skillPoints: '0'});
  const [detail, setDetail] = useState<TradeRecordView>();
  const [currentRoles, setCurrentRoles] = useState<{tank?: number; pet?: number}>();
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const dialog = useRef<HTMLDialogElement>(null);
  const retryFocus = useRef(false);
  const open = session?.phase === 'OPEN' && !!own;
  const dirty = !!own && (JSON.stringify(draft.records) !== JSON.stringify(own.offer.records)
    || (['money', 'originality', 'skillPoints'] as const).some(name => Number(amounts[name]) !== own.offer[name]));

  const confirmedOffer = JSON.stringify(own?.offer);
  useEffect(() => {
    if (!confirmedOffer) return;
    const offer = JSON.parse(confirmedOffer) as TradeOffer;
    setDraft({...offer, records: offer.records.map(record => ({...record}))});
    setAmounts({money: String(offer.money), originality: String(offer.originality), skillPoints: String(offer.skillPoints)});
    setLocalError(''); setDetail(undefined);
  }, [session?.id, confirmedOffer]);

  const confirmedRecords = JSON.stringify(session?.parties.flatMap(party => party.records));
  useEffect(() => {
    setDetail(current => {
      if (!current || !confirmedRecords) return current;
      const records = JSON.parse(confirmedRecords) as TradeRecordView[];
      const confirmed = records.find(record => keyOf(record) === keyOf(current)
        && JSON.stringify(record) === JSON.stringify(current));
      return confirmed ? current : undefined;
    });
  }, [confirmedRecords]);

  useEffect(() => {
    if (!open) {setCurrentRoles(undefined); return;}
    let active = true;
    queryProfile().then(result => {
      if (!active) return;
      const bytes = result.profile?.bytes;
      if (!bytes) {setCurrentRoles(undefined); return;}
      const view = new DataView(Uint8Array.from(bytes).buffer);
      setCurrentRoles({tank: view.getUint32(0xa8, true), pet: view.getUint32(0xa4, true)});
    }, () => {if (active) setCurrentRoles(undefined);});
    return () => {active = false;};
  }, [open, session?.id, accountGeneration, queryProfile]);

  useEffect(() => {
    const controller = new AbortController();
    setResourceLoading(true);
    const fonts = loadSourceUiFonts();
    const sourceUi = fetch('/ui.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('交易界面资源载入失败');
      const value = await response.json() as HomeSourceUi;
      if (!controller.signal.aborted) setUi(value);
    });
    const combatCatalog = fetch('/combat-catalog.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('交易物品资料载入失败');
      const value = await response.json() as CombatCatalog;
      if (!controller.signal.aborted) setCatalog(value);
    });
    void Promise.allSettled([fonts, sourceUi, combatCatalog]).then(results => {
      if (controller.signal.aborted) return;
      const errors = results.flatMap(result => result.status === 'rejected' ? [String(result.reason)] : []);
      setResourceError(errors.join('；'));
      setResourceLoading(false);
    });
    return () => controller.abort();
  }, [resourceAttempt]);

  useLayoutEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (element.open) element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useLayoutEffect(() => {
    if (ui && dialog.current?.open) dialog.current.querySelector<HTMLButtonElement>('[data-trade-close]')?.focus();
  }, [ui]);

  useLayoutEffect(() => {
    if (!retryFocus.current || resourceLoading) return;
    retryFocus.current = false;
    const target = resourceError ? '[data-trade-resource-retry]:not(:disabled)' : '[data-trade-close]:not(:disabled)';
    dialog.current?.querySelector<HTMLButtonElement>(target)?.focus();
  }, [resourceLoading, resourceError]);

  function action(operation: 'SHOW' | 'UNSHOW' | 'CONFIRM' | 'CANCEL') {
    if (!session || pending) return;
    act({operation, sessionId: session.id, expectedRevision: session.revision});
  }
  function showOffer() {
    if (!session || !open || pending || !businessReady) return;
    if (own?.shown && !dirty) {action('UNSHOW'); return;}
    const values = {money: Number(amounts.money), originality: Number(amounts.originality), skillPoints: Number(amounts.skillPoints)};
    if (Object.values(values).some(value => !Number.isInteger(value) || value < 0)) {
      setLocalError('提供金额须为非负整数'); return;
    }
    setLocalError('');
    act({operation: 'SHOW', sessionId: session.id, expectedRevision: session.revision, offer: {...values, records: draft.records}});
  }
  function toggle(record: TradeRecordView) {
    if (!businessReady) return;
    const found = draft.records.some(value => keyOf(value) === keyOf(record));
    if (!found && draft.records.length >= 12) {setLocalError('交易提供物最多12项'); return;}
    const quantity = record.item && classifyInventoryCategory(record.item.itemTableId) <= 2 ? record.item.ownedQuantity : 1;
    setDraft(value => ({...value, records: found ? value.records.filter(ref => keyOf(ref) !== keyOf(record))
      : [...value.records, {kind: record.kind, instanceId: record.instanceId, quantity}]}));
    setLocalError('');
  }
  const candidates: TradeRecordView[] = tab === 'pet' ? state.account.owned.base.map(role =>
    ({kind: 'pet', instanceId: new Map(role.fields).get(0)!, role}))
    : tab === 'tank' ? state.account.owned.equipment.map(role =>
      ({kind: 'tank', instanceId: new Map(role.fields).get(0x1c)!, role}))
    : state.account.inventory.records.filter(item => {
      const category = classifyInventoryCategory(item.itemTableId);
      return tab === 'item' ? category === subtab : subtab === 5 ? category === 5 || category === 7 : category === subtab;
    }).map(item => ({kind: 'item', instanceId: item.instanceId, item}));

  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  const businessReady = !!ui && !!catalog && !!layout;
  const candidateList = tab === 'item' ? 'lstMyItem' : tab === 'equipment' ? 'lstMyEquip' : 'lstMyTankMyPet';
  const candidateSelection = ui && layout
    ? sourceProps(ui, layout, suffix, candidateList, layout.control(candidateList).properties.SelectionImage) : undefined;
  const controls = ui?.layouts.find(value => value.path.endsWith(suffix))?.windows ?? [];
  const visible = (name: string): boolean => {
    for (let control = layout?.control(name); control; control = control.parent ? layout?.control(control.parent) : undefined) {
      if (control.name === 'picItemPanel' && tab !== 'item' || control.name === 'picEquipPanel' && tab !== 'equipment'
        || control.name === 'picTankPetPanel' && tab !== 'pet' && tab !== 'tank') return false;
    }
    return true;
  };
  const texts: Record<string, string> = {
    txtMyName: own?.name ?? '', txtOtherName: peer?.name ?? '', txtMyTradeState: partyStatus(own), txtOtherTradeState: partyStatus(peer),
    txtMoney: state.account.wallet ? String(state.account.wallet.money) : '',
    txtOriginality: state.account.wallet ? String(state.account.wallet.originality) : '',
    txtTech: state.account.wallet ? String(state.account.wallet.skillPoints) : '',
    txtOtherMoney: peer ? String(peer.offer.money) : '', txtOtherOriginality: peer ? String(peer.offer.originality) : '',
    txtOtherTech: peer ? String(peer.offer.skillPoints) : '', txtListQuantity: String(candidates.length),
  };
  const checkmark = (name: string, checked: boolean) => {
    if (!ui || !layout || !checked) return null;
    const props = sourceProps(ui, layout, suffix, name, layout.control(name).properties.CheckMarkImage);
    return <i data-trade-checkmark={name} data-source-asset={props['data-source-asset']} style={{backgroundImage: props.style.backgroundImage}}/>;
  };
  const candidateAvailable = (record: TradeRecordView) => {
    const display = tradeRecordPresentation(record, catalog);
    return !pending && open && businessReady && !!display.name && !!display.reference && !!candidateRowData(record);
  };
  const retryResources = () => {
    if (resourceLoading) return;
    retryFocus.current = true;
    setResourceLoading(true);
    setResourceAttempt(value => value + 1);
  };

  return createPortal(<dialog ref={dialog} className="trade-source-dialog" data-trade-page=""
    data-trade-session={session?.id} data-trade-revision={session?.revision} data-trade-phase={session?.phase}
    aria-label="玩家交易" aria-busy={pending || resourceLoading} style={{width: 615 * scale, height: 485 * scale}}
    onCancel={event => {event.preventDefault(); if (!pending) close();}}>
    <div className="trade-source-stage" style={{transform: `scale(${scale})`}}>
      {ui && layout && <SourceImageScale value={scale}>
        {controls.filter(control => control.type === 'WindowsLook/StaticImage' && visible(control.name)
          && !/^pic(My|Other)Item\d+$/.test(control.name)).map(control =>
          <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name} aria-hidden="true"/>)}
        {controls.filter(control => control.type === 'WindowsLook/StaticText' && visible(control.name)
          && !/^txt(My|Other)ItemCount\d+$/.test(control.name) && !['txtMyMoney', 'txtMyOriginality', 'txtMyTech'].includes(control.name)).map(control =>
          <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name} text={texts[control.name] ?? ''}/>)}
        {([['item', 'rdoItemPage', '道具'], ['equipment', 'rdoEquipPage', '装备'], ['pet', 'rdoPetPage', '宠物'], ['tank', 'rdoTankPage', '战车']] as const).map(([value, source, label]) =>
          <SourceButton key={value} ui={ui} layout={layout} suffix={suffix} source={source} aria-label={label}
            selected={tab === value} disabled={pending} data-trade-tab={value}
            onClick={() => {setTab(value); setSubtab(value === 'equipment' ? 5 : 1);}}/>)}
        {(tab === 'item' ? [[1, 'rdoItem', '道具'], [2, 'rdoWeapon', '武器'], [6, 'rdoValuable', '贵重品']] as const
          : tab === 'equipment' ? [[5, 'rdoCommon', '零件'], [3, 'rdoHat', '帽子'], [4, 'rdoMark', '标志']] as const : []).map(([value, source, label]) =>
          <SourceButton key={source} ui={ui} layout={layout} suffix={suffix} source={source} selected={subtab === value}
            disabled={pending} aria-label={label} onClick={() => setSubtab(value)}/>)}
        <div {...sourceProps(ui, layout, suffix, candidateList)}
          className="trade-source-candidates" data-trade-candidates={tab} role="listbox" aria-multiselectable="true"
          aria-busy={resourceLoading || pending} aria-label={`${tab === 'item' ? '道具' : tab === 'equipment' ? '装备' : '宠物和战车'}候选`}>
          {candidates.map(record => {
            const display = tradeRecordPresentation(record, catalog);
            const selected = draft.records.find(value => keyOf(value) === keyOf(record));
            const rowData = candidateRowData(record);
            const recordCurrent = record.kind === 'tank'
              ? currentRoles?.tank !== undefined && (record.instanceId >>> 0) === currentRoles.tank
              : record.kind === 'pet' ? currentRoles?.pet !== undefined && (record.instanceId >>> 0) === currentRoles.pet : false;
            const recordOffered = draft.records.some(value => value.kind === record.kind && value.instanceId === record.instanceId);
            return <div key={keyOf(record)} className="trade-source-candidate" data-trade-candidate={keyOf(record)}>
              <button type="button" className="trade-source-candidate-row" role="option" aria-selected={!!selected}
                aria-pressed={!!selected} disabled={!candidateAvailable(record)}
                {...rowData} aria-label={display.name || undefined}
                style={!!selected && candidateSelection ? {backgroundImage: candidateSelection.style.backgroundImage} : undefined}
                data-source-selection-asset={selected ? candidateSelection?.['data-source-asset'] : undefined}
                onClick={() => toggle(record)} data-trade-record-toggle={keyOf(record)} onKeyDown={event => {
                  const next = event.key === 'ArrowDown' ? candidates.indexOf(record) + 1
                    : event.key === 'ArrowUp' ? candidates.indexOf(record) - 1
                      : event.key === 'Home' ? 0 : event.key === 'End' ? candidates.length - 1 : undefined;
                  if (next !== undefined) {
                    event.preventDefault(); event.stopPropagation();
                    const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
                    let nextIndex = Math.max(0, Math.min(candidates.length - 1, next));
                    while (nextIndex >= 0 && nextIndex < candidates.length && !candidateAvailable(candidates[nextIndex])) {
                      nextIndex += direction;
                    }
                    const candidate = candidates[nextIndex];
                    if (!candidate) return;
                    const button = dialog.current?.querySelector<HTMLButtonElement>(
                      `[data-trade-record-toggle="${keyOf(candidate)}"]`);
                    button?.focus();
                    button?.scrollIntoView({block: 'nearest'});
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }} onKeyUp={event => {
                  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.stopPropagation();
                }}>
                {catalog && rowData && <TradeCandidateRowContent ui={ui} catalog={catalog} record={record}
                  current={recordCurrent} offered={recordOffered}/>}
              </button>
              {(hasTradeRecordDetail(record) || selected && record.item && classifyInventoryCategory(record.item.itemTableId) <= 2)
                && <div className="trade-source-candidate-actions">
                  {hasTradeRecordDetail(record) && <button type="button" disabled={pending || !businessReady}
                    aria-label={`${display.name}详情`} data-trade-record-detail={keyOf(record)} onClick={() => setDetail(record)}>详情</button>}
                  {selected && record.item && classifyInventoryCategory(record.item.itemTableId) <= 2 && <input type="number" min={1}
                    max={record.item.ownedQuantity} step={1} aria-label={`${display.name}提供数量`} value={selected.quantity ?? record.item.ownedQuantity}
                    disabled={pending || !open || !businessReady} onChange={event => {
                      const quantity = event.currentTarget.valueAsNumber;
                      if (Number.isInteger(quantity) && quantity > 0 && quantity <= record.item!.ownedQuantity)
                        setDraft(value => ({...value, records: value.records.map(ref => keyOf(ref) === keyOf(record) ? {...ref, quantity} : ref)}));
                    }}/>}
                </div>}
            </div>;
          })}
        </div>
        {([['My', own], ['Other', peer]] as const).map(([side, party]) => Array.from({length: 12}, (_, index) => {
          const record = party?.records[index];
          if (!record) return null;
          const display = tradeRecordPresentation(record, catalog);
          return <span key={`${side}${index}`} data-trade-offer-record={`${side}:${index}`}>
            <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name={`pic${side}Item${index}`} reference={display.reference}
              aria-label={display.name} role="img"/>
            <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={`txt${side}ItemCount${index}`}
              text={record.item && classifyInventoryCategory(record.item.itemTableId) <= 2 ? String(record.quantity ?? '') : ''}/>
            {hasTradeRecordDetail(record) && <button type="button" {...sourceProps(ui, layout, suffix, `pic${side}Item${index}`)}
              className="trade-source-grid-detail" aria-label={`${display.name}详情`} disabled={pending} onClick={() => setDetail(record)}/>}
          </span>;
        }))}
        {([['money', 'btnMyMoney', 'txtMyMoney', '提供金钱'], ['originality', 'btnMyOriginality', 'txtMyOriginality', '提供创意点'], ['skillPoints', 'btnMyTech', 'txtMyTech', '提供技能点']] as const).map(([field, button, text, label]) =>
          <span key={field}>
            <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name={button} reference={layout.control(button).properties.NormalImage} aria-hidden="true"/>
            <input {...sourceProps(ui, layout, suffix, text)} className="trade-source-amount" type="number" min={0} step={1}
              value={amounts[field]} aria-label={label} data-trade-amount={field} disabled={!open || pending || !businessReady}
              onChange={event => {const amount = event.currentTarget.value; setAmounts(value => ({...value, [field]: amount}));}}/>
          </span>)}
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnShow" aria-label={own?.shown && !dirty ? '撤回展示' : '展示'}
          data-trade-show="" disabled={!open || pending || !businessReady} onClick={showOffer}>
          {checkmark('btnShow', !!own?.shown)}
        </SourceButton>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnExchange" aria-label="确认交易" data-trade-confirm=""
          disabled={!open || pending || !businessReady || dirty || !own?.shown || !peer?.shown || own.confirmed} onClick={() => action('CONFIRM')}>
          {checkmark('btnExchange', !!own?.confirmed)}
        </SourceButton>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnCancel" aria-label="取消交易" data-trade-cancel=""
          disabled={!session || pending || session.phase === 'COMPLETED' || session.phase === 'CANCELLED'} onClick={() => action('CANCEL')}/>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnClose" aria-label="关闭交易" data-trade-close="" disabled={pending} onClick={close}/>
      </SourceImageScale>}
      <div className="trade-source-web-tools">
        {resourceError && <button type="button" data-trade-resource-retry="" disabled={resourceLoading} onClick={retryResources}>
          {resourceLoading ? '重试中' : '重试交易资源'}
        </button>}
        {!ui && <button type="button" data-trade-web-close="" disabled={pending} onClick={close}>关闭交易</button>}
        <output aria-live="polite" data-trade-status="">{localError || resourceError || status || session?.reason
          || (session?.phase === 'COMPLETED' ? '交易已完成' : session?.phase === 'CANCELLED' ? '交易已取消' : dirty ? '提供物尚未提交' : '')}</output>
      </div>
    </div>
    {ui && detail && <TradeSourceDetail ui={ui} catalog={catalog} record={detail} scale={scale} close={() => setDetail(undefined)}/>}
  </dialog>, document.body);
}
