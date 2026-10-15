import {useEffect, useLayoutEffect, useState} from 'react';
import {pageImages, uiSpriteScope, type ImageLoadingProgress} from '../../assets/preload-images';
import type {UiSpriteScope} from '../../assets/sprite-images';

/** Unmount old page consumers before switching and preparing the next independent UI package. */
export function usePageImages(battleActive: boolean, battleLoading: boolean) {
  const selected = uiSpriteScope(battleActive);
  const [readyScope, setReadyScope] = useState<UiSpriteScope | undefined>(pageImages.readyScope);
  const [progress, setProgress] = useState<ImageLoadingProgress>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const ready = readyScope === selected && pageImages.readyScope === selected;
  useLayoutEffect(() => {
    pageImages.activateScope(selected);
    if (pageImages.readyScope !== selected) setReadyScope(undefined);
    setProgress(undefined);
    setError('');
  }, [selected]);
  useEffect(() => {
    if (ready) return;
    const controller = new AbortController();
    setError('');
    void pageImages.load(next => {
      if (!controller.signal.aborted) setProgress(next);
    }, controller.signal, battleActive ? 'battle' : 'ui').then(() => {
      controller.signal.throwIfAborted();
      setReadyScope(selected);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {controller.abort();};
  }, [selected, battleActive, ready, attempt]);
  useEffect(() => {
    if (ready && battleActive && !battleLoading) pageImages.releaseLoadingImages();
  }, [ready, battleActive, battleLoading]);
  return {ready, scope: selected, progress, error, retry: () => setAttempt(value => value + 1)};
}
