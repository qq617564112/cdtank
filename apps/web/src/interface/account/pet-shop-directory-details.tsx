import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import {useEffect, useState} from 'react';
import type {CombatCatalog, CombatSkillDefinition} from '../../../../shared/combat/catalog';
import {SourceButton} from '../resources/source-button';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {PetSkillSourceView} from '../home/pet-skill-source-view';
import {PET_SHOP_MASTERY} from './pet-shop-mastery';
import {sourceProps} from '../resources/source-ui-props';
import {PET_SHOP_DIRECTORY_DETAILS} from './pet-shop-directory-metadata';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';

/** Directory information for a product confirmed by the current shop query. */
export function PetShopDirectoryDetails({ui, petId, mode = 'directory', ownedRecord}: {
  ui: HomeSourceUi; petId: number; mode?: 'directory' | 'owned'; ownedRecord?: OwnedRoleRecordData;
}) {
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [opened, setOpened] = useState<{skill: CombatSkillDefinition; level: number}>();
  useEffect(() => {
    let active = true;
    void fetch('/combat-catalog.json').then(response => {
      if (!response.ok) throw new Error('技能目录载入失败');
      return response.json() as Promise<CombatCatalog>;
    }).then(value => {if (active) setCatalog(value);}).catch(() => {});
    return () => {active = false;};
  }, []);
  const fields = mode === 'owned' && ownedRecord ? new Map(ownedRecord.fields) : undefined;
  const ownedSkillIdentity = JSON.stringify(ownedRecord?.fields.filter(([offset]) => offset === 0 || offset >= 0x44 && offset <= 0x70));
  useEffect(() => {setOpened(undefined);}, [petId, mode, ownedSkillIdentity]);
  const details = PET_SHOP_DIRECTORY_DETAILS[petId];
  if (!details && mode === 'directory') return null;
  const skills = mode === 'owned' ? Array.from({length: 6}, (_, index) => {
    const base = fields?.get(0x44 + index * 4), level = fields?.get(0x5c + index * 4);
    const id = base !== undefined && level !== undefined ? base + Math.max(0, level - 1) : undefined;
    const definition = id ? catalog?.skills.find(value => value.skillId === id) : undefined;
    return {id, level, name: definition?.name ?? ''};
  }) : details!.skills;
  const suffix = 'shop_petpage.xml', layout = new HomeSourceLayout(ui, suffix);
  return <SourceImageScale value={1}>
    {(['Critical', 'Lucky'] as const).map(name => <SourceStaticText key={name}
      ui={ui} layout={layout} suffix={suffix} name={`txt${name}`} className="pet-shop-directory-text"
      text={mode === 'owned'
        ? fields?.has(name === 'Critical' ? 0x34 : 0x3c) ? String(fields.get(name === 'Critical' ? 0x34 : 0x3c)) : ''
        : details ? String(name === 'Critical' ? details.critical : details.lucky) : ''} data-pet-directory-attribute={name} />)}
    {skills.map((skill, index) => <span key={index} className="pet-shop-directory-skill"
      data-pet-directory-skill={index} data-pet-shop-skill-binding={mode === 'owned' ? 'confirmed-owned-base-rank' : 'pet-table-directory'} data-skill-id={skill.id} data-skill-level={skill.level}>
      <SourceButton ui={ui} layout={layout} suffix={suffix} source={`btnViewSkill${index}`}
        data-pet-shop-skill-open={index} aria-label={`查看${skill.name}技能详情`}
        disabled={skill.level === undefined || !catalog?.skills.some(value => value.skillId === skill.id)}
        onClick={() => {
          const definition = catalog?.skills.find(value => value.skillId === skill.id);
          if (definition && skill.level !== undefined) setOpened({skill: definition, level: skill.level});
        }} />
      <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={`txtSkillName${index}`} text={skill.name} />
      <SourceStaticText ui={ui} layout={layout} suffix={suffix} name={`txtSkillLevel${index}`}
        text={skill.name && skill.level !== undefined ? String(skill.level) : ''} />
    </span>)}
    <div {...sourceProps(ui, layout, suffix, 'tankecanshuqu')} className="pet-shop-mastery-values"
      data-pet-shop-mastery="" data-mastery-binding="original-pet-table-directory">
      {(PET_SHOP_MASTERY[petId] ?? []).map((value, index) => <span key={index}
        data-mastery-index={index} data-mastery-value={value}
        style={{left: index % 2 ? 184 : 77, top: index < 2 ? 37 : 63}}>
        <SourceFeedbackText text={String(value)} />
      </span>)}
    </div>
    {opened && <PetSkillSourceView ui={ui} skill={opened.skill} level={opened.level}
      binding={mode === 'owned' ? 'web-confirmed-owned-skill' : 'web-confirmed-directory-skill'} close={() => setOpened(undefined)} />}
  </SourceImageScale>;
}
