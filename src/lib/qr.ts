import QRCode from "qrcode";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The QuinaCare logo, composited into the centre of every QR code.
// Resolved from the repo's public/ dir — the build runs from the repo root.
const LOGO = readFileSync(join(process.cwd(), "public", "logo-quina-care.svg"));

/**
 * Build-time QR code generator.
 *
 * Returns a PNG data URI encoding the given URL, with the QuinaCare logo
 * on a white patch in the centre. The QR uses "H" error correction (~30%
 * recovery) so the obscured centre still scans reliably — the patch only
 * covers ~7% of the code's area.
 *
 * The same data URI is used both to display the code (`<img src>`) and as
 * a downloadable file (`<a download href>`), so a fundraiser's QR can be
 * shared offline and still link back to its campaign page.
 */
export async function generateQrDataUri(url: string): Promise<string> {
  const size = 512;
  const qr = await QRCode.toBuffer(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  // White rounded patch behind the logo so it reads cleanly against the code.
  const patch = Math.round(size * 0.26);
  const radius = Math.round(patch * 0.16);
  const patchPng = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${patch}" height="${patch}">` +
        `<rect width="${patch}" height="${patch}" rx="${radius}" ry="${radius}" ` +
        `fill="#ffffff"/></svg>`,
    ),
  )
    .png()
    .toBuffer();

  // Logo, sized to sit inside the patch with padding.
  const logoBox = Math.round(patch * 0.74);
  const logoPng = await sharp(LOGO, { density: 300 })
    .resize(logoBox, logoBox, {
      fit: "inside",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const composited = await sharp(qr)
    .composite([
      { input: patchPng, gravity: "center" },
      { input: logoPng, gravity: "center" },
    ])
    .png()
    .toBuffer();

  return "data:image/png;base64," + composited.toString("base64");
}
