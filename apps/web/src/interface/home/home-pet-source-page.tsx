import type {MouseEventHandler} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

interface HomePetSourcePageProps {
  ui: HomeSourceUi;
  name: string;
  money?: number;
  quantity?: number;
  alreadyUsed: boolean;
  canUse: boolean;
  selectedInstance?: number;
  use: MouseEventHandler<HTMLButtonElement>;
}

/** The original pet sheet surrounds the owned model with attributes and mastery regions. */
export function HomePetSourcePage({ui, name, money, quantity, alreadyUsed, canUse, selectedInstance, use}: HomePetSourcePageProps) {
  const suffix = 'myhome_petpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5', 'lblCritical', 'lblLucky',
    'huangtiao4', 'cemianzhuangjia', 'hangditu2', 'huangtiao6', 'lblHP',
    'tankecanshuqu', 'hangditu8', 'lblTank', 'ditu', 'shuliangditu', 'changtiao',
    'changtiao2', 'jinqiantubiao', 'jinqian', 'chuangyidiantubiao', 'chuangyidiantubiao2', 'maogou',
  ];
  return <>
    {pictures.map(source => <SourceStaticImage key={source} ui={ui} layout={layout}
      suffix={suffix} name={source} className="home-pet-source-picture" aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtPetName" text={name} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoney"
      text={money === undefined ? '' : String(money)} data-home-pet-money={money} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtListQuantity"
      text={quantity === undefined ? '' : String(quantity)} data-home-pet-quantity={quantity} />
    <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnUseMe"
      className="home-role-use home-pet-source-use" aria-label="选择宠物出击"
      disabled={!canUse} data-selected-instance={selectedInstance ?? ''} onClick={use} />
    {alreadyUsed && <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="picAlreadyUsed"
      className="home-pet-source-picture" aria-label="当前出击宠物" role="img"
      data-home-pet-already-used="" data-state-source="confirmed-profile-web-visibility" />}
  </>;
}
