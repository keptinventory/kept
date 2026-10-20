/**
 * Try Kept's sample room photo (#194): there is no camera in the demo, so Room mode offers an
 * illustrated room drawn here, a wall and a floor with a bookcase, an armchair, a lamp, a clock
 * and a cushion in flat colours, never a photo of a real home. Drawn on a canvas and encoded as
 * a JPEG, as a photo from the gallery would arrive.
 */
const W = 1600;
const H = 1200;

export async function sampleRoomPhoto(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('no 2d canvas');
  const box = (x: number, y: number, w: number, h: number, colour: string) => {
    c.fillStyle = colour;
    c.fillRect(x, y, w, h);
  };
  box(0, 0, W, H * 0.62, '#e9e4da');
  box(0, H * 0.62, W, H * 0.38, '#b8a184');
  // Bookcase, its shelves and books.
  box(80, 300, 520, 760, '#8a6f4e');
  for (let s = 0; s < 4; s++) {
    box(100, 330 + s * 180, 480, 150, '#5f4a33');
    for (let b = 0; b < 9; b++) {
      box(
        110 + b * 52,
        360 + s * 180,
        40,
        120,
        ['#3f6e8c', '#a34b3c', '#c9a227', '#5b7d4a'][(b + s) % 4] as string,
      );
    }
  }
  // Armchair.
  box(760, 640, 420, 300, '#3f6e8c');
  box(720, 760, 500, 200, '#355d77');
  box(760, 960, 40, 60, '#2a2724');
  box(1140, 960, 40, 60, '#2a2724');
  // Cushion on the floor.
  box(880, 1040, 200, 90, '#c9a227');
  // Floor lamp.
  box(1360, 330, 160, 110, '#f2efe9');
  box(1432, 440, 16, 560, '#2a2724');
  box(1380, 1000, 120, 24, '#2a2724');
  // Wall clock.
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(980, 260, 90, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2a2724';
  c.lineWidth = 10;
  c.stroke();
  c.beginPath();
  c.moveTo(980, 260);
  c.lineTo(980, 200);
  c.moveTo(980, 260);
  c.lineTo(1025, 260);
  c.stroke();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no JPEG'))), 'image/jpeg', 0.85),
  );
}
