import './home-tank-upgrade.css';
import {createPortal} from 'react-dom';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ResTankUpgrade, TankUpgradeQuote} from '../../../../shared/protocols/PtlTankUpgrade';
import type {Battle} from '../../match/battle';
import {createRequestId} from '../../network/request-id';
import {decodeImage} from '../../assets/image-resources';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';

const suffix = 'myhome_panzerpage_modify.xml';
const viewportScale = () => Math.min(innerWidth / 800, innerHeight / 599);

type UpgradeAction = 1 | 2;
type PendingAttempt = {instanceId: number; action: UpgradeAction; requestId: string; completed: boolean};

function sourceAsset(ui: HomeSourceUi, reference: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference);
  if (!match) return undefined;
  const sets = ui.imagesets.filter(set => set.attributes.Name === match[1]);
  const set = sets.find(value => value.path.includes('imagesets_dds/')) ?? sets[0];
  return set?.images.find(image => image.Name === match[2])?.asset;
}

async function prepareTankUpgradeAssets(ui: HomeSourceUi) {
  const references = new Set<string>();
  const layoutUi = ui.layouts.find(value => value.path.endsWith(suffix));
  if (!layoutUi) throw new Error('改装弹窗布局缺失');
  for (const control of layoutUi?.windows ?? []) for (const value of Object.values(control.properties)) {
    if (/^set:(\S+) image:(.+)$/.test(value)) references.add(value);
  }
  const assets = [...references].map(reference => sourceAsset(ui, reference));
  if (assets.includes(undefined)) throw new Error('改装弹窗图片资源缺失');
  await Promise.all([...new Set(assets as string[])].map(async asset => {
    try {
      await decodeImage(`/${asset}`);
    } catch (error) {
      throw new Error(`改装弹窗图片读取失败：${asset}`, {cause: error});
    }
  }));
}

function reasonText(quote?: TankUpgradeQuote) {
  if (!quote) return '改装信息读取失败';
  if (quote.canUpgrade) return '';
  return quote.reason === 'UPGRADE_TARGET_UNAVAILABLE' ? '已达改装上限'
    : quote.reason === 'UPGRADE_MONEY_REQUIRED' ? '金钱不足'
      : quote.reason === 'UPGRADE_ORIGINALITY_REQUIRED' ? '创意点不足'
        : quote.reason === 'UPGRADE_DISABLED' ? '改装入口未启用' : '当前无法改装';
}

function confirmationText(response: ResTankUpgrade) {
  const confirmation = response.confirmation ?? response.historicalConfirmation;
  if (!confirmation) return '';
  const result = confirmation.result === 0 ? '改装成功'
    : confirmation.result === 2 ? '改装失败' : '本次改装无效果';
  return response.replayed ? `${result}，历史结果已确认` : result;
}

/** The original 24-control tank modification sheet consumes only confirmed account/quote state. */
export function HomeTankUpgradeDialog({ui, battle, instanceId, action, close, onState, onConfirmed}: {
  ui: HomeSourceUi; battle: Pick<Battle, 'tankUpgrade'>; instanceId: number; action: UpgradeAction;
  close(): void; onState(response: ResTankUpgrade): void; onConfirmed(message: string): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const owner = useRef({active: false, pending: false, generation: 0});
  const resourceGeneration = useRef(0);
  const attempt = useRef<PendingAttempt | undefined>(undefined);
  const escapePending = useRef(false);
  const composing = useRef(false);
  const [response, setResponse] = useState<ResTankUpgrade>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [resourceError, setResourceError] = useState('');
  const [resourcePending, setResourcePending] = useState(false);
  const [resourcesReady, setResourcesReady] = useState(false);
  const [status, setStatus] = useState('');
  const [scale, setScale] = useState(viewportScale);
  const layout = new HomeSourceLayout(ui, suffix);
  const fields = response ? new Map(response.owned.equipment.find(record => new Map(record.fields).get(0x1c) === instanceId)?.fields) : undefined;
  const quote = response?.quotes.find(value => value.instanceId === instanceId && value.action === action);
  const currentAttribute = fields?.get(action === 1 ? 0x3c : 0x4c);
  const currentBonus = fields?.get(action === 1 ? 0x40 : 0x50);

  async function query() {
    const current = owner.current;
    const generation = ++current.generation;
    if (!current.active || current.pending) return;
    current.pending = true;
    setPending(true); setError(''); setStatus('');
    try {
      const result = await battle.tankUpgrade({operation: 'QUERY', instanceId});
      if (!current.active || current.generation !== generation) return;
      setResponse(result);
      onState(result);
    } catch (reason) {
      if (current.active && current.generation === generation) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      current.pending = false;
      if (current.active && current.generation === generation) setPending(false);
    }
  }

  function prepareResources() {
    const generation = ++resourceGeneration.current;
    setResourcePending(true); setResourceError(''); setResourcesReady(false);
    void prepareTankUpgradeAssets(ui).then(() => {
      if (resourceGeneration.current !== generation) return;
      setResourcesReady(true);
    }).catch(reason => {
      if (resourceGeneration.current === generation) {
        setResourceError(reason instanceof Error ? reason.message : String(reason));
      }
    }).finally(() => {
      if (resourceGeneration.current === generation) setResourcePending(false);
    });
  }

  async function submit() {
    const current = owner.current;
    if (!current.active || current.pending || resourcePending) return;
    if (!resourcesReady) return;
    if (!response || !quote) {query(); return;}
    if (!quote.canUpgrade) {
      setStatus(reasonText(quote));
      return;
    }
    let request = attempt.current;
    if (!request || request.instanceId !== instanceId || request.action !== action || request.completed) {
      request = {instanceId, action, requestId: createRequestId(), completed: false};
      attempt.current = request;
    }
    current.pending = true; setPending(true); setStatus('正在提交改装…'); setError('');
    try {
      const result = await battle.tankUpgrade({operation: 'UPGRADE', instanceId, action, requestId: request.requestId});
      if (!current.active) return;
      attempt.current = {...request, completed: true};
      setResponse(result);
      onState(result);
      const message = confirmationText(result);
      setStatus(message);
      if (message) onConfirmed(message);
    } catch (reason) {
      if (current.active) setStatus(`提交失败：${reason instanceof Error ? reason.message : String(reason)}。再次点击将重试本次提交`);
    } finally {
      current.pending = false;
      if (current.active) setPending(false);
    }
  }

  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-tank-upgrade-close]')?.focus();
    const resize = () => setScale(viewportScale());
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      const restore = document.activeElement === document.body || element.contains(document.activeElement);
      if (element.open) element.close();
      if (restore && origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);

  useEffect(() => {
    const current = owner.current;
    current.active = true;
    prepareResources();
    void query();
    return () => {
      current.active = false;
      current.generation++;
      resourceGeneration.current++;
    };
  }, [battle, instanceId, action]);

  const disabled = pending;
  const retry = (!response && !!error) || (!!response && !quote);
  const resourceRetry = !!resourceError && !resourcesReady && !resourcePending;
  return createPortal(<dialog ref={dialog} data-home-tank-upgrade-dialog=""
    data-tank-upgrade-instance={instanceId} data-tank-upgrade-action={action} aria-label={action === 1 ? '火力改装' : '装甲改装'}
    aria-busy={pending || resourcePending} style={{width: 800 * scale, height: 599 * scale}}
    onCancel={event => {event.preventDefault(); if (!composing.current) close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!composing.current && !event.nativeEvent.isComposing) escapePending.current = true;
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!composing.current && !event.nativeEvent.isComposing) close();
      }
    }}>
    <div className="home-tank-upgrade-stage" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {['all', 'kuang', 'tiao', 'huofeijinengdian', 'jinengtubiao', 'tiao2', 'jinqiantubiao', 'jinqian'].map(name =>
          <SourceStaticImage key={name} ui={ui} layout={layout} suffix={suffix} name={name}
            className="home-tank-upgrade-picture" aria-hidden="true" />)}
        <SourceImageScale value={1}>
          {([['lblLv', '等级'], ['lblSuccess', '成功'],
            ['lblNoEffect', '无效果'], ['lblFail', '失败']] as const).map(([name, text]) =>
            <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name} text={text} />)}
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="lblNextLv"
            text={quote ? `下一等级 ${quote.nextLevel}` : '下一等级'} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtLv"
            text={quote ? String(quote.currentLevel) : ''} data-tank-upgrade-current-level={quote?.currentLevel} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtValue"
            text={currentAttribute === undefined ? '' : `${currentAttribute} / ${currentBonus ?? 0}`}
            data-tank-upgrade-current-attribute={currentAttribute} data-tank-upgrade-current-bonus={currentBonus} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtNextMinValue"
            text={quote ? `${quote.nextAttributeMin} / ${quote.nextBonusMin}` : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtNextMaxValue"
            text={quote ? `${quote.nextAttributeMax} / ${quote.nextBonusMax}` : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtSuccess"
            text={quote ? String(quote.success) : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtNoEffect"
            text={quote ? String(quote.noEffect) : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtFail"
            text={quote ? String(quote.fail) : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtOriginalityExpense"
            text={quote ? String(quote.originalityCost) : ''} />
          <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoneyExpense"
            text={quote ? String(quote.moneyCost) : ''} />
        </SourceImageScale>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnModifyTank"
          data-tank-upgrade-submit="" aria-label={resourceRetry ? '重试准备改装弹窗资源'
            : retry ? '重试读取改装信息' : '确认改装'}
          disabled={disabled || resourcePending || (!resourcesReady && !resourceRetry)
            || (resourcesReady && !retry && quote?.canUpgrade !== true)}
          onClick={() => {if (resourceRetry) {prepareResources();}
            else void submit();}} />
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnClose"
          data-tank-upgrade-close="" aria-label="关闭改装" onClick={close} />
        <output className="home-tank-upgrade-status" aria-live="polite">
          {resourceError ? `改装弹窗资源读取失败：${resourceError}。请重试资源。`
            : resourcePending ? '正在准备改装弹窗资源…' : status || (pending ? '正在读取改装信息…' : error
              ? `改装信息读取失败：${error}。点击确认按钮重试` : reasonText(quote))}
        </output>
      </SourceImageScale>
    </div>
  </dialog>, document.body);
}
