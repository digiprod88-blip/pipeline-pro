import { jsPDF } from "jspdf";

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail?: string;
  productName: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
}

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`#${data.invoiceNumber}`, margin, y + 8);

  // Date - right aligned
  doc.text(`Date: ${data.date}`, pageWidth - margin, y, { align: "right" });
  doc.text(
    `Status: ${data.status.toUpperCase()}`,
    pageWidth - margin,
    y + 8,
    { align: "right" }
  );

  // Divider
  y += 20;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Bill To
  y += 12;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);

  y += 7;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, margin, y);

  if (data.customerEmail) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(data.customerEmail, margin, y);
  }

  // Items Table Header
  y += 18;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, pageWidth - margin * 2, 10, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("DESCRIPTION", margin + 5, y);
  doc.text("AMOUNT", pageWidth - margin - 5, y, { align: "right" });

  // Item Row
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text(data.productName, margin + 5, y);

  const currencySymbol = data.currency === "INR" ? "Rs." : data.currency === "EUR" ? "EUR" : "$";
  doc.text(
    `${currencySymbol} ${data.amount.toLocaleString()}`,
    pageWidth - margin - 5,
    y,
    { align: "right" }
  );

  // Divider
  y += 10;
  doc.line(margin, y, pageWidth - margin, y);

  // Total
  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("TOTAL", pageWidth - margin - 55, y);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(
    `${currencySymbol} ${data.amount.toLocaleString()}`,
    pageWidth - margin - 5,
    y,
    { align: "right" }
  );

  // Payment Method
  if (data.paymentMethod) {
    y += 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Payment Method: ${data.paymentMethod}`, margin, y);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text("Thank you for your business!", pageWidth / 2, footerY, {
    align: "center",
  });

  return doc;
}

export function downloadInvoice(data: InvoiceData) {
  const doc = generateInvoicePDF(data);
  doc.save(`invoice-${data.invoiceNumber}.pdf`);
}
