import {useEffect, useState} from 'react';
import {preloadGameResources} from '../../assets/preload-resources';
import {LoadingPage} from '../resources/loading-page';
import {DialogButton} from '../resources/dialog-button';
import {showGameMessage} from '../resources/game-message';

/** Full-pack loading leaves the entry lifecycle and saved credentials in place. */
export function ResourcePackLoading({onComplete}: {onComplete(): void}) {
  const [background] = useState(() => 1 + Math.floor(Math.random() * 5));
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在准备资源包…');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setProgress(0);
    setStatus('正在准备资源包…');
    setError('');
    void preloadGameResources(value => {
      if (controller.signal.aborted) return;
      setProgress(value.completed / Math.max(1, value.total));
      setStatus(`正在加载并缓存资源… ${value.completed}/${value.total}`);
    }, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      showGameMessage('全部游戏静态资源已加载并缓存', 'success');
      onComplete();
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => controller.abort();
  }, [attempt, onComplete]);
  return <LoadingPage background={background} progress={progress} status={status}
    aria-label="加载资源包" aria-busy={!error} data-resource-pack-loading=""
    error={error ? '资源包加载失败' : undefined} details={error || undefined}
    actions={<>
      <DialogButton type="button" autoFocus onClick={() => setAttempt(value => value + 1)}>重试</DialogButton>
      <DialogButton type="button" onClick={onComplete}>返回</DialogButton>
    </>}/>;
}
