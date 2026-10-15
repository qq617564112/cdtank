import type {ReactNode} from 'react';
import type {AwardType, ResultPlayer} from '../../../../shared/protocols';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';
import {imageResourceUrl} from '../../assets/image-cache';
import {SUMMARY_ART, SUMMARY_TEAM_ART, SummaryPlate, SummaryPortrait, SummaryRowArtwork} from './battle-summary-artwork';
import {SUMMARY_AWARDS, SummaryOutcome, summaryMetric, summaryMetricHeading} from './battle-summary-presentation';
import {summaryScore, type SummarySequence} from './battle-summary-sequence';
import './mobile-summary-sheet.css';

interface MobileSummarySheetProps {
  ui: HomeSourceUi;
  layout: HomeSourceLayout;
  results: readonly ResultPlayer[];
  playerId: string;
  mode: number;
  title: string;
  size: {width: number; height: number};
  rowsPerColumn: number;
  page: number;
  portraitFrame: number;
  sequence: SummarySequence;
  revealedAwards: ReadonlySet<AwardType>;
  currentAward?: AwardType;
  footer: ReactNode;
}

/** Native phone dimensions keep original result artwork in independently arranged regions. */
export function MobileSummarySheet({ui, layout, results, playerId, mode, title, size,
  rowsPerColumn, page, portraitFrame, sequence, revealedAwards, currentAward, footer}: MobileSummarySheetProps) {
  const individual = mode > 3;
  const own = results.find(player => player.id === playerId);
  return <div className="mobile-summary-sheet">
    <div className="mobile-summary-background" aria-hidden="true">
      <SummaryPlate kind="top-left" style={{left: 0, top: 0, width: '50%', height: 78}}
        className="battle-score-sheet-part-left"/>
      <SummaryPlate kind="top-right" style={{left: '50%', top: 0, width: '50%', height: 78}}
        className="battle-score-sheet-part-right"/>
      <SummaryPlate kind="body" style={{left: 0, top: 78, width: size.width, height: size.height - 78}}/>
      <SummaryPlate kind="bottom" style={{left: 0, top: size.height - 78, width: size.width, height: 78}}
        className="battle-score-sheet-part-bottom"/>
    </div>
    <header className="mobile-summary-header">
      <h1>{title}</h1>
      {sequence.outcomeVisible && <SummaryOutcome ui={ui} layout={layout} outcome={own?.outcome}/>}
    </header>
    <div className="mobile-summary-columns">
      {(['Cat', 'Dog'] as const).map((teamName, team) => {
        const players = individual
          ? results.slice(page * rowsPerColumn * 2 + team * rowsPerColumn,
            page * rowsPerColumn * 2 + (team + 1) * rowsPerColumn)
          : results.filter(player => player.team === team).slice(page * rowsPerColumn, (page + 1) * rowsPerColumn);
        return <section key={teamName} className="mobile-summary-column"
          aria-label={individual ? `排名第 ${page * rowsPerColumn * 2 + team * rowsPerColumn + 1} 名起`
            : `${teamName === 'Cat' ? '猫' : '狗'}队结算`}>
          <div className="mobile-summary-headings" aria-hidden="true">
            <span>{!individual && <img src={imageResourceUrl(SUMMARY_TEAM_ART[teamName])} alt="" draggable={false}/>}
              玩家 / 奖章</span>
            <span>积分</span>
            <span>{summaryMetricHeading(mode)?.label ?? '战绩'}</span>
          </div>
          <div className="mobile-summary-roster" role="list" aria-label="玩家成绩">
            {players.map((player, row) => <div key={player.id} className={`mobile-summary-player battle-summary-row-${team === 0 ? 'left' : 'right'}`}
              role="listitem" data-summary-player={player.id} data-summary-slot={`${teamName}Player${row}`}
              data-summary-rank={player.rank} data-summary-team={player.team}
              data-summary-self={String(player.id === playerId)} style={{animationDelay: `${700 + row * 300}ms`}}>
              <SummaryRowArtwork self={player.id === playerId} dividers={[239.32, 301.08, 384]}/>
              {player.petId !== undefined ? <SummaryPortrait petId={player.petId} outcome={player.outcome}
                frame={portraitFrame} style={{}} name={player.name}/> : <span/>}
              <div className="mobile-summary-name">
                <span title={player.name} data-summary-name="">{player.rank}. {player.name}</span>
                <div className="mobile-summary-awards">
                  {SUMMARY_AWARDS.filter(award => revealedAwards.has(award.type)
                    && player.awards?.some(entry => entry.type === award.type)).slice(0, 5).map(award =>
                    <span key={award.type} className={`mobile-summary-award${currentAward === award.type ? ' battle-summary-award-pulse' : ''}`}
                      role="img" aria-label={`奖章：${award.name}`} title={`${award.name}奖`} data-summary-award={award.type}>
                      <img src={imageResourceUrl(`${SUMMARY_ART}/award-${award.type}.png`)} alt="" draggable={false}/>
                    </span>)}
                </div>
              </div>
              <span className="mobile-summary-number battle-pixel-number" data-summary-combat="">
                {summaryScore(player, results, sequence.scoreElapsed, revealedAwards)}
              </span>
              <span className="mobile-summary-number battle-pixel-number" data-summary-metric="">{summaryMetric(mode, player)}</span>
            </div>)}
          </div>
        </section>;
      })}
    </div>
    <footer className="mobile-summary-footer">{footer}</footer>
  </div>;
}
