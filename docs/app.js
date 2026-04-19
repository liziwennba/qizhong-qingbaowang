const LOCAL_DB_KEY = 'team_lookup_player_db_v2';
const db = loadInitialDb();
let currentPlayerName = '';
let backendSaveAvailable = true;
let serverInfo = null;

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsSection = document.getElementById('suggestionsSection');
const suggestions = document.getElementById('suggestions');
const resultSection = document.getElementById('resultSection');
const emptySection = document.getElementById('emptySection');
const playerName = document.getElementById('playerName');
const playerStats = document.getElementById('playerStats');
const latestCard = document.getElementById('latestCard');
const lineupList = document.getElementById('lineupList');
const recentList = document.getElementById('recentList');
const metaInfo = document.getElementById('metaInfo');
const saveModeInfo = document.getElementById('saveModeInfo');
const statusMessage = document.getElementById('statusMessage');
const editorSection = document.getElementById('editorSection');
const addLineupForm = document.getElementById('addLineupForm');
const formPlayerName = document.getElementById('formPlayerName');
const formTime = document.getElementById('formTime');
const formRecordType = document.getElementById('formRecordType');
const formTeamRed = document.getElementById('formTeamRed');
const resetFormBtn = document.getElementById('resetFormBtn');
const saveToFileBtn = document.getElementById('saveToFileBtn');
const saveAndPushBtn = document.getElementById('saveAndPushBtn');
const exportBtn = document.getElementById('exportBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');

metaInfo.textContent = `共 ${db.playerCount} 名玩家 · ${db.updatedAt}`;
refreshSaveModeText();

function loadInitialDb() {
  const baseDb = JSON.parse(JSON.stringify(window.PLAYER_DB || {}));
  try {
    const saved = localStorage.getItem(LOCAL_DB_KEY);
    if (!saved) return baseDb;
    const parsed = JSON.parse(saved);
    if (parsed && parsed.players && parsed.playerList) {
      return parsed;
    }
  } catch (error) {
    console.warn('读取本地保存失败', error);
  }
  return baseDb;
}

function refreshSaveModeText() {
  if (!backendSaveAvailable) {
    saveModeInfo.textContent = '当前模式：未检测到保存服务，新增内容会先保存在当前浏览器本地；请导出并覆盖 docs/player-data.js。';
    return;
  }
  if (serverInfo && serverInfo.gitRepo && serverInfo.gitRemoteConfigured) {
    saveModeInfo.textContent = `当前模式：本地保存服务已连接，可写回文件；Git 推送目标为 ${serverInfo.gitRemote}/${serverInfo.gitBranch}。`;
    return;
  }
  saveModeInfo.textContent = '当前模式：本地保存服务已连接，可直接写回文件；但当前目录未检测到可用 Git 远程推送。';
}

function norm(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseSkills(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function formatDateTimeLocalValue(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimeText(localValue) {
  if (!localValue) return '';
  const value = String(localValue).trim();
  if (!value) return '';
  if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  const pad = num => String(num).padStart(2, '0');
  return `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function sortKeyTime(text) {
  const parsed = Date.parse(String(text || '').replace(/\//g, '-'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function lineupTextFromSlots(mainSlot, middleSlot, frontSlot) {
  return [mainSlot?.name || '-', middleSlot?.name || '-', frontSlot?.name || '-'].join(' / ');
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function saveDbToLocalStorage() {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

async function fetchServerInfo() {
  try {
    const response = await fetch('/api/server-info', { cache: 'no-store' });
    if (!response.ok) throw new Error(`状态码 ${response.status}`);
    serverInfo = await response.json();
    backendSaveAvailable = !!serverInfo.backendSaveAvailable;
  } catch (error) {
    backendSaveAvailable = false;
    serverInfo = null;
  }
  refreshSaveModeText();
}

function showStatus(message, mode = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${mode}`;
  statusMessage.classList.remove('hidden');
}

function renderSkills(skills) {
  if (!skills || !skills.length) return '<div class="skill-empty">未记录技能</div>';
  return `<ul class="skill-list">${skills.map(skill => `<li>${escapeHtml(skill)}</li>`).join('')}</ul>`;
}

function slotCard(label, slot) {
  const metaBits = [slot?.red, slot?.level].filter(Boolean);
  const meta = metaBits.length
    ? metaBits.map(item => `<span class="mini-tag">${escapeHtml(item)}</span>`).join('')
    : '<span class="mini-tag">未记录</span>';
  return `
    <div class="slot">
      <div class="slot-top">
        <span class="slot-label">${escapeHtml(label)}</span>
        <div class="slot-meta">${meta}</div>
      </div>
      <div class="general-name">${escapeHtml(slot?.name || '-')}</div>
      <div class="skill-title">技能</div>
      ${renderSkills(slot?.skills || [])}
    </div>
  `;
}

function lineupCard(item, isLatest = false) {
  const types = (item.recordTypes || []).join('、') || '未知';
  const teamRedTag = item.teamRed ? `<div class="tag">阵容红度：${escapeHtml(item.teamRed)}</div>` : '';
  return `
    <div class="card">
      ${isLatest ? '<div class="latest-title">最新队伍</div>' : ''}
      <div class="lineup">${escapeHtml(item.lineupText)}</div>
      <div class="detail-grid">
        ${slotCard('大营', item.mainSlot)}
        ${slotCard('中军', item.middleSlot)}
        ${slotCard('前锋', item.frontSlot)}
      </div>
      <div class="info">
        ${teamRedTag}
        <div class="tag">出现 ${item.count} 次</div>
        <div class="tag">最近：${escapeHtml(item.latestTime || '-')}</div>
        <div class="tag">记录：${escapeHtml(types)}</div>
      </div>
    </div>
  `;
}

function recentRecordCard(item) {
  const teamRed = item.teamRed ? ` · 阵容红度 ${escapeHtml(item.teamRed)}` : '';
  return `
    <div class="row-card">
      <div class="recent-top">
        <strong>${escapeHtml(item.time || '-')}</strong>
        <span class="small">${escapeHtml(item.recordType || '未知记录')}${teamRed}</span>
      </div>
      <div class="recent-lineup">${escapeHtml(item.lineupText)}</div>
      <div class="recent-grid">
        <div class="recent-slot"><span>大营</span>${escapeHtml(item.mainSlot?.name || '-')} · ${escapeHtml(item.mainSlot?.red || '未记红度')} · ${escapeHtml(item.mainSlot?.level || '未记等级')}</div>
        <div class="recent-slot"><span>中军</span>${escapeHtml(item.middleSlot?.name || '-')} · ${escapeHtml(item.middleSlot?.red || '未记红度')} · ${escapeHtml(item.middleSlot?.level || '未记等级')}</div>
        <div class="recent-slot"><span>前锋</span>${escapeHtml(item.frontSlot?.name || '-')} · ${escapeHtml(item.frontSlot?.red || '未记红度')} · ${escapeHtml(item.frontSlot?.level || '未记等级')}</div>
      </div>
    </div>
  `;
}

function findMatches(keyword) {
  const key = norm(keyword);
  if (!key) return [];
  const exact = db.playerList.filter(item => norm(item.name) === key);
  if (exact.length) return exact.slice(0, 20);
  const contains = db.playerList.filter(item => norm(item.name).includes(key));
  if (contains.length) return contains.slice(0, 20);
  const fuzzy = db.playerList.filter(item => {
    const n = norm(item.name);
    return [...key].every(ch => n.includes(ch));
  });
  return fuzzy.slice(0, 20);
}

function showSuggestions(items) {
  suggestions.innerHTML = '';
  if (!items.length) {
    suggestionsSection.classList.add('hidden');
    return;
  }
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = item.name;
    btn.onclick = () => renderPlayer(item.name);
    suggestions.appendChild(btn);
  });
  suggestionsSection.classList.remove('hidden');
}

function rebuildPlayerFromRecentRecords(player) {
  const recs = clone(player.recentRecords || []).sort((a, b) => sortKeyTime(b.time) - sortKeyTime(a.time));
  const grouped = new Map();

  recs.forEach(r => {
    const key = JSON.stringify([
      r.mainSlot?.name || '', r.mainSlot?.red || '', r.mainSlot?.level || '', r.mainSlot?.skills || [],
      r.middleSlot?.name || '', r.middleSlot?.red || '', r.middleSlot?.level || '', r.middleSlot?.skills || [],
      r.frontSlot?.name || '', r.frontSlot?.red || '', r.frontSlot?.level || '', r.frontSlot?.skills || [],
    ]);

    if (!grouped.has(key)) {
      grouped.set(key, {
        lineupText: r.lineupText,
        main: r.mainSlot?.name || '',
        middle: r.middleSlot?.name || '',
        front: r.frontSlot?.name || '',
        mainSlot: clone(r.mainSlot || {}),
        middleSlot: clone(r.middleSlot || {}),
        frontSlot: clone(r.frontSlot || {}),
        teamRed: r.teamRed || '',
        count: 0,
        latestTime: r.time || '',
        recordTypes: [],
      });
    }

    const group = grouped.get(key);
    group.count += 1;
    if (r.recordType && !group.recordTypes.includes(r.recordType)) {
      group.recordTypes.push(r.recordType);
    }
    if (sortKeyTime(r.time) > sortKeyTime(group.latestTime)) {
      group.latestTime = r.time;
      group.teamRed = r.teamRed || '';
    }
  });

  const lineups = [...grouped.values()].sort((a, b) => sortKeyTime(b.latestTime) - sortKeyTime(a.latestTime));
  player.recentRecords = recs.slice(0, 50);
  player.lineups = lineups;
  player.totalRecords = recs.length;
  player.lineupCount = lineups.length;
  player.latestLineup = lineups[0] || null;
}

function rebuildPlayerList() {
  db.playerList = Object.values(db.players)
    .map(player => ({
      name: player.name,
      totalRecords: player.totalRecords,
      lineupCount: player.lineupCount,
      latestLineupText: player.latestLineup?.lineupText || '',
    }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  db.playerCount = db.playerList.length;
}

function setFormPlayer(name) {
  currentPlayerName = name;
  formPlayerName.value = name;
  formTime.value = formatDateTimeLocalValue(new Date());
  editorSection.classList.remove('hidden');
}

function renderPlayer(name) {
  const player = db.players[name];
  if (!player) return;
  currentPlayerName = name;
  const latest = player.latestLineup || player.lineups[0];
  playerName.textContent = player.name;
  playerStats.textContent = `共 ${player.totalRecords} 条记录 · ${player.lineupCount} 套不同配置`;
  latestCard.innerHTML = latest ? lineupCard(latest, true) : '';
  lineupList.innerHTML = player.lineups.map(item => lineupCard(item, false)).join('');
  recentList.innerHTML = player.recentRecords.map(item => recentRecordCard(item)).join('');
  resultSection.classList.remove('hidden');
  emptySection.classList.add('hidden');
  showSuggestions([]);
  searchInput.value = name;
  setFormPlayer(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function search() {
  const keyword = searchInput.value;
  const items = findMatches(keyword);
  if (!items.length) {
    resultSection.classList.add('hidden');
    emptySection.classList.remove('hidden');
    editorSection.classList.add('hidden');
    emptySection.innerHTML = '<p>没找到这个名字。可以换个写法，或者少输几个字试试。</p>';
    showSuggestions([]);
    return;
  }
  const exact = items.find(item => norm(item.name) === norm(keyword));
  if (exact) {
    renderPlayer(exact.name);
    return;
  }
  if (items.length === 1) {
    renderPlayer(items[0].name);
    return;
  }
  resultSection.classList.add('hidden');
  editorSection.classList.add('hidden');
  emptySection.classList.remove('hidden');
  emptySection.innerHTML = '<p>找到多个相近名字，请点一个进入。</p>';
  showSuggestions(items);
}

function buildSlot(prefix) {
  return {
    name: document.getElementById(`${prefix}Name`).value.trim(),
    red: document.getElementById(`${prefix}Red`).value.trim(),
    level: document.getElementById(`${prefix}Level`).value.trim(),
    skills: parseSkills(document.getElementById(`${prefix}Skills`).value),
  };
}

function resetEditor(keepPlayer = true) {
  addLineupForm.reset();
  formPlayerName.value = keepPlayer ? currentPlayerName : '';
  formRecordType.value = '手动补录';
  formTime.value = formatDateTimeLocalValue(new Date());
}

function addLineupToCurrentPlayer() {
  if (!currentPlayerName || !db.players[currentPlayerName]) {
    throw new Error('请先选定一个玩家。');
  }

  const mainSlot = buildSlot('main');
  const middleSlot = buildSlot('middle');
  const frontSlot = buildSlot('front');

  if (!mainSlot.name || !middleSlot.name || !frontSlot.name) {
    throw new Error('大营、中军、前锋武将名都要填写。');
  }

  const record = {
    time: formatDateTimeText(formTime.value),
    recordType: formRecordType.value.trim() || '手动补录',
    teamRed: formTeamRed.value.trim(),
    lineupText: lineupTextFromSlots(mainSlot, middleSlot, frontSlot),
    mainSlot,
    middleSlot,
    frontSlot,
  };

  const player = db.players[currentPlayerName];
  player.recentRecords = player.recentRecords || [];
  player.recentRecords.unshift(record);
  rebuildPlayerFromRecentRecords(player);
  rebuildPlayerList();
  db.updatedAt = `最后手动更新：${record.time || formatDateTimeText(new Date().toISOString())}`;
  metaInfo.textContent = `共 ${db.playerCount} 名玩家 · ${db.updatedAt}`;
  saveDbToLocalStorage();
  renderPlayer(currentPlayerName);
  resetEditor(true);
  showStatus('已添加到当前页面数据，并已保存在本浏览器本地。若要真正改文件，请点击“保存到文件”或“导出当前 player-data.js”。', 'success');
}

function buildPlayerDataJsContent() {
  return `window.PLAYER_DB = ${JSON.stringify(db, null, 0)};\n`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function saveToBackendFile(pushToGitHub = false) {
  try {
    const response = await fetch('/api/save-player-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db, pushToGitHub }),
    });

    if (!response.ok) {
      throw new Error(`保存失败，状态码 ${response.status}`);
    }

    const result = await response.json();
    backendSaveAvailable = true;
    refreshSaveModeText();
    if (result.git && result.git.ok && result.git.pushed) {
      showStatus(`已写回文件并推送到 GitHub。提交信息：${result.git.commitMessage}`, 'success');
      return;
    }
    if (result.git && !result.git.ok) {
      showStatus(`文件已保存，但推送 GitHub 失败：${result.git.error}`, 'warn');
      return;
    }
    if (result.git && result.git.ok && !result.git.pushed) {
      showStatus(`已写回文件。${result.git.message || ''}`, 'success');
      return;
    }
    showStatus(`已写回文件：${result.saved_to || 'docs/player-data.js'}，并同步生成 JSON 备份。`, 'success');
  } catch (error) {
    backendSaveAvailable = false;
    refreshSaveModeText();
    showStatus('当前页面无法直接写文件。你的新增内容已经保存在本地浏览器，请点击“导出当前 player-data.js”下载后手动覆盖 docs/player-data.js。', 'warn');
  }
}

searchBtn.addEventListener('click', search);
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') search();
});
resetFormBtn.addEventListener('click', () => resetEditor(true));
exportBtn.addEventListener('click', () => {
  downloadFile('player-data.js', buildPlayerDataJsContent(), 'application/javascript;charset=utf-8');
  showStatus('已导出当前 player-data.js。把它覆盖到 docs/player-data.js 即可永久保存。', 'success');
});
downloadJsonBtn.addEventListener('click', () => {
  downloadFile('player-data-backup.json', JSON.stringify(db, null, 2), 'application/json;charset=utf-8');
  showStatus('已导出 JSON 备份。', 'success');
});
saveToFileBtn.addEventListener('click', () => saveToBackendFile(false));
saveAndPushBtn.addEventListener('click', () => saveToBackendFile(true));
fetchServerInfo();
addLineupForm.addEventListener('submit', event => {
  event.preventDefault();
  try {
    addLineupToCurrentPlayer();
  } catch (error) {
    showStatus(error.message || '添加失败，请检查表单内容。', 'warn');
  }
});

resetEditor(false);
