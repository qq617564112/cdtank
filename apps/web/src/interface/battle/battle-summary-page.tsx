import './battle-summary-page.css';
import {useEffect, useRef, useState} from 'react';
import type {ResultAward, ResultPlayer} from '../../../../shared/protocols';
import {BattleSummaryAwardPage} from './battle-summary-award-page';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage, SourceImageScale} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';

export interface BattleSummaryPageProps {
  results: readonly ResultPlayer[];
  playerId: string;
  round: number;
  mode: number;
  title: string;
  objective: string;
  status: string;
  pending: boolean;
  voted: boolean;
  hasLocalPlayer: boolean;
  requestRematch(): void;
  leave(): void;
}
const SUFFIX = 'game_summary.xml';
const PICTURES = ['shangbuditu', 'daditu1', 'lantiao', 'picCatTeam', 'picCatScore',
  'shangbuditu2', 'daditu2', 'lantiao2', 'picDogTeam', 'picDogScore',
  'shangbutiao', 'lantiao3', 'lantiao4', 'xiaobufenditu', 'jiejitubiaoditu', 'xiabuditu1'];

/** Source result icons come from jiejitubiao; every level beyond the catalog stays blank. */
function levelReference(ui: HomeSourceUi, level: number): string | undefined {
  const name = `data\\ui\\jiejitubiao\\lv${String(level).padStart(2, '0')}.tga`;
  const present = ui.imagesets.some(set => set.attributes.Name === 'jiejitubiao0'
    && set.images.some(image => image.Name === name));
  return present ? `set:jiejitubiao0 image:${name}` : undefined;
}

/** Original prgExp bar: the source background plus the ProgressImage clipped to authority percent. */
function SummaryExp({ui, layout, expPercent}: {ui: HomeSourceUi; layout: HomeSourceLayout; expPercent: number}) {
  const properties = layout.control('prgExp').properties;
  const bounds = sourceProps(ui, layout, SUFFIX, 'prgExp', properties.BackgroundImage);
  const fill = sourceProps(ui, layout, SUFFIX, 'prgExp', properties.ProgressImage);
  const percent = Math.max(0, Math.min(100, expPercent));
  return <span {...bounds} className="battle-summary-exp" role="progressbar" aria-label="成长进度"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-summary-exp={expPercent}>
    <i className="battle-summary-exp-fill" data-source-asset={fill['data-source-asset']}
      style={{backgroundImage: fill.style.backgroundImage, clipPath: `inset(0 ${100 - percent}% 0 0)`}} />
  </span>;
}

/** UI-19 growth band; level change direction and tile are derived from the authoritative before/after levels. */
function SummaryGrowth({ui, layout, award}: {ui: HomeSourceUi; layout: HomeSourceLayout; award: ResultAward}) {
  const tile = levelReference(ui, award.levelAfter);
  return <>
    <SummaryExp ui={ui} layout={layout} expPercent={award.expPercent} />
    <SourceStaticText ui={ui} layout={layout} suffix={SUFFIX} name="txtExpPercent"
      className="battle-summary-exp-percent" text={`${award.expPercent}%`}
      data-summary-exp-percent={award.expPercent} />
    {tile && <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="picLv"
      reference={tile} className="battle-summary-level" aria-hidden="true"
      data-summary-level={award.levelAfter} />}
    {award.levelAfter > award.levelBefore && <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX}
      name="picLevelUp" className="battle-summary-level-change" aria-hidden="true" data-summary-level-up="" />}
    {award.levelAfter < award.levelBefore && <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX}
      name="picLevelDown" className="battle-summary-level-change" aria-hidden="true" data-summary-level-down="" />}
  </>;
}

/** Original two-team sheet; live match results remain current Web score projections. */
export function BattleSummaryPage(props: BattleSummaryPageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [ui, setUi] = useState<HomeSourceUi>();
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [awardOpen, setAwardOpen] = useState(false);
  const awardShownRound = useRef<number | null>(null);
  const individual = props.mode > 3;
  const ranked = [...props.results].sort((a, b) => a.rank - b.rank);
  const pageCount = individual ? Math.ceil(ranked.length / 12) : Math.max(...[0, 1].map(team => Math.ceil(ranked.filter(p => p.team === team).length / 6)), 1);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    const controller = new AbortController();
    let live = true;
    void Promise.all([fetch('/ui.json', {signal: controller.signal}), loadSourceUiFonts()]).then(async ([response]) => {
      if (!response.ok) throw new Error('结算界面资源载入失败');
      const resources = await response.json() as HomeSourceUi;
      if (!resources.layouts.some(page => page.path.endsWith(SUFFIX))) throw new Error('原结算布局缺失');
      if (live) setUi(resources);
    }).catch(reason => {if (live) setError(String(reason));});
    return () => {live = false; controller.abort(); window.removeEventListener('resize', resize);};
  }, []);
  const layout = ui ? new HomeSourceLayout(ui, SUFFIX) : undefined;
  const award = props.results.find(player => player.id === props.playerId)?.award;
  useEffect(() => {
    if (!award || awardShownRound.current === props.round) return;
    awardShownRound.current = props.round;
    setAwardOpen(true);
  }, [award, props.round]);
  const place = (source: string) => sourceProps(ui!, layout!, SUFFIX, source);
  const closeAward = () => setAwardOpen(false);
  const rowPlace = (source: string, row: string) => {
    const child = place(source), parent = place(row);
    return {...child, style: {...child.style, left: Number(child.style.left) - Number(parent.style.left),
      top: Number(child.style.top) - Number(parent.style.top)}};
  };
  return <section className="battle-summary-viewport" aria-label="对局结算"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <SourceImageScale value={scale}><div ref={stage} className="battle-summary-stage" style={{zoom: scale}}
      data-battle-summary-page="" data-summary-round={props.round} aria-busy={!ui}>
      {ui && <>
        {PICTURES.filter(name => !individual || !['picCatTeam', 'picDogTeam'].includes(name)).map(name => <SourceStaticImage key={name} ui={ui} layout={layout!} suffix={SUFFIX}
          name={name} className="battle-summary-picture" aria-hidden="true" />)}
        {(['Cat', 'Dog'] as const).flatMap((teamName, team) => {
          const players = individual ? ranked.slice(page * 12 + team * 6, page * 12 + team * 6 + 6) : ranked.filter(player => player.team === team).slice(page * 6, page * 6 + 6);
          return Array.from({length: 6}, (_, row) => {
            const name = `${teamName}Player${row}`, player = players[row];
            return <div key={`${props.round}-${name}`} className="battle-summary-row" {...place(name)}
              data-summary-slot={name} data-summary-player={player?.id} data-summary-team={player?.team ?? team}
              data-summary-rank={player?.rank} data-summary-self={player ? String(player.id === props.playerId) : undefined}>
              <SourceStaticImage ui={ui} layout={layout!} suffix={SUFFIX} name={name}
                offsetX={-Number(place(name).style.left)} offsetY={-Number(place(name).style.top)}
                className="battle-summary-picture" aria-hidden="true" />
              {player && <>
                <span {...rowPlace(`txt${teamName}PlayerName${row}`, name)} className="battle-summary-name"
                  title={player.name} data-summary-name="">{player.name}</span>
                <span {...rowPlace(`txt${teamName}Score${row}`, name)} className="battle-summary-number"
                  data-summary-combat="">{player.combatScore}</span>
                <span {...rowPlace(`txt${teamName}Extra${row}`, name)} className="battle-summary-number"
                  data-summary-bonus="">{player.outcomeBonus}</span>
                <span className="battle-summary-stats" data-summary-total={player.totalScore}>
                  第{player.rank}名 · 总分 {player.totalScore}<br/>击毁 {player.kills} / 死亡 {player.deaths}<br/>目标 {player.objectivesDestroyed}
                </span>
              </>}
            </div>;
          });
        })}
        {award && <SummaryGrowth ui={ui} layout={layout!} award={award} />}
        <SourceButton ui={ui} layout={layout!} suffix={SUFFIX} source="btnClose" disabled={props.pending}
          aria-label="退出房间返回大厅" data-summary-leave="" onClick={props.leave} />
      </>}
      <h1 className="battle-summary-title">{props.title}</h1>
      {individual && <span className="battle-summary-individual">个人排名</span>}
      {pageCount > 1 && <nav className="battle-summary-pagination" aria-label="结算名单分页">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page + 1}/{pageCount}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>下一页</button>
      </nav>}
      <p className="battle-summary-objective">{props.objective}</p>
      {[0, 1].map(team => <span key={team} className="battle-summary-extra-heading"
        style={{left: team === 0 ? 239 : 631}}>结局加分</span>)}
      <output className="battle-summary-status" role="status">{error || props.status || (!ui ? '载入结算…' : '')}</output>
      <button className="battle-summary-rematch" type="button" data-rematch=""
        disabled={props.pending || props.voted || !props.hasLocalPlayer} onClick={props.requestRematch}>
        {props.pending ? '正在提交…' : props.voted ? '已确认再战' : '确认再战'}
      </button>
      {!ui && <button type="button" className="battle-summary-loading-leave" onClick={props.leave}>返回大厅</button>}
    </div></SourceImageScale>
    {ui && award && awardOpen && <BattleSummaryAwardPage ui={ui} award={award} close={closeAward}
      origin={() => stage.current?.querySelector<HTMLButtonElement>('[data-summary-leave]') ?? null} />}
  </section>;
}
