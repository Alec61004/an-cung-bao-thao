const API_URL = 'https://script.google.com/macros/s/AKfycbyvfUtPXq3OyZPrwSU5IXyFaYPuNOygsZIw3ngXgzegNK0WCEG5vCompVILov7oxWnGNg/exec';
let items = [];

async function loadItems() {
  try {
    const response = await fetch(API_URL);
    items = await response.json();
    render();
  } catch (error) {
    console.error('Error loading items:', error);
    alert('Không tải được dữ liệu từ Google Sheet. Hãy kiểm tra lại quyền truy cập!');
  }
}

function render() {
  const list = document.getElementById('list');
  const empty = document.getElementById('emptyMsg');
  list.innerHTML = '';

  if (items.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="emoji">🍽️</div>
      <div class="info">
        <div class="name">${esc(item.name)}</div>
        ${item.link ? `<a class="link" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.link)}</a>` : '<span class="link" style="opacity:0.4">Chưa có link</span>'}
      </div>
      <button class="del" onclick="remove('${item.id}')">✕</button>
    `;
    list.appendChild(div);
  });
}

async function remove(id) {
  if (!confirm('Xóa món này nha?')) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id: id })
    });
    await loadItems();
  } catch (error) {
    console.error('Error deleting item:', error);
  }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

// Random
function pickRandom() {
  if (items.length === 0) {
    alert('Chưa có món nào để random 😅');
    return;
  }
  const item = items[Math.floor(Math.random() * items.length)];
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

// Form add
document.getElementById('addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('nameInput').value.trim();
  const link = document.getElementById('linkInput').value.trim();
  if (!name) return;

  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Đang thêm...';

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'add',
        id: Date.now().toString(),
        name: name,
        link: link
      })
    });
    document.getElementById('nameInput').value = '';
    document.getElementById('linkInput').value = '';
    await loadItems();
  } catch (error) {
    console.error('Error adding item:', error);
    alert('Có lỗi xảy ra khi thêm món!');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Thêm';
  }
});

loadItems();
