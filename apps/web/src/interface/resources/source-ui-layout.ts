export interface HomeSourceControl {
  name: string;
  type?: string;
  parent: string | null;
  properties: Record<string, string>;
}
export interface HomeSourceUi {
  layouts: {path: string; windows: HomeSourceControl[]}[];
  imagesets: {path: string; attributes: {Name: string; [key: string]: string}; images: {Name: string; Width: string; Height: string; XOffset?: string; YOffset?: string; asset?: string}[]}[];
}

/** Positions relative to the source sheet, including its top navigation offset. */
export class HomeSourceLayout {
  private readonly controls: HomeSourceControl[];
  constructor(private readonly ui: HomeSourceUi, private readonly suffix: string) {
    this.controls = ui.layouts.find(layout => layout.path.endsWith(suffix))!.windows;
  }

  control(name: string): HomeSourceControl {
    return this.controls.find(control => control.name === name)!;
  }

  place(element: HTMLElement, name: string): HomeSourceControl {
    const source = this.control(name);
    const rectangle = (control: HomeSourceControl) =>
      control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const box = rectangle(source);
    let left = box[0], top = box[1];
    for (let parent = source.parent; parent;) {
      const owner = this.control(parent), position = rectangle(owner);
      left += position[0]; top += position[1]; parent = owner.parent;
    }
    Object.assign(element.style, {left: `${left}px`, top: `${top}px`,
      width: `${box[2] - box[0]}px`, height: `${box[3] - box[1]}px`});
    element.dataset.sourceControl = name;
    element.dataset.sourceLayout = `ui/layouts/${this.suffix}`;
    return source;
  }

  picture(element: HTMLElement, reference: string | undefined): void {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    const sets = this.ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
    element.style.backgroundImage = asset ? `url('/${asset}')` : '';
    if (asset) element.dataset.sourceAsset = asset;
    else delete element.dataset.sourceAsset;
  }
}
