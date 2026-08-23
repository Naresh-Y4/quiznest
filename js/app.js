/* ============================================================
   QUIZ NEST — APP LOGIC
   No backend. Everything runs in the browser using quizData
   (js/data.js) and pyqData (js/pyq-data.js) — both are arrays
   of { week, title, questions } and are handled by the same
   generic grid/list/practice functions below.
   ============================================================ */

(function () {
  "use strict";

  // how long to sit on the glowing correct answer before auto-advancing
  const AUTO_ADVANCE_MS = 1400;

  // ---------- state ----------
  let state = {
    practiceSelectedWeeks: new Set(),   // weekly practice selection
    pyqSelectedWeeks: new Set(),        // PYQ practice selection
    practicePool: [],
    practiceIndex: 0,
    practiceScore: 0,
    practiceAnswers: [],
    advanceTimer: null,
    // where "End practice" / "Practice again" should return to / re-run:
    // { origin: "practice-setup" | "pyq-practice-setup", source: "weekly" | "pyq" }
    practiceContext: { origin: "practice-setup", source: "weekly" }
  };

  // ---------- helpers ----------
  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function findUnit(dataset, num) {
    return dataset.find((w) => w.week === num);
  }

  function questionCount(unit) {
    return unit.questions.length;
  }

  // ---------- screen navigation ----------
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const target = document.querySelector(`.screen[data-screen="${name}"]`);
    if (target) target.classList.add("active");
    document.getElementById("headerHomeBtn").hidden = name === "home";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      clearAdvanceTimer();
      const dest = el.getAttribute("data-nav");
      if (dest === "learning-select") renderWeekGrid(document.getElementById("learningWeekGrid"), quizData, { selectable: false, onOpen: (n) => openLearningWeek(n) });
      if (dest === "practice-setup") renderWeekGrid(document.getElementById("practiceWeekGrid"), quizData, { selectable: true, selectedSet: state.practiceSelectedWeeks, onSelectChange: updateStartPracticeState });
      if (dest === "pyq-select") renderWeekGrid(document.getElementById("pyqWeekGrid"), pyqData, { selectable: false, onOpen: (n) => openPyqWeek(n) });
      if (dest === "pyq-practice-setup") renderWeekGrid(document.getElementById("pyqPracticeGrid"), pyqData, { selectable: true, selectedSet: state.pyqSelectedWeeks, onSelectChange: updateStartPyqPracticeState });
      showScreen(dest);
    });
  });
  document.getElementById("headerHomeBtn").addEventListener("click", () => {
    clearAdvanceTimer();
    showScreen("home");
  });

  // ============================================================
  // GENERIC: week-node grid (used by Learning, Practice, PYQ, Practice PYQ)
  // ============================================================
  function renderWeekGrid(gridEl, dataset, opts) {
    gridEl.innerHTML = "";
    dataset.forEach((unit) => {
      const count = questionCount(unit);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = opts.selectable ? "week-node week-node--select" : "week-node";
      btn.disabled = count === 0;
      if (opts.selectable && opts.selectedSet.has(unit.week)) btn.classList.add("is-selected");
      btn.innerHTML = `
        <span class="wn-label">Week</span>
        <span class="wn-num">${unit.week}</span>
        <span class="wn-count">${count ? count + " q" : "empty"}</span>
      `;
      btn.addEventListener("click", () => {
        if (opts.selectable) {
          if (opts.selectedSet.has(unit.week)) opts.selectedSet.delete(unit.week);
          else opts.selectedSet.add(unit.week);
          renderWeekGrid(gridEl, dataset, opts);
          if (opts.onSelectChange) opts.onSelectChange();
        } else {
          opts.onOpen(unit.week);
        }
      });
      gridEl.appendChild(btn);
    });
  }

  // ============================================================
  // GENERIC: question & answer list (used by Learning view + PYQ view + Results review)
  // ============================================================
  function renderQAList(container, groups, emptyMsg) {
    container.innerHTML = "";
    const anyQuestions = groups.some((g) => g.questions.length > 0);
    if (!anyQuestions) {
      container.innerHTML = `<div class="empty-week-msg">${emptyMsg}</div>`;
      return;
    }
    groups.forEach((group) => {
      if (group.questions.length === 0) return;
      group.questions.forEach((q) => {
        const card = document.createElement("div");
        card.className = "qa-card";
        const optionsHtml = q.options
          .map((opt, i) => `<li class="${i === q.answer ? "is-correct" : ""}">${opt}</li>`)
          .join("");
        card.innerHTML = `
          <span class="qa-week-tag">${group.weekLabel}</span>
          <p class="qa-question">${q.question}</p>
          <ul class="qa-options">${optionsHtml}</ul>
        `;
        container.appendChild(card);
      });
    });
  }

  // ============================================================
  // LEARNING (weekly)
  // ============================================================
  function openLearningWeek(weekNum) {
    const week = findUnit(quizData, weekNum);
    document.getElementById("learningViewTitle").textContent =
      `Week ${week.week}${week.title ? " — " + week.title : ""}`;
    renderQAList(document.getElementById("learningQAList"), [
      { weekLabel: `Week ${week.week}`, questions: week.questions }
    ], "No questions have been added yet. Paste your questions into js/data.js and they'll show up here.");
    showScreen("learning-view");
  }

  document.getElementById("viewAllWeeksBtn").addEventListener("click", () => {
    document.getElementById("learningViewTitle").textContent = "All weeks — full Q&A";
    const groups = quizData.map((week) => ({ weekLabel: `Week ${week.week}`, questions: week.questions }));
    renderQAList(document.getElementById("learningQAList"), groups, "No questions have been added yet.");
    showScreen("learning-view");
  });

  // ============================================================
  // PYQ (weekly, mirrors Learning)
  // ============================================================
  function openPyqWeek(weekNum) {
    const week = findUnit(pyqData, weekNum);
    document.getElementById("pyqViewTitle").textContent =
      `Week ${week.week}${week.title ? " — " + week.title : ""}`;
    renderQAList(document.getElementById("pyqQAList"), [
      { weekLabel: `Week ${week.week}`, questions: week.questions }
    ], "No PYQs have been added for this week yet.");
    showScreen("pyq-view");
  }

  document.getElementById("viewAllPyqBtn").addEventListener("click", () => {
    document.getElementById("pyqViewTitle").textContent = "All PYQ weeks — full Q&A";
    const groups = pyqData.map((week) => ({ weekLabel: `Week ${week.week}`, questions: week.questions }));
    renderQAList(document.getElementById("pyqQAList"), groups, "No PYQs have been added yet.");
    showScreen("pyq-view");
  });

  // ============================================================
  // PRACTICE — SETUP (weekly)
  // ============================================================
  document.getElementById("selectAllWeeksBtn").addEventListener("click", () => {
    quizData.forEach((w) => { if (questionCount(w) > 0) state.practiceSelectedWeeks.add(w.week); });
    renderWeekGrid(document.getElementById("practiceWeekGrid"), quizData, { selectable: true, selectedSet: state.practiceSelectedWeeks, onSelectChange: updateStartPracticeState });
    updateStartPracticeState();
  });
  document.getElementById("clearAllWeeksBtn").addEventListener("click", () => {
    state.practiceSelectedWeeks.clear();
    renderWeekGrid(document.getElementById("practiceWeekGrid"), quizData, { selectable: true, selectedSet: state.practiceSelectedWeeks, onSelectChange: updateStartPracticeState });
    updateStartPracticeState();
  });

  function updateStartPracticeState() {
    const totalQs = [...state.practiceSelectedWeeks].reduce((sum, num) => sum + questionCount(findUnit(quizData, num)), 0);
    document.getElementById("startPracticeBtn").disabled = totalQs === 0;
    document.getElementById("practiceEmptyNote").hidden = state.practiceSelectedWeeks.size === 0 || totalQs > 0;
  }

  document.getElementById("startPracticeBtn").addEventListener("click", () => {
    const pool = [];
    [...state.practiceSelectedWeeks].forEach((num) => {
      const week = findUnit(quizData, num);
      week.questions.forEach((q) => pool.push(buildPoolItem(`Week ${week.week}`, q)));
    });
    state.practiceContext = { origin: "practice-setup", source: "weekly" };
    launchPractice(pool);
  });

  // ============================================================
  // PRACTICE — SETUP (PYQ, mirrors weekly Practice)
  // ============================================================
  document.getElementById("selectAllPyqBtn").addEventListener("click", () => {
    pyqData.forEach((w) => { if (questionCount(w) > 0) state.pyqSelectedWeeks.add(w.week); });
    renderWeekGrid(document.getElementById("pyqPracticeGrid"), pyqData, { selectable: true, selectedSet: state.pyqSelectedWeeks, onSelectChange: updateStartPyqPracticeState });
    updateStartPyqPracticeState();
  });
  document.getElementById("clearAllPyqBtn").addEventListener("click", () => {
    state.pyqSelectedWeeks.clear();
    renderWeekGrid(document.getElementById("pyqPracticeGrid"), pyqData, { selectable: true, selectedSet: state.pyqSelectedWeeks, onSelectChange: updateStartPyqPracticeState });
    updateStartPyqPracticeState();
  });

  function updateStartPyqPracticeState() {
    const totalQs = [...state.pyqSelectedWeeks].reduce((sum, num) => sum + questionCount(findUnit(pyqData, num)), 0);
    document.getElementById("startPyqPracticeBtn").disabled = totalQs === 0;
    document.getElementById("pyqPracticeEmptyNote").hidden = state.pyqSelectedWeeks.size === 0 || totalQs > 0;
  }

  document.getElementById("startPyqPracticeBtn").addEventListener("click", () => {
    const pool = [];
    [...state.pyqSelectedWeeks].forEach((num) => {
      const week = findUnit(pyqData, num);
      week.questions.forEach((q) => pool.push(buildPoolItem(`PYQ · Week ${week.week}`, q)));
    });
    state.practiceContext = { origin: "pyq-practice-setup", source: "pyq" };
    launchPractice(pool);
  });

  // ============================================================
  // SHARED PRACTICE ENGINE (weekly + PYQ)
  // ============================================================
  function buildPoolItem(label, q) {
    const shuffledOptions = shuffle(q.options.map((opt, i) => ({ text: opt, originallyCorrect: i === q.answer })));
    return {
      weekLabel: label,
      question: q.question,
      options: shuffledOptions.map((o) => o.text),
      answerIndex: shuffledOptions.findIndex((o) => o.originallyCorrect)
    };
  }

  function launchPractice(pool) {
    state.practicePool = shuffle(pool);
    state.practiceIndex = 0;
    state.practiceScore = 0;
    state.practiceAnswers = [];
    renderPracticeQuestion();
    showScreen("practice-quiz");
  }

  document.getElementById("practiceAgainBtn").addEventListener("click", () => {
    if (state.practiceContext.source === "pyq") {
      document.getElementById("startPyqPracticeBtn").click();
    } else {
      document.getElementById("startPracticeBtn").click();
    }
  });

  document.getElementById("quizEndBtn").addEventListener("click", () => {
    clearAdvanceTimer();
    const origin = state.practiceContext.origin;
    if (origin === "practice-setup") renderWeekGrid(document.getElementById("practiceWeekGrid"), quizData, { selectable: true, selectedSet: state.practiceSelectedWeeks, onSelectChange: updateStartPracticeState });
    if (origin === "pyq-practice-setup") renderWeekGrid(document.getElementById("pyqPracticeGrid"), pyqData, { selectable: true, selectedSet: state.pyqSelectedWeeks, onSelectChange: updateStartPyqPracticeState });
    showScreen(origin);
  });

  function clearAdvanceTimer() {
    if (state.advanceTimer) {
      clearTimeout(state.advanceTimer);
      state.advanceTimer = null;
    }
  }

  function getAdvanceNote() {
    let note = document.getElementById("quizAdvanceNote");
    if (!note) {
      note = document.createElement("p");
      note.id = "quizAdvanceNote";
      note.className = "quiz-advance-note";
      const nextBtn = document.getElementById("quizNextBtn");
      nextBtn.parentNode.insertBefore(note, nextBtn);
    }
    return note;
  }

  function renderPracticeQuestion() {
    clearAdvanceTimer();
    const total = state.practicePool.length;
    const idx = state.practiceIndex;
    const q = state.practicePool[idx];

    document.getElementById("quizProgressLabel").textContent = `Question ${idx + 1} of ${total}`;
    document.getElementById("quizProgressFill").style.width = `${(idx / total) * 100}%`;
    document.getElementById("quizWeekTag").textContent = q.weekLabel;
    document.getElementById("quizQuestionText").textContent = q.question;

    const list = document.getElementById("quizOptionsList");
    list.innerHTML = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => pickAnswer(i));
      list.appendChild(btn);
    });

    const nextBtn = document.getElementById("quizNextBtn");
    nextBtn.classList.add("is-hidden");
    nextBtn.disabled = true;
    nextBtn.textContent = idx === total - 1 ? "See results" : "Next question";

    getAdvanceNote().classList.remove("is-visible");
  }

  function pickAnswer(pickedIndex) {
    const q = state.practicePool[state.practiceIndex];
    const buttons = document.querySelectorAll("#quizOptionsList .option-btn");
    const isRight = pickedIndex === q.answerIndex;

    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === pickedIndex) b.classList.add("is-picked");
      if (!isRight) {
        if (i === q.answerIndex) b.classList.add("is-correct-glow");
        else b.classList.add("is-wrong-pick");
      }
    });

    if (isRight) state.practiceScore++;

    state.practiceAnswers.push({
      weekLabel: q.weekLabel,
      question: q.question,
      options: q.options,
      answerIndex: q.answerIndex,
      pickedIndex,
      isRight
    });

    const note = getAdvanceNote();
    note.textContent = state.practiceIndex === state.practicePool.length - 1 ? "Loading results…" : "Next question…";
    note.classList.add("is-visible");

    clearAdvanceTimer();
    state.advanceTimer = setTimeout(goToNext, AUTO_ADVANCE_MS);
  }

  function goToNext() {
    clearAdvanceTimer();
    if (state.practiceIndex < state.practicePool.length - 1) {
      state.practiceIndex++;
      renderPracticeQuestion();
    } else {
      finishPractice();
    }
  }

  document.getElementById("quizNextBtn").addEventListener("click", goToNext);

  function finishPractice() {
    document.getElementById("quizProgressFill").style.width = "100%";
    const total = state.practicePool.length;
    document.getElementById("scoreBig").textContent = `${state.practiceScore}/${total}`;

    const reviewList = document.getElementById("resultsReviewList");
    reviewList.innerHTML = "";
    state.practiceAnswers.forEach((a) => {
      const card = document.createElement("div");
      card.className = "qa-card";
      const optionsHtml = a.options
        .map((opt, i) => `<li class="${i === a.answerIndex ? "is-correct" : ""}">${opt}</li>`)
        .join("");
      const yourAnswerText = a.isRight ? "You answered correctly." : `You answered: "${a.options[a.pickedIndex]}"`;
      card.innerHTML = `
        <span class="qa-week-tag">${a.weekLabel}</span>
        <p class="qa-question">${a.question}</p>
        <ul class="qa-options">${optionsHtml}</ul>
        <p class="review-your-answer ${a.isRight ? "right" : "wrong"}">${yourAnswerText}</p>
      `;
      reviewList.appendChild(card);
    });

    showScreen("practice-results");
  }
})();