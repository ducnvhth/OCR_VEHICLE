import { ExtractionRecord, GroupedVehicle } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export function formatLicensePlate(plate: string): string {
  if (!plate) return plate;
  
  // Clean all characters except A-Z, 0-9, and hyphen/dot
  const raw = plate.toUpperCase();

  // Helper to format a single standard plate
  const formatSingle = (p: string) => {
    const clean = p.replace(/[^A-Z0-9]/ig, '');
    let match = clean.match(/^(\d{2}[A-Z]{1,2})(\d{3})(\d{2})$/);
    if (match) return `${match[1]}-${match[2]}.${match[3]}`;
    match = clean.match(/^(\d{2}[A-Z]{1,2})(\d{4})$/);
    if (match) return `${match[1]}-${match[2]}`;
    match = clean.match(/^([A-Z]{2})(\d{2})(\d{2})$/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return p.replace(/[^A-Z0-9\-.]/ig, ''); // Keep hyphens/dots if no match
  };

  // If the user inputs a tractor-trailer separated by space or hyphen (e.g., "38H06043 38RM00803" or "38H06043-38RM00803")
  // We can try to format the whole string first. If it's a standard single plate, formatSingle handles it.
  
  // A standard single plate without punctuation is at most 9 chars (e.g. 29LD12345).
  // If the raw input is much longer, it might be a dual plate.
  const alphanumericOnly = raw.replace(/[^A-Z0-9]/ig, '');
  
  // If the string contains a hyphen, but it's actually just one plate (e.g. "38A-123.45"), formatSingle will handle it 
  // because formatSingle strips hyphens internally to match the regex.
  // BUT if we pass "38H06043-38RM00803", formatSingle will strip the hyphen and fail to match, returning the original string.
  // We want to detect if it's two plates.
  
  // Try treating it as a single plate first
  const singleFormatted = formatSingle(raw);
  const cleanSingle = singleFormatted.replace(/[^A-Z0-9]/ig, '');
  
  // If formatSingle matched a standard regex, it will add a dot (for 5 digits) or a dash.
  // But if it didn't match, cleanSingle === alphanumericOnly.
  // If it didn't match and the length is >= 14 (two 7-char plates), let's try splitting it.
  if (cleanSingle === alphanumericOnly && alphanumericOnly.length >= 13) {
    // It's likely a dual plate. 
    // Does the user input have a hyphen or space?
    let separator = null;
    if (raw.includes('-')) separator = '-';
    else if (raw.includes(' ')) separator = ' ';

    if (separator) {
      const parts = raw.split(separator);
      // If it's like 38H06043-38RM00803, parts are "38H06043" and "38RM00803"
      // If it's 38A-12345, parts are "38A" and "12345"
      // We only want to format each part if BOTH parts look like valid plates (at least 6 chars)
      if (parts.length === 2 && parts[0].replace(/[^A-Z0-9]/g, '').length >= 6 && parts[1].replace(/[^A-Z0-9]/g, '').length >= 6) {
        return `${formatSingle(parts[0])} - ${formatSingle(parts[1])}`;
      }
    }
  }

  return singleFormatted;
}
export function groupRecordsByLicensePlate(
  records: ExtractionRecord[],
  threshold: number = 4,
  tripGapMinutes: number = 60
): GroupedVehicle[] {
  // Step 1: Group all records by license plate
  const plateMap = new Map<string, ExtractionRecord[]>();
  records.forEach((rec) => {
    const plate = rec.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    if (!plateMap.has(plate)) plateMap.set(plate, []);
    plateMap.get(plate)!.push(rec);
  });

  const groups: GroupedVehicle[] = [];
  const GAP_MS = tripGapMinutes * 60 * 1000;

  plateMap.forEach((recList, plate) => {
    // Step 2: Sort records chronologically (oldest first)
    const sorted = [...recList].sort(
      (a, b) => new Date(a.parsedDateISO).getTime() - new Date(b.parsedDateISO).getTime()
    );

    // Step 3: Cluster into trips using gap-based algorithm
    // A new trip starts when two consecutive records are > GAP_MS apart
    const trips: ExtractionRecord[][] = [];
    let currentTrip: ExtractionRecord[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].parsedDateISO).getTime();
      const curr = new Date(sorted[i].parsedDateISO).getTime();
      const gap = curr - prev;

      if (gap > GAP_MS) {
        // Start a new trip
        trips.push(currentTrip);
        currentTrip = [sorted[i]];
      } else {
        currentTrip.push(sorted[i]);
      }
    }
    trips.push(currentTrip); // Push the last trip

    const totalTrips = trips.length;

    // Step 4: Create a GroupedVehicle for each trip
    trips.forEach((tripRecords, tripIdx) => {
      // Sort records within a trip (respect customOrder, else chronological oldest-first)
      const displaySorted = [...tripRecords].sort((a, b) => {
        if (a.customOrder !== undefined && b.customOrder !== undefined) {
          return a.customOrder - b.customOrder;
        }
        return new Date(a.parsedDateISO).getTime() - new Date(b.parsedDateISO).getTime();
      });

      const photoCount = displaySorted.length;
      const isWarning = photoCount < threshold;
      const missingCount = isWarning ? threshold - photoCount : 0;
      const locations = Array.from(
        new Set(displaySorted.map((r) => r.location).filter(Boolean) as string[])
      );

      // Use earliest record for the trip date
      const earliestRec = tripRecords[0]; // already sorted ascending
      const latestRec = tripRecords[tripRecords.length - 1];

      groups.push({
        licensePlate: plate,
        records: displaySorted,
        photoCount,
        latestTimestamp: latestRec.timestamp,
        earliestTimestamp: earliestRec.timestamp,
        isWarning,
        requiredCount: threshold,
        missingCount,
        locations,
        tripIndex: tripIdx + 1,
        totalTrips,
        tripDate: earliestRec.formattedDate || '',
      });
    });
  });

  // Step 5: Sort groups — warnings first, then by latest timestamp desc
  return groups.sort((a, b) => {
    if (a.isWarning !== b.isWarning) return a.isWarning ? -1 : 1;
    // Sort by earliest time of trip descending (most recent trip first)
    const aTime = new Date(a.records[a.records.length - 1]?.parsedDateISO || 0).getTime();
    const bTime = new Date(b.records[b.records.length - 1]?.parsedDateISO || 0).getTime();
    return bTime - aTime;
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

async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to fetch image for excel:", error);
    return null;
  }
}

export async function downloadXlsx(records: ExtractionRecord[], threshold: number = 4, tripGapMinutes: number = 60) {
  if (records.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('ThongKe');

  // Define columns based on user request
  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Ngày tháng', key: 'date', width: 15 },
    { header: 'Biển số xe', key: 'plate', width: 20 },
    { header: 'Giờ vào', key: 'timeIn', width: 12 },
    { header: 'Giờ ra', key: 'timeOut', width: 12 },
    { header: 'Số chuyến', key: 'trips', width: 12 },
    { header: 'LOẠI VT', key: 'type', width: 15 },
    { header: 'Ghi chú', key: 'note', width: 25 },
  ];

  // Format header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Specific header formatting
  headerRow.getCell('stt').font = { bold: true, color: { argb: 'FFFF0000' } };
  headerRow.getCell('type').font = { bold: true, color: { argb: 'FFFF0000' } };
  
  // Thin borders for headers
  headerRow.eachCell((cell) => {
    cell.border = {
      top: {style:'thin'},
      left: {style:'thin'},
      bottom: {style:'thin'},
      right: {style:'thin'}
    };
  });

  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1 }
  ];

  // Compute trip groups to know totalTrips per plate per day
  const tripGroups = groupRecordsByLicensePlate(records, threshold, tripGapMinutes);
  // Map: "PLATE|DATE" -> totalTrips
  const tripCountMap = new Map<string, number>();
  tripGroups.forEach(g => {
    const key = `${g.licensePlate}|${g.tripDate}`;
    // totalTrips is the same for all trips of the same plate on same day
    tripCountMap.set(key, g.totalTrips);
  });

  const sortedRecords = [...records].sort((a, b) =>
    new Date(a.parsedDateISO).getTime() - new Date(b.parsedDateISO).getTime()
  );

  // Determine isWarning per plate across all its trips (any trip warns -> warn)
  const plateWarningMap = new Map<string, boolean>();
  tripGroups.forEach(g => {
    const prev = plateWarningMap.get(g.licensePlate) ?? false;
    plateWarningMap.set(g.licensePlate, prev || g.isWarning);
  });

  for (let i = 0; i < sortedRecords.length; i++) {
    const r = sortedRecords[i];
    const plate = r.licensePlate.trim().toUpperCase() || 'CHƯA RÕ BIỂN SỐ';
    
    const key = `${plate}|${r.formattedDate}`;
    const totalTrips = tripCountMap.get(key) || 1;
    const isWarning = plateWarningMap.get(plate) ?? false;

    const rowIndex = i + 2;

    worksheet.addRow({
      stt: i + 1,
      date: r.formattedDate,
      plate: plate,
      timeIn: r.formattedTime,
      timeOut: 'X',
      trips: totalTrips,
      type: 'ĐĐXB',
      note: 'CỔNG 5 NMT',
    });

    const row = worksheet.getRow(rowIndex);
    row.height = 25;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Plate and Type formatting
    row.getCell('stt').font = { color: { argb: 'FFFF0000' } };
    row.getCell('plate').font = { bold: true };
    row.getCell('type').font = { bold: true, color: { argb: 'FFFF0000' } };
    
    // Set borders for all cells in row
    row.eachCell((cell) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });

    // Apply red background if plate meets criteria (NOT warning)
    if (!isWarning) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC0CB' }
        };
      });
    }
  }


  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `thong_ke_bien_so_xe_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadImagesZip(
  records: ExtractionRecord[], 
  journalMapping?: Record<string, string[]>,
  tripGapMinutes: number = 60
) {
  if (records.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder("Images");
  
  if (!folder) return;

  // Group records by plate using the same gap setting as the UI
  const grouped = groupRecordsByLicensePlate(records, 0, tripGapMinutes);

  // For each plate, sort by time and download
  for (const group of grouped) {
    const rawPlate = group.licensePlate.trim().toUpperCase();
    const safePlate = group.licensePlate.replace(/[\[\]*?:\/\\]/g, '').trim() || 'CHUA_RO';
    
    // Sort records based on customOrder or chronological
    const sorted = [...group.records].sort((a, b) => {
      if (a.customOrder !== undefined && b.customOrder !== undefined) {
        return a.customOrder - b.customOrder;
      }
      return new Date(a.parsedDateISO).getTime() - new Date(b.parsedDateISO).getTime();
    });

    let stt = null;
    if (journalMapping && journalMapping[rawPlate]) {
      const sttArray = journalMapping[rawPlate];
      // group.tripIndex is 1-based, so subtract 1 to get array index
      stt = sttArray[group.tripIndex - 1] || sttArray[sttArray.length - 1];
    }

    for (let i = 0; i < sorted.length; i++) {
      const rec = sorted[i];
      if (rec.imageSrc) {
        try {
          const base64Image = await fetchImageAsBase64(rec.imageSrc);
          if (base64Image && base64Image.startsWith('data:image/')) {
            const base64Data = base64Image.split(',')[1];
            const extension = base64Image.substring(
              'data:image/'.length,
              base64Image.indexOf(';base64')
            ) === 'png' ? 'png' : 'jpg';
            
            let fileName = '';
            if (stt) {
              fileName = `${stt}.${i + 1}.${extension}`;
            } else {
              fileName = `${safePlate}_${i + 1}.${extension}`;
            }

            folder.file(fileName, base64Data, { base64: true });
          }
        } catch (e) {
          console.error(`Failed to fetch image for ${safePlate}:`, e);
        }
      }
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `hinh_anh_bien_so_${new Date().toISOString().slice(0, 10)}.rar`);
}

export async function exportJournalXlsx(entries: any[], records?: ExtractionRecord[], tripGapMinutes: number = 60) {
  if (entries.length === 0) return;

  let grouped: any[] = [];
  if (records && records.length > 0) {
    grouped = groupRecordsByLicensePlate(records, 0, tripGapMinutes);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('NhatTrinh');

  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 10 },
    { header: 'Biển số xe', key: 'plate', width: 25 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Giờ', key: 'time', width: 15 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: {style:'thin'},
      left: {style:'thin'},
      bottom: {style:'thin'},
      right: {style:'thin'}
    };
  });

  entries.forEach((entry, i) => {
    let dateStr = entry.dateStr || '';
    let timeStr = entry.timeStr || '';
    
    if (records && !entry.dateStr && !entry.timeStr) {
      const tripsForPlate = grouped
        .filter(g => g.licensePlate === entry.licensePlate)
        .sort((a, b) => a.tripIndex - b.tripIndex);
      const allEntriesForPlate = entries.filter(e => e.licensePlate === entry.licensePlate);
      const entryIndex = allEntriesForPlate.findIndex(e => e.id === entry.id);
      
      if (entryIndex >= 0 && entryIndex < tripsForPlate.length) {
        const trip = tripsForPlate[entryIndex];
        const earliestRec = trip.records[trip.records.length - 1]; // displaySorted is newest-first, so last is earliest
        if (earliestRec) {
          dateStr = earliestRec.formattedDate;
          timeStr = earliestRec.formattedTime;
        }
      }
    }

    worksheet.addRow({
      stt: entry.stt,
      plate: entry.licensePlate,
      date: dateStr,
      time: timeStr,
    });
    
    const row = worksheet.getRow(i + 2);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.eachCell((cell) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `nhat_trinh_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
