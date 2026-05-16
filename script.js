let items = JSON.parse(localStorage.getItem('an-cung-bao-thao')) || [];

function save() {
  localStorage.setItem('an-cung-bao-thao', JSON.stringify(items));
  render();
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
      <button class="del" onclick="remove(${i})">✕</button>
    `;
    list.appendChild(div);
  });
}

function remove(i) {
  items.splice(i, 1);
  save();
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

// ===== Random =====
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

// Add form

document.getElementById('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('nameInput').value.trim();
  const link = document.getElementById('linkInput').value.trim();
  if (!name) return;
  items.unshift({ name, link });
  save();
  document.getElementById('nameInput').value = '';
  document.getElementById('linkInput').value = '';
});

render();
