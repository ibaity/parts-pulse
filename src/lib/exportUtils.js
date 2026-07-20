import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { getCurrencySymbol } from '@/lib/partConstants';

export function exportPurchaseExcel(purchaseItems, vendorName, currency) {
  const symbol = getCurrencySymbol(currency);
  const data = purchaseItems.map(r => {
    const price = Number(r.unit_price) || 0;
    const total = price * (r.recommended_quantity || 0);
    return {
      'Item Code': r.item_code,
      'Description': r.description,
      'Current Stock': r.current_stock,
      'Minimum Stock': r.minimum_stock,
      'Recommended Qty': r.recommended_quantity,
      [`Unit Price (${symbol})`]: price,
      [`Total (${symbol})`]: total,
      'Status': r.status === 'critical' ? 'Critical' : r.status === 'manual' ? 'Manual' : 'Low',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Purchase Recommendations');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `purchase_recommendations_${vendorName || 'vendor'}_${dateStr}.xlsx`);
}

export function exportPurchasePDF(purchaseItems, vendorName, currency) {
  const symbol = getCurrencySymbol(currency);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;
  const tableWidth = pageWidth - 2 * margin;

  const columns = [
    { header: 'Item Code', key: 'item_code', width: 35, align: 'left' },
    { header: 'Description', key: 'description', width: 70, align: 'left' },
    { header: 'Current', key: 'current_stock', width: 20, align: 'right' },
    { header: 'Min', key: 'minimum_stock', width: 20, align: 'right' },
    { header: 'Rec. Qty', key: 'recommended_quantity', width: 24, align: 'right' },
    { header: `Price(${symbol})`, key: 'unit_price', width: 28, align: 'right' },
    { header: `Total(${symbol})`, key: 'total', width: 36, align: 'right' },
    { header: 'Status', key: 'status', width: 30, align: 'center' },
  ];

  const grandTotal = purchaseItems.reduce((sum, r) => sum + (Number(r.unit_price) || 0) * (r.recommended_quantity || 0), 0);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Purchase Recommendations', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Vendor: ${vendorName || 'N/A'}`, margin, 26);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, 32);
  doc.text(`Total Items: ${purchaseItems.length}`, margin, 38);
  doc.text(`Grand Total: ${symbol} ${grandTotal.toLocaleString()}`, pageWidth - margin - 80, 38);

  const rowHeight = 7;
  const headerHeight = 8;

  const drawHeader = (yPos) => {
    doc.setFillColor(30, 58, 95);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, yPos, tableWidth, headerHeight, 'F');

    let x = margin;
    columns.forEach(col => {
      if (col.align === 'right') {
        doc.text(col.header, x + col.width - 2, yPos + 5.5);
      } else if (col.align === 'center') {
        doc.text(col.header, x + col.width / 2, yPos + 5.5, { align: 'center' });
      } else {
        doc.text(col.header, x + 2, yPos + 5.5);
      }
      x += col.width;
    });
    return yPos + headerHeight;
  };

  let y = drawHeader(48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  purchaseItems.forEach((item, index) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = drawHeader(20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }

    const price = Number(item.unit_price) || 0;
    const total = price * (item.recommended_quantity || 0);

    let x = margin;
    columns.forEach(col => {
      let val = String(item[col.key] ?? '');
      if (col.key === 'status') {
        val = item.status === 'critical' ? 'Critical' : item.status === 'manual' ? 'Manual' : 'Low';
      }
      if (col.key === 'unit_price') {
        val = price > 0 ? price.toLocaleString() : '-';
      }
      if (col.key === 'total') {
        val = total > 0 ? total.toLocaleString() : '-';
      }
      if (col.key === 'description' && val.length > 38) {
        val = val.substring(0, 38) + '...';
      }

      if (col.align === 'right') {
        doc.text(val, x + col.width - 2, y + 5);
      } else if (col.align === 'center') {
        doc.text(val, x + col.width / 2, y + 5, { align: 'center' });
      } else {
        doc.text(val, x + 2, y + 5, { maxWidth: col.width - 4 });
      }
      x += col.width;
    });

    y += rowHeight;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, pageHeight - 8);
  }

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`purchase_recommendations_${vendorName || 'vendor'}_${dateStr}.pdf`);
}