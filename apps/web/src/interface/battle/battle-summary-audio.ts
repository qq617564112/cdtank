import {useEffect, useRef, useState} from 'react';
import {BattleSummarySound} from '../../audio/battle-summary-sound';
import type {SummarySequence, SummaryStage} from './battle-summary-sequence';

interface SummaryAudio {
  sounds?: BattleSummarySound;
  ready: boolean;
  error: string;
}
interface SoundCursor {
  round: number;
  stage?: SummaryStage;
  awardIndex?: number;
  level?: number;
  titleId?: number;
}

/** Decode once before the presentation clock starts; unavailable audio leaves the results usable. */
export function useSummaryAudio(volume?: () => number | undefined): SummaryAudio {
  const [audio, setAudio] = useState<SummaryAudio>({ready: false, error: ''});
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    let sounds: BattleSummarySound | undefined;
    void (async () => {
      try {
        sounds = new BattleSummarySound(() => volumeRef.current?.());
        await sounds.load(controller.signal);
        if (live) setAudio({sounds, ready: true, error: ''});
      } catch (reason) {
        sounds?.dispose();
        sounds = undefined;
        if (live) setAudio({ready: true, error: String(reason)});
      }
    })();
    return () => {live = false; controller.abort(); sounds?.dispose(); sounds = undefined;};
  }, []);
  return audio;
}

/** Stage and entry identities survive snapshot refreshes and pagination. */
export function useSummarySoundCues(sounds: BattleSummarySound | undefined, ready: boolean,
    round: number, sequence: SummarySequence, level?: number, titleId?: number): void {
  const cursor = useRef<SoundCursor | undefined>(undefined);
  const {stage, awardIndex} = sequence;
  useEffect(() => {
    cursor.current = undefined;
    return () => sounds?.stop();
  }, [sounds, round]);
  useEffect(() => {
    if (!sounds || !ready) return;
    const previous = cursor.current ?? {round};
    sounds.setRolling(stage === 'scores' || stage === 'growth' ? stage : undefined);
    sounds.setAwardLoop(stage === 'awards');
    if (stage !== previous.stage) {
      const entrySound = stage === 'panels' ? 35 : stage === 'rows' ? 36
        : stage === 'outcome' ? 37 : stage === 'rewards' ? 40 : undefined;
      if (entrySound !== undefined) sounds.play(entrySound);
    }
    if (stage === 'awards' && (previous.stage !== 'awards' || previous.awardIndex !== awardIndex)) {
      sounds.play(30);
    }
    if (stage === 'growth' && level !== undefined
        && previous.level !== undefined && level !== previous.level) {
      sounds.play(level > previous.level ? 31 : 39);
    }
    if (titleId !== undefined && titleId !== previous.titleId) sounds.play(40);
    cursor.current = {round, stage, awardIndex, level, titleId};
  }, [sounds, ready, round, stage, awardIndex, level, titleId]);
}
