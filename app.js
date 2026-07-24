const DATA_URL = "./data/courses.json";
const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
const FACULTY_BASE = "https://gscit.korea.ac.kr/gscit/intro/";
const faculty = {
  강성구: ["assets/faculty/강성구.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do`, "데이터과학 및 응용 연구실"],
  박성빈: ["assets/faculty/박성빈.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=10&articleLimit=10`, ""],
  박성우: ["assets/faculty/박성우.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=10&articleLimit=10`, "생성형 지능시스템 연구실"],
  박지혁: ["assets/faculty/박지혁.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=10&articleLimit=10`, ""],
  서태원: ["assets/faculty/서태원.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=20&articleLimit=10`, ""],
  윤수식: ["assets/faculty/윤수식.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=20&articleLimit=10`, ""],
  전유석: ["assets/faculty/전유석.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=30&articleLimit=10`, ""],
  정연돈: ["assets/faculty/정연돈.jpg", `${FACULTY_BASE}faculty_futlltime_computer.do?article.offset=40&articleLimit=10`, ""],
  감태의: ["assets/faculty/감태의.jpg", `${FACULTY_BASE}faculty_futlltime_ai.do`, "의료인공지능연구실"],
  서승호: ["assets/faculty/서승호.jpg", `${FACULTY_BASE}faculty_futlltime_ai.do`, ""],
  석흥일: ["assets/faculty/석흥일.jpg", `${FACULTY_BASE}faculty_futlltime_ai.do`, "Machine Intelligence Lab"],
  이병준: ["assets/faculty/이병준.jpg", `${FACULTY_BASE}faculty_futlltime_ai.do?article.offset=10&articleLimit=10`, ""],
  이창희: ["assets/faculty/이창희.jpg", `${FACULTY_BASE}faculty_futlltime_ai.do?article.offset=10&articleLimit=10`, ""],
};

const state = {
  courses: [],
  filters: { query: "", departments: new Set(), days: new Set(), sessions: new Set(), deliveries: new Set() },
  selected: new Set(JSON.parse(localStorage.getItem("ku-course-compare") || "[]")),
  sort: "schedule",
};
const $ = (selector) => document.querySelector(selector);
const elements = {
  courseGrid: $("#courseGrid"), resultCount: $("#resultCount"), emptyState: $("#emptyState"),
  searchInput: $("#searchInput"), departmentFilters: $("#departmentFilters"), dayFilters: $("#dayFilters"),
  sessionFilters: $("#sessionFilters"), deliveryFilters: $("#deliveryFilters"), resetFilters: $("#resetFilters"),
  sortSelect: $("#sortSelect"), activeFilterSummary: $("#activeFilterSummary"), compareCount: $("#compareCount"),
  compareDialog: $("#compareDialog"), compareContent: $("#compareContent"), courseDialog: $("#courseDialog"),
  courseDetail: $("#courseDetail"), timetableDialog: $("#timetableDialog"), cardTemplate: $("#courseCardTemplate"),
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const array = (value) => (Array.isArray(value) ? value : []);
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const topics = (course) => unique([...array(course.topics), ...array(course.topics_catalog), ...array(course.topics_syllabus), ...array(course.domain_tags)]);
const overview = (course) => course.overview || course.syllabus_overview || course.catalog_overview || "강의 소개가 제공되지 않은 과목입니다.";
const scheduleText = (course) => `${course.schedule.day}요일 ${course.schedule.session}교시 · ${course.schedule.time}`;
const deliveryGroup = (value = "") => value.includes("비대면 중심") || value.includes("병행") ? "병행" : value.includes("비대면") ? "비대면" : "대면";

function avatarHtml(name, large = false) {
  const info = faculty[name];
  return info
    ? `<img class="avatar-image${large ? " large" : ""}" src="./${info[0]}" alt="${escapeHtml(name)} 교수 공식 프로필 사진" />`
    : `<span class="avatar-fallback${large ? " large" : ""}" aria-label="${escapeHtml(name)} 교수">${escapeHtml(name.slice(-2))}</span>`;
}
function renderFilterGroup(container, values, type, chips = false) {
  container.innerHTML = values.map((value) => `<label><input type="checkbox" value="${escapeHtml(value)}" data-filter-type="${type}" /><span>${escapeHtml(value)}</span></label>`).join("");
  if (!chips) container.classList.add("check-list");
}
function setupFilters() {
  renderFilterGroup(elements.departmentFilters, unique(state.courses.map((c) => c.department)), "departments");
  renderFilterGroup(elements.dayFilters, ["월", "화", "목"], "days", true);
  renderFilterGroup(elements.sessionFilters, ["1교시", "2교시"], "sessions", true);
  renderFilterGroup(elements.deliveryFilters, unique(state.courses.map((c) => deliveryGroup(c.schedule.delivery))), "deliveries");
}
function searchableText(c) {
  return [c.course_code, c.title_ko, c.department, c.instructor?.name, overview(c), ...topics(c), ...array(c.objectives)].join(" ").toLocaleLowerCase("ko");
}
function filteredCourses() {
  const f = state.filters;
  return state.courses.filter((c) => (!f.query || searchableText(c).includes(f.query.toLocaleLowerCase("ko"))) && (!f.departments.size || f.departments.has(c.department)) && (!f.days.size || f.days.has(c.schedule.day)) && (!f.sessions.size || f.sessions.has(`${c.schedule.session}교시`)) && (!f.deliveries.size || f.deliveries.has(deliveryGroup(c.schedule.delivery))));
}
function sortedCourses(courses) {
  return [...courses].sort((a, b) => state.sort === "code" ? a.course_code.localeCompare(b.course_code) : state.sort === "title" ? a.title_ko.localeCompare(b.title_ko, "ko") : dayOrder[a.schedule.day] - dayOrder[b.schedule.day] || a.schedule.session - b.schedule.session || a.course_code.localeCompare(b.course_code));
}
function renderSchedule() {
  const cells = ["월", "화", "목"].map((day) => {
    const slots = [1, 2].map((session) => {
      const courses = state.courses.filter((c) => c.schedule.day === day && c.schedule.session === session);
      return `<div class="schedule-cell"><span class="slot-label">${session}교시</span>${courses.map((c) => `<button type="button" data-course="${c.course_code}"><strong>${escapeHtml(c.title_ko)}</strong><small>${escapeHtml(c.course_code)} · ${escapeHtml(c.instructor.name)}</small></button>`).join("")}</div>`;
    }).join("");
    return `<section class="day-column"><h3>${day}요일</h3>${slots}</section>`;
  }).join("");
  $("#weeklySchedule").innerHTML = cells;
  document.querySelectorAll("[data-course]").forEach((button) => button.addEventListener("click", () => openCourse(button.dataset.course)));
}
function renderCourses() {
  const courses = sortedCourses(filteredCourses());
  elements.courseGrid.innerHTML = ""; elements.resultCount.textContent = courses.length; elements.emptyState.hidden = Boolean(courses.length);
  for (const course of courses) {
    const node = elements.cardTemplate.content.cloneNode(true);
    node.querySelector(".department-badge").textContent = course.department.replace("융합학과", "");
    node.querySelector(".course-code").textContent = `${course.course_code} · ${course.credits}학점`;
    node.querySelector(".course-title").textContent = course.title_ko;
    node.querySelector(".course-instructor").textContent = `${course.instructor?.name || "미정"} 교수`;
    node.querySelector(".professor-avatar").innerHTML = avatarHtml(course.instructor?.name || "미정");
    node.querySelector(".schedule-box").innerHTML = `<strong>${escapeHtml(scheduleText(course))}</strong><span>${escapeHtml(course.schedule.delivery)} · ${escapeHtml(course.schedule.room)}</span>`;
    node.querySelector(".course-summary").textContent = overview(course);
    node.querySelector(".topic-list").innerHTML = topics(course).slice(0, 4).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    node.querySelector(".detail-button").addEventListener("click", () => openCourse(course.course_code));
    const input = node.querySelector(".compare-check input"); input.checked = state.selected.has(course.course_code);
    input.addEventListener("change", () => toggleCompare(course.course_code, input));
    elements.courseGrid.append(node);
  }
  const labels = [...state.filters.departments, ...state.filters.days, ...state.filters.sessions, ...state.filters.deliveries];
  if (state.filters.query) labels.unshift(`“${state.filters.query}”`);
  elements.activeFilterSummary.textContent = labels.length ? labels.join(" · ") : "전체 과목";
}
function listHtml(items, empty = "등록된 정보가 없습니다.") {
  const values = array(items); return values.length ? `<ul>${values.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.title || JSON.stringify(item))}</li>`).join("")}</ul>` : `<p class="muted">${empty}</p>`;
}
function assessmentHtml(course) {
  if (!course.assessment) return '<p class="muted">평가 비율이 공개되지 않았습니다.</p>';
  const labels = { assignments_percent: "과제", term_project_percent: "텀 프로젝트", midterm_exam_or_project_percent: "중간시험·프로젝트", midterm_exam_percent: "중간고사", attendance_percent: "출석", participation_percent: "참여도", assignments_and_project_percent: "과제·프로젝트", unallocated_percent: "미확인 배점" };
  const facts = Object.entries(course.assessment).filter(([k, v]) => k.endsWith("_percent") && typeof v === "number").map(([k, v]) => `<div class="fact-card"><strong>${v}%</strong><span>${labels[k] || k}</span></div>`).join("");
  return `<div class="detail-grid">${facts}</div>${course.assessment.note ? `<div class="notice-box">${escapeHtml(course.assessment.note)}</div>` : ""}`;
}
function openCourse(code) {
  const c = state.courses.find((item) => item.course_code === code); if (!c) return;
  const info = faculty[c.instructor?.name]; const flags = array(c.data_quality_flags);
  const warning = flags.map((f) => `<div class="notice-box"><strong>자료 확인 메모</strong><br />${escapeHtml(f.description)}</div>`).join("");
  elements.courseDetail.innerHTML = `<div class="dialog-bar"><div><p class="eyebrow">${escapeHtml(c.course_code)}-${escapeHtml(c.section)}</p><h2>${escapeHtml(c.title_ko)}</h2></div><button class="icon-button" type="button" data-close-dialog="courseDialog" aria-label="닫기">×</button></div>
    <div class="detail-body">${warning}<section class="detail-intro"><div class="faculty-profile">${avatarHtml(c.instructor?.name || "미정", true)}<div><strong>${escapeHtml(c.instructor?.name || "미정")} 교수</strong><span>${escapeHtml(info?.[2] || c.department)}</span>${info ? `<a href="${info[1]}" target="_blank" rel="noreferrer">공식 교수 페이지 →</a>` : '<small>공식 전임교원 사진 미확인</small>'}</div></div><div><p>${escapeHtml(overview(c))}</p><div class="topic-list">${topics(c).slice(0, 12).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div></div></section>
    <section class="detail-section"><h3>수업 정보</h3><div class="detail-grid"><div class="fact-card"><strong>${escapeHtml(scheduleText(c))}</strong><span>${escapeHtml(c.schedule.delivery)}</span></div><div class="fact-card"><strong>${escapeHtml(c.schedule.room)}</strong><span>강의실</span></div><div class="fact-card"><strong>${escapeHtml(c.classification)}</strong><span>${c.credits}학점</span></div><div class="fact-card"><strong>${escapeHtml(c.department)}</strong><span>개설 학과</span></div></div></section>
    <section class="detail-section"><h3>학습 목표</h3>${listHtml(c.objectives)}</section><section class="detail-section"><h3>선수지식</h3>${listHtml(c.prerequisite_knowledge, c.prerequisite_status || "명시된 선수지식이 없습니다.")}</section><section class="detail-section"><h3>평가방법</h3>${assessmentHtml(c)}</section><section class="detail-section"><h3>과제·프로젝트</h3>${listHtml(c.assignments?.items, c.project ? "프로젝트 정보는 있으나 세부 과제 목록은 없습니다." : "공개된 세부 정보가 없습니다.")}</section><section class="detail-section"><h3>주차별 계획</h3>${listHtml(c.weekly_plan || c.weekly_plan_partial)}</section><p class="source-note">강의계획서와 학교 시간표를 바탕으로 정리했습니다. 수업 정보는 변경될 수 있습니다.</p></div>`;
  bindDialogCloseButtons(); elements.courseDialog.showModal();
}
function toggleCompare(code, input) {
  if (input.checked && state.selected.size >= 3) { input.checked = false; alert("과목은 최대 3개까지 비교할 수 있습니다."); return; }
  input.checked ? state.selected.add(code) : state.selected.delete(code);
  localStorage.setItem("ku-course-compare", JSON.stringify([...state.selected])); elements.compareCount.textContent = state.selected.size; renderCourses();
}
function comparisonConflict(courses) {
  for (let i = 0; i < courses.length; i++) for (let j = i + 1; j < courses.length; j++) if (courses[i].schedule.day === courses[j].schedule.day && courses[i].schedule.session === courses[j].schedule.session) return `${courses[i].title_ko}과(와) ${courses[j].title_ko}의 시간이 겹칩니다.`; return "";
}
function renderCompare() {
  const courses = [...state.selected].map((code) => state.courses.find((c) => c.course_code === code)).filter(Boolean);
  if (!courses.length) { elements.compareContent.innerHTML = '<div class="compare-empty"><strong>비교할 과목을 선택해 주세요.</strong><p>과목 카드에서 ‘비교 담기’를 선택할 수 있습니다.</p></div>'; return; }
  const conflict = comparisonConflict(courses);
  const rows = [["과목", (c) => `<strong>${escapeHtml(c.title_ko)}</strong><br><span class="muted">${c.course_code}</span>`], ["일정", (c) => `${escapeHtml(scheduleText(c))}<br><span class="muted">${escapeHtml(c.schedule.delivery)}</span>`], ["교수", (c) => escapeHtml(c.instructor?.name)], ["개요", (c) => escapeHtml(overview(c))], ["주요 주제", (c) => topics(c).slice(0, 6).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")]];
  elements.compareContent.innerHTML = `${conflict ? `<div class="conflict-banner"><strong>시간 충돌</strong> · ${escapeHtml(conflict)}</div>` : ""}<div class="compare-table-wrap"><table class="compare-table"><tbody>${rows.map(([label, fn]) => `<tr><th>${label}</th>${courses.map((c) => `<td>${fn(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function bindDialogCloseButtons() { document.querySelectorAll("[data-close-dialog]").forEach((button) => button.onclick = () => $(`#${button.dataset.closeDialog}`).close()); }
function bindEvents() {
  elements.searchInput.oninput = (e) => { state.filters.query = e.target.value.trim(); renderCourses(); };
  document.querySelectorAll("[data-filter-type]").forEach((input) => input.onchange = () => { const set = state.filters[input.dataset.filterType]; input.checked ? set.add(input.value) : set.delete(input.value); renderCourses(); });
  elements.sortSelect.onchange = (e) => { state.sort = e.target.value; renderCourses(); };
  elements.resetFilters.onclick = () => { Object.values(state.filters).filter((v) => v instanceof Set).forEach((set) => set.clear()); state.filters.query = ""; elements.searchInput.value = ""; document.querySelectorAll("[data-filter-type]").forEach((i) => i.checked = false); renderCourses(); };
  $("#compareOpenButton").onclick = () => { renderCompare(); elements.compareDialog.showModal(); };
  document.querySelectorAll("[data-open-timetable], #timetableOpenButton").forEach((b) => b.onclick = () => elements.timetableDialog.showModal());
  [elements.courseDialog, elements.compareDialog, elements.timetableDialog].forEach((dialog) => dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }));
  bindDialogCloseButtons();
}
async function init() {
  try {
    state.courses = Array.isArray(window.COURSES) ? window.COURSES : await (await fetch(DATA_URL)).json();
    state.selected = new Set([...state.selected].filter((code) => state.courses.some((c) => c.course_code === code)));
    setupFilters(); renderSchedule(); bindEvents(); elements.compareCount.textContent = state.selected.size; renderCourses();
  } catch (error) { elements.courseGrid.innerHTML = `<div class="notice-box">과목 데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`; }
}
init();
