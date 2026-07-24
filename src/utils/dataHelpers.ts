import { ExtractionRecord, GroupedVehicle } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';


export function groupRecordsByLicensePlate(records: ExtractionRecord[], threshold: number = 4): GroupedVehicle[] {
  const map = new Map<string, ExtractionRecord[]>();

  records.forEach((rec) => {
    const plate = rec.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    if (!map.has(plate)) {
      map.set(plate, []);
    }
    map.get(plate)!.push(rec);
  });

  const groups: GroupedVehicle[] = [];

  map.forEach((recList, plate) => {
    // Sort records descending by parsed time
    const sorted = [...recList].sort(
      (a, b) => new Date(b.parsedDateISO).getTime() - new Date(a.parsedDateISO).getTime()
    );

    const photoCount = sorted.length;
    const isWarning = photoCount < threshold;
    const missingCount = isWarning ? threshold - photoCount : 0;
    const locations = Array.from(new Set(sorted.map((r) => r.location).filter(Boolean) as string[]));

    groups.push({
      licensePlate: plate,
      records: sorted,
      photoCount,
      latestTimestamp: sorted[0]?.timestamp || 'N/A',
      isWarning,
      requiredCount: threshold,
      missingCount,
      locations,
    });
  });

  // Sort groups: show Warning groups first or by photo count descending
  return groups.sort((a, b) => {
    if (a.isWarning !== b.isWarning) {
      return a.isWarning ? -1 : 1; // Put warnings at the top for attention
    }
    return b.photoCount - a.photoCount;
  });
}

export function calculateSystemStats(records: ExtractionRecord[], threshold: number = 4) {
  const totalRecords = records.length;
  const groups = groupRecordsByLicensePlate(records, threshold);
  const totalUniqueVehicles = groups.length;
  const warningPlatesCount = groups.filter((g) => g.isWarning).length;
  const compliantPlatesCount = groups.filter((g) => !g.isWarning).length;

  const avgConfidence = totalRecords > 0
    ? Math.round(records.reduce((acc, r) => acc + (r.confidence || 0), 0) / totalRecords)
    : 0;

  // Chart 1: Photo counts per vehicle plate with threshold line context
  const photosPerVehicleChart = groups.map((g) => ({
    name: g.licensePlate,
    'Số lượng ảnh': g.photoCount,
    'Chỉ tiêu tối thiểu': threshold,
    status: g.isWarning ? 'Thiếu ảnh' : 'Đạt',
  }));

  // Chart 2: Compliance ratio (Đạt vs Thiếu ảnh)
  const complianceDistribution = [
    { name: `Đạt chỉ tiêu (≥ ${threshold} ảnh)`, value: compliantPlatesCount, color: '#10b981' },
    { name: `Cảnh báo thiếu ảnh (< ${threshold} ảnh)`, value: warningPlatesCount, color: '#f43f5e' },
  ].filter((item) => item.value > 0);

  return {
    totalRecords,
    totalUniqueVehicles,
    warningPlatesCount,
    compliantPlatesCount,
    avgConfidence,
    photosPerVehicleChart,
    complianceDistribution,
    threshold,
  };
}

const getImageDimensions = (src: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 800, height: 600 }); // fallback
    img.src = src;
  });
};

export async function downloadXlsx(records: ExtractionRecord[], threshold: number = 4) {
  if (records.length === 0) return;

  const groupsMap = new Map<string, number>();
  records.forEach((r) => {
    const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    groupsMap.set(plate, (groupsMap.get(plate) || 0) + 1);
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('ThongKe');

  // Define columns
  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Biển số xe', key: 'plate', width: 20 },
    { header: 'Thời gian trích xuất', key: 'time', width: 25 },
    { header: 'Giờ', key: 'hour', width: 12 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Tổng ảnh', key: 'total', width: 15 },
    { header: 'Trạng thái (Chỉ tiêu ' + threshold + ' ảnh)', key: 'status', width: 40 },
    { header: 'Ảnh gốc', key: 'image', width: 25 },
    { header: 'Vị trí', key: 'location', width: 25 },
  ];

  // Format header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' } // Blue-600
    };
  });
  
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1 }
  ];

  const sortedRecords = [...records].sort((a, b) => {
    const plateA = (a.licensePlate || 'CHƯA RÕ BIỂN SỐ').trim().toUpperCase();
    const plateB = (b.licensePlate || 'CHƯA RÕ BIỂN SỐ').trim().toUpperCase();
    if (plateA < plateB) return -1;
    if (plateA > plateB) return 1;
    return new Date(b.parsedDateISO).getTime() - new Date(a.parsedDateISO).getTime();
  });

  for (let i = 0; i < sortedRecords.length; i++) {
    const r = sortedRecords[i];
    const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    const totalForPlate = groupsMap.get(plate) || 1;
    const isWarning = totalForPlate < threshold;
    const statusText = isWarning
      ? `CẢNH BÁO: Mới có ${totalForPlate}/${threshold} ảnh (Thiếu ${threshold - totalForPlate} ảnh)`
      : `ĐẠT: Có ${totalForPlate}/${threshold} ảnh`;

    const rowIndex = i + 2;

    worksheet.addRow({
      stt: i + 1,
      plate: r.licensePlate,
      time: r.timestamp,
      hour: r.formattedTime,
      date: r.formattedDate,
      total: totalForPlate,
      status: statusText,
      image: '', // Blank for embedded image
      location: r.location || '',
    });

    const row = worksheet.getRow(rowIndex);
    row.height = 100;
    row.alignment = { vertical: 'middle', wrapText: true };

    if (r.imageSrc && r.imageSrc.startsWith('data:image/')) {
      try {
        const base64Data = r.imageSrc.split(',')[1];
        const extension = r.imageSrc.substring(
          'data:image/'.length,
          r.imageSrc.indexOf(';base64')
        );
        
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: (extension === 'png' ? 'png' : 'jpeg') as any,
        });

        worksheet.addImage(imageId, {
          tl: { col: 7.1, row: rowIndex - 1 + 0.1 },
          ext: { width: 140, height: 100 },
          editAs: 'oneCell'
        });
      } catch (e) {
        console.error("Failed to add image to excel:", e);
      }
    }
  }

  // Create individual sheets for each license plate
  const groups = groupRecordsByLicensePlate(records, threshold);
  
  for (const group of groups) {
    const safePlate = group.licensePlate.replace(/[\[\]*?:\/\\]/g, '').substring(0, 31) || 'CHƯA RÕ BIỂN SỐ';
    // ensure unique sheet name if there's somehow a duplicate safePlate
    let sheetName = safePlate;
    let counter = 1;
    while (workbook.worksheets.some(ws => ws.name === sheetName)) {
      sheetName = `${safePlate.substring(0, 27)}_${counter}`;
      counter++;
    }
    
    const plateSheet = workbook.addWorksheet(sheetName);
    
    plateSheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Tên file', key: 'filename', width: 30 },
      { header: 'Thời gian trích xuất', key: 'time', width: 25 },
      { header: 'Ảnh gốc', key: 'image', width: 50 }, // Wider column for bigger image
    ];

    const pHeaderRow = plateSheet.getRow(1);
    pHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    pHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    pHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald-500
    });
    
    for (let j = 0; j < group.records.length; j++) {
      const rec = group.records[j];
      const pRowIndex = j + 2;
      
      plateSheet.addRow({
        stt: j + 1,
        filename: rec.fileName,
        time: rec.timestamp,
        image: '',
      });
      
      const pRow = plateSheet.getRow(pRowIndex);
      pRow.alignment = { vertical: 'middle', wrapText: true };
      
      if (rec.imageSrc && rec.imageSrc.startsWith('data:image/')) {
        try {
          const dims = await getImageDimensions(rec.imageSrc);
          const imgWidth = dims.width;
          const imgHeight = dims.height;

          // Excel row height is roughly pixels * 0.75
          pRow.height = imgHeight * 0.75 + 10; // add a little padding

          const base64Data = rec.imageSrc.split(',')[1];
          const extension = rec.imageSrc.substring(
            'data:image/'.length,
            rec.imageSrc.indexOf(';base64')
          );
          
          const imageId = workbook.addImage({
            base64: base64Data,
            extension: (extension === 'png' ? 'png' : 'jpeg') as any,
          });
          
          plateSheet.addImage(imageId, {
            tl: { col: 3.1, row: pRowIndex - 1 + 0.1 }, // Col 4 (index 3)
            ext: { width: imgWidth, height: imgHeight }, // Original size
            editAs: 'oneCell'
          });
        } catch (e) {
          console.error("Failed to add image to plate sheet:", e);
        }
      } else {
        pRow.height = 30; // Default height if no image
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `thong_ke_bien_so_xe_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
