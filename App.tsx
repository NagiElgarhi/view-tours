
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
  generatedImage?: string;
}

interface NearbyLandmark {
  name: string;
  distance: string;
  direction: string;
  brief: string;
}

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [readingSection, setReadingSection] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<NearbyLandmark[]>([]);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      window.speechSynthesis.cancel();
    };
  }, []);

  const startCamera = async () => {
    setIsScanning(true);
    setResult(null);
    setImage(null);
    setError(null);
    setReadingSection(null);
    setNearbyLandmarks([]);
    window.speechSynthesis.cancel();
    
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
      setError("تعذر الوصول للكاميرا. يرجى التأكد من منح الأذونات.");
      setIsScanning(false);
    }
  };

  const cleanJsonString = (str: string) => {
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
  };

  const analyzeImage = async (base64Data: string | null, textPrompt?: string) => {
    setLoading(true);
    setError(null);
    setNearbyLandmarks([]);
    window.speechSynthesis.cancel();

    // إذا كان الطلب مبنياً على نص (معلم مجاور)، نقوم بمسح الصورة بناءً على طلبك
    if (!base64Data && textPrompt) {
      setImage(null);
    } else if (base64Data) {
      setImage(base64Data);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const systemInstruction = `أنت مؤرخ عالمي خبير. قدم تقريراً شاملاً باللغة العربية.
      يجب أن يكون الرد بتنسيق JSON حصراً:
      {
        "title": "اسم المعلم",
        "history": "سرد تاريخي عميق جداً (لا يقل عن 500 كلمة)",
        "architecture": "تحليل معماري فني وهندسي دقيق (لا يقل عن 200 كلمة)",
        "funFacts": ["حقيقة مذهلة 1", "حقيقة مذهلة 2", "حقيقة مذهلة 3", "حقيقة مذهلة 4", "حقيقة مذهلة 5"]
      }`;

      let promptParts = [];
      if (base64Data) {
        promptParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data.split(',')[1] } });
        promptParts.push({ text: "تعرف على هذا المعلم وقدم التاريخ الكامل له." });
      } else {
        promptParts.push({ text: `حلل المعلم التاريخي التالي وقدم كافة التفاصيل العميقة: ${textPrompt}` });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: promptParts }],
        config: { 
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const cleanedText = cleanJsonString(response.text || '{}');
      const data = JSON.parse(cleanedText);
      
      setResult({
        title: data.title || textPrompt || "معلم أثري",
        history: data.history || "",
        architecture: data.architecture || "",
        funFacts: Array.isArray(data.funFacts) ? data.funFacts : []
      });
      
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err: any) {
      console.error("Analysis error:", err);
      setError("حدث خطأ في استحضار البيانات. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        stopCamera();
        analyzeImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const findNearby = async () => {
    if (!result) return;
    setNearbyLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `ابحث عن بالضبط 10 معالم تاريخية أو سياحية هامة قريبة من "${result.title}".
      أعد JSON حصراً:
      [
        {"name": "اسم المعلم", "distance": "المسافة", "direction": "الاتجاه", "brief": "نبذة قصيرة جذابة"}
      ]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const cleanedText = cleanJsonString(response.text || '[]');
      const data = JSON.parse(cleanedText);
      setNearbyLandmarks(data);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setNearbyLoading(false);
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

  const readText = (text: string, sectionId: string) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (readingSection === sectionId) {
        setReadingSection(null);
        return;
      }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.onstart = () => setReadingSection(sectionId);
    utterance.onend = () => setReadingSection(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-slate-100 flex flex-col items-center selection:bg-orange-500/30 font-['Tajawal'] pb-10 overflow-x-hidden">
      <header className="w-full py-4 px-6 bg-emerald-950/90 backdrop-blur-md shadow-lg sticky top-0 z-50 flex justify-between items-center border-b border-orange-500/20">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl text-white shadow-lg">
            <i className="fas fa-eye text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-white leading-none">دليلك السياحى</h1>
            <span className="text-[10px] font-bold text-orange-400 tracking-widest uppercase">View Tours</span>
          </div>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="bg-white/10 hover:bg-orange-500 w-12 h-12 rounded-2xl flex items-center justify-center text-orange-400 hover:text-white transition-all shadow-inner group"
          title="تحميل صورة من جهازك"
        >
          <i className="fas fa-file-image text-xl group-hover:scale-110 transition-transform"></i>
        </button>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileUpload} 
        />
      </header>

      <main className="w-full max-w-4xl px-4 flex-1 flex flex-col py-6">
        {isScanning && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in max-w-2xl mx-auto w-full">
            <div className="text-center py-4 space-y-2">
               <h2 className="text-3xl font-black text-white">استمتع بجولتك</h2>
               <p className="text-orange-200/60 text-sm">وجه الكاميرا نحو المعلم أو ارفع صورة لفتح بوابة المعرفة</p>
            </div>
            <div className="relative rounded-[3rem] overflow-hidden border-4 border-orange-500/30 shadow-2xl aspect-[3/4] bg-emerald-900/50">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
              <div className="absolute bottom-10 left-0 w-full flex justify-center">
                <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full p-1 border-4 border-orange-500 shadow-2xl active:scale-95 transition-transform">
                  <div className="w-full h-full bg-orange-500 rounded-full flex items-center justify-center text-white text-xl">
                    <i className="fas fa-camera"></i>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {(loading || (nearbyLoading && !result)) && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in py-10">
            <div className="w-full relative rounded-[3rem] overflow-hidden border-2 border-orange-500/30 shadow-2xl min-h-[400px] flex items-center justify-center bg-emerald-900/40">
                {image && (
                    <img src={image} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-110 transition-all duration-1000" alt="تحميل" />
                )}
                <div className="relative z-10 flex flex-col items-center space-y-6">
                    <div className="relative w-32 h-32">
                        <div className="absolute inset-0 border-[4px] border-orange-500/10 rounded-full"></div>
                        <div className="absolute inset-0 border-[4px] border-t-orange-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-orange-500 text-4xl">
                            <i className="fas fa-compass animate-pulse"></i>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-white drop-shadow-lg">استمتع بتجوالك...</p>
                        <p className="text-orange-400 font-bold text-sm tracking-widest mt-2 uppercase">نحن نكتب لك المخطوطة</p>
                    </div>
                </div>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8 pb-20 w-full">
            <div className="relative w-full h-[350px] md:h-[450px] rounded-[3rem] overflow-hidden shadow-2xl border-2 border-orange-500/20 group">
                {image ? (
                  <img src={image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={result.title} />
                ) : (
                  <div className="w-full h-full bg-emerald-900 flex flex-col items-center justify-center relative overflow-hidden">
                     <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
                     <i className="fas fa-feather-pointed text-8xl text-orange-500/20 animate-pulse relative z-10"></i>
                     <p className="text-orange-400/50 mt-4 font-bold text-xs uppercase tracking-widest">مخطوطة استكشافية</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/30 to-transparent"></div>
                
                <button 
                  onClick={startCamera} 
                  className="absolute top-6 left-6 bg-emerald-950/80 backdrop-blur-md text-orange-400 px-6 py-3 rounded-full text-xs font-black border border-orange-500/30 shadow-xl hover:bg-orange-500 hover:text-white transition-all z-20"
                >
                    <i className="fas fa-sync-alt ml-2"></i> استكشاف جديد
                </button>

                <div className="absolute bottom-8 right-8 text-white text-right left-8">
                    <h3 className="text-4xl md:text-5xl font-black mb-6 drop-shadow-2xl">{result.title}</h3>
                    <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.title)}`)}
                          className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg flex items-center gap-3 hover:bg-orange-600 active:scale-95 transition-all"
                        >
                          <i className="fas fa-map-marked-alt text-xl"></i>
                          فتح الخريطة
                        </button>
                    </div>
                </div>
            </div>

            {/* نصوص ورق البردى */}
            <div className="relative papyrus-container rounded-[2rem] overflow-hidden shadow-2xl p-8 md:p-16 space-y-16 border-2 border-[#d4b483]/30">
                <section className="space-y-6 text-right relative z-10">
                    <div className="flex items-center justify-end gap-4">
                        <button onClick={() => readText(result.history, 'history')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${readingSection === 'history' ? 'bg-[#8b4513] text-white animate-pulse' : 'bg-black/10 text-[#5d4037]'}`}>
                            <i className={`fas ${readingSection === 'history' ? 'fa-stop' : 'fa-volume-up'}`}></i>
                        </button>
                        <h4 className="text-[#8b4513] font-black text-sm tracking-widest uppercase border-b-2 border-[#8b4513]/20 pb-1">السجل التاريخي للمخطوطة</h4>
                    </div>
                    <div className="text-[#2d2d2d] text-lg md:text-xl leading-[2.2] font-bold text-justify whitespace-pre-wrap drop-shadow-sm">{result.history}</div>
                </section>

                <hr className="border-[#8b4513]/10" />

                <section className="space-y-6 text-right relative z-10">
                    <div className="flex items-center justify-end gap-4">
                        <button onClick={() => readText(result.architecture, 'arch')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${readingSection === 'arch' ? 'bg-[#8b4513] text-white animate-pulse' : 'bg-black/10 text-[#5d4037]'}`}>
                            <i className={`fas ${readingSection === 'arch' ? 'fa-stop' : 'fa-volume-up'}`}></i>
                        </button>
                        <h4 className="text-[#8b4513] font-black text-sm tracking-widest uppercase border-b-2 border-[#8b4513]/20 pb-1">الوصف الهندسي والمعماري</h4>
                    </div>
                    <div className="text-[#3e2723] text-lg leading-loose text-justify whitespace-pre-wrap bg-white/10 p-8 rounded-[1.5rem] border border-[#8b4513]/5 italic">{result.architecture}</div>
                </section>

                {result.funFacts.length > 0 && (
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {result.funFacts.map((fact, i) => (
                      <div key={i} className="bg-[#8b4513]/5 border border-[#8b4513]/10 p-6 rounded-2xl text-right hover:bg-[#8b4513]/10 transition-colors">
                        <span className="text-[#8b4513] font-black block mb-2 underline decoration-[#8b4513]/20">ملاحظة {i+1}</span>
                        <p className="text-[#3e2723] text-sm font-bold">{fact}</p>
                      </div>
                    ))}
                  </section>
                )}
            </div>

            <div className="space-y-10">
                {!nearbyLandmarks.length && !nearbyLoading && (
                    <button 
                      onClick={findNearby} 
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-7 rounded-[2.5rem] font-black shadow-xl shadow-orange-500/20 flex items-center justify-center gap-4 transition-all"
                    >
                        <i className="fas fa-scroll text-2xl"></i>
                        <span>كشف المعالم المجاورة في المنطقة</span>
                    </button>
                )}

                {nearbyLoading && (
                    <div className="bg-white/5 p-12 rounded-[3rem] text-center border border-white/10 animate-pulse">
                        <i className="fas fa-compass text-4xl text-orange-500 animate-spin mb-4"></i>
                        <p className="text-orange-400 font-black text-xl">نحدد الإحداثيات المجاورة...</p>
                    </div>
                )}

                {nearbyLandmarks.length > 0 && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-6">
                        <h4 className="text-white font-black text-3xl text-center">بوابات استكشافية قريبة</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {nearbyLandmarks.map((landmark, idx) => (
                                <div key={idx} className="bg-emerald-900/40 border border-white/10 p-6 rounded-[2rem] text-right flex flex-col justify-between hover:border-orange-500/60 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="bg-orange-500/20 text-orange-400 px-4 py-1.5 rounded-full text-[10px] font-black">
                                            {landmark.direction} // {landmark.distance}
                                        </span>
                                    </div>
                                    <h5 className="text-white font-black text-xl mb-3">{landmark.name}</h5>
                                    <p className="text-slate-400 text-xs leading-relaxed mb-6">{landmark.brief}</p>
                                    <button 
                                      onClick={() => analyzeImage(null, landmark.name)} 
                                      className="w-full bg-white/5 group-hover:bg-orange-500 text-orange-400 group-hover:text-white py-3 rounded-2xl text-xs font-black transition-all"
                                    >
                                        فتح المخطوطة التاريخية
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-red-950/10 rounded-[3rem] border border-red-500/20">
             <i className="fas fa-exclamation-triangle text-5xl text-red-500 mb-6"></i>
             <p className="text-white font-bold text-lg mb-8">{error}</p>
             <button onClick={startCamera} className="bg-orange-500 text-white px-12 py-4 rounded-2xl font-black">إعادة المحاولة</button>
          </div>
        )}
      </main>

      <footer className="py-12 opacity-30 text-center w-full">
         <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest">View Tours // Ancient Knowledge Explorer</p>
      </footer>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; opacity: 0; }
          50% { top: 90%; opacity: 1; }
        }
        body { background-color: #022c22; direction: rtl; }
        
        .papyrus-container {
            background-color: #e4d5b7;
            background-image: 
                linear-gradient(rgba(228, 213, 183, 0.95), rgba(228, 213, 183, 0.95)),
                url('https://www.transparenttextures.com/patterns/natural-paper.png');
            box-shadow: 
                inset 0 0 100px rgba(139, 69, 19, 0.1),
                0 20px 50px rgba(0, 0, 0, 0.3);
            position: relative;
        }

        .papyrus-container::before {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: 
                repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(139, 69, 19, 0.03) 41px, transparent 42px),
                repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(139, 69, 19, 0.03) 31px, transparent 32px);
            pointer-events: none;
        }

        .papyrus-container::after {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border: 20px solid transparent;
            border-image: url('https://www.transparenttextures.com/patterns/rough-cloth.png') 30 round;
            opacity: 0.1;
            pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default App;
