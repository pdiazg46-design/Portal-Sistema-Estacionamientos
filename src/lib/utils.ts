export function getChileDate(baseDate: Date = new Date()): Date {
  const tzString = "America/Santiago";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tzString,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(baseDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return new Date(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
}

export function getChileDateString(baseDate: Date = new Date()): string {
  const chile = getChileDate(baseDate);
  const yyyy = chile.getFullYear();
  const mm = String(chile.getMonth() + 1).padStart(2, "0");
  const dd = String(chile.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getActiveOwnerHelper(spotId: number, staffList: any[], currentDate: Date = new Date()) {
  const chileDate = getChileDate(currentDate);
  const todayStr = getChileDateString(currentDate);
  
  const spotStaff = staffList.filter((s: any) => s.assignedSpotId === spotId);
  if (spotStaff.length === 0) return null;

  const activeStaff = spotStaff.filter((s: any) => {
    if (s.vacationStart && s.vacationEnd) {
      const vStart = getChileDate(new Date(s.vacationStart));
      const vEnd = getChileDate(new Date(s.vacationEnd));
      vStart.setHours(0, 0, 0, 0);
      vEnd.setHours(23, 59, 59, 999);
      if (chileDate >= vStart && chileDate <= vEnd) {
        return false;
      }
    }

    if (s.releasedDates) {
      const released = s.releasedDates.split(",");
      if (released.includes(todayStr)) {
        return false;
      }
    }

    if (!s.isAllDay) {
      const currentDayNum = chileDate.getDay();
      const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const currentDayName = weekdayNames[currentDayNum];

      const allowedDays = s.weekdays ? s.weekdays.split(",") : [];
      if (!allowedDays.includes(currentDayName)) {
        return false;
      }

      if (s.startTime && s.endTime) {
        const [startH, startM] = s.startTime.split(":").map(Number);
        const [endH, endM] = s.endTime.split(":").map(Number);

        const currentH = chileDate.getHours();
        const currentM = chileDate.getMinutes();

        const currentMins = currentH * 60 + currentM;
        const startMins = startH * 60 + startM;
        const endMins = endH * 60 + endM;

        if (currentMins < startMins || currentMins > endMins) {
          return false;
        }
      }
    }

    return true;
  });

  return activeStaff[0] || null;
}

export function normalizePlate(plate: string): string {
  if (!plate) return "";
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
