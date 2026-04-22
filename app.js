const API_BASE = "./api";
const USER_ID = "default";

const state = {
  rawVocab: [],
  vocab: [],
  vocabIndex: 0,
  correct: 0,
  wrong: 0,
  currentQuestion: null,
  analysisList: [],
  analysisIndex: 0,
  translateList: [],
  translateIndex: 0,
  readingList: [],
  readingIndex: 0,
  wrongbook: { vocab: [], hardSentences: [] },
  saveTimer: null,
  nextQuestionTimer: null,
  activeTab: "home",
  meta: loadMeta(),
  holdTimer: null
};

const el = {
  loading: document.getElementById("loading-screen"),
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("theme-toggle"),
  studyStatus: document.getElementById("study-status"),
  navBtns: document.querySelectorAll(".nav-btn"),
  panels: document.querySelectorAll(".tab-panel"),
  homeWordCount: document.getElementById("home-word-count"),
  homeStreak: document.getElementById("home-streak"),
  statCompletion: document.getElementById("stat-completion"),
  statAccuracy: document.getElementById("stat-accuracy"),
  filterLevel: document.getElementById("filter-level"),
  filterGroup: document.getElementById("filter-group"),
  vocabCard: document.getElementById("vocab-card"),
  qWord: document.getElementById("q-word"),
  options: document.getElementById("options"),
  feedback: document.getElementById("q-feedback"),
  speakBtn: document.getElementById("speak-btn"),
  total: document.getElementById("v-total"),
  index: document.getElementById("v-index"),
  correct: document.getElementById("v-correct"),
  wrong: document.getElementById("v-wrong"),
  streak: document.getElementById("v-streak"),
  vocabProgressBar: document.getElementById("vocab-progress-bar"),
  vocabProgressText: document.getElementById("vocab-progress-text"),
  achievementList: document.getElementById("achievement-list"),
  analysisSentence: document.getElementById("analysis-sentence"),
  analysisStructure: document.getElementById("analysis-structure"),
  analysisSteps: document.getElementById("analysis-steps"),
  analysisCn: document.getElementById("analysis-cn"),
  analysisTranslationWrap: document.querySelector(".analysis-translation-wrap"),
  holdTranslate: document.getElementById("hold-translate"),
  nextAnalysis: document.getElementById("next-analysis"),
  trDirection: document.getElementById("tr-direction"),
  trPrompt: document.getElementById("tr-prompt"),
  trAnswer: document.getElementById("tr-answer"),
  trRef: document.getElementById("tr-ref"),
  nextTranslate: document.getElementById("next-translate"),
  checkTranslate: document.getElementById("check-translate"),
  markHard: document.getElementById("mark-hard"),
  readingTitle: document.getElementById("reading-title"),
  readingEn: document.getElementById("reading-en"),
  readingCn: document.getElementById("reading-cn"),
  readingWords: document.getElementById("reading-words"),
  nextReading: document.getElementById("next-reading"),
  wrongVocab: document.getElementById("wrong-vocab"),
  hardSentences: document.getElementById("hard-sentences"),
  clearWrongbook: document.getElementById("clear-wrongbook")
};

init().catch((err) => {
  console.error(err);
  showToast("初始化失败，请刷新页面", "error");
  hideLoading();
});

async function init() {
  applyThemeOnLoad();

  const [vocab, analysis, translate, reading, profile] = await Promise.all([
    fetchJSON("./data/cet4-vocab.json"),
    fetchJSON("./data/long-sentence-analysis.json"),
    fetchJSON("./data/translation-drills.json"),
    fetchJSON("./data/reading-passages.json"),
    fetchProfile()
  ]);

  state.rawVocab = vocab;
  state.analysisList = analysis;
  state.translateList = translate;
  state.readingList = reading;

  applyProfile(profile);
  refreshStreak();
  applyVocabFilter(false);

  bindEvents();
  renderAll();
  registerSW();
  hideLoading();
}

function bindEvents() {
  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el.themeToggle.addEventListener("click", toggleTheme);

  el.filterLevel.addEventListener("change", () => applyVocabFilter(true));
  el.filterGroup.addEventListener("change", () => applyVocabFilter(true));

  el.speakBtn.addEventListener("click", () => {
    if (!state.currentQuestion) return;
    speakWord(state.currentQuestion.word);
  });

  el.nextAnalysis.addEventListener("click", () => {
    state.analysisIndex = (state.analysisIndex + 1) % state.analysisList.length;
    renderAnalysis();
  });

  bindHoldTranslateEvents();

  el.nextTranslate.addEventListener("click", () => {
    state.translateIndex = (state.translateIndex + 1) % state.translateList.length;
    renderTranslation();
  });

  el.checkTranslate.addEventListener("click", () => {
    const item = state.translateList[state.translateIndex];
    const myAnswer = escapeHTML(el.trAnswer.value || "(未填写)");
    el.trRef.innerHTML = `你的答案：${myAnswer}<br>参考：${escapeHTML(item.reference)}`;
  });

  el.markHard.addEventListener("click", () => {
    const item = state.translateList[state.translateIndex];
    if (!state.wrongbook.hardSentences.includes(item.prompt)) {
      state.wrongbook.hardSentences.push(item.prompt);
      persistWrongbook();
      renderWrongbook();
      queueSaveProfile();
      showToast("已加入难句本", "success");
    }
  });

  el.nextReading.addEventListener("click", () => {
    state.readingIndex = (state.readingIndex + 1) % state.readingList.length;
    renderReading();
  });

  el.clearWrongbook.addEventListener("click", () => {
    state.wrongbook = { vocab: [], hardSentences: [] };
    persistWrongbook();
    renderWrongbook();
    queueSaveProfile();
    showToast("已清空错题与难句", "success");
  });

  document.addEventListener("keydown", handleKeyboardShortcut);
}

function switchTab(tab) {
  state.activeTab = tab;
  el.navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  el.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
}

function renderAll() {
  renderHome();
  renderVocabQuestion();
  renderAnalysis();
  renderTranslation();
  renderReading();
  renderWrongbook();
}

function renderHome() {
  el.homeWordCount.textContent = String(state.rawVocab.length);
  el.homeStreak.textContent = String(state.meta.streakDays || 0);

  const totalAnswered = state.correct + state.wrong;
  const completion = state.rawVocab.length ? Math.min(100, Math.round((totalAnswered / state.rawVocab.length) * 100)) : 0;
  const accuracy = totalAnswered ? Math.round((state.correct / totalAnswered) * 100) : 0;

  el.statCompletion.style.width = `${completion}%`;
  el.statAccuracy.style.width = `${accuracy}%`;
}

function applyVocabFilter(resetIndex) {
  const level = el.filterLevel.value;
  const group = el.filterGroup.value;

  state.vocab = state.rawVocab.filter((item) => matchLevel(item.word, level) && matchGroup(item.word, group));
  if (!state.vocab.length) {
    state.vocab = [...state.rawVocab];
  }

  if (resetIndex) {
    state.vocabIndex = 0;
    showToast("已切换词库筛选", "success");
  } else {
    state.vocabIndex = Math.min(state.vocabIndex, Math.max(0, state.vocab.length - 1));
  }

  renderVocabQuestion();
  renderHome();
}

function matchLevel(word, level) {
  if (level === "all") return true;
  const n = word.length;
  if (level === "easy") return n <= 6;
  if (level === "medium") return n >= 7 && n <= 9;
  return n >= 10;
}

function matchGroup(word, group) {
  if (group === "all") return true;
  const first = (word[0] || "A").toUpperCase();
  if (group === "A-E") return first >= "A" && first <= "E";
  if (group === "F-J") return first >= "F" && first <= "J";
  if (group === "K-O") return first >= "K" && first <= "O";
  if (group === "P-T") return first >= "P" && first <= "T";
  return first >= "U" && first <= "Z";
}

function renderVocabQuestion() {
  if (state.nextQuestionTimer) {
    clearTimeout(state.nextQuestionTimer);
    state.nextQuestionTimer = null;
  }

  const list = state.vocab;
  if (!list.length) return;

  const idx = state.vocabIndex % list.length;
  const question = list[idx];
  state.currentQuestion = question;

  const options = shuffle([question.correct, ...question.distractors]).slice(0, 4);

  el.qWord.textContent = question.word;
  el.options.innerHTML = "";
  el.feedback.textContent = "";

  options.forEach((option, i) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.dataset.value = option;
    button.dataset.idx = String(i + 1);
    button.textContent = `${i + 1}. ${option}`;
    button.addEventListener("click", () => handleSelect(option, button));
    el.options.appendChild(button);
  });

  el.total.textContent = String(list.length);
  el.index.textContent = String(idx + 1);
  el.correct.textContent = String(state.correct);
  el.wrong.textContent = String(state.wrong);
  el.streak.textContent = String(state.meta.streakDays || 0);

  const progress = list.length ? Math.round(((idx + 1) / list.length) * 100) : 0;
  el.vocabProgressBar.style.width = `${progress}%`;
  el.vocabProgressText.textContent = `${progress}%`;

  renderAchievements();
}

function renderAchievements() {
  const total = state.correct + state.wrong;
  const badges = [];
  if (state.correct >= 10) badges.push("🏅 正确 10+");
  if (state.correct >= 50) badges.push("🚀 正确 50+");
  if (total >= 100) badges.push("📚 累计答题 100+");
  if ((state.meta.streakDays || 0) >= 3) badges.push("🔥 连续打卡 3 天+");
  if (!badges.length) badges.push("🎯 开始第一轮训练");

  el.achievementList.innerHTML = badges.map((b) => `<li>${b}</li>`).join("");
}

function handleSelect(selected, button) {
  const question = state.currentQuestion;
  const buttons = [...el.options.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));

  if (selected === question.correct) {
    button.classList.add("correct");
    state.correct += 1;
    el.feedback.innerHTML = '<span class="ok">回答正确，正在进入下一题...</span>';
  } else {
    button.classList.add("wrong");
    const answerBtn = buttons.find((b) => b.dataset.value === question.correct);
    if (answerBtn) answerBtn.classList.add("correct");
    state.wrong += 1;
    el.feedback.innerHTML = `<span class="err">回答错误，正确答案：${escapeHTML(question.correct)}</span>`;
    addWrongVocab(question);
  }

  refreshStreak();
  renderHome();

  state.nextQuestionTimer = setTimeout(() => {
    state.vocabIndex = (state.vocabIndex + 1) % state.vocab.length;
    el.vocabCard.classList.add("flip");
    setTimeout(() => el.vocabCard.classList.remove("flip"), 260);
    renderVocabQuestion();
    queueSaveProfile();
  }, 720);
}

function addWrongVocab(question) {
  if (!state.wrongbook.vocab.some((i) => i.word === question.word)) {
    state.wrongbook.vocab.push({ word: question.word, answer: question.correct });
    persistWrongbook();
    renderWrongbook();
  }
}

function renderAnalysis() {
  const item = state.analysisList[state.analysisIndex % state.analysisList.length];
  el.analysisSentence.textContent = item.sentence;
  el.analysisStructure.textContent = item.structure;
  el.analysisCn.textContent = item.translation;
  hideAnalysisTranslation();

  el.analysisSteps.innerHTML = "";
  item.steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    el.analysisSteps.appendChild(li);
  });
}

function bindHoldTranslateEvents() {
  const start = () => {
    clearTimeout(state.holdTimer);
    state.holdTimer = setTimeout(showAnalysisTranslation, 280);
  };

  const end = () => {
    clearTimeout(state.holdTimer);
    hideAnalysisTranslation();
  };

  el.holdTranslate.addEventListener("mousedown", start);
  el.holdTranslate.addEventListener("touchstart", start, { passive: true });
  el.holdTranslate.addEventListener("mouseup", end);
  el.holdTranslate.addEventListener("mouseleave", end);
  el.holdTranslate.addEventListener("touchend", end);
  el.holdTranslate.addEventListener("touchcancel", end);
  window.addEventListener("mouseup", end);
  window.addEventListener("touchend", end);
}

function showAnalysisTranslation() {
  el.analysisTranslationWrap.classList.add("show-translation");
  el.holdTranslate.textContent = "已显示翻译";
}

function hideAnalysisTranslation() {
  el.analysisTranslationWrap.classList.remove("show-translation");
  el.holdTranslate.textContent = "长按显示翻译";
}

function renderTranslation() {
  const item = state.translateList[state.translateIndex % state.translateList.length];
  el.trDirection.textContent = item.direction;
  el.trPrompt.textContent = item.prompt;
  el.trAnswer.value = "";
  el.trRef.textContent = "";
}

function renderReading() {
  const item = state.readingList[state.readingIndex % state.readingList.length];
  el.readingTitle.textContent = item.title;
  el.readingEn.textContent = item.en;
  el.readingCn.textContent = item.cn;

  el.readingWords.innerHTML = "";
  item.vocab.forEach((v) => {
    const li = document.createElement("li");
    li.textContent = `${v.word}: ${v.meaning}`;
    el.readingWords.appendChild(li);
  });
}

function renderWrongbook() {
  el.wrongVocab.innerHTML = "";
  el.hardSentences.innerHTML = "";

  if (!state.wrongbook.vocab.length) {
    el.wrongVocab.innerHTML = "<li>暂无词汇错题</li>";
  } else {
    state.wrongbook.vocab.forEach((v) => {
      const li = document.createElement("li");
      li.textContent = `${v.word} -> ${v.answer}`;
      el.wrongVocab.appendChild(li);
    });
  }

  if (!state.wrongbook.hardSentences.length) {
    el.hardSentences.innerHTML = "<li>暂无难句收藏</li>";
  } else {
    state.wrongbook.hardSentences.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      el.hardSentences.appendChild(li);
    });
  }
}

function handleKeyboardShortcut(e) {
  if (state.activeTab !== "vocab") return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

  if (["1", "2", "3", "4"].includes(e.key)) {
    const btn = el.options.querySelector(`button[data-idx="${e.key}"]`);
    if (btn && !btn.disabled) btn.click();
  }

  if (e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (state.currentQuestion) speakWord(state.currentQuestion.word);
  }
}

function speakWord(word) {
  const utter = new SpeechSynthesisUtterance(word);
  utter.rate = 0.96;
  utter.pitch = 1;
  utter.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

async function fetchProfile() {
  try {
    const res = await fetch(`${API_BASE}/progress/${USER_ID}`);
    if (!res.ok) throw new Error("profile api failed");
    return await res.json();
  } catch {
    return loadProfileFromLocal();
  }
}

function applyProfile(profile) {
  if (!profile || typeof profile !== "object") return;
  state.vocabIndex = Number.isInteger(profile.vocabIndex) ? profile.vocabIndex : 0;
  state.correct = Number.isInteger(profile.correct) ? profile.correct : 0;
  state.wrong = Number.isInteger(profile.wrong) ? profile.wrong : 0;
  state.wrongbook = normalizeWrongbook(profile.wrongbook);
}

function normalizeWrongbook(input) {
  if (!input || typeof input !== "object") return { vocab: [], hardSentences: [] };

  const vocab = Array.isArray(input.vocab)
    ? input.vocab.filter((x) => x && typeof x.word === "string" && typeof x.answer === "string").map((x) => ({ word: x.word, answer: x.answer }))
    : [];

  const hardSentences = Array.isArray(input.hardSentences)
    ? input.hardSentences.filter((x) => typeof x === "string")
    : [];

  return { vocab, hardSentences };
}

function persistWrongbook() {
  queueSaveProfile();
}

function queueSaveProfile() {
  persistProfileToLocal();
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveProfile().catch(() => {
      el.studyStatus.textContent = "离线保存";
    });
  }, 300);
}

async function saveProfile() {
  const payload = {
    vocabIndex: state.vocabIndex,
    correct: state.correct,
    wrong: state.wrong,
    wrongbook: state.wrongbook
  };

  const res = await fetch(`${API_BASE}/progress/${USER_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("save failed");
  el.studyStatus.textContent = "云端同步";
}

function persistProfileToLocal() {
  const payload = {
    vocabIndex: state.vocabIndex,
    correct: state.correct,
    wrong: state.wrong,
    wrongbook: state.wrongbook
  };
  localStorage.setItem("cet4_profile", JSON.stringify(payload));
  localStorage.setItem("cet4_meta", JSON.stringify(state.meta));
}

function loadProfileFromLocal() {
  try {
    const raw = localStorage.getItem("cet4_profile");
    if (!raw) return { vocabIndex: 0, correct: 0, wrong: 0, wrongbook: { vocab: [], hardSentences: [] } };
    const parsed = JSON.parse(raw);
    return {
      vocabIndex: Number.isInteger(parsed.vocabIndex) ? parsed.vocabIndex : 0,
      correct: Number.isInteger(parsed.correct) ? parsed.correct : 0,
      wrong: Number.isInteger(parsed.wrong) ? parsed.wrong : 0,
      wrongbook: normalizeWrongbook(parsed.wrongbook)
    };
  } catch {
    return { vocabIndex: 0, correct: 0, wrong: 0, wrongbook: { vocab: [], hardSentences: [] } };
  }
}

function loadMeta() {
  try {
    const raw = localStorage.getItem("cet4_meta");
    if (!raw) return { streakDays: 0, lastStudyDate: "" };
    const parsed = JSON.parse(raw);
    return {
      streakDays: Number.isInteger(parsed.streakDays) ? parsed.streakDays : 0,
      lastStudyDate: typeof parsed.lastStudyDate === "string" ? parsed.lastStudyDate : ""
    };
  } catch {
    return { streakDays: 0, lastStudyDate: "" };
  }
}

function refreshStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.meta.lastStudyDate) {
    state.meta.lastStudyDate = today;
    state.meta.streakDays = 1;
    return;
  }

  if (state.meta.lastStudyDate === today) return;

  const last = new Date(state.meta.lastStudyDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diff = Math.round((now - last) / 86400000);

  state.meta.streakDays = diff === 1 ? (state.meta.streakDays || 0) + 1 : 1;
  state.meta.lastStudyDate = today;
}

function applyThemeOnLoad() {
  const stored = localStorage.getItem("cet4_theme");
  if (stored === "dark") {
    document.body.classList.add("theme-dark");
    el.themeToggle.textContent = "浅色模式";
    return;
  }
  if (stored === "light") {
    document.body.classList.remove("theme-dark");
    el.themeToggle.textContent = "深色模式";
    return;
  }

  const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("theme-dark", preferDark);
  el.themeToggle.textContent = preferDark ? "浅色模式" : "深色模式";
}

function toggleTheme() {
  const dark = document.body.classList.toggle("theme-dark");
  localStorage.setItem("cet4_theme", dark ? "dark" : "light");
  el.themeToggle.textContent = dark ? "浅色模式" : "深色模式";
}

function showToast(text, type = "success") {
  el.toast.textContent = text;
  el.toast.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    el.toast.className = "toast";
  }, 1500);
}

function hideLoading() {
  setTimeout(() => {
    el.loading.classList.add("hidden");
  }, 180);
}

function fetchJSON(path) {
  return fetch(path).then((r) => r.json());
}

function escapeHTML(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}