import {HomeSourceButton as SourceButton} from './home-source-button';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceSurface, HomeSurfacePanel} from './home-surface';

type HomePage = 'player' | 'pet' | 'tank';

/** The shared myhome sheet surrounds the source player and owned-role pages. */
export function HomeSourceRoot({ui, page, busy, selectPage, close, closeAttribute, inventoryTab = 'weapon'}: {
  ui: HomeSourceUi; page: HomePage; busy: boolean; selectPage: (page: HomePage) => void;
  close: () => void; closeAttribute: 'data-home-close' | 'data-roles-close' | 'data-equipment-close';
  inventoryTab?: 'weapon' | 'item' | 'valuable';
}) {
  const layout = new HomeSourceLayout(ui, 'myhome.xml');
  const tabs = {weapon: {left: 0, width: 66}, item: {left: 66, width: 66}, valuable: {left: 129, width: 79}};
  const leftTab = page === 'player' ? tabs[inventoryTab]
    : closeAttribute === 'data-equipment-close' ? {left: 71, width: 103} : {left: 0, width: 66};
  const rightTab = {player: {left: 0, width: 79}, pet: {left: 92, width: 66}, tank: {left: 170, width: 66}}[page];
  return <>
    {['anniuditu', 'hongsexiaodi'].map(name =>
      <HomeSourceSurface key={name} ui={ui} layout={layout} suffix="myhome.xml" name={name}
        className="home-root-picture" aria-hidden="true" />)}
    <HomeSurfacePanel {...sourceProps(ui, layout, 'myhome.xml', 'zkb')}
      headerTab={{...leftTab, rise: 35}} className="home-root-picture"/>
    <HomeSurfacePanel {...sourceProps(ui, layout, 'myhome.xml', 'youbiandaditu')}
      headerTab={{...rightTab, rise: 34}} className="home-root-picture"/>
    {page === 'pet' && <SourceButton ui={ui} layout={new HomeSourceLayout(ui, 'myhome_petpage.xml')}
      suffix="myhome_petpage.xml" source="maogou" selected aria-label="猫狗"
      aria-pressed="true" aria-disabled="true" tabIndex={-1} />}
    {(['player', 'pet', 'tank'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={layout} suffix="myhome.xml"
        source={['rdoPlayerPage', 'rdoPetPage', 'rdoTankPage'][index]} selected={page === kind}
        {...(kind !== 'player' ? {'data-role-tab': kind} : {})}
        aria-label={['关于我', '宠物', '战车'][index]} aria-pressed={page === kind}
        disabled={busy} aria-busy={busy} onClick={() => selectPage(kind)} />)}
    <SourceButton ui={ui} layout={layout} suffix="myhome.xml" source="btnClose"
      {...{[closeAttribute]: ''}} aria-label="返回大厅" onClick={close} />
  </>;
}
