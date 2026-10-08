import {rankedPetSkillId} from '../../../../shared/content/catalog';
import {loadCombatCatalog} from '../../content';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import {loadStaticJson} from '../../assets/static-resources';
import {useEffect, useState} from 'react';
import type {CombatCatalog, CombatSkillDefinition} from '../../../../shared/combat/catalog';
import {SourceButton} from '../resources/source-button';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {PetSkillSourceView} from '../home/pet-skill-source-view';
import {petOwnedMastery, petShopMastery} from './pet-shop-mastery';
import {sourceProps} from '../resources/source-ui-props';
import {petShopDirectoryDetails} from './pet-shop-directory-metadata';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';

/** Owned mastery progress controls in the original STank/MTank/LTank/Stug order. */
const OWNED_MASTERY_PROGRESS = [
  {name: 'prgLightTank', label: '轻型坦克熟练度'},
  {name: 'prgMediumTank', label: '中型坦克熟练度'},
  {name: 'prgHeavyTank', label: '重型坦克熟练度'},
  {name: 'prgCruiser', label: '巡洋坦克熟练度'},
] as const;

/** Directory information for a product confirmed by the current shop query. */
export function PetShopDirectoryDetails({ui, petId, mode = 'directory', ownedRecord, profile, currentTank}: {
  ui: HomeSourceUi; petId: number; mode?: 'directory' | 'owned'; ownedRecord?: OwnedRoleRecordData;
  profile?: {bytes: number[]}; currentTank?: OwnedRoleRecordData;
}) {
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [opened, setOpened] = useState<{skill: CombatSkillDefinition; level: number}>();
  useEffect(() => {
    let active = true;
    void loadCombatCatalog()
      .then(value => {if (active) setCatalog(value);}).catch(() => {});
    return () => {active = false;};
  }, []);
  const fields = mode === 'owned' && ownedRecord ? new Map(ownedRecord.fields) : undefined;
  const ownedSkillIdentity = JSON.stringify(ownedRecord?.fields.filter(([offset]) => offset === 0 || offset >= 0x44 && offset <= 0x70));
  useEffect(() => {setOpened(undefined);}, [petId, mode, ownedSkillIdentity]);
  const details = petShopDirectoryDetails(petId);
  if (!details && mode === 'directory') return null;
  const currentPetInstance = profile ? new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0xa4, true) : undefined;
  const selectedInstance = ownedRecord ? new Map(ownedRecord.fields).get(0) : undefined;
  const ownedMastery = mode === 'owned' ? petOwnedMastery({selectedBase: ownedRecord, currentTank,
    isCurrent: currentPetInstance !== undefined && currentPetInstance === selectedInstance, catalog}) : undefined;
  const skills = mode === 'owned' ? Array.from({length: 6}, (_, index) => {
    const base = fields?.get(0x44 + index * 4), level = fields?.get(0x5c + index * 4);
    const id = base !== undefined && level !== undefined ? rankedPetSkillId(base, Math.max(1, level)) : undefined;
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
      data-pet-shop-mastery="" data-mastery-binding={mode === 'owned' ? 'web-confirmed-owned-aggregate' : 'original-pet-table-directory'}>
      {(mode === 'owned' ? ownedMastery?.mastery ?? [] : petShopMastery(petId)).map((value, index) => <span key={index}
        data-mastery-index={index} data-mastery-value={value}
        style={{left: index % 2 ? 184 : 77, top: index < 2 ? 37 : 63}}>
        <SourceFeedbackText text={String(value)} />
      </span>)}
    </div>
    {mode === 'owned' && ownedMastery && OWNED_MASTERY_PROGRESS.map(({name, label}, index) => {
      const control = layout.control(name);
      const bounds = sourceProps(ui, layout, suffix, name, control.properties.BackgroundImage);
      const fill = sourceProps(ui, layout, suffix, name, control.properties.ProgressImage);
      const value = ownedMastery.mastery[index]!, fraction = Math.max(0, Math.min(1, ownedMastery.progress[index]!));
      const width = Number(bounds.style.width), height = Number(bounds.style.height);
      const extent = Math.floor(width * fraction + .5);
      return <div key={name} {...bounds} className="pet-shop-mastery-progress"
        data-pet-shop-mastery-progress={name} data-mastery-value={value} data-mastery-fraction={ownedMastery.progress[index]}
        role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(5, value)} aria-valuenow={value}>
        <span aria-hidden="true" style={{position: 'absolute', inset: 0, width, height,
          clipPath: `inset(0 ${width - extent}px 0 0)`, backgroundImage: fill.style.backgroundImage,
          backgroundSize: '100% 100%'}} />
      </div>;
    })}
    {opened && <PetSkillSourceView ui={ui} skill={opened.skill} level={opened.level}
      binding={mode === 'owned' ? 'web-confirmed-owned-skill' : 'web-confirmed-directory-skill'} close={() => setOpened(undefined)} />}
  </SourceImageScale>;
}
