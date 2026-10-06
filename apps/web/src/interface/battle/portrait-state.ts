/** Original CEGUI portrait record: EXE 0x4c75f6/0x4c7633/0x4c76ac. */
export class PortraitState {
  flags = 0x01000000;
  private elapsed = 0;
  private wait = 2;

  set(state: number): void {
    this.elapsed = 0;
    if ((this.flags & 4) && state === 2 || !(this.flags & 0x01000000) && state === 1) {
      return;
    }
    this.flags = (this.flags & (state & 0xff000000 ? 0x00ffffff : 0xff000000)) | state;
  }

  advance(seconds: number): void {
    this.elapsed = Math.fround(this.elapsed + seconds);
    if (this.flags === 0x01000000) {
      if (this.elapsed > this.wait) {
        this.set(1);
        // Original MSVC rand() range 0..32767, multiplied by float32 8/32767, plus 15.
        this.wait = Math.fround(Math.floor(Math.random() * 32768) * Math.fround(8 / 32767) + 15);
      }
    } else if ((this.flags & 13) && this.elapsed > 1 || (this.flags & 2) && this.elapsed > 0.5) {
      this.set(0);
    }
  }

  image(): 'normal' | 'attack' | 'wound' | 'yeah1' | 'yeah2' | 'dead' {
    const frame = Math.trunc(this.elapsed / 0.5 + 0.5);
    if (this.flags & 1) return 'normal';
    if (this.flags & 2) return 'attack';
    if (this.flags & 4) return frame % 2 ? 'yeah2' : 'yeah1';
    if (this.flags & 8) return 'wound';
    if (this.flags & 0x03000000) return 'normal';
    return 'dead';
  }
}
