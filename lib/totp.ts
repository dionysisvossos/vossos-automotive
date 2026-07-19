import { generateSecret as otpGenerateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Vossos Automotive";

export function generateSecret(): string {
  return otpGenerateSecret();
}

export function otpauthUrl(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

// Επαληθεύει TOTP με ανοχή ±30s για μικρή απόκλιση ρολογιού.
export async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({
      secret,
      token: token.trim(),
      epochTolerance: 30,
    });
    return result.valid;
  } catch {
    return false;
  }
}

export function qrDataUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth);
}
