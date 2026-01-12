
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

// Types
interface AnalysisResult {
  title: string;
  history: string;
  architecture: string;
  funFacts: string[];
  unrecognized?: boolean;
}

interface NearbyLandmark {
  name: string;
  distance: string;
  brief: string;
  icon: string;
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
    loading: "استمتع بتجوالك...",
    newDiscovery: "استكشاف جديد",
    downloadPdf: "تحميل التقرير PDF",
    historyTitle: "التسلسل التاريخي",
    archTitle: "التصميم المعماري",
    nearbyTitle: "وجهات قريبة (في محيط 1000م)",
    noNearby: "لا توجد معالم أخرى في الجوار المباشر",
    errorCamera: "يرجى تفعيل صلاحية الكاميرا للاستمرار.",
    errorUnrecognized: "عذراً، لم أتمكن من التعرف على هذا المعلم بدقة.",
    errorConnection: "حدث خطأ أثناء الاتصال بسجلات التاريخ.",
    goThere: "اذهب إلى هناك",
    tryAgain: "حاول مرة أخرى",
    searchingSurroundings: "جاري البحث عما حولك..."
  },
  en: {
    appName: "Let's go",
    explore: "Let's Explore",
    snapHint: "Snap the landmark to hear its story",
    searchPlaceholder: "Landmark name...",
    loading: "Enjoy your tour...",
    newDiscovery: "New Discovery",
    downloadPdf: "Download PDF Report",
    historyTitle: "Historical Timeline",
    archTitle: "Architectural Design",
    nearbyTitle: "Nearby Spots (1000m radius)",
    noNearby: "No other landmarks nearby",
    errorCamera: "Please enable camera permissions to continue.",
    errorUnrecognized: "Sorry, I couldn't recognize this landmark accurately.",
    errorConnection: "Error connecting to historical records.",
    goThere: "Explore this",
    tryAgain: "Try Again",
    searchingSurroundings: "Searching surroundings..."
  },
  fr: {
    appName: "Allons-y",
    explore: "Explorons ensemble",
    snapHint: "Prenez une photo pour connaître son histoire",
    searchPlaceholder: "Nom du monument...",
    loading: "Profitez de votre visite...",
    newDiscovery: "Nouvelle découverte",
    downloadPdf: "Télécharger le rapport PDF",
    historyTitle: "Chronologie historique",
    archTitle: "Design architectural",
    nearbyTitle: "Sites à proximité (rayon de 1000m)",
    noNearby: "Aucun autre monument à proximité",
    errorCamera: "Veuillez activer les permissions de la caméra.",
    errorUnrecognized: "Désolé, je n'ai pas pu reconnaître ce monument.",
    errorConnection: "Erreur de connexion aux archives historiques.",
    goThere: "Y aller",
    tryAgain: "Réessayer",
    searchingSurroundings: "Recherche aux alentours..."
  },
  tr: {
    appName: "Hadi Gidelim",
    explore: "Hadi Keşfedelim",
    snapHint: "Hikayesini öğrenmek için fotoğrafını çekin",
    searchPlaceholder: "Yer adı...",
    loading: "Turun tadını çıkarın...",
    newDiscovery: "Yeni Keşif",
    downloadPdf: "PDF Raporunu İndir",
    historyTitle: "Tarihsel Zaman Çizelgesi",
    archTitle: "Mimari Tasarım",
    nearbyTitle: "Yakındaki Yerler (1000m yarıçap)",
    noNearby: "Yakında başka önemli yer yok",
    errorCamera: "Devam etmek için lütfen kamera izinlerini açın.",
    errorUnrecognized: "Üzgünüm, bu yeri tam olarak tanıyamadım.",
    errorConnection: "Tarih kayıtlarına bağlanırken hata oluştu.",
    goThere: "Buraya git",
    tryAgain: "Tekrar Dene",
    searchingSurroundings: "Çevredeki yerler aranıyor..."
  },
  de: {
    appName: "Lass uns gehen",
    explore: "Lass uns erkunden",
    snapHint: "Fotografieren Sie das Denkmal für seine Geschichte",
    searchPlaceholder: "Name des Denkmals...",
    loading: "Genießen Sie Ihre Tour...",
    newDiscovery: "Neue Entdeckung",
    downloadPdf: "PDF-Bericht herunterladen",
    historyTitle: "Historische Zeitleiste",
    archTitle: "Architektonisches Design",
    nearbyTitle: "Orte in der Nähe (1000m Radius)",
    noNearby: "Keine weiteren Sehenswürdigkeiten in der Nähe",
    errorCamera: "Bitte Kamera-Berechtigungen aktivieren.",
    errorUnrecognized: "Entschuldigung, ich konnte dieses Denkmal nicht erkennen.",
    errorConnection: "Fehler beim Verbinden mit historischen Aufzeichnungen.",
    goThere: "Dorthin gehen",
    tryAgain: "Erneut versuchen",
    searchingSurroundings: "Umgebung wird gesucht..."
  },
  it: {
    appName: "Andiamo",
    explore: "Esploriamo",
    snapHint: "Scatta una foto per scoprire la sua storia",
    searchPlaceholder: "Nome del monumento...",
    loading: "Goditi il tuo tour...",
    newDiscovery: "Nuova scoperta",
    downloadPdf: "Scarica il rapporto PDF",
    historyTitle: "Cronologia storica",
    archTitle: "Design architettonico",
    nearbyTitle: "Siti nelle vicinanze (raggio 1000m)",
    noNearby: "Nessun altro monumento nelle vicinanze",
    errorCamera: "Abilita i permessi della fotocamera.",
    errorUnrecognized: "Spiacente, non ho riconosciuto questo monumento.",
    errorConnection: "Errore di connessione ai record storici.",
    goThere: "Vai lì",
    tryAgain: "Riprova",
    searchingSurroundings: "Ricerca nei dintorni..."
  }
};

const App: React.FC = () => {
  const [searchText, setSearchText] = useState("");
  const [selectedLang, setSelectedLang] = useState('ar');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [readingSection, setReadingSection] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [allDiscoveredLandmarks, setAllDiscoveredLandmarks] = useState<NearbyLandmark[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const cleanJsonString = (str: string) => str.replace(/```json/g, '').replace(/```/g, '').trim();

  const fetchNearbyLandmarks = async (targetTitle: string) => {
    setNearbyLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const langName = languages.find(l => l.code === selectedLang)?.name || 'Arabic';
      const prompt = `Find landmarks/attractions strictly within 1000m of "${targetTitle}". 
      Respond in ${langName}. Max 12 landmarks.
      Return JSON:
      [
        {"name": "Landmark name", "distance": "e.g. 300m", "brief": "Very brief summary", "icon": "fa-monument"}
      ]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(cleanJsonString(response.text || '[]'));
      const filtered = data.filter((l: NearbyLandmark) => l.name.trim().toLowerCase() !== targetTitle.trim().toLowerCase());
      setAllDiscoveredLandmarks(filtered);
    } catch (err) {
      console.error("Error fetching nearby:", err);
    } finally {
      setNearbyLoading(false);
    }
  };

  const performAnalysis = async (prompt: string, imageData?: string, keepNearby = false) => {
    setLoading(true);
    setError(null);
    window.speechSynthesis.cancel();
    if (!keepNearby) setAllDiscoveredLandmarks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const langName = languages.find(l => l.code === selectedLang)?.name || 'Arabic';
      const systemInstruction = `You are a world-class historian. 
      Analyze the landmark in ${langName}. If unrecognized, return JSON: {"unrecognized": true}.
      Return epic report in JSON:
      {
        "title": "Name of Landmark",
        "history": "Epic long historical narrative (600+ words)",
        "architecture": "Deep architectural and artistic analysis",
        "funFacts": ["6 amazing facts"]
      }`;

      const contents: any = imageData 
        ? [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageData.split(',')[1] } }, { text: prompt }] }]
        : [{ parts: [{ text: prompt }] }];

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents,
        config: { systemInstruction, responseMimeType: "application/json", temperature: 0.1 }
      });

      const data = JSON.parse(cleanJsonString(response.text || '{}'));
      
      if (data.unrecognized) {
        setError(t.errorUnrecognized);
        setResult(null);
      } else {
        setResult(data);
        fetchNearbyLandmarks(data.title);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(t.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    stopCamera();
    performAnalysis(`Analyze this landmark: ${searchText}`);
  };

  const handleSelectLandmark = (landmark: NearbyLandmark) => {
    setAllDiscoveredLandmarks(prev => prev.filter(l => l.name !== landmark.name));
    setSearchText(landmark.name);
    performAnalysis(`Analyze this landmark: ${landmark.name}`, undefined, true);
  };

  const readText = (text: string, sectionId: string) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (readingSection === sectionId) { return setReadingSection(null); }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = { ar: 'ar-SA', en: 'en-US', fr: 'fr-FR', tr: 'tr-TR', de: 'de-DE', it: 'it-IT' };
    utterance.lang = langMap[selectedLang] || 'ar-SA';
    utterance.onstart = () => setReadingSection(sectionId);
    utterance.onend = () => setReadingSection(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen bg-[#021512] text-slate-100 flex flex-col items-center selection:bg-yellow-500/30 font-['Tajawal'] pb-10 overflow-x-hidden ${selectedLang === 'ar' ? 'rtl-dir' : 'ltr-dir'}`}>
      <header className="w-full py-4 px-6 bg-[#021512]/95 backdrop-blur-md shadow-2xl sticky top-0 z-50 flex flex-col md:flex-row gap-4 justify-between items-center border-b border-yellow-600/30 no-print">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-700 p-2 rounded-xl text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]">
            <i className="fas fa-route text-lg"></i>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:gap-3">
            <h1 className="text-[22px] font-black text-yellow-500 leading-none">{t.appName}</h1>
            <span className="text-[22px] font-bold text-[#90EE90] tracking-tight uppercase leading-none">Let's go</span>
          </div>
          
          <select 
            value={selectedLang} 
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-white/5 border border-yellow-600/30 rounded-full py-1.5 px-3 text-[11px] font-bold text-yellow-500 focus:outline-none focus:border-yellow-500 hover:bg-white/10 transition-colors cursor-pointer"
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code} className="bg-[#021512]">{lang.native}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder={t.searchPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-white/5 border border-yellow-600/30 rounded-full py-2 px-10 text-sm focus:outline-none focus:border-yellow-500 transition-all text-yellow-100 placeholder-yellow-900/40"
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
              reader.onloadend = () => { stopCamera(); performAnalysis("Identify this landmark", reader.result as string); };
              reader.readAsDataURL(file);
            }
          }} />
        </div>
      </header>

      <main className="w-full max-w-5xl px-4 flex-1 flex flex-col py-6">
        {error && (
          <div className="my-10 p-8 bg-red-900/20 border-2 border-red-500/50 rounded-[2rem] text-center animate-in zoom-in no-print">
            <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p className="text-xl font-bold text-red-200 mb-6">{error}</p>
            <button onClick={startCamera} className="bg-red-500 hover:bg-red-400 text-white px-8 py-3 rounded-full font-black transition-all">{t.tryAgain}</button>
          </div>
        )}

        {isScanning && !loading && !error && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in w-full max-w-2xl mx-auto no-print">
            <div className="text-center py-4">
               <h2 className="text-3xl font-black text-yellow-500 drop-shadow-lg">{t.explore}</h2>
               <p className="text-yellow-600/60 text-sm">{t.snapHint}</p>
            </div>
            <div className="relative rounded-[3rem] overflow-hidden border-4 border-yellow-600/20 shadow-2xl aspect-[3/4] bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] animate-[scan_3s_infinite]"></div>
              <div className="absolute bottom-10 left-0 w-full flex justify-center">
                <button onClick={() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current!.videoWidth;
                  canvas.height = videoRef.current!.videoHeight;
                  canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
                  stopCamera();
                  performAnalysis("Identify this landmark", canvas.toDataURL('image/jpeg'));
                }} className="w-20 h-20 bg-black/60 backdrop-blur-md rounded-full p-1 border-2 border-yellow-500 shadow-2xl hover:scale-105 transition-all group">
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center text-black">
                    <i className="fas fa-camera text-2xl"></i>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {(loading || (nearbyLoading && !result)) && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 no-print">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-4 border-yellow-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-yellow-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-yellow-500 text-3xl">
                <i className="fas fa-person-walking animate-bounce"></i>
              </div>
            </div>
            <p className="mt-8 text-2xl font-black text-yellow-500 animate-pulse">{t.loading}</p>
          </div>
        )}

        {result && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 pb-20 w-full">
            <div className="text-center space-y-4 no-print">
              <div className="inline-block p-6 rounded-full bg-yellow-600/10 border border-yellow-500/30 mb-4">
                <i className="fas fa-landmark-dome text-6xl text-yellow-500"></i>
              </div>
              <h3 className="text-4xl md:text-6xl font-black text-yellow-500 drop-shadow-lg px-4">{result.title}</h3>
              <div className="flex justify-center gap-3">
                <button onClick={startCamera} className="bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 px-6 py-2 rounded-full text-xs font-bold transition-all"><i className="fas fa-camera ml-2"></i> {t.newDiscovery}</button>
                <button onClick={handleDownloadPDF} className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-full text-xs font-black transition-all shadow-lg"><i className="fas fa-file-pdf ml-2"></i> {t.downloadPdf}</button>
              </div>
            </div>

            <div className="relative papyrus-container rounded-[2rem] shadow-2xl p-8 md:p-20 space-y-16 border-t-4 border-yellow-700/50 print-area">
                <section className="space-y-8 text-start">
                    <div className="flex items-center gap-6 justify-between flex-row-reverse">
                        <h4 className="text-[#5d4037] font-black text-2xl md:text-3xl border-b-4 border-[#8b4513]/20 pb-2">{t.historyTitle}</h4>
                        <button onClick={() => readText(result.history, 'history')} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all no-print ${readingSection === 'history' ? 'bg-red-800 text-white animate-pulse' : 'bg-[#8b4513] text-yellow-400'}`}><i className={`fas ${readingSection === 'history' ? 'fa-stop' : 'fa-play'}`}></i></button>
                    </div>
                    <div className="text-[#2d2d2d] text-xl md:text-2xl leading-[2.4] font-bold text-justify whitespace-pre-wrap">{result.history}</div>
                </section>

                <section className="space-y-8 text-start bg-black/5 p-8 rounded-3xl">
                    <div className="flex items-center gap-6 justify-between flex-row-reverse">
                        <h4 className="text-[#5d4037] font-black text-2xl border-b-4 border-[#8b4513]/20 pb-2">{t.archTitle}</h4>
                        <button onClick={() => readText(result.architecture, 'arch')} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all no-print ${readingSection === 'arch' ? 'bg-red-800 text-white animate-pulse' : 'bg-[#8b4513] text-yellow-400'}`}><i className={`fas ${readingSection === 'arch' ? 'fa-stop' : 'fa-play'}`}></i></button>
                    </div>
                    <div className="text-[#3e2723] text-xl leading-loose text-justify italic font-medium">{result.architecture}</div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10">
                    {result.funFacts.map((fact, idx) => (
                      <div key={idx} className="bg-white/40 border-2 border-[#8b4513]/10 p-6 rounded-3xl text-start flex flex-col items-start shadow-sm">
                        <div className="w-10 h-10 bg-[#8b4513] rounded-xl flex items-center justify-center text-yellow-500 mb-4">
                          <i className="fas fa-star text-sm"></i>
                        </div>
                        <p className="text-[#2d2d2d] text-sm font-black leading-relaxed">{fact}</p>
                      </div>
                    ))}
                </div>
            </div>

            <div className="space-y-12 no-print">
                <div className="text-center space-y-2">
                  <h4 className="text-yellow-500 font-black text-4xl">
                    {nearbyLoading ? t.searchingSurroundings : 
                     allDiscoveredLandmarks.length > 0 ? t.nearbyTitle : t.noNearby}
                  </h4>
                </div>

                {allDiscoveredLandmarks.length > 0 && !nearbyLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-bottom-6">
                        {allDiscoveredLandmarks.map((landmark, idx) => (
                            <div key={idx} className="bg-[#0a201c] border border-yellow-600/20 overflow-hidden rounded-[2.5rem] text-start flex flex-col group hover:border-yellow-500 transition-all shadow-2xl">
                                <div className="h-40 w-full bg-gradient-to-b from-yellow-900/20 flex items-center justify-center relative">
                                    <i className={`fas ${landmark.icon || 'fa-location-dot'} text-4xl text-yellow-500 group-hover:scale-110 transition-transform`}></i>
                                    <div className="absolute top-4 right-4 bg-yellow-600/20 px-4 py-1 rounded-full text-[10px] font-black text-yellow-500 border border-yellow-500/20">{landmark.distance}</div>
                                </div>
                                <div className="p-8 flex-1 flex flex-col justify-between">
                                    <div>
                                      <h5 className="text-yellow-500 font-black text-lg mb-4">{landmark.name}</h5>
                                      <p className="text-yellow-100/40 text-xs leading-relaxed line-clamp-2 mb-6">{landmark.brief}</p>
                                    </div>
                                    <button onClick={() => handleSelectLandmark(landmark)} className="w-full bg-yellow-500 text-black py-4 rounded-2xl text-xs font-black hover:bg-yellow-400 active:scale-95 transition-all">{t.goThere}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; opacity: 0; } 50% { top: 90%; opacity: 1; } }
        body { background-color: #021512; }
        .rtl-dir { direction: rtl; }
        .ltr-dir { direction: ltr; }
        .papyrus-container {
            background-color: #e4d5b7;
            background-image: linear-gradient(rgba(228, 213, 183, 0.97), rgba(228, 213, 183, 0.97)), url('https://www.transparenttextures.com/patterns/natural-paper.png');
            box-shadow: inset 0 0 100px rgba(139, 69, 19, 0.15), 0 30px 60px rgba(0, 0, 0, 0.5);
            position: relative;
        }

        @media print {
            .no-print { display: none !important; }
            body { background: white !important; padding: 0 !important; margin: 0 !important; }
            .print-area { 
                box-shadow: none !important; 
                border: none !important; 
                width: 100% !important; 
                max-width: none !important;
                margin: 0 !important;
                padding: 1cm !important;
                background-color: #fdf6e3 !important;
            }
            .papyrus-container { background-image: none !important; }
            * { color: black !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

export default App;
