import {useEffect, useState} from 'react';
import {isMobileDevice} from '../../platform/device';
import {gamePageScale, mobilePageSize, subscribeGamePageViewport} from '../../platform/page-viewport';

/** Keep artwork scale fixed by height while wide phones gain content space. */
export function usePageLayout(mobileHeight = 540, desktopWidth = 800, desktopHeight = 600) {
  const calculate = () => {
    const size = isMobileDevice() ? mobilePageSize(mobileHeight)
      : {width: desktopWidth, height: desktopHeight};
    const scale = gamePageScale(size.width, size.height);
    return {...size, scale, viewport: {width: size.width * scale, height: size.height * scale},
      stage: {width: size.width, height: size.height, transform: `scale(${scale})`}};
  };
  const [layout, setLayout] = useState(calculate);
  useEffect(() => {
    const resize = () => setLayout(calculate());
    return subscribeGamePageViewport(resize);
  }, [mobileHeight, desktopWidth, desktopHeight]);
  return layout;
}
