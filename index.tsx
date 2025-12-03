
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Audio Engine (Generative Pentatonic Piano) ---
class PianoAmbience {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  delayNode: DelayNode | null = null;
  intervalId: any = null;

  // C Major Pentatonic Scale frequencies (C, D, E, G, A) spanning a few octaves
  // Selected for a "Zen" / Neutral feel
  notes = [
    130.81, 146.83, 164.81, 196.00, 220.00, // C3 - A3
    261.63, 293.66, 329.63, 392.00, 440.00, // C4 - A4
    523.25, 587.33                          // C5 - D5 (Spares)
  ];

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  start() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Signal Chain: Notes -> MasterGain -> Compressor -> Delay -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 3);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Simple Delay for "Echo/Space"
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.5; // 500ms echo
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.value = 0.3; // 30% feedback

    this.delayNode.connect(delayFeedback);
    delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.compressor); // Wet signal

    this.masterGain.connect(this.compressor); // Dry signal to compressor
    this.compressor.connect(this.ctx.destination);

    // Start playing notes procedurally
    this.scheduleNextNote();
  }

  playNote() {
    if (!this.ctx || !this.masterGain || !this.delayNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    
    // Pick a random note from the pentatonic scale
    const freq = this.notes[Math.floor(Math.random() * this.notes.length)];
    osc.frequency.value = freq;
    
    // Simple "Electric Piano" timbre (Sine wave)
    osc.type = 'sine';

    // Envelope (Attack and Decay)
    const now = this.ctx.currentTime;
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(0.2, now + 0.05); // Attack
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + 4); // Long Decay

    osc.connect(noteGain);
    noteGain.connect(this.masterGain); // Direct
    noteGain.connect(this.delayNode);  // To Delay

    osc.start(now);
    osc.stop(now + 4.5);
  }

  scheduleNextNote() {
    // Play a note now
    this.playNote();

    // Schedule next note at a random interval (between 1.5s and 4s) to feel organic
    const nextTime = Math.random() * 2500 + 1500;
    this.intervalId = setTimeout(() => {
      this.scheduleNextNote();
    }, nextTime);
  }

  stop() {
    if (this.intervalId) clearTimeout(this.intervalId);
    
    if (!this.ctx || !this.masterGain) return;
    
    // Fade out
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 2);

    setTimeout(() => {
      if(this.ctx?.state !== 'closed') {
        // Just stop scheduling, keep context alive or suspend if needed
      }
    }, 2000);
  }
}

// --- Components ---

const App = () => {
  const [view, setView] = useState<'HOME' | 'SESSION' | 'DONE'>('HOME');
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [affirmation, setAffirmation] = useState<string>("");
  const [loadingQuote, setLoadingQuote] = useState(false);

  const audioRef = useRef<PianoAmbience | null>(null);

  // Initialize Gemini for Chinese Poetry
  const fetchAffirmation = async () => {
    setLoadingQuote(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Generate a single, profound line of traditional Chinese wisdom or poetry (Zen/Taoist) about relaxation, nature, or emptiness. Provide ONLY the Chinese text. No English translation. Max 12 characters.",
      });
      setAffirmation(response.text.trim());
    } catch (e) {
      console.error(e);
      setAffirmation("心如止水，万事皆空"); // Fallback: "Mind like still water, all things are empty"
    } finally {
      setLoadingQuote(false);
    }
  };

  const startSession = async (minutes: number) => {
    setDurationMinutes(minutes);
    setTimeLeft(minutes * 60);
    setView('SESSION');
    
    // Initialize Audio
    if (!audioRef.current) audioRef.current = new PianoAmbience();
    audioRef.current.start();

    // Fetch new quote
    await fetchAffirmation();
  };

  const endSession = () => {
    setView('DONE');
    if (audioRef.current) audioRef.current.stop();
  };

  const reset = () => {
    setView('HOME');
    setAffirmation("");
  };

  // Timer Logic
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

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative z-10 font-[Noto Serif SC]">
      
      {/* Background Ambience (Ink Theme) */}
      <div className="absolute inset-0 -z-10 bg-[#0f1012] overflow-hidden">
         {/* Subtle Paper Texture Gradient */}
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1c23] via-[#0f1012] to-black opacity-90"></div>
         {view === 'SESSION' && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-700/5 rounded-full blur-[100px] animate-pulse duration-[8000ms]"></div>
         )}
      </div>

      {view === 'HOME' && (
        <div className="text-center animate-fade-in max-w-md w-full">
          {/* Vertical Text Logo for Zen feel */}
          <div className="mb-8 flex justify-center">
             <div className="border-l-2 border-slate-700 h-16 mx-auto mb-4"></div>
          </div>
          <h1 className="text-5xl md:text-6xl mb-4 text-slate-100 font-light tracking-wider">静 心</h1>
          <p className="text-slate-500 mb-12 text-lg tracking-widest uppercase text-xs">Zen Space</p>
          
          <div className="flex flex-col gap-6 items-center">
            <button 
              onClick={() => startSession(3)}
              className="group relative w-64 overflow-hidden rounded-full border border-slate-700/50 bg-slate-900/40 p-4 transition-all hover:bg-slate-800 hover:border-slate-500 hover:scale-[1.02]"
            >
               <span className="relative z-10 text-lg text-slate-300 font-light">三分钟 · 3 Min</span>
            </button>
            
            <button 
              onClick={() => startSession(5)}
              className="group relative w-64 overflow-hidden rounded-full border border-slate-700/50 bg-slate-900/40 p-4 transition-all hover:bg-slate-800 hover:border-slate-500 hover:scale-[1.02]"
            >
               <span className="relative z-10 text-lg text-slate-300 font-light">五分钟 · 5 Min</span>
            </button>
          </div>
        </div>
      )}

      {view === 'SESSION' && (
        <div className="flex flex-col items-center text-center animate-fade-in w-full h-full justify-between py-12">
          
          <div className="flex-1 flex flex-col items-center justify-center w-full">
             {/* Main Poetry Display */}
             <div className="min-h-[200px] flex items-center justify-center px-4 mb-12">
              {loadingQuote ? (
                <div className="flex space-x-2 opacity-50">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                </div>
              ) : (
                <div className="relative">
                  {/* Decorative quotes or lines */}
                  <div className="absolute -top-6 -left-4 text-4xl text-slate-700 opacity-20">❝</div>
                  <h2 className="text-4xl md:text-5xl lg:text-6xl text-slate-100 leading-snug tracking-wide font-light animate-float drop-shadow-lg">
                    {affirmation}
                  </h2>
                   <div className="absolute -bottom-6 -right-4 text-4xl text-slate-700 opacity-20">❞</div>
                </div>
              )}
            </div>

            {/* Subtle Timer */}
            <div className="relative mt-8">
              <div className="text-slate-600 text-sm tracking-[0.3em] font-mono">
                 {formatTime(timeLeft)}
              </div>
              <div className="w-full max-w-[200px] h-[1px] bg-slate-800 mt-2 mx-auto overflow-hidden">
                 <div 
                   className="h-full bg-slate-500/50 transition-all duration-1000 ease-linear"
                   style={{ width: `${(timeLeft / (durationMinutes * 60)) * 100}%` }}
                 ></div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              if(audioRef.current) audioRef.current.stop();
              reset();
            }}
            className="mt-auto text-xs text-slate-600 hover:text-slate-400 transition-colors tracking-widest border-b border-transparent hover:border-slate-600 pb-1"
          >
            停止 · STOP
          </button>
        </div>
      )}

      {view === 'DONE' && (
        <div className="text-center animate-fade-in flex flex-col items-center">
          <div className="mb-8 w-24 h-24 border border-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-300 text-3xl font-light">
            完
          </div>
          <p className="text-slate-400 mb-12 max-w-md mx-auto text-lg font-light tracking-wide">
             Session Complete
          </p>
          <button 
            onClick={reset}
            className="px-10 py-3 border border-slate-600 text-slate-300 rounded-full hover:bg-slate-800 hover:text-white transition-all duration-300"
          >
            返回 · Return
          </button>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
