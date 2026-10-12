import type {AwardType, ResultPlayer} from '../../../../shared/protocols';
import {sourceProps} from '../resources/source-ui-props';
import {SUMMARY_ART} from './battle-summary-artwork';
import {imageResourceUrl} from '../../assets/image-cache';
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

export function summaryMetricHeading(mode: number) {
  return [
    {control: 'DestroyTank', label: '摧毁坦克数'},
    {control: 'Bunker', label: '对碉堡伤害'},
    {control: 'VIPHurt', label: '对VIP伤害'},
    {control: 'DestroyTank', label: '摧毁坦克数'},
    {control: 'DestroyItem', label: '破坏地物数'},
  ][mode - 1];
}

export function SummaryOutcome({ui, layout, outcome}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; outcome?: ResultPlayer['outcome'];
}) {
  const outcomeImage = outcome === 'WIN' ? 'picWin' : outcome === 'LOSE' ? 'picLose' : outcome === 'DRAW' ? 'picDraw' : undefined;
  if (!outcomeImage) return null;
  const props = sourceProps(ui, layout, SUFFIX, outcomeImage);
  if (outcome === 'DRAW') return <span {...props} className="battle-summary-draw battle-summary-outcome-entry"
    aria-label="平局" data-summary-outcome={outcome}>DRAW</span>;
  return <img {...props} src={imageResourceUrl(`${SUMMARY_ART}/${outcome!.toLowerCase()}.png`)} alt={outcome === 'WIN' ? '胜利' : '失败'}
    className="battle-summary-picture battle-summary-outcome-entry" draggable={false} data-summary-outcome={outcome}/>;
}

/** The nine source award banners share picAward; only real recipients enter the ceremony. */
export function SummaryCeremony({ui, layout, type, players}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; type: AwardType; players: readonly ResultPlayer[];
}) {
  const award = SUMMARY_AWARDS.find(award => award.type === type)!;
  const recipients = players.filter(player => player.awards?.some(entry => entry.type === type));
  return <div className="battle-summary-ceremony" role="status" data-summary-ceremony={type}>
    <span {...sourceProps(ui, layout, SUFFIX, 'picAwardIcon')}
      className="battle-summary-award-art battle-summary-award-animation" aria-hidden="true">
      <img src={imageResourceUrl(`${SUMMARY_ART}/award-${award.type}.png`)} alt="" draggable={false}/>
      <span className="battle-summary-award-art-label">{award.name}奖</span>
    </span>
    <span {...sourceProps(ui, layout, SUFFIX, 'picShowPrize')} className="battle-summary-prize-intro">现在颁发</span>
    <span {...sourceProps(ui, layout, SUFFIX, award.control)} className="battle-summary-prize-name">{award.name}奖</span>
    <span className="battle-summary-recipients">{award.name}奖：{recipients.map(player => player.name).join('、')}</span>
  </div>;
}
