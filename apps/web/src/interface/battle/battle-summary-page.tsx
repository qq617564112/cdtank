import './battle-summary-page.css';
import {useContext, useEffect, useRef, useState} from 'react';
import type {ResultAward, ResultPlayer} from '../../../../shared/protocols';
import {BattleSummaryAwardPage} from './battle-summary-award-page';
import {BattleSummaryEquipmentPage, type EquipmentGrant} from './battle-summary-equipment-page';
import {BattleSummaryTitlePage} from './battle-summary-title-page';
import {SUMMARY_AWARDS, SummaryCeremony, SummaryHeadings, SummaryOutcome, summaryMetric} from './battle-summary-presentation';
import {summaryGrowth, summaryScore, useSummarySequence} from './battle-summary-sequence';
import {useSummaryAudio, useSummarySoundCues} from './battle-summary-audio';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage, SourceImageScale} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {loadUiFont} from '../resources/source-ui-fonts';
import {loadSourceUi} from '../resources/source-ui-resources';
import {SourceProgress} from '../resources/source-progress';
import {SourceNumericText} from '../resources/source-text-artwork';

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
const LEFT_PICTURES = ['shangbuditu', 'daditu1', 'lantiao', 'picCatTeam', 'picCatScore'];
const RIGHT_PICTURES = ['shangbuditu2', 'daditu2', 'lantiao2', 'picDogTeam', 'picDogScore'];
const BOTTOM_PICTURES = ['shangbutiao', 'lantiao3', 'lantiao4', 'xiaobufenditu', 'jiejitubiaoditu', 'xiabuditu1'];
const awardIcon = (icon: string) => `set:fenshujiesuan0 image:data\\ui\\fenshujiesuan\\${icon}`;

/** Source result icons come from jiejitubiao; every level beyond the catalog stays blank. */
function levelReference(ui: HomeSourceUi, level: number): string | undefined {
  const name = `data\\ui\\jiejitubiao\\lv${String(level).padStart(2, '0')}.tga`;
  const present = ui.imagesets.some(set => set.attributes.Name === 'jiejitubiao0'
    && set.images.some(image => image.Name === name));
  return present ? `set:jiejitubiao0 image:${name}` : undefined;
}

/** Original prgExp shares source tiling and display-pixel clipping with the battle bars. */
function SummaryExp({ui, layout, expPercent}: {ui: HomeSourceUi; layout: HomeSourceLayout; expPercent: number}) {
  const scale = useContext(SourceImageScale);
  const control = layout.control('prgExp');
  const bounds = sourceProps(ui, layout, SUFFIX, 'prgExp', control.properties.BackgroundImage);
  const percent = Math.max(0, Math.min(100, expPercent));
  return <SourceProgress {...bounds} control={control} data={ui} scale={scale} fraction={percent / 100}
    className="battle-summary-exp" aria-label="成长进度"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-summary-exp={expPercent} />;
}

/** UI-19 growth band consumes the current segment of the authoritative before/after balances. */
function SummaryGrowth({ui, layout, award, elapsed}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; award: ResultAward; elapsed: number;
}) {
  const growth = summaryGrowth(award, elapsed);
  const tile = levelReference(ui, growth.level);
  return <>
    <SummaryExp ui={ui} layout={layout} expPercent={growth.percent} />
    <SourceStaticText ui={ui} layout={layout} suffix={SUFFIX} name="txtExpPercent"
      className="battle-summary-exp-percent" text={`${growth.percent}%`}
      data-summary-exp-percent={growth.percent} />
    {tile && <SourceStaticImage key={`level:${growth.level}`} ui={ui} layout={layout} suffix={SUFFIX} name="picLv"
      reference={tile} className={`battle-summary-level${growth.pulse ? ' battle-summary-award-pulse' : ''}`} aria-hidden="true"
      data-summary-level={growth.level} />}
    {growth.change !== 0 && <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX}
      name={growth.change > 0 ? 'picLevelUp' : 'picLevelDown'}
      className="battle-summary-level-change" aria-hidden="true"
      data-summary-level-change={growth.change} />}
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
    void loadUiFont().catch(() => {});
    void Promise.all([loadSourceUi(), import('../../render/battle-notice-vector-geometry')]).then(([resources]) => {
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
  const rowPlace = (source: string, row: string) => {
    const child = place(source), parent = place(row);
    return {...child, style: {...child.style, left: Number(child.style.left) - Number(parent.style.left),
      top: Number(child.style.top) - Number(parent.style.top)}};
  };
  return <section className="battle-summary-viewport" aria-label="对局结算"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <SourceImageScale value={scale}><div ref={stage} className="battle-summary-stage" style={{zoom: scale}}
      data-battle-summary-page="" data-summary-round={props.round}
      data-summary-stage={fadedRound === props.round ? 'done' : sequence.stage} aria-busy={!ui}>
      {ui && <>
        {(['Cat', 'Dog'] as const).map((team, side) => <div key={`${props.round}:${team}`}
          className={`battle-summary-part battle-summary-part-${side === 0 ? 'left' : 'right'}`}>
          {(side === 0 ? LEFT_PICTURES : RIGHT_PICTURES).filter(name => !individual || !['picCatTeam', 'picDogTeam'].includes(name))
            .map(name => <SourceStaticImage key={name} ui={ui} layout={layout!} suffix={SUFFIX}
              name={name} className="battle-summary-picture" aria-hidden="true" />)}
          <SummaryHeadings ui={ui} layout={layout!} mode={props.mode} team={team} />
        </div>)}
        <div key={`${props.round}:bottom`} className="battle-summary-part battle-summary-part-bottom">
          {BOTTOM_PICTURES.map(name => <SourceStaticImage key={name} ui={ui} layout={layout!} suffix={SUFFIX}
            name={name} className="battle-summary-picture" aria-hidden="true" />)}
          {award && <SummaryGrowth ui={ui} layout={layout!} award={award} elapsed={sequence.growthElapsed} />}
        </div>
        {sequence.outcomeVisible && <SummaryOutcome key={`${props.round}:outcome`} ui={ui} layout={layout!} outcome={own?.outcome} />}
        {(['Cat', 'Dog'] as const).flatMap((teamName, team) => {
          const players = individual ? ranked.slice(page * 12 + team * 6, page * 12 + team * 6 + 6) : ranked.filter(player => player.team === team).slice(page * 6, page * 6 + 6);
          return Array.from({length: 6}, (_, row) => {
            const name = `${teamName}Player${row}`, player = players[row];
            return <div key={`${props.round}-${name}`} {...place(name)}
              className={`battle-summary-row battle-summary-row-${team === 0 ? 'left' : 'right'}`}
              style={{...place(name).style, animationDelay: `${700 + row * 300}ms`}} hidden={!player}
              title={player ? `第${player.rank}名 · 总分 ${player.totalScore} · 结局加分 ${player.outcomeBonus} · 击毁 ${player.kills} / 死亡 ${player.deaths} · 目标 ${player.objectivesDestroyed}` : undefined}
              data-summary-slot={name} data-summary-player={player?.id} data-summary-team={player?.team ?? team}
              data-summary-rank={player?.rank} data-summary-self={player ? String(player.id === props.playerId) : undefined}>
              <SourceStaticImage ui={ui} layout={layout!} suffix={SUFFIX} name={name}
                reference={player?.id === props.playerId ? layout!.control('lusetiao1').properties.Image : undefined}
                offsetX={-Number(place(name).style.left)} offsetY={-Number(place(name).style.top)}
                className="battle-summary-picture" aria-hidden="true" />
              {player && <>
                {player.petId !== undefined && <SourceStaticImage ui={ui} layout={layout!} suffix={SUFFIX}
                  name={`pic${teamName}Icon${row}`}
                  reference={`set:fenshujiesuan0 image:data\\ui\\fenshujiesuan\\${player.petId}_${player.outcome === 'WIN' ? `yeah_${portraitFrame}` : 'die'}.tga`}
                  offsetX={-Number(place(name).style.left)} offsetY={-Number(place(name).style.top)}
                  className="battle-summary-picture" role="img" aria-label={`${player.name}的宠物头像`}
                  data-summary-pet={player.petId} data-summary-portrait-frame={player.outcome === 'WIN' ? portraitFrame : undefined} />}
                <span {...rowPlace(`txt${teamName}PlayerName${row}`, name)} className="battle-summary-name"
                  title={player.name} data-summary-name="">{player.name}</span>
                <span {...rowPlace(`txt${teamName}Score${row}`, name)} className="battle-summary-number"
                  data-summary-combat=""><SourceNumericText font="ScoreHT"
                    text={String(summaryScore(player, props.results, sequence.scoreElapsed, revealedAwards))}/></span>
                <span {...rowPlace(`txt${teamName}Extra${row}`, name)} className="battle-summary-number"
                  data-summary-metric=""><SourceNumericText font="ScoreHT" text={String(summaryMetric(props.mode, player))}/></span>
                <span className="battle-summary-stats" data-summary-total={player.totalScore}>
                  第{player.rank}名 · 总分 {player.totalScore} · 结局加分 {player.outcomeBonus} · 击毁 {player.kills} / 死亡 {player.deaths} · 目标 {player.objectivesDestroyed}
                </span>
                {SUMMARY_AWARDS.filter(award => revealedAwards.has(award.type)
                  && player.awards?.some(entry => entry.type === award.type)).slice(0, 5)
                  .map((award, cell) => <SourceStaticImage key={award.type} ui={ui} layout={layout!} suffix={SUFFIX}
                    name={`pic${teamName}Award${row}_${cell}`} reference={awardIcon(award.icon)}
                    offsetX={-Number(place(name).style.left)} offsetY={-Number(place(name).style.top)}
                    className={`battle-summary-row-award${currentAward?.type === award.type ? ' battle-summary-award-pulse' : ''}`}
                    role="img" title={award.name} aria-label={`奖章：${award.name}`}
                    data-summary-award={award.type} />)}
              </>}
            </div>;
          });
        })}
        {currentAward && <SummaryCeremony key={currentAward.type} ui={ui} layout={layout!}
          type={currentAward.type} players={props.results} />}
        {award && (sequence.stage === 'rewards' || sequence.stage === 'notices') && fadedRound !== props.round
          && <div className={`battle-summary-reward-layer${fading ? ' battle-summary-reward-fade' : ''}`}>
            <BattleSummaryAwardPage ui={ui} award={award} />
          </div>}
        <SourceButton ui={ui} layout={layout!} suffix={SUFFIX} source="btnClose" disabled={props.pending || !props.hasLocalPlayer}
          aria-label="继续，返回原房间" data-summary-continue="" onClick={props.returnToRoom} />
      </>}
      <h1 className={`battle-summary-title${own ? ' battle-summary-accessible' : ''}`}>{props.title}</h1>
      {individual && <span className="battle-summary-individual">个人排名</span>}
      {pageCount > 1 && <nav className="battle-summary-pagination" aria-label="结算名单分页">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page + 1}/{pageCount}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>下一页</button>
      </nav>}
      <p className="battle-summary-objective battle-summary-accessible">{props.objective}</p>
      <output className="battle-summary-status" role="status">{error || audio.error || props.status || (!ui ? '载入结算…' : '')}</output>
      {!ui && <button type="button" className="battle-summary-loading-continue"
        disabled={props.pending || !props.hasLocalPlayer} onClick={props.returnToRoom}>继续，返回原房间</button>}
    </div></SourceImageScale>
    {ui && currentTitle && <BattleSummaryTitlePage key={`${props.round}:${titleIndex}`} ui={ui}
        title={currentTitle} scale={scale} close={() => setTitleIndex(index => index + 1)}
        origin={() => stage.current?.querySelector<HTMLButtonElement>('[data-summary-continue]') ?? null} />}
    {ui && currentEquipment && <BattleSummaryEquipmentPage key={`${props.round}:equipment:${equipmentIndex}`} ui={ui}
        grant={currentEquipment} scale={scale} close={() => setEquipmentIndex(index => index + 1)}
        origin={() => stage.current?.querySelector<HTMLButtonElement>('[data-summary-continue]') ?? null} />}
  </section>;
}
