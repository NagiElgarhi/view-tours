
import React, { useState, useRef } from 'react';
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
  const [checking, setChecking] = useState(false);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [podcastScript, setPodcastScript] = useState<PodcastScript | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeImage = async (base64Data: string) => {
    setLoading(true);
    setChecking(true);
    setError(null);
    setPodcastScript(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `أنت خبير سياحي ومؤرخ رقمي فائق الدقة. مهمتك هي تحليل الصورة والتعرف على المعلم السياحي.
      
      قواعد صارمة للعمل:
      1. لا تتعجل في الإجابة. ابحث في أدق تفاصيل الصورة (النقوش، النوافذ، البيئة المحيطة).
      2. إذا لم تكن متأكداً بنسبة 100% من هوية المكان، لا تقدم معلومات عشوائية.
      3. في حال عدم التأكد، اجعل حقل "uncertain" في الـ JSON قيمته true، واكتب رسالة في حقل "message" تطلب فيها من المستخدم تزويدك بصورة أوضح أو من زاوية مختلفة.
      
      إذا تأكدت تماماً، قدم المعلومات التالية بتنسيق JSON:
      - title: اسم المعلم بدقة.
      - history: تاريخ مفصل وموثق.
      - architecture: وصف هندسي ومعماري دقيق.
      - funFacts: 3 حقائق غريبة وموثقة عن المكان.
      - uncertain: false.
      
      اللغة: العربية الفصحى فقط.`;

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
      console.error(err);
      setError("عذراً، حدث خطأ أثناء محاولة التعرف على المكان. تأكد من إعدادات المفتاح.");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  const generatePodcast = async () => {
    if (!result || result.uncertain) return;
    setPodcastLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `اكتب سيناريو بودكاست شيق ومدته 10 دقائق عن "${result.title}". حوار بين (سارة) و (د. أحمد). أعد النتيجة كـ JSON بحقل "script".`;
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

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setImage(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError("تعذر تشغيل الكاميرا.");
      setIsScanning(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      <header className="w-full py-6 px-4 bg-white shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg">
            <i className="fas fa-eye text-xl"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-800 leading-none">دليلك السياحى</h1>
            <span className="text-xs font-bold text-emerald-600 tracking-tighter">VIEW TOURS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
            {window.aistudio && (
                <button onClick={() => window.aistudio.openSelectKey()} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                    <i className="fas fa-cog"></i>
                </button>
            )}
        </div>
      </header>

      <main className="w-full max-w-2xl px-4 mt-8 space-y-8">
        {!isScanning && !image && !loading && (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-3xl font-black text-slate-900 leading-tight">دليلك السياحي الذكي</h2>
            <p className="text-slate-500 max-w-sm mx-auto">تطبيق View Tours يعتمد أعلى معايير الدقة التاريخية للتعرف على المعالم.</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button onClick={startCamera} disabled={loading} className="flex-1 max-w-[200px] flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all">
            <i className="fas fa-camera"></i> مسح المعلم
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex-1 max-w-[200px] flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-emerald-100 text-emerald-700 rounded-2xl font-bold hover:border-emerald-600 transition-all active:scale-95 shadow-sm">
            <i className="fas fa-upload"></i> رفع صورة
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => { setImage(reader.result as string); analyzeImage(reader.result as string); };
              reader.readAsDataURL(file);
            }
          }} />
        </div>

        {isScanning && (
          <div className="relative rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl aspect-square bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <button onClick={capturePhoto} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-white/30 backdrop-blur rounded-full p-2 border-2 border-white/50 shadow-2xl group active:scale-90 transition-transform">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                    <div className="w-14 h-14 border-2 border-emerald-500 rounded-full"></div>
                </div>
            </button>
            <button onClick={stopCamera} className="absolute top-6 right-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md">
              <i className="fas fa-xmark"></i>
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center space-y-6">
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xl font-black text-slate-800">جاري التحقق من التفاصيل...</p>
          </div>
        )}

        {error && (
            <div className="bg-red-50 text-red-600 p-6 rounded-3xl border-r-8 border-red-500 flex items-center gap-4">
                <i className="fas fa-circle-exclamation text-2xl"></i>
                <p className="font-bold">{error}</p>
            </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {result.uncertain ? (
                <div className="bg-amber-50 p-10 rounded-[2.5rem] border-2 border-dashed border-amber-200 text-center space-y-5">
                    <h3 className="text-2xl font-black text-amber-900">الوكيل غير متأكد تماماً</h3>
                    <p className="text-amber-800">{result.message || "يرجى تزويدنا بصورة أكثر وضوحاً."}</p>
                    <button onClick={() => {setImage(null); setResult(null);}} className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-amber-200 active:scale-95 transition-all">حاول بزاوية أخرى</button>
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
                    <div className="bg-gradient-to-br from-emerald-700 to-emerald-500 p-10 text-white">
                        <h3 className="text-4xl font-black mb-2">{result.title}</h3>
                        <p className="text-emerald-100 text-sm font-medium">تم التحقق من البيانات التاريخية بنجاح</p>
                    </div>
                    <div className="p-10 space-y-12">
                        <section className="space-y-4">
                            <h4 className="text-emerald-700 font-black">السجل التاريخي</h4>
                            <p className="text-slate-700 leading-relaxed text-lg">{result.history}</p>
                        </section>
                        <section className="space-y-4">
                            <h4 className="text-emerald-700 font-black">العمارة والهندسة</h4>
                            <p className="text-slate-600 leading-relaxed">{result.architecture}</p>
                        </section>
                        <section className="bg-emerald-50/50 p-8 rounded-[2rem] space-y-5">
                            <h4 className="text-emerald-800 font-black">حقائق من عمق التاريخ</h4>
                            <ul className="space-y-4">
                                {result.funFacts.map((fact, i) => (
                                    <li key={i} className="flex gap-4 text-emerald-900 text-sm font-bold bg-white p-4 rounded-2xl shadow-sm">
                                        <span className="text-emerald-400"># {i+1}</span> {fact}
                                    </li>
                                ))}
                            </ul>
                        </section>
                        {!podcastScript && !podcastLoading && (
                            <button onClick={generatePodcast} className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 group">
                                <i className="fas fa-microphone"></i>
                                <span>صناعة بودكاست مفصل (10 دقائق)</span>
                            </button>
                        )}
                        {podcastLoading && (
                            <p className="text-center font-black text-slate-400 uppercase">جاري صياغة سيناريو البودكاست المعمق...</p>
                        )}
                        {podcastScript && (
                            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] space-y-8 animate-in zoom-in duration-500 shadow-2xl">
                                <h5 className="font-black text-2xl text-emerald-400 border-b border-white/10 pb-4">سيناريو البودكاست</h5>
                                <div className="whitespace-pre-wrap text-slate-300 leading-loose text-base italic">
                                    {podcastScript.script}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 flex flex-col items-center gap-4">
        <p className="text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase">
          دليلك السياحى // VIEW TOURS // PRECISE ANALYSIS
        </p>
      </footer>
    </div>
  );
};

export default App;
