(function () {
  "use strict";

  const initAdmissionTable = () => {
    const explorer = document.querySelector(".admission-explorer");
    if (!explorer || explorer.dataset.ready === "true") return;
    explorer.dataset.ready = "true";

    const select = explorer.querySelector("#admission-year");
    const count = explorer.querySelector(".admission-count");
    const head = explorer.querySelector(".admission-table thead");
    const body = explorer.querySelector(".admission-table tbody");
    const manifestUrl = new URL(explorer.dataset.manifest, window.location.href);

    const setError = (message) => {
      count.textContent = message;
      explorer.classList.add("has-error");
    };

    const render = async (entry) => {
      count.textContent = "正在读取数据…";
      const dataUrl = new URL(entry.source, manifestUrl);
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`无法加载 ${entry.label} 数据`);
      const data = await response.json();

      head.replaceChildren();
      body.replaceChildren();

      const headerRow = document.createElement("tr");
      data.columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = column;
        headerRow.appendChild(th);
      });
      head.appendChild(headerRow);

      const fragment = document.createDocumentFragment();
      data.rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.className = `admission-row--${row["行类型"] || "standard"}`;
        data.columns.forEach((column) => {
          const td = document.createElement("td");
          td.textContent = row[column] || "—";
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });
      body.appendChild(fragment);
      count.textContent = `${entry.label} · ${data.rows.length} 条记录`;
    };

    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error("无法加载年份列表");
        return response.json();
      })
      .then(async (manifest) => {
        select.replaceChildren();
        manifest.years.forEach((entry) => {
          const option = document.createElement("option");
          option.value = entry.year;
          option.textContent = entry.label;
          option.dataset.source = entry.source;
          select.appendChild(option);
        });
        select.value = manifest.default;
        select.disabled = false;

        const current = () => manifest.years.find((item) => item.year === select.value);
        select.addEventListener("change", () => render(current()).catch((error) => setError(error.message)));
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
