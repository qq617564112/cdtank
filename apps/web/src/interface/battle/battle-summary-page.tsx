import {GameMessage} from '../resources/game-message';
import './battle-summary-page.css';
import {useEffect, useRef, useState} from 'react';
import type {ResultAward, ResultPlayer} from '../../../../shared/protocols';
import {BattleSummaryAwardPage} from './battle-summary-award-page';
import {BattleSummaryEquipmentPage, type EquipmentGrant} from './battle-summary-equipment-page';
import {BattleSummaryTitlePage} from './battle-summary-title-page';
import {SUMMARY_AWARDS, SummaryCeremony, SummaryOutcome, summaryMetric, summaryMetricHeading} from './battle-summary-presentation';
import {summaryGrowth, summaryScore, useSummarySequence} from './battle-summary-sequence';
import {useSummaryAudio, useSummarySoundCues} from './battle-summary-audio';
import {SUMMARY_ART, SUMMARY_COLUMNS, SUMMARY_TEAM_ART, SummaryContinueButton, SummaryPlate, SummaryProgress} from './battle-summary-artwork';
import {BattleScoreSheet, BattleScorePlayerRow, battleScoreRowProps} from './battle-score-sheet';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {loadSourceUi} from '../resources/source-ui-resources';
import {decodeImage} from '../../assets/image-resources';
import {imageResourceUrl} from '../../assets/image-cache';

export interface BattleSummaryPageProps {
  results: readonly ResultPlayer[];
  playerId: string;
  round: number;
  mode: number;
  title: string;
  objective: string;
  status: string;
  pending: boolean;
  hasLocalPlayer: boolean;
  soundVolume?: () => number | undefined;
  returnToRoom(): void;
}
const SUFFIX = 'game_summary.xml';
const SUMMARY_SCORE_COLUMNS = {
  name: SUMMARY_COLUMNS.name,
  score: SUMMARY_COLUMNS.score,
  metric: SUMMARY_COLUMNS.metric,
  last: SUMMARY_COLUMNS.awards,
};
const SUMMARY_IMAGES = [
  'win.png', 'lose.png', 'top-background.png', 'bottom-background.png',
  ...SUMMARY_AWARDS.map(award => `award-${award.type}.png`),
  ...[1, 2, 3, 4, 5, 101, 102, 103, 104, 105].flatMap(pet =>
    ['die', 'yeah_1', 'yeah_2'].map(pose => `pet-${pet}-${pose}.png`)),
];

/** Source result icons come from jiejitubiao; every level beyond the catalog stays blank. */
function levelReference(ui: HomeSourceUi, level: number): string | undefined {
  const name = `data\\ui\\jiejitubiao\\lv${String(level).padStart(2, '0')}.tga`;
  const icon = ui.imagesets.find(set => set.attributes.Name === 'jiejitubiao0')
    ?.images.find(image => image.Name === name);
  return icon?.asset ? `/${icon.asset}` : undefined;
}

/** UI-19 growth band consumes the current segment of the authoritative before/after balances. */
function SummaryGrowth({ui, layout, award, elapsed}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; award: ResultAward; elapsed: number;
}) {
  const growth = summaryGrowth(award, elapsed);
  const tile = levelReference(ui, growth.level);
  const place = (name: string) => sourceProps(ui, layout, SUFFIX, name);
  return <>
    <SummaryProgress style={place('prgExp').style} percent={growth.percent}/>
    <span {...place('txtExpPercent')} className="battle-summary-exp-percent battle-pixel-number"
      data-summary-exp-percent={growth.percent}>{growth.percent}%</span>
    {tile && <img key={`level:${growth.level}`} {...place('picLv')} src={imageResourceUrl(tile)} alt={`等级 ${growth.level}`}
      className={`battle-summary-level${growth.pulse ? ' battle-summary-award-pulse' : ''}`}
      data-summary-level={growth.level} draggable={false}/>}
    {growth.change !== 0 && <span {...place(growth.change > 0 ? 'picLevelUp' : 'picLevelDown')}
      className="battle-summary-level-change" data-summary-level-change={growth.change}>
      {growth.change > 0 ? 'Level Up!' : 'Level Down!'}
    </span>}
  </>;
}

/** Original two-team sheet consumes frozen result and committed account receipts. */
export function BattleSummaryPage(props: BattleSummaryPageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const audio = useSummaryAudio(props.soundVolume);
  const [resources, setUi] = useState<HomeSourceUi>();
  const ui = audio.ready ? resources : undefined;
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [titleIndex, setTitleIndex] = useState(0);
  const [equipmentIndex, setEquipmentIndex] = useState(0);
  const [fadedRound, setFadedRound] = useState<number>();
  const [portraitFrame, setPortraitFrame] = useState(1);
  const individual = props.mode > 3;
  const ranked = [...props.results].sort((a, b) => a.rank - b.rank);
  const pageCount = individual ? Math.ceil(ranked.length / 12) : Math.max(...[0, 1].map(team => Math.ceil(ranked.filter(p => p.team === team).length / 6)), 1);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    let live = true;
    void Promise.all([loadSourceUi(),
      Promise.all(SUMMARY_IMAGES.map(name => decodeImage(`${SUMMARY_ART}/${name}`))),
      Promise.all(Object.values(SUMMARY_TEAM_ART).map(url => decodeImage(url))),
      document.fonts.load("18px 'HappyZcool-2016'"),
      document.fonts.load("16px 'Silkscreen'"),
    ]).then(([resources]) => {
      if (!resources.layouts.some(page => page.path.endsWith(SUFFIX))) throw new Error('原结算布局缺失');
      if (live) setUi(resources);
    }).catch(reason => {if (live) setError(String(reason));});
    return () => {live = false; window.removeEventListener('resize', resize);};
  }, []);
  const layout = ui ? new HomeSourceLayout(ui, SUFFIX) : undefined;
  const own = props.results.find(player => player.id === props.playerId);
  const award = own?.award;
  const awarded = SUMMARY_AWARDS.filter(award => props.results.some(player =>
    player.awards?.some(entry => entry.type === award.type)));
  const rowCount = individual ? Math.min(6, ranked.length)
    : Math.min(6, Math.max(...[0, 1].map(team => ranked.filter(player => player.team === team).length)));
  const sequence = useSummarySequence(props.round, !!ui, rowCount, awarded.length, award);
  useEffect(() => {setTitleIndex(0); setEquipmentIndex(0); setPage(0); setFadedRound(undefined);}, [props.round]);
  useEffect(() => {
    if (!ui) return;
    setPortraitFrame(1);
    const timer = window.setInterval(() => setPortraitFrame(frame => frame === 1 ? 2 : 1), 500);
    return () => window.clearInterval(timer);
  }, [ui, props.round]);
  const currentAward = sequence.stage === 'awards' ? awarded[sequence.awardIndex] : undefined;
  const revealedAwards = new Set(awarded.slice(0, sequence.awardIndex + 1).map(award => award.type));
  const grantedTitles = award?.grantedTitles ?? [];
  const grantedEquipment: EquipmentGrant[] = [
    ...(award?.grantedItems ?? []).map(item => ({kind: 'item', item} as const)),
    ...(award?.grantedTanks ?? []).map(tank => ({kind: 'tank', tank} as const)),
  ];
  const notices = sequence.stage === 'notices';
  const currentTitle = notices && titleIndex < grantedTitles.length ? grantedTitles[titleIndex] : undefined;
  const currentEquipment = notices && !currentTitle && equipmentIndex < grantedEquipment.length
    ? grantedEquipment[equipmentIndex] : undefined;
  useSummarySoundCues(audio.sounds, !!ui, props.round, sequence,
    award ? summaryGrowth(award, sequence.growthElapsed).level : undefined, currentTitle?.id);
  const fading = notices && !currentTitle && !currentEquipment;
  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(() => setFadedRound(props.round), 1000);
    return () => window.clearTimeout(timer);
  }, [fading, props.round]);
  const place = (source: string) => sourceProps(ui!, layout!, SUFFIX, source);
  const rowPlace = (source: string, row: string) => battleScoreRowProps(ui!, layout!, source, row);
  return <section className="battle-summary-viewport" aria-label="对局结算"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <div ref={stage} className="battle-summary-stage battle-score-sheet-stage" style={{zoom: scale}}
      data-battle-summary-page="" data-summary-round={props.round}
      data-summary-stage={fadedRound === props.round ? 'done' : sequence.stage} aria-busy={!ui}>
      {ui && <>
        <BattleScoreSheet key={props.round} ui={ui} layout={layout!} columns={SUMMARY_SCORE_COLUMNS}
          individual={individual} headers={{metric: summaryMetricHeading(props.mode), last: '得奖'}}
          footer={<>
            <SummaryPlate kind="medallion" style={place('jiejitubiaoditu').style}/>
            {award && <SummaryGrowth ui={ui} layout={layout!} award={award} elapsed={sequence.growthElapsed} />}
          </>}>
          {sequence.outcomeVisible && <SummaryOutcome key={`${props.round}:outcome`} ui={ui} layout={layout!} outcome={own?.outcome} />}
          {(['Cat', 'Dog'] as const).flatMap((teamName, team) => {
            const players = individual ? ranked.slice(page * 12 + team * 6, page * 12 + team * 6 + 6) : ranked.filter(player => player.team === team).slice(page * 6, page * 6 + 6);
            return Array.from({length: 6}, (_, row) => {
              const name = `${teamName}Player${row}`, player = players[row];
              const rowAwards = SUMMARY_AWARDS.filter(award => revealedAwards.has(award.type)
                && player?.awards?.some(entry => entry.type === award.type)).slice(0, 5);
              return <BattleScorePlayerRow key={`${props.round}-${name}`} ui={ui} layout={layout!}
                columns={SUMMARY_SCORE_COLUMNS} source={name} self={player?.id === props.playerId}
                name={player?.name ?? ''}
                portrait={player?.petId !== undefined
                  ? {petId: player.petId, outcome: player.outcome, frame: portraitFrame} : undefined}
                score={player && <span data-summary-combat="">
                  {summaryScore(player, props.results, sequence.scoreElapsed, revealedAwards)}
                </span>}
                metric={player && <span data-summary-metric="">{summaryMetric(props.mode, player)}</span>}
                className={`battle-summary-row battle-summary-row-${team === 0 ? 'left' : 'right'}`}
                style={{animationDelay: `${700 + row * 300}ms`}} hidden={!player}
                title={player ? `第${player.rank}名 · 总分 ${player.totalScore} · 结局加分 ${player.outcomeBonus} · 击毁 ${player.kills} / 死亡 ${player.deaths} · 目标 ${player.objectivesDestroyed}` : undefined}
                data-summary-slot={name} data-summary-player={player?.id} data-summary-team={player?.team ?? team}
                data-summary-rank={player?.rank} data-summary-self={player ? String(player.id === props.playerId) : undefined}>
                {player && <>
                  <span className="battle-summary-stats" data-summary-total={player.totalScore}>
                    第{player.rank}名 · 总分 {player.totalScore} · 结局加分 {player.outcomeBonus} · 击毁 {player.kills} / 死亡 {player.deaths} · 目标 {player.objectivesDestroyed}
                  </span>
                  {rowAwards.map((award, cell) => <span key={award.type} {...rowPlace(`pic${teamName}Award${row}_${cell}`, name)}
                      className={`battle-summary-row-award${currentAward?.type === award.type ? ' battle-summary-award-pulse' : ''}`}
                      role="img" title={award.name} aria-label={`奖章：${award.name}`}
                      data-summary-award={award.type}>
                      <img src={imageResourceUrl(`${SUMMARY_ART}/award-${award.type}.png`)} alt="" draggable={false}/>
                      <span>{award.name}奖</span>
                    </span>)}
                </>}
              </BattleScorePlayerRow>;
            });
          })}
        </BattleScoreSheet>
        {currentAward && <SummaryCeremony key={currentAward.type} ui={ui} layout={layout!}
          type={currentAward.type} players={props.results} />}
        {award && (sequence.stage === 'rewards' || sequence.stage === 'notices') && fadedRound !== props.round
          && <div className={`battle-summary-reward-layer${fading ? ' battle-summary-reward-fade' : ''}`}>
            <BattleSummaryAwardPage ui={ui} award={award} />
          </div>}
        <SummaryContinueButton {...place('btnClose')} disabled={props.pending || !props.hasLocalPlayer}
          aria-label="继续，返回原房间" data-summary-continue="" onClick={props.returnToRoom}/>
      </>}
      <h1 className={`battle-summary-title${own ? ' battle-summary-accessible' : ''}`}>{props.title}</h1>
      {individual && <span className="battle-summary-individual">个人排名</span>}
      {pageCount > 1 && <nav className="battle-summary-pagination" aria-label="结算名单分页">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span className="battle-pixel-number">{page + 1}/{pageCount}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>下一页</button>
      </nav>}
      <p className="battle-summary-objective battle-summary-accessible">{props.objective}</p>
      <GameMessage text={error || audio.error || props.status}
        tone={error || audio.error ? 'error' : props.pending ? 'pending' : 'info'}/>
      {!ui && <button type="button" className="battle-summary-loading-continue"
        disabled={props.pending || !props.hasLocalPlayer} onClick={props.returnToRoom}>继续，返回原房间</button>}
    </div>
    {ui && currentTitle && <BattleSummaryTitlePage key={`${props.round}:${titleIndex}`} ui={ui}
        title={currentTitle} scale={scale} close={() => setTitleIndex(index => index + 1)}
        origin={() => stage.current?.querySelector<HTMLButtonElement>('[data-summary-continue]') ?? null} />}
    {ui && currentEquipment && <BattleSummaryEquipmentPage key={`${props.round}:equipment:${equipmentIndex}`} ui={ui}
        grant={currentEquipment} scale={scale} close={() => setEquipmentIndex(index => index + 1)}
        origin={() => stage.current?.querySelector<HTMLButtonElement>('[data-summary-continue]') ?? null} />}
  </section>;
}
