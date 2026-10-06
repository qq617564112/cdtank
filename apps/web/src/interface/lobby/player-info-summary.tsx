import {useEffect, useState} from 'react';
import type {ResPlayerProfile} from '../../../../shared/protocols/PtlPlayerProfile';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const BATTLE_SUFFIX = 'myhome_playerpage_battlesummary.xml';
const AWARD_SUFFIX = 'myhome_playerpage_awardsummary.xml';
const BATTLE_FIELDS = [
  {control: 'txtWinCount', key: 'wins'}, {control: 'txtLoseCount', key: 'losses'},
  {control: 'txtDrawCount', key: 'draws'}, {control: 'txtComboWinCount', key: 'winStreak'},
  {control: 'txtComboLoseCount', key: 'loseStreak'}, {control: 'txtHitCount', key: 'hits'},
  {control: 'txtShootCount', key: 'shots'}, {control: 'txtMaxComboCount', key: 'killCombo'},
  {control: 'txtDestroyCount', key: 'kills'}, {control: 'txtBeDestroyCount', key: 'deaths'},
  {control: 'txtTotalDamage', key: 'damage'}, {control: 'txtTotalDays', key: 'totalDays'},
  {control: 'txtTotalTime', key: 'totalTime'}, {control: 'txtHitRate', key: 'hitRate'},
] as const;
const AWARD_FIELDS: Partial<Record<string, keyof NonNullable<ResPlayerProfile['awards']>>> = {
  txtPerfect: 'perfect', txtMVP: 'mvp', txtSavage: 'savage', txtConsole: 'console', txtBrave: 'brave',
  txtKind: 'kind', txtCrafty: 'crafty', txtShy: 'shy', txtGreedy: 'greedy',
};
type BattleField = typeof BATTLE_FIELDS[number]['key'];
type BattleValues = Partial<Record<BattleField, string>>;

function awardValue(profile: ResPlayerProfile | undefined, control: string): string {
  if (!profile?.awards) return '';
  const field = AWARD_FIELDS[control];
  const value = field === undefined ? undefined : profile.awards[field];
  return value === undefined ? '' : String(value);
}

function battleValues(profile?: ResPlayerProfile): BattleValues {
  const stats = profile?.statistics;
  if (!stats) return {};
  const value = (input: number | undefined) => input === undefined ? undefined : String(input);
  const hitRate = stats.shots === undefined || stats.hits === undefined
    ? undefined : stats.shots === 0 ? '0%' : `${Math.round((stats.hits / stats.shots) * 100)}%`;
  return {
    wins: String(stats.wins), losses: String(stats.losses), draws: String(stats.draws),
    winStreak: String(stats.winStreak), loseStreak: String(stats.loseStreak),
    hits: value(stats.hits), shots: value(stats.shots),
    kills: String(stats.kills), deaths: String(stats.deaths),
    damage: value(stats.damage), killCombo: value(stats.killCombo),
    totalDays: String(Math.floor(stats.battleSeconds / 86400)),
    totalTime: String(Math.floor((stats.battleSeconds % 86400) / 3600)),
    hitRate,
  };
}

function useSummaryUi(suffix: string) {
  const [ui, setUi] = useState<HomeSourceUi>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setUi(undefined);
    setError('');
    void fetch('/ui.json').then(async response => {
      if (!response.ok) throw new Error(`界面资源 ${response.status}`);
      const next = await response.json() as HomeSourceUi;
      if (!next.layouts.some(layout => layout.path.endsWith(suffix))) throw new Error(`统计布局缺失：${suffix}`);
      if (active) setUi(next);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {active = false;};
  }, [suffix, attempt]);
  return {ui, error, retry: () => setAttempt(value => value + 1)};
}

/** Read-only target statistics rendered from the two existing Home source sheets. */
export function PlayerInfoSummary({mode, profile}: {
  mode: 'battle' | 'award';
  profile?: ResPlayerProfile;
}) {
  const suffix = mode === 'battle' ? BATTLE_SUFFIX : AWARD_SUFFIX;
  const {ui, error, retry} = useSummaryUi(suffix);
  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  const controls = ui?.layouts.find(value => value.path.endsWith(suffix))?.windows ?? [];
  const battle = mode === 'battle' ? battleValues(profile) : {};
  return <section className="player-info-summary" data-player-info-summary={mode}
    data-player-info-summary-account={profile?.accountId} aria-label={mode === 'battle' ? '玩家战斗统计' : '玩家奖章'}>
    {ui && layout ? <>
      {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
        <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix}
          name={control.name} aria-hidden="true"/>)}
      <SourceImageScale value={1}>
        {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control => {
          const field = BATTLE_FIELDS.find(value => value.control === control.name)?.key;
          const text = mode === 'battle' ? field === undefined ? '' : battle[field] ?? ''
            : awardValue(profile, control.name);
          return <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix}
            name={control.name} text={text}/>;
        })}
      </SourceImageScale>
    </> : error ? <div className="player-info-summary-error" role="status" aria-live="polite">
      <SourceFeedbackText text="统计界面资源加载失败" />
      <button type="button" onClick={retry}><SourceFeedbackText text="重试" /></button>
    </div> : undefined}
    {profile?.level !== undefined && <div className="player-info-summary-level" data-player-info-summary-level="">
      <SourceFeedbackText text={`等级 ${profile.level}`} />
    </div>}
  </section>;
}
