(() => {
  "use strict";

  const STORAGE = {
    imported: "analysisChemistryQuiz.imported.v1",
    wrong: "analysisChemistryQuiz.wrong.v1",
    stats: "analysisChemistryQuiz.stats.v1"
  };
  const state = {
    mode: "random",
    chapter: "all",
    selected: null,
    submitted: false,
    current: null,
    lastId: null,
    imported: readStorage(STORAGE.imported, []),
    wrong: readStorage(STORAGE.wrong, {}),
    stats: readStorage(STORAGE.stats, { answered: 0, correct: 0 })
  };

  const dom = {
    chapterSelect: document.querySelector("#chapter-select"),
    modeButtons: [...document.querySelectorAll(".mode-button")],
    questionPanel: document.querySelector("#question-panel"),
    emptyState: document.querySelector("#empty-state"),
    questionChapter: document.querySelector("#question-chapter"),
    questionNumber: document.querySelector("#question-number"),
    questionText: document.querySelector("#question-text"),
    questionImages: document.querySelector("#question-images"),
    answerForm: document.querySelector("#answer-form"),
    feedback: document.querySelector("#feedback"),
    submit: document.querySelector("#submit-button"),
    next: document.querySelector("#next-button"),
    hint: document.querySelector("#selection-hint"),
    chapterSummary: document.querySelector("#chapter-summary"),
    practiceSummary: document.querySelector("#practice-summary"),
    wrongCount: document.querySelector("#wrong-count"),
    openWrongBook: document.querySelector("#open-wrong-book"),
    wrongDialog: document.querySelector("#wrong-dialog"),
    closeWrongBook: document.querySelector("#close-wrong-book"),
    wrongList: document.querySelector("#wrong-list"),
    importButton: document.querySelector("#import-button"),
    excelInput: document.querySelector("#excel-input"),
    templateButton: document.querySelector("#template-button"),
    toast: document.querySelector("#toast")
  };

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function allQuestions() {
    const base = Array.isArray(window.INITIAL_QUESTION_BANK) ? window.INITIAL_QUESTION_BANK : [];
    const ids = new Set(base.map(question => question.id));
    return base.concat(state.imported.filter(question => !ids.has(question.id)));
  }

  function chapters() {
    return [...new Set(allQuestions().map(question => question.chapter))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function choicesForMode() {
    let questions = allQuestions();
    if (state.mode === "wrong") {
      questions = questions.filter(question => state.wrong[question.id]);
    } else if (state.chapter !== "all") {
      questions = questions.filter(question => question.chapter === state.chapter);
    }
    return questions;
  }

  function updateChapterControl() {
    const current = state.chapter;
    const counts = new Map();
    allQuestions().forEach(question => counts.set(question.chapter, (counts.get(question.chapter) || 0) + 1));
    dom.chapterSelect.replaceChildren();
    const allOption = new Option(`全部章节（${allQuestions().length} 题）`, "all");
    dom.chapterSelect.add(allOption);
    chapters().forEach(chapter => dom.chapterSelect.add(new Option(`${chapter}（${counts.get(chapter)} 题）`, chapter)));
    dom.chapterSelect.value = [...dom.chapterSelect.options].some(option => option.value === current) ? current : "all";
    state.chapter = dom.chapterSelect.value;
    dom.chapterSelect.disabled = state.mode === "wrong";
  }

  function updateSummary() {
    const pool = choicesForMode();
    const label = state.mode === "wrong" ? "错题本" : state.chapter === "all" ? "全部章节" : state.chapter;
    dom.chapterSummary.textContent = `${label} · ${pool.length} 道可练习`;
    dom.practiceSummary.textContent = `已答 ${state.stats.answered} 题 · 答对 ${state.stats.correct} 题`;
    dom.wrongCount.textContent = Object.keys(state.wrong).length;
  }

  function questionLabel(key) {
    return /^[1-5]$/.test(key) ? `选项 ${key}` : `${key} 选项`;
  }

  function renderQuestion() {
    const pool = choicesForMode();
    updateSummary();
    if (!pool.length) {
      state.current = null;
      dom.questionPanel.hidden = true;
      dom.emptyState.hidden = false;
      return;
    }
    dom.emptyState.hidden = true;
    dom.questionPanel.hidden = false;
    const alternatives = pool.length > 1 ? pool.filter(question => question.id !== state.lastId) : pool;
    state.current = alternatives[Math.floor(Math.random() * alternatives.length)];
    state.lastId = state.current.id;
    state.selected = null;
    state.submitted = false;
    dom.questionChapter.textContent = state.current.chapter;
    dom.questionNumber.textContent = `第 ${state.current.number} 题`;
    dom.questionText.textContent = state.current.question;
    renderImages(state.current.images || []);
    renderOptions();
    dom.feedback.hidden = true;
    dom.feedback.className = "feedback";
    dom.submit.disabled = false;
    dom.submit.textContent = "提交答案";
    dom.hint.textContent = "请选择一个选项后提交。";
  }

  function renderImages(images) {
    dom.questionImages.replaceChildren();
    images.forEach((src, index) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      image.src = src;
      image.alt = `原题配图 ${index + 1}`;
      image.loading = "lazy";
      image.addEventListener("error", () => figure.remove());
      figure.append(image);
      dom.questionImages.append(figure);
    });
  }

  function renderOptions() {
    dom.answerForm.replaceChildren();
    const keys = Object.keys(state.current.options).sort((a, b) => {
      const numeric = Number(a) - Number(b);
      return Number.isNaN(numeric) ? a.localeCompare(b) : numeric;
    });
    keys.forEach(key => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.dataset.key = key;
      button.setAttribute("aria-label", questionLabel(key));
      const marker = document.createElement("span");
      marker.className = "option-key";
      marker.textContent = key;
      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = state.current.options[key];
      button.append(marker, text);
      button.addEventListener("click", () => selectAnswer(key));
      dom.answerForm.append(button);
    });
  }

  function selectAnswer(key) {
    if (state.submitted) return;
    state.selected = key;
    [...dom.answerForm.children].forEach(button => button.classList.toggle("is-selected", button.dataset.key === key));
    dom.hint.textContent = `已选择 ${key}。`;
  }

  function submitAnswer() {
    if (!state.current || state.submitted) return;
    if (!state.selected) {
      dom.hint.textContent = "请先选择一个选项。";
      return;
    }
    state.submitted = true;
    const correct = state.selected === state.current.answer;
    state.stats.answered += 1;
    if (correct) state.stats.correct += 1;
    writeStorage(STORAGE.stats, state.stats);
    [...dom.answerForm.children].forEach(button => {
      button.disabled = true;
      if (button.dataset.key === state.current.answer) button.classList.add("is-correct");
      if (button.dataset.key === state.selected && !correct) button.classList.add("is-wrong");
    });
    if (correct) {
      dom.feedback.textContent = "回答正确。";
      dom.feedback.className = "feedback good";
      delete state.wrong[state.current.id];
    } else {
      dom.feedback.textContent = `回答错误。正确答案：${state.current.answer}。`;
      dom.feedback.className = "feedback bad";
      state.wrong[state.current.id] = state.current;
    }
    writeStorage(STORAGE.wrong, state.wrong);
    dom.feedback.hidden = false;
    dom.submit.disabled = true;
    dom.hint.textContent = "可以继续下一题。";
    updateSummary();
  }

  function showWrongBook() {
    const items = Object.values(state.wrong);
    dom.wrongList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "wrong-empty";
      empty.textContent = "暂时没有错题。";
      dom.wrongList.append(empty);
    }
    items.sort((a, b) => a.chapter.localeCompare(b.chapter, "zh-CN")).forEach(question => {
      const item = document.createElement("article");
      item.className = "wrong-item";
      const meta = document.createElement("div");
      meta.className = "wrong-item-meta";
      meta.textContent = `${question.chapter} · 第 ${question.number} 题`;
      const text = document.createElement("p");
      text.textContent = question.question;
      const actions = document.createElement("div");
      actions.className = "wrong-item-actions";
      const practice = document.createElement("button");
      practice.type = "button";
      practice.textContent = "练习此题";
      practice.addEventListener("click", () => {
        dom.wrongDialog.close();
        state.mode = "wrong";
        syncModeButtons();
        updateChapterControl();
        state.current = question;
        renderSpecificQuestion(question);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "移出错题本";
      remove.addEventListener("click", () => {
        delete state.wrong[question.id];
        writeStorage(STORAGE.wrong, state.wrong);
        showWrongBook();
        updateSummary();
      });
      actions.append(practice, remove);
      item.append(meta, text, actions);
      dom.wrongList.append(item);
    });
    dom.wrongDialog.showModal();
  }

  function renderSpecificQuestion(question) {
    const pool = choicesForMode();
    if (!pool.length) return renderQuestion();
    state.current = question;
    state.lastId = question.id;
    state.selected = null;
    state.submitted = false;
    dom.emptyState.hidden = true;
    dom.questionPanel.hidden = false;
    dom.questionChapter.textContent = question.chapter;
    dom.questionNumber.textContent = `第 ${question.number} 题`;
    dom.questionText.textContent = question.question;
    renderImages(question.images || []);
    renderOptions();
    dom.feedback.hidden = true;
    dom.submit.disabled = false;
    dom.hint.textContent = "请选择一个选项后提交。";
    updateSummary();
  }

  function normalizeHeader(value) {
    return String(value ?? "").replace(/\s+/g, "").toLowerCase();
  }

  function field(row, names) {
    const entry = Object.entries(row).find(([key]) => names.includes(normalizeHeader(key)));
    return entry ? String(entry[1] ?? "").trim() : "";
  }

  function normalizeAnswer(value) {
    const cleaned = String(value ?? "").trim().toUpperCase().replace(/[()（）\s]/g, "");
    const numeric = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };
    return numeric[cleaned] || cleaned;
  }

  function readImportedRows(rows) {
    const result = [];
    rows.forEach((row, index) => {
      const chapter = field(row, ["章节", "chapter"]) || "自定义题库";
      const question = field(row, ["题干", "题目", "question"]);
      const options = {};
      ["A", "B", "C", "D", "E"].forEach(key => {
        const value = field(row, [key.toLowerCase(), `选项${key.toLowerCase()}`]);
        if (value) options[key] = value;
      });
      const answer = normalizeAnswer(field(row, ["答案", "answer", "正确答案"]));
      if (question && Object.keys(options).length >= 2 && options[answer]) {
        const number = field(row, ["题号", "number", "序号"]) || String(index + 1);
        result.push({ id: `import-${Date.now()}-${index}-${cryptoRandom()}`, chapter, number, question, options, answer });
      }
    });
    return result;
  }

  function cryptoRandom() {
    return Math.random().toString(36).slice(2, 8);
  }

  function importExcel(file) {
    if (!window.XLSX) {
      showToast("Excel 导入组件未加载。");
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        const imported = readImportedRows(rows);
        if (!imported.length) {
          showToast("没有识别到可用选择题，请检查表头与答案列。");
          return;
        }
        state.imported.push(...imported);
        writeStorage(STORAGE.imported, state.imported);
        updateChapterControl();
        updateSummary();
        renderQuestion();
        showToast(`已导入 ${imported.length} 道选择题。`);
      } catch {
        showToast("导入失败，请确认文件是有效的 Excel 或 CSV 题库。");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const csv = "章节,题号,题干,A,B,C,D,E,答案\n示例章节,1,下列哪项正确？,选项A,选项B,选项C,选项D,,A\n";
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "题库导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  let toastTimer;
  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2800);
  }

  function syncModeButtons() {
    dom.modeButtons.forEach(button => button.classList.toggle("is-active", button.dataset.mode === state.mode));
  }

  function bindEvents() {
    dom.modeButtons.forEach(button => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      syncModeButtons();
      updateChapterControl();
      renderQuestion();
    }));
    dom.chapterSelect.addEventListener("change", () => {
      state.chapter = dom.chapterSelect.value;
      renderQuestion();
    });
    dom.submit.addEventListener("click", submitAnswer);
    dom.next.addEventListener("click", renderQuestion);
    dom.openWrongBook.addEventListener("click", showWrongBook);
    dom.closeWrongBook.addEventListener("click", () => dom.wrongDialog.close());
    dom.importButton.addEventListener("click", () => dom.excelInput.click());
    dom.excelInput.addEventListener("change", event => {
      const [file] = event.target.files;
      if (file) importExcel(file);
      event.target.value = "";
    });
    dom.templateButton.addEventListener("click", downloadTemplate);
  }

  bindEvents();
  updateChapterControl();
  renderQuestion();
})();
