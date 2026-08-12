import ExcelJS from 'exceljs';

export async function buildMutationsWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KasPro';
  const ws = wb.addWorksheet('Mutasi Stok');
  ws.columns = [
    { header: 'Tanggal', key: 'created_at', width: 22 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Produk', key: 'product_name', width: 28 },
    { header: 'Tipe', key: 'reference_type', width: 12 },
    { header: 'Qty Perubahan', key: 'qty_change', width: 14 },
    { header: 'Stok Akhir', key: 'stock_after', width: 12 },
    { header: 'Keterangan', key: 'description', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      created_at: r.created_at,
      sku: r.sku,
      product_name: r.product_name,
      reference_type: r.reference_type,
      qty_change: r.qty_change,
      stock_after: r.stock_after,
      description: r.description,
    });
  }
  return wb;
}

export async function workbookBuffer(wb) {
  return wb.xlsx.writeBuffer();
}
