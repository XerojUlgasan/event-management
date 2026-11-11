const BASE = 190500;
const layouts = [
  { id: "sheet", label: "A · Offer sheet", hint: "One offer on the page. Older versions stay tucked away." },
  { id: "split", label: "B · Version list", hint: "Pick a version on the left. Only that version is open." },
  { id: "summary", label: "C · Total first", hint: "The price is first. The lines explain it." },
];
const scenes = ["sent", "draft", "empty"];
const sampleLines = () => [
  { id: "setup", description: "Additional event setup (demonstration)", direction: "add", kind: "addition", service: "", amount: "2500.50" },
  { id: "discount", description: "Courtesy discount (demonstration)", direction: "deduct", kind: "deduction", service: "", amount: "500.25" },
];
const services = ["", "Photography", "Styling", "Coordination"];
const kinds = [
  ["addition", "Addition"],
  ["deduction", "Deduction"],
  ["substitution", "Substitution"],
  ["adjustment", "Other adjustment"],
];

const state = {
  layout: "sheet",
  scene: "draft",
  pageTab: "quotation",
  selectedVersion: 2,
  showRevision: false,
  revisionReason: "",
  historyOpen: false,
  lines: sampleLines(),
};

const panel = document.querySelector("#panel");
const layoutLabel = document.querySelector("#layout-label");
const layoutHint = document.querySelector("#layout-hint");

const pesos = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
const signed = (amount) => {
  const formatted = pesos(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
};
const money = (line) => {
  const amount = Number(line.amount);
  return Number.isFinite(amount) ? amount : 0;
};
const totals = () => {
  const additions = state.lines.filter((line) => line.direction === "add").reduce((sum, line) => sum + money(line), 0);
  const deductions = state.lines.filter((line) => line.direction === "deduct").reduce((sum, line) => sum + money(line), 0);
  return { additions, deductions, total: BASE + additions - deductions };
};
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function readUrl() {
  const params = new URLSearchParams(location.search);
  if (layouts.some((layout) => layout.id === params.get("layout"))) state.layout = params.get("layout");
  if (scenes.includes(params.get("scene"))) state.scene = params.get("scene");
  if (params.get("tab") === "details" || params.get("tab") === "quotation") state.pageTab = params.get("tab");
}
function writeUrl() {
  const params = new URLSearchParams(location.search);
  params.set("layout", state.layout);
  params.set("scene", state.scene);
  params.set("tab", state.pageTab);
  history.replaceState(null, "", `?${params.toString()}`);
}

function sentRows() {
  return `
    <tr>
      <td><span class="item-name">Package base</span><span class="item-note">Garden reception package</span></td>
      <td>Included</td>
      <td class="num">${pesos(BASE)}</td>
    </tr>
    <tr>
      <td><span class="item-name">Additional event setup</span><span class="item-note">Demonstration</span></td>
      <td>Addition</td>
      <td class="num">${signed(2500.5)}</td>
    </tr>
    <tr>
      <td><span class="item-name">Courtesy discount</span><span class="item-note">Demonstration</span></td>
      <td>Deduction</td>
      <td class="num deduct">${signed(-500.25)}</td>
    </tr>`;
}

function offerTable() {
  return `
    <table class="lines">
      <thead><tr><th>Item</th><th>Change</th><th class="num">Amount</th></tr></thead>
      <tbody>${sentRows()}</tbody>
    </table>
    <div class="total-line">
      <div>
        <p class="lede">Offer total</p>
        <p class="fine">${pesos(BASE)} + ${pesos(2500.5)} − ${pesos(500.25)}</p>
      </div>
      <strong>${pesos(192500.25)}</strong>
    </div>
    <p class="fine">Accepting this offer does not confirm the booking or reserve the date.</p>`;
}

function revisionBox() {
  return `
    <section class="stack">
      <div>
        <h2>Revise this offer</h2>
        <p class="lede">Starting a revision replaces version 2. The customer has to accept the new version.</p>
      </div>
      <label class="field"><span>Reason for the revision</span>
        <textarea class="control" data-revision maxlength="500" placeholder="What should the customer review?">${escape(state.revisionReason)}</textarea>
      </label>
      <div class="actions">
        <button class="button secondary" type="button" data-action="cancel-revision">Cancel</button>
        <button class="button" type="button" data-action="start-revision" ${state.revisionReason.trim() ? "" : "disabled"}>Start revision</button>
      </div>
    </section>`;
}

function historyBlock() {
  return `
    <section class="history">
      <h2>Earlier versions</h2>
      <button class="history-item" type="button" data-action="history" aria-expanded="${state.historyOpen}">
        <span><strong>Version 1 · Superseded</strong><span>Sent Nov 11, 2026, 5:42 PM</span></span>
        <b>${pesos(192500.25)}</b>
      </button>
      ${state.historyOpen ? `<div class="history-body">${offerTable()}</div>` : ""}
    </section>`;
}

function sentOffer(title = "Version 2") {
  return `
    <section class="stack">
      <div class="offer-head">
        <div>
          <h2>${title}</h2>
          <div class="offer-meta">
            <p>Sent Nov 11, 2026, 5:43 PM</p>
            <p>Revision note: Please review the revised offer (demonstration).</p>
          </div>
        </div>
        <span class="badge badge-info">Sent</span>
      </div>
      ${offerTable()}
      ${state.showRevision ? revisionBox() : `<div class="actions"><button class="button" type="button" data-action="revise">Revise this offer</button></div>`}
    </section>`;
}

function mathBox() {
  const figures = totals();
  return `
    <div class="math" aria-live="polite">
      <div><span>Package base</span><span>${pesos(BASE)}</span></div>
      <div><span>Additions</span><span data-additions>${signed(figures.additions)}</span></div>
      <div><span>Deductions</span><span class="deduct" data-deductions>${signed(-figures.deductions)}</span></div>
      <div class="grand"><span>Offer total</span><span data-total>${pesos(figures.total)}</span></div>
    </div>
    ${figures.total < 0 ? `<p class="warn" data-negative>The total is below zero. Raise an amount or remove a deduction before sending.</p>` : `<p class="warn" data-negative hidden>The total is below zero. Raise an amount or remove a deduction before sending.</p>`}`;
}

function adjustmentCard(line, index) {
  return `
    <article class="adjustment">
      <div class="row">
        <strong>Adjustment ${index + 1}</strong>
        <button class="button link small" type="button" data-action="remove" data-id="${line.id}">Remove</button>
      </div>
      <div class="fields">
        <label class="field wide"><span>Description</span>
          <input class="control" data-field="description" data-id="${line.id}" maxlength="160" value="${escape(line.description)}" />
        </label>
        <label class="field"><span>Effect on the total</span>
          <select class="control" data-field="direction" data-id="${line.id}">
            <option value="add" ${line.direction === "add" ? "selected" : ""}>Adds to the total</option>
            <option value="deduct" ${line.direction === "deduct" ? "selected" : ""}>Takes off the total</option>
          </select>
        </label>
        <label class="field"><span>Change type</span>
          <select class="control" data-field="kind" data-id="${line.id}">
            ${kinds.map(([value, label]) => `<option value="${value}" ${line.kind === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>Related service</span>
          <select class="control" data-field="service" data-id="${line.id}">
            ${services.map((service) => `<option value="${escape(service)}" ${line.service === service ? "selected" : ""}>${service || "None"}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>Amount (PHP)</span>
          <input class="control" data-field="amount" data-id="${line.id}" inputmode="decimal" value="${escape(line.amount)}" />
        </label>
      </div>
    </article>`;
}

function editor() {
  const figures = totals();
  return `
    <section class="stack">
      <div class="offer-head">
        <div>
          <h2>Version 2</h2>
          <div class="offer-meta">
            <p>Draft revision of version 1.</p>
            <p>Review the adjustments and save. Nothing is sent until you choose Save and send.</p>
          </div>
        </div>
        <span class="badge badge-warning">Draft</span>
      </div>
      <p class="lede">Package base stays ${pesos(BASE)}. Each adjustment below is added to it or taken off it.</p>
      <div>${state.lines.map(adjustmentCard).join("")}</div>
      <div class="actions" style="justify-content: flex-start">
        <button class="button secondary" type="button" data-action="add">Add adjustment</button>
      </div>
      ${mathBox()}
      <p class="fine">Accepting this offer does not confirm the booking or reserve the date.</p>
      <div class="actions">
        <button class="button secondary" type="button" data-action="save">Save adjustments</button>
        <button class="button" type="button" data-action="send" ${figures.total < 0 ? "disabled" : ""}>Save and send</button>
      </div>
      <p class="fine" data-saved hidden>Saved in this sample only.</p>
    </section>`;
}

function emptyState() {
  return `
    <section class="empty">
      <h2>No quotation yet</h2>
      <p class="lede">Create a draft from the current package price. You can add adjustments before sending it.</p>
      <button class="button" type="button" data-action="create">Create draft</button>
    </section>`;
}

function supersededDocument() {
  return `
    <section class="stack">
      <div class="offer-head">
        <div>
          <h2>Version 1</h2>
          <div class="offer-meta"><p>Sent Nov 11, 2026, 5:42 PM. Replaced by version 2.</p></div>
        </div>
        <span class="badge badge-neutral">Superseded</span>
      </div>
      ${offerTable()}
    </section>`;
}

function sheet() {
  if (state.scene === "empty") return `<div class="panel">${emptyState()}</div>`;
  if (state.scene === "draft") {
    return `<div class="stack"><div class="panel">${editor()}</div><div class="panel">${historyBlock()}</div></div>`;
  }
  return `<div class="stack"><div class="panel">${sentOffer()}</div><div class="panel">${historyBlock()}</div></div>`;
}

function split() {
  if (state.scene === "empty") return `<div class="panel">${emptyState()}</div>`;
  const draft = state.scene === "draft";
  const versions = draft
    ? [{ version: 2, title: "Version 2", detail: `Draft · ${pesos(totals().total)}` }, { version: 1, title: "Version 1", detail: `Superseded · ${pesos(192500.25)}` }]
    : [{ version: 2, title: "Version 2", detail: `Sent · ${pesos(192500.25)}` }, { version: 1, title: "Version 1", detail: `Superseded · ${pesos(192500.25)}` }];
  const body = state.selectedVersion === 1 ? supersededDocument() : draft ? editor() : sentOffer();
  return `
    <div class="split">
      <div class="version-list" role="listbox" aria-label="Quotation versions">
        ${versions.map((item) => `<button class="version ${state.selectedVersion === item.version ? "selected" : ""}" type="button" role="option" aria-selected="${state.selectedVersion === item.version}" data-action="version" data-version="${item.version}"><strong>${item.title}</strong><small>${item.detail}</small></button>`).join("")}
      </div>
      <div class="panel">${body}</div>
    </div>`;
}

function summaryLines() {
  const rows = state.scene === "draft" ? state.lines : [
    { description: "Additional event setup", direction: "add", amount: "2500.50", kind: "addition" },
    { description: "Courtesy discount", direction: "deduct", amount: "500.25", kind: "deduction" },
  ];
  const figures = state.scene === "draft" ? totals() : { total: 192500.25 };
  const lineHtml = `
    <div class="summary-line"><div><b>Package base</b><span class="item-note">Garden reception package</span></div><b>${pesos(BASE)}</b></div>
    ${rows.map((line) => `<div class="summary-line"><div><b>${escape(line.description || "Untitled adjustment")}</b><span class="item-note">${line.direction === "deduct" ? "Takes off the total" : "Adds to the total"}</span></div><b class="${line.direction === "deduct" ? "deduct" : ""}">${signed(line.direction === "deduct" ? -money(line) : money(line))}</b></div>`).join("")}`;
  return { figures, lineHtml };
}

function summary() {
  if (state.scene === "empty") return `<div class="panel">${emptyState()}</div>`;
  const draft = state.scene === "draft";
  const { figures, lineHtml } = summaryLines();
  const status = draft ? `<span class="badge badge-warning">Draft</span>` : `<span class="badge badge-info">Sent</span>`;
  const intro = draft
    ? "Version 2 is a draft. Check the adjustments, then save or send."
    : "Version 2 was sent on Nov 11, 2026, 5:43 PM. The customer has not accepted it.";
  return `
    <div class="stack">
      <div class="panel stack">
        <div class="hero-total">
          <div>
            <p class="lede">Offer total · Version 2</p>
            <strong data-total>${pesos(figures.total)}</strong>
          </div>
          ${status}
        </div>
        <p class="lede">${intro}</p>
        ${draft ? "" : `<div>${lineHtml}</div>`}
        <p class="fine">Accepting this offer does not confirm the booking or reserve the date.</p>
        ${draft ? `<div>${state.lines.map(adjustmentCard).join("")}</div><div class="actions" style="justify-content:flex-start"><button class="button secondary" type="button" data-action="add">Add adjustment</button></div>${mathBox()}` : ""}
        <div class="actions">
          ${draft
            ? `<button class="button secondary" type="button" data-action="save">Save adjustments</button><button class="button" type="button" data-action="send" ${figures.total < 0 ? "disabled" : ""}>Save and send</button>`
            : state.showRevision ? "" : `<button class="button" type="button" data-action="revise">Revise this offer</button>`}
        </div>
        ${!draft && state.showRevision ? revisionBox() : ""}
        <p class="fine" data-saved hidden>Saved in this sample only.</p>
      </div>
      <div class="panel">${historyBlock()}</div>
    </div>`;
}

function detailsTab() {
  return `
    <div class="panel stack">
      <h2>Details stay on this page</h2>
      <p class="lede">Request details, the package, and event days stay in this tab. This sample only redesigns Quotation, and only inside booking details.</p>
    </div>`;
}

function render() {
  const layout = layouts.find((item) => item.id === state.layout);
  layoutLabel.textContent = layout.label;
  layoutHint.textContent = layout.hint;
  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.scene === state.scene));
  });
  document.querySelectorAll("[data-page-tab]").forEach((button) => {
    const selected = button.dataset.pageTab === state.pageTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute("aria-labelledby", state.pageTab === "details" ? "tab-details" : "tab-quotation");
  if (state.pageTab === "details") {
    panel.innerHTML = detailsTab();
    return;
  }
  panel.innerHTML = state.layout === "split" ? split() : state.layout === "summary" ? summary() : sheet();
  writeUrl();
}

function refreshMoney() {
  const figures = totals();
  document.querySelectorAll("[data-total]").forEach((node) => {
    node.textContent = pesos(figures.total);
  });
  document.querySelectorAll("[data-additions]").forEach((node) => {
    node.textContent = signed(figures.additions);
  });
  document.querySelectorAll("[data-deductions]").forEach((node) => {
    node.textContent = signed(-figures.deductions);
  });
  document.querySelectorAll("[data-line-amount]").forEach((node) => {
    const line = state.lines.find((item) => item.id === node.dataset.lineAmount);
    if (!line) return;
    node.textContent = signed(line.direction === "deduct" ? -money(line) : money(line));
    node.classList.toggle("deduct", line.direction === "deduct");
  });
  document.querySelectorAll("[data-negative]").forEach((node) => {
    node.hidden = figures.total >= 0;
  });
  const send = document.querySelector('[data-action="send"]');
  if (send) send.disabled = figures.total < 0;
  const version = document.querySelector('[data-version="2"] small');
  if (version && state.scene === "draft") version.textContent = `Draft · ${pesos(figures.total)}`;
}

panel.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (field) {
    const line = state.lines.find((item) => item.id === event.target.dataset.id);
    if (line) line[field] = event.target.value;
    if (field === "amount" || field === "direction") refreshMoney();
    return;
  }
  if (event.target.dataset.revision !== undefined) {
    state.revisionReason = event.target.value;
    const start = document.querySelector('[data-action="start-revision"]');
    if (start) start.disabled = !state.revisionReason.trim();
  }
});
panel.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const line = state.lines.find((item) => item.id === event.target.dataset.id);
  if (!line) return;
  line[field] = event.target.value;
  if (field === "direction" || field === "description") {
    render();
    return;
  }
  refreshMoney();
});

panel.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;
  if (action === "history") state.historyOpen = !state.historyOpen;
  if (action === "revise") state.showRevision = true;
  if (action === "cancel-revision") state.showRevision = false;
  if (action === "start-revision") {
    if (!state.revisionReason.trim()) return;
    state.scene = "draft";
    state.showRevision = false;
    state.selectedVersion = 2;
    state.lines = sampleLines();
  }
  if (action === "version") state.selectedVersion = Number(trigger.dataset.version);
  if (action === "add") {
    state.lines.push({ id: crypto.randomUUID(), description: "", direction: "add", kind: "adjustment", service: "", amount: "" });
  }
  if (action === "remove") state.lines = state.lines.filter((line) => line.id !== trigger.dataset.id);
  if (action === "create") {
    state.scene = "draft";
    state.lines = [];
    state.selectedVersion = 2;
  }
  if (action === "save" || action === "send") {
    const note = document.querySelector("[data-saved]");
    if (note) {
      note.hidden = false;
      note.textContent = action === "send" ? "Sample only: this would save, then send version 2 in the booking conversation." : "Sample only: adjustments would be saved on this draft.";
    }
    return;
  }
  render();
});

document.querySelector(".page-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-page-tab]");
  if (!tab) return;
  state.pageTab = tab.dataset.pageTab;
  render();
});
document.querySelector(".prototype-bar").addEventListener("click", (event) => {
  const scene = event.target.closest("[data-scene]");
  if (scene) {
    state.scene = scene.dataset.scene;
    state.showRevision = false;
    state.historyOpen = false;
    state.selectedVersion = 2;
    state.lines = sampleLines();
    state.pageTab = "quotation";
    render();
    return;
  }
  const cycle = event.target.closest("[data-cycle]");
  if (!cycle) return;
  const index = layouts.findIndex((layout) => layout.id === state.layout);
  state.layout = layouts[(index + Number(cycle.dataset.cycle) + layouts.length) % layouts.length].id;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const index = layouts.findIndex((layout) => layout.id === state.layout);
  state.layout = layouts[(index + (event.key === "ArrowRight" ? 1 : -1) + layouts.length) % layouts.length].id;
  render();
});

readUrl();
render();
