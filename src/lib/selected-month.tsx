import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface SelectedMonthValue {
  year: number;
  month: number; // 0-11
  startDate: Date;
  endDateExcl: Date;
  label: string;
  isCurrentMonth: boolean;
  setMonth: (year: number, month: number) => void;
  next: () => void;
  prev: () => void;
}

const SelectedMonthContext = createContext<SelectedMonthValue | null>(null);
const STORAGE_KEY = "vm.selectedMonth";

function readInitial(): { y: number; m: number } {
  if (typeof window !== "undefined") {
    try {
      const s = window.sessionStorage.getItem(STORAGE_KEY);
      if (s) {
        const [y, m] = s.split("-").map(Number);
        if (Number.isFinite(y) && Number.isFinite(m)) return { y, m };
      }
    } catch { /* ignore */ }
  }
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

export function SelectedMonthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(readInitial);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, `${state.y}-${state.m}`);
    } catch { /* ignore */ }
  }, [state]);

  const value = useMemo<SelectedMonthValue>(() => {
    const startDate = new Date(state.y, state.m, 1);
    const endDateExcl = new Date(state.y, state.m + 1, 1);
    const now = new Date();
    const label = startDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return {
      year: state.y,
      month: state.m,
      startDate,
      endDateExcl,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      isCurrentMonth: now.getFullYear() === state.y && now.getMonth() === state.m,
      setMonth: (y, m) => setState({ y, m }),
      next: () => setState(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })),
      prev: () => setState(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })),
    };
  }, [state]);

  return <SelectedMonthContext.Provider value={value}>{children}</SelectedMonthContext.Provider>;
}

export function useSelectedMonth(): SelectedMonthValue {
  const ctx = useContext(SelectedMonthContext);
  if (!ctx) throw new Error("useSelectedMonth must be used within SelectedMonthProvider");
  return ctx;
}

/** Reference date used for "today"-like calculations. Returns today if the
 * selected month is the current month, otherwise the last day of the selected month. */
export function useRefDate(): Date {
  const { isCurrentMonth, endDateExcl } = useSelectedMonth();
  return useMemo(() => {
    if (isCurrentMonth) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(endDateExcl);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [isCurrentMonth, endDateExcl]);
}
