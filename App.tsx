
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  history: string;
  architecture: string;
  funFacts: string[];
  uncertain?: boolean;
  message?: string;
}

interface PodcastScript {
  title: string;
  script: string;
}

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [podcastScript, setPodcastScript] = useState<PodcastScript | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // فتح الكاميرا تلقائياً عند تحميل التطبيق
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setImage(null);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("تعذر الوصول التلقائي للكاميرا. يرجى منح الإذن بالوصول للمتابعة.");
      setIsScanning(false);
    }
  };

  const analyzeImage = async (base64Data: string) => {
    setLoading(true);
    setError(null);
    setPodcastScript(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `أنت خبير سياحي ومؤرخ رقمي فائق الدقة. مهمتك هي تحليل الصورة والتعرف على المعلم السياحي.
      قواعد صارمة للعمل:
      1. ابحث في أدق تفاصيل الصورة.
      2. إذا لم تكن متأكداً بنسبة 100%، اجعل حقل "uncertain" في الـ JSON قيمته true.
      
      أعد النتيجة بتنسيق JSON:
      - title: اسم المعلم.
      - history: تاريخ مفصل.
      - architecture: وصف هندسي.
      - funFacts: 3 حقائق.
      - uncertain: boolean.
      - message: رسالة في حال عدم التأكد.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data.split(',')[1] } },
            { text: prompt }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setResult(data as AnalysisResult);
    } catch (err: any) {
      setError("حدث خطأ أثناء التحليل. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImage(dataUrl);
        stopCamera();
        analyzeImage(dataUrl);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const generatePodcast = async () => {
    if (!result || result.uncertain) return;
    setPodcastLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `اكتب سيناريو بودكاست شيق عن "${result.title}". حوار بين سارة ود.أحمد. أعد JSON بحقل "script".`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '{}');
      setPodcastScript({ title: result.title, script: data.script });
    } catch (err) {
      setError("فشل إنشاء البودكاست.");
    } finally {
      setPodcastLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white">
            <i className="fas fa-eye text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-800 leading-none">دليلك السياحى</h1>
            <span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">View Tours</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-emerald-600 p-2">
             <i className="fas fa-upload"></i>
           </button>
           {window.aistudio && (
                <button onClick={() => window.aistudio.openSelectKey()} className="text-slate-400 hover:text-emerald-600 p-2">
                    <i className="fas fa-cog"></i>
                </button>
            )}
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => { 
                  setImage(reader.result as string); 
                  stopCamera();
                  analyzeImage(reader.result as string); 
                };
                reader.readAsDataURL(file);
              }
            }} 
        />
      </header>

      <main className="w-full max-w-2xl px-4 flex-1 flex flex-col py-6">
        
        {/* وضع المسح المباشر النشط فوراً */}
        {isScanning && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="text-center">
               <h2 className="text-2xl font-black text-slate-900">وجه الكاميرا نحو المعلم</h2>
               <p className="text-slate-500 text-sm">سيقوم الوكيل الذكي بتحليل المشهد فور التقاط الصورة</p>
            </div>
            
            <div className="relative rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl aspect-[3/4] bg-black group">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover" 
              />
              
              {/* Overlay Scanner */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-[scan_2.5s_linear_infinite]"></div>
                <div className="absolute inset-8 border border-white/20 rounded-3xl"></div>
              </div>

              {/* Action Button */}
              <div className="absolute bottom-10 left-0 w-full flex justify-center">
                <button 
                  onClick={capturePhoto} 
                  className="w-20 h-20 bg-white rounded-full p-1 border-4 border-emerald-500 shadow-2xl active:scale-90 transition-transform flex items-center justify-center"
                >
                  <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xl">
                    <i className="fas fa-camera"></i>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* حالة التحميل */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-800">جاري تحليل المعلم...</p>
              <p className="text-emerald-600 text-sm mt-2 font-bold">الوكيل يجمع البيانات التاريخية</p>
            </div>
          </div>
        )}

        {/* عرض النتائج */}
        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-6">
             <button onClick={startCamera} className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-full mb-4">
                <i className="fas fa-arrow-right rotate-180"></i> العودة للمسح المباشر
             </button>

            {result.uncertain ? (
                <div className="bg-amber-50 p-10 rounded-[2.5rem] border-2 border-dashed border-amber-200 text-center space-y-5">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                        <i className="fas fa-search"></i>
                    </div>
                    <h3 className="text-2xl font-black text-amber-900">غير متأكد تماماً</h3>
                    <p className="text-amber-800">{result.message || "يرجى المحاولة من زاوية أخرى أو تقريب الكاميرا أكثر."}</p>
                    <button onClick={startCamera} className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">إعادة المسح</button>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 pb-10">
                    <div className="bg-gradient-to-br from-emerald-700 to-emerald-500 p-10 text-white">
                        <h3 className="text-3xl font-black mb-2">{result.title}</h3>
                        <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-widest">
                           <i className="fas fa-check-circle"></i> تم التحقق بنجاح
                        </div>
                    </div>
                    <div className="p-8 space-y-10">
                        <section className="space-y-3">
                            <h4 className="text-emerald-700 font-black flex items-center gap-2 text-sm uppercase">
                                <i className="fas fa-landmark"></i> نبذة تاريخية
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-lg font-medium">{result.history}</p>
                        </section>
                        <section className="space-y-3">
                            <h4 className="text-emerald-700 font-black flex items-center gap-2 text-sm uppercase">
                                <i className="fas fa-drafting-compass"></i> التصميم المعماري
                            </h4>
                            <p className="text-slate-600 leading-relaxed">{result.architecture}</p>
                        </section>
                        <section className="bg-emerald-50/50 p-6 rounded-3xl space-y-4">
                            <h4 className="text-emerald-800 font-black text-sm">حقائق مذهلة</h4>
                            <ul className="space-y-3">
                                {result.funFacts.map((fact, i) => (
                                    <li key={i} className="flex gap-4 text-emerald-900 text-sm font-bold bg-white p-4 rounded-2xl shadow-sm">
                                        <span className="text-emerald-500">#{i+1}</span> {fact}
                                    </li>
                                ))}
                            </ul>
                        </section>
                        
                        {!podcastScript && !podcastLoading && (
                            <button onClick={generatePodcast} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-4">
                                <i className="fas fa-microphone-lines text-emerald-400"></i>
                                <span>صناعة بودكاست لهذه الجولة</span>
                            </button>
                        )}
                        
                        {podcastLoading && (
                            <div className="text-center p-6 bg-slate-100 rounded-2xl animate-pulse font-black text-slate-400 uppercase text-xs">
                                جاري إنشاء تجربة صوتية معمقة...
                            </div>
                        )}
                        
                        {podcastScript && (
                            <div className="bg-slate-900 text-white p-8 rounded-[2rem] space-y-6 animate-in zoom-in duration-500">
                                <h5 className="font-black text-xl text-emerald-400 border-b border-white/10 pb-4">سيناريو الجولة الصوتية</h5>
                                <div className="whitespace-pre-wrap text-slate-300 leading-loose text-sm italic font-serif">
                                    {podcastScript.script}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
        )}

        {error && !loading && !isScanning && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
             <div className="text-red-500 bg-red-50 p-6 rounded-full mb-4">
                <i className="fas fa-exclamation-triangle text-3xl"></i>
             </div>
             <p className="text-slate-800 font-bold mb-6">{error}</p>
             <button onClick={startCamera} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold">المحاولة مرة أخرى</button>
          </div>
        )}

      </main>

      <footer className="py-8 opacity-40">
        <p className="text-[9px] font-black text-slate-400 tracking-[0.4em] uppercase text-center">
          دليلك السياحى // VIEW TOURS // AI POWERED
        </p>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default App;
