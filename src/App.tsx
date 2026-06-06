import { useEffect, useMemo, useState } from "react";
import Admin from "./Admin";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:10000";
const ADMIN_PATH = "/mcrc-admin-9x7k2p";

type Question = {
  id: string;
  round: number;
  category: string;
  questionType: "multiple" | "short";
  questionText: string;
  options: string[];
  marks: number;
  displayOrder: number;
};

type Settings = Record<string, { questionCount: number; marks: number; timeMinutes: number }>;

const defaultSettings: Settings = {
  "1": { questionCount: 25, marks: 25, timeMinutes: 25 },
  "2": { questionCount: 15, marks: 15, timeMinutes: 10 },
  "3": { questionCount: 5, marks: 5, timeMinutes: 5 },
  "4": { questionCount: 5, marks: 5, timeMinutes: 5 },
};

const defaultCategories = [
  "Python",
  "JavaScript",
  "Graphic Designing",
  "3D Modelling",
  "Cyber Security",
  "Robotics: Arduino & Mindstorm",
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function normalizeCategories(raw: any): string[] {
  if (!Array.isArray(raw)) return defaultCategories;

  const names = raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item.name === "string") return item.name;
      if (item && typeof item.category === "string") return item.category;
      return "";
    })
    .map((name) => name.trim())
    .filter(Boolean);

  return names.length ? names : defaultCategories;
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export default function App() {
  if (window.location.pathname === ADMIN_PATH) {
    return <Admin />;
  }

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [categories, setCategories] = useState<string[]>(defaultCategories);

  const [fullName, setFullName] = useState("");
  const [round2Category, setRound2Category] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [currentRound, setCurrentRound] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentQuestion = questions[questionIndex];
  const progress = questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0;
  const canGoBack = currentRound !== 1;
  const canSkip = currentRound === 1;

  useEffect(() => {
    api("/api/settings")
      .then((s) => Object.keys(s).length && setSettings(s))
      .catch(() => {});

    loadPublicCategories();
  }, []);

  useEffect(() => {
    if (!roundActive || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [roundActive, timeLeft]);

  useEffect(() => {
    if (roundActive && timeLeft === 0) finishRound();
  }, [timeLeft, roundActive]);

  async function loadPublicCategories() {
    try {
      const raw = await api("/api/categories");
      setCategories(normalizeCategories(raw));
    } catch {
      setCategories(defaultCategories);
    }
  }

  async function startCandidate() {
    if (!fullName.trim()) return alert("Enter your full name.");
    if (!round2Category) return alert("Select your Round 2 category.");

    setLoading(true);

    try {
      const result = await api("/api/candidates/start", {
        method: "POST",
        body: JSON.stringify({ fullName, round2Category }),
      });

      setCandidateId(result.candidateId);
      await startRound(1, result.candidateId);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startRound(round: number, id = candidateId) {
    setLoading(true);

    try {
      const qs = await api(`/api/candidates/${id}/questions/${round}`);
      setQuestions(qs);
      setCurrentRound(round);
      setQuestionIndex(0);
      setSelectedAnswer("");
      setTimeLeft((settings[String(round)]?.timeMinutes || 5) * 60);
      setRoundActive(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswer(isSkipped = false) {
    if (!currentQuestion) return;

    await api(`/api/candidates/${candidateId}/answers`, {
      method: "POST",
      body: JSON.stringify({
        questionId: currentQuestion.id,
        answerText: isSkipped ? "" : selectedAnswer,
        isSkipped,
      }),
    });
  }

  async function nextQuestion(isSkipped = false) {
    try {
      await saveAnswer(isSkipped);

      if (questionIndex < questions.length - 1) {
        setQuestionIndex((i) => i + 1);
        setSelectedAnswer("");
      } else {
        finishRound();
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  function previousQuestion() {
    if (!canGoBack) return;
    setQuestionIndex((i) => Math.max(0, i - 1));
    setSelectedAnswer("");
  }

  function finishRound() {
    setRoundActive(false);
    setSelectedAnswer("");
  }

  async function continueAfterRound() {
    if (currentRound < 4) {
      await startRound(currentRound + 1);
    } else {
      await api(`/api/candidates/${candidateId}/finish`, { method: "POST" });
      setCompleted(true);
      setCandidateId("");
      setQuestions([]);
      setCurrentRound(0);
    }
  }

  const roundTitle = useMemo(() => {
    if (currentRound === 1) return "Round 1: General IT Knowledge";
    if (currentRound === 2) return `Round 2: ${round2Category}`;
    if (currentRound === 3) return "Round 3: Microsoft Office";
    if (currentRound === 4) return "Round 4: Club Knowledge";
    return "MCRC Vetting";
  }, [currentRound, round2Category]);

  if (completed) {
    return (
      <div className="app-shell center">
        <section className="login-card">
          <h1>Vetting Submitted</h1>
          <p>Thank you. Your score has been recorded privately.</p>
          <button
            className="primary-btn"
            onClick={() => {
              setCompleted(false);
              setFullName("");
              setRound2Category("");
            }}
          >
            Start New Candidate
          </button>
        </section>
      </div>
    );
  }

  if (roundActive && currentQuestion) {
    return (
      <div className="app-shell">
        <div className="quiz-head">
          <div>
            <span>{roundTitle}</span>
            <h1>Question {questionIndex + 1} of {questions.length}</h1>
          </div>
          <div className="timer">{formatTime(timeLeft)}</div>
        </div>

        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>

        <main className="question-stage">
          <section className="question-popup">
            <div className="question-meta">
              <span>{currentQuestion.questionType === "multiple" ? "Multiple Choice" : "Short Answer"}</span>
              <span>{currentQuestion.marks} mark</span>
            </div>

            <h2>{currentQuestion.questionText}</h2>

            {currentQuestion.questionType === "multiple" ? (
              <div className="answers">
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={opt}
                    className={selectedAnswer === opt ? "selected" : ""}
                    onClick={() => setSelectedAnswer(opt)}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="short-answer"
                placeholder="Type one-word answer..."
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
              />
            )}

            <div className="question-actions">
              {canGoBack ? (
                <button className="ghost-btn" onClick={previousQuestion}>Previous</button>
              ) : (
                <span />
              )}

              <div>
                {canSkip && <button className="ghost-btn" onClick={() => nextQuestion(true)}>Skip</button>}
                <button className="primary-btn small" onClick={() => nextQuestion(false)} disabled={!selectedAnswer.trim()}>
                  Next
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (currentRound > 0 && !roundActive) {
    return (
      <div className="app-shell center">
        <section className="login-card">
          <h1>Round {currentRound} Complete</h1>
          <p>Your score is hidden. Continue when ready.</p>
          <button className="primary-btn" onClick={continueAfterRound}>
            {currentRound < 4 ? `Start Round ${currentRound + 1}` : "Submit Vetting"}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-glow one" />
      <div className="bg-glow two" />

      <nav className="topbar">
        <div className="logo">
          MCRC<span>VETTING</span>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">Executive Selection Portal</p>
        <h1>MCRC VETTING</h1>
        <p className="hero-copy">
          A 50-mark executive vetting system with backend storage, hidden scoring, timers, progress tracking, and a private admin leaderboard.
        </p>

        <div className="start-card">
          <label>Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter candidate full name" />

          <label>Round 2 Category</label>
          <select value={round2Category} onChange={(e) => setRound2Category(e.target.value)}>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <button className="primary-btn" onClick={startCandidate} disabled={loading}>
            {loading ? "Starting..." : "Start Vetting"}
          </button>
        </div>

        <div className="round-grid">
          <div>
            <strong>Round 1</strong>
            <span>25 questions • 25 minutes</span>
          </div>
          <div>
            <strong>Round 2</strong>
            <span>15 questions • 10 minutes</span>
          </div>
          <div>
            <strong>Round 3</strong>
            <span>5 questions • 5 minutes</span>
          </div>
          <div>
            <strong>Round 4</strong>
            <span>5 questions • 5 minutes</span>
          </div>
        </div>
      </section>
    </div>
  );
}
