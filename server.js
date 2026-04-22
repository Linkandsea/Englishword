const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const PROGRESS_FILE = path.join(DATA_DIR, "user-progress.json");

const DEFAULT_PROFILE = {
  userId: "default",
  vocabIndex: 0,
  correct: 0,
  wrong: 0,
  wrongbook: {
    vocab: [],
    hardSentences: []
  },
  updatedAt: null
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROGRESS_FILE)) {
    const initial = { users: { default: DEFAULT_PROFILE } };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.users || typeof parsed.users !== "object") {
      return { users: { default: DEFAULT_PROFILE } };
    }
    return parsed;
  } catch {
    return { users: { default: DEFAULT_PROFILE } };
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normalizeWrongbook(input) {
  if (!input || typeof input !== "object") {
    return { vocab: [], hardSentences: [] };
  }

  const vocab = Array.isArray(input.vocab)
    ? input.vocab
        .filter((item) => item && typeof item.word === "string" && typeof item.answer === "string")
        .map((item) => ({ word: item.word, answer: item.answer }))
    : [];

  const hardSentences = Array.isArray(input.hardSentences)
    ? input.hardSentences.filter((item) => typeof item === "string")
    : [];

  return { vocab, hardSentences };
}

function getUser(store, userId) {
  if (!store.users[userId]) {
    store.users[userId] = {
      ...DEFAULT_PROFILE,
      userId
    };
  }
  return store.users[userId];
}

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/progress/:userId", (req, res) => {
  const userId = req.params.userId || "default";
  const store = readStore();
  const user = getUser(store, userId);
  res.json(user);
});

app.put("/api/progress/:userId", (req, res) => {
  const userId = req.params.userId || "default";
  const body = req.body || {};

  const store = readStore();
  const user = getUser(store, userId);

  if (Number.isInteger(body.vocabIndex) && body.vocabIndex >= 0) {
    user.vocabIndex = body.vocabIndex;
  }
  if (Number.isInteger(body.correct) && body.correct >= 0) {
    user.correct = body.correct;
  }
  if (Number.isInteger(body.wrong) && body.wrong >= 0) {
    user.wrong = body.wrong;
  }
  if (body.wrongbook) {
    user.wrongbook = normalizeWrongbook(body.wrongbook);
  }

  user.updatedAt = new Date().toISOString();
  writeStore(store);

  res.json({ ok: true, profile: user });
});

app.delete("/api/progress/:userId", (req, res) => {
  const userId = req.params.userId || "default";
  const store = readStore();

  store.users[userId] = {
    ...DEFAULT_PROFILE,
    userId,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  res.json({ ok: true, profile: store.users[userId] });
});

app.use(express.static(__dirname));

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, host, () => {
  ensureDataFile();
  console.log(`CET4 Sprint API running at:`);
  console.log(`- local:   http://localhost:${port}`);
  console.log(`- network: http://<your-ip>:${port}`);
});