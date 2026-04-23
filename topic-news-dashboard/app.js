const sheetUrlInput = document.getElementById('sheetUrl');
const topicColumnSelect = document.getElementById('topicColumn');
const headlineColumnSelect = document.getElementById('headlineColumn');
const loadBtn = document.getElementById('loadBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const repeatedList = document.getElementById('repeatedList');
const topicBreakdown = document.getElementById('topicBreakdown');

let rows = [];
let topicChart;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#d92d20' : '#667085';
}

function parseSheetUrl(url) {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[?&]gid=(\d+)/);

  if (!idMatch) {
    throw new Error('Invalid Google Sheet URL.');
  }

  return {
    sheetId: idMatch[1],
    gid: gidMatch?.[1] ?? '0',
  };
}

function buildCsvUrl({ sheetId, gid }) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function fillColumnDropdowns(headers) {
  const createOptions = (selectEl) => {
    selectEl.innerHTML = '';
    headers.forEach((header) => {
      const option = document.createElement('option');
      option.value = header;
      option.textContent = header;
      selectEl.appendChild(option);
    });
  };

  createOptions(topicColumnSelect);
  createOptions(headlineColumnSelect);

  const defaultTopic = headers.find((h) => /topic|category/i.test(h));
  const defaultHeadline = headers.find((h) => /headline|news|title/i.test(h));

  if (defaultTopic) topicColumnSelect.value = defaultTopic;
  if (defaultHeadline) headlineColumnSelect.value = defaultHeadline;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function analyzeData() {
  const topicCol = topicColumnSelect.value;
  const headlineCol = headlineColumnSelect.value;

  if (!topicCol || !headlineCol) {
    setStatus('Topic aur Headline column select karein.', true);
    return;
  }

  const topicCounts = new Map();
  const headlineCounts = new Map();
  const topicHeadlineCounts = new Map();

  rows.forEach((row) => {
    const topic = normalizeText(row[topicCol]) || 'Unknown';
    const headline = normalizeText(row[headlineCol]);

    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);

    if (headline) {
      headlineCounts.set(headline, (headlineCounts.get(headline) || 0) + 1);

      if (!topicHeadlineCounts.has(topic)) topicHeadlineCounts.set(topic, new Map());
      const map = topicHeadlineCounts.get(topic);
      map.set(headline, (map.get(headline) || 0) + 1);
    }
  });

  renderTopicChart(topicCounts);
  renderRepeatedHeadlines(headlineCounts);
  renderTopicBreakdown(topicHeadlineCounts, topicCounts);

  setStatus(`Analysis complete: ${rows.length} rows processed.`);
}

function renderTopicChart(topicCounts) {
  const labels = [...topicCounts.keys()];
  const data = [...topicCounts.values()];

  if (topicChart) topicChart.destroy();

  topicChart = new Chart(document.getElementById('topicChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'News Count',
        data,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderRepeatedHeadlines(headlineCounts) {
  repeatedList.innerHTML = '';

  const repeated = [...headlineCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (!repeated.length) {
    repeatedList.innerHTML = '<li class="small">No repeated headlines found.</li>';
    return;
  }

  repeated.forEach(([headline, count]) => {
    const li = document.createElement('li');
    li.textContent = `${headline} (${count}x)`;
    repeatedList.appendChild(li);
  });
}

function renderTopicBreakdown(topicHeadlineCounts, topicCounts) {
  topicBreakdown.innerHTML = '';

  [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, total]) => {
      const box = document.createElement('div');
      box.className = 'topic-box';

      const heading = document.createElement('h3');
      heading.textContent = `${topic} — ${total} items`;
      box.appendChild(heading);

      const headlineMap = topicHeadlineCounts.get(topic) || new Map();
      const repeatedInTopic = [...headlineMap.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (!repeatedInTopic.length) {
        const p = document.createElement('p');
        p.className = 'small';
        p.textContent = 'No repeated headline in this topic.';
        box.appendChild(p);
      } else {
        const ul = document.createElement('ul');
        repeatedInTopic.forEach(([headline, count]) => {
          const li = document.createElement('li');
          li.textContent = `${headline} (${count}x)`;
          ul.appendChild(li);
        });
        box.appendChild(ul);
      }

      topicBreakdown.appendChild(box);
    });
}

loadBtn.addEventListener('click', async () => {
  const sheetUrl = sheetUrlInput.value.trim();
  if (!sheetUrl) {
    setStatus('Please enter a Google Sheet URL.', true);
    return;
  }

  try {
    setStatus('Loading sheet...');
    const parsed = parseSheetUrl(sheetUrl);
    const csvUrl = buildCsvUrl(parsed);

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Sheet fetch failed with status ${response.status}`);
    }

    const csv = await response.text();
    const parsedCsv = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsedCsv.errors.length) {
      throw new Error(parsedCsv.errors[0].message);
    }

    rows = parsedCsv.data;
    const headers = Object.keys(rows[0] || {});

    if (!headers.length) {
      throw new Error('No headers found in sheet.');
    }

    fillColumnDropdowns(headers);
    analyzeBtn.disabled = false;
    setStatus(`Loaded ${rows.length} rows. Select columns and click Analyze.`);
  } catch (error) {
    setStatus(
      `Error: ${error.message}. Ensure sheet is public (Anyone with link can view).`,
      true,
    );
    analyzeBtn.disabled = true;
  }
});

analyzeBtn.addEventListener('click', analyzeData);

sheetUrlInput.value =
  'https://docs.google.com/spreadsheets/d/1z-nCZkhs4C1P41oWihxRaIgffr_Zxu9JqGx3UpFVCAM/edit?gid=1504920450';
