
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

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setImage(null);
    setError(null);
    setPodcastScript(null);
    
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

  const analyzeImage = async (base64Data: string, isReverify = false) => {
    setLoading(true);
    setError(null);
    if (!isReverify) {
        setPodcastScript(null);
        setResult(null);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `أنت خبير تدقيق معماري وتاريخي عالمي. 
      ${isReverify ? 'هام: المستخدم يشك في النتيجة السابقة، قم بإجراء تدقيق معماري مضاعف ومقارنة دقيقة جداً للأنماط المعمارية.' : ''}
      مهمتك السرية:
      1. حلل الصورة لتعيين الموقع والمبنى بدقة.
      2. طابق العناصر البصرية (المواد، النمط، الزخارف) مع قاعدة البيانات الجغرافية.
      3. لا تعرض المعلومات إلا إذا كنت متأكداً بنسبة 100%.
      4. إذا كان هناك احتمال للخطأ، اجعل uncertain: true.

      أعد النتيجة بتنسيق JSON حصراً:
      {
        "title": "اسم المعلم المؤكد",
        "history": "سرد تاريخي موثق",
        "architecture": "تحليل هندسي للطراز",
        "funFacts": ["حقيقة 1", "حقيقة 2", "حقيقة 3"],
        "uncertain": boolean,
        "message": "رسالة توضيحية في حال عدم التأكد"
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data.split(',')[1] } },
            { text: prompt }
          ]
        },
        config: { 
          responseMimeType: "application/json",
          temperature: isReverify ? 0.05 : 0.1 // تقليل العشوائية للحد الأقصى عند إعادة التحقق
        }
      });

      const text = response.text || '{}';
      const data = JSON.parse(text);
      
      setResult({
        title: data.title || "معلم غير معروف",
        history: data.history || "المعلومات غير متوفرة حالياً.",
        architecture: data.architecture || "التفاصيل غير متوفرة.",
        funFacts: Array.isArray(data.funFacts) ? data.funFacts : [],
        uncertain: !!data.uncertain,
        message: data.message || ""
      });
    } catch (err: any) {
      console.error("Verification error:", err);
      setError("حدث خطأ أثناء الفحص. يرجى المحاولة مرة أخرى.");
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
      const prompt = `اكتب سيناريو بودكاست شيق واحترافي عن "${result.title}". حوار بين مرشدة سياحية ومسافر ذكي. أعد JSON بحقل "script".`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '{}');
      setPodcastScript({ title: result.title, script: data.script || "جاري التجهيز..." });
    } catch (err) {
      setError("فشل إنشاء البودكاست.");
    } finally {
      setPodcastLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-orange-900/20 text-slate-100 flex flex-col items-center selection:bg-orange-500/30">
      <header className="w-full py-4 px-6 bg-emerald-950/80 backdrop-blur-md shadow-lg sticky top-0 z-50 flex justify-between items-center border-b border-orange-500/20">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl text-white shadow-lg shadow-orange-500/20">
            <i className="fas fa-eye text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-white leading-none">دليلك السياحى</h1>
            <span className="text-[10px] font-bold text-orange-400 tracking-widest uppercase">View Tours</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => fileInputRef.current?.click()} className="text-orange-400 hover:text-white p-2 transition-colors">
             <i className="fas fa-upload"></i>
           </button>
           {window.aistudio && (
                <button onClick={() => window.aistudio.openSelectKey()} className="text-orange-400 hover:text-white p-2 transition-colors">
                    <i className="fas fa-cog"></i>
                </button>
            )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { 
              const dataUrl = reader.result as string;
              setImage(dataUrl); 
              stopCamera(); 
              analyzeImage(dataUrl); 
            };
            reader.readAsDataURL(file);
          }
        }} />
      </header>

      <main className="w-full max-w-2xl px-4 flex-1 flex flex-col py-6">
        {isScanning && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
               <h2 className="text-2xl font-black text-white drop-shadow-md">اكتشف أسرار العالم</h2>
               <p className="text-orange-200/60 text-sm font-medium">التقط صورة واضحة لأي معلم سياحي أو مبنى تاريخي</p>
            </div>
            
            <div className="relative rounded-[3rem] overflow-hidden border-4 border-orange-500/30 shadow-2xl aspect-[3/4] bg-emerald-900/50 group">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-[scan_3s_linear_infinite] shadow-[0_0_15px_rgba(249,115,22,0.8)]"></div>
                <div className="absolute inset-10 border-2 border-orange-500/10 rounded-[2rem]"></div>
              </div>

              <div className="absolute bottom-10 left-0 w-full flex justify-center">
                <button onClick={capturePhoto} className="w-24 h-24 bg-white rounded-full p-1.5 border-4 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-90 transition-transform flex items-center justify-center group">
                  <div className="w-full h-full bg-orange-500 rounded-full flex items-center justify-center text-white text-2xl group-hover:bg-orange-600 transition-colors">
                    <i className="fas fa-camera-retro"></i>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {(loading || (image && !result && !error)) && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-pulse">
            {image && !result && (
                <div className="w-48 h-64 rounded-3xl overflow-hidden border-4 border-orange-500/30 shadow-2xl mb-4 grayscale">
                    <img src={image} className="w-full h-full object-cover" alt="Scanning" />
                </div>
            )}
            <div className="relative">
              <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-orange-500">
                <i className="fas fa-fingerprint text-xl"></i>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">جاري تحديد المعلم...</p>
              <p className="text-orange-400 text-sm mt-3 font-bold tracking-tighter uppercase">يتم الآن مطابقة الأنماط المعمارية والتاريخية</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 space-y-6 pb-20">
             <button onClick={startCamera} className="flex items-center gap-2 text-orange-400 font-black text-sm bg-orange-500/10 hover:bg-orange-500/20 px-6 py-2.5 rounded-full mb-4 border border-orange-500/20 transition-all">
                <i className="fas fa-redo-alt text-xs"></i> إعادة المسح
             </button>

            {/* عرض الصورة الملتقطة أولاً */}
            {image && (
                <div className="w-full h-72 rounded-[3rem] overflow-hidden border-4 border-orange-500/20 shadow-2xl relative group">
                    <img src={image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Captured Landmark" />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-transparent to-transparent opacity-60"></div>
                    
                    {/* زر إعادة التحقق الصغير */}
                    {!result.uncertain && (
                        <button 
                            onClick={() => image && analyzeImage(image, true)}
                            className="absolute top-6 left-6 flex items-center gap-2 bg-emerald-950/80 backdrop-blur-md text-orange-400 hover:text-white border border-orange-500/30 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xl transition-all active:scale-95 group/btn"
                            title="إعادة التحقق من الصحة"
                        >
                            <i className="fas fa-arrows-rotate text-[8px] group-hover/btn:rotate-180 transition-transform duration-500"></i>
                            <span>إعادة فحص دقيقة</span>
                        </button>
                    )}

                    <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-orange-500/90 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                        <i className="fas fa-camera"></i> الصورة الممسوحة
                    </div>
                </div>
            )}

            {result.uncertain ? (
                <div className="bg-emerald-900/40 backdrop-blur-xl p-10 rounded-[3rem] border-2 border-dashed border-orange-500/30 text-center space-y-6">
                    <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto text-3xl border border-orange-500/20">
                        <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <h3 className="text-2xl font-black text-white">لم نتمكن من تأكيد المعلم</h3>
                    <p className="text-orange-100/70 leading-relaxed font-medium">{result.message || "يرجى محاولة التقاط الصورة من زاوية أفضل لضمان الدقة في استخراج المعلومات التاريخية."}</p>
                    <button onClick={startCamera} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 transition-all">حاول مرة أخرى</button>
                </div>
            ) : (
                <div className="bg-emerald-900/30 backdrop-blur-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/5 pb-10">
                    <div className="bg-gradient-to-br from-orange-600 to-orange-400 p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                            <i className="fas fa-archway text-9xl"></i>
                        </div>
                        <h3 className="text-4xl font-black mb-3 drop-shadow-lg">{result.title}</h3>
                        <div className="inline-flex items-center gap-2 bg-emerald-950/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">
                           <i className="fas fa-check-circle text-orange-300"></i> تم التحقق من الموقع
                        </div>
                    </div>
                    <div className="p-8 md:p-12 space-y-12">
                        <section className="space-y-4">
                            <h4 className="text-orange-400 font-black flex items-center gap-3 text-xs uppercase tracking-widest border-r-4 border-orange-500 pr-4">
                                السرد التاريخي
                            </h4>
                            <p className="text-slate-100 leading-loose text-lg font-medium opacity-90">{result.history}</p>
                        </section>
                        <section className="space-y-4">
                            <h4 className="text-orange-400 font-black flex items-center gap-3 text-xs uppercase tracking-widest border-r-4 border-orange-500 pr-4">
                                الطراز الهندسي
                            </h4>
                            <p className="text-slate-300 leading-loose font-medium opacity-80">{result.architecture}</p>
                        </section>
                        
                        {result.funFacts && result.funFacts.length > 0 && (
                          <section className="bg-orange-500/5 p-8 rounded-[2.5rem] border border-orange-500/10 space-y-6">
                              <h4 className="text-orange-400 font-black text-xs uppercase tracking-widest text-center">حقائق مذهلة</h4>
                              <div className="grid gap-4">
                                  {result.funFacts.map((fact, i) => (
                                      <div key={i} className="flex gap-5 text-white text-sm font-bold bg-emerald-950/40 p-5 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-colors">
                                          <span className="text-orange-500 font-black italic">0{i+1}</span> 
                                          <p className="leading-relaxed">{fact}</p>
                                      </div>
                                  ))}
                              </div>
                          </section>
                        )}
                        
                        {!podcastScript && !podcastLoading && (
                            <button onClick={generatePodcast} className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-[2rem] font-black shadow-2xl shadow-orange-500/20 transition-all flex items-center justify-center gap-4 group">
                                <i className="fas fa-headphones text-xl group-hover:scale-110 transition-transform"></i>
                                <span>بدء الجولة الإرشادية الصوتية</span>
                            </button>
                        )}
                        
                        {podcastLoading && (
                            <div className="text-center p-8 bg-emerald-950/40 rounded-[2rem] animate-pulse border border-white/5">
                                <p className="font-black text-orange-400/60 uppercase text-[10px] tracking-widest mb-2">جاري توليد المحتوى الصوتي</p>
                                <div className="flex justify-center gap-1">
                                    {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-6 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}}></div>)}
                                </div>
                            </div>
                        )}
                        
                        {podcastScript && (
                            <div className="bg-emerald-950/80 p-10 rounded-[3rem] space-y-8 animate-in zoom-in duration-500 border border-orange-500/20">
                                <div className="flex justify-between items-center border-b border-white/5 pb-6">
                                    <h5 className="font-black text-xl text-orange-400">نص الجولة السياحية</h5>
                                    <i className="fas fa-microphone-lines text-orange-500/50"></i>
                                </div>
                                <div className="whitespace-pre-wrap text-slate-300 leading-[2.2] text-base italic font-medium opacity-90">
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-emerald-950/20 rounded-[3rem] border border-red-500/20">
             <div className="text-red-500 bg-red-500/10 p-8 rounded-full mb-6 border border-red-500/20 shadow-lg shadow-red-500/10">
                <i className="fas fa-exclamation-triangle text-4xl"></i>
             </div>
             <p className="text-white font-bold text-lg mb-8 max-w-xs">{error}</p>
             <button onClick={startCamera} className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 transition-all active:scale-95">إعادة المحاولة</button>
          </div>
        )}
      </main>

      <footer className="py-10 opacity-30 mt-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-6 text-xs font-black text-orange-400/50 tracking-widest uppercase">
            <span>Historical AI</span>
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full my-auto"></span>
            <span>Spatial Verification</span>
          </div>
          <p className="text-[8px] font-black text-slate-500 tracking-[0.5em] uppercase">
            View Tours // Heritage Digitization
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        body {
          background-color: #022c22;
          overflow-x: hidden;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default App;
