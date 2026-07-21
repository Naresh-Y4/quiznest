/* ============================================================
   QUIZ NEST — APP LOGIC
   No backend. Everything runs in the browser using quizData
   from data.js.
   ============================================================ */

(function () {
  "use strict";

  // how long to sit on the glowing correct answer before auto-advancing
  const AUTO_ADVANCE_MS = 1400;

  // ---------- state ----------
  let state = {
    learningCurrentWeek: null,     // number or "all"
    practiceSelectedWeeks: new Set(),
    practicePool: [],              // shuffled question pool for current session
    practiceIndex: 0,
    practiceScore: 0,
    practiceAnswers: [],           // { weekTag, question, options, answerIndex, pickedIndex }
    advanceTimer: null
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

  function getWeek(num) {
    return quizData.find((w) => w.week === num);
  }

  function questionCount(week) {
    return week.questions.length;
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
      if (dest === "learning-select") renderLearningWeekGrid();
      if (dest === "practice-setup") renderPracticeWeekGrid();
      showScreen(dest);
    });
  });
  document.getElementById("headerHomeBtn").addEventListener("click", () => {
    clearAdvanceTimer();
    showScreen("home");
  });

  // ============================================================
  // LEARNING
  // ============================================================
  function renderLearningWeekGrid() {
    const grid = document.getElementById("learningWeekGrid");
    grid.innerHTML = "";
    quizData.forEach((week) => {
      const count = questionCount(week);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "week-node";
      btn.disabled = count === 0;
      btn.innerHTML = `
        <span class="wn-label">Week</span>
        <span class="wn-num">${week.week}</span>
        <span class="wn-count">${count ? count + " q" : "empty"}</span>
      `;
      btn.addEventListener("click", () => openLearningWeek(week.week));
      grid.appendChild(btn);
    });
  }

  function openLearningWeek(weekNum) {
    state.learningCurrentWeek = weekNum;
    const week = getWeek(weekNum);
    document.getElementById("learningViewTitle").textContent =
      `Week ${week.week}${week.title ? " — " + week.title : ""}`;
    renderQAList(document.getElementById("learningQAList"), [
      { weekLabel: `Week ${week.week}`, questions: week.questions }
    ]);
    showScreen("learning-view");
  }

  document.getElementById("viewAllWeeksBtn").addEventListener("click", () => {
    state.learningCurrentWeek = "all";
    document.getElementById("learningViewTitle").textContent = "All weeks — full Q&A";
    const groups = quizData.map((week) => ({
      weekLabel: `Week ${week.week}`,
      questions: week.questions
    }));
    renderQAList(document.getElementById("learningQAList"), groups);
    showScreen("learning-view");
  });

  function renderQAList(container, groups) {
    container.innerHTML = "";
    const anyQuestions = groups.some((g) => g.questions.length > 0);
    if (!anyQuestions) {
      container.innerHTML = `<div class="empty-week-msg">No questions have been added yet. Paste your questions into js/data.js and they'll show up here.</div>`;
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
  // PRACTICE — SETUP
  // ============================================================
  function renderPracticeWeekGrid() {
    const grid = document.getElementById("practiceWeekGrid");
    grid.innerHTML = "";
    quizData.forEach((week) => {
      const count = questionCount(week);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "week-node week-node--select";
      btn.disabled = count === 0;
      if (state.practiceSelectedWeeks.has(week.week)) btn.classList.add("is-selected");
      btn.innerHTML = `
        <span class="wn-label">Week</span>
        <span class="wn-num">${week.week}</span>
        <span class="wn-count">${count ? count + " q" : "empty"}</span>
      `;
      btn.addEventListener("click", () => {
        if (state.practiceSelectedWeeks.has(week.week)) {
          state.practiceSelectedWeeks.delete(week.week);
        } else {
          state.practiceSelectedWeeks.add(week.week);
        }
        renderPracticeWeekGrid();
        updateStartPracticeState();
      });
      grid.appendChild(btn);
    });
  }

  document.getElementById("selectAllWeeksBtn").addEventListener("click", () => {
    quizData.forEach((w) => { if (questionCount(w) > 0) state.practiceSelectedWeeks.add(w.week); });
    renderPracticeWeekGrid();
    updateStartPracticeState();
  });
  document.getElementById("clearAllWeeksBtn").addEventListener("click", () => {
    state.practiceSelectedWeeks.clear();
    renderPracticeWeekGrid();
    updateStartPracticeState();
  });

  function updateStartPracticeState() {
    const totalQs = [...state.practiceSelectedWeeks].reduce(
      (sum, num) => sum + questionCount(getWeek(num)), 0
    );
    document.getElementById("startPracticeBtn").disabled = totalQs === 0;
    document.getElementById("practiceEmptyNote").hidden = state.practiceSelectedWeeks.size === 0 || totalQs > 0;
  }

  document.getElementById("startPracticeBtn").addEventListener("click", startPractice);
  document.getElementById("practiceAgainBtn").addEventListener("click", startPractice);

  function startPractice() {
    const weeks = [...state.practiceSelectedWeeks];
    let pool = [];
    weeks.forEach((num) => {
      const week = getWeek(num);
      week.questions.forEach((q) => {
        const shuffledOptions = shuffle(q.options.map((opt, i) => ({ text: opt, originallyCorrect: i === q.answer })));
        pool.push({
          weekLabel: `Week ${week.week}`,
          question: q.question,
          options: shuffledOptions.map((o) => o.text),
          answerIndex: shuffledOptions.findIndex((o) => o.originallyCorrect)
        });
      });
    });
    pool = shuffle(pool);

    state.practicePool = pool;
    state.practiceIndex = 0;
    state.practiceScore = 0;
    state.practiceAnswers = [];

    renderPracticeQuestion();
    showScreen("practice-quiz");
  }

  // ============================================================
  // PRACTICE — QUIZ
  // ============================================================
  function clearAdvanceTimer() {
    if (state.advanceTimer) {
      clearTimeout(state.advanceTimer);
      state.advanceTimer = null;
    }
  }

  // small "moving to next question…" note, created once and reused
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
    document.getElementById("quizProgressFill").style.width = `${((idx) / total) * 100}%`;
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
        // wrong pick: glow ONLY the correct answer, quietly dim the rest
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

    // auto-advance to the next question after a short pause so the
    // glowing correct answer has time to register
    const note = getAdvanceNote();
    note.textContent = state.practiceIndex === state.practicePool.length - 1
      ? "Loading results…"
      : "Next question…";
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
      const yourAnswerText = a.isRight
        ? "You answered correctly."
        : `You answered: "${a.options[a.pickedIndex]}"`;
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

  // ---------- init ----------
  updateStartPracticeState();
})();
