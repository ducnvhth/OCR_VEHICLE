import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import { spawn } from "child_process";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

// Version will be read dynamically from package.json inside the API

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure production mode when running from pkg executable
if ((process as any).pkg) {
  process.env.NODE_ENV = "production";
}

const dbPath = path.join(process.cwd(), "db.json");
function readDb(): any[] {
  if (!fs.existsSync(dbPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    return data.map((record: any) => ({
      ...record,
      imageSrc: record.imageSrc || record.imageUrl
    }));
  } catch (e) {
    return [];
  }
}
function writeDb(records: any[]) {
  fs.writeFileSync(dbPath, JSON.stringify(records, null, 2), "utf-8");
}

const journalDbPath = path.join(process.cwd(), "journal.json");
function readJournalDb(): any[] {
  if (!fs.existsSync(journalDbPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(journalDbPath, "utf-8"));
  } catch (e) {
    return [];
  }
}
function writeJournalDb(records: any[]) {
  fs.writeFileSync(journalDbPath, JSON.stringify(records, null, 2), "utf-8");
}

const app = express();
const PORT = 3000;

// Increase payload limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize multiple Gemini SDK clients for rotation
let aiClients: GoogleGenAI[] = [];
let currentClientIndex = 0;

function initGeminiClients() {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k);
  
  if (keys.length === 0) {
    console.warn("Không tìm thấy GEMINI_API_KEYS trong file .env. Vui lòng cấu hình API Key.");
    keys.push("");
  }

  aiClients = keys.map(key => new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  }));
  console.log(`Đã nạp ${aiClients.length} API Keys. Sẵn sàng phân tải (Round-Robin).`);
}

// Initialize immediately on server start
initGeminiClients();

function getGeminiClient(): GoogleGenAI {
  const client = aiClients[currentClientIndex];
  // Rotate index
  currentClientIndex = (currentClientIndex + 1) % aiClients.length;
  
  return client;
}

// AUTO-UPDATE ENDPOINTS
app.get("/api/update/check", async (req, res) => {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const CURRENT_VERSION = "v" + (packageJson.version || "1.0.0").trim();

    const response = await fetch("https://api.github.com/repos/ducnvhth/OCR_VEHICLE/releases/latest", {
      headers: { "User-Agent": "OCR_VEHICLE_Updater" }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: "Không thể kết nối với GitHub API" });
    }
    
    const data = await response.json();
    const latestVersion = (data.tag_name || "").trim();
    const downloadUrl = data.assets?.find((a: any) => a.name.endsWith(".exe"))?.browser_download_url;

    const hasUpdate = latestVersion !== CURRENT_VERSION;
    console.log(`[Update Check] Hiện tại: ${CURRENT_VERSION}, GitHub: ${latestVersion}, Có update: ${hasUpdate}`);

    res.json({
      success: true,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      hasUpdate,
      downloadUrl,
      notes: data.body
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/update/install", async (req, res) => {
  try {
    const { downloadUrl } = req.body;
    if (!downloadUrl) return res.status(400).json({ success: false, error: "Thiếu đường dẫn tải xuống (downloadUrl)" });

    console.log(`[Updater] Đang tải bản cập nhật từ: ${downloadUrl}`);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Tải file thất bại: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const newExePath = path.join(process.cwd(), "update.exe");
    
    // Nơi executable đang chạy: nếu dùng "npm run dev", process.execPath là node.exe. 
    // Khi dùng pkg, process.execPath chính là đường dẫn file OCR_Vehicle.exe đang chạy.
    const currentExePath = process.execPath; 
    
    // Ghi file update.exe vào thư mục hiện tại
    fs.writeFileSync(newExePath, buffer);
    console.log(`[Updater] Tải xong, lưu tại: ${newExePath}`);

    // Bảo vệ khi đang chạy npm run dev (node.exe)
    if (process.env.NODE_ENV !== "production") {
      console.log("[Updater] Đang chạy ở chế độ DEV. Bỏ qua bước ghi đè file exe.");
      return res.json({ 
        success: true, 
        message: "Chế độ Test (Dev Mode): Đã tải file update.exe thành công, nhưng không ghi đè để bảo vệ hệ thống." 
      });
    }

    // Tạo file updater.bat để ghi đè file exe đang chạy (Chỉ chạy ở môi trường pkg/production)
    const batPath = path.join(process.cwd(), "updater.bat");
    // Mã script bat: chờ 2 giây -> xoá file cũ -> đổi tên update.exe thành file cũ -> chạy lại -> tự xoá bat
    const batContent = `
@echo off
echo Dang ap dung ban cap nhat... vui long doi!
timeout /t 2 /nobreak > NUL
del /f /q "${currentExePath}"
rename "${newExePath}" "OCR_Vehicle.exe"
start "" "OCR_Vehicle.exe"
del "%~f0"
`;
    fs.writeFileSync(batPath, batContent, "utf-8");

    // Khởi chạy file bat một cách độc lập (detached)
    const child = spawn("cmd.exe", ["/c", batPath], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd()
    });
    child.unref();

    res.json({ success: true, message: "Bắt đầu cập nhật. Phần mềm sẽ tự động khởi động lại trong vài giây." });

    // Thoát phần mềm hiện tại để script bat có quyền ghi đè file
    setTimeout(() => {
      process.exit(0);
    }, 500);

  } catch (error: any) {
    console.error("[Updater] Lỗi cài đặt bản cập nhật:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
    apiKeysCount: aiClients.length,
    timestamp: new Date().toISOString(),
  });
});

// Auto Updater API
app.post("/api/do-update", (req, res) => {
  const downloadUrl = req.body.downloadUrl;
  if (!downloadUrl) return res.status(400).json({ success: false, error: "Missing downloadUrl" });

  const tempExePath = path.join(process.cwd(), "update_temp.exe");
  const batPath = path.join(process.cwd(), "apply_update.bat");

  const downloadFile = (url: string, dest: string, cb: (err?: Error) => void) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location!, dest, cb);
      }
      if (response.statusCode !== 200) {
        return cb(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        cb();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      cb(err);
    });
  };

  downloadFile(downloadUrl, tempExePath, (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const batContent = `
@echo off
echo Dang cap nhat phan mem... Vui long doi trong giay lat...
timeout /t 3 /nobreak > NUL
taskkill /F /IM OCR_Vehicle.exe > NUL
del OCR_Vehicle.exe
rename update_temp.exe OCR_Vehicle.exe
start "" "OCR_Vehicle.exe"
del "%~f0"
    `.trim();

    fs.writeFileSync(batPath, batContent, "utf-8");

    const child = spawn("cmd.exe", ["/c", batPath], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd()
    });
    child.unref();

    res.json({ success: true });

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
});

// Fetch all saved records from DB
app.get("/api/records", (req, res) => {
  const records = readDb();
  res.json({ success: true, records });
});

// Delete a single record from DB
app.delete("/api/records/:id", (req, res) => {
  const id = req.params.id;
  let records = readDb();
  records = records.filter(r => r.id !== id);
  writeDb(records);
  res.json({ success: true });
});

// Delete all records
app.delete("/api/records", (req, res) => {
  writeDb([]);
  res.json({ success: true });
});

// Update a single record
app.put("/api/records/:id", express.json(), (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
  let records = readDb();
  
  const index = records.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    // Preserve imageSrc backward compatibility and merge new data
    records[index] = { ...records[index], ...updatedData, isEdited: true };
    writeDb(records);
    return res.json({ success: true, record: records[index] });
  }
  return res.status(404).json({ success: false, error: "Record not found" });
});

// JOURNAL ENDPOINTS
app.get("/api/journal", (req, res) => {
  const records = readJournalDb();
  res.json({ success: true, records });
});

app.post("/api/journal", express.json(), (req, res) => {
  const newEntry = req.body;
  let records = readJournalDb();

  // Server tự tính STT để tránh race condition từ client
  const maxStt = records.length > 0
    ? Math.max(...records.map((r: any) => parseInt(r.stt, 10) || 0))
    : 0;
  newEntry.stt = (maxStt + 1).toString();

  records.push(newEntry);
  writeJournalDb(records);
  res.json({ success: true, record: newEntry });
});

app.put("/api/journal/:id", express.json(), (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
  let records = readJournalDb();
  
  const index = records.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    records[index] = { ...records[index], ...updatedData };
    writeJournalDb(records);
    return res.json({ success: true, record: records[index] });
  }
  return res.status(404).json({ success: false, error: "Journal entry not found" });
});

app.delete("/api/journal/:id", (req, res) => {
  const id = req.params.id;
  let records = readJournalDb();
  records = records.filter(r => r.id !== id);
  writeJournalDb(records);
  res.json({ success: true });
});

// Delete all journal entries
app.delete("/api/journal", (req, res) => {
  writeJournalDb([]);
  res.json({ success: true });
});

app.post("/api/journal/batch", express.json(), (req, res) => {
  const { mapping } = req.body;
  let records = readJournalDb();
  
  // Convert mapping (plate -> stt array) to array of entries and merge
  Object.keys(mapping).forEach(plate => {
    const sttArray = mapping[plate];
    
    if (Array.isArray(sttArray)) {
      // Xóa tất cả các bản ghi nhật trình cũ của biển số này
      records = records.filter(r => r.licensePlate !== plate);
      
      // Thêm lại các bản ghi mới theo đúng thứ tự mảng STT (thứ tự thời gian)
      sttArray.forEach((stt, index) => {
        records.push({
          id: "jrn_" + Date.now() + "_" + index + "_" + Math.random().toString(36).substring(2, 7),
          licensePlate: plate,
          stt: stt
        });
      });
    }
  });
  
  writeJournalDb(records);
  res.json({ success: true, records });
});

// Manual Record Entry Endpoint (no AI)
app.post("/api/records/manual", async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      fileName,
      licensePlate,
      formattedTime,
      formattedDate,
      location,
      notes,
      parsedDateISO,
    } = req.body;

    if (!licensePlate || !formattedTime || !formattedDate) {
      return res.status(400).json({ success: false, error: "Biển số, giờ và ngày là bắt buộc." });
    }

    // Build ISO timestamp for sorting
    let isoDate = parsedDateISO;
    if (!isoDate) {
      isoDate = new Date().toISOString();
      try {
        const [day, month, year] = formattedDate.split("/");
        const [hour, minute] = formattedTime.split(":");
        if (day && month && year && hour && minute) {
          const dateObj = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10)
          );
          if (!isNaN(dateObj.getTime())) {
            isoDate = dateObj.toISOString();
          }
        }
      } catch (err) {
        console.warn("Could not parse date format for manual entry", err);
      }
    }

    // Save image if provided
    let imageUrl = "";
    const cleanFileName = fileName
      ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")
      : `manual_${Date.now()}.jpg`;
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanFileName}`;

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imagePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(imagePath, cleanBase64, "base64");
      imageUrl = `/uploads/${uniqueFileName}`;
    }

    const normalizedPlate = licensePlate.trim().toUpperCase();

    const record = {
      id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      fileName: fileName || uniqueFileName,
      imageUrl: imageUrl || "",
      imageSrc: imageUrl || "",
      licensePlate: normalizedPlate,
      rawLicensePlate: normalizedPlate,
      timestamp: `${formattedTime} ${formattedDate}`,
      formattedTime,
      formattedDate,
      parsedDateISO: isoDate,
      location: location || "",
      confidence: 100,
      notes: notes || "Nhập thủ công",
      processedAt: new Date().toLocaleTimeString("vi-VN"),
      isManual: true,
    };

    const dbRecords = readDb();
    dbRecords.unshift(record);
    writeDb(dbRecords);

    return res.json({ success: true, record });
  } catch (error: any) {
    console.error("Lỗi khi lưu record thủ công:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Đã xảy ra lỗi khi lưu dữ liệu.",
    });
  }
});

// Image Analysis Endpoint using Gemini 3.6 Flash
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", fileName = "image.jpg" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Thừa số imageBase64 không được bỏ trống." });
    }

    // Check if file already exists in DB
    const records = readDb();
    const existingRecord = records.find(r => r.fileName === fileName);
    if (existingRecord) {
      console.log(`Bỏ qua OCR cho file [${fileName}] vì đã có trong DB.`);
      return res.json({ success: true, record: existingRecord });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const imagePath = path.join(uploadsDir, uniqueFileName);
    fs.writeFileSync(imagePath, cleanBase64, 'base64');
    const imageUrl = `/uploads/${uniqueFileName}`;

    const prompt = `Phân tích chi tiết bức ảnh chụp xe / phương tiện giao thông / xe công trình.
Nhiệm vụ chính của bạn là trích xuất 2 THÔNG TIN QUAN TRỌNG NHẤT:
1. "Biển số xe" (License Plate): Nhận diện CHÍNH XÁC biển kiểm soát theo định dạng Việt Nam (ví dụ: 38A-755.25, 38C-204.38, 38B-018.01, 74A-396.95, 36H-160.06, 36K-236.72). Nếu biển số gầm bị che/mờ, hãy đọc các chữ số ghi trên thân xe/thành xe/cabin để xác định chính xác biển số.
2. "Thời gian" (Timestamp): Trích xuất giờ:phút (HH:mm) và ngày/tháng/năm (DD/MM/YYYY) ghi trên ảnh (ví dụ từ watermark Timemark góc ảnh: "17:47 23/07/2026").
3. (Tùy chọn) Vị trí / Địa điểm nếu xuất hiện trên watermark (ví dụ: "Hà Tĩnh, P. Vũng Áng").
4. Đánh giá độ tin cậy nhận diện AI (confidence từ 50 đến 100%).
5. Viết ghi chú ngắn gọn bằng tiếng Việt.`;

    let response;
    
    // Failover Retry Loop
    while (true) {
      const ai = getGeminiClient();
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                licensePlate: {
                  type: Type.STRING,
                  description: "Biển số xe nhận diện được (ví dụ: 38A-755.25, 36H-160.06)",
                },
                rawLicensePlate: {
                  type: Type.STRING,
                  description: "Ký tự biển số thô đọc được",
                },
                formattedTime: {
                  type: Type.STRING,
                  description: "Giờ:phút trích xuất từ ảnh ví dụ: 17:47",
                },
                formattedDate: {
                  type: Type.STRING,
                  description: "Ngày/Tháng/Năm trích xuất từ ảnh ví dụ: 23/07/2026",
                },
                location: {
                  type: Type.STRING,
                  description: "Địa điểm / Vị trí trên watermark nếu có",
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Độ tin cậy % từ 50 đến 100",
                },
                notes: {
                  type: Type.STRING,
                  description: "Ghi chú tóm tắt tiếng Việt",
                },
              },
              required: [
                "licensePlate",
                "formattedTime",
                "formattedDate",
                "confidence",
              ],
            },
          },
        });
        
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.status === 429 || (error.message && error.message.includes("quota"))) {
          console.warn("API Key hiện tại đã hết Quota (429). Loại bỏ khỏi danh sách luân phiên và thử key tiếp theo...");
          aiClients = aiClients.filter(c => c !== ai);
          if (aiClients.length === 0) {
            throw new Error("Tất cả các API Keys đều đã hết hạn mức Quota (429)! Vui lòng thêm Key mới vào file .env.");
          }
          if (currentClientIndex >= aiClients.length) {
            currentClientIndex = 0;
          }
          // continue the while loop to retry with the next key
        } else {
          // Other error, just throw it normally
          throw error;
        }
      }
    }



    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);

    // Build ISO timestamp for sorting
    let isoDate = new Date().toISOString();
    if (result.formattedDate && result.formattedTime) {
      try {
        const [day, month, year] = result.formattedDate.split("/");
        const [hour, minute] = result.formattedTime.split(":");
        if (day && month && year && hour && minute) {
          const dateObj = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10)
          );
          if (!isNaN(dateObj.getTime())) {
            isoDate = dateObj.toISOString();
          }
        }
      } catch (err) {
        console.warn("Could not parse date format for sorting", err);
      }
    }

    const record = {
      id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      fileName,
      imageUrl,
      imageSrc: imageUrl,
      licensePlate: result.licensePlate || "Chưa rõ biển số",
      rawLicensePlate: result.rawLicensePlate || result.licensePlate || "",
      timestamp: `${result.formattedTime || "17:00"} ${result.formattedDate || "23/07/2026"}`,
      formattedTime: result.formattedTime || "17:00",
      formattedDate: result.formattedDate || "23/07/2026",
      parsedDateISO: isoDate,
      location: result.location || "Hà Tĩnh",
      confidence: Math.round(result.confidence || 95),
      notes: result.notes || "Trích xuất biển số & thời gian thành công",
      processedAt: new Date().toLocaleTimeString("vi-VN"),
    };

    // Save to DB
    const dbRecords = readDb();
    dbRecords.unshift(record);
    writeDb(dbRecords);

    return res.json({ success: true, record });
  } catch (error: any) {
    console.error("Lỗi khi xử lý hình ảnh với Gemini AI:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Đã xảy ra lỗi trong quá trình nhận diện hình ảnh.",
    });
  }
});

// Start Express and integrate Vite
async function startServer() {
  app.use('/uploads', express.static(uploadsDir));
  
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Sử dụng __dirname thay vì process.cwd() để khi đóng gói .exe bằng pkg, 
    // express vẫn tìm thấy thư mục dist/ nằm gọn bên trong file .exe
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
