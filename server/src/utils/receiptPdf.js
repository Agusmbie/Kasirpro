import PDFDocument from 'pdfkit';
import { formatLocalDateTime } from './helpers.js';

export function buildReceiptPDF({ sale, items, storeName = 'Bunian Jok Style' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [226, 600], margin: 12 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(12).text(storeName, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).text('Struk Penjualan', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(8).text(`No: ${sale.invoice_no}`);
    doc.text(`Tanggal: ${formatLocalDateTime(new Date(sale.transaction_date))}`);
    doc.text(`Kasir: ${sale.user_name || '-'}`);
    doc.text(`Pelanggan: ${sale.customer_name || 'Umum'}`);
    doc.moveDown(0.3);
    doc.text('--------------------------------');

    for (const it of items) {
      const line1 = `${it.product_name}`;
      doc.text(line1, { continued: false });
      const total = Number(it.qty) * Number(it.selling_price);
      doc.text(
        `${it.qty} x Rp ${Number(it.selling_price).toLocaleString('id-ID')}  Rp ${total.toLocaleString('id-ID')}`
      );
    }

    doc.text('--------------------------------');
    doc.text(`Subtotal: Rp ${Number(sale.subtotal).toLocaleString('id-ID')}`);
    doc.text(`Diskon: Rp ${Number(sale.discount).toLocaleString('id-ID')}`);
    doc.fontSize(10).text(`Total: Rp ${Number(sale.grand_total).toLocaleString('id-ID')}`);
    doc.fontSize(8).text(`Bayar: Rp ${Number(sale.paid_amount).toLocaleString('id-ID')}`);
    doc.text(`Kembalian: Rp ${Number(sale.change_amount).toLocaleString('id-ID')}`);
    doc.moveDown(0.5);
    doc.text('Terima kasih!', { align: 'center' });

    doc.end();
  });
}
