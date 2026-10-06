import './home.css';
import {HomeResourceFeedback} from './home-resource-feedback';
import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {HomeSourceRoot} from './home-source-root';
import {HomePlayerSourcePage} from './home-player-source-page';
import {HomeInventorySourceList} from './home-inventory-source-list';
import {HomeNameSourceDialog} from './home-name-source-dialog';
import {HomeBattleSummarySourcePage} from './home-battle-summary-source-page';
import {HomeAwardSummarySourcePage} from './home-award-summary-source-page';
import {HomeTitleSummarySourcePage} from './home-title-summary-source-page';
import {SourceButton} from '../resources/source-button';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {AccountStatistics, AccountTitles, AwardCounts, ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {ReqKitbag} from '../../../../shared/protocols/PtlKitbag';
import type {Battle} from '../../match/battle';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {SourceImageScale} from '../resources/source-static-image';
import type {HomeSourceUi, HomeSourceControl} from '../resources/source-ui-layout';

type Control = HomeSourceControl;
type HomeUi = HomeSourceUi;
interface Resources {ui: HomeUi; catalog: CombatCatalog; controls: Control[];}
export interface HomeInventoryViewProps {open: boolean; close: () => void; battle: Battle; navigation?: ReactNode; onRolePage?: (kind: 'pet' | 'tank') => void;}

function imageProps(ui: HomeUi, reference: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference);
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  return {style: {backgroundImage: asset ? `url('/${asset}')` : undefined}, 'data-source-asset': asset};
}

function sourceProps(resources: Resources, name: string, reference: string) {
  const control = (key: string) => resources.controls.find(value => value.name === key)!;
  const source = control(name);
  const rectangle = (value: Control) => value.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const rect = rectangle(source);
  let left = rect[0], top = rect[1];
  for (let parent = source.parent; parent && parent !== 'SheetWindow';) {
    const owner = control(parent), position = rectangle(owner);
    left += position[0]; top += position[1]; parent = owner.parent;
  }
  const picture = imageProps(resources.ui, reference);
  const style: CSSProperties = {...picture.style, left, top: top + 36,
    width: rect[2] - rect[0], height: rect[3] - rect[1]};
  return {...picture, style, 'data-source-control': name, 'data-source-layout': 'ui/layouts/myhome_playerpage.xml'};
}

function itemImage(item: CombatCatalog['items'][number]): string {
  return `set:daoju0 image:data\\ui\\daoju\\${String(item.iconId ?? item.itemTableId).padStart(5, '0')}.tga`;
}

/** Each opening owns its inventory requests, selection and confirmed slot state. */
export function HomeInventoryView({open, close, battle, navigation, onRolePage}: HomeInventoryViewProps) {
  const [page, setPage] = useState<'weapon' | 'item' | 'valuable'>('weapon');
  return open ? <InventorySession close={close} battle={battle} navigation={navigation} onRolePage={onRolePage} page={page} changePage={setPage} /> : null;
}

interface InventorySessionProps extends Omit<HomeInventoryViewProps, 'open'> {
  page: 'weapon' | 'item' | 'valuable';
  changePage: (page: 'weapon' | 'item' | 'valuable') => void;
}

function InventorySession({close, battle, page, changePage, navigation, onRolePage}: InventorySessionProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const session = useRef<{active: boolean; pending: boolean}>({active: false, pending: false});
  const [resources, setResources] = useState<Resources>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [profile, setProfile] = useState<ResRoleProfile['profile']>();
  const [playerSummary, setPlayerSummary] = useState<ResRoleProfile['playerSummary']>();
  const [growth, setGrowth] = useState<ResRoleProfile['growth']>();
  const [titles, setTitles] = useState<AccountTitles>();
  const [statistics, setStatistics] = useState<AccountStatistics>();
  const [awards, setAwards] = useState<AwardCounts>();
  const [titleStatus, setTitleStatus] = useState('');
  const [titlePending, setTitlePending] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [name, setName] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [summaryTab, setSummaryTab] = useState<'battle' | 'title' | 'award'>('battle');
  const [selected, setSelected] = useState(0);
  const requestFocus = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [resourceError, setResourceError] = useState<string>();
  const [status, setStatus] = useState('载入物品…');
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const current = {active: true, pending: false};
    session.current = current;
    const controller = new AbortController();
    setResourceError(undefined);
    setResources(undefined); setInventory(undefined); setSelected(0); setName('');
    setProfile(undefined); setPlayerSummary(undefined); setGrowth(undefined); setBalanceError('');
    setTitles(undefined); setTitleStatus(''); setTitlePending(false);
    setStatistics(undefined); setAwards(undefined);
    setBusy(true); setStatus('载入物品…');
    void battle.roleProfile().then(confirmed => {
      if (current.active) {
        setProfile(confirmed.profile);
        setPlayerSummary(confirmed.playerSummary);
        setGrowth(confirmed.growth);
        setTitles(confirmed.titles);
        setStatistics(confirmed.statistics);
        setAwards(confirmed.awards);
      }
    }).catch(error => {if (current.active) setBalanceError(String(error));});
    void (async () => {
      const [uiResponse, catalogResponse] = await Promise.all([
        fetch('/ui.json', {signal: controller.signal}),
        fetch('/combat-catalog.json', {signal: controller.signal}), loadSourceUiFonts(),
      ]);
      if (!uiResponse.ok || !catalogResponse.ok) throw new Error('物品界面资源载入失败');
      const ui = await uiResponse.json() as HomeUi;
      const catalog = await catalogResponse.json() as CombatCatalog;
      const controls = ui.layouts.find(layout => layout.path.endsWith('myhome_playerpage.xml'))?.windows;
      if (!controls || !ui.layouts.some(layout => layout.path.endsWith('myhome.xml'))) throw new Error('我的家界面布局缺失');
      if (!current.active) return;
      setResources({ui, catalog, controls});
    })().catch(error => {if (current.active) setResourceError(error instanceof Error ? error.message : String(error));});
    void Promise.all([battle.inventory(), battle.displayName()]).then(([confirmed, confirmedName]) => {
      if (!current.active) return;
      setInventory(confirmed); setName(confirmedName); setStatus('');
    }).catch(error => {if (current.active) setStatus(`物品资料读取失败：${String(error)}`);})
      .finally(() => {if (current.active) setBusy(false);});
    return () => {current.active = false; controller.abort();};
  }, [battle]);

  useLayoutEffect(() => {
    if (busy || !requestFocus.current) return;
    const target = requestFocus.current;
    requestFocus.current = null;
    if (target.isConnected && (document.activeElement === document.body
        || document.activeElement === dialog.current || document.activeElement === target)) target.focus();
  }, [busy]);

  useLayoutEffect(() => {
    if (!resources || busy) return;
    if (document.activeElement === document.body || document.activeElement === dialog.current) {
      dialog.current?.querySelector<HTMLButtonElement>('[data-home-close]')?.focus();
    }
  }, [resources, busy]);

  const requestClose = () => {
    if (!session.current.active) return;
    session.current.active = false;
    close();
  };
  const category = page === 'valuable' ? 6 : page === 'weapon' ? 2 : 1;
  const categoryRecords = inventory?.records.filter(record =>
    classifyInventoryCategory(record.itemTableId) === category) ?? [];
  const records = (inventory?.records.filter(record =>
    record.ownedQuantity > 0 &&
    (classifyInventoryCategory(record.itemTableId) === category ||
      (page === 'item' && (record.itemTableId === 20001 || record.itemTableId === 20002)))) ?? []);
  const selectedTitleName = titles?.owned.find(title => title.id === titles.selectedTitleId)?.name;
  const control = (name: string) => resources!.controls.find(value => value.name === name)!;
  const slotNumber = (index: number) => page === 'weapon' ? index : index + 4;

  async function mutate(request: ReqKitbag) {
    const current = session.current;
    if (!current.active || current.pending || !inventory) return;
    const focused = document.activeElement;
    requestFocus.current = focused instanceof HTMLElement && dialog.current?.contains(focused) ? focused : null;
    current.pending = true; setBusy(true); setStatus('保存快捷槽…');
    try {
      const confirmed = await battle.configureKitbag(request);
      if (!current.active) return;
      setInventory(value => value ? {...value, hotkeys: [...confirmed.hotkeys]} : value);
      setStatus('快捷槽已保存');
    } catch (error) {
      if (current.active) setStatus(String(error));
    } finally {
      if (current.active) {current.pending = false; setBusy(false);}
    }
  }

  function assign(index: number, instanceId = selected) {
    const slot = slotNumber(index);
    if (!slot || !records.some(record => record.instanceId === instanceId)) return;
    void mutate({operation: 'ASSIGN', slot, instanceId});
  }

  function cancel(index: number) {
    const slot = slotNumber(index);
    if (slot && inventory?.hotkeys[slot - 1]) void mutate({operation: 'CANCEL', slot});
  }

  async function selectTitle(titleId: number) {
    const current = session.current;
    if (!current.active || current.pending || !titles) return;
    const focused = document.activeElement;
    requestFocus.current = focused instanceof HTMLElement && dialog.current?.contains(focused) ? focused : null;
    current.pending = true; setBusy(true); setTitlePending(true); setTitleStatus('保存称号佩戴…');
    try {
      const confirmed = await battle.roleProfile(titleId);
      if (!current.active) return;
      setTitles(confirmed.titles);
      setTitleStatus(titleId === 0 ? '已清空称号' : '已佩戴称号');
    } catch (error) {
      if (current.active) setTitleStatus(`称号保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (current.active) {current.pending = false; setBusy(false); setTitlePending(false);}
    }
  }

  return <dialog ref={dialog} id="home-inventory" aria-label="我的家：物品与快捷槽" aria-busy={busy || (!resources && !resourceError)}
    style={{zoom: scale}} onCancel={event => {event.preventDefault(); requestClose();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {event.preventDefault(); escapePending.current = true;}
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        requestClose();
      }
    }}>
    <SourceImageScale value={scale}>
    <div className="home-inventory-stage" data-home-page="">
      {resources && <>
        <HomeSourceRoot ui={resources.ui} page="player" busy={busy}
          selectPage={kind => {if (kind !== 'player') onRolePage?.(kind);}}
          close={requestClose} closeAttribute="data-home-close" />
        <HomePlayerSourcePage ui={resources.ui} name={name} playerSummary={playerSummary} growth={growth}
          title={selectedTitleName}
          money={profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0x70, true) : undefined}
          tokens={profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0x74, true) : undefined}
          itemQuantity={inventory ? categoryRecords.length : undefined} valuableMode={page === 'valuable'}
          valuableQuantity={inventory ? categoryRecords.length : undefined} />
        <SourceButton ui={resources.ui} layout={new HomeSourceLayout(resources.ui, 'myhome_playerpage.xml')}
          suffix="myhome_playerpage.xml" source="xiugainicheng" aria-label="修改昵称"
          data-home-name-open="" disabled={busy || !inventory} onClick={() => setNameOpen(true)} />
        <div data-home-summary-battle-slot="" hidden={summaryTab !== 'battle'} style={{position: 'static'}}>
          <HomeBattleSummarySourcePage ui={resources.ui} source={battle} statistics={statistics} />
        </div>
        {summaryTab === 'title' && <HomeTitleSummarySourcePage ui={resources.ui} titles={titles} pending={titlePending}
          status={titleStatus} select={titleId => void selectTitle(titleId)} />}
        {summaryTab === 'award' && <HomeAwardSummarySourcePage ui={resources.ui} awards={awards} />}
        <SourceButton ui={resources.ui} layout={new HomeSourceLayout(resources.ui, 'myhome_playerpage.xml')}
          suffix="myhome_playerpage.xml" source="rdoBattleSummary" selected={summaryTab === 'battle'} aria-pressed={summaryTab === 'battle'}
          aria-label="已保存对局统计" data-home-saved-summary-tab="" disabled={busy}
          onClick={() => setSummaryTab('battle')} />
        <SourceButton ui={resources.ui} layout={new HomeSourceLayout(resources.ui, 'myhome_playerpage.xml')}
          suffix="myhome_playerpage.xml" source="rdoTitleSummary" selected={summaryTab === 'title'} aria-pressed={summaryTab === 'title'}
          aria-label="拥有称号" data-home-title-summary-tab="" disabled={busy}
          onClick={() => setSummaryTab('title')} />
        <SourceButton ui={resources.ui} layout={new HomeSourceLayout(resources.ui, 'myhome_playerpage.xml')}
          suffix="myhome_playerpage.xml" source="rdoAwardSummary" selected={summaryTab === 'award'} aria-pressed={summaryTab === 'award'}
          aria-label="奖章" data-home-award-summary-tab="" disabled={busy}
          onClick={() => setSummaryTab('award')} />
        {(['weapon', 'item', 'valuable'] as const).map((tab, index) => {
          const name = ['rdoWeapon', 'rdoItem', 'rdoValuable'][index];
          return <SourceButton key={tab} ui={resources.ui} layout={new HomeSourceLayout(resources.ui, 'myhome_playerpage.xml')}
            suffix="myhome_playerpage.xml" source={name} className="home-tab" aria-label={['武器', '道具', '贵重品'][index]}
            selected={page === tab} aria-pressed={page === tab} disabled={busy || !inventory}
            onClick={() => {changePage(tab); setSelected(0); setStatus('');}} />;
        })}
        <HomeInventorySourceList ui={resources.ui} selected={selected} busy={busy} itemRows={page === 'item'}
          valuableRows={page === 'valuable'} select={setSelected}
          entries={records.map(record => {
            const item = resources.catalog.items.find(value => value.itemTableId === record.itemTableId);
            return {instanceId: record.instanceId, itemTableId: record.itemTableId, name: item?.name ?? String(record.itemTableId),
              info: item?.info ?? '', ownedQuantity: record.ownedQuantity,
              iconId: item?.iconId ?? record.itemTableId};
          })} />
        {page !== 'valuable' && [0, 1, 2, 3].map(index => {
          const slot = slotNumber(index), instanceId = slot ? inventory?.hotkeys[slot - 1] ?? 0 : 0;
          const record = inventory?.records.find(value => value.instanceId === instanceId);
          const item = resources.catalog.items.find(value => value.itemTableId === (slot ? record?.itemTableId : 2001));
          const name = `${page === 'weapon' ? 'picWeapon' : 'picItem'}${index}`;
          const reference = item ? itemImage(item) : page === 'weapon' ? control(name).properties.Image : '';
          const title = slot ? `${slot + 1}：${item?.name ?? '空'}；右键或Delete取消` : '1：默认炮弹';
          return <button key={index} type="button" className="home-slot" data-kitbag-slot={slot} data-instance-id={instanceId}
            disabled={busy || !inventory || slot === 0} title={title} aria-label={title}
            {...sourceProps(resources, name, reference)} onClick={() => assign(index)}
            onContextMenu={event => {event.preventDefault(); cancel(index);}}
            onKeyDown={event => {
              if (event.code === 'Delete' || event.code === 'Backspace') {event.preventDefault(); cancel(index);}
            }} onDragOver={event => {if (slot && !busy) event.preventDefault();}}
            onDrop={event => {
              event.preventDefault();
              const instance = Number(event.dataTransfer.getData('text/plain'));
              if (!busy && slot && records.some(value => value.instanceId === instance)) {setSelected(instance); assign(index, instance);}
            }}>
            {record && <span>{record.ownedQuantity}</span>}
          </button>;
        })}
      </>}
    <output hidden={!resources} className="home-page-status" aria-live="polite">{status || balanceError || (page === 'valuable' ? '' : records.length ? '选择物品后点击快捷槽，或拖入快捷槽。' : '暂无物品')}</output>
    {navigation && <fieldset className="home-page-navigation" disabled={busy} aria-label="常用操作">
      <legend>常用操作</legend><div className="home-business-navigation home-page-navigation-scroll">{navigation}</div>
    </fieldset>}
    {!resources && <HomeResourceFeedback error={resourceError} close={requestClose} closeAttribute="data-home-close" />}
    </div>
    </SourceImageScale>
    {nameOpen && resources && <HomeNameSourceDialog ui={resources.ui} battle={battle}
      close={() => setNameOpen(false)} saved={setName} />}
  </dialog>;
}
