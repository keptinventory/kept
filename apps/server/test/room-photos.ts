// Invented room photos for the tests: flat coloured shapes on a plain wall and floor, drawn here,
// never a photo of a real home. `seed` changes the colours, so each photo has its own bytes (and
// its own mock answer, keyed by the image's hash).
import sharp from 'sharp';

const COLOURS = ['#8a6f4e', '#3f6e8c', '#a34b3c', '#5b7d4a', '#c9a227', '#6b5b95'];

/** A JPEG `width` × `height` of an imaginary room: a wall, a floor and a few boxes of colour. */
export async function roomPhoto(seed: number, width = 800, height = 600): Promise<Buffer> {
  const c = (i: number) => COLOURS[(seed + i) % COLOURS.length] as string;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="62%" fill="#e9e4da"/>
    <rect y="62%" width="100%" height="38%" fill="#b8a184"/>
    <rect x="5%" y="30%" width="35%" height="60%" fill="${c(0)}"/>
    <rect x="45%" y="55%" width="30%" height="30%" fill="${c(1)}"/>
    <rect x="80%" y="35%" width="12%" height="25%" fill="${c(2)}"/>
    <rect x="50%" y="40%" width="12%" height="10%" fill="${c(3)}"/>
    <text x="10" y="24" font-size="14" fill="#555">${seed}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}
