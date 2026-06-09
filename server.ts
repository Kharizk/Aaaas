import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper to initialize GoogleGenAI with aistudio-build User-Agent
  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API 1: Market Price Discoverer
  app.post("/api/market-price", async (req, res) => {
    try {
      const { productName, region } = req.body;
      const ai = getAi();
      
      const prompt = `
        أريد معرفة أسعار السوق الحالية للمنتج التالي: "${productName}" في منطقة/دولة: "${region}".
        يرجى البحث في الويب عن أحدث الأسعار وتقديم استجابة بتنسيق JSON فقط، بدون أي نصوص إضافية أو علامات Markdown.
        يجب أن يكون الـ JSON بالهيكل التالي:
        {
          "averagePrice": "متوسط السعر كرقم",
          "priceRange": "نطاق السعر (مثال: 100 - 150)",
          "piecePrice": "سعر الحبة الواحدة التقريبي",
          "cartonPrice": "سعر الكرتون/الجملة التقريبي",
          "currency": "العملة المحلية (مثال: ريال سعودي)",
          "summary": "ملخص قصير عن حالة السعر في السوق وتوفره"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('لم يتم تلقي استجابة من الخادم.');
      }
      res.json({ text, candidates: response.candidates });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API 2: Smart Categories and Initial Items
  app.post("/api/smart-categories", async (req, res) => {
    try {
      const { context } = req.body;
      const ai = getAi();

      const prompt = `أنت خبير في هيكلة المتاجر وتصنيف المنتجات.
المتجر الخاص بنا يعمل في هذا المجال/التخصص: "${context}"

المطلوب إرجاع هيكل بيانات بتنسيق JSON فقط (بدون أي نصوص إضافية أو علامات Markdown).
الهيكل هو مصفوفة من الفئات (categories)، كل فئة تحتوي على:
1. id (نص عشوائي قصير)
2. name (اسم الفئة باللغة العربية)
3. items (مصفوفة من المنتجات)
   كل منتج يحتوي على:
   - id (نص عشوائي قصير)
   - name (اسم المنتج باللغة العربية)
   - defaultPrice (سعر منطقي تقريبي كـ رقم)
   - defaultStock (كمية منطقية متوفرة كـ رقم)

يرجى توليد 3 فئات رئيسية على الأقل، وفي كل فئة 4 منتجات منطقية لتخصص المتجر.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      res.json({ text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API 3: Catalog Image Generation
  app.post("/api/generate-catalog-images", async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getAi();

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview', 
        contents: prompt,
        config: {
          imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
          }
        } as any
      });

      let base64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      res.json({ base64Image });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });


  // API 4: Inventory Scanner
  app.post("/api/upload-inventory-scan", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const ai = getAi();

      const inventorySchema = {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  code: { type: Type.STRING, description: "The product code, SKU, or barcode if visible." },
                  category: { type: Type.STRING, description: "The classification or category of the product (القسم / التصنيف)." },
                  name: { type: Type.STRING, description: "The full name or description of the product/item (اسم الصنف / اسم المنتج / البيان). MUST NOT be empty." },
                  cartonQty: { type: Type.NUMBER, description: "The quantity in cartons/boxes (كمية الكرتون) if explicitly specified." },
                  qty: { type: Type.NUMBER, description: "The quantity in pieces/units (الكمية/الحبة). Must be a number." },
                  unit: { type: Type.STRING, description: "The unit of measure (e.g., PCS, KG, BOX) if available." },
                  expiryDate: { type: Type.STRING, description: "Expiry date in YYYY-MM-DD format if available." },
                  price: { type: Type.NUMBER, description: "Unit price if available." }
              },
              required: ["name"]
          }
      };

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
              {
                  parts: [
                      { 
                          text: `Extract inventory items. Return strict JSON. If qty missing use 0. If code missing use empty string. Use arabic text for name if it's in Arabic.` 
                      },
                      { inlineData: { mimeType, data: base64Data } }
                  ]
              }
          ],
          config: {
              responseMimeType: "application/json",
              responseSchema: inventorySchema
          }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
