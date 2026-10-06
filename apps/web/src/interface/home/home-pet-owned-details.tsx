import type {PetLearningQuote} from '../../../../shared/contracts/pet-learning';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {useEffect, useState} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {PetSkillSourceView} from './pet-skill-source-view';

/** Current confirmed ownership projected into the source pet information regions. */
export function HomePetOwnedDetails({ui, record, catalog, description, quotes, points, busy = false, status, learn}: {
  ui: HomeSourceUi; record?: OwnedRoleRecordData; catalog?: CombatCatalog; description?: string;
  quotes?: PetLearningQuote[]; points?: number; busy?: boolean; status?: string;
  learn?(instanceId: number, slot: number): void;
}) {
  const suffix = 'myhome_petpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const fields = record ? new Map(record.fields) : undefined;
  const instanceId = fields?.get(0);
  const [selected, setSelected] = useState<{owner: number; index: number} | undefined>();
  useEffect(() => setSelected(undefined), [instanceId]);
  const selectedId = selected && selected.owner === instanceId ? fields?.get(0x44 + selected.index * 4) : undefined;
  const selectedLevel = selected && selected.owner === instanceId ? fields?.get(0x5c + selected.index * 4) : undefined;
  const selectedSkill = selectedId ? catalog?.skills.find(skill => skill.skillId === selectedId + Math.max(0, (selectedLevel ?? 0) - 1)) : undefined;
  const quote = selected && selected.owner === instanceId
    ? quotes?.find(value => value.instanceId === instanceId && value.slot === selected.index) : undefined;
  const nextSkill = quote && quote.kind !== 'rankLimit'
    ? catalog?.skills.find(skill => skill.skillId === quote.nextSkillId) : undefined;
  const value = (offset: number) => fields?.get(offset);
  return <>
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtTech"
      text={points === undefined ? '' : String(points)} data-home-pet-skill-points={points} />
    {([['txtLife', 0x2c], ['txtCritical', 0x34], ['txtLucky', 0x3c]] as const).map(([name, offset]) =>
      <SourceStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
        className="home-pet-owned-number" text={value(offset) === undefined ? '' : String(value(offset))}
        data-home-pet-owned-field={offset} data-owned-value={value(offset)} />)}
    {Array.from({length: 6}, (_, index) => {
      const skillId = value(0x44 + index * 4);
      const level = value(0x5c + index * 4);
      const currentSkillId = skillId !== undefined && level !== undefined
        ? skillId + Math.max(0, level - 1) : undefined;
      const skill = currentSkillId ? catalog?.skills.find(definition => definition.skillId === currentSkillId) : undefined;
      const button = `btnViewSkill${index}`;
      return <span key={index} className="home-pet-owned-skill" data-home-pet-skill={index}
        data-skill-id={skillId} data-skill-level={level}>
        <SourceButton ui={ui} layout={layout} suffix={suffix} source={button}
          data-home-pet-view-skill={index} aria-label={`查看技能：${skill?.name ?? ''}`}
          disabled={busy || !skill || level === undefined || instanceId === undefined}
          onClick={() => {if (instanceId !== undefined) setSelected({owner: instanceId, index});}} />
        <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={`txtSkillName${index}`}
          text={skill?.name ?? ''} title={skill?.info} />
        <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={`txtSkillLevel${index}`}
          text={skillId && level !== undefined ? String(level) : ''} />
      </span>;
    })}
    <div {...sourceProps(ui, layout, suffix, 'edtPetDesc')} className="home-pet-owned-description"
      data-home-pet-owned-description=""
      data-description-source={description === undefined ? 'unavailable' : 'original-pet-table'}
      role="region" aria-label="拥有宠物介绍"
      tabIndex={description ? 0 : -1}>{description ?? ''}</div>
    {selectedSkill && selectedLevel !== undefined && <PetSkillSourceView ui={ui} skill={selectedSkill}
      level={selectedLevel} quote={quote} nextSkill={nextSkill} busy={busy} status={status}
      learn={quote && learn ? () => learn(quote.instanceId, quote.slot) : undefined} close={() => setSelected(undefined)} />}
  </>;
}
