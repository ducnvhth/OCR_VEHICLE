import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

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

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
    apiKeysCount: aiClients.length,
    timestamp: new Date().toISOString(),
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
  
  // Convert mapping (plate -> stt) to array of entries and merge
  Object.keys(mapping).forEach(plate => {
    const stt = mapping[plate];
    const existingIndex = records.findIndex((r: any) => r.licensePlate === plate);
    if (existingIndex !== -1) {
      records[existingIndex].stt = stt;
    } else {
      records.push({
        id: "jrn_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        licensePlate: plate,
        stt: stt
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
