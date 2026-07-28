export interface DashboardData {
  date: string; // yyyy-MM-dd
  formattedDate: string; // e.g. "20 July 2026"
  categories: Record<string, number>;
  shifts: Record<string, number>;
}

export const CATEGORIES_LIST = [
  "Operation",
  "OS (Office Service)",
  "Engineering",
  "Carpenter",
  "Visitor",
  "Security",
  "ARP",
  "SCM",
  "Harian",
  "Driver",
  "Office Elnusa",
  "HSE",
  "Medic"
];

export const SHIFTS_LIST = [
  "Shift 1 (Pagi)"
];

// Color palette matching the Cyber Dark/Cyan/Green Elnusa theme
export const CHART_COLORS = [
  "#22d3ee", // cyan-400
  "#34d399", // emerald-400
  "#818cf8", // indigo-400
  "#f472b6", // pink-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#60a5fa", // blue-400
  "#38bdf8", // sky-400
  "#c084fc", // purple-400
  "#accf12", // lime-400
  "#14b8a6", // teal-500
  "#ec4899", // pink-500
  "#e11d48", // rose-600
  "#4f46e5"  // indigo-600
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const getYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFormattedDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${monthStr} ${year}`;
};

export function generateDynamicMockData(todayRealStats?: { pob: number; visitorIn: number }): DashboardData[] {
  const data: DashboardData[] = [];
  const today = new Date();
  
  // Use todayRealStats if provided, otherwise a realistic default around 46
  const targetPob = todayRealStats && todayRealStats.pob > 0 ? todayRealStats.pob : 46;
  const targetVisitor = todayRealStats ? todayRealStats.visitorIn : 5;

  // Let's generate for the last 15 days (from today - 14 days to today)
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getYYYYMMDD(d);
    const formattedStr = getFormattedDate(d);

    // Make weekend counts lower than weekdays
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    // Day-specific base headcount: today is exactly targetPob, weekdays are around targetPob +- 5, weekends are 5-15
    let dayTotal = 0;
    if (i === 0) {
      dayTotal = targetPob;
    } else if (isWeekend) {
      dayTotal = Math.floor(Math.random() * 5) + 8; // 8-12
    } else {
      // weekday
      const randomOffset = Math.floor(Math.random() * 9) - 4; // -4 to +4
      dayTotal = Math.max(15, targetPob + randomOffset);
    }

    // Now let's distribute the dayTotal across CATEGORIES_LIST
    const categories: Record<string, number> = {};
    CATEGORIES_LIST.forEach(cat => {
      categories[cat] = 0;
    });

    let remaining = dayTotal;
    
    // Give some weight to each category
    const weights: Record<string, number> = {
      "Operation": 0.35,
      "OS (Office Service)": 0.15,
      "Engineering": 0.10,
      "Carpenter": 0.05,
      "Security": 0.10,
      "Visitor": 0.08,
      "ARP": 0.04,
      "SCM": 0.04,
      "Harian": 0.04,
      "Driver": 0.03,
      "Office Elnusa": 0.03,
      "HSE": 0.01,
      "Medic": 0.01
    };

    // Override visitor count if today
    if (i === 0) {
      weights["Visitor"] = Math.min(0.2, targetVisitor / Math.max(1, dayTotal));
    }

    CATEGORIES_LIST.forEach((cat, idx) => {
      if (idx === CATEGORIES_LIST.length - 1) {
        categories[cat] = Math.max(0, remaining);
      } else {
        const weight = weights[cat] || 0.01;
        const count = Math.min(remaining, Math.round(dayTotal * weight));
        categories[cat] = count;
        remaining -= count;
      }
    });

    // Distribute dayTotal across SHIFTS_LIST
    const shifts: Record<string, number> = {};
    SHIFTS_LIST.forEach(shift => {
      shifts[shift] = 0;
    });

    let shiftRemaining = dayTotal;
    const shiftWeights: Record<string, number> = {
      "Shift 1 (Pagi)": 1.0
    };

    SHIFTS_LIST.forEach((shift, idx) => {
      if (idx === SHIFTS_LIST.length - 1) {
        shifts[shift] = Math.max(0, shiftRemaining);
      } else {
        const weight = shiftWeights[shift] || 0.25;
        const count = Math.min(shiftRemaining, Math.round(dayTotal * weight));
        shifts[shift] = count;
        shiftRemaining -= count;
      }
    });

    data.push({
      date: dateStr,
      formattedDate: formattedStr,
      categories,
      shifts
    });
  }

  return data;
}

// Initial mock data with dynamic generation so it loads nicely by default with 2026 dates
export const MOCK_DASHBOARD_DATA: DashboardData[] = generateDynamicMockData();
