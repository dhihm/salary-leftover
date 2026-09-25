/**
 * 월급잔액 — 실수령 추정 + 습관 지출 잔액 계산기
 *
 * === 계산 기준 (추정, 절세/세무 자문 아님) ===
 * 1) 4대보험 근로자 부담 ≈ 세전 × 9.4%
 *    - 국민연금 4.5%
 *    - 건강보험 ≈ 3.545%
 *    - 장기요양 ≈ 건강보험의 12.81% → 세전 대비 ≈ 0.454%
 *    - 고용보험 0.9%
 *    → 합계 ≈ 9.399% ≈ 9.4%로 단순화
 *
 * 2) 소득세+지방소득세(추정): 월 세전 구간별 실효세율 테이블
 *    (근로소득공제·부양가족·비과세 미반영 — 매우 거친 근사)
 *    - ~200만: 0.5%
 *    - ~300만: 2.0%
 *    - ~400만: 3.5%
 *    - ~500만: 5.0%
 *    - ~700만: 7.5%
 *    - ~1000만: 10.0%
 *    - 1000만+: 13.0%
 *
 * 실수령 ≈ 세전 − 4대보험 − 소득세추정
 * 잔액 = 실수령 − Σ(단가 × 횟수)
 */

const INSURANCE_RATE = 0.094;

/** 월 세전(원) → 소득세 실효세율 (추정) */
function incomeTaxRate(grossMonthly) {
  if (grossMonthly <= 0) return 0;
  if (grossMonthly <= 2_000_000) return 0.005;
  if (grossMonthly <= 3_000_000) return 0.02;
  if (grossMonthly <= 4_000_000) return 0.035;
  if (grossMonthly <= 5_000_000) return 0.05;
  if (grossMonthly <= 7_000_000) return 0.075;
  if (grossMonthly <= 10_000_000) return 0.1;
  return 0.13;
}

function estimateTakeHome(gross) {
  const g = Math.max(0, Number(gross) || 0);
  const insurance = Math.round(g * INSURANCE_RATE);
  const tax = Math.round(g * incomeTaxRate(g));
  return {
    gross: g,
    insurance,
    tax,
    takeHome: Math.max(0, g - insurance - tax),
  };
}

const PRESETS = [
  { id: "starbucks", name: "스타벅스 아메리카노", price: 4500, freq: 8 },
  { id: "delivery", name: "배달음식", price: 20000, freq: 4 },
  { id: "cvs", name: "편의점 야식", price: 8000, freq: 4 },
  { id: "taxi", name: "택시/카카오T", price: 15000, freq: 2 },
  { id: "ott", name: "넷플릭스 등 OTT", price: 17000, freq: 1 },
  { id: "coffee-d", name: "배달커피", price: 6000, freq: 8 },
];

let state = {
  salary: 3_500_000,
  habits: PRESETS.map((h) => ({ ...h })),
  nextId: 1,
};

function formatKRW(n) {
  const abs = Math.abs(Math.round(n));
  return abs.toLocaleString("ko-KR");
}

function formatSignedKRW(n) {
  const rounded = Math.round(n);
  if (rounded < 0) return "-" + formatKRW(rounded) + "원";
  return formatKRW(rounded) + "원";
}

function habitMonthly(h) {
  return (Number(h.price) || 0) * (Number(h.freq) || 0);
}

function habitSpendTotal() {
  return state.habits.reduce((sum, h) => sum + habitMonthly(h), 0);
}

/** 대략적인 소비재 기준가 (원) — 연환산 비유용 */
const PRODUCT_LADDER = [
  { name: "편의점 삼각김밥", price: 1_500 },
  { name: "영화 티켓", price: 15_000 },
  { name: "제주 왕복", price: 200_000 },
  { name: "에어팟", price: 300_000 },
  { name: "아이패드", price: 500_000 },
  { name: "노트북", price: 1_000_000 },
  { name: "아이폰", price: 1_200_000 },
];

function habitsWithSpend() {
  return state.habits
    .map((h) => ({ habit: h, monthly: habitMonthly(h) }))
    .filter((x) => x.monthly > 0);
}

function topHabitBySpend() {
  const withSpend = habitsWithSpend();
  if (!withSpend.length) return null;
  return withSpend.reduce((a, b) => (b.monthly > a.monthly ? b : a));
}

function rankedHabitsBySpend() {
  return habitsWithSpend().sort((a, b) => b.monthly - a.monthly);
}

function shortHabitLabel(name) {
  const n = String(name).trim();
  const first = n.split(/\s+/)[0];
  if (first.length <= 12) return first;
  return first.slice(0, 11) + "…";
}

function formatYearlyKRW(yearly) {
  const y = Math.round(yearly);
  if (y >= 10_000) {
    const man = y / 10_000;
    const rounded =
      man >= 100 ? Math.round(man) : Math.round(man * 10) / 10;
    const text = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1).replace(/\.0$/, "");
    return text + "만 원";
  }
  return formatKRW(y) + "원";
}

/** 연간 금액 → 가장 와닿는 소비재 비유 (대략) */
function productEquivalent(yearly) {
  const y = Math.round(yearly);
  if (y <= 0) return null;

  for (let i = PRODUCT_LADDER.length - 1; i >= 0; i--) {
    const p = PRODUCT_LADDER[i];
    if (y >= p.price * 0.75) {
      const count = Math.floor(y / p.price);
      if (count >= 2) return `${p.name} ${count}개`;
      if (y >= p.price) return p.name;
      return `거의 ${p.name}`;
    }
  }

  const small = PRODUCT_LADDER[0];
  const n = Math.max(1, Math.floor(y / small.price));
  if (n >= 2) return `${small.name} ${n}개`;
  return small.name;
}

function formatProductEquivPhrase(yearly) {
  const eq = productEquivalent(yearly);
  if (!eq) return "";
  if (eq.startsWith("거의 ")) return `= ${eq} 살 돈`;
  if (eq.includes("개")) return `= ${eq} 살 돈`;
  return `= ${eq} 살 돈`;
}

function habitPctOfTakeHome(monthly, takeHome) {
  if (!takeHome || takeHome <= 0) return 0;
  return (monthly / takeHome) * 100;
}

function renderHabits() {
  const list = document.getElementById("habit-list");
  list.innerHTML = "";

  state.habits.forEach((h, index) => {
    const li = document.createElement("li");
    li.className = "habit-row";
    li.dataset.index = String(index);

    const subtotal = (Number(h.price) || 0) * (Number(h.freq) || 0);

    li.innerHTML = `
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-price">
          <input type="number" min="0" step="100" inputmode="numeric"
            class="price-input" data-index="${index}" value="${h.price}"
            aria-label="${escapeHtml(h.name)} 단가" />
          <span>원</span>
        </div>
      </div>
      <div class="habit-controls">
        <div class="stepper" role="group" aria-label="${escapeHtml(h.name)} 횟수">
          <button type="button" class="freq-dec" data-index="${index}" aria-label="횟수 줄이기">−</button>
          <input type="number" min="0" max="99" inputmode="numeric"
            class="freq-input" data-index="${index}" value="${h.freq}"
            aria-label="월 횟수" />
          <button type="button" class="freq-inc" data-index="${index}" aria-label="횟수 늘리기">+</button>
        </div>
        <button type="button" class="btn-remove" data-index="${index}" aria-label="삭제">×</button>
      </div>
      <div class="habit-subtotal">월 ${formatKRW(subtotal)}원</div>
    `;
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateUI() {
  const est = estimateTakeHome(state.salary);
  const spend = habitSpendTotal();
  const leftover = est.takeHome - spend;

  document.getElementById("takehome-value").textContent =
    formatKRW(est.takeHome) + "원";

  const leftoverEl = document.getElementById("leftover-num");
  leftoverEl.textContent = formatSignedKRW(leftover);
  leftoverEl.classList.remove("negative", "warn");
  if (leftover < 0) {
    leftoverEl.classList.add("negative");
  } else if (leftover < est.takeHome * 0.15) {
    leftoverEl.classList.add("warn");
  }

  document.getElementById("habit-spend-value").textContent =
    formatKRW(spend) + "원";

  const hint = document.getElementById("leftover-hint");
  if (leftover < 0) {
    hint.textContent = "습관을 조금 줄여보면 어떨까요?";
  } else if (leftover < 100_000) {
    hint.textContent = "빠듯해요. 횟수를 조절해 보세요.";
  } else {
    hint.textContent = "이번 달 여유분 추정이에요.";
  }

  renderAnnualShock();
  renderRankCard(est.takeHome);

  // Refresh row subtotals without full re-render if list exists
  document.querySelectorAll(".habit-row").forEach((row) => {
    const i = Number(row.dataset.index);
    const h = state.habits[i];
    if (!h) return;
    const sub = (Number(h.price) || 0) * (Number(h.freq) || 0);
    const el = row.querySelector(".habit-subtotal");
    if (el) el.textContent = `월 ${formatKRW(sub)}원`;
  });
}

function renderAnnualShock() {
  const section = document.getElementById("annual-shock-section");
  const top = topHabitBySpend();
  if (!top) {
    section.classList.add("hidden");
    return;
  }

  const yearly = top.monthly * 12;
  const label = shortHabitLabel(top.habit.name);
  document.getElementById("shock-line-main").innerHTML =
    `「${escapeHtml(label)}」만 1년에 <strong>${formatYearlyKRW(yearly)}</strong>`;
  const equivBody = formatProductEquivPhrase(yearly).replace(/^=\s*/, "");
  document.getElementById("shock-line-equiv").innerHTML =
    `= <strong>${escapeHtml(equivBody)}</strong>`;
  section.classList.remove("hidden");
}

function renderRankCard(takeHome) {
  const list = document.getElementById("rank-list");
  const empty = document.getElementById("rank-empty");
  const ranked = rankedHabitsBySpend();

  list.innerHTML = "";
  if (!ranked.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const maxMonthly = ranked[0].monthly;

  ranked.forEach((item, index) => {
    const rank = index + 1;
    const pct = habitPctOfTakeHome(item.monthly, takeHome);
    const barPct = maxMonthly > 0 ? (item.monthly / maxMonthly) * 100 : 0;
    const li = document.createElement("li");
    li.className = "rank-row" + (rank === 1 ? " rank-top" : "");

    li.innerHTML = `
      <span class="rank-num" aria-hidden="true">${rank}</span>
      <span class="rank-name">${escapeHtml(item.habit.name)}</span>
      <span class="rank-pct">${pct.toFixed(1)}%</span>
      <span class="rank-meta">월 ${formatKRW(item.monthly)}원</span>
      <div class="rank-bar-wrap" aria-hidden="true">
        <div class="rank-bar" style="width: ${barPct.toFixed(1)}%"></div>
      </div>
    `;
    list.appendChild(li);
  });
}

function buildShareSummary(est, spend, leftover) {
  const lines = [
    "월급잔액 요약",
    `잔액 ${formatSignedKRW(leftover)} · 실수령 ${formatKRW(est.takeHome)}원 · 습관 ${formatKRW(spend)}원`,
  ];

  const top = topHabitBySpend();
  if (top) {
    const yearly = top.monthly * 12;
    const label = shortHabitLabel(top.habit.name);
    const equiv = formatProductEquivPhrase(yearly);
    lines.push(
      `「${label}」1년 ${formatYearlyKRW(yearly)} ${equiv.replace(/^=\s*/, "")}`
    );
  }

  const ranked = rankedHabitsBySpend().slice(0, 3);
  if (ranked.length) {
    const rankLine = ranked
      .map((item, i) => {
        const pct = habitPctOfTakeHome(item.monthly, est.takeHome);
        const name = shortHabitLabel(item.habit.name);
        return `${i + 1}.${name} ${pct.toFixed(1)}%`;
      })
      .join(" · ");
    lines.push(`순위 ${rankLine}`);
  }

  lines.push("(추정 · 세무 자문 아님)");
  return lines.join("\n");
}

function fullRender() {
  renderHabits();
  updateUI();
}

function bindEvents() {
  const salaryInput = document.getElementById("salary-input");

  salaryInput.addEventListener("input", () => {
    const raw = salaryInput.value.replace(/[^\d]/g, "");
    state.salary = Number(raw) || 0;
    // Keep digits-only display with commas
    const pos = salaryInput.selectionStart;
    const before = salaryInput.value.length;
    salaryInput.value = raw ? Number(raw).toLocaleString("ko-KR") : "";
    const after = salaryInput.value.length;
    try {
      salaryInput.setSelectionRange(
        Math.max(0, pos + (after - before)),
        Math.max(0, pos + (after - before))
      );
    } catch (_) {}
    updateUI();
  });

  salaryInput.addEventListener("blur", () => {
    if (!salaryInput.value) {
      salaryInput.value = "0";
      state.salary = 0;
      updateUI();
    }
  });

  document.getElementById("habit-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (Number.isNaN(index)) return;

    if (btn.classList.contains("freq-inc")) {
      state.habits[index].freq = Math.min(99, (Number(state.habits[index].freq) || 0) + 1);
      const input = btn.parentElement.querySelector(".freq-input");
      if (input) input.value = state.habits[index].freq;
      updateUI();
    } else if (btn.classList.contains("freq-dec")) {
      state.habits[index].freq = Math.max(0, (Number(state.habits[index].freq) || 0) - 1);
      const input = btn.parentElement.querySelector(".freq-input");
      if (input) input.value = state.habits[index].freq;
      updateUI();
    } else if (btn.classList.contains("btn-remove")) {
      state.habits.splice(index, 1);
      fullRender();
    }
  });

  document.getElementById("habit-list").addEventListener("input", (e) => {
    const t = e.target;
    const index = Number(t.dataset.index);
    if (Number.isNaN(index) || !state.habits[index]) return;

    if (t.classList.contains("freq-input")) {
      let v = parseInt(t.value, 10);
      if (Number.isNaN(v) || v < 0) v = 0;
      if (v > 99) v = 99;
      state.habits[index].freq = v;
      updateUI();
    } else if (t.classList.contains("price-input")) {
      let v = parseInt(t.value, 10);
      if (Number.isNaN(v) || v < 0) v = 0;
      state.habits[index].price = v;
      updateUI();
    }
  });

  document.getElementById("btn-toggle-add").addEventListener("click", () => {
    const form = document.getElementById("add-form");
    const btn = document.getElementById("btn-toggle-add");
    const opening = form.classList.contains("hidden");
    form.classList.toggle("hidden");
    btn.classList.toggle("hidden");
    if (opening) {
      document.getElementById("new-name").focus();
    }
  });

  document.getElementById("btn-cancel-add").addEventListener("click", () => {
    document.getElementById("add-form").classList.add("hidden");
    document.getElementById("btn-toggle-add").classList.remove("hidden");
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
  });

  document.getElementById("btn-add-habit").addEventListener("click", () => {
    const name = document.getElementById("new-name").value.trim();
    const price = parseInt(document.getElementById("new-price").value, 10) || 0;
    if (!name) {
      document.getElementById("new-name").focus();
      return;
    }
    state.habits.push({
      id: "custom-" + state.nextId++,
      name,
      price: Math.max(0, price),
      freq: 1,
    });
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("add-form").classList.add("hidden");
    document.getElementById("btn-toggle-add").classList.remove("hidden");
    fullRender();
  });

  document.getElementById("btn-share").addEventListener("click", async () => {
    const est = estimateTakeHome(state.salary);
    const spend = habitSpendTotal();
    const leftover = est.takeHome - spend;
    const text = buildShareSummary(est, spend, leftover);

    const btn = document.getElementById("btn-share");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      btn.textContent = "복사했어요!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "요약 복사하기";
        btn.classList.remove("copied");
      }, 1800);
    } catch (_) {
      btn.textContent = "복사 실패 — 직접 선택해 주세요";
      setTimeout(() => {
        btn.textContent = "요약 복사하기";
      }, 2000);
    }
  });
}

function init() {
  const salaryInput = document.getElementById("salary-input");
  salaryInput.value = state.salary.toLocaleString("ko-KR");
  bindEvents();
  fullRender();
}

document.addEventListener("DOMContentLoaded", init);
