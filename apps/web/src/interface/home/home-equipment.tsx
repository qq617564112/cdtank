import './home.css';
import {HomeResourceFeedback} from './home-resource-feedback';
import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties} from 'react';
import {readOwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import type {Battle} from '../../match/battle';
import type {ReqEquipment, ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import type {HomeSourceControl, HomeSourceUi} from './home-source-layout';
import {HomeEquipmentPreview} from './home-equipment-preview';
import {HomeEquipmentSourceList} from './home-equipment-source-list';
import {HomeSourceRoot} from './home-source-root';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceButton} from '../resources/source-button';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {HomeTankDescription, HomeTankOwnedAttributes, HomeTankOwnedParameters, HomeTankSourceRegions} from './home-tank-source-page';
import {sourceTankDescription} from '../resources/role-source-descriptions';
import {HomeTankUpgradeDialog} from './home-tank-upgrade-dialog';
import {HomeTankUpgradeEntries, HomeTankUseControl, homeTankListQuantity} from './home-tank-page-state';

type EquipmentTarget = 'PART' | 'DECORATION' | 'MARK';
interface Resources {ui: HomeSourceUi; controls: HomeSourceControl[]; catalog: CombatCatalog;}
export interface HomeEquipmentViewProps {
  open: boolean; close: () => void; battle: Battle;
  tankInstanceId?: number;
  onPlayerPage?: () => void; onRolePage?: (kind: 'tank' | 'pet') => void;
}

function imageProps(ui: HomeSourceUi, reference?: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  return {style: {backgroundImage: asset ? `url('/${asset}')` : undefined}, 'data-source-asset': asset};
}

function sourceProps(resources: Resources, name: string, reference?: string) {
  const control = (key: string) => resources.controls.find(value => value.name === key)!;
  const source = control(name);
  const rectangle = (value: HomeSourceControl) => value.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const rect = rectangle(source);
  let left = rect[0], top = rect[1];
  for (let parent = source.parent; parent;) {
    const owner = control(parent), position = rectangle(owner);
    left += position[0]; top += position[1]; parent = owner.parent;
  }
  const picture = imageProps(resources.ui, reference);
  const style: CSSProperties = {...picture.style, left, top, width: rect[2] - rect[0], height: rect[3] - rect[1]};
  return {...picture, style, 'data-source-control': name, 'data-source-layout': 'ui/layouts/myhome_panzerpage.xml'};
}

/** Every opening starts on PART with a fresh authority query and preview. */
export function HomeEquipmentView({open, close, battle, onPlayerPage, onRolePage, tankInstanceId}: HomeEquipmentViewProps) {
  return open ? <EquipmentSession close={close} battle={battle} onPlayerPage={onPlayerPage} onRolePage={onRolePage}
    tankInstanceId={tankInstanceId} /> : null;
}

function EquipmentSession({close, battle, onPlayerPage, onRolePage, tankInstanceId}: Omit<HomeEquipmentViewProps, 'open'>) {
  const accountGeneration = useSyncExternalStore(
    listener => battle.subscribeAccountContext(listener),
    () => battle.accountContext.generation,
    () => 0,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const session = useRef({active: false, pending: false});
  const focusAfterCommit = useRef<HTMLButtonElement | null>(null);
  const [resources, setResources] = useState<Resources>();
  const [inventory, setInventory] = useState<ResInventory>();
  const [equipment, setEquipment] = useState<ResEquipment>();
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [currentTankInstanceId, setCurrentTankInstanceId] = useState<number>();
  const [currentPetInstanceId, setCurrentPetInstanceId] = useState<number>();
  const [originality, setOriginality] = useState<number>();
  const [page, setPage] = useState<EquipmentTarget>('PART');
  const [candidate, setCandidate] = useState<number>();
  const [upgrade, setUpgrade] = useState<{instanceId: number; action: 1 | 2}>();
  const [busy, setBusy] = useState(false);
  const [queryFailed, setQueryFailed] = useState(false);
  const [queryAttempt, setQueryAttempt] = useState(0);
  const [resourceError, setResourceError] = useState<string>();
  const [status, setStatus] = useState('载入部件…');
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
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected
          && (document.activeElement === document.body || element.contains(document.activeElement))) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const current = {active: true, pending: false}; session.current = current;
    const controller = new AbortController();
    setResourceError(undefined);
    setResources(undefined); setInventory(undefined); setEquipment(undefined); setOwned(undefined);
    setCurrentTankInstanceId(undefined); setCurrentPetInstanceId(undefined); setOriginality(undefined);
    setPage('PART'); setCandidate(undefined); setBusy(true); setQueryFailed(false); setStatus('载入部件…');
    void (async () => {
      const [uiResponse, catalogResponse] = await Promise.all([
        fetch('/ui.json', {signal: controller.signal}), fetch('/combat-catalog.json', {signal: controller.signal}),
        loadSourceUiFonts(),
      ]);
      if (!uiResponse.ok || !catalogResponse.ok) throw new Error('部件资源载入失败');
      const ui = await uiResponse.json() as HomeSourceUi;
      const catalog = await catalogResponse.json() as CombatCatalog;
      const controls = ui.layouts.find(layout => layout.path.endsWith('myhome_panzerpage.xml'))?.windows;
      if (!controls) throw new Error('部件界面布局缺失');
      if (!current.active) return;
      setResources({ui, catalog, controls});
    })().catch(error => {if (current.active) setResourceError(error instanceof Error ? error.message : String(error));});
    void (async () => {
      const [confirmedInventory, confirmedEquipment, confirmedOwned, confirmedProfile] = await Promise.all([
        battle.inventory(), battle.equipment({operation: 'QUERY', tankInstanceId}),
        battle.ownedRoles(), battle.roleProfile(),
      ]);
      if (!current.active) return;
      if (tankInstanceId !== undefined && confirmedEquipment.tankInstanceId !== tankInstanceId) {
        throw new Error('装备目标实例确认不一致');
      }
      setInventory(confirmedInventory);
      setEquipment(confirmedEquipment); setOwned(confirmedOwned);
      setCurrentTankInstanceId(confirmedProfile.profile
        ? new DataView(Uint8Array.from(confirmedProfile.profile.bytes).buffer).getUint32(0xa8, true) : undefined);
      setCurrentPetInstanceId(confirmedProfile.profile
        ? new DataView(Uint8Array.from(confirmedProfile.profile.bytes).buffer).getUint32(0xa4, true) : undefined);
      setOriginality(confirmedProfile.growth?.originality ?? confirmedProfile.playerSummary?.originality);
      setStatus('选择拥有装备，再点击对应槽；Delete卸下装备');
    })().catch(error => {
      if (!current.active) return;
      setQueryFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    })
      .finally(() => {if (current.active) setBusy(false);});
    return () => {current.active = false; controller.abort();};
  }, [battle, tankInstanceId, accountGeneration, queryAttempt]);

  useLayoutEffect(() => {
    if (!resources) return;
    const element = dialog.current;
    if (document.activeElement === document.body || document.activeElement === element) {
      element?.querySelector<HTMLButtonElement>('[data-equipment-close]')?.focus();
    }
  }, [resources]);

  useLayoutEffect(() => {
    if (busy || !focusAfterCommit.current) return;
    const target = focusAfterCommit.current; focusAfterCommit.current = null;
    if (target.isConnected && (document.activeElement === document.body
        || document.activeElement === dialog.current || document.activeElement === target)) target.focus();
  }, [busy]);

  function requestClose() {
    if (!session.current.active) return;
    session.current.active = false; close();
  }

  async function save(slot: number, remove: boolean, target: EquipmentTarget, button: HTMLButtonElement) {
    const current = session.current;
    if (!current.active || current.pending || !equipment || (!remove && candidate === undefined)) return;
    const request: ReqEquipment = {operation: remove ? 'UNEQUIP' : 'EQUIP', target,
      slot: target === 'PART' ? slot : undefined, instanceId: remove ? undefined : candidate,
      tankInstanceId: equipment.tankInstanceId};
    focusAfterCommit.current = button;
    current.pending = true; setBusy(true); setStatus('保存部件…');
    try {
      const confirmed = await battle.equipment(request);
      if (!current.active) return;
      setEquipment(confirmed); setStatus('部件已保存');
    } catch (error) {
      if (current.active) setStatus(String(error));
    } finally {
      if (current.active) {current.pending = false; setBusy(false);}
    }
  }

  async function refreshTarget() {
    if (!session.current.active) return;
    const [confirmedEquipment, confirmedProfile] = await Promise.all([
      battle.equipment({operation: 'QUERY', tankInstanceId}), battle.roleProfile(),
    ]);
    if (!session.current.active) return;
    if (tankInstanceId !== undefined && confirmedEquipment.tankInstanceId !== tankInstanceId) return;
    setEquipment(confirmedEquipment);
    setCurrentTankInstanceId(confirmedProfile.profile
      ? new DataView(Uint8Array.from(confirmedProfile.profile.bytes).buffer).getUint32(0xa8, true) : undefined);
    setOriginality(confirmedProfile.growth?.originality ?? confirmedProfile.playerSummary?.originality);
  }

  async function useTarget(button: HTMLButtonElement) {
    const current = session.current;
    if (!current.active || current.pending || busy || !equipment || alreadyUsed) return;
    focusAfterCommit.current = button;
    current.pending = true; setBusy(true); setStatus('保存战车选择…');
    try {
      await battle.selectRole({kind: 'tank', instanceId: equipment.tankInstanceId});
      if (!current.active) return;
      setStatus('战车选择已保存');
      await refreshTarget();
    } catch (error) {
      if (current.active) setStatus(String(error));
    } finally {
      if (current.active) {current.pending = false; setBusy(false);}
    }
  }

  const layout = resources ? new HomeSourceLayout(resources.ui, 'myhome_panzerpage.xml') : undefined;
  const definition = (instanceId: number) => {
    const record = inventory?.records.find(value => value.instanceId === instanceId);
    return resources?.catalog.items.find(value => value.itemTableId === record?.itemTableId);
  };
  const name = (instanceId: number) => definition(instanceId)?.name ?? `部件 ${instanceId}`;
  const icon = (instanceId: number) => {
    const item = definition(instanceId);
    return item ? `set:daoju0 image:data\\ui\\daoju\\${String(item.iconId ?? item.itemTableId).padStart(5, '0')}.tga` : '';
  };
  const records = inventory?.records.filter(record => {
    const category = classifyItemId(record.itemTableId);
    return page === 'PART' ? category >= 8 && category <= 12
      : page === 'DECORATION' ? category === 5 || category === 6 : category === 7;
  }) ?? [];
  const instanceId = equipment?.tankInstanceId ?? 0;
  const tank = owned?.equipment.find(record => new Map(record.fields).get(0x1c) === instanceId);
  const fields = tank ? new Map(tank.fields) : undefined;
  const pet = owned?.base.find(record => new Map(record.fields).get(0) === currentPetInstanceId);
  const equippedItemIds = equipment?.slots.map(id => {
    const record = inventory?.records.find(item => item.instanceId === id && item.state === 2 && item.ownedQuantity > 0);
    return record?.itemTableId ?? 0;
  });
  const alreadyUsed = equipment !== undefined && equipment.tankInstanceId === currentTankInstanceId;
  const selected = candidate === undefined ? undefined : definition(candidate);

  function slotButton(target: EquipmentTarget, slot: number, value: number, sourceName: string) {
    const label = target === 'PART' ? `部件槽${slot + 1}` : target === 'DECORATION' ? '装饰' : '标记';
    const title = `${label}：${value ? name(value) : target === 'PART' && slot >= equipment!.slotCount ? '未开放' : target === 'PART' ? '空部件槽' : '空槽'}${target === 'PART' ? '' : '；Delete卸下'}`;
    return <button key={sourceName} type="button" className="home-slot" title={title} aria-label={title}
      data-equipment-slot={target === 'PART' ? slot : undefined}
      data-equipment-target={target === 'PART' ? undefined : target} data-instance-id={value}
      disabled={busy || (target === 'PART' && slot >= equipment!.slotCount && !value)}
      {...sourceProps(resources!, sourceName, icon(value))}
      onClick={event => {if (candidate !== undefined) void save(slot, false, target, event.currentTarget);}}
      onKeyDown={event => {
        if (event.key === 'Delete' && value) {event.preventDefault(); void save(slot, true, target, event.currentTarget);}
      }} />;
  }

  return <dialog ref={dialog} id="home-equipment" aria-label="我的家：战车部件"
    aria-busy={busy || (!equipment && !queryFailed) || (!resources && !resourceError)}
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
    <div className="home-equipment-stage">
      {resources && <>
        <HomeSourceRoot ui={resources.ui} page="tank" busy={busy} close={requestClose}
          closeAttribute="data-equipment-close" selectPage={kind => {
            if (kind === 'player') onPlayerPage?.();
            else onRolePage?.(kind);
          }} />
        <HomeTankSourceRegions ui={resources.ui} />
        <HomeTankUpgradeEntries ui={resources.ui} record={tank} busy={busy}
          openUpgrade={(instanceId, action) => {setUpgrade({instanceId, action}); setStatus('');}} />
        <HomeTankDescription ui={resources.ui}
          description={sourceTankDescription(fields?.get(0x24))} />
        <SourceStaticText ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" name="txtMoney"
          text={equipment ? String(new DataView(Uint8Array.from(equipment.profile.bytes).buffer).getUint32(0x70, true)) : ''} />
        <SourceStaticText ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" name="txtOriginality"
          text={originality === undefined ? '' : String(originality)} />
        <SourceStaticText ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" name="txtListQuantity"
          text={inventory ? homeTankListQuantity(records.length) : ''} />
        <SourceStaticText ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" name="txtTankStatus" text="" />
        <SourceButton ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" source="rdoTank"
          aria-label="拥有战车" aria-pressed="false" disabled={busy || !onRolePage}
          onClick={() => onRolePage?.('tank')} />
        <SourceButton ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" source="rdoEquip"
          aria-label="装备部件" aria-pressed="true" selected disabled={busy || !equipment} />
        {['heseditu2', 'bgHatIcon', 'bgMarkIcon', 'bgInternalPart0', 'bgInternalPart1',
          'bgExternalPart0', 'bgExternalPart1', 'bgExternalPart2'].map(sourceName =>
          <SourceStaticImage key={sourceName} ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml"
            name={sourceName} className="home-equipment-source-picture" aria-hidden="true" />)}
        {tank && fields && <>
          <HomeEquipmentPreview tankId={fields.get(0x24)! >>> 0} instanceId={instanceId}
            textures={readOwnedTankTextures({name: tank.name, fields})} scale={scale} {...sourceProps(resources, 'picModel')} />
          <SourceStaticText ui={resources.ui} layout={layout!} suffix="myhome_panzerpage.xml" name="txtTankName" text={tank.name} />
          <HomeTankOwnedAttributes ui={resources.ui} record={tank} />
          <HomeTankOwnedParameters ui={resources.ui} record={tank} pet={pet}
            catalog={resources.catalog} equippedItemIds={equippedItemIds}
            alreadyUsed={alreadyUsed} />
        </>}
        {([['PART', 'rdoCommon', '一般部件'], ['DECORATION', 'rdoHat', '装饰'], ['MARK', 'rdoMark', '标记']] as const)
          .map(([target, sourceName, label]) => <SourceButton key={target} ui={resources.ui} layout={layout!}
            suffix="myhome_panzerpage.xml" source={sourceName} selected={page === target}
            data-equipment-tab={target} aria-label={label} aria-pressed={page === target} disabled={busy || !equipment}
            onClick={() => {setPage(target); setCandidate(undefined);}} />)}
        <HomeEquipmentSourceList ui={resources.ui} selected={candidate} busy={busy}
          select={setCandidate} entries={records.map(record => ({instanceId: record.instanceId, itemTableId: record.itemTableId,
            name: name(record.instanceId), info: definition(record.instanceId)?.info ?? '',
            iconId: definition(record.instanceId)?.iconId ?? record.itemTableId,
            ownedQuantity: record.ownedQuantity,
            installed: page === 'PART' ? equipment?.slots.includes(record.instanceId) ?? false
              : page === 'DECORATION' ? equipment?.decorationInstanceId === record.instanceId
              : equipment?.markInstanceId === record.instanceId}))} />
        {equipment && <>
          {slotButton('DECORATION', 0, equipment.decorationInstanceId, 'picHatIcon')}
          {slotButton('MARK', 0, equipment.markInstanceId, 'picMarkIcon')}
          {['picInternalPart0', 'picInternalPart1', 'picExternalPart0', 'picExternalPart1', 'picExternalPart2']
            .map((sourceName, slot) => slotButton('PART', slot, equipment.slots[slot] ?? 0, sourceName))}
        </>}
        <HomeTankUseControl ui={resources.ui} alreadyUsed={alreadyUsed} busy={busy}
          canUse={equipment !== undefined && !queryFailed && !alreadyUsed}
          selectedInstance={instanceId} use={event => {void useTarget(event.currentTarget);}} />
        <div className="home-equipment-detail">{selected ? `${selected.name}\n${selected.info}` : ''}</div>
      </>}
      {!resources && <HomeResourceFeedback error={resourceError} close={requestClose} closeAttribute="data-equipment-close" />}
    </div>
    <output hidden={!resources} className="home-equipment-status" aria-live="polite">{status}</output>
    {resources && queryFailed && <button type="button" className="home-equipment-retry" data-equipment-query-retry
      aria-label="重试装备查询" disabled={busy}
      onClick={() => setQueryAttempt(value => value + 1)}>重试</button>}
    {resources && upgrade && <HomeTankUpgradeDialog ui={resources.ui} battle={battle}
      instanceId={upgrade.instanceId} action={upgrade.action} close={() => setUpgrade(undefined)}
      onState={result => {setOwned(result.owned); void refreshTarget();}}
      onConfirmed={message => setStatus(message)} />}
    </SourceImageScale>
  </dialog>;
}
