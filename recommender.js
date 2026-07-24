(function () {
  const courses = Array.isArray(window.COURSES) ? window.COURSES : [];
  const $ = (selector) => document.querySelector(selector);
  const list = (value) => (Array.isArray(value) ? value : []);
  const examKeys = ["midterm_exam_percent", "final_exam_percent", "exam_percent"];
  const assignmentKeys = ["ongoing_assignments_percent", "assignments_percent", "class_participation_and_assignments_percent", "presentation_assignment_percent", "midterm_assignment_percent", "final_assignment_percent", "report_percent"];
  const projectKeys = ["team_project_percent", "project_percent", "term_project_percent"];
  const keywords = {
    foundation: ["기초", "개론", "machine learning", "머신러닝", "회귀", "분류"],
    nlp: ["텍스트", "자연어", "nlp", "llm", "언어", "검색", "임베딩"],
    data: ["데이터", "통계", "분석", "시각화", "회귀", "군집"],
    deep: ["딥러닝", "deep learning", "신경망", "attention", "강화학습"],
    privacy: ["프라이버시", "개인정보", "익명화", "보안"],
  };

  function sum(course, keys) {
    return keys.reduce((total, key) => total + (Number(course.assessment?.[key]) || 0), 0);
  }
  function profile(course) {
    const assessment = course.assessment || {};
    const known = Object.keys(assessment).some((key) => key.endsWith("_percent"));
    return {
      known,
      exam: sum(course, examKeys),
      assignment: sum(course, assignmentKeys),
      project: sum(course, projectKeys),
      team: Boolean(assessment.team_project_percent || course.project?.team_project),
      presentation: Boolean(assessment.presentation_assignment_percent || assessment.final_presentation_percent || course.project?.presentation),
    };
  }
  function text(course) {
    return [course.title_ko, course.course_code, course.overview, course.syllabus_overview, ...list(course.topics), ...list(course.topics_syllabus), ...list(course.objectives)].filter(Boolean).join(" ").toLowerCase();
  }
  function schedule(course) {
    return `${course.schedule.day} ${course.schedule.session}교시 · ${course.schedule.delivery}`;
  }
  function assessmentSummary(course) {
    const p = profile(course);
    if (!p.known) return "평가기준 미공개";
    const parts = [];
    if (p.exam) parts.push(`시험 ${p.exam}%`);
    if (p.assignment) parts.push(`과제·보고서 ${p.assignment}%`);
    if (p.project) parts.push(`프로젝트 ${p.project}%`);
    if (p.team) parts.push("팀플 확인");
    return parts.join(" · ") || "출석·참여 중심";
  }
  function renderQuick(title, matches, caution = "") {
    $("#quickResults").innerHTML = matches.length
      ? `<strong>${title} · ${matches.length}개</strong>${matches.slice(0, 8).map((course) => `<div class="quick-result-item"><strong>${course.title_ko}</strong><span>${schedule(course)} · ${assessmentSummary(course)}</span></div>`).join("")}${caution ? `<p class="quick-caution">${caution}</p>` : ""}`
      : `<strong>${title}</strong><p>확인된 데이터에서 조건에 맞는 과목이 없습니다.</p>${caution ? `<p class="quick-caution">${caution}</p>` : ""}`;
  }
  function quickFilter(kind) {
    const definitions = {
      "exam-only": ["시험 평가만 확인된 과목", (c) => profile(c).known && profile(c).exam === 100],
      "no-assignment": ["과제 비율이 없는 것으로 확인된 과목", (c) => profile(c).known && profile(c).assignment === 0],
      "no-team": ["팀플이 없는 것으로 확인된 과목", (c) => profile(c).known && !profile(c).team],
      "low-exam": ["시험 비중 40% 이하 과목", (c) => profile(c).known && profile(c).exam <= 40],
      "face-to-face": ["대면 과목", (c) => c.schedule.delivery === "대면"],
      "tuesday-first": ["화요일 1교시 과목", (c) => c.schedule.day === "화" && c.schedule.session === 1],
    };
    const [title, predicate] = definitions[kind];
    renderQuick(title, courses.filter(predicate), kind.includes("no-") ? "평가기준 미공개 과목은 제외했습니다." : "");
  }
  function parseQuery(query) {
    const value = query.trim().toLowerCase();
    const conditions = [];
    if (/팀플.*(없|제외|싫)/.test(value)) conditions.push(["팀플 제외", (c) => profile(c).known && !profile(c).team]);
    if (/과제.*(없|제외|싫)/.test(value)) conditions.push(["과제 제외", (c) => profile(c).known && profile(c).assignment === 0]);
    if (/발표.*(없|제외|싫)/.test(value)) conditions.push(["발표 제외", (c) => profile(c).known && !profile(c).presentation]);
    if (/시험.*(낮|적|40% 이하)/.test(value)) conditions.push(["시험 40% 이하", (c) => profile(c).known && profile(c).exam <= 40]);
    if (/시험만|시험 중심/.test(value)) conditions.push(["시험 중심", (c) => profile(c).known && profile(c).exam >= 80]);
    if (value.includes("비대면")) conditions.push(["비대면", (c) => c.schedule.delivery.includes("비대면")]);
    else if (value.includes("대면")) conditions.push(["대면", (c) => c.schedule.delivery === "대면"]);
    for (const day of ["월", "화", "목"]) if (value.includes(`${day}요일`)) conditions.push([`${day}요일`, (c) => c.schedule.day === day]);
    if (value.includes("1교시")) conditions.push(["1교시", (c) => c.schedule.session === 1]);
    if (value.includes("2교시")) conditions.push(["2교시", (c) => c.schedule.session === 2]);
    if (!conditions.length) {
      $("#quickResults").innerHTML = "<strong>조건을 해석하지 못했어요.</strong><p>요일, 교시, 대면·비대면, 시험, 과제, 팀플, 발표 같은 단어를 사용해 주세요.</p>";
      return;
    }
    renderQuick(conditions.map(([label]) => label).join(" + "), courses.filter((course) => conditions.every(([, predicate]) => predicate(course))), "‘없음’은 공개된 평가기준으로 확인 가능한 과목만 포함합니다.");
  }
  function areaScore(course, area) {
    if (area === "any") return 8;
    if (area === "project") return profile(course).project > 0 || course.project ? 22 : 0;
    return (keywords[area] || []).some((word) => text(course).includes(word)) ? 22 : 0;
  }
  function midterm(course) {
    if (!course.assessment?.midterm_exam_percent) return null;
    return {
      date: { 화: "10월 20일(화)", 목: "10월 22일(목)", 월: "10월 26일(월)" }[course.schedule.day],
      week: course.schedule.day === "월" ? "oct4" : "oct3",
    };
  }
  function scoreCourse(course, prefs) {
    const p = profile(course);
    let score = 40 + areaScore(course, prefs.area);
    const cautions = [];
    if (prefs.delivery !== "any") {
      if (course.schedule.delivery.includes(prefs.delivery)) score += 12;
      else { score -= 10; cautions.push(`${course.schedule.delivery} 수업`); }
    }
    if (prefs.assessment === "exam") score += p.known ? Math.min(18, p.exam / 5) : -8;
    if (prefs.assessment === "assignment") score += p.known ? Math.min(18, p.assignment / 5) : -8;
    if (prefs.assessment === "project") score += p.known ? Math.min(18, p.project / 4) : -8;
    if (prefs.team === "avoid" && p.team) { score -= 20; cautions.push("팀플 포함"); }
    if (!p.known) { score -= 10; cautions.push("평가기준 미공개"); }
    const exam = midterm(course);
    if (exam && (prefs.busy === "oct34" || prefs.busy === exam.week)) {
      score -= 24;
      cautions.push(`바쁜 기간 중간고사 예상 ${exam.date}`);
    }
    return { course, score, cautions, midterm: exam };
  }
  function combinations(items) {
    const result = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) for (let k = j + 1; k < items.length; k++) result.push([items[i], items[j], items[k]]);
    return result;
  }
  function hasConflict(combo) {
    return new Set(combo.map((item) => `${item.course.schedule.day}-${item.course.schedule.session}`)).size !== combo.length;
  }
  function comboMeta(combo, prefs) {
    const exams = combo.filter((item) => item.midterm);
    const byWeek = {
      oct3: exams.filter((item) => item.midterm.week === "oct3").length,
      oct4: exams.filter((item) => item.midterm.week === "oct4").length,
    };
    const teamCount = combo.filter((item) => profile(item.course).team).length;
    const unknown = combo.filter((item) => !profile(item.course).known).length;
    let score = combo.reduce((total, item) => total + item.score, 0);
    if (Math.max(byWeek.oct3, byWeek.oct4) > Number(prefs.maxExams)) score -= 60;
    if (teamCount > 1 && prefs.team === "avoid") score -= 25;
    return { score, exams, byWeek, teamCount, unknown };
  }
  function preferences(form) {
    return {
      days: [...form.querySelectorAll('[name="availableDay"]:checked')].map((input) => input.value),
      delivery: form.delivery.value,
      area: form.area.value,
      assessment: form.assessment.value,
      team: form.team.value,
      busy: form.busy.value,
      maxExams: form.maxExams.value,
    };
  }
  function renderRecommendations(prefs) {
    let candidates = courses.filter((course) => prefs.days.includes(course.schedule.day));
    if (prefs.team === "exclude") candidates = candidates.filter((course) => !profile(course).team);
    const combos = combinations(candidates.map((course) => scoreCourse(course, prefs)))
      .filter((combo) => !hasConflict(combo))
      .map((combo) => ({ combo, meta: comboMeta(combo, prefs) }))
      .sort((a, b) => b.meta.score - a.meta.score)
      .slice(0, 3);
    const target = $("#recommendResults");
    target.hidden = false;
    if (!combos.length) {
      target.innerHTML = '<div class="result-heading"><div><h3>가능한 3과목 조합이 없습니다.</h3><p>가능 요일이나 팀플 제한을 완화해 보세요.</p></div></div>';
      return;
    }
    target.innerHTML = `<div class="result-heading"><div><h3>추천 조합 ${combos.length}개</h3><p>조건에 맞는 조합을 상대적으로 비교한 결과입니다.</p></div></div><div class="combo-grid">
      ${combos.map(({ combo, meta }, index) => `<article class="combo-card"><span>추천 조합 ${index + 1}</span>
        ${combo.map((item) => `<div class="combo-course"><button type="button" data-recommend-course="${item.course.course_code}">${item.course.title_ko}</button><small>${schedule(item.course)}</small></div>`).join("")}
        <div class="combo-facts"><span>중간고사 확인 ${meta.exams.length}개</span><span class="${Math.max(meta.byWeek.oct3, meta.byWeek.oct4) > Number(prefs.maxExams) ? "risk-high" : ""}">주간 최대 시험 ${Math.max(meta.byWeek.oct3, meta.byWeek.oct4)}개</span><span class="${meta.teamCount > 1 ? "risk-medium" : ""}">팀플 확인 ${meta.teamCount}과목</span>${meta.unknown ? `<span class="risk-medium">평가기준 미공개 ${meta.unknown}과목</span>` : ""}${combo.flatMap((item) => item.cautions).slice(0, 3).map((note) => `<span class="risk-high">주의 · ${note}</span>`).join("")}</div>
        <button class="compare-combo" type="button" data-combo="${combo.map((item) => item.course.course_code).join(",")}">이 조합 비교하기</button></article>`).join("")}
      </div><p class="result-disclaimer">추천은 공개된 강의계획서와 예상 시험일을 이용한 참고 결과입니다. 실제 시험·과제 일정은 개강 후 반드시 확인하세요.</p>`;
    target.querySelectorAll("[data-recommend-course]").forEach((button) => button.addEventListener("click", () => window.courseGuide?.openCourse(button.dataset.recommendCourse)));
    target.querySelectorAll("[data-combo]").forEach((button) => button.addEventListener("click", () => window.courseGuide?.addCoursesToCompare(button.dataset.combo.split(","))));
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#quickQuestions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-question]");
    if (button) quickFilter(button.dataset.question);
  });
  $("#recommendQueryButton")?.addEventListener("click", () => parseQuery($("#recommendQuery").value));
  $("#recommendQuery")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); parseQuery(event.target.value); }
  });
  $("#recommendForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const prefs = preferences(event.currentTarget);
    if (!prefs.days.length) { alert("가능한 요일을 하나 이상 선택해 주세요."); return; }
    localStorage.setItem("ku-course-recommend-prefs", JSON.stringify(prefs));
    renderRecommendations(prefs);
  });
  $("#recommendReset")?.addEventListener("click", () => {
    $("#recommendForm").reset();
    $("#recommendResults").hidden = true;
    localStorage.removeItem("ku-course-recommend-prefs");
  });
  const saved = JSON.parse(localStorage.getItem("ku-course-recommend-prefs") || "null");
  if (saved) {
    const form = $("#recommendForm");
    form.querySelectorAll('[name="availableDay"]').forEach((input) => input.checked = saved.days?.includes(input.value));
    for (const key of ["delivery", "area", "assessment", "team", "busy", "maxExams"]) if (saved[key] != null) form[key].value = saved[key];
  }
})();
