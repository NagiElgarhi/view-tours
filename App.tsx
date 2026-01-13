
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  history: string;
  architecture: string;
  funFacts: string[];
  nearbyLandmarks?: { name: string; distance: string; direction: string; description: string }[];
}

const languages = [
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' }
];

const translations: Record<string, any> = {
  ar: {
    appName: "ياللا بينا",
    explore: "ياللا بينا نستكشف",
    snapHint: "صور المعلم لتعرف حكايته وما حوله",
    searchPlaceholder: "اكتب اسم المعلم...",
    loading: "جاري الاستكشاف",
    loadingSub: "من مصادر موثوقة",
    newDiscovery: "استكشاف جديد",
    shareTitle: "مشاركة المعلومات",
    shareNearbyTitle: "مشاركة قائمة المعالم المحيطة",
    historyTitle: "التسلسل التاريخي",
    archTitle: "التصميم المعماري",
    nearbyTitle: "معالم محيطة (في نطاق 1000 متر)",
    errorCamera: "يرجى تفعيل صلاحية الكاميرا للاستمرار.",
    errorConnection: "حدث خطأ أثناء الاتصال بسجلات التاريخ.",
    tryAgain: "حاول مرة أخرى",
    footerCustom: "ياللا بينا - LET'S GO رفيقك على الطريق",
    copied: "تم نسخ النص بنجاح!",
    sharingFile: "جاري تحضير ملف المعلومات للمشاركة..."
  },
  en: {
    appName: "LET'S GO",
    explore: "Let's Explore",
    snapHint: "Snap the landmark to hear its story",
    searchPlaceholder: "Landmark name...",
    loading: "Exploring",
    loadingSub: "from trusted sources",
    newDiscovery: "New Discovery",
    shareTitle: "Share Information",
    shareNearbyTitle: "Share Nearby Places",
    historyTitle: "Historical Timeline",
    archTitle: "Architectural Design",
    nearbyTitle: "Nearby Landmarks (within 1000m)",
    errorCamera: "Please enable camera permissions.",
    errorConnection: "Error connecting to records.",
    tryAgain: "Try Again",
    footerCustom: "ياللا بينا - LET'S GO رفيقك على الطريق",
    copied: "Text copied successfully!",
    sharingFile: "Preparing information file for sharing..."
  }
};

const App: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [selectedLang, setSelectedLang] = useState('ar');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readingSection, setReadingSection] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[selectedLang] || translations.en;

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
    setCapturedImage(null);
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
      setError(t.errorCamera);
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

  const cleanJsonString = (str: string) => {
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
  };

  const generateHtmlContent = (title: string, history: string, arch: string, nearby: any[] = []) => {
    const isRtl = selectedLang === 'ar';
    return `
      <!DOCTYPE html>
      <html lang="${selectedLang}" dir="${isRtl ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #fafafa; color: #333; margin: 0; }
          .container { max-width: 100%; }
          h1 { color: #8b4513; border-bottom: 3px solid #ffd700; padding-bottom: 8px; font-size: 24px; text-align: center; }
          h2 { color: #5d4037; font-size: 20px; margin-top: 25px; border-inline-start: 4px solid #8b4513; padding-inline-start: 10px; }
          p { line-height: 1.6; font-size: 16px; text-align: justify; color: #444; }
          .section { background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 20px; }
          .nearby-grid { display: block; }
          .nearby-item { background: #fff; padding: 12px; margin-bottom: 12px; border-radius: 10px; border: 1px solid #eee; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
          .landmark-name { font-weight: bold; color: #8b4513; display: block; margin-bottom: 4px; font-size: 17px; }
          .meta { font-size: 12px; color: #005a66; font-weight: bold; display: flex; gap: 10px; margin-bottom: 5px; }
          .desc { font-size: 14px; color: #666; }
          .footer { margin-top: 40px; padding: 20px; border-top: 1px solid #ddd; font-weight: bold; font-size: 14px; color: #8b4513; text-align: center; background: #fff9c4; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          
          <div class="section">
            <h2>${t.historyTitle}</h2>
            <p>${history}</p>
          </div>

          <div class="section">
            <h2>${t.archTitle}</h2>
            <p>${arch}</p>
          </div>

          ${nearby && nearby.length > 0 ? `
          <div class="section">
            <h2>${t.nearbyTitle}</h2>
            <div class="nearby-grid">
              ${nearby.map(l => `
                <div class="nearby-item">
                  <span class="landmark-name">${l.name}</span>
                  <div class="meta">
                    <span>📏 ${l.distance}</span>
                    <span>🧭 ${l.direction}</span>
                  </div>
                  <div class="desc">${l.description}</div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <div class="footer">${t.footerCustom}</div>
        </div>
      </body>
      </html>
    `;
  };

  const performAnalysis = async (prompt: string, imageData?: string) => {
    setLoading(true);
    setError(null);
    if (imageData) setCapturedImage(imageData);
    window.speechSynthesis.cancel();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const langName = languages.find(l => l.code === selectedLang)?.name || 'Arabic';
      
      const systemInstruction = `You are an expert historian. DO NOT hallucinate. Use Google Search to verify all facts.
      Provide the response in ${langName} language.
      Return ONLY a JSON object:
      {
        "title": "Name of landmark",
        "history": "Detailed accurate history (min 500 words)",
        "architecture": "A comprehensive architectural analysis (min 300 words).",
        "funFacts": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5", "Fact 6"],
        "nearbyLandmarks": [{"name": "Landmark Name", "distance": "e.g. 300m", "direction": "Cardinal direction from the main landmark, e.g., North, Southeast", "description": "short description"}] 
      }
      IMPORTANT: Find up to 12 real landmarks strictly within 1000 meters of this location. For each, specify the EXACT distance in meters and the REAL cardinal direction relative to the main landmark.`;

      const contents: any = imageData 
        ? { parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageData.split(',')[1] } }, { text: prompt }] }
        : { parts: [{ text: prompt }] };

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [contents],
        config: { 
          systemInstruction, 
          responseMimeType: "application/json", 
          temperature: 0.1,
          tools: [{ googleSearch: {} }]
        }
      });

      const data = JSON.parse(cleanJsonString(response.text || '{}'));
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(t.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    stopCamera();
    performAnalysis(`Search for and identify: ${searchText}`);
  };

  const readText = (text: string, sectionId: string) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (readingSection === sectionId) { return setReadingSection(null); }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang === 'ar' ? 'ar-SA' : selectedLang === 'en' ? 'en-US' : selectedLang;
    utterance.onstart = () => setReadingSection(sectionId);
    utterance.onend = () => setReadingSection(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleFileShare = async (htmlContent: string, fileName: string) => {
    const file = new File([htmlContent], `${fileName}.html`, { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: fileName,
          text: t.sharingFile
        });
      } catch (err) {
        console.error("Share failed", err);
        executeShare(fileName);
      }
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.html`;
      a.click();
    }
  };

  const shareDiscovery = async (isHtml: boolean = false) => {
    if (!result) return;
    if (isHtml) {
      const html = generateHtmlContent(result.title, result.history, result.architecture, result.nearbyLandmarks);
      await handleFileShare(html, result.title);
    } else {
      const fullText = `*${result.title}*\n\n*${t.historyTitle}:*\n${result.history}\n\n*${t.archTitle}:*\n${result.architecture}\n\n${t.footerCustom}`;
      executeShare(fullText);
    }
  };

  const executeShare = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(t.copied);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(t.copied);
    }
  };

  return (
    <div className={`min-h-screen bg-[#021512] text-slate-100 flex flex-col items-center selection:bg-yellow-500/30 font-['Tajawal'] pb-10 overflow-x-hidden ${selectedLang === 'ar' ? 'rtl-dir' : 'ltr-dir'}`}>
      <header className="w-full py-4 px-6 bg-[#021512]/95 backdrop-blur-md shadow-2xl sticky top-0 z-50 flex flex-col md:flex-row gap-4 justify-between items-center border-b border-yellow-600/30 no-print">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
             <span className="text-[20px] font-bold text-[#90EE90] tracking-widest uppercase leading-none opacity-80">{translations.en.appName}</span>
             <div className="bg-gradient-to-br from-yellow-400 to-yellow-700 p-2.5 rounded-2xl text-black shadow-[0_0_20px_rgba(234,179,8,0.4)] relative overflow-hidden group">
                <i className="fas fa-person-walking text-2xl group-hover:animate-bounce"></i>
             </div>
             <span className="text-[24px] font-black text-yellow-500 leading-none tracking-tight">{translations.ar.appName}</span>
          </div>
          
          <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="bg-white/5 border border-yellow-600/30 rounded-full py-1.5 px-3 text-[11px] font-bold text-yellow-500 focus:outline-none focus:border-yellow-500 cursor-pointer">
            {languages.map(lang => (
              <option key={lang.code} value={lang.code} className="bg-[#021512]">{lang.native}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input type="text" placeholder={t.searchPlaceholder} value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-white/5 border border-yellow-600/30 rounded-full py-2 px-10 text-sm focus:outline-none focus:border-yellow-500 text-yellow-100" />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600/50 text-xs"></i>
          </form>
          <button onClick={() => fileInputRef.current?.click()} className="bg-yellow-600/10 hover:bg-yellow-600/20 w-10 h-10 rounded-full flex items-center justify-center text-yellow-500 border border-yellow-600/30">
            <i className="fas fa-image"></i>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => { stopCamera(); performAnalysis("Identify landmark", reader.result as string); };
              reader.readAsDataURL(file);
            }
          }} />
        </div>
      </header>

      <main className="w-full max-w-5xl px-4 flex-1 flex flex-col py-6">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 no-print text-center">
            <div className="w-40 h-40 relative mx-auto">
                <div className="absolute inset-0 border-t-4 border-yellow-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-yellow-500 text-5xl">
                   <i className="fas fa-person-walking animate-bounce"></i>
                </div>
            </div>
            <div className="mt-10 space-y-2">
              <p className="text-3xl font-black text-yellow-500 animate-pulse uppercase tracking-widest">{t.loading}</p>
              <p className="text-lg font-medium text-yellow-600/80">{t.loadingSub}</p>
            </div>
          </div>
        )}

        {isScanning && !loading && !error && (
          <div className="flex-1 flex flex-col gap-6 w-full max-w-2xl mx-auto no-print">
            <div className="relative rounded-[3.5rem] overflow-hidden border-4 border-yellow-600/20 shadow-2xl aspect-[3/4] bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] animate-[scan_3s_infinite]"></div>
              <div className="absolute bottom-12 left-0 w-full flex justify-center">
                <button onClick={() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current!.videoWidth;
                  canvas.height = videoRef.current!.videoHeight;
                  canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
                  const dataUrl = canvas.toDataURL('image/jpeg');
                  stopCamera();
                  performAnalysis("Identify landmark", dataUrl);
                }} className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center text-black shadow-2xl">
                  <i className="fas fa-camera text-3xl"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-12 pb-20 w-full">
            <div className="text-center space-y-6 no-print">
              <h3 className="text-5xl md:text-7xl font-black text-yellow-500 drop-shadow-2xl">{result.title}</h3>
              <button onClick={startCamera} className="bg-yellow-600/10 border-2 border-yellow-500/30 px-8 py-3 rounded-full text-sm font-black text-yellow-500 hover:bg-yellow-600/20 transition-all">
                <i className="fas fa-camera ml-2"></i> {t.newDiscovery}
              </button>
            </div>

            <div className="relative papyrus-container rounded-[3rem] shadow-2xl p-10 md:p-20 space-y-16" dir={selectedLang === 'ar' ? 'rtl' : 'ltr'}>
                <section className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-brown-900/10 pb-4">
                        <h4 className="text-[#4e342e] font-black text-3xl">{t.historyTitle}</h4>
                        <button onClick={() => readText(result.history, 'history')} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${readingSection === 'history' ? 'bg-red-800 text-white' : 'bg-[#5d4037] text-yellow-400'}`}><i className={`fas ${readingSection === 'history' ? 'fa-stop' : 'fa-play'}`}></i></button>
                    </div>
                    <div className="text-[#1a1a1a] text-xl leading-relaxed text-justify whitespace-pre-wrap">{result.history}</div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-brown-900/10 pb-4">
                        <h4 className="text-[#4e342e] font-black text-3xl">{t.archTitle}</h4>
                        <button onClick={() => readText(result.architecture, 'arch')} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${readingSection === 'arch' ? 'bg-red-800 text-white' : 'bg-[#5d4037] text-yellow-400'}`}><i className={`fas ${readingSection === 'arch' ? 'fa-stop' : 'fa-play'}`}></i></button>
                    </div>
                    <div className="text-[#3e2723] text-lg leading-relaxed text-justify italic font-serif whitespace-pre-wrap">{result.architecture}</div>
                </section>

                {/* Nearby Landmarks integrated into the main container */}
                {result.nearbyLandmarks && result.nearbyLandmarks.length > 0 && (
                  <section className="space-y-8 pt-4 border-t-2 border-brown-900/10">
                    <h4 className="text-[#4e342e] font-black text-3xl text-center">{t.nearbyTitle}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.nearbyLandmarks.slice(0, 12).map((landmark, idx) => (
                        <button key={idx} onClick={() => performAnalysis(`Identify landmark: ${landmark.name}`)} className="bg-[#5d4037]/5 hover:bg-[#5d4037]/10 border border-brown-900/10 p-4 rounded-2xl text-start transition-all group flex flex-col gap-1">
                          <div className="flex justify-between items-start">
                            <span className="text-[#3e2723] font-bold text-lg group-hover:text-yellow-800">{landmark.name}</span>
                            <div className="flex flex-col items-end gap-1">
                              <span className="bg-yellow-700/10 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">{landmark.distance}</span>
                              <span className="bg-[#005a66] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">🧭 {landmark.direction}</span>
                            </div>
                          </div>
                          <p className="text-[#1a1a1a] text-xs opacity-70 line-clamp-1">{landmark.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="flex flex-col items-center gap-4 pt-8 no-print border-t border-brown-900/10">
                   <p className="text-[#4e342e] font-black text-sm uppercase">{t.shareTitle}</p>
                   <div className="flex gap-8">
                      {/* Copy Button */}
                      <button onClick={() => shareDiscovery(false)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform hover:scale-110 active:scale-95 bg-[#4e342e] text-yellow-400">
                         <i className="fas fa-copy"></i>
                      </button>
                      {/* Share Button (using generic share icon) */}
                      <button onClick={() => shareDiscovery(true)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform hover:scale-110 active:scale-95 bg-yellow-600 text-white">
                         <i className="fas fa-share-nodes"></i>
                      </button>
                   </div>
                </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; opacity: 0; } 50% { top: 90%; opacity: 1; } }
        body { background-color: #021512; margin: 0; }
        .papyrus-container {
            background-color: #e4d5b7;
            background-image: linear-gradient(rgba(228, 213, 183, 0.98), rgba(228, 213, 183, 0.98)), url('https://www.transparenttextures.com/patterns/natural-paper.png');
            box-shadow: inset 0 0 100px rgba(139, 69, 19, 0.15), 0 20px 50px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
