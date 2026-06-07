const db = window.PLAYER_DB || { players: {}, playerList: [], playerCount: 0 };

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsSection = document.getElementById('suggestionsSection');
const suggestions = document.getElementById('suggestions');
const resultSection = document.getElementById('resultSection');
const emptySection = document.getElementById('emptySection');
const playerName = document.getElementById('playerName');
const playerStats = document.getElementById('playerStats');
const lineupList = document.getElementById('lineupList');
const metaInfo = document.getElementById('metaInfo');

metaInfo.textContent = `${db.playerCount || 0} 名玩家 · ${db.updatedAt || '队伍数据'}`;

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

function findMatches(keyword) {
  const key = norm(keyword);
  if (!key) return [];

  const exact = db.playerList.filter(item => norm(item.name) === key);
  if (exact.length) return exact.slice(0, 20);

  const contains = db.playerList.filter(item => norm(item.name).includes(key));
  if (contains.length) return contains.slice(0, 20);

  return db.playerList
    .filter(item => [...key].every(ch => norm(item.name).includes(ch)))
    .slice(0, 20);
}

function renderSkills(skills) {
  const items = (skills || []).filter(Boolean);
  if (!items.length) return '<div class="skill-empty">未记录战法</div>';
  return `<ul class="skill-list">${items.map(skill => `<li>${escapeHtml(skill)}</li>`).join('')}</ul>`;
}

function slotCard(label, slot) {
  const red = slot?.red || '未记红度';
  const level = slot?.level || '未记等级';

  return `
    <div class="slot">
      <div class="slot-head">
        <span class="slot-label">${escapeHtml(label)}</span>
        <span class="slot-red">${escapeHtml(red)}</span>
      </div>
      <div class="general-name">${escapeHtml(slot?.name || '-')}</div>
      <div class="slot-level">${escapeHtml(level)}</div>
      ${renderSkills(slot?.skills || [])}
    </div>
  `;
}

function lineupCard(item, index) {
  const teamRed = item.teamRed ? `阵容红度：${escapeHtml(item.teamRed)}` : '阵容红度：未记录';
  return `
    <article class="lineup-card">
      <div class="lineup-head">
        <div>
          <div class="lineup-index">队伍 ${index + 1}</div>
          <h3>${escapeHtml(item.lineupText || '-')}</h3>
        </div>
        <div class="team-red">${teamRed}</div>
      </div>
      <div class="detail-grid">
        ${slotCard('大营', item.mainSlot)}
        ${slotCard('中军', item.middleSlot)}
        ${slotCard('前锋', item.frontSlot)}
      </div>
    </article>
  `;
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
    btn.type = 'button';
    btn.textContent = item.name;
    btn.addEventListener('click', () => renderPlayer(item.name));
    suggestions.appendChild(btn);
  });
  suggestionsSection.classList.remove('hidden');
}

function renderPlayer(name) {
  const player = db.players[name];
  if (!player) return;

  const lineups = player.lineups || [];
  playerName.textContent = player.name;
  playerStats.textContent = `${lineups.length} 套队伍`;
  lineupList.innerHTML = lineups.map((item, index) => lineupCard(item, index)).join('');

  resultSection.classList.remove('hidden');
  emptySection.classList.add('hidden');
  showSuggestions([]);
  searchInput.value = name;
}

function showEmpty(message) {
  resultSection.classList.add('hidden');
  emptySection.classList.remove('hidden');
  emptySection.textContent = message;
}

function search() {
  const keyword = searchInput.value.trim();
  if (!keyword) {
    showSuggestions([]);
    showEmpty('输入玩家名称后，下方会显示他的全部队伍。');
    return;
  }

  const matches = findMatches(keyword);
  if (!matches.length) {
    showSuggestions([]);
    showEmpty('没找到这个玩家。');
    return;
  }

  const exact = matches.find(item => norm(item.name) === norm(keyword));
  if (exact) {
    renderPlayer(exact.name);
    return;
  }

  if (matches.length === 1) {
    renderPlayer(matches[0].name);
    return;
  }

  resultSection.classList.add('hidden');
  emptySection.classList.remove('hidden');
  emptySection.textContent = '找到多个相近玩家，请选择一个。';
  showSuggestions(matches);
}

let inputTimer = null;
function scheduleSearch() {
  window.clearTimeout(inputTimer);
  inputTimer = window.setTimeout(search, 180);
}

searchBtn.addEventListener('click', search);
searchInput.addEventListener('input', scheduleSearch);
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    window.clearTimeout(inputTimer);
    search();
  }
});

showEmpty('输入玩家名称后，下方会显示他的全部队伍。');
