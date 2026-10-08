import {imageResourceBackground} from '../../assets/image-cache';
import {loadTankTextureCatalog} from '../../content';
import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {loadStaticJson} from '../../assets/static-resources';
import {readOwnedTankTextures, type OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import type {OwnedRoleRecordData, ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {Battle} from '../../match/battle';
import type {HomeSourceControl, HomeSourceUi} from './home-source-layout';
import {HomeEquipmentPreview} from './home-equipment-preview';
import {tankCatalog} from '../../assets/tanks/tank-view';
import './home.css';
import './home-tank-texture-selection.css';

interface TextureRow {
  recordId: number;
  tankId: number;
  part: 'U' | 'M' | 'XY';
  name: string;
  rarity: number;
  moneyPrice: number;
  tokenPrice: number;
  selectable: boolean;
  textures: {A: {status: string; asset: string | null}; B: {status: string; asset: string | null} | null};
}
const COMPONENTS = [
  {part: 'U', control: 'Turret', label: '炮塔'},
  {part: 'M', control: 'Body', label: '车身'},
  {part: 'XY', control: 'Tread', label: '履带'},
] as const;
export interface HomeTankTextureSelectionViewProps {
  battle: Battle;
  record: OwnedRoleRecordData;
  profile: ResRoleProfile['profile'];
  ui: HomeSourceUi;
  close: () => void;
  confirmed: (owned: ResOwnedRoles, profile: ResRoleProfile['profile']) => void;
}

function sourceProps(ui: HomeSourceUi, suffix: string, name: string, picture = false) {
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
  const match = /^set:(\S+) image:(.+)$/.exec(picture ? source.properties.NormalImage ?? '' : '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  const style: CSSProperties = {left, top, width: box[2] - box[0], height: box[3] - box[1],
    backgroundImage: asset ? imageResourceBackground(`/${asset}`) : undefined};
  return {style, 'data-source-control': name, 'data-source-layout': `ui/layouts/${suffix}`, 'data-source-asset': asset};
}

/** A mounted owned-instance session commits only server-confirmed textures and wallet. */
export function HomeTankTextureSelectionView({battle, record, profile, ui, close, confirmed}: HomeTankTextureSelectionViewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useRef({active: false, pending: false});
  const saveButton = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef(false);
  const [current, setCurrent] = useState(() => readOwnedTankTextures({name: record.name, fields: new Map(record.fields)}));
  const [selected, setSelected] = useState(current);
  const [confirmedProfile, setConfirmedProfile] = useState(profile);
  const [rows, setRows] = useState<TextureRow[]>([]);
  const [active, setActive] = useState<Set<'U' | 'M' | 'XY'>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('载入迷彩目录…');
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const fields = new Map(record.fields), tankId = fields.get(0x24)! >>> 0, instanceId = fields.get(0x1c)! >>> 0;

  useEffect(() => {
    const element = dialog.current!, previousFocus = document.activeElement;
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
    const currentSession = {active: true, pending: false}; session.current = currentSession;
    void (async () => {
      if (!current) throw new Error('拥有战车缺少迷彩三槽资料');
      const [catalog, tanks] = await Promise.all([loadTankTextureCatalog(), tankCatalog()]);
      if (!currentSession.active) return;
      const tank = tanks.find(value => value.id === tankId);
      if (!tank) throw new Error('缺少战车组件定义');
      const parts = tank.components.filter(component => component.actions.length > 0).map(component => component.part);
      setActive(new Set(COMPONENTS.filter(component => component.part === 'XY'
        ? parts.includes('X') || parts.includes('Y') : parts.includes(component.part)).map(component => component.part)));
      setRows(catalog.rows.filter(row => row.tankId === tankId));
      setLoading(false); setStatus('选择组件迷彩后保存');
    })().catch(error => {
      if (currentSession.active) {setLoading(false); setStatus(String(error));}
    });
    return () => {currentSession.active = false;};
  }, [battle, tankId]);

  useLayoutEffect(() => {
    if (!saving && focusAfterSave.current) {
      focusAfterSave.current = false;
      saveButton.current?.focus();
    }
  }, [saving]);

  function requestClose() {
    if (!session.current.active || session.current.pending) return;
    session.current.active = false; close();
  }
  const choices = (part: 'U' | 'M' | 'XY') => rows.filter(row => row.part === part && (row.recordId === current?.[part] ||
    (row.selectable && row.textures.A.status === 'resolved' && !!row.textures.A.asset &&
      (part !== 'XY' || row.textures.B?.status === 'resolved' && !!row.textures.B.asset))));
  const changed = !!selected && !!current && COMPONENTS.some(({part}) => selected[part] !== current[part]);

  async function save() {
    const currentSession = session.current;
    if (!currentSession.active || currentSession.pending || loading || !selected || !current || !changed) return;
    focusAfterSave.current = document.activeElement === saveButton.current;
    currentSession.pending = true; setSaving(true); setStatus('保存战车迷彩…');
    try {
      const result = await battle.configureTankTextures({instanceId, textures: {...selected}});
      if (!currentSession.active) return;
      if (result.confirmation.result === 3) {
        const textures: OwnedTankTextures = {...result.confirmation.textures};
        setCurrent(textures); setSelected(textures); setConfirmedProfile(result.profile);
        confirmed(result.owned, result.profile);
      } else setSelected({...current});
      setStatus(result.confirmation.result === 3 ? '战车迷彩已保存' :
        result.confirmation.result === 0 ? '迷彩未变化' : result.confirmation.result === 1 ? '代币不足' :
          result.confirmation.result === 2 ? '金钱不足' : '迷彩保存未成功');
    } catch (error) {
      if (currentSession.active) {setSelected({...current}); setStatus(String(error));}
    } finally {
      if (currentSession.active) {currentSession.pending = false; setSaving(false);}
    }
  }

  let money = 0, tokens = 0;
  for (const {part} of COMPONENTS) {
    if (selected?.[part] === current?.[part]) continue;
    const row = rows.find(value => value.part === part && value.recordId === selected?.[part]);
    if (row?.rarity === 1) money = (money + row.moneyPrice) >>> 0;
    if (row?.rarity === 2) tokens = (tokens + row.tokenPrice) >>> 0;
  }
  const wallet = confirmedProfile ? new DataView(Uint8Array.from(confirmedProfile.bytes).buffer) : undefined;
  return <dialog ref={dialog} id="home-tank-texture-selection" aria-label="拥有战车迷彩" aria-busy={loading || saving}
    data-texture-selection={selected ? JSON.stringify(selected) : undefined} style={{zoom: scale}}
    onCancel={event => {event.preventDefault(); requestClose();}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <p>{!loading && wallet ? `${record.name} · 余额：${wallet.getUint32(0x70, true)} 金钱 / ${wallet.getUint32(0x74, true)} 代币` : ''}</p>
    <div className="home-roles-stage">
      {!loading && current && selected && <>
        {COMPONENTS.map(({part, control, label}) => {
          const options = choices(part), row = options.find(value => value.recordId === selected[part]);
          const ids = [...new Set([current[part], ...options.map(value => value.recordId)])];
          return <div key={part} className="home-texture-component">
            <span data-texture-part={part} {...sourceProps(ui, 'shop_tankpage_texture.xml', `txt${control}TextureName`)}>
              {!active.has(part) ? `${label}：无组件` : row?.name ?? `${label}：原纹理`}</span>
            {([['Dec', -1], ['Inc', 1]] as const).map(([direction, delta]) => <button key={direction} type="button"
              className="home-role-use" aria-label={`${delta < 0 ? '上一款' : '下一款'}${label}迷彩`}
              disabled={saving || !active.has(part) || options.filter(value => value.selectable).length === 0}
              {...sourceProps(ui, 'shop_tankpage_texture.xml', `btn${direction}${control}Texture`, true)}
              onClick={() => {
                if (session.current.pending) return;
                setSelected({...selected, [part]: ids[(ids.indexOf(selected[part]) + delta + ids.length) % ids.length]});
                setStatus('预览尚未保存');
              }} />)}
            <span {...sourceProps(ui, 'shop_tankpage_texture.xml', `txtCoin${control}Expense`)}>
              {!active.has(part) ? '' : selected[part] === current[part] ? '已选' : row?.rarity === 1
                ? `${row.moneyPrice} 金钱` : `${row?.tokenPrice ?? 0} 代币`}</span>
          </div>;
        })}
        <HomeEquipmentPreview tankId={tankId} instanceId={instanceId} textures={selected} scale={scale}
          {...sourceProps(ui, 'shop_tankpage.xml', 'picModel')} />
        <button ref={saveButton} type="button" className="home-role-use" aria-label="保存战车迷彩"
          {...sourceProps(ui, 'shop_tankpage.xml', 'btnChangeTexture', true)} disabled={saving || !confirmedProfile || !changed}
          onClick={() => {void save();}} />
      </>}
    </div>
    <p>{!loading && selected ? `本次费用：${money} 金钱 / ${tokens} 代币` : ''}</p>
    <output aria-live="polite">{status}</output>
    <button type="button" disabled={saving} onClick={requestClose}>返回</button>
  </dialog>;
}
