import type {AwardType, ResultPlayer} from '../../../../shared/protocols';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {BattleNoticeArtwork} from './battle-notice-artwork';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'game_summary.xml';
export const SUMMARY_AWARDS: readonly {type: AwardType; icon: string; name: string; control: string}[] = [
  {type: 'perfect', icon: 'perfect.tga', name: '完美', control: 'picPerfect'},
  {type: 'mvp', icon: 'mvp.tga', name: '优秀', control: 'picMVP'},
  {type: 'savage', icon: 'savage.tga', name: '残酷', control: 'picSavage'},
  {type: 'console', icon: 'console.tga', name: '悲情', control: 'picConsole'},
  {type: 'brave', icon: 'brave.tga', name: '勇猛', control: 'picBrave'},
  {type: 'kind', icon: 'kind.tga', name: '慈悲', control: 'picKind'},
  {type: 'crafty', icon: 'crafty.tga', name: '狡猾', control: 'picCrafty'},
  {type: 'shy', icon: 'shy.tga', name: '腼腆', control: 'picShy'},
  {type: 'greedy', icon: 'greedy.tga', name: '贪婪', control: 'picGreedy'},
];

/** Original 0..4 modes select DestroyTank, Bunker, VIPHurt, DestroyTank, DestroyItem. */
export function summaryMetric(mode: number, player: ResultPlayer): string {
  if (mode === 1 || mode === 4) return String(player.kills);
  if (mode === 3) return player.roundStats?.vipDamage === undefined ? '—' : String(player.roundStats.vipDamage);
  if (mode === 2) return player.roundStats?.bunkerDamage === undefined ? '—' : String(player.roundStats.bunkerDamage);
  if (mode === 5) return String(player.objectivesDestroyed);
  return '—';
}

export function SummaryHeadings({ui, layout, mode, team}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; mode: number; team: 'Cat' | 'Dog';
}) {
  const metric = ['DestroyTank', 'Bunker', 'VIPHurt', 'DestroyTank', 'DestroyItem'][mode - 1];
  return <>
    {[metric && `pic${team}${metric}`, `pic${team}Award`]
      .filter((name): name is string => !!name).map(name => <SourceStaticImage key={name} ui={ui}
        layout={layout} suffix={SUFFIX} name={name}
        reference={name === 'picDogDestroyItem' ? layout.control('picCatDestroyItem').properties.Image : undefined}
        className="battle-summary-picture" aria-hidden="true" />)}
  </>;
}

export function SummaryOutcome({ui, layout, outcome}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; outcome?: ResultPlayer['outcome'];
}) {
  const outcomeImage = outcome === 'WIN' ? 'picWin' : outcome === 'LOSE' ? 'picLose' : outcome === 'DRAW' ? 'picDraw' : undefined;
  if (!outcomeImage) return null;
  const props = sourceProps(ui, layout, SUFFIX, outcomeImage, layout.control(outcomeImage).properties.Image);
  return <BattleNoticeArtwork {...props} name={outcomeImage} style={{...props.style, backgroundImage: 'none'}}
    className="battle-summary-picture battle-summary-outcome-entry" role="img"
    aria-label={outcome === 'WIN' ? '胜利' : outcome === 'LOSE' ? '失败' : '平局'}
    data-summary-outcome={outcome} />;
}

/** The nine source award banners share picAward; only real recipients enter the ceremony. */
export function SummaryCeremony({ui, layout, type, players}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; type: AwardType; players: readonly ResultPlayer[];
}) {
  const award = SUMMARY_AWARDS.find(award => award.type === type)!;
  const recipients = players.filter(player => player.awards?.some(entry => entry.type === type));
  return <div className="battle-summary-ceremony" role="status" data-summary-ceremony={type}>
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="picAwardIcon"
      reference={`set:jiangxiang0 image:data\\ui\\jiangxiang\\${award.icon}`}
      className="battle-summary-picture battle-summary-award-animation" aria-hidden="true" />
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="picAward"
      className="battle-summary-picture" aria-hidden="true" />
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="picShowPrize"
      className="battle-summary-picture" aria-hidden="true" />
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name={award.control}
      className="battle-summary-picture" aria-hidden="true" />
    <span className="battle-summary-recipients">{award.name}奖：{recipients.map(player => player.name).join('、')}</span>
  </div>;
}
