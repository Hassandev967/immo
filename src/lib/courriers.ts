import { jsPDF } from "jspdf";
import { asBlob } from "html-docx-js-typescript";
import { supabase } from "@/integrations/supabase/client";

/** Remplace {{var}} par les valeurs fournies (laisse intact si manquant). */
export const renderCourrier = (
  template: string,
  vars: Record<string, string | number | undefined | null>
) => {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null || v === "" ? `{{${key}}}` : String(v);
  });
};

/** Convertit un HTML simple en texte structuré pour le PDF. */
const htmlToBlocks = (html: string): { text: string; bold: boolean }[] => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const blocks: { text: string; bold: boolean }[] = [];
  tmp.querySelectorAll("p, h1, h2, h3, li, br").forEach((node) => {
    const inner = (node as HTMLElement).innerHTML;
    const parts = inner.split(/<br\s*\/?>/i);
    parts.forEach((part) => {
      const wrapper = document.createElement("span");
      wrapper.innerHTML = part;
      const hasStrong = /<strong>|<b>/i.test(part);
      const text = wrapper.textContent?.trim() || "";
      if (text) blocks.push({ text, bold: hasStrong });
    });
    blocks.push({ text: "", bold: false });
  });
  return blocks;
};

/** Génère un PDF A4 et renvoie un Blob. */
export const courrierToPdf = (objet: string, html: string): Blob => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageW = 210;
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const objLines = doc.splitTextToSize(objet, maxW);
  doc.text(objLines, margin, y);
  y += objLines.length * 7 + 4;

  doc.setFontSize(11);
  for (const block of htmlToBlocks(html)) {
    if (!block.text) { y += 3; continue; }
    doc.setFont("helvetica", block.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(block.text, maxW);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 6;
    }
    y += 2;
  }
  return doc.output("blob");
};

/** Génère un DOCX (Word) à partir du HTML. */
export const courrierToDocx = async (objet: string, html: string): Promise<Blob> => {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${objet}</title></head><body><h2>${objet}</h2>${html}</body></html>`;
  const out = await asBlob(wrapped);
  return out as Blob;
};

/** Upload un blob sur le bucket courriers et renvoie le path. */
export const uploadCourrierFichier = async (path: string, blob: Blob): Promise<string> => {
  const { error } = await supabase.storage.from("courriers").upload(path, blob, { upsert: true });
  if (error) throw error;
  return path;
};

/** Renvoie une URL signée temporaire (1h) pour télécharger un fichier. */
export const getCourrierSignedUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage.from("courriers").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const CATEGORIE_LABEL: Record<string, string> = {
  mise_en_demeure: "Mise en demeure",
  sommation_payer: "Sommation de payer",
  resiliation_bail: "Résiliation de bail",
  commandement_quitter: "Commandement de quitter",
  accuse_reception: "Accusé de réception",
  relance_amiable: "Relance amiable",
  attestation_loyer: "Attestation de loyer",
  conge_proprietaire: "Congé propriétaire",
  courrier_huissier: "Saisine d'huissier",
  courrier_avocat: "Saisine d'avocat",
  autre: "Autre",
};
