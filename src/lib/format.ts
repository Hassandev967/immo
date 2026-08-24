export const fmtFCFA = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(Number(n)) + " FCFA";
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const monthLabel = (d: string | Date) =>
  new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
