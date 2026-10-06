import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText as SourceStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Original player sheet regions around the confirmed inventory and account name. */
export function HomePlayerSourcePage({ui, name, money, tokens, itemQuantity, playerSummary, growth, valuableMode = false, valuableQuantity, title}: {
  ui: HomeSourceUi; name: string; money?: number; tokens?: number; itemQuantity?: number; playerSummary?: ResRoleProfile['playerSummary'];
  growth?: ResRoleProfile['growth'];
  valuableMode?: boolean; valuableQuantity?: number; title?: string;
}) {
  const suffix = 'myhome_playerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'zhongjianheseditu', 'tankecanshuqu', 'tankeshengjiqu',
    'heseditu2', 'shuliangtiao2', 'jinqiantiao', 'daibitiao', 'daibitubiao',
    'jinqiantubiao2', 'jinqian2', 'xingbi', 'heseditu', 'shuliangditu',
    'zhutu', 'chaotiaodi',
  ];
  return <>
    {pictures.filter(source => !valuableMode || !['heseditu', 'shuliangditu', 'zhutu'].includes(source)).map(source => <SourceStaticImage key={source} ui={ui} layout={layout}
      suffix={suffix} name={source} className="home-player-source-picture" aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtPlayerName" text={name} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtPlayerTitle" text={title ?? ''}
      data-home-player-title={title ?? ''} data-source-title-binding={title ? 'confirmed-title' : 'no-confirmed-title'} />
    {([['score', 'rankPoints', 'txtPlayerScore'], ['originality', 'originality', 'txtPlayerOriginality'], ['tech', 'tech', 'txtPlayerTech']] as const).map(([field, growthField, source]) => {
      const value = growth === undefined ? playerSummary?.[field] : growth[growthField];
      const binding = growth === undefined ? playerSummary === undefined ? 'unavailable' : 'confirmed-role-profile' : 'confirmed-account-growth';
      return <SourceStaticText key={field} ui={ui} layout={layout} suffix={suffix} name={source}
        text={value === undefined ? '' : String(value)}
        data-home-player-profile-number={field} data-profile-binding={binding}
        className="home-player-profile-number" />;
    })}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoney"
      text={money === undefined ? '' : String(money)} data-confirmed-money={money} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtCoin"
      text={tokens === undefined ? '' : String(tokens)} data-confirmed-tokens={tokens} />
    {valuableMode ? <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtValuableQuantity"
      text={valuableQuantity === undefined ? '' : String(valuableQuantity)} data-confirmed-valuable-quantity={valuableQuantity} />
      : <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtItemQuantity"
        text={itemQuantity === undefined ? '' : String(itemQuantity)} data-confirmed-item-quantity={itemQuantity} />}
  </>;
}
