
import * as XLSX from 'xlsx';

export const generateExcelTemplate = () => {
  const headers = [
    { 'كود المنتج': 'P-001', 'اسم المنتج': 'مثال منتج 1', 'الوحدة': 'قطعة', 'التصنيف': 'عام' },
    { 'كود المنتج': 'P-002', 'اسم المنتج': 'مثال منتج 2', 'الوحدة': 'كيلو', 'التصنيف': 'حبوب' }
  ];

  const ws = XLSX.utils.json_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نموذج المنتجات");
  XLSX.writeFile(wb, "نموذج_استيراد_المنتجات.xlsx");
};

export const generateInventoryTemplate = () => {
  const headers = [
    { 
      'كود الصنف': '1001', 
      'اسم الصنف': 'منتج تجريبي', 
      'الكمية': 50, 
      'الوحدة': 'قطعة', 
      'تاريخ الصلاحية': '2025-12-31' 
    },
    { 
      'كود الصنف': '1002', 
      'اسم الصنف': 'منتج آخر', 
      'الكمية': 12, 
      'الوحدة': 'كرتون', 
      'تاريخ الصلاحية': '' 
    }
  ];

  const ws = XLSX.utils.json_to_sheet(headers);
  // Adjust column widths
  ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نموذج الجرد");
  XLSX.writeFile(wb, "نموذج_الجرد_والمخزون.xlsx");
};

export const generateSalesTemplate = () => {
  const headers = [
    { 'التاريخ': new Date().toISOString().split('T')[0], 'اسم الفرع': 'الفرع الرئيسي', 'المبلغ': 1500, 'ملاحظات': 'مبيعات نقدية' },
    { 'التاريخ': new Date().toISOString().split('T')[0], 'اسم الفرع': 'فرع الرياض', 'المبلغ': 2000, 'ملاحظات': 'شامل الضريبة' }
  ];

  const ws = XLSX.utils.json_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نموذج المبيعات");
  XLSX.writeFile(wb, "نموذج_استيراد_المبيعات.xlsx");
};

export const exportDataToExcel = (data: any[], fileName: string, sheetName: string = "Sheet1") => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    // Setting column widths for better readability
    const wscols = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    ws['!cols'] = wscols;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use header: 1 to get raw array of arrays, then sanitize headers
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rawData.length === 0) {
            resolve([]);
            return;
        }

        const headers = (rawData[0] as string[]).map(h => h ? h.toString().trim() : '');
        const rows = rawData.slice(1);

        const jsonData = rows.map((row: any) => {
            const obj: any = {};
            headers.forEach((header, index) => {
                if (header) {
                    obj[header] = row[index];
                }
            });
            return obj;
        });

        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
