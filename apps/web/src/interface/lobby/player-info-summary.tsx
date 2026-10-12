import type {ResPlayerProfile} from '../../../../shared/protocols/PtlPlayerProfile';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {HomeBattleStatistics} from '../home/home-battle-summary-source-page';
import {HomeAwardSummarySourcePage} from '../home/home-award-summary-source-page';

/** Public statistics share the account page's table and award presentation. */
export function PlayerInfoSummary({mode, profile, ui}: {
  mode: 'battle' | 'award'; profile: ResPlayerProfile; ui: HomeSourceUi;
}) {
  return <section className="player-info-summary" data-player-info-summary={mode}
    data-player-info-summary-account={profile.accountId}
    aria-label={mode === 'battle' ? '玩家战斗统计' : '玩家奖章'}>
    {mode === 'battle' ? <HomeBattleStatistics statistics={profile.statistics}/>
      : <HomeAwardSummarySourcePage ui={ui} awards={profile.awards} style={{left: 0, top: -198}}/>}
  </section>;
}
