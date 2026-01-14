
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  about: string; // Combined history and architecture
  funFacts: string[];
  imageUrl?: string;
  googleImagesLink?: string;
  locationLink?: string; // New field for main landmark location
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
    appName: "يالا بينا",
    appGo: "Let's Go",
    explore: "ياللا بينا نستكشف",
    snapHint: "صور المعلم لتعرف حكايته وما حوله",
    searchPlaceholder: "اكتب اسم المعلم...",
    loading: "جاري الاستكشاف",
    loadingSub: "من مصادر موثوقة",
    newDiscovery: "استكشاف جديد",
    shareTitle: "مشاركة المعلومات",
    aboutTitle: "عن الموقع",
    nearbyTitlePrefix: "معالم محيطة بـ ",
    errorCamera: "يرجى تفعيل صلاحية الكاميرا للاستمرار.",
    errorConnection: "حدث خطأ أثناء الاتصال بسجلات التاريخ.",
    tryAgain: "حاول مرة أخرى",
    footerCustom: "View Tours - رفيقك على الطريق",
    copied: "تم نسخ النص بنجاح!",
    sharingFile: "جاري تحضير ملف المعلومات للمشاركة...",
    googleImages: "جوجل",
    uploadImages: "أضف صورك للتقرير",
    directionTo: "الاتجاه إلى",
    searchGoogle: "بحث جوجل"
  },
  en: {
    appName: "Yalla Bina",
    appGo: "Let's Go",
    explore: "Let's Explore",
    snapHint: "Snap the landmark to hear its story",
    searchPlaceholder: "Landmark name...",
    loading: "Exploring",
    loadingSub: "from trusted sources",
    newDiscovery: "New Discovery",
    shareTitle: "Share Information",
    aboutTitle: "About the Site",
    nearbyTitlePrefix: "Landmarks around ",
    errorCamera: "Please enable camera permissions.",
    errorConnection: "Error connecting to records.",
    tryAgain: "Try Again",
    footerCustom: "View Tours - Your travel companion",
    copied: "Text copied successfully!",
    sharingFile: "Preparing information file for sharing...",
    googleImages: "Google",
    uploadImages: "Add Photos to Report",
    directionTo: "Direction to",
    searchGoogle: "Google Search"
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
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadedImages([]);
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

  const getCurrentLocation = (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const cleanJsonString = (str: string) => {
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
  };

  const generateHtmlContent = (title: string, about: string, userImages: string[] = []) => {
    const isRtl = selectedLang === 'ar';
    const imagesHtml = userImages.map(img => `
      <div style="display: flex; justify-content: center; margin-bottom: 20px;">
        <img src="${img}" style="width: 7cm; height: 12cm; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid #8b4513;">
      </div>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html lang="${selectedLang}" dir="${isRtl ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap');
          body { font-family: 'Tajawal', sans-serif; font-weight: 700; padding: 20px; background: #fafafa; color: #333; margin: 0; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #8b4513; border-bottom: 3px solid #ffd700; padding-bottom: 10px; font-size: 28px; text-align: center; margin-bottom: 30px; font-weight: 900; }
          h2 { color: #5d4037; font-size: 22px; margin-top: 30px; border-inline-start: 5px solid #8b4513; padding-inline-start: 15px; margin-bottom: 15px; font-weight: 900; }
          p { font-size: 18px; text-align: justify; color: #444; margin: 0; font-weight: 700; }
          .gallery { margin: 20px 0; display: flex; flex-direction: column; align-items: center; }
          .section { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 25px; }
          .footer { margin-top: 50px; padding: 25px; border-top: 1px solid #ddd; font-weight: 900; font-size: 16px; color: #8b4513; text-align: center; background: #fff9c4; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          
          <div class="gallery">
            ${imagesHtml}
          </div>

          <div class="section">
            <h2>${t.aboutTitle}</h2>
            <p>${about}</p>
          </div>

          <div class="footer">${t.footerCustom}</div>
        </div>
      </body>
      </html>
    `;
  };

  const performAnalysis = async (prompt: string, imageData?: string) => {
    setLoading(true);
    setError(null);
    window.speechSynthesis.cancel();

    try {
      const position = await getCurrentLocation();
      const locationContext = position 
        ? `The user is currently at Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}.`
        : "User location is unavailable.";

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const langName = languages.find(l => l.code === selectedLang)?.name || 'Arabic';
      
      const systemInstruction = `You are an expert historian. DO NOT hallucinate. Use Google Search and Google Maps.
      ${locationContext} First, identify the exact landmark. Then find exactly 26 real historical landmarks strictly within 2000 meters of that location.
      Provide the response in ${langName} language.
      Return ONLY a JSON object:
      {
        "title": "Name of landmark",
        "about": "A massive, detailed article (exactly 600 words) combining both the complete historical timeline and a professional architectural analysis of the site.",
        "funFacts": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5", "Fact 6"],
        "imageUrl": "A direct URL to a high-quality image of this landmark.",
        "googleImagesLink": "A search link for images.",
        "locationLink": "Google Maps link to the main landmark",
        "nearbyLandmarks": [{"name": "Landmark Name", "distance": "distance", "direction": "direction", "description": "short desc"}] 
      }
      IMPORTANT: "about" field MUST be exactly 600 words. "nearbyLandmarks" MUST contain up to 26 items if available.`;

      let parts: any[] = [];
      if (imageData) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageData.split(',')[1] } });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts }],
        config: { 
          systemInstruction, 
          responseMimeType: "application/json", 
          temperature: 0.1,
          tools: [{ googleSearch: {} }]
        }
      });

      const data = JSON.parse(cleanJsonString(response.text || '{}'));
      if (!data.googleImagesLink && data.title) {
        data.googleImagesLink = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(data.title)}`;
      }
      if (!data.locationLink && data.title) {
        data.locationLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.title)}`;
      }
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

  const shareDiscovery = async (isHtml: boolean = false) => {
    if (!result) return;
    if (isHtml) {
      const reportImages = [];
      if (capturedImage) reportImages.push(capturedImage);
      reportImages.push(...uploadedImages);
      
      const html = generateHtmlContent(result.title, result.about, reportImages);
      const file = new File([html], `${result.title}.html`, { type: 'text/html' });
      // FIX: Use explicit type for ShareData and cast to ensure TypeScript compatibility
      const shareData: ShareData = { files: [file], title: result.title };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.title}.html`;
        a.click();
      }
    } else {
      const fullText = `*${result.title}*\n\n*${t.aboutTitle}:*\n${result.about}\n\n${t.footerCustom}`;
      await navigator.clipboard.writeText(fullText);
      alert(t.copied);
    }
  };

  const handleManualPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const readers = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(newImages => {
      // تعديل: إضافة الصور الجديدة إلى القائمة الحالية بدلاً من استبدالها
      setUploadedImages(prev => [...prev, ...newImages]);
    });
  };

  return (
    <div className={`min-h-screen bg-[#021512] text-slate-100 flex flex-col items-center selection:bg-yellow-500/30 font-['Tajawal'] font-bold pb-10 overflow-x-hidden ${selectedLang === 'ar' ? 'rtl-dir' : 'ltr-dir'}`}>
      <header className="w-full py-4 px-6 bg-[#021512]/95 backdrop-blur-md shadow-2xl sticky top-0 z-50 flex flex-col gap-4 border-b border-yellow-600/30 no-print">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                 <span className="text-[24px] font-black text-yellow-500 leading-none tracking-tight">{t.appName}</span>
                 <div className="bg-gradient-to-br from-yellow-400 to-yellow-700 p-2.5 rounded-2xl text-black shadow-[0_0_20px_rgba(234,179,8,0.4)] relative overflow-hidden group">
                    <i className="fas fa-person-walking text-2xl group-hover:animate-bounce"></i>
                 </div>
                 <span className="text-[20px] font-black text-[#90EE90] tracking-widest uppercase leading-none opacity-80">{t.appGo}</span>
              </div>
              <button 
                onClick={startCamera}
                className="mt-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-500 text-[10px] font-black px-4 py-1 rounded-full border border-yellow-500/30 transition-all uppercase tracking-widest active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
              >
                <i className="fas fa-redo-alt mr-1"></i> {t.newDiscovery}
              </button>
            </div>
            <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="bg-white/5 border border-yellow-600/30 rounded-full py-1.5 px-3 text-[11px] font-black text-yellow-500 focus:outline-none focus:border-yellow-500 cursor-pointer h-fit">
              {languages.map(lang => <option key={lang.code} value={lang.code} className="bg-[#021512]">{lang.native}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
              <input type="text" placeholder={t.searchPlaceholder} value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-white/5 border border-yellow-600/30 rounded-full py-2 px-10 text-sm font-bold focus:outline-none focus:border-yellow-500 text-yellow-100" />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600/50 text-xs"></i>
            </form>
            <button onClick={() => fileInputRef.current?.click()} className="bg-yellow-600/10 hover:bg-yellow-600/20 w-10 h-10 rounded-full flex items-center justify-center text-yellow-500 border border-yellow-600/30"><i className="fas fa-camera"></i></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => { 
                  stopCamera(); 
                  setCapturedImage(reader.result as string);
                  performAnalysis("Identify landmark", reader.result as string); 
                };
                reader.readAsDataURL(file);
              }
            }} />
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl px-4 flex-1 flex flex-col py-6">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 no-print text-center">
             {capturedImage && (
              <div className="mb-10 p-4">
                <img src={capturedImage} className="h-40 w-auto rounded-xl border-2 border-yellow-500 shadow-xl mx-auto" alt="Analyzing" />
              </div>
            )}
            <div className="w-40 h-40 relative mx-auto">
                <div className="absolute inset-0 border-t-4 border-yellow-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-yellow-500 text-5xl"><i className="fas fa-person-walking animate-bounce"></i></div>
            </div>
            <div className="mt-10 space-y-2">
              <p className="text-3xl font-black text-yellow-500 animate-pulse uppercase tracking-widest">{t.loading}</p>
              <p className="text-lg font-black text-yellow-600/80">{t.loadingSub}</p>
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
                  if (!videoRef.current) return;
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current.videoWidth;
                  canvas.height = videoRef.current.videoHeight;
                  canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
                  const dataUrl = canvas.toDataURL('image/jpeg');
                  stopCamera();
                  setCapturedImage(dataUrl);
                  performAnalysis("Identify landmark", dataUrl);
                }} className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center text-black shadow-2xl"><i className="fas fa-camera text-3xl"></i></button>
              </div>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-12 pb-20 w-full">
            <div className="text-center space-y-6 no-print">
              <h3 className="text-[26px] font-black text-yellow-500 drop-shadow-2xl whitespace-pre-line leading-tight">{result.title}</h3>
            </div>

            <div className="relative papyrus-container rounded-[3rem] shadow-2xl p-6 md:p-20 space-y-10" dir={selectedLang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="space-y-4 no-print border-b border-brown-900/10 pb-8 flex flex-col items-center">
                  <input 
                    type="file" 
                    multiple 
                    ref={multiFileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleManualPhotoUpload}
                  />
                  
                  <div className="flex gap-4 items-center justify-center flex-wrap">
                    <button 
                      onClick={() => multiFileInputRef.current?.click()}
                      className="bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-full text-md font-black transition-all shadow-lg flex items-center gap-2 active:scale-95"
                    >
                      <i className="fas fa-images"></i>
                      {t.uploadImages}
                    </button>
                    
                    {result.googleImagesLink && (
                      <a 
                        href={result.googleImagesLink}
                        target="_blank"
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full text-md font-black transition-all shadow-lg flex items-center gap-2 active:scale-95"
                      >
                        <i className="fab fa-google"></i>
                        {t.searchGoogle}
                      </a>
                    )}
                  </div>

                  {(uploadedImages.length > 0 || capturedImage) && (
                    <div className="flex gap-2 mt-4 overflow-x-auto w-full justify-center p-2">
                      {capturedImage && (
                        <div className="w-24 h-24 flex-shrink-0 border-2 border-yellow-700/30 rounded-xl overflow-hidden shadow-md">
                          <img src={capturedImage} className="w-full h-full object-cover" alt="Discovery" />
                        </div>
                      )}
                      {uploadedImages.map((img, i) => (
                        <div key={i} className="w-24 h-24 flex-shrink-0 border-2 border-yellow-700/30 rounded-xl overflow-hidden shadow-md">
                          <img src={img} className="w-full h-full object-cover" alt={`Upload ${i}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <section className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-brown-900/10 pb-4">
                        <h4 className="text-[#4e342e] font-black text-3xl">{t.aboutTitle}</h4>
                        <button onClick={() => readText(result.about, 'about')} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${readingSection === 'about' ? 'bg-red-800 text-white' : 'bg-[#5d4037] text-yellow-400'}`}><i className={`fas ${readingSection === 'about' ? 'fa-stop' : 'fa-play'}`}></i></button>
                    </div>
                    <div className="text-[#1a1a1a] text-xl leading-relaxed text-justify whitespace-pre-wrap font-bold">{result.about}</div>
                </section>

                {result.nearbyLandmarks && result.nearbyLandmarks.length > 0 && (
                  <section className="space-y-8 pt-4 border-t-2 border-brown-900/10">
                    <h4 className="text-[#4e342e] font-black text-3xl text-center">
                      {t.nearbyTitlePrefix}{result.title}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.nearbyLandmarks.slice(0, 26).map((landmark, idx) => (
                        <button key={idx} onClick={() => performAnalysis(`Identify landmark: ${landmark.name}`)} className="bg-[#5d4037]/5 hover:bg-[#5d4037]/10 border border-brown-900/10 p-4 rounded-2xl text-start transition-all group flex flex-col gap-1 relative overflow-hidden">
                          <div className="flex justify-between items-start">
                            <span className="text-[#3e2723] font-black text-lg group-hover:text-yellow-800">{landmark.name}</span>
                            <div className="flex flex-col items-end gap-1">
                              <span className="bg-yellow-700/10 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full">{landmark.distance}</span>
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(landmark.name)}`} target="_blank" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 bg-[#005a66] hover:bg-[#007a8a] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase transition-colors"><i className="fas fa-location-arrow"></i><span>{landmark.direction}</span></a>
                            </div>
                          </div>
                          <p className="text-[#1a1a1a] text-xs font-bold opacity-70 line-clamp-1">{landmark.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="flex flex-col items-center gap-4 pt-8 no-print border-t border-brown-900/10 w-full">
                   <p className="text-[#4e342e] font-black text-sm uppercase">{t.shareTitle}</p>
                   <div className="flex gap-8 items-center justify-center flex-wrap">
                      <button onClick={() => shareDiscovery(false)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform hover:scale-110 bg-[#4e342e] text-yellow-400">
                        <i className="fas fa-copy"></i>
                      </button>
                      
                      {result?.locationLink && (
                        <div className="flex flex-col items-center gap-2">
                           <a href={result.locationLink} target="_blank" className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform hover:scale-110 bg-red-700 text-white">
                             <i className="fas fa-location-arrow"></i>
                           </a>
                           <span className="text-[#4e342e] text-[10px] md:text-xs font-black text-center max-w-[80px]">
                             {t.directionTo}<br/>{result.title}
                           </span>
                        </div>
                      )}
                      
                      <button onClick={() => shareDiscovery(true)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform hover:scale-110 bg-yellow-600 text-white">
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
        .papyrus-container {
            background-color: #e4d5b7;
            background-image: linear-gradient(rgba(228, 213, 183, 0.98), rgba(228, 213, 183, 0.98)), url('https://www.transparenttextures.com/patterns/natural-paper.png');
            box-shadow: inset 0 0 100px rgba(139, 69, 19, 0.15), 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        * { font-weight: 700 !important; }
        .font-black, h1, h2, h3, h4, span.font-black { font-weight: 900 !important; }
      `}</style>
    </div>
  );
};

export default App;
