import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:10000";

type Settings = Record<string, { questionCount: number; marks: number; timeMinutes: number }>;

type AdminCategory = {
  id: string;
  name: string;
  isActive: boolean;
  questionCount: number;
};

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

export default function Admin() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [selectedPerformance, setSelectedPerformance] = useState<any | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminTab, setAdminTab] = useState<"questions" | "categories" | "leaderboard" | "settings">("questions");
  const [adminRound, setAdminRound] = useState("1");
  const [adminCategory, setAdminCategory] = useState("Python");
  const [adminQuestions, setAdminQuestions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    api("/api/settings")
      .then((s) => Object.keys(s).length && setSettings(s))
      .catch(() => {});

    loadPublicCategories();
  }, []);

  useEffect(() => {
    if (adminAuthed) loadAdminQuestions().catch(() => {});
  }, [adminRound, adminCategory, adminAuthed]);

  async function loadPublicCategories() {
    try {
      const raw = await api("/api/categories");
      const names = normalizeCategories(raw);
      setCategories(names);

      if (!adminCategory && names.length) setAdminCategory(names[0]);
      if (adminCategory && !names.includes(adminCategory) && names.length) setAdminCategory(names[0]);
    } catch {
      setCategories(defaultCategories);
    }
  }

  async function loadAdminCategories() {
    const raw = await api("/api/admin/categories", {
      headers: { "x-admin-password": adminPassword },
    });

    const normalized = Array.isArray(raw)
      ? raw
          .map((item: any) => ({
            id: String(item.id),
            name: String(item.name || ""),
            isActive: Boolean(item.isActive ?? item.is_active ?? true),
            questionCount: Number(item.questionCount ?? item.question_count ?? 0),
          }))
          .filter((item: AdminCategory) => item.id && item.name)
      : [];

    setAdminCategories(normalized);
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return alert("Enter a category name.");

    await api("/api/admin/categories", {
      method: "POST",
      headers: { "x-admin-password": adminPassword },
      body: JSON.stringify({ name }),
    });

    setNewCategoryName("");
    await loadAdminCategories();
    await loadPublicCategories();
  }

  async function renameCategory(category: AdminCategory) {
    const name = category.name.trim();
    if (!name) return alert("Category name cannot be empty.");

    await api(`/api/admin/categories/${category.id}`, {
      method: "PUT",
      headers: { "x-admin-password": adminPassword },
      body: JSON.stringify({ name }),
    });

    await loadAdminCategories();
    await loadPublicCategories();

    if (adminRound === "2") {
      setAdminCategory(name);
      await loadAdminQuestions();
    }
  }

  async function deleteCategory(category: AdminCategory) {
    const confirmed = window.confirm(
      `Hide "${category.name}" from Round 2 category selection? This will not delete its existing questions.`
    );
    if (!confirmed) return;

    await api(`/api/admin/categories/${category.id}`, {
      method: "DELETE",
      headers: { "x-admin-password": adminPassword },
    });

    await loadAdminCategories();
    await loadPublicCategories();

    if (adminCategory === category.name) {
      const remaining = categories.filter((name) => name !== category.name);
      setAdminCategory(remaining[0] || "Python");
    }
  }

  async function loadAdminQuestions() {
    const params = new URLSearchParams({ round: adminRound });
    if (adminRound === "2") params.set("category", adminCategory);

    const qs = await api(`/api/admin/questions?${params.toString()}`, {
      headers: { "x-admin-password": adminPassword },
    });

    setAdminQuestions(qs);
  }

  async function loadLeaderboard() {
    const lb = await api("/api/admin/leaderboard", {
      headers: { "x-admin-password": adminPassword },
    });

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
      const lb = await api("/api/admin/leaderboard", {
        headers: { "x-admin-password": adminPassword },
      });

      setLeaderboard(lb);
      setAdminAuthed(true);
      await loadPublicCategories();
      await loadAdminCategories();
      await loadAdminQuestions();
    } catch {
      alert("Wrong admin password.");
    }
  }

  async function addAdminQuestion() {
    const payload = {
      round: Number(adminRound),
      category:
        adminRound === "1"
          ? "General"
          : adminRound === "2"
          ? adminCategory
          : adminRound === "3"
          ? "Microsoft Office"
          : "Club",
      questionType: "multiple",
      questionText: "New question",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
      marks: 1,
    };

    await api("/api/admin/questions", {
      method: "POST",
      headers: { "x-admin-password": adminPassword },
      body: JSON.stringify(payload),
    });

    await loadAdminQuestions();
    await loadAdminCategories();
    await loadPublicCategories();
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
    await loadAdminCategories();
    await loadPublicCategories();
  }

  async function deleteQuestion(id: string) {
    await api(`/api/admin/questions/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": adminPassword },
    });

    await loadAdminQuestions();
    await loadAdminCategories();
  }

  async function saveSettings() {
    await api("/api/admin/settings", {
      method: "PUT",
      headers: { "x-admin-password": adminPassword },
      body: JSON.stringify({ roundConfig: settings }),
    });

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

  return (
    <div className="app-shell">
      <div className="bg-glow one" />
      <div className="bg-glow two" />

      <nav className="topbar">
        <div className="logo">
          MCRC<span>VETTING</span>
        </div>
        <button className="ghost-btn" onClick={() => (window.location.href = "/")}>Candidate Portal</button>
      </nav>

      {!adminAuthed ? (
        <section className="login-card">
          <h1>Admin Dashboard</h1>
          <p>Manage questions, categories, timers, scores and leaderboard data from PostgreSQL.</p>
          <input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adminLogin()}
          />
          <button className="primary-btn" onClick={adminLogin}>Open Admin</button>
        </section>
      ) : (
        <main className="admin-wrap">
          <div className="tabs">
            <button className={adminTab === "questions" ? "active" : ""} onClick={() => setAdminTab("questions")}>
              Questions
            </button>
            <button className={adminTab === "categories" ? "active" : ""} onClick={() => setAdminTab("categories")}>
              Categories
            </button>
            <button className={adminTab === "leaderboard" ? "active" : ""} onClick={() => setAdminTab("leaderboard")}>
              Leaderboard
            </button>
            <button className={adminTab === "settings" ? "active" : ""} onClick={() => setAdminTab("settings")}>
              Settings
            </button>
          </div>

          {adminTab === "questions" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Questions</h2>
                  <p>Edit the questions stored in the backend database.</p>
                </div>
                <button className="primary-btn small" onClick={addAdminQuestion}>Add Question</button>
              </div>

              <div className="filters">
                <select value={adminRound} onChange={(e) => setAdminRound(e.target.value)}>
                  <option value="1">Round 1</option>
                  <option value="2">Round 2</option>
                  <option value="3">Round 3</option>
                  <option value="4">Round 4</option>
                </select>

                {adminRound === "2" && (
                  <select value={adminCategory} onChange={(e) => setAdminCategory(e.target.value)}>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                )}

                <button className="ghost-btn" onClick={loadAdminQuestions}>Load</button>
              </div>

              <div className="question-list">
                {adminQuestions.map((q, idx) => {
                  const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options || [];

                  return (
                    <div className="editor-card" key={q.id}>
                      <div className="editor-top">
                        <strong>Question {idx + 1}</strong>
                        <div>
                          <select
                            value={q.question_type}
                            onChange={(e) =>
                              setAdminQuestions((arr) =>
                                arr.map((x) => (x.id === q.id ? { ...x, question_type: e.target.value } : x))
                              )
                            }
                          >
                            <option value="multiple">Multiple Choice</option>
                            <option value="short">Short Answer</option>
                          </select>
                          <button className="danger-btn" onClick={() => deleteQuestion(q.id)}>Delete</button>
                        </div>
                      </div>

                      <textarea
                        value={q.question_text}
                        onChange={(e) =>
                          setAdminQuestions((arr) =>
                            arr.map((x) => (x.id === q.id ? { ...x, question_text: e.target.value } : x))
                          )
                        }
                      />

                      {q.question_type === "multiple" && (
                        <div className="option-grid">
                          {options.map((opt: string, i: number) => (
                            <input
                              key={i}
                              value={opt}
                              onChange={(e) => {
                                const next = [...options];
                                next[i] = e.target.value;
                                setAdminQuestions((arr) =>
                                  arr.map((x) => (x.id === q.id ? { ...x, options: next } : x))
                                );
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <div className="option-grid">
                        <input
                          value={q.correct_answer}
                          placeholder="Correct answer"
                          onChange={(e) =>
                            setAdminQuestions((arr) =>
                              arr.map((x) => (x.id === q.id ? { ...x, correct_answer: e.target.value } : x))
                            )
                          }
                        />
                        <input
                          type="number"
                          value={q.marks}
                          onChange={(e) =>
                            setAdminQuestions((arr) =>
                              arr.map((x) => (x.id === q.id ? { ...x, marks: Number(e.target.value) } : x))
                            )
                          }
                        />
                      </div>

                      <button className="primary-btn small" onClick={() => saveQuestion(q)}>Save Question</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {adminTab === "categories" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Round 2 Categories</h2>
                  <p>Add, rename, or hide category options shown to candidates in Round 2.</p>
                </div>
                <button className="ghost-btn" onClick={loadAdminCategories}>Refresh</button>
              </div>

              <div className="category-manager">
                <div className="category-add-row">
                  <input
                    value={newCategoryName}
                    placeholder="New category name, e.g. Networking"
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <button className="primary-btn small" onClick={addCategory}>Add Category</button>
                </div>

                <div className="category-list">
                  {adminCategories.length === 0 ? (
                    <div className="editor-card">
                      <strong>No categories loaded.</strong>
                      <p className="muted-note">Click Refresh. If it is still empty, check that your backend /api/admin/categories route is deployed.</p>
                    </div>
                  ) : (
                    adminCategories.map((category) => (
                      <div className="category-edit-card" key={category.id}>
                        <div>
                          <label>Category Name</label>
                          <input
                            value={category.name}
                            onChange={(e) =>
                              setAdminCategories((arr) =>
                                arr.map((item) => (item.id === category.id ? { ...item, name: e.target.value } : item))
                              )
                            }
                          />
                          <small>{category.questionCount} active Round 2 question(s)</small>
                        </div>

                        <div className="category-actions">
                          <button className="primary-btn small" onClick={() => renameCategory(category)}>Save Name</button>
                          <button className="danger-btn" onClick={() => deleteCategory(category)}>Hide</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                    <tr>
                      <th>Rank</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
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
              <div className="panel-head">
                <h2>Round Settings</h2>
                <button className="primary-btn small" onClick={saveSettings}>Save Settings</button>
              </div>

              <div className="settings-grid">
                {[1, 2, 3, 4].map((round) => (
                  <div className="setting-card" key={round}>
                    <h3>Round {round}</h3>
                    <label>Question Count</label>
                    <input
                      type="number"
                      value={settings[String(round)]?.questionCount || 0}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [String(round)]: { ...s[String(round)], questionCount: Number(e.target.value) },
                        }))
                      }
                    />
                    <label>Marks</label>
                    <input
                      type="number"
                      value={settings[String(round)]?.marks || 0}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [String(round)]: { ...s[String(round)], marks: Number(e.target.value) },
                        }))
                      }
                    />
                    <label>Time in Minutes</label>
                    <input
                      type="number"
                      value={settings[String(round)]?.timeMinutes || 0}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [String(round)]: { ...s[String(round)], timeMinutes: Number(e.target.value) },
                        }))
                      }
                    />
                  </div>
                ))}
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
                <p>Total Score: {selectedPerformance.candidate.totalScore}/{selectedPerformance.candidate.totalPossible}</p>
              </div>
              <button className="ghost-btn" onClick={() => setSelectedPerformance(null)}>Close</button>
            </div>

            <div className="round-score-summary">
              {[1, 2, 3, 4].map((round) => {
                const answers = selectedPerformance.answers.filter((a: any) => Number(a.round) === round);
                const score = answers.reduce((sum: number, a: any) => sum + Number(a.score || 0), 0);
                const marks = answers.reduce((sum: number, a: any) => sum + Number(a.marks || 0), 0);
                return (
                  <div key={round}>
                    <span>Round {round}</span>
                    <strong>{score}/{marks}</strong>
                  </div>
                );
              })}
            </div>

            <div className="performance-list">
              {selectedPerformance.answers.map((item: any, index: number) => (
                <article className="performance-card" key={`${item.questionId}-${index}`}>
                  <div className="performance-card-top">
                    <span>Round {item.round} • {item.category} • {item.questionType}</span>
                    <strong className={item.isCorrect ? "correct-pill" : "wrong-pill"}>
                      {item.isSkipped ? "Skipped" : item.isCorrect ? "Correct" : "Wrong"} • {item.score}/{item.marks}
                    </strong>
                  </div>

                  <h3>{item.questionText}</h3>

                  <div className="answer-compare">
                    <div>
                      <small>Candidate Answer</small>
                      <p className={!item.answerText ? "muted-answer" : ""}>{item.answerText || "Skipped / No answer"}</p>
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
