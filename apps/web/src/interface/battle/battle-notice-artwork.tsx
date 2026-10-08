import {useEffect, useState, type ComponentPropsWithoutRef} from 'react';
import {decodeImage} from '../../assets/image-resources';
import {imageResourceUrl} from '../../assets/image-cache';
import type {BattleVectorShape} from '../../render/battle-screen-vectors';

/** Original images remain in the modal's stacking and animation container. */
export function BattleNoticeArtwork({name, style, ...props}: {
  name: string;
} & ComponentPropsWithoutRef<'span'>) {
  const [resource, setResource] = useState<{name: string; shape: BattleVectorShape}>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    void import('../../render/battle-notice-vector-geometry').then(async ({BATTLE_NOTICE_VECTORS}) => {
      const shape = BATTLE_NOTICE_VECTORS[name];
      if (!shape) throw new Error(`战斗提示图片资源缺失：${name}`);
      await decodeImage(`/${shape.asset}`);
      if (active) setResource({name, shape});
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {active = false;};
  }, [name]);
  const shape = resource?.name === name ? resource.shape : undefined;
  return <span {...props} data-hud-renderer="source-image" data-battle-notice={name}
    style={{display: 'block', ...style}}>
    {shape && <img src={imageResourceUrl(`/${shape.asset}`)} alt="" aria-hidden="true" draggable={false}
      style={{display: 'block', width: '100%', height: '100%', pointerEvents: 'none'}} />}
    {error && <output role="status">{error}</output>}
  </span>;
}
