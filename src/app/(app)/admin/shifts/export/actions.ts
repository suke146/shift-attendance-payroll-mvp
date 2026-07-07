"use server";

import { google } from "googleapis";
import { redirect } from "next/navigation";

import {
  buildSheetValues,
  getShiftExportDataForCurrentUser,
} from "@/lib/shift-export";

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function redirectToExport(month: string, message: string): never {
  redirect(
    `/admin/shifts/export?month=${encodeURIComponent(
      month
    )}&message=${encodeURIComponent(message)}`
  );
}

function extractSpreadsheetId(value: string) {
  const trimmed = value.trim();

  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  if (match?.[1]) {
    return match[1];
  }

  return trimmed;
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google連携の環境変数が未設定です。GOOGLE_SERVICE_ACCOUNT_EMAIL と GOOGLE_PRIVATE_KEY を設定してください。"
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

async function ensureSheetExists({
  sheets,
  spreadsheetId,
  sheetName,
}: {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
  sheetName: string;
}) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const exists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetName
  );

  if (exists) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });
}

async function overwriteSheetValues({
  sheets,
  spreadsheetId,
  sheetName,
  values,
}: {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
  sheetName: string;
  values: unknown[][];
}) {
  await ensureSheetExists({
    sheets,
    spreadsheetId,
    sheetName,
  });

  const quotedName = quoteSheetName(sheetName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quotedName}!A:Z`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quotedName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function exportShiftsToGoogleSheetsAction(formData: FormData) {
  const month = getFormValue(formData, "month");
  const spreadsheetInput = getFormValue(formData, "spreadsheetId");
  const sheetNamePrefix = getFormValue(formData, "sheetNamePrefix") || "シフト表";

  if (!spreadsheetInput) {
    redirectToExport(month, "GoogleスプレッドシートIDまたはURLを入力してください");
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);

  try {
    const exportData = await getShiftExportDataForCurrentUser(month);
    const { shiftValues, summaryValues } = buildSheetValues(exportData);

    const auth = getGoogleAuth();
    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const shiftSheetName = `${sheetNamePrefix}_${exportData.month}_一覧`;
    const summarySheetName = `${sheetNamePrefix}_${exportData.month}_集計`;

    await overwriteSheetValues({
      sheets,
      spreadsheetId,
      sheetName: shiftSheetName,
      values: shiftValues,
    });

    await overwriteSheetValues({
      sheets,
      spreadsheetId,
      sheetName: summarySheetName,
      values: summaryValues,
    });

    redirectToExport(
      exportData.month,
      "Googleスプレッドシートへ出力しました"
    );
  } catch (error) {
    console.error("exportShiftsToGoogleSheetsAction error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Googleスプレッドシート出力に失敗しました";

    redirectToExport(month, message);
  }
}