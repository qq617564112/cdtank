import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import {HomeSourceSurface as SourceStaticImage} from './home-surface';
import {HomeStaticText as SourceStaticText} from './home-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {HomePlayerProfileBackground, HomeScoreStar, HomeShortcutPanel} from './home-player-artwork';

/** Original player sheet regions around the confirmed inventory and account name. */
export function HomePlayerSourcePage({ui, name, money, tokens, playerSummary, growth, valuableMode = false, title}: {
  ui: HomeSourceUi; name: string; money?: number; tokens?: number; itemQuantity?: number; playerSummary?: ResRoleProfile['playerSummary'];
  growth?: ResRoleProfile['growth'];
  valuableMode?: boolean; valuableQuantity?: number; title?: string;
}) {
  const suffix = 'myhome_playerpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'daibitubiao', 'jinqiantubiao2', 'jinqian2', 'xingbi', 'chaotiaodi',
  ];
  return <>
    <HomePlayerProfileBackground ui={ui}/>
    <HomeShortcutPanel valuableMode={valuableMode}/>
    <HomeScoreStar/>
    {pictures.map(source => <SourceStaticImage key={source} ui={ui} layout={layout}
      suffix={suffix} name={source} className="home-player-source-picture" aria-hidden="true" />)}
    {[['用户名', 7], ['称号', 35], ['创意点', 63], ['技能点', 91], ['积分', 119]].map(([label, top]) =>
      <span key={label} className="home-profile-label" data-profile-label={label} style={{top: 44 + Number(top)}}>{label}</span>)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtPlayerName" text={name}
      style={{left: 318, top: 51, width: 107, height: 20}}/>
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtPlayerTitle" text={title ?? ''}
      style={{height: 20}}
      data-home-player-title={title ?? ''} data-source-title-binding={title ? 'confirmed-title' : 'no-confirmed-title'} />
    {([['score', 'rankPoints', 'txtPlayerScore', 163], ['originality', 'originality', 'txtPlayerOriginality', 107], ['tech', 'tech', 'txtPlayerTech', 135]] as const).map(([field, growthField, source, top]) => {
      const value = growth === undefined ? playerSummary?.[field] : growth[growthField];
      const binding = growth === undefined ? playerSummary === undefined ? 'unavailable' : 'confirmed-role-profile' : 'confirmed-account-growth';
      return <SourceStaticText key={field} ui={ui} layout={layout} suffix={suffix} name={source}
        style={{top, height: 20}}
        text={value === undefined ? '' : String(value)}
        data-home-player-profile-number={field} data-profile-binding={binding}
        className="home-player-profile-number" />;
    })}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoney"
      text={money === undefined ? '' : String(money)} data-confirmed-money={money} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtCoin"
      text={tokens === undefined ? '' : String(tokens)} data-confirmed-tokens={tokens} />
  </>;
}
