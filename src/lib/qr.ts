import QRCode from "qrcode";

/**
 * Build-time QR code generator.
 *
 * Returns a PNG data URI encoding the given URL. The same data URI is used
 * both to render the code (`<img src>`) and as a downloadable file
 * (`<a download href>`), so a fundraiser's QR can be shared offline — on
 * flyers, posters or screens — and still link back to its campaign page.
 */
export async function generateQrDataUri(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
