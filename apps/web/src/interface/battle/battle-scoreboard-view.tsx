import './battle-scoreboard-view.css';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {useSourceUi} from '../lobby/source-react';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {imageResourceUrl} from '../../assets/image-cache';
import type {BattleHud, SourceUi} from './battle-hud';
import type {ScoreboardPlayer, ScoreboardSnapshot} from './battle-scoreboard';

const SUFFIX = 'game_summary.xml';
const PICTURES = ['shangbuditu', 'daditu1', 'lantiao', 'shangbuditu2', 'daditu2', 'lantiao2',
  'picCatScore', 'picDogScore', 'shangbutiao', 'lantiao3', 'lantiao4', 'xiaobufenditu', 'xiabuditu1'];

export function BattleScoreboardView({hud}: {hud: BattleHud}) {
  const state = useSyncExternalStore(hud.scoreboard.subscribe, hud.scoreboard.getSnapshot);
  return state ? <Scoreboard key={`${state.roomId}:${state.round}`} state={state}/> : null;
}

function Scoreboard({state}: {state: ScoreboardSnapshot}) {
  const [held, setHeld] = useState(false);
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const {ui, error} = useSourceUi(true, [SUFFIX]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Tab' && event.key !== 'Tab') return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.repeat) return;
      setHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Tab' || event.key === 'Tab') setHeld(false);
    };
    const hide = () => setHeld(false);
    const visibility = () => {if (document.hidden) hide();};
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const individual = state.mode > 3;
  const ranked = [...state.players].sort((left, right) => {
    const primary = state.mode === 4 ? right.kills - left.kills
      : state.mode === 5 ? right.objectivesDestroyed - left.objectivesDestroyed : right.score - left.score;
    return primary || right.score - left.score || right.kills - left.kills || left.deaths - right.deaths;
  });
  const teams = [0, 1].map(team => ranked.filter(player => player.team === team));
  const pages = Math.max(1, individual ? Math.ceil(ranked.length / 12)
    : Math.max(...teams.map(players => Math.ceil(players.length / 6))));
  const currentPage = Math.min(page, pages - 1);
  const layout = ui ? new HomeSourceLayout(ui, SUFFIX) : undefined;
  const resources = ui as SourceUi | undefined;
  const place = (name: string) => sourceProps(ui!, layout!, SUFFIX, name);
  const rowPlace = (name: string, row: string) => sourceProps(ui!, layout!, SUFFIX, name,
    undefined, -Number(place(row).style.left), -Number(place(row).style.top));
  const stats = (player: ScoreboardPlayer) =>
    `击毁 ${player.kills} · 死亡 ${player.deaths}${state.mode === 5 ? ` · 目标 ${player.objectivesDestroyed}` : ''}`;
  if (!held) return null;
  return <section className="battle-scoreboard-viewport" aria-label="战斗计分板" data-battle-scoreboard=""
    data-scoreboard-round={state.round} data-scoreboard-mode={state.mode}>
    <SourceImageScale value={scale}>
      <div className="battle-scoreboard-stage" style={{zoom: scale}} aria-busy={!ui}>
        {ui && <>
          {PICTURES.map(name => <SourceStaticImage key={name} ui={ui} layout={layout!} suffix={SUFFIX}
            name={name} aria-hidden="true"/>)}
          {!individual && ['picCatTeam', 'picDogTeam'].map(name => <SourceStaticImage key={name}
            ui={ui} layout={layout!} suffix={SUFFIX} name={name} aria-hidden="true"/>)}
          {(['Cat', 'Dog'] as const).map(side => <SourceStaticImage key={side} ui={ui}
            layout={layout!} suffix={SUFFIX} name={`pic${side}DestroyTank`}
            reference={state.mode === 5 ? layout!.control('picCatDestroyItem').properties.Image : undefined}
            aria-label={state.mode === 5 ? '摧毁物件数' : '击毁战车数'} role="img"/>)}
          {(['Cat', 'Dog'] as const).flatMap((side, team) => {
            const players = individual ? ranked.slice(currentPage * 12 + team * 6, currentPage * 12 + team * 6 + 6)
              : teams[team].slice(currentPage * 6, currentPage * 6 + 6);
            return players.map((player, row) => {
              const name = `${side}Player${row}`;
              const portrait = resources?.portraits.find(value => value.petId === player.petId)?.remoteAsset;
              const self = player.id === state.playerId;
              const origin = place(name);
              return <div key={player.id} {...origin} className="battle-scoreboard-row"
                data-scoreboard-player={player.id} data-scoreboard-self={self || undefined}
                data-scoreboard-alive={player.alive} aria-label={`${player.name}，得分 ${player.score}，${stats(player)}`}>
                <SourceStaticImage ui={ui} layout={layout!} suffix={SUFFIX} name={name}
                  reference={self ? layout!.control('lusetiao1').properties.Image : undefined}
                  offsetX={-Number(origin.style.left)} offsetY={-Number(origin.style.top)} aria-hidden="true"/>
                {portrait && <img {...rowPlace(`pic${side}Icon${row}`, name)} src={imageResourceUrl(`/${portrait}`)} alt=""/>}
                <span {...rowPlace(`txt${side}PlayerName${row}`, name)} className="battle-scoreboard-name"
                  title={player.name}>{player.name}</span>
                <span {...rowPlace(`txt${side}Score${row}`, name)} className="battle-scoreboard-number"
                  data-scoreboard-score={player.score}>{Math.trunc(player.score)}</span>
                <span {...rowPlace(`txt${side}Extra${row}`, name)} className="battle-scoreboard-number"
                  data-scoreboard-kills={player.kills} data-scoreboard-objectives={player.objectivesDestroyed}>
                  {state.mode === 5 ? player.objectivesDestroyed : player.kills}</span>
                <span className="battle-scoreboard-deaths" data-scoreboard-deaths={player.deaths}>{player.deaths}</span>
              </div>;
            });
          })}
        </>}
        <h1 className="battle-scoreboard-title">{individual ? '个人计分板' : '战斗计分板'}</h1>
        <p className="battle-scoreboard-subtitle">第 {state.round} 局 · 实时战况</p>
        {[0, 1].map(team => <span key={team} className="battle-scoreboard-death-heading"
          style={{left: team === 0 ? 322 : 718}}>死亡</span>)}
        <p className="battle-scoreboard-hint">{error || (!ui ? '正在载入计分板…' : '按住 Tab 查看 · 松开返回战斗')}</p>
        {pages > 1 && <nav className="battle-scoreboard-pagination" aria-label="计分板分页"
          onPointerDown={event => event.preventDefault()}>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
          <span>{currentPage + 1}/{pages}</span>
          <button type="button" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>下一页</button>
        </nav>}
      </div>
    </SourceImageScale>
  </section>;
}
