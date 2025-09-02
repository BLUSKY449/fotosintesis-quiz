import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ==============================
   Game: Fotosintesis – Kuis Gameshow (web)
   - 5 soal (sesuai permintaan terakhir)
   - Timer stabil + suara (tick 5 detik terakhir), klik/benar/salah
   - Tanpa label “Penjelasan:” dan tanpa kartu hasil akhir
   ============================== */

/* ---------- Tipe Soal ---------- */
type Question = {
  id: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

/* ---------- Soal (5) ---------- */
const QUESTIONS: Question[] = [
  {
    id: 1,
    prompt: "Tumbuhan hijau membuat makanan sendiri dengan bantuan apa?",
    choices: ["Bulan", "Matahari", "Bintang"],
    correctIndex: 1,
    explanation: "Energi cahaya Matahari digunakan sebagai sumber energi untuk proses fotosintesis.",
  },
  {
    id: 2,
    prompt: "Proses membuat makanan pada tumbuhan hijau disebut apa?",
    choices: ["Fotosintesis", "Respirasi", "Fermentasi"],
    correctIndex: 0,
    explanation: "Fotosintesis adalah proses pembentukan glukosa oleh tumbuhan dengan bantuan cahaya, CO₂, dan air.",
  },
  {
    id: 3,
    prompt: "Apa yang dibutuhkan tumbuhan untuk melakukan fotosintesis selain air dan cahaya matahari?",
    choices: ["Karbon dioksida", "Oksigen", "Angin"],
    correctIndex: 0,
    explanation: "Karbon dioksida (CO₂) dari udara diserap melalui stomata untuk membentuk glukosa.",
  },
  {
    id: 4,
    prompt: "Dari bagian tumbuhan mana air diambil untuk fotosintesis?",
    choices: ["Daun", "Batang", "Akar"],
    correctIndex: 2,
    explanation: "Air diserap oleh akar dari tanah lalu diangkut ke daun melalui xilem.",
  },
  {
    id: 5,
    prompt: "Gas apa yang dikeluarkan tumbuhan saat fotosintesis?",
    choices: ["Oksigen", "Karbon dioksida", "Nitrogen"],
    correctIndex: 0,
    explanation: "Oksigen (O₂) dilepaskan sebagai hasil samping fotosintesis melalui stomata.",
  },
];

/* ---------- Konstanta ---------- */
const QUESTION_TIME = 20; // detik per soal

/* ==============================
   Audio Utilities (Web Audio API)
   ============================== */
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return ctxRef.current;
  };

  const playTone = useCallback(
    (freq: number, durationMs = 120, type: OscillatorType = "sine", gain = 0.05) => {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    },
    []
  );

  const click = useCallback(() => playTone(300, 80, "square", 0.04), [playTone]);
  const success = useCallback(() => {
    playTone(660, 120, "triangle", 0.05);
    setTimeout(() => playTone(880, 150, "triangle", 0.05), 120);
  }, [playTone]);
  const fail = useCallback(() => playTone(220, 180, "sawtooth", 0.05), [playTone]);
  const tick = useCallback(() => playTone(1000, 60, "square", 0.03), [playTone]);

  return { click, success, fail, tick };
}

/* ==============================
   Countdown Hook (1 effect, stabil)
   ============================== */
function useCountdown(params: {
  seconds: number;
  running: boolean;
  onElapsed: () => void;
  onTick?: (t: number) => void;
  restartSignal?: any; // ubah nilai untuk reset timer
}) {
  const { seconds, running, onElapsed, onTick, restartSignal } = params;
  const [timeLeft, setTimeLeft] = useState(seconds);
  const intervalRef = useRef<number | null>(null);
  const elapsedRef = useRef(onElapsed);
  const tickRef = useRef(onTick);

  // simpan callback terbaru tanpa reset interval
  useEffect(() => {
    elapsedRef.current = onElapsed;
  }, [onElapsed]);
  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    setTimeLeft(seconds);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!running) return;

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        tickRef.current?.(next);
        if (next <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          elapsedRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, restartSignal, seconds]);

  return timeLeft;
}

/* ---------- Util ---------- */
function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ==============================
   Komponen Utama
   ============================== */
export default function FotosintesisQuiz() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [shuffled, setShuffled] = useState<Question[]>([]);

  const total = QUESTIONS.length;
  const { click, success, fail, tick } = useAudio();

  // mulai permainan → acak soal & reset state
  useEffect(() => {
    if (!started) return;
    const q = [...QUESTIONS].sort(() => Math.random() - 0.5);
    setShuffled(q);
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setLocked(false);
    setShowExplain(false);
  }, [started]);

  const question = shuffled[current];

  // countdown per soal
  const timeLeft = useCountdown({
    seconds: QUESTION_TIME,
    running: started && !!question && !showExplain && !locked && selected === null,
    onElapsed: () => {
      setLocked(true);
      setShowExplain(true);
    },
    onTick: (t) => {
      if (t <= 5 && t >= 0) tick();
    },
    restartSignal: question?.id ?? -1,
  });

  const progress = useMemo(
    () => ((QUESTION_TIME - timeLeft) / QUESTION_TIME) * 100,
    [timeLeft]
  );

  function onSelectChoice(idx: number) {
    if (!question || selected !== null || locked) return;
    click();
    setSelected(idx);
    setLocked(true);
    const correct = idx === question.correctIndex;
    if (correct) {
      setScore((s) => s + 10);
      success();
    } else {
      fail();
    }
    setTimeout(() => setShowExplain(true), 300);
  }

  function nextQuestion() {
    if (current < total - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setLocked(false);
      setShowExplain(false);
    } else {
      /* selesai — tidak menampilkan kartu hasil akhir */
    }
  }

  function restart() {
    setStarted(false);
    setTimeout(() => setStarted(true), 30);
  }

  function Chip({ children }: { children: React.ReactNode }) {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
        {children}
      </span>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Fotosintesis — Kuis Gameshow</h1>
          <div className="flex items-center gap-2">
            <Chip>Soal: {started ? current + 1 : 0}/{total}</Chip>
          </div>
        </header>

        {!started && (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm text-slate-600">
              Mode permainan kuis dengan 5 soal. Kamu punya {QUESTION_TIME}s per soal.
            </p>
            <ul className="mb-6 list-disc pl-5 text-sm text-slate-700">
              <li>Timer 5 detik terakhir berbunyi.</li>
              <li>Suara klik saat memilih jawaban, dan jingle benar/salah.</li>
            </ul>
            <button
              onClick={() => setStarted(true)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Mulai Main
            </button>
          </div>
        )}

        {started && question && (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Sisa waktu</span>
                <span>{timeLeft}s</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <h2 className="mb-4 text-lg font-semibold leading-snug">{question.prompt}</h2>

            <div className="grid gap-3">
              {question.choices.map((c, idx) => {
                const isCorrect = idx === question.correctIndex;
                const isSelected = idx === selected;
                const showState = selected !== null || showExplain || locked;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectChoice(idx)}
                    disabled={locked && selected !== null}
                    className={classNames(
                      "w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2",
                      !showState && "hover:bg-slate-50",
                      showState && isCorrect && "border-emerald-500 bg-emerald-50",
                      showState && isSelected && !isCorrect && "border-rose-500 bg-rose-50"
                    )}
                    aria-pressed={isSelected}
                  >
                    <span className="block text-sm md:text-base">{c}</span>
                  </button>
                );
              })}
            </div>

            {showExplain && (
              <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                {/* label “Penjelasan:” dihapus — hanya konten */}
                <p className="mb-3">{question.explanation}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    {current < total - 1 ? (
                      <button
                        onClick={nextQuestion}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        Soal berikutnya →
                      </button>
                    ) : (
                      <button
                        onClick={() => setStarted(false)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        Selesai
                      </button>
                    )}
                    <button
                      onClick={restart}
                      className="rounded-xl border px-4 py-2 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      Mulai ulang
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-500">
          Dibuat untuk latihan materi Fotosintesis. © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
