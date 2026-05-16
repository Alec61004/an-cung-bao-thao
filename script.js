const API_URL = 'https://script.google.com/macros/s/AKfycbyvfUtPXq3OyZPrwSU5IXyFaYPuNOygsZIw3ngXgzegNK0WCEG5vCompVILov7oxWnGNg/exec';
let items = [];
let currentFilter = 'all';

async function loadItems() {
  try {
    const response = await fetch(API_URL);
    items = await response.json();
    renderItems(currentFilter);
  } catch (error) {
    console.error('Error loading items:', error);
    alert('Không tải được dữ liệu từ Google Sheet!');
  }
}

function renderItems(filter = 'all') {
  currentFilter = filter;
  const listElement = document.getElementById('wishlist');
  listElement.innerHTML = '';

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = [...document.querySelectorAll('.filter-btn')].find(btn => btn.getAttribute('onclick') === `filterItems('${filter}')`);
  if (activeBtn) activeBtn.classList.add('active');

  const filteredItems = filter === 'all' ? items : items.filter(i => (i.category || i.type) === filter);

  if (filteredItems.length === 0) {
    listElement.innerHTML = `<p class="text-center text-gray-500 mt-10 italic"> Vợ và Chòn cùng nhau thêm vào đây những điều tuyệt vời nhé my love ❤️</p>`;
    return;
  }

  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'glass-card p-5 shadow-md flex justify-between items-center hover:shadow-lg transition-all';
    const imageUrl = getIllustrationUrl(item);
    card.innerHTML = `
      <div class="flex items-center gap-4 min-w-0">
        <img class="item-photo shrink-0" src="${imageUrl}" alt="Ảnh minh họa ${esc(item.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <div class="text-3xl shrink-0 item-fallback" style="display:none">${getCategoryEmoji(item.category || item.type)}</div>
        <div class="min-w-0">
          <h3 class="font-bold text-gray-800 text-lg">${esc(item.name)}</h3>
          ${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener" class="text-pink-500 text-sm break-all">${esc(item.link)}</a>` : ''}
          ${item.note ? `<p class="text-gray-500 text-xs mt-1">${esc(item.note)}</p>` : ''}
        </div>
      </div>
      <button onclick="removeItem('${item.id}')" class="text-red-400 hover:text-red-600 p-2 shrink-0">✕</button>
    `;
    listElement.appendChild(card);
  });
}

async function addItem() {
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const link = document.getElementById('itemLink').value.trim();
  const note = document.getElementById('itemNote').value.trim();

  if (!name) {
    alert('Bạn ơi, nhập tên món ăn hoặc địa điểm đã nhé! ❤️');
    return;
  }

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'add',
        id: Date.now().toString(),
        name,
        category,
        type: category,
        link,
        note
      })
    });
    document.getElementById('itemName').value = '';
    document.getElementById('itemLink').value = '';
    document.getElementById('itemNote').value = '';
    await loadItems();
  } catch (error) {
    console.error(error);
    alert('Có lỗi xảy ra khi thêm món!');
  }
}

async function removeItem(id) {
  if (!confirm('Xóa món này khỏi danh sách nhé?')) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id })
    });
    await loadItems();
  } catch (error) {
    console.error(error);
    alert('Không thể xóa món này!');
  }
}

function getIllustrationUrl(item) {
  const keyword = buildImageKeyword(item);
  const lock = Math.abs(hashCode(`${item.id || ''}-${item.name || ''}`)) % 1000;
  return `https://loremflickr.com/160/160/${encodeURIComponent(keyword)}?lock=${lock}`;
}

function buildImageKeyword(item) {
  const rawName = removeVietnameseTones(String(item.name || '').toLowerCase());
  const category = item.category || item.type || 'food';

  const known = [
    ['banh trang', 'vietnamese rice paper snack'],
    ['tra sua', 'bubble tea'],
    ['milk tea', 'bubble tea'],
    ['cafe', 'coffee shop'],
    ['ca phe', 'coffee shop'],
    ['coffee', 'coffee shop'],
    ['pho', 'vietnamese pho noodle soup'],
    ['bun bo', 'vietnamese beef noodle soup'],
    ['bun dau', 'vietnamese food'],
    ['com tam', 'vietnamese broken rice'],
    ['lau', 'hot pot'],
    ['pizza', 'pizza'],
    ['burger', 'burger'],
    ['sushi', 'sushi'],
    ['kem', 'ice cream'],
    ['banh mi', 'vietnamese sandwich'],
  ];

  const match = known.find(([key]) => rawName.includes(key));
  if (match) return match[1];

  const fallback = {
    food: 'vietnamese food',
    cafe: 'coffee shop',
    play: 'fun place',
    travel: 'romantic travel'
  };
  return fallback[category] || 'food';
}

function removeVietnameseTones(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getCategoryEmoji(cat) {
  const emojis = { food: '🍔', cafe: '☕', play: '🎡', travel: '✈️' };
  return emojis[cat] || '✨';
}

function filterItems(category) {
  renderItems(category);
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function pickRandom() {
  if (items.length === 0) {
    alert('Chưa có món nào để random 😅');
    return;
  }
  const pool = currentFilter === 'all' ? items : items.filter(i => (i.category || i.type) === currentFilter);
  const source = pool.length ? pool : items;
  const item = source[Math.floor(Math.random() * source.length)];
  const dialog = document.getElementById('randomDialog');
  const nameEl = document.getElementById('randomName');
  const linkEl = document.getElementById('randomLink');
  nameEl.textContent = item.name;
  if (item.link) {
    linkEl.style.display = 'block';
    linkEl.href = item.link;
    linkEl.textContent = 'Mở link / Maps ↗';
  } else {
    linkEl.style.display = 'none';
  }
  dialog.showModal();
}

document.getElementById('randomBtn').addEventListener('click', pickRandom);
document.getElementById('randomAgain').addEventListener('click', pickRandom);
document.getElementById('closeDialog').addEventListener('click', () => document.getElementById('randomDialog').close());

loadItems();
