const state = {
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
  wrongbook: loadWrongbook()
};

const el = {
  navBtns: document.querySelectorAll(".nav-btn"),
  panels: document.querySelectorAll(".tab-panel"),
  qWord: document.getElementById("q-word"),
  options: document.getElementById("options"),
  feedback: document.getElementById("q-feedback"),
  speakBtn: document.getElementById("speak-btn"),
  total: document.getElementById("v-total"),
  index: document.getElementById("v-index"),
  correct: document.getElementById("v-correct"),
  wrong: document.getElementById("v-wrong"),
  analysisSentence: document.getElementById("analysis-sentence"),
  analysisStructure: document.getElementById("analysis-structure"),
  analysisSteps: document.getElementById("analysis-steps"),
  analysisCn: document.getElementById("analysis-cn"),
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

init();

async function init() {
  const [vocab, analysis, translate, reading] = await Promise.all([
    fetchJSON("./data/cet4-vocab.json"),
    fetchJSON("./data/long-sentence-analysis.json"),
    fetchJSON("./data/translation-drills.json"),
    fetchJSON("./data/reading-passages.json")
  ]);

  state.vocab = shuffle(vocab);
  state.analysisList = analysis;
  state.translateList = translate;
  state.readingList = reading;

  bindEvents();
  renderVocabQuestion();
  renderAnalysis();
  renderTranslation();
  renderReading();
  renderWrongbook();
  registerSW();
}

function bindEvents() {
  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el.speakBtn.addEventListener("click", () => {
    if (!state.currentQuestion) return;
    speakWord(state.currentQuestion.word);
  });

  el.nextAnalysis.addEventListener("click", () => {
    state.analysisIndex = (state.analysisIndex + 1) % state.analysisList.length;
    renderAnalysis();
  });

  el.nextTranslate.addEventListener("click", () => {
    state.translateIndex = (state.translateIndex + 1) % state.translateList.length;
    renderTranslation();
  });

  el.checkTranslate.addEventListener("click", () => {
    const item = state.translateList[state.translateIndex];
    el.trRef.innerHTML = `你的答案：${escapeHTML(el.trAnswer.value || "(未填写)")}<br>参考：${escapeHTML(item.reference)}`;
  });

  el.markHard.addEventListener("click", () => {
    const item = state.translateList[state.translateIndex];
    const content = item.prompt;
    if (!state.wrongbook.hardSentences.includes(content)) {
      state.wrongbook.hardSentences.push(content);
      persistWrongbook();
      renderWrongbook();
      el.trRef.innerHTML = "已加入难句本。";
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
  });
}

function switchTab(tab) {
  el.navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  el.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
}

function renderVocabQuestion() {
  const question = state.vocab[state.vocabIndex % state.vocab.length];
  state.currentQuestion = question;
  const options = shuffle([question.correct, ...question.distractors]).slice(0, 4);

  el.qWord.textContent = question.word;
  el.options.innerHTML = "";
  el.feedback.textContent = "";

  options.forEach((option, i) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = `${String.fromCharCode(65 + i)}. ${option}`;
    button.addEventListener("click", () => handleSelect(option, button));
    el.options.appendChild(button);
  });

  el.total.textContent = String(state.vocab.length);
  el.index.textContent = String(state.vocabIndex + 1);
  el.correct.textContent = String(state.correct);
  el.wrong.textContent = String(state.wrong);
}

function handleSelect(selected, button) {
  const question = state.currentQuestion;
  const buttons = [...el.options.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));

  if (selected === question.correct) {
    button.classList.add("correct");
    state.correct += 1;
    el.feedback.innerHTML = `<span class="ok">正确，自动进入下一题...</span>`;
  } else {
    button.classList.add("wrong");
    const answerBtn = buttons.find((b) => b.textContent.includes(question.correct));
    if (answerBtn) answerBtn.classList.add("correct");
    state.wrong += 1;
    el.feedback.innerHTML = `<span class="err">错误，正确答案：${escapeHTML(question.correct)}。已加入错题本并自动下一题。</span>`;
    addWrongVocab(question);
  }

  el.correct.textContent = String(state.correct);
  el.wrong.textContent = String(state.wrong);

  setTimeout(() => {
    state.vocabIndex = (state.vocabIndex + 1) % state.vocab.length;
    renderVocabQuestion();
  }, 800);
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
  el.analysisSteps.innerHTML = "";
  item.steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    el.analysisSteps.appendChild(li);
  });
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
    const li = document.createElement("li");
    li.textContent = "暂无词汇错题";
    el.wrongVocab.appendChild(li);
  } else {
    state.wrongbook.vocab.forEach((v) => {
      const li = document.createElement("li");
      li.textContent = `${v.word} -> ${v.answer}`;
      el.wrongVocab.appendChild(li);
    });
  }

  if (!state.wrongbook.hardSentences.length) {
    const li = document.createElement("li");
    li.textContent = "暂无难句收藏";
    el.hardSentences.appendChild(li);
  } else {
    state.wrongbook.hardSentences.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      el.hardSentences.appendChild(li);
    });
  }
}

function speakWord(word) {
  const utter = new SpeechSynthesisUtterance(word);
  utter.rate = 0.95;
  utter.pitch = 1;
  utter.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function fetchJSON(path) {
  return fetch(path).then((r) => r.json());
}

function loadWrongbook() {
  try {
    const raw = localStorage.getItem("cet4_wrongbook");
    if (!raw) return { vocab: [], hardSentences: [] };
    return JSON.parse(raw);
  } catch {
    return { vocab: [], hardSentences: [] };
  }
}

function persistWrongbook() {
  localStorage.setItem("cet4_wrongbook", JSON.stringify(state.wrongbook));
}

function escapeHTML(input) {
  return input
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
