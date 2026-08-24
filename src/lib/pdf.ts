import jsPDF from "jspdf";
import { fmtFCFA, fmtDate } from "./format";

const header = (doc: jsPDF, title: string, subtitle?: string) => {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("ImmoCI", 14, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Gestion immobilière · Côte d'Ivoire", 14, 20);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(title, 196, 14, { align: "right" });
  if (subtitle) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(subtitle, 196, 20, { align: "right" }); }
  doc.setTextColor(0, 0, 0);
};

const footer = (doc: jsPDF) => {
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`Document généré le ${new Date().toLocaleString("fr-FR")}`, 14, 287);
  doc.text("ImmoCI · contact@immoci.ci", 196, 287, { align: "right" });
};

export const downloadFactureEntreePDF = (f: any) => {
  const doc = new jsPDF();
  header(doc, "FACTURE D'ENTRÉE", f.numero);

  doc.setFontSize(10); doc.setTextColor(0);
  let y = 42;
  doc.setFont("helvetica", "bold"); doc.text("Bien loué", 14, y);
  doc.setFont("helvetica", "normal"); y += 6;
  doc.text(`${f.biens?.reference ?? ""} — ${f.biens?.quartier ?? ""}`, 14, y); y += 5;
  doc.text(`Loyer mensuel : ${fmtFCFA(f.loyer_mensuel)}`, 14, y); y += 5;
  doc.text(`Date d'émission : ${fmtDate(f.date_emission)}`, 14, y); y += 12;

  doc.setFont("helvetica", "bold"); doc.text("Détail des frais d'entrée", 14, y); y += 2;
  doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;
  doc.setFont("helvetica", "normal");

  const lines: [string, string, number][] = [
    ["Caution", "≤ 2 mois (Loi 2018-575)", Number(f.caution)],
    ["Avance loyer", "≤ 2 mois", Number(f.avance_loyer)],
    ["Commission agence", "≤ 1 mois", Number(f.commission_agence)],
  ];
  lines.forEach(([lib, ref, mt]) => {
    doc.text(lib, 14, y);
    doc.setTextColor(120); doc.text(ref, 70, y); doc.setTextColor(0);
    doc.text(fmtFCFA(mt), 196, y, { align: "right" });
    y += 7;
  });

  doc.line(14, y, 196, y); y += 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("TOTAL À PAYER", 14, y);
  doc.text(fmtFCFA(f.total), 196, y, { align: "right" });

  y += 18; doc.setFontSize(9); doc.setFont("helvetica", "italic"); doc.setTextColor(80);
  doc.text("Le présent montant doit être réglé avant la remise des clés. Tout paiement génère une quittance.", 14, y, { maxWidth: 182 });

  footer(doc);
  doc.save(`${f.numero}.pdf`);
};

export const downloadMEDPDF = (m: any) => {
  const doc = new jsPDF();
  header(doc, "MISE EN DEMEURE", m.numero);

  doc.setFontSize(10); let y = 42;
  doc.setFont("helvetica", "bold"); doc.text("Destinataire", 14, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`${m.baux?.locataires?.nom ?? ""} ${m.baux?.locataires?.prenom ?? ""}`, 14, y); y += 5;
  doc.text(`Bien : ${m.baux?.biens?.reference ?? ""} — ${m.baux?.biens?.quartier ?? ""}`, 14, y); y += 5;
  doc.text(`Bail : ${m.baux?.reference ?? ""}`, 14, y); y += 12;

  doc.setFont("helvetica", "bold"); doc.text("Objet : Mise en demeure de payer", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  const corps = `Madame, Monsieur,\n\nMalgré nos précédentes relances, nous constatons à ce jour un retard de paiement de ${m.nb_mois_retard} mois de loyer concernant le bail susvisé, pour un montant total de ${fmtFCFA(m.montant_du)}.\n\nEn conséquence, nous vous mettons en demeure de procéder au règlement intégral de cette somme dans un délai de ${m.delai_jours} jours à compter de la réception de la présente.\n\nÀ défaut de paiement dans ce délai, nous nous réservons le droit d'engager toute procédure utile, notamment commandement de payer, assignation et expulsion, conformément aux dispositions légales en vigueur.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`;
  const split = doc.splitTextToSize(corps, 182);
  doc.text(split, 14, y); y += split.length * 5 + 10;

  doc.text(`Fait le ${fmtDate(m.date_envoi || m.date_emission)}`, 14, y); y += 6;
  doc.text("La Direction — ImmoCI", 14, y);

  footer(doc);
  doc.save(`${m.numero}.pdf`);
};

export const downloadRedditionPDF = (r: any, mois: string) => {
  const doc = new jsPDF();
  header(doc, "RELEVÉ PROPRIÉTAIRE", new Date(mois).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));

  doc.setFontSize(10); let y = 42;
  doc.setFont("helvetica", "bold"); doc.text(r.proprietaire.nom, 14, y); y += 6;
  doc.setFont("helvetica", "normal");
  if (r.proprietaire.telephone) { doc.text(`Tél : ${r.proprietaire.telephone}`, 14, y); y += 5; }
  if (r.proprietaire.email) { doc.text(`Email : ${r.proprietaire.email}`, 14, y); y += 5; }
  doc.text(`Nombre de biens : ${r.nbBiens}`, 14, y); y += 12;

  doc.setFont("helvetica", "bold"); doc.text("Décompte du mois", 14, y); y += 2;
  doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;

  const rows: [string, number, string][] = [
    ["Total encaissé", r.encaisse, "+"],
    [`Honoraires de gestion (${r.taux}%)`, r.honoraires, "-"],
    ["Charges déduites", r.charges, "-"],
  ];
  doc.setFont("helvetica", "normal");
  rows.forEach(([lib, mt, sign]) => {
    doc.text(lib, 14, y);
    doc.text(`${sign} ${fmtFCFA(mt)}`, 196, y, { align: "right" });
    y += 7;
  });

  doc.line(14, y, 196, y); y += 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("NET À REVERSER", 14, y);
  doc.text(fmtFCFA(r.net), 196, y, { align: "right" });

  if (r.rev?.statut === "paye") {
    y += 14; doc.setFontSize(9); doc.setFont("helvetica", "italic"); doc.setTextColor(80);
    doc.text(`Reversé le ${fmtDate(r.rev.date_paiement)} par ${r.rev.mode_paiement}${r.rev.reference_externe ? ` — réf. ${r.rev.reference_externe}` : ""}.`, 14, y);
  }

  footer(doc);
  doc.save(`reddition_${r.proprietaire.nom.replace(/\s+/g, "_")}_${mois}.pdf`);
};
