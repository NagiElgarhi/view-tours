
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  history: string;
  architecture: string;
  funFacts: string[];
}

interface NearbyLandmark {
  name: string;
  distance: string;
  brief: string;
  icon: string; // FontAwesome icon class
}

const App: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [readingSection, setReadingSection] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [allDiscoveredLandmarks, setAllDiscoveredLandmarks] = useState<NearbyLandmark[]>([]);
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
    setError(null);
    setReadingSection(null);
    setAllDiscoveredLandmarks([]);
    window.speechSynthesis.cancel();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setIsScanning(false);
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

  const cleanJsonString = (str: string) => str.replace(/```json/g, '').replace(/```/g, '').trim();

  const performAnalysis = async (prompt: string, imageData?: string, keepNearby = false) => {
    setLoading(true);
    setError(null);
    window.speechSynthesis.cancel();
    // إذا لم نكن نريد الاحتفاظ بالقائمة (مثل بحث جديد كلياً)، نصفر القائمة
    if (!keepNearby) setAllDiscoveredLandmarks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const systemInstruction = `أنت أعظم مؤرخ في العصور الحديثة. قدم تقريراً ملحمياً باللغة العربية الفصحى.
      يجب أن يكون قسم "history" غنياً جداً وبالتفصيل الممل بحيث لا يقل عن 600 كلمة من السرد الممتع.
      يجب أن يكون الرد بتنسيق JSON حصراً:
      {
        "title": "اسم المعلم",
        "history": "سرد تاريخي ملحمي طويل جداً (أكثر من 600 كلمة)",
        "architecture": "تحليل معماري وفني عميق (أكثر من 200 كلمة)",
        "funFacts": ["6 حقائق مدهشة وفريدة"]
      }`;

      const contents: any = imageData 
        ? [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageData.split(',')[1] } }, { text: prompt }] }]
        : [{ parts: [{ text: prompt }] }];

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents,
        config: { systemInstruction, responseMimeType: "application/json", temperature: 0.2 }
      });

      const data = JSON.parse(cleanJsonString(response.text || '{}'));
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError("تعذر استحضار المخطوطة حالياً.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    stopCamera();
    performAnalysis(`حلل المعلم التاريخي التالي بالتفصيل الملحمي: ${searchText}`);
  };

  const findNearby = async () => {
    if (!result) return;
    setNearbyLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `ابحث عن بالضبط 12 معلماً تاريخياً قريباً من "${result.title}". 
      أعد JSON حصراً:
      [
        {"name": "اسم المعلم", "distance": "المسافة", "brief": "نبذة", "icon": "fa-monument أو fa-mosque أو fa-archway إلخ"}
      ]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(cleanJsonString(response.text || '[]'));
      setAllDiscoveredLandmarks(data);
    } catch (err) { console.error(err); } finally { setNearbyLoading(false); }
  };

  const handleSelectLandmark = (landmark: NearbyLandmark) => {
    setSearchText(landmark.name);
    // الاحتفاظ بالقائمة المكتشفة ليتم التصفية منها بالأسفل
    performAnalysis(`حلل المعلم التاريخي التالي بالتفصيل الملحمي: ${landmark.name}`, undefined, true);
  };

  const readText = (text: string, sectionId: string) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (readingSection === sectionId) { return setReadingSection(null); }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.onstart = () => setReadingSection(sectionId);
    utterance.onend = () => setReadingSection(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#021512] text-slate-100 flex flex-col items-center selection:bg-yellow-500/30 font-['Tajawal'] pb-10 overflow-x-hidden">
      <header className="w-full py-4 px-6 bg-[#021512]/95 backdrop-blur-md shadow-2xl sticky top-0 z-50 flex flex-col md:flex-row gap-4 justify-between items-center border-b border-yellow-600/30">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-700 p-2 rounded-xl text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]">
            <i className="fas fa-eye text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-yellow-500 leading-none">دليلك السياحى</h1>
            <span className="text-[10px] font-bold text-yellow-600/60 tracking-widest uppercase">View Tours</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="ابحث عن معلم بالاسم..." 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-white/5 border border-yellow-600/30 rounded-full py-2 px-10 text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-yellow-100 placeholder-yellow-900"
            />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600/50 text-xs"></i>
          </form>
          
          <button onClick={() => fileInputRef.current?.click()} className="bg-yellow-600/10 hover:bg-yellow-600/20 w-10 h-10 rounded-full flex items-center justify-center text-yellow-500 border border-yellow-600/30 transition-all">
            <i className="fas fa-image"></i>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => { stopCamera(); performAnalysis("ما هذا المعلم؟", reader.result as string); };
              reader.readAsDataURL(file);
            }
          }} />
        </div>
      </header>

      <main className="w-full max-w-5xl px-4 flex-1 flex flex-col py-6">
        {isScanning && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in w-full max-w-2xl mx-auto">
            <div className="text-center py-4">
               <h2 className="text-3xl font-black text-yellow-500 drop-shadow-lg">إستكشف بروحك</h2>
               <p className="text-yellow-600/60 text-sm">وجه عدستك نحو التاريخ ليبوح بأسراره</p>
            </div>
            <div className="relative rounded-[3rem] overflow-hidden border-4 border-yellow-600/20 shadow-[0_0_50px_rgba(234,179,8,0.1)] aspect-[3/4] bg-emerald-950/20">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[0.3]" />
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] animate-[scan_3s_infinite]"></div>
              <div className="absolute bottom-10 left-0 w-full flex justify-center">
                <button onClick={() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current!.videoWidth;
                  canvas.height = videoRef.current!.videoHeight;
                  canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
                  stopCamera();
                  performAnalysis("تعرف على هذا المعلم الأثري بدقة", canvas.toDataURL('image/jpeg'));
                }} className="w-20 h-20 bg-black/60 backdrop-blur-md rounded-full p-1 border-2 border-yellow-500 shadow-2xl hover:scale-105 transition-transform group">
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center text-black">
                    <i className="fas fa-camera text-2xl"></i>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-32 h-32 border-2 border-yellow-600/20 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 border-t-2 border-yellow-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-yellow-500 text-3xl">
                <i className="fas fa-feather-pointed animate-bounce"></i>
              </div>
            </div>
            <p className="mt-8 text-2xl font-black text-yellow-500 animate-pulse tracking-widest">إستمتع بتجوالك...</p>
          </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 pb-20 w-full">
            <div className="text-center space-y-4">
              <div className="inline-block p-6 rounded-full bg-yellow-600/10 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)] mb-4">
                <i className="fas fa-landmark text-6xl text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]"></i>
              </div>
              <h3 className="text-4xl md:text-6xl font-black text-yellow-500 drop-shadow-lg tracking-tight px-4">{result.title}</h3>
              <div className="flex justify-center gap-4">
                <button onClick={startCamera} className="bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 px-6 py-2 rounded-full text-xs font-bold transition-all"><i className="fas fa-camera ml-2"></i> عدسة جديدة</button>
              </div>
            </div>

            <div className="relative papyrus-container rounded-[2rem] shadow-2xl p-8 md:p-20 space-y-16 border-t-4 border-yellow-700/50">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#d4b483] border-4 border-[#8b4513] w-16 h-16 rounded-full flex items-center justify-center text-[#8b4513] shadow-xl">
                  <i className="fas fa-scroll text-2xl"></i>
                </div>

                <section className="space-y-8 text-right">
                    <div className="flex items-center justify-end gap-6">
                        <button onClick={() => readText(result.history, 'history')} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${readingSection === 'history' ? 'bg-red-800 text-white animate-pulse' : 'bg-[#8b4513] text-yellow-400'}`}><i className={`fas ${readingSection === 'history' ? 'fa-stop' : 'fa-play'}`}></i></button>
                        <h4 className="text-[#5d4037] font-black text-2xl md:text-3xl border-b-4 border-[#8b4513]/20 pb-2">سفر الخلود والتاريخ</h4>
                    </div>
                    <div className="text-[#2d2d2d] text-xl md:text-2xl leading-[2.4] font-bold text-justify first-letter:text-5xl first-letter:font-black first-letter:text-[#8b4513] whitespace-pre-wrap selection:bg-[#8b4513]/20">{result.history}</div>
                </section>

                <section className="space-y-8 text-right bg-[#000]/5 p-8 rounded-3xl border border-[#8b4513]/10">
                    <div className="flex items-center justify-end gap-6">
                        <button onClick={() => readText(result.architecture, 'arch')} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${readingSection === 'arch' ? 'bg-red-800 text-white animate-pulse' : 'bg-[#8b4513] text-yellow-400'}`}><i className={`fas ${readingSection === 'arch' ? 'fa-stop' : 'fa-play'}`}></i></button>
                        <h4 className="text-[#5d4037] font-black text-2xl border-b-4 border-[#8b4513]/20 pb-2">عبقرية العمارة والتشييد</h4>
                    </div>
                    <div className="text-[#3e2723] text-xl leading-loose text-justify italic font-medium">{result.architecture}</div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10">
                    {result.funFacts.map((fact, idx) => (
                      <div key={idx} className="bg-white/40 backdrop-blur-sm border-2 border-[#8b4513]/10 p-6 rounded-3xl text-right flex flex-col items-end group hover:border-[#8b4513]/40 transition-all shadow-sm">
                        <div className="w-10 h-10 bg-[#8b4513] rounded-xl flex items-center justify-center text-yellow-500 mb-4 shadow-md group-hover:scale-110 transition-transform">
                          <i className="fas fa-star text-sm"></i>
                        </div>
                        <p className="text-[#2d2d2d] text-sm font-black leading-relaxed">{fact}</p>
                      </div>
                    ))}
                </div>
            </div>

            <div className="space-y-12">
                {allDiscoveredLandmarks.length === 0 && !nearbyLoading && (
                    <button onClick={findNearby} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700 text-black py-8 rounded-[3rem] font-black shadow-[0_10px_40px_rgba(234,179,8,0.2)] flex items-center justify-center gap-6 transition-all group">
                        <i className="fas fa-map-marked-alt text-3xl group-hover:rotate-12 transition-transform"></i>
                        <span className="text-xl">كشف بوابات التاريخ القريبة (12 معلماً)</span>
                    </button>
                )}

                {nearbyLoading && (
                  <div className="w-full py-20 flex flex-col items-center gap-6 bg-yellow-500/5 rounded-[3rem] border border-yellow-500/10">
                    <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
                    <p className="text-yellow-500 font-bold tracking-widest uppercase text-sm">جاري قراءة الخارطة الأثرية...</p>
                  </div>
                )}

                {allDiscoveredLandmarks.length > 0 && (
                    <div className="space-y-10 animate-in slide-in-from-bottom-6">
                        <div className="text-center space-y-2">
                          <h4 className="text-yellow-500 font-black text-4xl">المعالم المتبقية للاستكشاف</h4>
                          <p className="text-yellow-600/40 text-sm">رحلتك مستمرة.. اختر وجهتك التالية</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {allDiscoveredLandmarks
                              /* حذف المعلم المولد حالياً من قائمة الكروت بالأسفل */
                              .filter(l => l.name.trim() !== result.title.trim())
                              .map((landmark, idx) => (
                                <div key={idx} className="bg-[#0a201c] border border-yellow-600/20 overflow-hidden rounded-[2.5rem] text-right flex flex-col group hover:border-yellow-500 transition-all shadow-2xl">
                                    <div className="h-48 w-full bg-gradient-to-b from-yellow-900/20 to-transparent flex items-center justify-center relative">
                                        <div className="w-24 h-24 rounded-full bg-yellow-600/5 border border-yellow-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.1)] group-hover:shadow-[0_0_40px_rgba(234,179,8,0.3)] transition-all">
                                          <i className={`fas ${landmark.icon || 'fa-landmark'} text-4xl text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]`}></i>
                                        </div>
                                        <div className="absolute top-6 right-6 bg-yellow-600/20 backdrop-blur-md text-yellow-500 px-4 py-1.5 rounded-full text-[10px] font-black border border-yellow-500/20">{landmark.distance}</div>
                                    </div>
                                    <div className="p-8 flex-1 flex flex-col justify-between">
                                        <div>
                                          <h5 className="text-yellow-500 font-black text-lg mb-4">{landmark.name}</h5>
                                          <p className="text-yellow-100/40 text-xs leading-relaxed mb-8 line-clamp-3">{landmark.brief}</p>
                                        </div>
                                        <button onClick={() => handleSelectLandmark(landmark)} className="w-full bg-yellow-500 text-black py-4 rounded-2xl text-xs font-black transition-all hover:bg-yellow-400 active:scale-95">فتح المخطوطة</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; opacity: 0; } 50% { top: 90%; opacity: 1; } }
        body { background-color: #021512; direction: rtl; }
        .papyrus-container {
            background-color: #e4d5b7;
            background-image: linear-gradient(rgba(228, 213, 183, 0.97), rgba(228, 213, 183, 0.97)), url('https://www.transparenttextures.com/patterns/natural-paper.png');
            box-shadow: inset 0 0 100px rgba(139, 69, 19, 0.15), 0 30px 60px rgba(0, 0, 0, 0.5);
            position: relative;
        }
        .papyrus-container::before {
            content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(139, 69, 19, 0.02) 41px, transparent 42px);
            pointer-events: none;
            opacity: 0.5;
        }
      `}</style>
    </div>
  );
};

export default App;
