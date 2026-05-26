import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:10000";

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
  const [mode, setMode] = useState<"candidate" | "admin">("candidate");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [categories, setCategories] = useState<string[]>(defaultCategories);

  const [selectedPerformance, setSelectedPerformance] = useState<any | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

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

  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminTab, setAdminTab] = useState<"questions" | "leaderboard" | "settings">("questions");
  const [adminRound, setAdminRound] = useState("1");
  const [adminCategory, setAdminCategory] = useState("Python");
  const [adminQuestions, setAdminQuestions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const currentQuestion = questions[questionIndex];
  const progress = questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0;
  const canGoBack = currentRound !== 1;
  const canSkip = currentRound === 1;

  useEffect(() => {
    api("/api/settings").then((s) => Object.keys(s).length && setSettings(s)).catch(() => { });
    api("/api/categories").then((c) => c.length && setCategories(c)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!roundActive || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [roundActive, timeLeft]);

  useEffect(() => {
    if (roundActive && timeLeft === 0) finishRound();
  }, [timeLeft, roundActive]);

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
      body: JSON.stringify({ questionId: currentQuestion.id, answerText: isSkipped ? "" : selectedAnswer, isSkipped }),
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

  async function loadAdminQuestions() {
    const params = new URLSearchParams({ round: adminRound });
    if (adminRound === "2") params.set("category", adminCategory);
    const qs = await api(`/api/admin/questions?${params.toString()}`, { headers: { "x-admin-password": adminPassword } });
    setAdminQuestions(qs);
  }

  async function loadLeaderboard() {
    const lb = await api("/api/admin/leaderboard", { headers: { "x-admin-password": adminPassword } });
    setLeaderboard(lb);
  }

  async function openCandidate(id: string) {
    try {
      setPerformanceLoading(true);
      const data = await api(`/api/admin/candidates/${id}/performance`, {
        headers: { "x-admin-password": adminPassword },
      });
      setSelectedPerformance(data);
    } catch (e: any) {
      alert(e.message || "Could not load candidate performance.");
    } finally {
      setPerformanceLoading(false);
    }
  }

  async function adminLogin() {
    try {
      const lb = await api("/api/admin/leaderboard", { headers: { "x-admin-password": adminPassword } });
      setLeaderboard(lb);
      setAdminAuthed(true);
      await loadAdminQuestions();
    } catch {
      alert("Wrong admin password.");
    }
  }

  async function addAdminQuestion() {
    const payload = {
      round: Number(adminRound),
      category: adminRound === "1" ? "General" : adminRound === "2" ? adminCategory : adminRound === "3" ? "Microsoft Office" : "Club",
      questionType: "multiple",
      questionText: "New question",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
      marks: 1,
    };
    await api("/api/admin/questions", { method: "POST", headers: { "x-admin-password": adminPassword }, body: JSON.stringify(payload) });
    await loadAdminQuestions();
  }

  async function saveQuestion(q: any) {
    await api(`/api/admin/questions/${q.id}`, {
      method: "PUT",
      headers: { "x-admin-password": adminPassword },
      body: JSON.stringify({
        round: q.round,
        category: q.category,
        questionType: q.question_type,
        questionText: q.question_text,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options || [],
        correctAnswer: q.correct_answer,
        marks: q.marks,
      }),
    });
    await loadAdminQuestions();
  }

  async function deleteQuestion(id: string) {
    await api(`/api/admin/questions/${id}`, { method: "DELETE", headers: { "x-admin-password": adminPassword } });
    await loadAdminQuestions();
  }

  async function saveSettings() {
    await api("/api/admin/settings", { method: "PUT", headers: { "x-admin-password": adminPassword }, body: JSON.stringify({ roundConfig: settings }) });
    alert("Settings saved.");
  }

  async function clearLeaderboard() {
    const confirmed = window.confirm(
      "Are you sure you want to clear the leaderboard? This will delete all candidates, scores, assigned questions, and submitted answers."
    );

    if (!confirmed) return;

    try {
      await api("/api/admin/leaderboard", {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      setLeaderboard([]);
      setSelectedPerformance(null);
      alert("Leaderboard cleared successfully.");
    } catch (e: any) {
      alert(e.message || "Could not clear leaderboard.");
    }
  }

  const roundTitle = useMemo(() => {
    if (currentRound === 1) return "Round 1: General IT Knowledge";
    if (currentRound === 2) return `Round 2: ${round2Category}`;
    if (currentRound === 3) return "Round 3: Microsoft Office";
    if (currentRound === 4) return "Round 4: Club Knowledge";
    return "MCRC Vetting";
  }, [currentRound, round2Category]);

  if (mode === "admin") {
    return (
      <div className="app-shell">
        <div className="bg-glow one" />
        <div className="bg-glow two" />
        <nav className="topbar">
          <div className="logo">MCRC<span>VETTING</span></div>
          <button className="ghost-btn" onClick={() => setMode("candidate")}>Candidate Portal</button>
        </nav>

        {!adminAuthed ? (
          <section className="login-card">
            <h1>Admin Dashboard</h1>
            <p>Manage questions, timers, scores and leaderboard data from PostgreSQL.</p>
            <input type="password" placeholder="Admin password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button className="primary-btn" onClick={adminLogin}>Open Admin</button>
          </section>
        ) : (
          <main className="admin-wrap">
            <div className="tabs">
              <button className={adminTab === "questions" ? "active" : ""} onClick={() => { setAdminTab("questions"); loadAdminQuestions(); }}>Questions</button>
              <button className={adminTab === "leaderboard" ? "active" : ""} onClick={() => { setAdminTab("leaderboard"); loadLeaderboard(); }}>Leaderboard</button>
              <button className={adminTab === "settings" ? "active" : ""} onClick={() => setAdminTab("settings")}>Settings</button>
            </div>

            {adminTab === "questions" && (
              <section className="panel">
                <div className="panel-head"><div><h2>Question Bank</h2><p>Questions are stored in the backend database.</p></div><button className="primary-btn small" onClick={addAdminQuestion}>Add Question</button></div>
                <div className="filters">
                  <select value={adminRound} onChange={(e) => setAdminRound(e.target.value)}>
                    <option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option><option value="4">Round 4</option>
                  </select>
                  {adminRound === "2" && <select value={adminCategory} onChange={(e) => setAdminCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select>}
                  <button className="ghost-btn" onClick={loadAdminQuestions}>Load</button>
                </div>
                <div className="question-list">
                  {adminQuestions.map((q, idx) => {
                    const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options || [];
                    return (
                      <div className="editor-card" key={q.id}>
                        <div className="editor-top">
                          <strong>Question {idx + 1}</strong>
                          <div><select value={q.question_type} onChange={(e) => setAdminQuestions((arr) => arr.map((x) => x.id === q.id ? { ...x, question_type: e.target.value } : x))}><option value="multiple">Multiple Choice</option><option value="short">Short Answer</option></select><button className="danger-btn" onClick={() => deleteQuestion(q.id)}>Delete</button></div>
                        </div>
                        <textarea value={q.question_text} onChange={(e) => setAdminQuestions((arr) => arr.map((x) => x.id === q.id ? { ...x, question_text: e.target.value } : x))} />
                        {q.question_type === "multiple" && <div className="option-grid">{options.map((opt: string, i: number) => <input key={i} value={opt} onChange={(e) => { const next = [...options]; next[i] = e.target.value; setAdminQuestions((arr) => arr.map((x) => x.id === q.id ? { ...x, options: next } : x)); }} />)}</div>}
                        <div className="option-grid"><input value={q.correct_answer} placeholder="Correct answer" onChange={(e) => setAdminQuestions((arr) => arr.map((x) => x.id === q.id ? { ...x, correct_answer: e.target.value } : x))} /><input type="number" value={q.marks} onChange={(e) => setAdminQuestions((arr) => arr.map((x) => x.id === q.id ? { ...x, marks: Number(e.target.value) } : x))} /></div>
                        <button className="primary-btn small" onClick={() => saveQuestion(q)}>Save Question</button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {adminTab === "leaderboard" && (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Leaderboard</h2>
                    <p>Click a candidate to view the questions, answers given, correct answers, and marks.</p>
                  </div>
                  <div className="panel-actions">
                    <button className="ghost-btn" onClick={loadLeaderboard}>Refresh</button>
                    <button className="danger-btn" onClick={clearLeaderboard}>Clear Leaderboard</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Rank</th><th>Name</th><th>Category</th><th>Score</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((c, i) => (
                        <tr key={c.id} onClick={() => openCandidate(c.id)}>
                          <td>{i + 1}</td>
                          <td>{c.fullName}</td>
                          <td>{c.round2Category}</td>
                          <td>{c.totalScore}/{c.totalPossible}</td>
                          <td>{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminTab === "settings" && (
              <section className="panel">
                <div className="panel-head"><h2>Round Settings</h2><button className="primary-btn small" onClick={saveSettings}>Save Settings</button></div>
                <div className="settings-grid">
                  {[1, 2, 3, 4].map((r) => <div className="setting-card" key={r}><h3>Round {r}</h3><label>Questions</label><input type="number" value={settings[String(r)].questionCount} onChange={(e) => setSettings((s) => ({ ...s, [r]: { ...s[String(r)], questionCount: Number(e.target.value) } }))} /><label>Marks</label><input type="number" value={settings[String(r)].marks} onChange={(e) => setSettings((s) => ({ ...s, [r]: { ...s[String(r)], marks: Number(e.target.value) } }))} /><label>Time in minutes</label><input type="number" value={settings[String(r)].timeMinutes} onChange={(e) => setSettings((s) => ({ ...s, [r]: { ...s[String(r)], timeMinutes: Number(e.target.value) } }))} /></div>)}
                </div>
              </section>
            )}
          </main>
        )}

        {selectedPerformance && (
          <div className="modal-backdrop" onClick={() => setSelectedPerformance(null)}>
            <section className="performance-modal" onClick={(e) => e.stopPropagation()}>
              <div className="performance-modal-head">
                <div>
                  <h2>{selectedPerformance.candidate.fullName}</h2>
                  <p>
                    Total Score: {selectedPerformance.candidate.totalScore}/{selectedPerformance.candidate.totalPossible}
                  </p>
                </div>
                <button className="ghost-btn" onClick={() => setSelectedPerformance(null)}>Close</button>
              </div>

              <div className="round-score-summary">
                {[1, 2, 3, 4].map((r) => {
                  const total = selectedPerformance.answers
                    .filter((a: any) => a.round === r)
                    .reduce((sum: number, a: any) => sum + Number(a.score || 0), 0);

                  return (
                    <div key={r}>
                      <span>Round {r}</span>
                      <strong>{total}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="performance-list">
                {selectedPerformance.answers.map((item: any, index: number) => (
                  <article key={`${item.questionId}-${index}`} className="performance-card">
                    <div className="performance-card-top">
                      <span>Round {item.round} • Question {index + 1}</span>
                      <strong className={item.isCorrect ? "correct-pill" : "wrong-pill"}>
                        {item.isCorrect ? "Correct" : item.isSkipped ? "Skipped" : "Wrong"} — {item.score}/{item.marks}
                      </strong>
                    </div>

                    <h3>{item.questionText}</h3>

                    <div className="answer-compare">
                      <div>
                        <small>Candidate Answer</small>
                        <p className={!item.answerText ? "muted-answer" : ""}>
                          {item.answerText || "Skipped / No answer"}
                        </p>
                      </div>
                      <div>
                        <small>Correct Answer</small>
                        <p>{item.correctAnswer || "No stored answer"}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {performanceLoading && (
          <div className="modal-backdrop">
            <div className="loading-modal">Loading candidate answers...</div>
          </div>
        )}
      </div>
    );
  }

  if (completed) return <div className="app-shell center"><section className="login-card"><h1>Vetting Submitted</h1><p>Thank you. Your score has been recorded privately.</p><button className="primary-btn" onClick={() => { setCompleted(false); setFullName(""); setRound2Category(""); }}>Start New Candidate</button></section></div>;

  if (roundActive && currentQuestion) {
    return (
      <div className="app-shell">
        <div className="quiz-head"><div><span>{roundTitle}</span><h1>Question {questionIndex + 1} of {questions.length}</h1></div><div className="timer">{formatTime(timeLeft)}</div></div>
        <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        <main className="question-stage">
          <section className="question-popup">
            <div className="question-meta"><span>{currentQuestion.questionType === "multiple" ? "Multiple Choice" : "Short Answer"}</span><span>{currentQuestion.marks} mark</span></div>
            <h2>{currentQuestion.questionText}</h2>
            {currentQuestion.questionType === "multiple" ? <div className="answers">{currentQuestion.options.map((opt, i) => <button key={opt} className={selectedAnswer === opt ? "selected" : ""} onClick={() => setSelectedAnswer(opt)}><span>{String.fromCharCode(65 + i)}</span>{opt}</button>)}</div> : <input className="short-answer" placeholder="Type one-word answer..." value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} />}
            <div className="question-actions">{canGoBack ? <button className="ghost-btn" onClick={previousQuestion}>Previous</button> : <span />}<div>{canSkip && <button className="ghost-btn" onClick={() => nextQuestion(true)}>Skip</button>}<button className="primary-btn small" onClick={() => nextQuestion(false)} disabled={!selectedAnswer.trim()}>Next</button></div></div>
          </section>
        </main>
      </div>
    );
  }

  if (currentRound > 0 && !roundActive) return <div className="app-shell center"><section className="login-card"><h1>Round {currentRound} Complete</h1><p>Your score is hidden. Continue when ready.</p><button className="primary-btn" onClick={continueAfterRound}>{currentRound < 4 ? `Start Round ${currentRound + 1}` : "Submit Vetting"}</button></section></div>;

  return (
    <div className="app-shell">
      <div className="bg-glow one" /><div className="bg-glow two" />
      <nav className="topbar"><div className="logo">MCRC<span>VETTING</span></div><button className="ghost-btn" onClick={() => setMode("admin")}>Admin</button></nav>
      <section className="hero">
        <p className="eyebrow">Executive Selection Portal</p><h1>MCRC VETTING</h1><p className="hero-copy">A 50-mark executive vetting system with backend storage, hidden scoring, timers, progress tracking, and an admin leaderboard.</p>
        <div className="start-card"><label>Full Name</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter candidate full name" /><label>Round 2 Category</label><select value={round2Category} onChange={(e) => setRound2Category(e.target.value)}><option value="">Select category</option>{categories.map((c) => <option key={c}>{c}</option>)}</select><button className="primary-btn" onClick={startCandidate} disabled={loading}>{loading ? "Starting..." : "Start Vetting"}</button></div>
        <div className="round-grid"><div><strong>Round 1</strong><span>25 questions • 25 minutes</span></div><div><strong>Round 2</strong><span>15 questions • 10 minutes</span></div><div><strong>Round 3</strong><span>5 questions • 5 minutes</span></div><div><strong>Round 4</strong><span>5 questions • 5 minutes</span></div></div>
      </section>
    </div>
  );
}