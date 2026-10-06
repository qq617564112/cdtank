import {SourceStaticImage} from '../resources/source-static-image';
import {SourceButton} from '../resources/source-button';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

type HomePage = 'player' | 'pet' | 'tank';

/** The shared myhome sheet surrounds the source player and owned-role pages. */
export function HomeSourceRoot({ui, page, busy, selectPage, close, closeAttribute}: {
  ui: HomeSourceUi; page: HomePage; busy: boolean; selectPage: (page: HomePage) => void;
  close: () => void; closeAttribute: 'data-home-close' | 'data-roles-close' | 'data-equipment-close';
}) {
  const layout = new HomeSourceLayout(ui, 'myhome.xml');
  return <>
    {['anniuditu', 'zkb', 'hongsexiaodi', 'youbiandaditu'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={layout} suffix="myhome.xml" name={name}
        className="home-root-picture" aria-hidden="true" />)}
    {(['player', 'pet', 'tank'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={layout} suffix="myhome.xml"
        source={['rdoPlayerPage', 'rdoPetPage', 'rdoTankPage'][index]} selected={page === kind}
        {...(kind !== 'player' ? {'data-role-tab': kind} : {})}
        aria-label={['关于我', '宠物', '战车'][index]} aria-pressed={page === kind}
        disabled={busy} onClick={() => selectPage(kind)} />)}
    <SourceButton ui={ui} layout={layout} suffix="myhome.xml" source="btnClose"
      {...{[closeAttribute]: ''}} aria-label="返回大厅" onClick={close} />
  </>;
}
