// static/insurance.js
const DEFAULT_WEIGHTS = {
  climate_safety: 30, insurance_affordability: 25, housing_affordability: 15,
  resilience: 10, social_resilience: 10, stability: 10
};

let currentWeights = { ...DEFAULT_WEIGHTS };
let rawCounties = [];

function calculateComposite(axes, weights) {
  let num = 0, den = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = axes[k];
    if (v !== null && v !== undefined && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? Math.round((num / den) * 10) / 10 : null;
}

function fmt1(val) {
  return (val === null || val === undefined) ? '—' : val.toFixed(1);
}

function renderTable() {
  const tbody = document.getElementById('rankingsBody');
  if (!tbody) return;

  const processed = rawCounties.map(c => {
    const comp = calculateComposite(c.axes, currentWeights);
    return { ...c, composite: comp };
  }).filter(c => c.composite !== null);

  processed.sort((a, b) => b.composite - a.composite);
  const top100 = processed.slice(0, 100);
  
  let html = '';
  top100.forEach((c, index) => {
    html += `<tr>
      <td>${index + 1}</td>
      <td><a href="/counties/${c.slug}.html">${c.county_name}, ${c.state_abbr}</a></td>
      <td><strong>${c.composite}</strong></td>
      <td>${fmt1(c.axes.climate_safety)}</td>
      <td>${fmt1(c.axes.insurance_affordability)}</td>
      <td>${fmt1(c.axes.housing_affordability)}</td>
      <td>${fmt1(c.axes.resilience)}</td>
      <td>${fmt1(c.axes.social_resilience)}</td>
      <td>${fmt1(c.axes.stability)}</td>
    </tr>`;
  });
  tbody.innerHTML = html;

  const sum = Object.values(currentWeights).reduce((a, b) => a + b, 0);
  const noteEl = document.getElementById('weightSumNote');
  if (noteEl) noteEl.innerText = `Total: ${sum}%`;
}

function setWeightAndRebalance(changedAxis, newVal) {
  newVal = parseInt(newVal);
  if (isNaN(newVal)) newVal = 0;
  
  const axes = Object.keys(currentWeights);
  const otherAxes = axes.filter(a => a !== changedAxis);
  let otherSum = 0;
  otherAxes.forEach(a => otherSum += currentWeights[a]);

  currentWeights[changedAxis] = newVal;
  let remaining = 100 - newVal;

  if (otherSum === 0) {
    const share = Math.floor(remaining / otherAxes.length);
    otherAxes.forEach(a => currentWeights[a] = share);
    currentWeights[otherAxes[0]] += remaining - (share * otherAxes.length);
  } else {
    let distributed = 0;
    otherAxes.forEach((a, i) => {
      if (i === otherAxes.length - 1) {
        currentWeights[a] = remaining - distributed;
      } else {
        const scaled = Math.round((currentWeights[a] / otherSum) * remaining);
        currentWeights[a] = scaled;
        distributed += scaled;
      }
    });
  }
  updateSlidersUI();
  updateURL();
  renderTable();
}

function updateSlidersUI() {
  for (const [axis, val] of Object.entries(currentWeights)) {
    const slider = document.getElementById(`slider-${axis}`);
    const label = document.getElementById(`val-${axis}`);
    if (slider) slider.value = val;
    if (label) label.innerText = val + '%';
  }
}

function updateURL() {
  const wStr = Object.values(currentWeights).join(',');
  const url = new URL(window.location);
  url.searchParams.set('w', wStr);
  window.history.replaceState({}, '', url);
}

function applyPreset(presetName) {
  const presets = {
    balanced: { climate_safety: 30, insurance_affordability: 25, housing_affordability: 15, resilience: 10, social_resilience: 10, stability: 10 },
    climate:  { climate_safety: 50, insurance_affordability: 20, housing_affordability: 10, resilience: 10, social_resilience: 5,  stability: 5 },
    budget:   { climate_safety: 20, insurance_affordability: 40, housing_affordability: 30, resilience: 5,  social_resilience: 0,  stability: 5 }
  };
  if (presets[presetName]) {
    currentWeights = { ...presets[presetName] };
    updateSlidersUI();
    updateURL();
    renderTable();
  }
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const wParam = urlParams.get('w');
  if (wParam) {
    const parts = wParam.split(',').map(Number);
    if (parts.length === 6 && parts.every(n => !isNaN(n))) {
      const keys = Object.keys(currentWeights);
      keys.forEach((k, i) => currentWeights[k] = parts[i]);
    }
  }
  updateSlidersUI();

  try {
    const res = await fetch('/static/counties_insurance.json');
    const data = await res.json();
    rawCounties = Object.values(data.counties);
    renderTable();
  } catch (e) {
    console.error("Failed to load data", e);
  }

  for (const axis of Object.keys(currentWeights)) {
    const slider = document.getElementById(`slider-${axis}`);
    if (slider) {
      slider.addEventListener('input', (e) => setWeightAndRebalance(axis, e.target.value));
    }
  }
}

document.addEventListener('DOMContentLoaded', init);