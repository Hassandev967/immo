// Construit un lien wa.me ou sms: pour ouvrir l'app native du téléphone
// Format E.164 attendu (ex: +2250707070707)
const cleanPhone = (raw: string) => raw.replace(/[^\d+]/g, "").replace(/^00/, "+");

export const buildWhatsAppLink = (phone: string, message: string) => {
  const p = cleanPhone(phone).replace(/^\+/, "");
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
};

export const buildSmsLink = (phone: string, message: string) => {
  const p = cleanPhone(phone);
  // sms: avec body= fonctionne sur iOS et Android modernes
  return `sms:${p}?body=${encodeURIComponent(message)}`;
};

export const renderTemplate = (template: string, vars: Record<string, string | number | undefined>) => {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
};
