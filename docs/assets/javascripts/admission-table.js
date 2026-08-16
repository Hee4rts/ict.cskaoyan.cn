(function () {
  "use strict";

  const initAdmissionTable = () => {
    const explorer = document.querySelector(".admission-explorer");
    if (!explorer || explorer.dataset.ready === "true") return;
    explorer.dataset.ready = "true";

    const yearSelect = explorer.querySelector("#admission-year");
    const specialtySelect = explorer.querySelector("#admission-specialty");
    const planSelect = explorer.querySelector("#admission-plan");
    const count = explorer.querySelector(".admission-count");
    const head = explorer.querySelector(".admission-table thead");
    const body = explorer.querySelector(".admission-table tbody");
    const manifestUrl = new URL(explorer.dataset.manifest, window.location.href);
    let currentData = null;
    let currentEntry = null;

    const setError = (message) => {
      count.textContent = message;
      explorer.classList.add("has-error");
    };

    const createOption = (value, label) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    };

    const matchesPlan = (row) => {
      const hasPlanTag = String(row["备注"] || "").trim() !== "";
      if (planSelect.value === "special") return hasPlanTag;
      if (planSelect.value === "all") return true;
      return !hasPlanTag;
    };

    const renderRows = () => {
      if (!currentData || !currentEntry) return;
      const rows = currentData.rows.filter((row) => {
        const matchesSpecialty = !specialtySelect.value || row["专业"] === specialtySelect.value;
        return matchesSpecialty && matchesPlan(row);
      });

      body.replaceChildren();
      const fragment = document.createDocumentFragment();
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.className = `admission-row--${row["行类型"] || "standard"}`;
        currentData.columns.forEach((column) => {
          const td = document.createElement("td");
          td.textContent = row[column] || "—";
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });
      body.appendChild(fragment);
      count.textContent = `${currentEntry.label} · 当前 ${rows.length} / 全部 ${currentData.rows.length} 条`;
    };

    const render = async (entry) => {
      count.textContent = "正在读取数据…";
      const dataUrl = new URL(entry.source, manifestUrl);
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`无法加载 ${entry.label} 数据`);
      const data = await response.json();
      currentData = data;
      currentEntry = entry;

      head.replaceChildren();
      const headerRow = document.createElement("tr");
      data.columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = column;
        headerRow.appendChild(th);
      });
      head.appendChild(headerRow);

      const previousSpecialty = specialtySelect.value;
      const specialties = [...new Set(data.rows.map((row) => row["专业"]).filter(Boolean))];
      specialtySelect.replaceChildren(createOption("", "全部专业"));
      specialties.forEach((specialty) => specialtySelect.appendChild(createOption(specialty, specialty)));
      specialtySelect.value = specialties.includes(previousSpecialty) ? previousSpecialty : "";
      specialtySelect.disabled = false;
      planSelect.disabled = false;
      renderRows();
    };

    specialtySelect.addEventListener("change", renderRows);
    planSelect.addEventListener("change", renderRows);

    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error("无法加载年份列表");
        return response.json();
      })
      .then(async (manifest) => {
        yearSelect.replaceChildren();
        manifest.years.forEach((entry) => {
          const option = createOption(entry.year, entry.label);
          option.dataset.source = entry.source;
          yearSelect.appendChild(option);
        });
        yearSelect.value = manifest.default;
        yearSelect.disabled = false;

        const current = () => manifest.years.find((item) => item.year === yearSelect.value);
        yearSelect.addEventListener("change", () => render(current()).catch((error) => setError(error.message)));
        await render(current());
      })
      .catch((error) => setError(error.message));
  };

  if (typeof document$ !== "undefined") {
    document$.subscribe(initAdmissionTable);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmissionTable);
  } else {
    initAdmissionTable();
  }
})();
