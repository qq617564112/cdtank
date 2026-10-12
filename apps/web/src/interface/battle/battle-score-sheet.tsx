import type {ComponentPropsWithoutRef, ReactNode} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {imageResourceUrl} from '../../assets/image-cache';
import {SUMMARY_TEAM_ART, SummaryPlate, SummaryPortrait, SummaryRowArtwork} from './battle-summary-artwork';
import './battle-score-sheet.css';

const SUFFIX = 'game_summary.xml';

export interface BattleScoreColumns {
  name: {left: number; width: number};
  score: {left: number; width: number};
  metric: {left: number; width: number};
  last: {left: number; width: number};
}

interface ScoreLayoutProps {
  ui: HomeSourceUi;
  layout: HomeSourceLayout;
  columns: BattleScoreColumns;
}

interface ScoreHeaders {
  metric?: {control: string; label: string};
  last: string;
}

function BattleScoreHeadings({ui, layout, columns, team, headers}: ScoreLayoutProps & {
  team: 'Cat' | 'Dog'; headers: ScoreHeaders;
}) {
  const row = sourceProps(ui, layout, SUFFIX, `${team}Player0`);
  const heading = (name: string, column: 'score' | 'metric' | 'last') => {
    const bounds = sourceProps(ui, layout, SUFFIX, name);
    return {...bounds, style: {...bounds.style,
      left: Number(row.style.left) + columns[column].left,
      top: Number(bounds.style.top) - 1.5, width: columns[column].width, height: 24}};
  };
  return <>
    <span {...heading(`pic${team}Score`, 'score')} className="battle-score-sheet-heading">获得积分</span>
    {headers.metric && <span {...heading(`pic${team}${headers.metric.control}`, 'metric')}
      className="battle-score-sheet-heading">{headers.metric.label}</span>}
    <span {...heading(`pic${team}Award`, 'last')} className="battle-score-sheet-heading">{headers.last}</span>
  </>;
}

/** The result page and live scoreboard share one sheet, with content supplied by their owners. */
export function BattleScoreSheet({ui, layout, columns, individual, headers, footer, children}: ScoreLayoutProps & {
  individual: boolean; headers: ScoreHeaders; footer?: ReactNode; children?: ReactNode;
}) {
  const place = (name: string) => sourceProps(ui, layout, SUFFIX, name);
  return <>
    {!footer && <SummaryPlate kind="body" style={{...place('daditu1').style,
      width: Number(place('daditu1').style.width) + Number(place('daditu2').style.width),
      height: Number(place('xiabuditu1').style.top) - Number(place('daditu1').style.top)}}/>}
    {(['Cat', 'Dog'] as const).map((team, side) => <div key={team}
      className={`battle-score-sheet-part battle-score-sheet-part-${side === 0 ? 'left' : 'right'}`}>
      <SummaryPlate kind={side === 0 ? 'top-left' : 'top-right'}
        style={place(side === 0 ? 'shangbuditu' : 'shangbuditu2').style}/>
      {footer && <SummaryPlate kind="body" edge={side === 0 ? 'left' : 'right'}
        style={place(side === 0 ? 'daditu1' : 'daditu2').style}/>}
      {!individual && <img {...place(`pic${team}Team`)} className="battle-score-sheet-team-portrait"
        src={imageResourceUrl(SUMMARY_TEAM_ART[team])} alt="" aria-hidden="true" draggable={false}/>}
      <BattleScoreHeadings ui={ui} layout={layout} columns={columns} team={team} headers={headers}/>
    </div>)}
    <div className="battle-score-sheet-part battle-score-sheet-part-bottom">
      {footer ? <>
        <SummaryPlate kind="body" style={place('shangbutiao').style}/>
        <SummaryPlate kind="bottom" style={{...place('xiaobufenditu').style,
          height: Number(place('xiaobufenditu').style.height) + Number(place('xiabuditu1').style.height)}}/>
      </> : <SummaryPlate kind="bottom-ribbon" style={place('xiabuditu1').style}/>}
      {footer}
    </div>
    {children}
  </>;
}

/** Source child positions stay relative to the player strip, including award icons. */
export function battleScoreRowProps(ui: HomeSourceUi, layout: HomeSourceLayout, name: string, row: string) {
  const parent = sourceProps(ui, layout, SUFFIX, row);
  return sourceProps(ui, layout, SUFFIX, name, undefined, -Number(parent.style.left), -Number(parent.style.top));
}

/** Player rows share portraits, cells, column dividers and native source geometry. */
export function BattleScorePlayerRow({ui, layout, columns, source, self, name, portrait,
  score, metric, last, children, className = '', style, ...props}: ScoreLayoutProps &
  ComponentPropsWithoutRef<'div'> & {
    source: string; self: boolean; name: string;
    portrait?: {petId: number; outcome: string; frame: number};
    score: ReactNode; metric: ReactNode; last?: ReactNode;
  }) {
  const team = source.startsWith('Cat') ? 'Cat' : 'Dog';
  const row = source.slice(`${team}Player`.length);
  const bounds = sourceProps(ui, layout, SUFFIX, source);
  const cell = (name: string, column: 'name' | 'score' | 'metric') => {
    const bounds = battleScoreRowProps(ui, layout, name, source);
    return {...bounds, style: {...bounds.style, ...columns[column], height: column === 'name' ? 44 : 24}};
  };
  return <div {...bounds} {...props} className={`battle-score-sheet-row ${className}`}
    style={{...bounds.style, ...style}}>
    <SummaryRowArtwork self={self} dividers={[columns.score.left - 2, columns.metric.left - 4, columns.last.left - 4]}/>
    {portrait && <SummaryPortrait {...portrait}
      style={battleScoreRowProps(ui, layout, `pic${team}Icon${row}`, source).style} name={name}/>}
    <span {...cell(`txt${team}PlayerName${row}`, 'name')} className="battle-score-sheet-name"
      title={name} data-summary-name={name ? '' : undefined}>{name}</span>
    <span {...cell(`txt${team}Score${row}`, 'score')} className="battle-score-sheet-number">{score}</span>
    <span {...cell(`txt${team}Extra${row}`, 'metric')} className="battle-score-sheet-number">{metric}</span>
    {last !== undefined && <span className="battle-score-sheet-last" style={columns.last}>{last}</span>}
    {children}
  </div>;
}
