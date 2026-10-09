import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { getCurrencySymbol, formatPrice, round2, showsSar, toSar } from '@/lib/partConstants';

export function exportPurchaseExcel(purchaseItems, vendorName, currency, sarRate) {
  const symbol = getCurrencySymbol(currency);
  const withSar = showsSar(currency, sarRate);
  const data = purchaseItems.map(r => {
    const price = Number(r.unit_price) || 0;
    const total = price * (r.recommended_quantity || 0);
    return {
      'Item Code': r.item_code,
      'Description': r.description,
      'Current Stock': r.current_stock,
      'Minimum Stock': r.minimum_stock,
      'Recommended Qty': r.recommended_quantity,
      [`Unit Price (${symbol})`]: round2(price),
      [`Total (${symbol})`]: round2(total),
      ...(withSar ? { 'Unit Price (SAR)': toSar(price, sarRate), 'Total (SAR)': toSar(total, sarRate) } : {}),
      'Status': r.status === 'critical' ? 'Critical' : r.status === 'manual' ? 'Manual' : 'Low',
    };
  });
  const grandTotal = purchaseItems.reduce((sum, r) => sum + (Number(r.unit_price) || 0) * (r.recommended_quantity || 0), 0);
  if (withSar) {
    data.push({ 'Description': 'Grand Total', [`Total (${symbol})`]: round2(grandTotal), 'Total (SAR)': toSar(grandTotal, sarRate) });
  }
  const ws = XLSX.utils.json_to_sheet(data);
  // Price and total columns (F, G, and the SAR columns H, I) display with two decimals.
  const moneyCols = withSar ? ['F', 'G', 'H', 'I'] : ['F', 'G'];
  for (let row = 2; row <= data.length + 1; row++) {
    for (const col of moneyCols) {
      if (ws[`${col}${row}`]) ws[`${col}${row}`].z = '#,##0.00';
    }
  }
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, ...(withSar ? [{ wch: 16 }, { wch: 16 }] : []), { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Purchase Recommendations');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `purchase_recommendations_${vendorName || 'vendor'}_${dateStr}.xlsx`);
}

export function exportPurchasePDF(purchaseItems, vendorName, currency, sarRate) {
  const symbol = getCurrencySymbol(currency);
  const withSar = showsSar(currency, sarRate);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;
  const tableWidth = pageWidth - 2 * margin;

  const columns = [
    { header: 'Item Code', key: 'item_code', width: 35, align: 'left' },
    { header: 'Description', key: 'description', width: withSar ? 50 : 70, align: 'left' },
    { header: 'Current', key: 'current_stock', width: 20, align: 'right' },
    { header: 'Min', key: 'minimum_stock', width: 20, align: 'right' },
    { header: 'Rec. Qty', key: 'recommended_quantity', width: 24, align: 'right' },
    { header: `Price(${symbol})`, key: 'unit_price', width: 28, align: 'right' },
    { header: `Total(${symbol})`, key: 'total', width: 36, align: 'right' },
    // jsPDF's built-in font cannot draw the Arabic riyal sign, so SAR is written in letters.
    ...(withSar ? [{ header: 'Total(SAR)', key: 'total_sar', width: 36, align: 'right' }] : []),
    { header: 'Status', key: 'status', width: withSar ? 14 : 30, align: 'center' },
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
  doc.text(`Grand Total: ${symbol} ${formatPrice(grandTotal)}`, pageWidth - margin - 80, withSar ? 32 : 38);
  if (withSar) doc.text(`Grand Total: SAR ${formatPrice(toSar(grandTotal, sarRate))} (1 ${currency} = ${sarRate} SAR)`, pageWidth - margin - 80, 38);

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
        val = price > 0 ? formatPrice(price) : '-';
      }
      if (col.key === 'total') {
        val = total > 0 ? formatPrice(total) : '-';
      }
      if (col.key === 'total_sar') {
        val = total > 0 ? formatPrice(toSar(total, sarRate)) : '-';
      }
      const maxDesc = withSar ? 27 : 38;
      if (col.key === 'description' && val.length > maxDesc) {
        val = val.substring(0, maxDesc) + '...';
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