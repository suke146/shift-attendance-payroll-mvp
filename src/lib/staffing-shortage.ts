export type StaffingRequirementRow = {
    id: string;
    name: string;
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    required_staff_count: number;
    note: string | null;
    is_active: boolean;
  };
  
  export type ShiftForShortageRow = {
    id: string;
    staff_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
  };
  
  export type ShortageRow = {
    date: string;
    dayOfWeek: number;
    requirementId: string;
    requirementName: string;
    startTime: string;
    endTime: string;
    requiredStaffCount: number;
    assignedStaffCount: number;
    shortageCount: number;
    note: string | null;
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
  
  function buildMonthDates(year: number, monthNumber: number) {
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
  
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
  
      return {
        date,
        dayOfWeek: new Date(year, monthNumber - 1, day).getDay(),
      };
    });
  }
  
  function parseTimeToMinutes(value: string) {
    const [hourText, minuteText] = value.slice(0, 5).split(":");
  
    return Number(hourText) * 60 + Number(minuteText);
  }
  
  function isShiftOverlappingRequirement({
    shift,
    requirement,
  }: {
    shift: ShiftForShortageRow;
    requirement: StaffingRequirementRow;
  }) {
    const shiftStart = parseTimeToMinutes(shift.start_time);
    const shiftEnd = parseTimeToMinutes(shift.end_time);
    const requirementStart = parseTimeToMinutes(requirement.start_time);
    const requirementEnd = parseTimeToMinutes(requirement.end_time);
  
    return shiftStart < requirementEnd && shiftEnd > requirementStart;
  }
  
  export function calculateStaffingShortages({
    year,
    monthNumber,
    requirements,
    shifts,
  }: {
    year: number;
    monthNumber: number;
    requirements: StaffingRequirementRow[];
    shifts: ShiftForShortageRow[];
  }) {
    const dates = buildMonthDates(year, monthNumber);
    const activeRequirements = requirements.filter(
      (requirement) => requirement.is_active
    );
  
    const shortageRows: ShortageRow[] = [];
  
    for (const date of dates) {
      const dayShifts = shifts.filter((shift) => shift.shift_date === date.date);
  
      const dayRequirements = activeRequirements.filter((requirement) => {
        return (
          requirement.day_of_week === null ||
          requirement.day_of_week === date.dayOfWeek
        );
      });
  
      for (const requirement of dayRequirements) {
        const assignedStaffIds = new Set(
          dayShifts
            .filter((shift) =>
              isShiftOverlappingRequirement({
                shift,
                requirement,
              })
            )
            .map((shift) => shift.staff_id)
        );
  
        const assignedStaffCount = assignedStaffIds.size;
        const shortageCount = Math.max(
          requirement.required_staff_count - assignedStaffCount,
          0
        );
  
        shortageRows.push({
          date: date.date,
          dayOfWeek: date.dayOfWeek,
          requirementId: requirement.id,
          requirementName: requirement.name,
          startTime: requirement.start_time.slice(0, 5),
          endTime: requirement.end_time.slice(0, 5),
          requiredStaffCount: requirement.required_staff_count,
          assignedStaffCount,
          shortageCount,
          note: requirement.note,
        });
      }
    }
  
    return shortageRows;
  }