import './source-tank-icon.css';

/** The source tank label is HTML text over the model artwork. */
export function TankIconMark({mark}: {mark: string}) {
  return <span className="tank-icon-mark" data-tank-mark={mark} aria-hidden="true">{mark}</span>;
}
