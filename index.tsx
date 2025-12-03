import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- DATA: Traditional Chinese Zen Quotes ---
const ZEN_QUOTES = [
  "本來無一物，何處惹塵埃", // Bodhi has no tree...
  "行到水窮處，坐看雲起時", // Walk to where the water ends...
  "掬水月在手，弄花香滿衣", // Water in hand holds the moon...
  "萬古長空，一朝風月",     // Eternal void, momentary wind and moon
  "心隨萬境轉，轉處實能幽", // The mind follows the myriad circumstances...
  "應無所住，而生其心",     // Dwell nowhere and bring forth the mind
  "溪聲便是廣長舌，山色無非清淨身", // Stream sound is the teaching...
  "一花一世界，一葉一菩提", // One flower, one world...
  "身如琉璃，內外明徹",     // Body like lapis lazuli...
  "风来疏竹，风过而竹不留声", // Wind passes bamboo without leaving sound
  "宠辱不惊，看庭前花开花落", // Unmoved by favor or disgrace...
  "去留无意，望天上云卷云舒"  // Leaving or staying with no intent...
];

// --- AUDIO ENGINE: Procedural Zen Soundscapes ---

interface ThemePreset {
  name: string;
  type: 'piano' | 'bell' | 'pluck' | 'pad' | 'wood';
  scale: number[];
  filterFreq?: number; // Lowpass filter cutoff
  decay: number;       // Note decay time
  delayTime: number;   // Echo delay
  feedback: number;    // Echo feedback
  probability: number; // Chance to trigger note
}

// Frequencies (Hz)
const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, Db4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Gb4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50
};

// 10 Distinct Themes
const THEMES: ThemePreset[] = [
  { 
    name: "空山 (Empty Mountain)", 
    type: 'bell', 
    scale: [NOTES.C3, NOTES.G3, NOTES.C4, NOTES.D4, NOTES.E4, NOTES.G4], 
    decay: 4.0, delayTime: 0.6, feedback: 0.4, probability: 0.8 
  },
  { 
    name: "夜雨 (Night Rain)", 
    type: 'pluck', 
    scale: [NOTES.C4, NOTES.Eb4, NOTES.F4, NOTES.G4, NOTES.Bb4, NOTES.C5], // C Minor Pentatonic
    decay: 0.8, delayTime: 0.25, feedback: 0.2, probability: 0.9 
  },
  { 
    name: "竹林 (Bamboo Forest)", 
    type: 'wood', 
    scale: [NOTES.E3, NOTES.G3, NOTES.A3, NOTES.B3, NOTES.D4, NOTES.E4], 
    filterFreq: 800, decay: 1.2, delayTime: 0.4, feedback: 0.3, probability: 0.7 
  },
  { 
    name: "流水 (Flowing Water)", 
    type: 'piano', 
    scale: [NOTES.G4, NOTES.A4, NOTES.C5, NOTES.D5, NOTES.E5, NOTES.G5], // High Pentatonic
    decay: 2.0, delayTime: 0.3, feedback: 0.5, probability: 0.9 
  },
  { 
    name: "晨鐘 (Morning Bell)", 
    type: 'bell', 
    scale: [NOTES.C3, NOTES.G3, NOTES.C4], // Sparse
    decay: 6.0, delayTime: 1.0, feedback: 0.6, probability: 0.4 
  },
  { 
    name: "雲遊 (Cloud Wandering)", 
    type: 'pad', 
    scale: [NOTES.C4, NOTES.D4, NOTES.E4, NOTES.Gb4, NOTES.G4, NOTES.A4, NOTES.B4], // Lydianish
    decay: 5.0, delayTime: 0.8, feedback: 0.7, probability: 0.5 
  },
  { 
    name: "古寺 (Ancient Temple)", 
    type: 'wood', 
    scale: [NOTES.C3, NOTES.Db4, NOTES.F4, NOTES.G4, NOTES.Bb4], // Miyako-bushi (Japanese)
    decay: 2.5, delayTime: 0.5, feedback: 0.4, probability: 0.6 
  },
  { 
    name: "清風 (Clear Breeze)", 
    type: 'piano', 
    scale: [NOTES.F3, NOTES.G3, NOTES.A3, NOTES.C4, NOTES.D4, NOTES.F4], 
    decay: 3.5, delayTime: 0.5, feedback: 0.3, probability: 0.7 
  },
  { 
    name: "映月 (Moon Reflection)", 
    type: 'bell', 
    scale: [NOTES.E4, NOTES.G4, NOTES.A4, NOTES.B4, NOTES.D5, NOTES.E5], 
    decay: 3.0, delayTime: 0.7, feedback: 0.5, probability: 0.6 
  },
  { 
    name: "归途 (The Return)", 
    type: 'pad', 
    scale: [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.B3, NOTES.C4], 
    decay: 4.5, delayTime: 0.5, feedback: 0.4, probability: 0.5 
  }
];

class ZenAudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  delayNode: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  intervalId: any = null;
  currentTheme: ThemePreset = THEMES[0];

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  setTheme(themeIndex: number) {
    this.currentTheme = THEMES[themeIndex % THEMES.length];
    // Update Delay effects in real-time
    if (this.delayNode && this.delayFeedback && this.ctx) {
      this.delayNode.delayTime.linearRampToValueAtTime(this.currentTheme.delayTime, this.ctx.currentTime + 1);
      this.delayFeedback.gain.linearRampToValueAtTime(this.currentTheme.feedback, this.ctx.currentTime + 1);
    }
  }

  start() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Setup Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 3);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 12;

    this.delayNode = this.ctx.createDelay(5.0);
    this.delayNode.delayTime.value = this.currentTheme.delayTime;
    
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = this.currentTheme.feedback;

    // Routing: Master -> Compressor -> Destination
    //          Master -> Delay -> Feedback -> Delay -> Compressor
    
    this.masterGain.connect(this.compressor);
    this.masterGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.scheduleNextNote();
  }

  playNote() {
    if (!this.ctx || !this.masterGain) return;
    
    const theme = this.currentTheme;

    // Skip playing based on probability (creates silence/space)
    if (Math.random() > theme.probability) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    
    // Pick frequency
    const freq = theme.scale[Math.floor(Math.random() * theme.scale.length)];
    osc.frequency.value = freq;

    // Timbre Synthesis
    if (theme.type === 'bell') {
      // FM Synthesis for bells
      osc.type = 'sine';
      // Modulator for metallic overtone
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      mod.frequency.value = freq * 2.5; // Non-integer ratio for metallic sound
      modGain.gain.setValueAtTime(freq * 0.5, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + theme.decay);
      mod.connect(modGain);
      modGain.connect(osc.frequency);
      mod.start(now);
      mod.stop(now + theme.decay);
    } else if (theme.type === 'wood') {
      osc.type = 'triangle';
      // Lowpass filter for "woody" thud
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(theme.filterFreq || 400, now);
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gain);
    } else if (theme.type === 'pad') {
      osc.type = 'triangle';
    } else {
      osc.type = 'sine'; // piano/pluck default
    }

    // Envelope
    gain.gain.setValueAtTime(0, now);
    
    if (theme.type === 'pad') {
      gain.gain.linearRampToValueAtTime(0.1, now + 2); // Slow attack
      gain.gain.linearRampToValueAtTime(0, now + theme.decay);
    } else {
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02); // Fast attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + theme.decay);
    }

    // Connect logic handled inside timbre block for wood, else here
    if (theme.type !== 'wood') {
      osc.connect(gain);
    }
    
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + theme.decay + 1);
  }

  scheduleNextNote() {
    this.playNote();
    // Timing variation
    const gap = this.currentTheme.type === 'pad' ? 4000 : 2000;
    const nextTime = Math.random() * gap + 1000;
    this.intervalId = setTimeout(() => this.scheduleNextNote(), nextTime);
  }

  stop() {
    if (this.intervalId) clearTimeout(this.intervalId);
    if (!this.ctx || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 3); // Slow fade out
  }
}

// --- COMPONENTS ---

const App = () => {
  const [view, setView] = useState<'HOME' | 'SESSION' | 'DONE'>('HOME');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [quote, setQuote] = useState("");
  const [themeName, setThemeName] = useState("");
  const audioRef = useRef<ZenAudioEngine | null>(null);

  const startSession = (minutes: number) => {
    // 1. Pick Random Quote
    const randomQuote = ZEN_QUOTES[Math.floor(Math.random() * ZEN_QUOTES.length)];
    setQuote(randomQuote);

    // 2. Pick Random Theme
    const randomThemeIndex = Math.floor(Math.random() * THEMES.length);
    setThemeName(THEMES[randomThemeIndex].name);

    // 3. Setup Timer
    setTimeLeft(minutes * 60);
    setTotalTime(minutes * 60);
    setView('SESSION');

    // 4. Start Audio
    if (!audioRef.current) audioRef.current = new ZenAudioEngine();
    audioRef.current.setTheme(randomThemeIndex);
    audioRef.current.start();
  };

  const endSession = () => {
    setView('DONE');
    if (audioRef.current) audioRef.current.stop();
  };

  const reset = () => {
    setView('HOME');
  };

  useEffect(() => {
    let interval: any;
    if (view === 'SESSION' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center select-none">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 -z-10 bg-[#0e0e0e]">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-paper.png')] mix-blend-overlay"></div>
        {view === 'SESSION' && (
          <>
             {/* Subtle colored glow based on theme? Keeping it neutral gold/grey for Zen */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-stone-800/20 rounded-full blur-[120px] animate-breathe"></div>
          </>
        )}
      </div>

      {view === 'HOME' && (
        <div className="flex flex-col items-center animate-fade-in space-y-12">
           <div className="space-y-4 text-center">
              <div className="h-16 w-[1px] bg-stone-700 mx-auto mb-6"></div>
              <h1 className="text-6xl font-light tracking-[0.2em] text-stone-100 ml-4">靜 心</h1>
              <p className="text-stone-500 text-sm tracking-[0.4em] uppercase">Zen Space</p>
           </div>

           <div className="flex flex-col gap-6">
             {[3, 5].map(min => (
               <button 
                key={min}
                onClick={() => startSession(min)}
                className="group relative w-64 h-14 overflow-hidden rounded-full border border-stone-800 bg-stone-900/50 hover:bg-stone-800 hover:border-stone-600 transition-all duration-500 ease-out"
               >
                 <span className="absolute inset-0 flex items-center justify-center text-stone-300 font-light tracking-widest text-lg group-hover:tracking-[0.3em] transition-all duration-500">
                    {min === 3 ? '三 分 鐘' : '五 分 鐘'}
                 </span>
               </button>
             ))}
           </div>
        </div>
      )}

      {view === 'SESSION' && (
        <div className="w-full h-screen flex flex-col items-center justify-between py-16 animate-fade-in relative">
          
          {/* Top Info */}
          <div className="text-center opacity-60">
             <div className="text-xs tracking-[0.3em] text-stone-500 mb-2">正在播放</div>
             <div className="text-sm tracking-widest text-stone-300 font-light">{themeName}</div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl px-8">
             {/* Vertical Text Layout for Poetry */}
             <div className="writing-vertical-rl text-4xl md:text-5xl leading-loose tracking-widest text-stone-200 font-light h-[400px] flex flex-wrap justify-center gap-8 md:gap-16 drop-shadow-2xl opacity-90">
                {quote.split("，").map((line, i) => (
                   <span key={i} className={`animate-fade-in`} style={{ animationDelay: `${i * 0.5}s` }}>
                     {line}
                   </span>
                ))}
             </div>
          </div>

          {/* Timer Progress */}
          <div className="w-full max-w-xs flex flex-col items-center gap-4 mb-8">
             <div className="text-stone-500 font-mono text-xs tracking-widest">{formatTime(timeLeft)}</div>
             <div className="w-full h-[1px] bg-stone-800 overflow-hidden">
                <div 
                  className="h-full bg-stone-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / totalTime) * 100}%` }}
                ></div>
             </div>
          </div>

          <button 
            onClick={() => {
              if (audioRef.current) audioRef.current.stop();
              reset();
            }}
            className="text-xs text-stone-600 hover:text-stone-400 tracking-[0.2em] transition-colors"
          >
            停止 · STOP
          </button>
        </div>
      )}

      {view === 'DONE' && (
        <div className="flex flex-col items-center animate-fade-in space-y-8">
           <div className="w-32 h-32 rounded-full border border-stone-800 flex items-center justify-center bg-stone-900/30">
              <span className="text-4xl text-stone-200 font-light">完</span>
           </div>
           <p className="text-stone-500 tracking-widest">心 無 罣 礙</p>
           
           <button 
             onClick={reset}
             className="mt-8 px-8 py-2 border-b border-stone-800 hover:border-stone-500 text-stone-400 hover:text-stone-200 transition-all tracking-widest text-sm"
           >
             返 回
           </button>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
