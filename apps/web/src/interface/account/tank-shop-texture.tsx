import {HomeOwnedTankRowContent} from '../home/home-owned-tank-row-content';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ResOwnedRoles, OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {ResTankTextures} from '../../../../shared/protocols/PtlTankTextures';
import {readOwnedTankTextures, type OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import type {ShopSource} from './shop';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import {TankProductPreview} from '../resources/tank-product-preview';
import {TankShopSourceRegions} from './tank-shop-source-regions';
import {TankShopTextureSourceRegions} from './tank-shop-texture-source-regions';
import {tankCatalog} from '../../assets/tanks/tank-view';

interface TextureRow {
  recordId: number; tankId: number; part: 'U' | 'M' | 'XY'; name: string;
  rarity: number; moneyPrice: number; tokenPrice: number; selectable: boolean;
  textures: {A: {status: string; asset: string | null}; B: {status: string; asset: string | null} | null};
}
const COMPONENTS = [
  {part: 'U', control: 'Turret', label: '炮塔'},
  {part: 'M', control: 'Body', label: '车身'},
  {part: 'XY', control: 'Tread', label: '履带'},
] as const;
export interface TankTextureOwner {
  selected?: number;
  inFlight?: Promise<ResTankTextures>;
  session?: {identity: object; refresh: () => void};
}

/** The formal shop consumes confirmed ownership and the existing instance texture transaction. */
export function TankShopTextureView({ui, source, owner, scale, onBusy, onBuy}: {
  ui: HomeSourceUi; source: ShopSource; owner: TankTextureOwner; scale: number;
  onBusy: (busy: boolean) => void; onBuy: () => void;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_tankpage.xml');
  const textureLayout = new HomeSourceLayout(ui, 'shop_tankpage_texture.xml');
  const session = useRef({active: false, query: false, identity: {}});
  const [tankTypes, setTankTypes] = useState<CombatCatalog['tankTypes']>([]);
  const [owned, setOwned] = useState<ResOwnedRoles>();
  const [profile, setProfile] = useState<ResRoleProfile['profile']>();
  const [rows, setRows] = useState<TextureRow[]>([]);
  const [active, setActive] = useState<Map<number, Set<'U' | 'M' | 'XY'>>>(new Map());
  const [instance, setInstance] = useState(owner.selected);
  const [draft, setDraft] = useState<OwnedTankTextures>();
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('载入拥有战车与迷彩资料…');
  const saveButton = useRef<HTMLButtonElement | null>(null);
  const focusAfterSave = useRef(false);
  const records = owned?.equipment ?? [];
  const record = records.find(value => new Map(value.fields).get(0x1c) === instance);
  const fields = record ? new Map(record.fields) : undefined;
  const tankId = fields?.get(0x24);
  const current = record ? readOwnedTankTextures({name: record.name, fields: fields!}) : undefined;
  const selected = draft ?? current;
  const wallet = profile ? new DataView(Uint8Array.from(profile.bytes).buffer) : undefined;
  const changed = !!selected && !!current && COMPONENTS.some(({part}) => selected[part] !== current[part]);

  useEffect(() => {onBusy(busy);}, [busy, onBusy]);
  useEffect(() => {
    const currentSession = {active: true, query: false, identity: {}}; session.current = currentSession;
    const controller = new AbortController();
    let queued = false;
    async function refresh() {
      if (!currentSession.active) return;
      if (currentSession.query) {queued = true; return;}
      currentSession.query = true; setBusy(true);
      try {
        const [roles, role, response, tanks, metadataResponse] = await Promise.all([
          source.ownedRoles!(), source.roleProfile!(), fetch('/tank-textures.json', {signal: controller.signal}), tankCatalog(),
          fetch('/combat-catalog.json', {signal: controller.signal}),
        ]);
        if (!response.ok) throw new Error('迷彩目录载入失败');
        if (!metadataResponse.ok) throw new Error('战车类别资料载入失败');
        const metadata = await metadataResponse.json() as CombatCatalog;
        const catalog = await response.json() as {rows: TextureRow[]};
        if (!currentSession.active) return;
        setTankTypes(metadata.tankTypes); setOwned(roles); setProfile(role.profile); setRows(catalog.rows);
        setActive(new Map(tanks.map(tank => {
          const parts = tank.components.filter(component => component.actions.length > 0).map(component => component.part);
          return [tank.id, new Set(COMPONENTS.filter(component => component.part === 'XY'
            ? parts.includes('X') || parts.includes('Y') : parts.includes(component.part)).map(component => component.part))];
        })));
        setInstance(value => {
          const id = roles.equipment.some(value2 => new Map(value2.fields).get(0x1c) === value)
            ? value : roles.equipment[0] && new Map(roles.equipment[0].fields).get(0x1c);
          owner.selected = id; return id;
        });
        setDraft(undefined);
        setStatus(owner.inFlight ? '等待迷彩保存确认…' : roles.equipment.length ? '选择迷彩后更换' : '当前没有拥有战车，请先购买战车。');
      } catch (error) {
        if (currentSession.active) setStatus(error instanceof Error ? error.message : '迷彩资料载入失败');
      } finally {
        currentSession.query = false;
        if (currentSession.active) {
          setBusy(Boolean(owner.inFlight));
          if (queued) {queued = false; void refresh();}
        }
      }
    }
    owner.session = {identity: currentSession.identity, refresh: () => {void refresh();}};
    void refresh();
    return () => {currentSession.active = false; controller.abort(); if (owner.session?.identity === currentSession.identity) owner.session = undefined;};
  }, [source, owner]);
  useLayoutEffect(() => {
    if (!busy && focusAfterSave.current) {
      focusAfterSave.current = false;
      if (saveButton.current?.disabled) saveButton.current.closest('.shop-source-stage')
        ?.querySelector<HTMLButtonElement>(`[data-tank-shop-owned-instance="${owner.selected}"]`)?.focus();
      else saveButton.current?.focus();
    }
  }, [busy]);

  function selectRecord(value: OwnedRoleRecordData) {
    owner.selected = new Map(value.fields).get(0x1c); setInstance(owner.selected); setDraft(undefined);
    setStatus('选择迷彩后更换');
  }
  const choices = (part: 'U' | 'M' | 'XY') => rows.filter(row => row.tankId === tankId && row.part === part
    && (row.recordId === current?.[part] || row.selectable && row.textures.A.status === 'resolved' && !!row.textures.A.asset
      && (part !== 'XY' || row.textures.B?.status === 'resolved' && !!row.textures.B.asset)));
  async function save(button: HTMLButtonElement) {
    const currentSession = session.current;
    if (!currentSession.active || currentSession.query || owner.inFlight || !selected || !current || !changed || instance === undefined) return;
    focusAfterSave.current = document.activeElement === button; saveButton.current = button;
    setBusy(true); setStatus('保存战车迷彩…');
    const request = source.configureTankTextures!({instanceId: instance, textures: {...selected}}); owner.inFlight = request;
    try {
      const result = await request;
      if (currentSession.active) {
        if (result.confirmation.result === 3) {setOwned(result.owned); setProfile(result.profile);}
        setDraft(undefined);
        setStatus(result.confirmation.result === 3 ? '战车迷彩已保存' : result.confirmation.result === 0 ? '迷彩未变化'
          : result.confirmation.result === 1 ? '代币不足' : result.confirmation.result === 2 ? '金钱不足' : '迷彩保存未成功');
      }
    } catch (error) {
      if (currentSession.active) {setDraft(undefined); setStatus(error instanceof Error ? error.message : '迷彩保存未确认');}
    } finally {
      owner.inFlight = undefined;
      if (currentSession.active) setBusy(currentSession.query); else owner.session?.refresh();
    }
  }
  return <>
    <TankShopSourceRegions ui={ui} />
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="rdoBuy" aria-label="购买战车商品"
      disabled={busy} onClick={onBuy} data-tank-shop-buy-tab="" />
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="rdoTexture" selected aria-pressed="true"
      aria-label="更换拥有战车迷彩" disabled={busy} data-tank-shop-texture-tab="" />
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtMoney" text={wallet ? String(wallet.getUint32(0x70, true)) : ''} />
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtCoin" text={wallet ? String(wallet.getUint32(0x74, true)) : ''} />
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtName" text={record?.name ?? ''} />
    <SourceStaticText ui={ui} layout={layout} suffix="shop_tankpage.xml" name="txtListQuantity" text={owned ? String(records.length) : ''} />
    <div {...sourceProps(ui, layout, 'shop_tankpage.xml', 'lstTank')} data-tank-shop-owned-list="" role="listbox" aria-label="拥有战车" aria-busy={busy}>
      {records.map((value, index) => {
        const rowFields = new Map(value.fields), id = rowFields.get(0x1c)!, rowTankId = rowFields.get(0x24);
        return <button key={id} type="button" role="option" data-tank-shop-owned-instance={id} data-home-owned-tank-row={id} disabled={busy}
          aria-selected={id === instance} tabIndex={id === instance ? 0 : -1}
          style={id === instance ? {backgroundImage: sourceProps(ui, layout, 'shop_tankpage.xml', 'lstTank', layout.control('lstTank').properties.SelectionImage).style.backgroundImage} : undefined}
          onClick={() => selectRecord(value)} onKeyDown={event => {
            const destination = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : undefined;
            if (destination === undefined) return; event.preventDefault();
            const candidate = records[Math.max(0, Math.min(records.length - 1, destination))]; selectRecord(candidate);
            const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-tank-shop-owned-instance="${new Map(candidate.fields).get(0x1c)}"]`);
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }}><HomeOwnedTankRowContent ui={ui} name={value.name} tankId={rowTankId}
            tankType={tankTypes?.find(tank => tank.tankId === rowTankId)?.tankType}
            durationMinutes={rowFields.get(0x34)} /></button>;
      })}
    </div>
    {tankId !== undefined && selected && <TankProductPreview {...sourceProps(ui, layout, 'shop_tankpage.xml', 'picModel')}
      tankId={tankId} textures={selected} scale={scale} data-tank-shop-texture-preview="" data-owned-instance={instance} />}
    <TankShopTextureSourceRegions ui={ui} offsetX={0} offsetY={36} />
    {COMPONENTS.map(({part, control, label}) => {
      const options = choices(part), row = options.find(value => value.recordId === selected?.[part]);
      const ids = current ? [...new Set([current[part], ...options.map(value => value.recordId)])] : [];
      const available = tankId !== undefined && active.get(tankId)?.has(part);
      return <div key={part} className="tank-shop-texture-component">
        <span {...sourceProps(ui, textureLayout, 'shop_tankpage_texture.xml', `txt${control}TextureName`, undefined, 0, 36)} data-texture-part={part} data-presentation-colour="web-readable">
          {!record ? '' : !available ? `${label}：无组件` : row?.name ?? `${label}：原纹理`}</span>
        {([['Dec', -1], ['Inc', 1]] as const).map(([direction, delta]) => <SourceButton key={direction}
          ui={ui} layout={textureLayout} suffix="shop_tankpage_texture.xml" source={`btn${direction}${control}Texture`} offsetY={36}
          aria-label={`${delta < 0 ? '上一款' : '下一款'}${label}迷彩`} disabled={busy || !selected || !available || !options.some(value => value.selectable)}
          onClick={() => {if (selected) {const next = ids.indexOf(selected[part]) + delta; if (next < 0 || next >= ids.length) return; setDraft({...selected, [part]: ids[next]}); setStatus('预览尚未保存');}}} />)}
        <span {...sourceProps(ui, textureLayout, 'shop_tankpage_texture.xml', `txtCoin${control}Expense`, undefined, 0, 36)} data-presentation-colour="web-readable">
          {!available || !selected ? '' : selected[part] === current?.[part] ? '已选' : row?.rarity === 1 ? `${row.moneyPrice}金币` : row?.rarity === 2 ? `${row.tokenPrice}代币` : ''}</span>
      </div>;
    })}
    <SourceButton ui={ui} layout={layout} suffix="shop_tankpage.xml" source="btnChangeTexture" data-tank-shop-texture-save=""
      aria-label="保存战车迷彩" disabled={busy || !profile || !changed} onClick={event => {void save(event.currentTarget);}}>
      {(busy || !profile || !changed) && <span className="tank-shop-texture-save-unavailable" data-presentation-state="web-disabled"
        style={{backgroundImage: sourceProps(ui, layout, 'shop_tankpage.xml', 'btnChangeTexture', layout.control('btnChangeTexture').properties.NormalImage).style.backgroundImage}} />}
    </SourceButton>
    <button type="button" className="tank-shop-refresh" disabled={busy} onClick={() => owner.session?.refresh()} data-tank-shop-texture-refresh="">刷新拥有资料</button>
    <output className="tank-shop-status" data-tank-shop-texture-status="" data-texture-selection={selected ? JSON.stringify(selected) : undefined}
      role="status" aria-live="polite">{status}</output>
  </>;
}
