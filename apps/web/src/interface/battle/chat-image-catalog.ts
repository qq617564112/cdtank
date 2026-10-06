import type {HomeSourceUi} from '../resources/source-ui-layout';

export interface ChatSourceImage {asset: string; width: number; height: number;}

/** Resolve original imageset/image identities to already exported source crops. */
export class ChatImageCatalog {
  private readonly sets = new Map<string,Map<string,ChatSourceImage>>();

  constructor(ui: HomeSourceUi) {
    const sets=[...ui.imagesets].sort((left,right)=>Number(right.path.includes('imagesets_dds/'))-Number(left.path.includes('imagesets_dds/')));
    for (const set of sets) {
      if (this.sets.has(set.attributes.Name)) continue;
      const images=new Map<string,ChatSourceImage>();
      for (const image of set.images) {
        const dimensions=image as typeof image & {Width?: string; Height?: string};
        const width=Number(dimensions.Width),height=Number(dimensions.Height);
        if (image.asset && Number.isFinite(width) && width>0 && Number.isFinite(height) && height>0) {
          images.set(image.Name,{asset:image.asset,width,height});
        }
      }
      this.sets.set(set.attributes.Name,images);
    }
  }

  image(set: string, name: string): ChatSourceImage | undefined {
    return this.sets.get(set)?.get(name);
  }
}
