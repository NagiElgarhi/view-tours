
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  history: string;
  architecture: string;
  funFacts: string[];
}

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Gemini and Analyze
  const analyzeImage = async (base64Data: string) => {
    setLoading(true);
    setError(null);
    try {
      // Create a new GoogleGenAI instance right before making an API call 
      // to ensure it always uses the most up-to-date API key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `أنت خبير سياحي ومؤرخ عالمي. قم بتحليل هذه الصورة لمبنى أو معلم سياحي.
      يجب أن تكون الإجابة باللغة العربية الفصحى.
      قدم المعلومات التالية بتنسيق JSON:
      1. title: اسم المعلم أو المبنى.
      2. history: شرح واف لتاريخ المكان ونشأته.
      3. architecture: وصف للنمط المعماري والميزات الهندسية.
      4. funFacts: قائمة من 3 حقائق ممتعة أو أسرار عن المكان.
      
      إذا لم يكن المكان معلماً معروفاً، حاول وصف ما تراه وتقديم معلومات عامة عنه.`;

      const response = await ai.models.generateContent({
        // Updated to a valid model name as per instructions
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data.split(',')[1] } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || '{}');
      setResult(data as AnalysisResult);
    } catch (err: any) {
      console.error(err);
      
      // Handle the "Requested entity was not found" error which often indicates an API key/project issue
      if (err.message?.includes("Requested entity was not found") || (err.status === "NOT_FOUND")) {
        setError("يبدو أن هناك مشكلة في مفتاح التشغيل. يرجى إعادة اختيار مفتاح API صالح.");
        // If the window.aistudio helper exists, we could prompt to re-select
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
           const retry = confirm("حدث خطأ في الوصول للمحرك (404). هل تود محاولة اختيار مفتاح API جديد من قائمة المشاريع المدفوعة؟");
           if (retry) {
             window.aistudio.openSelectKey();
           }
        }
      } else {
        setError("عذراً، حدث خطأ أثناء تحليل الصورة. يرجى التأكد من اتصال الإنترنت أو المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setImage(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن.");
      setIsScanning(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImage(dataUrl);
      stopCamera();
      analyzeImage(dataUrl);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImage(dataUrl);
        setResult(null);
        analyzeImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* Header */}
      <header className="w-full py-6 px-4 bg-white shadow-sm sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <i className="fas fa-monument text-xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">View Tours</h1>
        </div>
        <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500 hidden sm:block">دليلك الذكي لاستكشاف العالم</p>
            {window.aistudio && (
              <button 
                onClick={() => window.aistudio.openSelectKey()}
                className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full text-slate-600 transition-colors"
              >
                تغيير المفتاح <i className="fas fa-key ml-1"></i>
              </button>
            )}
        </div>
      </header>

      <main className="w-full max-w-2xl px-4 mt-8 space-y-8">
        
        {/* Hero Section / Welcome */}
        {!isScanning && !image && !loading && (
          <div className="text-center space-y-4 py-12 animate-in fade-in duration-700">
            <div className="inline-block p-4 bg-blue-100 rounded-full text-blue-600 mb-4">
              <i className="fas fa-camera-rotate text-4xl"></i>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">اكتشف أسرار المباني من حولك</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              وجه كاميرا هاتفك نحو أي مبنى تاريخي أو معلم سياحي، ودع ذكاءنا الاصطناعي يروي لك القصة.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={startCamera}
            disabled={isScanning || loading}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <i className="fas fa-expand"></i>
            <span>بدء المسح بالكاميرا</span>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning || loading}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-bold shadow-sm hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <i className="fas fa-upload"></i>
            <span>تحميل صورة من الملفات</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Camera Feed */}
        {isScanning && (
          <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black aspect-[3/4] sm:aspect-video flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-[2px] border-white/30 pointer-events-none m-8 rounded-2xl">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-500/50 animate-pulse"></div>
            </div>
            
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
              <button 
                onClick={capturePhoto}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-blue-500/30 active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 bg-red-500 rounded-full"></div>
              </button>
              <button 
                onClick={stopCamera}
                className="absolute right-6 bottom-6 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white p-8 rounded-3xl shadow-md flex flex-col items-center space-y-4 animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-slate-700 text-center">جاري التعرف على المكان وتحليل التاريخ...</p>
            <p className="text-sm text-slate-400">قد يستغرق ذلك بضع ثوانٍ</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-xl flex items-center gap-3 animate-bounce">
            <i className="fas fa-exclamation-triangle text-red-500"></i>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Display Captured Image (Preview) */}
        {image && !isScanning && !loading && (
          <div className="relative group animate-in zoom-in duration-300">
            <img 
              src={image} 
              alt="Preview" 
              className="w-full h-64 object-cover rounded-3xl shadow-lg border-4 border-white"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100">
               <span className="text-white bg-black/50 px-4 py-2 rounded-full text-sm">صورة المصدر</span>
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && !loading && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-600 p-6 text-white">
              <h3 className="text-2xl font-bold">{result.title}</h3>
            </div>
            
            <div className="p-8 space-y-8">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 font-bold">
                  <i className="fas fa-history"></i>
                  <h4>تاريخ المكان</h4>
                </div>
                <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
                  {result.history}
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 font-bold">
                  <i className="fas fa-archway"></i>
                  <h4>الطراز المعماري</h4>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {result.architecture}
                </p>
              </section>

              {result.funFacts && result.funFacts.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-500 font-bold">
                    <i className="fas fa-lightbulb"></i>
                    <h4>هل تعلم؟</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.funFacts.map((fact, i) => (
                      <div key={i} className="bg-amber-50 p-4 rounded-2xl border-r-4 border-amber-400 text-slate-800 italic">
                        "{fact}"
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-400">تم التحليل بواسطة View Tours AI</span>
              <button 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setResult(null);
                  setImage(null);
                }}
                className="text-blue-600 font-medium hover:underline flex items-center gap-1"
              >
                <span>مسح جديد</span>
                <i className="fas fa-arrow-left"></i>
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
        <div>&copy; {new Date().getFullYear()} View Tours. جميع الحقوق محفوظة.</div>
        <div className="text-[10px] opacity-50">Powered by Gemini 3 Flash</div>
      </footer>
    </div>
  );
};

export default App;
