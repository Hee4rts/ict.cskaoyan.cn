(function () {
  "use strict";

  const resultNames = ["拟录取", "未录取", "放弃拟录取", "调剂"];
  const scoreBands = [
    { key: "lt310", test: (score) => score < 310 },
    { key: "310-329", test: (score) => score >= 310 && score <= 329 },
    { key: "330-349", test: (score) => score >= 330 && score <= 349 },
    { key: "350-369", test: (score) => score >= 350 && score <= 369 },
    { key: "370-389", test: (score) => score >= 370 && score <= 389 },
    { key: "gte390", test: (score) => score >= 390 },
  ];

  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const displayNumber = (value) => {
    if (value === null) return "—";
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  const summarize = (rows) => {
    const outcomes = Object.fromEntries(resultNames.map((name) => [name, 0]));
    const bands = Object.fromEntries(scoreBands.map(({ key }) => [key, 0]));
    const allScores = [];
    const proposedScores = [];

    rows.forEach((row) => {
      const result = row["结果"];
      const score = Number(row["初试总分"]);
      if (result in outcomes) outcomes[result] += 1;
      if (Number.isFinite(score)) {
        allScores.push(score);
        if (result === "拟录取") proposedScores.push(score);
        const band = scoreBands.find(({ test }) => test(score));
        if (band) bands[band.key] += 1;
      }
    });

    return {
      total: rows.length,
      outcomes,
      bands,
      medianAll: median(allScores),
      medianProposed: median(proposedScores),
    };
  };

  const initAdmissionDashboard = () => {
    const dashboard = document.querySelector(".ict-admission-dashboard");
    if (!dashboard || dashboard.dataset.ready === "true") return;
    dashboard.dataset.ready = "true";

    const select = dashboard.querySelector("#ict-specialty-filter");
    const status = dashboard.querySelector("[data-dashboard-status]");
    const setText = (selector, value) => {
      const node = dashboard.querySelector(selector);
      if (node) node.textContent = value;
    };

    const renderSpecialPlans = (allRows, specialty) => {
      ["少干", "士兵"].forEach((plan) => {
        const rows = allRows.filter((row) => {
          const matchesSpecialty = !specialty || row["专业"] === specialty;
          return matchesSpecialty && String(row["备注"] || "").trim() === plan;
        });
        const proposed = rows.filter((row) => row["结果"] === "拟录取").length;
        const unadmitted = rows.filter((row) => row["结果"] === "未录取").length;
        setText(`[data-special-total="${plan}"]`, String(rows.length));
        setText(`[data-special-proposed="${plan}"]`, String(proposed));
        setText(`[data-special-unadmitted="${plan}"]`, String(unadmitted));
      });
    };

    const render = (allRows) => {
      const specialty = select.value;
      const specialtyLabel = specialty || "全部专业";
      const rows = allRows.filter((row) => {
        const isUntagged = String(row["备注"] || "").trim() === "";
        return isUntagged && (!specialty || row["专业"] === specialty);
      });
      const summary = summarize(rows);
      const proposed = summary.outcomes["拟录取"];
      const ratio = summary.total ? (proposed / summary.total) * 100 : 0;

      setText("[data-current-specialty]", specialtyLabel);
      setText("[data-chart-specialty]", specialtyLabel);
      setText('[data-metric="records"]', String(summary.total));
      setText('[data-metric="proposed"]', String(proposed));
      setText('[data-metric="median-all"]', displayNumber(summary.medianAll));
      setText('[data-metric="median-proposed"]', displayNumber(summary.medianProposed));
      setText("[data-result-ratio]", ratio.toFixed(1));
      setText("[data-result-fraction]", `${proposed} / ${summary.total}`);
      setText("[data-score-median]", displayNumber(summary.medianAll));

      resultNames.forEach((name) => {
        const count = summary.outcomes[name];
        const percent = summary.total ? (count / summary.total) * 100 : 0;
        setText(`[data-result-count="${name}"]`, String(count));
        const segment = dashboard.querySelector(`[data-result-segment="${name}"]`);
        if (segment) segment.style.width = `${percent}%`;
      });

      const resultBar = dashboard.querySelector("[data-result-bar]");
      if (resultBar) {
        resultBar.setAttribute(
          "aria-label",
          resultNames
            .map((name) => {
              const percent = summary.total ? (summary.outcomes[name] / summary.total) * 100 : 0;
              return `${name} ${percent.toFixed(1)}%`;
            })
            .join("，")
        );
      }

      const maximumBand = Math.max(...Object.values(summary.bands), 1);
      scoreBands.forEach(({ key }) => {
        const row = dashboard.querySelector(`[data-score-band="${key}"]`);
        if (!row) return;
        const count = summary.bands[key];
        const percent = summary.total ? (count / summary.total) * 100 : 0;
        const bar = row.querySelector("b");
        const value = row.querySelector("strong");
        if (bar) bar.style.width = `${(count / maximumBand) * 100}%`;
        if (value) value.innerHTML = `${count} <small>${percent.toFixed(1)}%</small>`;
      });

      setText(
        "[data-result-note]",
        `${summary.total} 条${specialtyLabel}普通/未标注专项记录尚未被证明是全部报考者或全部实际参加复试者，因此该占比不能称为报录比、复试通过率或上岸率。`
      );
      setText(
        "[data-score-note]",
        `共 ${summary.total} 条${specialtyLabel}普通/未标注专项记录。柱长按当前筛选下各分数段记录数归一化，用于看分布，不用于预测录取概率。`
      );
      renderSpecialPlans(allRows, specialty);
    };

    fetch(new URL(dashboard.dataset.source, window.location.href))
      .then((response) => {
        if (!response.ok) throw new Error("无法加载 2026 录取数据");
        return response.json();
      })
      .then((data) => {
        select.disabled = false;
        select.addEventListener("change", () => render(data.rows));
        render(data.rows);
        status.textContent = "已载入 · 205 条普通/未标注专项 + 9 条专项计划";
      })
      .catch((error) => {
        status.textContent = `${error.message} · 当前显示静态汇总`;
        dashboard.classList.add("has-error");
      });
  };

  const initHomepage = () => {
    initAdmissionDashboard();
  };

  if (typeof document$ !== "undefined") {
    document$.subscribe(initHomepage);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage);
  } else {
    initHomepage();
  }
})();
