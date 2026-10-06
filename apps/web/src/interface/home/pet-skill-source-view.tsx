import type {PetLearningQuote} from '../../../../shared/contracts/pet-learning';
import './pet-skill-source.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';

const suffix = 'myhome_petpage_skill.xml';
const viewportScale = () => Math.min(innerWidth / 800, innerHeight / 600);

/** Source skill sheet reads confirmed ownership and exact skill-table metadata. */
export function PetSkillSourceView({ui, skill, level, close, quote, nextSkill, busy = false, status, learn, binding = 'web-confirmed-owned-skill'}: {
  ui: HomeSourceUi; skill: CombatSkillDefinition; level: number; close(): void; binding?: string;
  quote?: PetLearningQuote; nextSkill?: CombatSkillDefinition; busy?: boolean; status?: string; learn?(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const [scale, setScale] = useState(viewportScale);
  const layout = new HomeSourceLayout(ui, suffix);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-pet-skill-close]')?.focus();
    return () => {
      const restore = document.activeElement === document.body || element.contains(document.activeElement);
      if (element.open) element.close();
      if (restore && origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);
  useEffect(() => {
    const resize = () => setScale(viewportScale());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return createPortal(<dialog ref={dialog} data-pet-skill-dialog="" data-skill-id={skill.skillId}
    data-skill-binding={binding} aria-busy={busy} data-pet-skill-instance={quote?.instanceId}
    data-pet-skill-slot={quote?.slot} data-pet-skill-rank-cap={quote?.rankCap} data-pet-skill-quote={quote?.kind} aria-label={`宠物技能：${skill.name}`}
    style={{width: 800 * scale, height: 599 * scale}}
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.repeat && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          escapePending.current = true;
        }
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!event.nativeEvent.isComposing && event.keyCode !== 229) close();
      }
    }}>
    <div className="pet-skill-source-stage" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {['all', 'kuang', 'tiao', 'huofeijinengdian', 'jinengtubiao'].map(name =>
          <SourceStaticImage key={name} ui={ui} layout={layout} suffix={suffix} name={name}
            className="pet-skill-source-picture" aria-hidden="true" />)}
        <SourceImageScale value={1}>
        {['txtSkillName', 'lblLv', 'txtLv', 'lblNextLv', 'txtTechExpense'].map(name =>
          <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
            text={name === 'txtSkillName' ? skill.name : name === 'txtLv' ? String(level) : name === 'txtTechExpense' && quote && quote.kind !== 'rankLimit' ? String(quote.cost) : ''}
            data-skill-text-binding={name === 'txtSkillName' || name === 'txtLv' ? binding : name === 'txtTechExpense' && quote && quote.kind !== 'rankLimit' ? 'server-confirmed-learning-quote' : 'unbound'} />)}
        </SourceImageScale>
        <div {...sourceProps(ui, layout, suffix, 'edtSkillDesc')} data-pet-skill-description=""
          role="region" aria-label="技能介绍" tabIndex={0}>{skill.info}</div>
        <div {...sourceProps(ui, layout, suffix, 'edtNextSkillDesc')} data-skill-text-binding={nextSkill ? 'server-confirmed-next-skill' : 'unbound'}
          aria-label="下一级技能介绍">{nextSkill?.info ?? ''}</div>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnLearnSkill" disabled={busy || quote?.kind !== 'eligible' || !learn}
          data-pet-skill-learn="" aria-label="学习技能" onClick={learn} />
        <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnClose" data-pet-skill-close=""
          aria-label="关闭技能介绍" onClick={close} />
      </SourceImageScale>
      <output data-pet-skill-status="" aria-live="polite"
        style={{position: 'absolute', left: 257, top: 386, width: 300, color: 'white', fontSize: 12}}>{status || (quote?.kind === 'rankLimit' ? '技能等级已达上限' : quote?.kind === 'insufficientPoints' ? '技能点不足' : '')}</output>
    </div>
  </dialog>, document.body);
}
