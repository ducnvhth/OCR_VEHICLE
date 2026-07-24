import { ExtractionRecord, GroupedVehicle } from '../types';
import * as XLSX from 'xlsx';

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

export function downloadXlsx(records: ExtractionRecord[], threshold: number = 4) {
  if (records.length === 0) return;

  const groupsMap = new Map<string, number>();
  records.forEach((r) => {
    const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    groupsMap.set(plate, (groupsMap.get(plate) || 0) + 1);
  });

  const headers = [
    'STT',
    'Biển số xe',
    'Thời gian trích xuất',
    'Giờ',
    'Ngày',
    'Tổng ảnh của biển số này',
    'Trạng thái cảnh báo (Chỉ tiêu ' + threshold + ' ảnh)',
    'Độ tin cậy AI (%)',
    'Tên file',
    'Vị trí',
    'Ghi chú',
  ];

  const rows = records.map((r, index) => {
    const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    const totalForPlate = groupsMap.get(plate) || 1;
    const isWarning = totalForPlate < threshold;
    const statusText = isWarning
      ? `CẢNH BÁO: Mới có ${totalForPlate}/${threshold} ảnh (Thiếu ${threshold - totalForPlate} ảnh)`
      : `ĐẠT: Có ${totalForPlate}/${threshold} ảnh`;

    return [
      index + 1,
      r.licensePlate,
      r.timestamp,
      r.formattedTime,
      r.formattedDate,
      totalForPlate,
      statusText,
      r.confidence,
      r.fileName,
      r.location || '',
      r.notes || '',
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  // Auto-size columns slightly
  const wscols = headers.map(h => ({ wch: Math.max(15, h.length) }));
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKe');

  XLSX.writeFile(workbook, `thong_ke_bien_so_xe_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
