import './styles.css';
import { parseAlgorithm, algorithmToText, Algorithm } from './parser';
import { renderAlgorithm } from './renderer';
import {
  AliasEntry,
  applyAliases,
  normalizeForComparison,
  reverseAliases,
  setupLiveAliasing,
  getAliases,
  saveAliases,
  resetAliases,
  getDefaultAliases,
} from './aliases';
import { loadAlgorithms, saveAlgorithm, deleteAlgorithm, getAlgorithm } from './storage';
import { recognizeImage } from './ocr';
import { formatPseudoCode } from './formatter';
import {
  QuizMode,
  BlankSlot,
  LineDiff,
  generateBlanks,
  checkBlanks,
  checkReproduction,
  renderBlanksQuiz,
  renderReproductionResult,
} from './quiz';
import {
  recordAttempt,
  getOverallStats,
  getAllAlgoProgress,
  getSuggestions,
  getFrequentMistakes,
  resetStats,
  formatRelativeTime,
} from './stats';

let currentAlgoId: string | null = null;
let currentQuizMode: QuizMode = 'blanks';
let currentBlanks: BlankSlot[] = [];
let modalMode: 'text' | 'ocr' = 'text';
let showAliased = true;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function switchView(viewId: string) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $(viewId).classList.add('active');

  document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'));
  if (viewId === 'view-library') $('nav-library').classList.add('active');
  else if (viewId === 'view-algo') $('nav-view').classList.add('active');
  else if (viewId === 'view-quiz') $('nav-quiz').classList.add('active');
  else if (viewId === 'view-stats') $('nav-stats').classList.add('active');
}

function renderLibrary() {
  const algos = loadAlgorithms();
  const list = $('algo-list');

  if (algos.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Még nincs mentett algoritmus.</p>
        <p>Adj hozzá egyet szöveggel vagy képpel!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = algos
    .map(
      (a) => `
    <div class="algo-card" data-id="${a.id}">
      <div class="algo-card-info">
        <h3>${a.number ? a.number + ' ' : ''}${a.title}</h3>
        <p>${a.lines.length} sor</p>
      </div>
      <div class="algo-card-actions">
        <button class="btn" data-action="view" data-id="${a.id}">Megtekintés</button>
        <button class="btn" data-action="quiz" data-id="${a.id}">Gyakorlás</button>
        <button class="btn btn-danger" data-action="delete" data-id="${a.id}">Törlés</button>
      </div>
    </div>
  `
    )
    .join('');

  list.querySelectorAll('[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAlgoView((btn as HTMLElement).dataset.id!);
    });
  });

  list.querySelectorAll('[data-action="quiz"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openQuiz((btn as HTMLElement).dataset.id!);
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id!;
      if (confirm('Biztosan törlöd?')) {
        deleteAlgorithm(id);
        renderLibrary();
      }
    });
  });

  list.querySelectorAll('.algo-card').forEach((card) => {
    card.addEventListener('click', () => {
      openAlgoView((card as HTMLElement).dataset.id!);
    });
  });
}

function openAlgoView(id: string) {
  const algo = getAlgorithm(id);
  if (!algo) return;
  currentAlgoId = id;
  $('view-algo-title').textContent = `${algo.number} ${algo.title}`;
  renderAlgoWithAliasState(algo);
  $<HTMLDivElement>('algo-render').style.display = '';
  $<HTMLDivElement>('algo-edit').style.display = 'none';
  $('btn-edit-algo').textContent = 'Szerkesztés';
  updateAliasToggleButton();
  switchView('view-algo');
}

function renderAlgoWithAliasState(algo: Algorithm) {
  if (showAliased) {
    $('algo-render').innerHTML = renderAlgorithm(algo);
  } else {
    const text = algorithmToText(algo);
    const rawText = reverseAliases(text);
    const rawAlgo = parseAlgorithm(rawText);
    $('algo-render').innerHTML = renderAlgorithm(rawAlgo);
  }
}

function updateAliasToggleButton() {
  const btn = $('btn-toggle-alias');
  if (showAliased) {
    btn.textContent = '← ∧ ¬';
    btn.classList.add('active');
  } else {
    btn.textContent = '<- ^ !';
    btn.classList.remove('active');
  }
}

function toggleEditMode() {
  const renderDiv = $<HTMLDivElement>('algo-render');
  const editDiv = $<HTMLDivElement>('algo-edit');
  const btn = $('btn-edit-algo');

  if (editDiv.style.display === 'none') {
    const algo = currentAlgoId ? getAlgorithm(currentAlgoId) : null;
    if (!algo) return;
    $<HTMLTextAreaElement>('algo-edit-input').value = algorithmToText(algo);
    renderDiv.style.display = 'none';
    editDiv.style.display = '';
    btn.textContent = 'Megtekintés';
  } else {
    renderDiv.style.display = '';
    editDiv.style.display = 'none';
    btn.textContent = 'Szerkesztés';
  }
}

function saveEditedAlgo() {
  if (!currentAlgoId) return;
  const rawText = applyAliases($<HTMLTextAreaElement>('algo-edit-input').value.trim());
  if (!rawText) return;
  const algo = parseAlgorithm(rawText);
  algo.id = currentAlgoId;
  saveAlgorithm(algo);
  openAlgoView(currentAlgoId);
}

function openQuiz(id: string) {
  const algo = getAlgorithm(id);
  if (!algo) return;
  currentAlgoId = id;
  $('quiz-algo-title').textContent = `${algo.number} ${algo.title}`;
  $<HTMLDivElement>('quiz-setup').style.display = '';
  $<HTMLDivElement>('quiz-area').style.display = 'none';
  $<HTMLDivElement>('quiz-result-area').style.display = 'none';
  switchView('view-quiz');
}

function startQuiz() {
  if (!currentAlgoId) return;
  const algo = getAlgorithm(currentAlgoId);
  if (!algo) return;

  $<HTMLDivElement>('quiz-setup').style.display = 'none';
  $<HTMLDivElement>('quiz-area').style.display = '';
  $<HTMLDivElement>('quiz-result-area').style.display = 'none';
  $<HTMLButtonElement>('btn-retry').style.display = 'none';
  $<HTMLButtonElement>('btn-check').style.display = '';

  const content = $('quiz-content');

  if (currentQuizMode === 'blanks') {
    const difficulty = parseInt(($('difficulty') as HTMLInputElement).value) / 100;
    currentBlanks = generateBlanks(algo, difficulty);
    content.innerHTML = renderBlanksQuiz(algo, currentBlanks);
    $<HTMLDivElement>('alias-hint').style.display = '';

    content.querySelectorAll<HTMLInputElement>('.blank-input').forEach((input) => {
      setupLiveAliasing(input as unknown as HTMLTextAreaElement);
    });
  } else {
    content.innerHTML = `
      <div class="algo-header" style="margin-bottom:1rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;">
        <span class="algo-number">${algo.number}</span>
        <span class="algo-label">Algoritmus</span>
        <span class="algo-title">${algo.title}</span>
        ${algo.inputs ? `<div class="algo-io"><span class="token-keyword">Bemenet:</span> ${algo.inputs}</div>` : ''}
        ${algo.outputs ? `<div class="algo-io"><span class="token-keyword">Kimenet:</span> ${algo.outputs}</div>` : ''}
      </div>
      <textarea class="quiz-textarea" id="reproduce-input" placeholder="Írd le az algoritmust emlékezetből...&#10;&#10;Tipp: a sorszámokat nem kell kiírni, de az indentálás számít.&#10;Gyorsbillentyűk: <- → ←, ^ → ∧, ! → ¬" spellcheck="false"></textarea>
    `;
    $<HTMLDivElement>('alias-hint').style.display = '';
    const textarea = $<HTMLTextAreaElement>('reproduce-input');
    setupLiveAliasing(textarea);
    textarea.focus();
  }
}

function checkQuiz() {
  if (!currentAlgoId) return;
  const algo = getAlgorithm(currentAlgoId);
  if (!algo) return;

  if (currentQuizMode === 'blanks') {
    document.querySelectorAll<HTMLInputElement>('.blank-input').forEach((input) => {
      const idx = parseInt(input.dataset.blankIndex!);
      currentBlanks[idx].userAnswer = input.value;
    });

    const result = checkBlanks(currentBlanks);

    document.querySelectorAll<HTMLInputElement>('.blank-input').forEach((input) => {
      const idx = parseInt(input.dataset.blankIndex!);
      const blank = currentBlanks[idx];
      const isCorrect =
        normalizeForComparison(blank.userAnswer) ===
        normalizeForComparison(blank.answer);

      input.classList.add(isCorrect ? 'blank-correct' : 'blank-wrong');
      input.disabled = true;

      if (!isCorrect) {
        const hint = document.createElement('span');
        hint.className = 'diff-hint';
        hint.textContent = ` → ${blank.answer}`;
        input.parentElement!.insertBefore(hint, input.nextSibling);
      }
    });

    showScore(result.score, result.correctItems, result.totalItems);
    $<HTMLButtonElement>('btn-check').style.display = 'none';
    $<HTMLButtonElement>('btn-retry').style.display = '';

    const missedParts = currentBlanks
      .filter((b) => normalizeForComparison(b.answer) !== normalizeForComparison(b.userAnswer))
      .map((b) => b.answer);

    recordAttempt({
      algoId: currentAlgoId!,
      algoTitle: algo.title,
      algoNumber: algo.number,
      mode: 'blanks',
      score: result.score,
      totalItems: result.totalItems,
      correctItems: result.correctItems,
      missedParts,
    });
  } else {
    const userText = $<HTMLTextAreaElement>('reproduce-input').value;
    const result = checkReproduction(algo, userText);

    $<HTMLDivElement>('quiz-area').style.display = 'none';
    $<HTMLDivElement>('quiz-result-area').style.display = '';
    showScore(result.score, result.correctItems, result.totalItems);
    $('quiz-result-detail').innerHTML = renderReproductionResult(
      result.details as any
    );

    const missedParts = (result.details as LineDiff[])
      .filter((d) => d.status === 'wrong' || d.status === 'missing')
      .map((d) => d.expected);

    recordAttempt({
      algoId: currentAlgoId!,
      algoTitle: algo.title,
      algoNumber: algo.number,
      mode: 'reproduce',
      score: result.score,
      totalItems: result.totalItems,
      correctItems: result.correctItems,
      missedParts,
    });
  }
}

function showScore(score: number, correct: number, total: number) {
  const scoreClass = score === 100 ? 'score-perfect' : score >= 60 ? 'score-good' : 'score-poor';
  $('quiz-score').innerHTML = `
    <div class="score-value ${scoreClass}">${score}%</div>
    <div class="score-label">${correct} / ${total} helyes</div>
  `;
  $<HTMLDivElement>('quiz-score').style.display = '';
}

function openModal(mode: 'text' | 'ocr') {
  modalMode = mode;
  $<HTMLDivElement>('modal-add').style.display = 'flex';

  if (mode === 'text') {
    $('modal-title').textContent = 'Algoritmus hozzáadása — Szöveg';
    $<HTMLDivElement>('modal-text-input').style.display = '';
    $<HTMLDivElement>('modal-ocr-input').style.display = 'none';
    ($('algo-input') as HTMLTextAreaElement).value = '';
    ($('algo-input') as HTMLTextAreaElement).focus();
  } else {
    $('modal-title').textContent = 'Algoritmus hozzáadása — OCR';
    $<HTMLDivElement>('modal-text-input').style.display = 'none';
    $<HTMLDivElement>('modal-ocr-input').style.display = '';
    $<HTMLDivElement>('ocr-preview').style.display = 'none';
    $<HTMLDivElement>('ocr-progress').style.display = 'none';
    $<HTMLDivElement>('ocr-result').style.display = 'none';
  }
}

function closeModal() {
  $<HTMLDivElement>('modal-add').style.display = 'none';
}

function saveFromModal() {
  let rawText: string;

  if (modalMode === 'text') {
    rawText = ($('algo-input') as HTMLTextAreaElement).value.trim();
  } else {
    rawText = ($('ocr-text-output') as HTMLTextAreaElement).value.trim();
  }

  if (!rawText) return;

  rawText = applyAliases(rawText);
  const algo = parseAlgorithm(rawText);
  saveAlgorithm(algo);
  closeModal();
  renderLibrary();
}

async function handleOCRFile(file: File) {
  const preview = $('ocr-preview');
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  preview.innerHTML = '';
  preview.appendChild(img);
  preview.style.display = '';

  $<HTMLDivElement>('ocr-progress').style.display = '';
  $('ocr-status').textContent = 'Feldolgozás...';

  const text = await recognizeImage(file, (progress) => {
    $<HTMLDivElement>('ocr-progress-bar').style.width = `${progress}%`;
    $('ocr-status').textContent = `Feldolgozás... ${progress}%`;
  });

  $<HTMLDivElement>('ocr-progress').style.display = 'none';
  $<HTMLDivElement>('ocr-result').style.display = '';
  ($('ocr-text-output') as HTMLTextAreaElement).value = text;
}

function renderAliasTable(entries: AliasEntry[]) {
  const container = $('alias-table-container');
  let html = `<table class="alias-table">
    <thead><tr><th>Cél</th><th>Aliasok (vesszővel elválasztva)</th><th></th></tr></thead>
    <tbody>`;

  entries.forEach((entry, i) => {
    html += `<tr>
      <td><input class="alias-canonical" data-index="${i}" data-field="canonical" value="${entry.canonical}"></td>
      <td><input data-index="${i}" data-field="aliases" value="${entry.aliases.join(', ')}"></td>
      <td><button class="alias-remove" data-index="${i}" title="Törlés">×</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function readAliasTable(): AliasEntry[] {
  const rows = document.querySelectorAll<HTMLInputElement>('.alias-table input[data-field="canonical"]');
  const entries: AliasEntry[] = [];

  rows.forEach((canonInput) => {
    const i = canonInput.dataset.index!;
    const aliasInput = document.querySelector<HTMLInputElement>(
      `.alias-table input[data-index="${i}"][data-field="aliases"]`
    );
    const canonical = canonInput.value.trim();
    const aliases = aliasInput
      ? aliasInput.value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (canonical && aliases.length > 0) {
      entries.push({ canonical, aliases });
    }
  });

  return entries;
}

function scoreColorClass(score: number): string {
  if (score >= 90) return 'score-perfect';
  if (score >= 60) return 'score-good';
  return 'score-poor';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderStatsView() {
  const overall = getOverallStats();
  const progress = getAllAlgoProgress();
  const algos = loadAlgorithms();
  const suggestions = getSuggestions(
    algos.map((a) => ({ id: a.id, title: a.title, number: a.number }))
  );

  const content = $('stats-content');

  if (overall.totalAttempts === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <p>Még nincs statisztika.</p>
        <p>Kezdj el gyakorolni, és itt láthatod a haladásodat!</p>
      </div>
    `;
    return;
  }

  let html = '';

  html += `<div class="stats-summary">
    <div class="stat-card">
      <div class="stat-value">${overall.totalAttempts}</div>
      <div class="stat-label">Gyakorlás</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${scoreColorClass(overall.avgScore)}">${overall.avgScore}%</div>
      <div class="stat-label">Átlagos pontszám</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${overall.practicedCount}/${algos.length}</div>
      <div class="stat-label">Gyakorolt algoritmus</div>
    </div>
  </div>`;

  if (suggestions.length > 0) {
    html += `<div class="suggestions-section">
      <h3>Javaslatok</h3>
      <div class="suggestions-list">`;
    for (const s of suggestions.slice(0, 5)) {
      html += `<div class="suggestion-item">
        <div class="suggestion-info">
          <span class="suggestion-algo">${s.algoNumber} ${s.algoTitle}</span>
          <span class="suggestion-reason">${s.reason}</span>
        </div>
        <button class="btn btn-small" data-action="quiz-suggestion" data-algo-id="${s.algoId}">Gyakorlás</button>
      </div>`;
    }
    html += `</div></div>`;
  }

  if (progress.length > 0) {
    html += `<h3 class="stats-section-title">Algoritmusonkénti eredmények</h3>`;

    for (const prog of progress) {
      const trendIcon =
        prog.trend === 'improving'
          ? '↑'
          : prog.trend === 'declining'
            ? '↓'
            : '→';
      const trendClass =
        prog.trend === 'improving'
          ? 'trend-up'
          : prog.trend === 'declining'
            ? 'trend-down'
            : 'trend-stable';

      html += `<div class="algo-stat-card">
        <div class="algo-stat-header">
          <span class="algo-stat-title">${prog.algoNumber} ${prog.algoTitle}</span>
          <span class="trend-indicator ${trendClass}">${trendIcon}</span>
        </div>
        <div class="algo-stat-body">
          <div class="algo-stat-bar">
            <div class="score-bar">
              <div class="score-bar-fill ${scoreColorClass(prog.lastScore)}-bg" style="width:${prog.lastScore}%"></div>
            </div>
            <span class="score-label ${scoreColorClass(prog.lastScore)}">${prog.lastScore}%</span>
          </div>
          <div class="algo-stat-details">
            <span>Legjobb: ${prog.bestScore}%</span>
            <span>Átlag: ${prog.avgScore}%</span>
            <span>${prog.attempts}× gyakorolva</span>
            <span>${formatRelativeTime(prog.lastPracticed)}</span>
          </div>
          <div class="score-history">
            ${prog.recentScores.map((s) => `<div class="score-history-bar ${scoreColorClass(s)}-bg" style="height:${Math.max(10, s)}%" title="${s}%"></div>`).join('')}
          </div>
        </div>
      </div>`;
    }
  }

  const mistakes = getFrequentMistakes();
  if (mistakes.length > 0) {
    html += `<h3 class="stats-section-title">Gyakori hibák</h3>`;
    html += `<div class="mistakes-list">`;
    for (const m of mistakes) {
      html += `<div class="mistake-item">
        <code>${escapeHtml(m.text)}</code>
        <span class="mistake-count">${m.count}×</span>
      </div>`;
    }
    html += `</div>`;
  }

  content.innerHTML = html;

  content.querySelectorAll('[data-action="quiz-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openQuiz((btn as HTMLElement).dataset.algoId!);
    });
  });
}

let settingsSnapshot: AliasEntry[] = [];

function openSettings() {
  settingsSnapshot = structuredClone(getAliases());
  renderAliasTable(settingsSnapshot);
  $<HTMLDivElement>('modal-settings').style.display = 'flex';
}

function closeSettings() {
  $<HTMLDivElement>('modal-settings').style.display = 'none';
}

function init() {
  renderLibrary();

  $('nav-library').addEventListener('click', () => {
    renderLibrary();
    switchView('view-library');
  });
  $('nav-view').addEventListener('click', () => {
    if (currentAlgoId) openAlgoView(currentAlgoId);
    else switchView('view-library');
  });
  $('nav-quiz').addEventListener('click', () => {
    if (currentAlgoId) openQuiz(currentAlgoId);
    else switchView('view-library');
  });
  $('nav-stats').addEventListener('click', () => {
    renderStatsView();
    switchView('view-stats');
  });

  $('btn-back-view').addEventListener('click', () => {
    renderLibrary();
    switchView('view-library');
  });
  $('btn-edit-algo').addEventListener('click', toggleEditMode);
  $('btn-toggle-alias').addEventListener('click', () => {
    showAliased = !showAliased;
    updateAliasToggleButton();
    if (currentAlgoId) {
      const algo = getAlgorithm(currentAlgoId);
      if (algo) renderAlgoWithAliasState(algo);
    }
  });
  $('btn-cancel-edit').addEventListener('click', toggleEditMode);
  $('btn-save-edit').addEventListener('click', saveEditedAlgo);
  $('btn-format-edit').addEventListener('click', () => {
    const ta = $<HTMLTextAreaElement>('algo-edit-input');
    ta.value = formatPseudoCode(ta.value);
  });
  $('btn-back-quiz').addEventListener('click', () => {
    renderLibrary();
    switchView('view-library');
  });

  $('btn-add-text').addEventListener('click', () => openModal('text'));
  $('btn-add-ocr').addEventListener('click', () => openModal('ocr'));
  $('btn-modal-cancel').addEventListener('click', closeModal);
  $('btn-modal-save').addEventListener('click', saveFromModal);

  $<HTMLDivElement>('modal-add').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) closeModal();
  });

  setupLiveAliasing($('algo-input') as HTMLTextAreaElement);
  setupLiveAliasing($('ocr-text-output') as HTMLTextAreaElement);
  setupLiveAliasing($('algo-edit-input') as HTMLTextAreaElement);

  $('btn-format-text').addEventListener('click', () => {
    const ta = $<HTMLTextAreaElement>('algo-input');
    ta.value = formatPseudoCode(ta.value);
  });

  $('btn-format-ocr').addEventListener('click', () => {
    const ta = $<HTMLTextAreaElement>('ocr-text-output');
    ta.value = formatPseudoCode(ta.value);
  });

  document.querySelectorAll('.quiz-mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.quiz-mode-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      currentQuizMode = (card as HTMLElement).dataset.mode as QuizMode;

      $<HTMLDivElement>('difficulty-wrapper').style.display =
        currentQuizMode === 'blanks' ? '' : 'none';
    });
  });

  const diffSlider = $<HTMLInputElement>('difficulty');
  diffSlider.addEventListener('input', () => {
    $('difficulty-value').textContent = `${diffSlider.value}%`;
  });

  $('btn-start-quiz').addEventListener('click', startQuiz);
  $('btn-check').addEventListener('click', checkQuiz);
  $('btn-retry').addEventListener('click', startQuiz);
  $('btn-retry-result').addEventListener('click', startQuiz);
  $('btn-back-result').addEventListener('click', () => {
    renderLibrary();
    switchView('view-library');
  });

  // OCR file handling
  const dropZone = $('ocr-drop-zone');
  const fileInput = $<HTMLInputElement>('ocr-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) handleOCRFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) handleOCRFile(fileInput.files[0]);
  });

  // Export / Import
  $('btn-export').addEventListener('click', () => {
    const algos = loadAlgorithms();
    if (algos.length === 0) { alert('Nincs exportálható algoritmus.'); return; }
    const blob = new Blob([JSON.stringify(algos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pracudo-algoritmusok.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('btn-import').addEventListener('click', () => {
    $<HTMLInputElement>('import-file-input').click();
  });

  $<HTMLInputElement>('import-file-input').addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as Algorithm[];
        if (!Array.isArray(imported)) throw new Error('invalid');
        const existing = loadAlgorithms();
        const existingIds = new Set(existing.map((a) => a.id));
        let added = 0;
        for (const algo of imported) {
          if (!algo.lines || !algo.rawText) continue;
          if (existingIds.has(algo.id)) {
            algo.id = crypto.randomUUID();
          }
          saveAlgorithm(algo);
          added++;
        }
        alert(`${added} algoritmus importálva.`);
        renderLibrary();
      } catch {
        alert('Hibás fájlformátum.');
      }
      (e.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  });

  // Settings
  $('nav-settings').addEventListener('click', openSettings);
  $('btn-settings-cancel').addEventListener('click', closeSettings);
  $<HTMLDivElement>('modal-settings').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) closeSettings();
  });

  $('btn-settings-save').addEventListener('click', () => {
    saveAliases(readAliasTable());
    closeSettings();
  });

  $('btn-alias-reset').addEventListener('click', () => {
    resetAliases();
    renderAliasTable(getDefaultAliases());
  });

  $('btn-stats-reset').addEventListener('click', () => {
    if (confirm('Biztosan törlöd az összes statisztikát?')) {
      resetStats();
    }
  });

  $('btn-alias-add').addEventListener('click', () => {
    const current = readAliasTable();
    current.push({ canonical: '', aliases: [''] });
    renderAliasTable(current);
  });

  $('alias-table-container').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.alias-remove') as HTMLElement | null;
    if (btn) {
      const current = readAliasTable();
      const idx = parseInt(btn.dataset.index!);
      current.splice(idx, 1);
      renderAliasTable(current);
    }
  });
}

init();
