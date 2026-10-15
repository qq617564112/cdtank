const INTERACTION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/** Capture gestures before controls stop propagation; touch activation happens on release. */
export function listenForAudioInteraction(resume: () => void): () => void {
  for (const type of INTERACTION_EVENTS) window.addEventListener(type, resume, true);
  return () => {
    for (const type of INTERACTION_EVENTS) window.removeEventListener(type, resume, true);
  };
}
