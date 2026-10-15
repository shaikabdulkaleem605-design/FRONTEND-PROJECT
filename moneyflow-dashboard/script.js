const KEY = "moneyflow-transactions-v1";
const $ = (selector) => document.querySelector(selector);

const seedTransactions = [
  { id: "seed-1", name: "Monthly salary", amount: 45000, type: "income", category: "Salary", date: dateOffset(-4) },
  { id: "seed-2", name: "Groceries", amount: 1850, type: "expense", category: "Food", date: dateOffset(-3) },
  { id: "seed-3", name: "Bus pass", amount: 650, type: "expense", category: "Transport", date: dateOffset(-2) },
  { id: "seed-4", name: "Online course", amount: 1200, type: "expense", category: "Education", date: dateOffset(-1) },
  { id: "seed-5", name: "Freelance work", amount: 5000, type: "income", category: "Other", date: dateOffset(0) }
];

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved : [...seedTransactions];
  } catch {
    return [...seedTransactions];
  }
}
let transactions = loadTransactions();
let cashflowChart;
let categoryChart;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(transactions)); }
  catch { $("#form-message").textContent = "Unable to save data in this browser."; }
}
function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}
function prettyDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function getTotals() {
  const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  return { income, expenses, balance: income - expenses };
}
function renderSummary() {
  const totals = getTotals();
  $("#income-total").textContent = money(totals.income);
  $("#expense-total").textContent = money(totals.expenses);
  $("#balance-total").textContent = money(totals.balance);
}
function renderTransactions() {
  const query = $("#search").value.trim().toLowerCase();
  const type = $("#type-filter").value;
  const filtered = transactions.filter(t =>
    (t.name.toLowerCase().includes(query) || t.category.toLowerCase().includes(query)) &&
    (type === "all" || t.type === type)
  ).sort((a, b) => b.date.localeCompare(a.date));

  $("#transaction-rows").innerHTML = filtered.map(t => `
    <tr>
      <td><div class="transaction-name"><span class="transaction-icon">${t.type === "income" ? "↗" : categoryIcon(t.category)}</span>${escapeText(t.name)}</div></td>
      <td><span class="category-tag">${escapeText(t.category)}</span></td>
      <td>${prettyDate(t.date)}</td>
      <td><span class="type-tag ${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td>
      <td class="right" style="font-weight:700;color:${t.type === "income" ? "#20b786" : "inherit"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</td>
      <td><button class="delete-btn" data-delete="${escapeText(t.id)}" aria-label="Delete ${escapeText(t.name)}">×</button></td>
    </tr>`).join("");
  $("#empty-state").classList.toggle("show", filtered.length === 0);

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      transactions = transactions.filter(t => t.id !== button.dataset.delete);
      save(); render();
    });
  });
}
function categoryIcon(category) {
  return ({ Food: "♨", Shopping: "◇", Transport: "↗", Bills: "▤", Salary: "₹", Education: "▣", Other: "•" })[category] || "•";
}
function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#20283a", padding: 10, cornerRadius: 8 } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#9aa3b3", font: { size: 10 } }, border: { display: false } },
      y: { beginAtZero: true, grid: { color: "#edf0f5", drawBorder: false }, ticks: { color: "#9aa3b3", font: { size: 9 }, callback: value => "₹" + Number(value).toLocaleString("en-IN") }, border: { display: false } }
    }
  };
}
function renderCharts() {
  if (!window.Chart) return; // Dashboard and transactions still work if the chart library is offline.
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-IN", { month: "short" }) });
  }
  const incomeByMonth = months.map(m => transactions.filter(t => t.type === "income" && t.date.startsWith(m.key)).reduce((s, t) => s + t.amount, 0));
  const expenseByMonth = months.map(m => transactions.filter(t => t.type === "expense" && t.date.startsWith(m.key)).reduce((s, t) => s + t.amount, 0));

  if (cashflowChart) cashflowChart.destroy();
  cashflowChart = new Chart($("#cashflow-chart"), {
    type: "line",
    data: { labels: months.map(m => m.label), datasets: [
      { label: "Income", data: incomeByMonth, borderColor: "#956313", backgroundColor: "#2785f7", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .38 },
      { label: "Expenses", data: expenseByMonth, borderColor: "#ff795d", backgroundColor: "#ff795d", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .38 }
    ]},
    options: { ...chartDefaults(), interaction: { intersect: false, mode: "index" } }
  });

  const categories = {};
  transactions.filter(t => t.type === "expense").forEach(t => categories[t.category] = (categories[t.category] || 0) + t.amount);
  const labels = Object.keys(categories);
  const palette = ["#2785f7", "#ffb703", "#ff795d", "#27b78a", "#9a7cf8", "#e76eb4", "#8b98aa"];
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart($("#category-chart"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map(label => categories[label]), backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderWidth: 0, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } } }
  });
  $("#category-legend").innerHTML = labels.map((label, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${escapeText(label)}</span>`).join("");
}
function render() {
  renderSummary();
  renderTransactions();
  renderCharts();
}
$("#transaction-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#tx-name").value.trim();
  const amount = Number($("#tx-amount").value);
  const type = $("#tx-type").value;
  const category = $("#tx-category").value;
  const date = $("#tx-date").value;
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    $("#form-message").textContent = "Please enter a name, valid amount, and date.";
    return;
  }
  transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, amount, type, category, date });
  save();
  $("#transaction-form").reset();
  $("#tx-date").value = dateOffset(0);
  $("#form-message").textContent = "Transaction saved successfully.";
  render();
});
$("#search").addEventListener("input", renderTransactions);
$("#type-filter").addEventListener("change", renderTransactions);
$("#jump-add").addEventListener("click", () => $("#add-transaction").scrollIntoView({ behavior: "smooth" }));
$("#theme-toggle").addEventListener("click", () => document.body.classList.toggle("dark"));
$(".collapse").addEventListener("click", () => {
  document.body.classList.toggle("collapsed");
  $(".collapse").textContent = document.body.classList.contains("collapsed") ? "«" : "»";
});
$("#today").textContent = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
$("#tx-date").value = dateOffset(0);
render();
