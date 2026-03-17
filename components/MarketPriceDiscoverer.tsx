import React, { useState } from 'react';
import { Search, MapPin, Loader2, DollarSign, TrendingUp, TrendingDown, ExternalLink, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface MarketPriceDiscovererProps {
  initialProductName?: string;
}

interface PriceResult {
  productName: string;
  region: string;
  averagePrice: string;
  priceRange: string;
  piecePrice: string;
  cartonPrice: string;
  currency: string;
  summary: string;
  sources: { title: string; uri: string }[];
}

export const MarketPriceDiscoverer: React.FC<MarketPriceDiscovererProps> = ({ initialProductName = '' }) => {
  const [productName, setProductName] = useState(initialProductName);
  const [region, setRegion] = useState('السعودية');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!productName.trim()) {
      setError('يرجى إدخال اسم المنتج');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Initialize Gemini API
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('مفتاح API الخاص بـ Gemini غير متوفر. يرجى إضافته في الإعدادات.');
      }

      const ai = new GoogleGenAI({ apiKey });

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
        model: 'gemini-3.1-pro-preview',
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

      const parsedData = JSON.parse(text);
      
      // Extract grounding sources if available
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
        .map((chunk: any) => ({
          title: chunk.web.title,
          uri: chunk.web.uri
        }));

      setResult({
        productName,
        region,
        averagePrice: parsedData.averagePrice || 'غير متوفر',
        priceRange: parsedData.priceRange || 'غير متوفر',
        piecePrice: parsedData.piecePrice || 'غير متوفر',
        cartonPrice: parsedData.cartonPrice || 'غير متوفر',
        currency: parsedData.currency || '',
        summary: parsedData.summary || 'لا يوجد ملخص متاح.',
        sources: sources
      });

    } catch (err: any) {
      console.error('Error fetching market prices:', err);
      setError(err.message || 'حدث خطأ أثناء جلب الأسعار. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Search size={32} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">مكتشف أسعار السوق</h2>
        <p className="text-slate-500 dark:text-slate-400">ابحث عن متوسط أسعار المنتجات في السوق المحلي باستخدام الذكاء الاصطناعي</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المنتج</label>
          <div className="relative">
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="مثال: ايفون 15 برو ماكس 256 جيجا"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">المنطقة / الدولة</label>
          <div className="relative">
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="مثال: السعودية"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSearch}
        disabled={isLoading || !productName.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>جاري البحث في السوق...</span>
          </>
        ) : (
          <>
            <Search size={20} />
            <span>اكتشف الأسعار</span>
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <DollarSign className="text-emerald-500" />
              نتائج البحث لـ <span className="text-blue-600 dark:text-blue-400">"{result.productName}"</span> في {result.region}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">متوسط السعر</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white flex items-baseline gap-2">
                  {result.averagePrice} <span className="text-sm font-bold text-slate-400">{result.currency}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">نطاق السعر في السوق</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">
                  {result.priceRange} <span className="text-sm text-slate-400">{result.currency}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">سعر الحبة</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">
                  {result.piecePrice} <span className="text-sm text-slate-400">{result.currency}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">سعر الكرتون</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">
                  {result.cartonPrice} <span className="text-sm text-slate-400">{result.currency}</span>
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/50 mb-6">
              <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <TrendingUp size={16} />
                ملخص السوق
              </h4>
              <p className="text-blue-900 dark:text-blue-100/80 text-sm leading-relaxed">
                {result.summary}
              </p>
            </div>

            {result.sources && result.sources.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <ExternalLink size={16} />
                  المصادر المرجعية
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{source.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
