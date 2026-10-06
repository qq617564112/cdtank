import type {ResPetSkillLearning} from '../../../../shared/protocols/PtlPetSkillLearning';
import type {TankShopProduct} from '../../../../shared/protocols/PtlTankShop';
import {HomeResourceFeedback} from './home-resource-feedback';
import './home.css';
import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {readOwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import type {Battle} from '../../match/battle';
import type {OwnedRoleRecordData, ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import {SourceImageScale} from '../resources/source-static-image';
import {HomeSourceRoot} from './home-source-root';
import {HomeTankSourcePage} from './home-tank-source-page';
import {HomePetSourcePage} from './home-pet-source-page';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import type {HomeSourceControl, HomeSourceUi} from './home-source-layout';
import {HomeEquipmentPreview} from './home-equipment-preview';
import {PetModelPreview} from '../resources/pet-model-preview';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {PetShopProduct} from '../../../../shared/protocols/PtlPetShop';
import {HomePetOwnedDetails} from './home-pet-owned-details';
import {HomeOwnedRoleSourceList} from './home-owned-role-source-list';

type RoleKind = 'tank' | 'pet';
export interface HomeRolesViewProps {open: boolean; close: () => void; battle: Battle; initialKind?: RoleKind; onPlayerPage?: () => void; onEquipmentPage?: () => void; onTexturePage?: (instanceId: number) => void; initialSelectedInstance?: number;}

function sourceProps(ui: HomeSourceUi, kind: RoleKind, name: string, picture?: string) {
  const suffix = kind === 'tank' ? 'myhome_panzerpage.xml' : 'myhome_petpage.xml';
  const controls = ui.layouts.find(layout => layout.path.endsWith(suffix))!.windows;
  const control = (key: string) => controls.find(value => value.name === key)!;
  const source = control(name);
  const rectangle = (value: HomeSourceControl) => value.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const box = rectangle(source);
  let left = box[0], top = box[1];
  for (let parent = source.parent; parent;) {
    const owner = control(parent), position = rectangle(owner);
    left += position[0]; top += position[1]; parent = owner.parent;
  }
  const reference = picture ? source.properties[picture] : undefined;
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  const style: CSSProperties = {left, top, width: box[2] - box[0], height: box[3] - box[1],
    backgroundImage: asset ? `url('/${asset}')` : undefined};
  return {style, 'data-source-control': name, 'data-source-layout': `ui/layouts/${suffix}`, 'data-source-asset': asset};
}

/** The root page selects a role tab; each opening queries current ownership and profile. */
export function HomeRolesView({open, close, battle, initialKind, onPlayerPage, onEquipmentPage, onTexturePage, initialSelectedInstance}: HomeRolesViewProps) {
  const [kind, setKind] = useState<RoleKind>(initialKind ?? 'tank');
  useEffect(() => {if (open && initialKind) setKind(initialKind);}, [open, initialKind]);
  return open ? <RolesSession onTexturePage={onTexturePage} initialSelectedInstance={initialSelectedInstance} onPlayerPage={onPlayerPage} onEquipmentPage={onEquipmentPage} close={close} battle={battle} kind={kind} setKind={setKind} /> : null;
}

function RolesSession({close, battle, kind, setKind, onPlayerPage, onEquipmentPage, onTexturePage, initialSelectedInstance}: Omit<HomeRolesViewProps, 'open'> & {
  kind: RoleKind; setKind: (kind: RoleKind) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const session = useRef({active: false, pending: false});
  const focusAfterCommit = useRef<HTMLButtonElement | null>(null);
  const [ui, setUi] = useState<HomeSourceUi>();
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [tankProducts, setTankProducts] = useState<TankShopProduct[]>([]);
  const [petProducts, setPetProducts] = useState<PetShopProduct[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<CombatCatalog>();
  const [profile, setProfile] = useState<ResRoleProfile['profile']>();
  const [selected, setSelected] = useState<number>();
  const focusInitialSelection = useRef(initialSelectedInstance !== undefined);
  const [busy, setBusy] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [learning, setLearning] = useState<ResPetSkillLearning>();
  const [learningBusy, setLearningBusy] = useState(false);
  const learningGeneration = useRef(0);
  const learningPending = useRef(false);
  const [resourceError, setResourceError] = useState<string>();
  const [status, setStatus] = useState('载入战车与宠物…');
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
    const current = {active: true, pending: false}; session.current = current;
    const controller = new AbortController();
    setResourceError(undefined);
    setUi(undefined); setOwned(undefined); setProfile(undefined); setSelected(undefined);
    setRolesLoaded(false); setLearning(undefined);
    setBusy(true); setStatus('载入战车与宠物…');
    void (async () => {
      const [response] = await Promise.all([
        fetch('/ui.json', {signal: controller.signal}), loadSourceUiFonts(),
      ]);
      if (!response.ok) throw new Error('角色界面资源载入失败');
      const resources = await response.json() as HomeSourceUi;
      if (!resources.layouts.some(layout => layout.path.endsWith('myhome_panzerpage.xml'))
          || !resources.layouts.some(layout => layout.path.endsWith('myhome_petpage.xml'))
          || !resources.layouts.some(layout => layout.path.endsWith('myhome.xml'))) throw new Error('角色界面布局缺失');
      if (!current.active) return;
      setUi(resources);
    })().catch(error => {if (current.active) setResourceError(error instanceof Error ? error.message : String(error));});
    void (async () => {
      const [confirmedOwned, confirmedProfile] = await Promise.all([
        battle.ownedRoles(), battle.roleProfile(),
      ]);
      if (!current.active) return;
      setOwned(confirmedOwned); setProfile(confirmedProfile.profile);
      if (initialSelectedInstance !== undefined && confirmedOwned.equipment.some(record => new Map(record.fields).get(0x1c) === initialSelectedInstance)) {
        setSelected(initialSelectedInstance);
      }
      setStatus('');
    })().catch(error => {if (current.active) setStatus(`角色资料读取失败：${String(error)}`);})
      .finally(() => {if (current.active) {setBusy(false); setRolesLoaded(true);}});
    return () => {current.active = false; controller.abort();};
  }, [battle]);

  useEffect(() => {
    const generation = ++learningGeneration.current;
    setLearning(undefined);
    if (kind !== 'pet' || !rolesLoaded) {setLearningBusy(false); return;}
    setLearningBusy(true);
    void battle.petSkillLearning({operation: 'QUERY'}).then(result => {
      if (!session.current.active || learningGeneration.current !== generation) return;
      setLearning(result); setOwned(result.owned); setProfile(result.profile);
    }).catch(error => {
      if (session.current.active && learningGeneration.current === generation) setStatus(String(error));
    }).finally(() => {
      if (session.current.active && learningGeneration.current === generation) setLearningBusy(false);
    });
    return () => {++learningGeneration.current;};
  }, [battle, kind, rolesLoaded]);

  async function learnPetSkill(instanceId: number, slot: number) {
    const current = session.current;
    const quote = learning?.quotes.find(value => value.instanceId === instanceId && value.slot === slot);
    if (!current.active || current.pending || learningPending.current || busy || learningBusy ||
        kind !== 'pet' || quote?.kind !== 'eligible') return;
    const generation = learningGeneration.current;
    learningPending.current = true; setLearningBusy(true); setStatus('学习技能…');
    try {
      const result = await battle.petSkillLearning({operation: 'LEARN', instanceId, slot,
        requestId: crypto.randomUUID().replaceAll('-', '')});
      if (!current.active || learningGeneration.current !== generation) return;
      setLearning(result); setOwned(result.owned); setProfile(result.profile); setStatus('技能学习已确认');
    } catch (error) {
      if (current.active && learningGeneration.current === generation) setStatus(String(error));
    } finally {
      learningPending.current = false;
      if (current.active && learningGeneration.current === generation) setLearningBusy(false);
    }
  }

  useEffect(() => {
    if (kind !== 'tank') return;
    let live = true;
    setTankProducts([]);
    void battle.tankShop({operation: 'QUERY'}).then(result => {
      if (live) setTankProducts(result.tanks);
    }).catch(() => {if (live) setTankProducts([]);});
    return () => {live = false;};
  }, [battle, kind]);

  useEffect(() => {
    if (kind !== 'pet') return;
    let active = true;
    setPetProducts([]);
    void battle.petShop({operation: 'QUERY'}).then(result => {
      if (active) setPetProducts(result.pets);
    }).catch(() => {});
    return () => {active = false;};
  }, [battle, kind]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch('/combat-catalog.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('技能名称载入失败');
      const catalog = await response.json() as CombatCatalog;
      if (active) setRoleCatalog(catalog);
    }).catch(() => {});
    return () => {active = false; controller.abort();};
  }, []);

  useLayoutEffect(() => {
    const target = focusAfterCommit.current;
    if (busy || !target) return;
    focusAfterCommit.current = null;
    if (document.activeElement === document.body || document.activeElement === dialog.current || document.activeElement === target) {
      if (!target.disabled && target.isConnected) target.focus();
      else dialog.current?.querySelector<HTMLButtonElement>(`[data-owned-role="${selected}"]`)?.focus();
    }
  }, [busy, selected]);

  useLayoutEffect(() => {
    if (!ui) return;
    const element = dialog.current;
    if (document.activeElement === document.body || document.activeElement === element) {
      element?.querySelector<HTMLButtonElement>('[data-roles-close]')?.focus();
    }
  }, [ui, owned]);

  useLayoutEffect(() => {
    if (busy || !ui || !focusInitialSelection.current) return;
    focusInitialSelection.current = false;
    dialog.current?.querySelector<HTMLButtonElement>(`[data-owned-role="${selected}"]`)?.focus();
  }, [busy, ui, selected]);

  const currentId = profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(kind === 'tank' ? 0xa8 : 0xa4, true) : undefined;
  const records = (kind === 'tank' ? owned?.equipment : owned?.base) ?? [];
  const id = (record: OwnedRoleRecordData) => new Map(record.fields).get(kind === 'tank' ? 0x1c : 0)! >>> 0;
  const displayed = records.find(record => id(record) === selected) ?? records.find(record => id(record) === currentId);
  const fields = displayed ? new Map(displayed.fields) : undefined;

  function requestClose() {
    if (!session.current.active) return;
    session.current.active = false; close();
  }

  async function save(button: HTMLButtonElement) {
    const current = session.current;
    if (!current.active || current.pending || busy || learningBusy || !profile || selected === undefined || selected === currentId) return;
    current.pending = true; focusAfterCommit.current = button;
    setBusy(true); setStatus('保存角色选择…');
    try {
      const confirmed = await battle.selectRole({kind, instanceId: selected});
      if (!current.active) return;
      setProfile(confirmed.profile); setStatus('角色选择已保存');
    } catch (error) {
      if (current.active) {setSelected(currentId); setStatus(String(error));}
    } finally {
      if (current.active) {current.pending = false; setBusy(false);}
    }
  }

  return <>
    <dialog ref={dialog} id="home-roles" aria-label="我的家：战车与宠物" aria-busy={busy || learningBusy || (!ui && !resourceError)} style={{zoom: scale}}
      onCancel={event => {event.preventDefault(); requestClose();}}
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
      <div className="home-roles-stage" data-home-role-page={kind}>
        {ui && <>
          <HomeSourceRoot ui={ui} page={kind} busy={busy || learningBusy} close={requestClose} closeAttribute="data-roles-close"
            selectPage={page => {
              if (page === 'player') onPlayerPage?.();
              else {setKind(page); setSelected(undefined); if (owned) setStatus('');}
            }} />
          {kind === 'tank' ? <HomeTankSourcePage ui={ui} name={displayed?.name ?? ''} busy={busy} record={displayed}
            money={profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0x70, true) : undefined}
            quantity={owned?.equipment.length} description={tankProducts.find(product => product.tankId === fields?.get(0x24))?.info}
            selectedInstance={currentId} alreadyUsed={!!displayed && currentId === id(displayed)}
            canUse={!busy && !learningBusy && !!profile && selected !== undefined && currentId !== selected}
            use={event => {void save(event.currentTarget);}} openEquipment={onEquipmentPage} />
            : <HomePetSourcePage ui={ui} name={displayed?.name ?? ''} selectedInstance={currentId}
              money={profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0x70, true) : undefined}
              quantity={owned?.base.length} alreadyUsed={!!displayed && currentId === id(displayed)}
              canUse={!busy && !learningBusy && !!profile && selected !== undefined && currentId !== selected}
              use={event => {void save(event.currentTarget);}} />}
          {kind === 'pet' && <HomePetOwnedDetails ui={ui} record={displayed} catalog={roleCatalog}
            quotes={learning?.quotes} points={learning?.points} busy={busy || learningBusy}
            status={status} learn={(instanceId, slot) => {void learnPetSkill(instanceId, slot);}}
            description={petProducts.find(product => product.petId === fields?.get(8))?.info} />}
          <HomeOwnedRoleSourceList ui={ui} kind={kind} selected={selected}
            current={currentId} busy={busy || learningBusy} select={instanceId => {setSelected(instanceId); setStatus('');}}
            entries={records.map(record => {
              const ownedFields = new Map(record.fields);
              const tankId = ownedFields.get(0x24);
              const petId = ownedFields.get(8);
              const pet = roleCatalog?.petTypes?.find(pet => pet.petId === petId);
              return {instanceId: id(record), name: record.name, tankId,
                tankType: roleCatalog?.tankTypes?.find(tank => tank.tankId === tankId)?.tankType,
                durationMinutes: ownedFields.get(0x34), petId,
                petType: pet?.petType, petSize: pet?.petSize};
            })}/>
          {kind === 'tank' && displayed && fields && <HomeEquipmentPreview tankId={fields.get(0x24)! >>> 0}
            instanceId={id(displayed)} textures={readOwnedTankTextures({name: displayed.name, fields})}
            scale={scale} {...sourceProps(ui, kind, 'picModel')} />}
          {kind === 'pet' && displayed && fields && <PetModelPreview petId={fields.get(8)! >>> 0}
            kind="home" scale={scale} {...sourceProps(ui, kind, 'picModel')} data-home-pet-preview="" />}
        </>}
      <div className="home-role-web-tools" hidden={kind !== 'tank'}>
        
        <button type="button" disabled={busy || !displayed || !profile || !ui || !onTexturePage}
          data-source-control="btnChangeTexture" data-source-layout="ui/layouts/shop_tankpage.xml"
          data-home-open-texture="" onClick={() => {if (displayed) onTexturePage?.(id(displayed));}}>更换迷彩</button>
      </div>
      <output hidden={!ui} className="home-role-status" aria-live="polite">{status || (!records.length ? '暂无拥有角色' : !profile ? '尚无角色资料' : '选择角色后点击出击')}</output>
      {!ui && <HomeResourceFeedback error={resourceError} close={requestClose} closeAttribute="data-roles-close" />}
      </div>
      </SourceImageScale>
    </dialog>

  </>;
}
