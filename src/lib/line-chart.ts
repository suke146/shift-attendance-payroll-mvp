export type LineChartMode = "requests" | "confirmed";

export type LineChartDay = {
  date: string;
  day: number;
  dayOfWeek: number;
};

export type LineChartStaffRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type LineChartRequestRow = {
  id: string;
  staff_id: string;
  request_date: string;
  request_type: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

export type LineChartShiftRow = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
};

export type LineChartCell = {
  type: "work" | "off" | "none";
  startText: string;
  endText: string;
  status?: string;
};

export type LineChartRow = {
  staffId: string;
  staffName: string;
  email: string;
  cells: Record<string, LineChartCell>;
};

export const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getMonthRange(monthText?: string | null) {
  const month = /^\d{4}-\d{2}$/.test(monthText ?? "")
    ? monthText!
    : getCurrentMonth();

  const [yearText, monthNumberText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthNumberText);

  const startDate = `${month}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = nextMonthDate.toISOString().slice(0, 10);

  return {
    month,
    year,
    monthNumber,
    startDate,
    endDate,
  };
}

export function buildLineChartDays(year: number, monthNumber: number) {
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index): LineChartDay => {
    const day = index + 1;
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    return {
      date,
      day,
      dayOfWeek: new Date(year, monthNumber - 1, day).getDay(),
    };
  });
}

export function formatTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function emptyCell(): LineChartCell {
  return {
    type: "none",
    startText: "",
    endText: "",
  };
}

export function buildLineChartRows({
  mode,
  staffs,
  days,
  requests,
  shifts,
}: {
  mode: LineChartMode;
  staffs: LineChartStaffRow[];
  days: LineChartDay[];
  requests: LineChartRequestRow[];
  shifts: LineChartShiftRow[];
}): LineChartRow[] {
  return staffs.map((staff) => {
    const cells: Record<string, LineChartCell> = {};

    for (const day of days) {
      cells[day.date] = emptyCell();
    }

    if (mode === "requests") {
      const staffRequests = requests.filter(
        (request) => request.staff_id === staff.id
      );

      for (const request of staffRequests) {
        if (request.request_type === "off") {
          cells[request.request_date] = {
            type: "off",
            startText: "休",
            endText: "休",
            status: request.status,
          };
          continue;
        }

        cells[request.request_date] = {
          type: "work",
          startText: formatTime(request.start_time),
          endText: formatTime(request.end_time),
          status: request.status,
        };
      }
    }

    if (mode === "confirmed") {
      const staffShifts = shifts.filter((shift) => shift.staff_id === staff.id);

      for (const shift of staffShifts) {
        const current = cells[shift.shift_date];

        if (current?.type === "work") {
          cells[shift.shift_date] = {
            type: "work",
            startText: `${current.startText} / ${formatTime(shift.start_time)}`,
            endText: `${current.endText} / ${formatTime(shift.end_time)}`,
          };
        } else {
          cells[shift.shift_date] = {
            type: "work",
            startText: formatTime(shift.start_time),
            endText: formatTime(shift.end_time),
          };
        }
      }
    }

    return {
      staffId: staff.id,
      staffName: staff.full_name ?? staff.email ?? "名前未設定",
      email: staff.email ?? "",
      cells,
    };
  });
}