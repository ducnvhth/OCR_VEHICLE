export interface ExtractionRecord {
  id: string;
  fileName: string;
  imageSrc: string; // Base64 data URL or URL
  licensePlate: string; // Cleaned e.g. "38A-755.25"
  rawLicensePlate: string;
  timestamp: string; // Extracted format e.g. "17:47 23/07/2026"
  formattedTime: string; // Time portion e.g. "17:47"
  formattedDate: string; // Date portion e.g. "23/07/2026"
  parsedDateISO: string; // ISO format for sorting e.g. "2026-07-23T17:47:00"
  customOrder?: number; // Custom drag-and-drop order within a trip
  location?: string; // Optional location/watermark string e.g. "Hà Tĩnh, P. Vũng Áng"
  confidence: number; // e.g. 98 (%)
  notes?: string;
  processedAt: string;
  isEdited?: boolean;
}

export interface GroupedVehicle {
  licensePlate: string;
  records: ExtractionRecord[];
  photoCount: number;
  latestTimestamp: string;
  earliestTimestamp: string;
  isWarning: boolean;
  requiredCount: number;
  missingCount: number;
  isExcess?: boolean;
  excessCount?: number;
  locations: string[];
  tripIndex: number;       // Lượt thứ mấy (1-based)
  totalTrips: number;      // Tổng số lượt trong ngày cho biển số này
  tripDate: string;        // Ngày của lượt (DD/MM/YYYY)
}

export interface BatchProcessingProgress {
  total: number;
  completed: number;
  currentFileName: string;
  isProcessing: boolean;
}

export interface ProcessingError {
  fileName: string;
  error: string;
}

export interface JournalEntry {
  id: string;
  stt: string;
  licensePlate: string;
}
