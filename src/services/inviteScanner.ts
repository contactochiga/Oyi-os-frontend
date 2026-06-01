import { Capacitor } from "@capacitor/core";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

export type InviteScanResult =
  | { ok: true; value: string }
  | { ok: false; reason: "web" | "denied" | "empty" | "unavailable"; message: string };

export async function scanInviteQrCode(): Promise<InviteScanResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      ok: false,
      reason: "web",
      message: "Camera scanning is available in the Oyi mobile app. Paste your setup link instead.",
    };
  }

  try {
    let permission = await BarcodeScanner.checkPermissions();
    if (permission.camera !== "granted") {
      permission = await BarcodeScanner.requestPermissions();
    }
    if (permission.camera !== "granted") {
      return {
        ok: false,
        reason: "denied",
        message: "Camera access is off. Enable it in Settings or paste your setup link instead.",
      };
    }

    const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    const value = result.barcodes.map((barcode) => barcode.rawValue).find(Boolean);
    if (!value) {
      return {
        ok: false,
        reason: "empty",
        message: "No Oyi invitation was detected. Try again or paste your setup link instead.",
      };
    }
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Camera scanning is unavailable right now. Paste your setup link instead.",
    };
  }
}
