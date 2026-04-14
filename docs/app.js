
const db = window.PLAYER_DB;
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

metaInfo.textContent = `共 ${db.playerCount} 名玩家 · ${db.updatedAt}`;

function norm(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
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

function lineupCard(item, isLatest = false) {
  const types = (item.recordTypes || []).join('、') || '未知';
  return `
    <div class="card">
      ${isLatest ? '<div class="latest-title">最新队伍</div>' : ''}
      <div class="lineup">${item.lineupText}</div>
      <div class="grid3">
        <div class="slot"><span>大营</span>${item.main || '-'}</div>
        <div class="slot"><span>中军</span>${item.middle || '-'}</div>
        <div class="slot"><span>前锋</span>${item.front || '-'}</div>
      </div>
      <div class="info">
        <div class="tag">出现 ${item.count} 次</div>
        <div class="tag">最近：${item.latestTime || '-'}</div>
        <div class="tag">记录：${types}</div>
      </div>
    </div>
  `;
}

function renderPlayer(name) {
  const player = db.players[name];
  if (!player) return;
  const latest = player.latestLineup || player.lineups[0];
  playerName.textContent = player.name;
  playerStats.textContent = `共 ${player.totalRecords} 条记录 · ${player.lineupCount} 套不同队伍`;
  latestCard.innerHTML = latest ? lineupCard(latest, true) : '';
  lineupList.innerHTML = player.lineups.map(item => lineupCard(item, false)).join('');
  recentList.innerHTML = player.recentRecords.map(item => `
    <div class="row-card">
      <div><strong>${item.time || '-'}</strong></div>
      <div class="small">${item.recordType || '未知记录'}</div>
      <div style="margin-top:6px;">${item.lineupText}</div>
    </div>
  `).join('');
  resultSection.classList.remove('hidden');
  emptySection.classList.add('hidden');
  showSuggestions([]);
  searchInput.value = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function search() {
  const keyword = searchInput.value;
  const items = findMatches(keyword);
  if (!items.length) {
    resultSection.classList.add('hidden');
    emptySection.classList.remove('hidden');
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
  emptySection.classList.remove('hidden');
  emptySection.innerHTML = '<p>找到多个相近名字，请点一个进入。</p>';
  showSuggestions(items);
}

searchBtn.addEventListener('click', search);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') search();
});
