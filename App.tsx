
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
      const prompt = `أنت خبير سياحي ومؤرخ رقمي فائق الدقة. حلل الصورة والتعرف على المعلم.
      إذا لم تكن متأكداً، اجعل uncertain: true. أعد JSON حصراً.`;

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
      setError("حدث خطأ أثناء التحليل. حاول مرة أخرى.");
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
            reader.onloadend = () => { setImage(reader.result as string); stopCamera(); analyzeImage(reader.result as string); };
            reader.readAsDataURL(file);
          }
        }} />
      </header>

      <main className="w-full max-w-2xl px-4 flex-1 flex flex-col py-6">
        {isScanning && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
               <h2 className="text-2xl font-black text-white drop-shadow-md">استكشف العالم الآن</h2>
               <p className="text-orange-200/60 text-sm font-medium">الذكاء الاصطناعي جاهز لتحليل أي معلم سياحي</p>
            </div>
            
            <div className="relative rounded-[3rem] overflow-hidden border-4 border-orange-500/30 shadow-2xl aspect-[3/4] bg-emerald-900/50 group">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[0.2] contrast-125" />
              
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

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-pulse">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-orange-500">
                <i className="fas fa-brain text-xl"></i>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">جاري التحقق من المعلم...</p>
              <p className="text-orange-400 text-sm mt-3 font-bold tracking-tighter uppercase">الوكيل الرقمي يراجع السجلات التاريخية</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 space-y-6">
             <button onClick={startCamera} className="flex items-center gap-2 text-orange-400 font-black text-sm bg-orange-500/10 hover:bg-orange-500/20 px-6 py-2.5 rounded-full mb-4 border border-orange-500/20 transition-all">
                <i className="fas fa-redo-alt text-xs"></i> إعادة المسح المباشر
             </button>

            {result.uncertain ? (
                <div className="bg-emerald-900/40 backdrop-blur-xl p-10 rounded-[3rem] border-2 border-dashed border-orange-500/30 text-center space-y-6">
                    <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto text-3xl border border-orange-500/20">
                        <i className="fas fa-fingerprint"></i>
                    </div>
                    <h3 className="text-2xl font-black text-white">تحتاج الصورة لوضوح أكثر</h3>
                    <p className="text-orange-100/70 leading-relaxed font-medium">{result.message || "يرجى تقريب الكاميرا أو التقاط الصورة في إضاءة أفضل ليتمكن الوكيل من مطابقة التفاصيل."}</p>
                    <button onClick={startCamera} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 transition-all">حاول مرة أخرى</button>
                </div>
            ) : (
                <div className="bg-emerald-900/30 backdrop-blur-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/5 pb-10">
                    <div className="bg-gradient-to-br from-orange-600 to-orange-400 p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                            <i className="fas fa-monument text-9xl"></i>
                        </div>
                        <h3 className="text-4xl font-black mb-3 drop-shadow-lg">{result.title}</h3>
                        <div className="inline-flex items-center gap-2 bg-emerald-950/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">
                           <i className="fas fa-certificate text-orange-300"></i> موثق تاريخياً
                        </div>
                    </div>
                    <div className="p-8 md:p-12 space-y-12">
                        <section className="space-y-4">
                            <h4 className="text-orange-400 font-black flex items-center gap-3 text-xs uppercase tracking-widest border-r-4 border-orange-500 pr-4">
                                السجل التاريخي
                            </h4>
                            <p className="text-slate-100 leading-loose text-lg font-medium opacity-90">{result.history}</p>
                        </section>
                        <section className="space-y-4">
                            <h4 className="text-orange-400 font-black flex items-center gap-3 text-xs uppercase tracking-widest border-r-4 border-orange-500 pr-4">
                                الطراز المعماري
                            </h4>
                            <p className="text-slate-300 leading-loose font-medium opacity-80">{result.architecture}</p>
                        </section>
                        <section className="bg-orange-500/5 p-8 rounded-[2.5rem] border border-orange-500/10 space-y-6">
                            <h4 className="text-orange-400 font-black text-xs uppercase tracking-widest text-center">حقائق نادرة</h4>
                            <div className="grid gap-4">
                                {result.funFacts.map((fact, i) => (
                                    <div key={i} className="flex gap-5 text-white text-sm font-bold bg-emerald-950/40 p-5 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-colors">
                                        <span className="text-orange-500 font-black italic">0{i+1}</span> 
                                        <p className="leading-relaxed">{fact}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                        
                        {!podcastScript && !podcastLoading && (
                            <button onClick={generatePodcast} className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-[2rem] font-black shadow-2xl shadow-orange-500/20 transition-all flex items-center justify-center gap-4 group">
                                <i className="fas fa-microphone-alt text-xl group-hover:scale-110 transition-transform"></i>
                                <span>صناعة بودكاست لهذه الجولة</span>
                            </button>
                        )}
                        
                        {podcastLoading && (
                            <div className="text-center p-8 bg-emerald-950/40 rounded-[2rem] animate-pulse border border-white/5">
                                <p className="font-black text-orange-400/60 uppercase text-[10px] tracking-widest mb-2">جاري المعالجة الصوتية</p>
                                <div className="flex justify-center gap-1">
                                    {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-6 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}}></div>)}
                                </div>
                            </div>
                        )}
                        
                        {podcastScript && (
                            <div className="bg-emerald-950/80 p-10 rounded-[3rem] space-y-8 animate-in zoom-in duration-500 border border-orange-500/20 relative">
                                <div className="flex justify-between items-center border-b border-white/5 pb-6">
                                    <h5 className="font-black text-xl text-orange-400">نص الجولة الصوتية</h5>
                                    <i className="fas fa-headphones text-orange-500/50"></i>
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
                <i className="fas fa-ghost text-4xl"></i>
             </div>
             <p className="text-white font-bold text-lg mb-8 max-w-xs">{error}</p>
             <button onClick={startCamera} className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 transition-all active:scale-95">المحاولة مرة أخرى</button>
          </div>
        )}
      </main>

      <footer className="py-10 opacity-30 mt-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-6 text-xs font-black text-orange-400/50 tracking-widest uppercase">
            <span>Historical</span>
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full my-auto"></span>
            <span>Accurate</span>
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full my-auto"></span>
            <span>Interactive</span>
          </div>
          <p className="text-[8px] font-black text-slate-500 tracking-[0.5em] uppercase">
            View Tours // Powered by Gemini AI
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        body {
          background-color: #022c22; /* Emerald 950 fallback */
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
};

export default App;
