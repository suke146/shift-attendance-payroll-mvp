import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import {
  buildSheetValues,
  getShiftExportDataForCurrentUser,
  ShiftExportError,
} from "@/lib/shift-export";

export const runtime = "nodejs";

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };

  row.alignment = {
    vertical: "middle",
    horizontal: "center",
  };
}

function applyBorders(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      cell.alignment = {
        vertical: "middle",
      };
    });
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  try {
    const exportData = await getShiftExportDataForCurrentUser(monthParam);
    const { shiftValues, summaryValues } = buildSheetValues(exportData);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Shift Manager MVP";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("月間シフト一覧");

    worksheet.columns = [
      { header: "日付", key: "shiftDate", width: 14 },
      { header: "曜日", key: "day", width: 8 },
      { header: "スタッフ名", key: "staffName", width: 22 },
      { header: "メール", key: "email", width: 28 },
      { header: "開始", key: "startTime", width: 10 },
      { header: "終了", key: "endTime", width: 10 },
      { header: "休憩(分)", key: "breakMinutes", width: 12 },
      { header: "勤務予定", key: "workTime", width: 14 },
      { header: "勤務予定(分)", key: "workMinutes", width: 14 },
      { header: "メモ", key: "note", width: 30 },
    ];

    for (const row of shiftValues.slice(1)) {
      worksheet.addRow(row);
    }

    styleHeaderRow(worksheet.getRow(1));
    applyBorders(worksheet);
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: "A1",
      to: "J1",
    };

    const summarySheet = workbook.addWorksheet("集計");

    summarySheet.columns = [
      { header: "スタッフ名", key: "staffName", width: 24 },
      { header: "メール", key: "email", width: 30 },
      { header: "シフト数", key: "shiftCount", width: 12 },
      { header: "勤務予定合計", key: "workTime", width: 16 },
      { header: "勤務予定合計(分)", key: "workMinutes", width: 18 },
    ];

    for (const row of summaryValues.slice(1)) {
      summarySheet.addRow(row);
    }

    styleHeaderRow(summarySheet.getRow(1));
    applyBorders(summarySheet);

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = encodeURIComponent(`シフト表_${exportData.month}.xlsx`);

    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ShiftExportError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("Excel export error:", error);

    return NextResponse.json(
      { message: "Excel出力に失敗しました" },
      { status: 500 }
    );
  }
}