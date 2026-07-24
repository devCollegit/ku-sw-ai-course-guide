const DATA_URL = "./data/courses.json";
const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
const statusLabels = {
  complete: "상세 확인",
  partial: "일부 확인",
  minimal: "기본 정보",
  conflict: "확인 필요",
};

const state = {
  courses: [],
  filters: {
    query: "",
    departments: new Set(),
    days: new Set(),
    sessions: new Set(),
    deliveries: new Set(),
    hideIncomplete: false,
  },
  selected: new Set(JSON.parse(localStorage.getItem("ku-course-compare") || "[]")),
  sort: "schedule",
};

const elements = {
  courseGrid: document.querySelector("#courseGrid"),
  resultCount: document.querySelector("#resultCount"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  departmentFilters: document.querySelector("#departmentFilters"),
  dayFilters: document.querySelector("#dayFilters"),
  sessionFilters: document.querySelector("#sessionFilters"),
  deliveryFilters: document.querySelector("#deliveryFilters"),
  hideIncomplete: document.querySelector("#hideIncomplete"),
  resetFilters: document.querySelector("#resetFilters"),
  sortSelect: document.querySelector("#sortSelect"),
  activeFilterSummary: document.querySelector("#activeFilterSummary"),
  compareCount: document.querySelector("#compareCount"),
  compareOpenButton: document.querySelector("#compareOpenButton"),
  compareDialog: document.querySelector("#compareDialog"),
  compareContent: document.querySelector("#compareContent"),
  courseDialog: document.querySelector("#courseDialog"),
  courseDetail: document.querySelector("#courseDetail"),
  cardTemplate: document.querySelector("#courseCardTemplate"),
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const array = (value) => (Array.isArray(value) ? value : []);
const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function courseTopics(course) {
  return unique([
    ...array(course.topics),
    ...array(course.topics_catalog),
    ...array(course.topics_syllabus),
    ...array(course.domain_tags),
  ]);
}

function courseOverview(course) {
  return (
    course.overview ||
    course.syllabus_overview ||
    course.catalog_overview ||
    "상세 강의 개요가 아직 등록되지 않았습니다."
  );
}

function scheduleText(course) {
  const s = course.schedule;
  return `${s.day}요일 ${s.session}교시 · ${s.time}`;
}

function deliveryGroup(delivery = "") {
  if (delivery.includes("비대면 중심")) return "병행";
  if (delivery.includes("비대면")) return "비대면";
  if (delivery.includes("병행")) return "병행";
  return "대면";
}

function renderFilterGroup(container, values, type, chip = false) {
  container.innerHTML = values
    .map(
      (value) => `
        <label>
          <input type="checkbox" value="${escapeHtml(value)}" data-filter-type="${type}" />
          <span>${escapeHtml(value)}</span>
        </label>`,
    )
    .join("");
  if (!chip) container.classList.add("check-list");
}

function setupFilters() {
  const departments = unique(state.courses.map((course) => course.department));
  const deliveries = unique(state.courses.map((course) => deliveryGroup(course.schedule.delivery)));
  renderFilterGroup(elements.departmentFilters, departments, "departments");
  renderFilterGroup(elements.dayFilters, ["월", "화", "목"], "days", true);
  renderFilterGroup(elements.sessionFilters, ["1교시", "2교시"], "sessions", true);
  renderFilterGroup(elements.deliveryFilters, deliveries, "deliveries");
}

function searchableText(course) {
  return [
    course.course_code,
    course.title_ko,
    course.department,
    course.instructor?.name,
    courseOverview(course),
    ...courseTopics(course),
    ...array(course.objectives),
  ]
    .join(" ")
    .toLocaleLowerCase("ko");
}

function filteredCourses() {
  const { query, departments, days, sessions, deliveries, hideIncomplete } = state.filters;
  return state.courses.filter((course) => {
    if (query && !searchableText(course).includes(query.toLocaleLowerCase("ko"))) return false;
    if (departments.size && !departments.has(course.department)) return false;
    if (days.size && !days.has(course.schedule.day)) return false;
    if (sessions.size && !sessions.has(`${course.schedule.session}교시`)) return false;
    if (deliveries.size && !deliveries.has(deliveryGroup(course.schedule.delivery))) return false;
    if (hideIncomplete && !["complete", "partial"].includes(course.data_status)) return false;
    return true;
  });
}

function sortedCourses(courses) {
  const list = [...courses];
  const detailRank = { complete: 0, partial: 1, conflict: 2, minimal: 3 };
  return list.sort((a, b) => {
    if (state.sort === "code") return a.course_code.localeCompare(b.course_code);
    if (state.sort === "title") return a.title_ko.localeCompare(b.title_ko, "ko");
    if (state.sort === "detail") {
      return detailRank[a.data_status] - detailRank[b.data_status] || a.course_code.localeCompare(b.course_code);
    }
    return (
      dayOrder[a.schedule.day] - dayOrder[b.schedule.day] ||
      a.schedule.session - b.schedule.session ||
      a.course_code.localeCompare(b.course_code)
    );
  });
}

function renderCourses() {
  const courses = sortedCourses(filteredCourses());
  elements.courseGrid.innerHTML = "";
  elements.resultCount.textContent = courses.length;
  elements.emptyState.hidden = courses.length !== 0;

  for (const course of courses) {
    const node = elements.cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".course-card");
    card.dataset.courseCode = course.course_code;
    node.querySelector(".department-badge").textContent = course.department.replace("융합학과", "");
    const status = node.querySelector(".status-badge");
    status.textContent = statusLabels[course.data_status] || course.data_status;
    status.classList.toggle("warning", ["conflict", "minimal"].includes(course.data_status));
    node.querySelector(".course-code").textContent = `${course.course_code}-${course.section} · ${course.credits}학점`;
    node.querySelector(".course-title").textContent = course.title_ko;
    node.querySelector(".course-instructor").textContent = `${course.instructor?.name || "담당교수 미정"} 교수`;
    node.querySelector(".schedule-box").innerHTML = `
      <strong>${escapeHtml(scheduleText(course))}</strong><br />
      ${escapeHtml(course.schedule.delivery)} · ${escapeHtml(course.schedule.room)}
    `;
    node.querySelector(".topic-list").innerHTML = courseTopics(course)
      .slice(0, 4)
      .map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`)
      .join("");

    node.querySelector(".detail-button").addEventListener("click", () => openCourse(course.course_code));
    const compareInput = node.querySelector(".compare-check input");
    compareInput.checked = state.selected.has(course.course_code);
    compareInput.addEventListener("change", () => toggleCompare(course.course_code, compareInput));
    elements.courseGrid.append(node);
  }

  const filterLabels = [
    ...state.filters.departments,
    ...state.filters.days,
    ...state.filters.sessions,
    ...state.filters.deliveries,
  ];
  if (state.filters.query) filterLabels.unshift(`“${state.filters.query}”`);
  elements.activeFilterSummary.textContent = filterLabels.length ? filterLabels.join(" · ") : "전체 조건";
}

function listHtml(items, empty = "등록된 정보가 없습니다.") {
  const values = array(items);
  if (!values.length) return `<p class="muted">${empty}</p>`;
  return `<ul>${values.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.title || JSON.stringify(item))}</li>`).join("")}</ul>`;
}

function assessmentHtml(course) {
  if (!course.assessment) return '<p class="muted">평가 비율이 등록되지 않았습니다.</p>';
  const labelMap = {
    assignments_percent: "과제",
    term_project_percent: "텀 프로젝트",
    midterm_exam_or_project_percent: "중간시험·프로젝트",
    midterm_exam_percent: "중간고사",
    attendance_percent: "출석",
    participation_percent: "참여도",
    assignments_and_project_percent: "과제·프로젝트",
    unallocated_percent: "미확인 배점",
  };
  const facts = Object.entries(course.assessment)
    .filter(([key, value]) => key.endsWith("_percent") && typeof value === "number")
    .map(
      ([key, value]) =>
        `<div class="fact-card"><strong>${value}%</strong><span>${labelMap[key] || key}</span></div>`,
    )
    .join("");
  const note = course.assessment.note
    ? `<div class="warning-box">${escapeHtml(course.assessment.note)}</div>`
    : "";
  return `<div class="detail-grid">${facts}</div>${note}`;
}

function openCourse(code) {
  const course = state.courses.find((item) => item.course_code === code);
  if (!course) return;
  const flags = array(course.data_quality_flags);
  const assignments = course.assignments?.items || [];
  const weekly = course.weekly_plan || course.weekly_plan_partial || [];
  const warningHtml = flags
    .map((flag) => `<div class="warning-box"><strong>확인 필요</strong><br />${escapeHtml(flag.description)}</div>`)
    .join("");

  elements.courseDetail.innerHTML = `
    <div class="dialog-bar">
      <div>
        <p class="eyebrow">${escapeHtml(course.course_code)}-${escapeHtml(course.section)}</p>
        <h2>${escapeHtml(course.title_ko)}</h2>
      </div>
      <button class="icon-button" type="button" data-close-dialog="courseDialog" aria-label="닫기">×</button>
    </div>
    <div class="detail-body">
      ${warningHtml}
      <div class="detail-hero">
        <div>
          <p>${escapeHtml(courseOverview(course))}</p>
          <div class="topic-list">${courseTopics(course)
            .slice(0, 12)
            .map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`)
            .join("")}</div>
        </div>
        <span class="department-badge">${escapeHtml(course.department)}</span>
      </div>
      <section class="detail-section">
        <h3>기본 정보</h3>
        <div class="detail-grid">
          <div class="fact-card"><strong>${escapeHtml(scheduleText(course))}</strong><span>${escapeHtml(course.schedule.delivery)}</span></div>
          <div class="fact-card"><strong>${escapeHtml(course.schedule.room)}</strong><span>강의실</span></div>
          <div class="fact-card"><strong>${escapeHtml(course.instructor?.name || "미정")}</strong><span>담당교수</span></div>
          <div class="fact-card"><strong>${escapeHtml(course.classification)}</strong><span>${course.credits}학점</span></div>
        </div>
      </section>
      <section class="detail-section"><h3>학습 목표</h3>${listHtml(course.objectives)}</section>
      <section class="detail-section"><h3>선수지식</h3>${listHtml(course.prerequisite_knowledge, course.prerequisite_status || "명시된 선수지식이 없습니다.")}</section>
      <section class="detail-section"><h3>평가방법</h3>${assessmentHtml(course)}</section>
      <section class="detail-section"><h3>과제·프로젝트</h3>${listHtml(assignments, course.project ? "프로젝트 정보는 있으나 세부 과제 목록은 없습니다." : undefined)}</section>
      <section class="detail-section"><h3>주차별 계획</h3>${listHtml(weekly)}</section>
      <section class="detail-section">
        <h3>데이터 상태</h3>
        <p>강의계획서 정보 상태: <strong>${escapeHtml(statusLabels[course.data_status] || course.data_status)}</strong></p>
        <p class="muted">본 서비스는 비공식 자료이며 수업 정보는 변경될 수 있습니다.</p>
      </section>
    </div>`;

  bindDialogCloseButtons();
  elements.courseDialog.showModal();
}

function toggleCompare(code, input) {
  if (input.checked && state.selected.size >= 3) {
    input.checked = false;
    alert("과목은 최대 3개까지 비교할 수 있습니다.");
    return;
  }
  if (input.checked) state.selected.add(code);
  else state.selected.delete(code);
  localStorage.setItem("ku-course-compare", JSON.stringify([...state.selected]));
  updateCompareCount();
  renderCourses();
}

function updateCompareCount() {
  elements.compareCount.textContent = state.selected.size;
}

function comparisonConflict(courses) {
  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      if (
        courses[i].schedule.day === courses[j].schedule.day &&
        courses[i].schedule.session === courses[j].schedule.session
      ) {
        return `${courses[i].title_ko}과(와) ${courses[j].title_ko}의 시간이 겹칩니다.`;
      }
    }
  }
  return "";
}

function renderCompare() {
  const courses = [...state.selected]
    .map((code) => state.courses.find((course) => course.course_code === code))
    .filter(Boolean);
  if (!courses.length) {
    elements.compareContent.innerHTML =
      '<div class="compare-empty"><strong>비교할 과목을 선택해 주세요.</strong><p>과목 카드의 비교 체크박스를 사용할 수 있습니다.</p></div>';
    return;
  }

  const conflict = comparisonConflict(courses);
  const rows = [
    ["과목", (c) => `<strong>${escapeHtml(c.title_ko)}</strong><br /><span class="muted">${escapeHtml(c.course_code)}</span>`],
    ["학과", (c) => escapeHtml(c.department)],
    ["일정", (c) => `${escapeHtml(scheduleText(c))}<br /><span class="muted">${escapeHtml(c.schedule.delivery)}</span>`],
    ["교수", (c) => escapeHtml(c.instructor?.name || "미정")],
    ["개요", (c) => escapeHtml(courseOverview(c))],
    ["주요 주제", (c) => courseTopics(c).slice(0, 8).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")],
    ["데이터 상태", (c) => escapeHtml(statusLabels[c.data_status] || c.data_status)],
  ];

  elements.compareContent.innerHTML = `
    ${conflict ? `<div class="conflict-banner"><strong>시간 충돌</strong> · ${escapeHtml(conflict)}</div>` : ""}
    <div class="compare-table-wrap">
      <table class="compare-table">
        <tbody>
          ${rows
            .map(
              ([label, renderValue]) =>
                `<tr><th>${label}</th>${courses.map((course) => `<td>${renderValue(course)}</td>`).join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function bindDialogCloseButtons() {
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close());
  });
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim();
    renderCourses();
  });

  document.querySelectorAll("[data-filter-type]").forEach((input) => {
    input.addEventListener("change", () => {
      const set = state.filters[input.dataset.filterType];
      if (input.checked) set.add(input.value);
      else set.delete(input.value);
      renderCourses();
    });
  });

  elements.hideIncomplete.addEventListener("change", (event) => {
    state.filters.hideIncomplete = event.target.checked;
    renderCourses();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderCourses();
  });

  elements.resetFilters.addEventListener("click", () => {
    state.filters.query = "";
    state.filters.departments.clear();
    state.filters.days.clear();
    state.filters.sessions.clear();
    state.filters.deliveries.clear();
    state.filters.hideIncomplete = false;
    elements.searchInput.value = "";
    elements.hideIncomplete.checked = false;
    document.querySelectorAll("[data-filter-type]").forEach((input) => {
      input.checked = false;
    });
    renderCourses();
  });

  elements.compareOpenButton.addEventListener("click", () => {
    renderCompare();
    elements.compareDialog.showModal();
  });

  [elements.courseDialog, elements.compareDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  bindDialogCloseButtons();
}

async function init() {
  try {
    if (Array.isArray(window.COURSES)) {
      state.courses = window.COURSES;
    } else {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`데이터 요청 실패: ${response.status}`);
      state.courses = await response.json();
    }
    state.selected = new Set([...state.selected].filter((code) => state.courses.some((course) => course.course_code === code)));
    document.querySelector("#totalCourses").textContent = state.courses.length;
    document.querySelector("#departmentCount").textContent = unique(state.courses.map((course) => course.department)).length;
    document.querySelector("#verifiedCount").textContent = state.courses.filter((course) => course.data_status === "complete").length;
    setupFilters();
    bindEvents();
    updateCompareCount();
    renderCourses();
  } catch (error) {
    elements.courseGrid.innerHTML = `<div class="warning-box">과목 데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
  }
}

init();
