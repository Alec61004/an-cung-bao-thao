const API_URL = 'https://script.google.com/macros/s/AKfycbzSV2MCGp-sYrV5ZHHY1bf59fx6Edb9PgTZ80Y3vUOtQP3Y2tAoXsCIewpIDneGQFNj4Q/exec';
let items = [];
let currentFilter = 'all';
let selectedImageDataUrl = '';
let selectedImageFile = null;
const LOCAL_IMAGE_PREFIX = 'wishlist-image-';


async function loadItems() {
  try {
    const response = await fetch(API_URL);
    items = (await response.json()).map(item => {
      if (!item.category && !item.type) item.category = 'food';
      return item;
    });
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
    card.className = 'glass-card wishlist-card p-5 shadow-md flex justify-between items-center hover:shadow-lg transition-all';
    const imageUrl = getItemImageUrl(item);
    const cleanNote = removeImageUrlFromNote(item.note);
    card.innerHTML = `
      <div class="flex items-center gap-4 min-w-0">
        <img class="item-photo shrink-0" src="${imageUrl}" alt="Ảnh minh họa ${esc(item.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <div class="text-3xl shrink-0 item-fallback" style="display:none">${getCategoryEmoji(item.category || item.type)}</div>
        <div class="min-w-0">
          <h3 class="font-bold text-gray-800 text-lg"><span class="category-badge category-${item.category || item.type}">${getCategoryEmoji(item.category || item.type)}</span>${esc(item.name)}</h3>
          ${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener" class="text-pink-500 text-sm break-all">${esc(item.link)}</a>` : ''}
          ${cleanNote ? `<p class="text-gray-500 text-xs mt-1">${esc(cleanNote)}</p>` : ''}
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
  const noteRaw = document.getElementById('itemNote').value.trim();
  const imageUrlInput = (document.getElementById('itemImageUrl')?.value || '').trim();
  const id = Date.now().toString();

  if (!name) {
    alert('Bạn ơi, nhập tên món ăn hoặc địa điểm đã nhé! ❤️');
    return;
  }

  try {
    let cloudImageUrl = imageUrlInput;

    // Nếu người dùng chọn upload file từ máy
    if (selectedImageFile) {
      try {
        cloudImageUrl = await uploadImageToImgBB(selectedImageFile);
      } catch (error) {
        alert('Lỗi upload ảnh lên cloud: ' + error.message + '. Alec sẽ lưu ảnh tạm vào máy bạn.');
        cloudImageUrl = '';
      }
    }

    // Lưu link ảnh vào note theo dạng [img]url để persist qua Google Sheet
    const note = mergeImageUrlIntoNote(noteRaw, cloudImageUrl);

    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'add',
        id,
        name,
        category,
        type: category,
        link,
        note,
        image: cloudImageUrl || selectedImageDataUrl
      })
    });

    // Lưu cả link cloud vào localStorage để ảnh hiện ngay trên máy này,
    // kể cả khi Apps Script chưa lưu/trả về trường note/image.
    saveLocalImage(id, cloudImageUrl || selectedImageDataUrl);

    document.getElementById('itemName').value = '';
    document.getElementById('itemLink').value = '';
    document.getElementById('itemNote').value = '';
    const imageUrlEl = document.getElementById('itemImageUrl');
    if (imageUrlEl) imageUrlEl.value = '';
    clearSelectedImage();
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
    removeLocalImage(id);
    await loadItems();
  } catch (error) {
    console.error(error);
    alert('Không thể xóa món này!');
  }
}

function getItemImageUrl(item) {
  const noteImg = extractImageUrlFromNote(item.note);
  return noteImg || item.image || item.imageUrl || item.image_url || getLocalImage(item.id) || getIllustrationUrl(item);
}

function mergeImageUrlIntoNote(note, imageUrl) {
  const cleanNote = String(note || '').trim();
  const cleanUrl = String(imageUrl || '').trim();
  if (!cleanUrl) return cleanNote;
  const withoutOld = removeImageUrlFromNote(cleanNote);
  return `${withoutOld}${withoutOld ? '\n' : ''}[img]${cleanUrl}`;
}

function extractImageUrlFromNote(note) {
  const text = String(note || '');
  // Tìm kiếm linh hoạt hơn: bắt đầu bằng [img] và kết thúc bằng dấu đóng ngoặc hoặc hết chuỗi
  const m = text.match(/\[img\]\s*(https?:\/\/[^\]\s]+)/i);
  return m ? m[1].trim() : '';
}

function removeImageUrlFromNote(note) {
  return String(note || '').replace(/\n?\[img\]https?:\/\/\S+/ig, '').trim();
}

function saveLocalImage(id, image) {
  if (!id || !image) return;
  try {
    localStorage.setItem(`${LOCAL_IMAGE_PREFIX}${id}`, image);
  } catch (error) {
    console.warn('Cannot save image locally:', error);
    alert('Ảnh hơi nặng nên trình duyệt không lưu được lâu dài, nhưng món vẫn được thêm nha ❤️');
  }
}

function getLocalImage(id) {
  if (!id) return '';
  try {
    return localStorage.getItem(`${LOCAL_IMAGE_PREFIX}${id}`) || '';
  } catch (error) {
    return '';
  }
}

function removeLocalImage(id) {
  if (!id) return;
  try {
    localStorage.removeItem(`${LOCAL_IMAGE_PREFIX}${id}`);
  } catch (error) {}
}

function clearSelectedImage() {
  selectedImageDataUrl = '';
  selectedImageFile = '';
  const input = document.getElementById('itemImage');
  const preview = document.getElementById('imagePreview');
  if (input) input.value = '';
  if (preview) {
    preview.removeAttribute('src');
    preview.style.display = 'none';
  }
}

function setupImageUpload() {
  const input = document.getElementById('itemImage');
  const preview = document.getElementById('imagePreview');
  if (!input || !preview) return;

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return clearSelectedImage();
    if (!file.type.startsWith('image/')) {
      alert('Bạn chọn đúng file ảnh giúp Alec nha ❤️');
      return clearSelectedImage();
    }

    try {
      selectedImageFile = file;
      selectedImageDataUrl = await resizeImageToDataUrl(file);
      preview.src = selectedImageDataUrl;
      preview.style.display = 'block';
    } catch (error) {
      console.error(error);
      alert('Ảnh này hơi lớn hoặc không đọc được, bạn thử ảnh khác nhé!');
      clearSelectedImage();
    }
  });
}

function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageToImgBB(file) {
  const base64 = await fileToBase64Payload(file);
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'uploadImage',
      image: base64,
      name: `wishlist-${Date.now()}`
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.url) {
    throw new Error(data.error || 'Không upload được ảnh lên ImgBB');
  }

  return data.url;
}

function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getIllustrationUrl(item) {
  const keyword = buildImageKeyword(item);
  const lock = Math.abs(hashCode(`${item.id || ''}-${item.name || ''}`)) % 1000;
  return `https://loremflickr.com/160/160/${encodeURIComponent(keyword)}?lock=${lock}`;
}
function buildImageKeyword(item) {
  const rawName = removeVietnameseTones(String(item.name || '').toLowerCase());
  const category = item.category || item.type || 'food';

  // Ưu tiên món Việt để ảnh đúng ngữ cảnh hơn
  const known = [
    // Drinks / cafe
    ['tra sua', 'vietnamese bubble tea'],
    ['milk tea', 'vietnamese bubble tea'],
    ['ca phe sua da', 'vietnamese iced coffee'],
    ['bac xiu', 'vietnamese coffee milk'],
    ['ca phe', 'vietnamese coffee'],
    ['cafe', 'vietnamese coffee'],
    ['coffee', 'coffee shop drink'],
    ['matcha', 'matcha latte'],
    ['nuoc ep', 'fresh fruit juice'],
    ['sinh to', 'vietnamese fruit smoothie'],

    // Popular Vietnamese dishes
    ['pho bo', 'pho bo vietnamese noodle soup'],
    ['pho ga', 'pho ga vietnamese noodle soup'],
    ['pho', 'vietnamese pho noodle soup'],
    ['bun bo hue', 'bun bo hue vietnamese noodle soup'],
    ['bun bo', 'vietnamese beef noodle soup'],
    ['bun dau', 'bun dau mam tom vietnamese food'],
    ['bun cha', 'bun cha hanoi vietnamese food'],
    ['hu tieu', 'hu tieu vietnamese noodle soup'],
    ['mi quang', 'mi quang vietnamese noodle'],
    ['banh canh', 'banh canh vietnamese noodle soup'],
    ['com tam', 'com tam vietnamese broken rice'],
    ['com ga', 'vietnamese chicken rice'],
    ['com chien', 'vietnamese fried rice'],
    ['banh mi', 'banh mi vietnamese sandwich'],
    ['goi cuon', 'vietnamese fresh spring rolls'],
    ['cha gio', 'vietnamese fried spring rolls'],
    ['nem nuong', 'vietnamese grilled pork rolls'],
    ['banh xeo', 'banh xeo vietnamese pancake'],
    ['banh khot', 'banh khot vietnamese mini pancake'],
    ['banh trang tron', 'banh trang tron vietnamese snack'],
    ['banh trang', 'vietnamese rice paper snack'],
    ['lau thai', 'thai hot pot'],
    ['lau', 'vietnamese hot pot'],
    ['oc', 'vietnamese seafood snails'],
    ['hai san', 'vietnamese seafood'],
    ['do nuong', 'vietnamese bbq grill'],
    ['thit nuong', 'vietnamese grilled pork'],
    ['ga ran', 'fried chicken'],
    ['pizza', 'pizza'],
    ['burger', 'burger'],
    ['sushi', 'sushi'],
    ['kem', 'ice cream'],
    ['che', 'vietnamese sweet dessert']
  ];

  const match = known.find(([key]) => rawName.includes(key));
  if (match) return match[1];

  // Heuristic theo từ khóa tiếng Việt
  const drinkHints = ['tra', 'sua', 'nuoc', 'ep', 'smoothie', 'latte', 'mojito', 'soda'];
  if (drinkHints.some(h => rawName.includes(h))) return 'vietnamese drink';

  const placeHints = ['quan', 'nha hang', 'restaurant', 'cafe', 'coffee'];
  if (placeHints.some(h => rawName.includes(h))) return 'vietnamese restaurant';

  const fallback = {
    food: 'vietnamese street food',
    cafe: 'vietnamese coffee shop',
    play: 'vietnam city entertainment',
    travel: 'vietnam travel destination'
  };
  return fallback[category] || 'vietnamese food';
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
  const emojis = { food: '🍔', cafe: '☕️', play: '🎡', travel: '✈️' };
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

function pickRandom(category = null) {
  if (items.length === 0) {
    alert('Chưa có món nào để random 😅');
    return;
  }

  let source = items;
  if (category) {
    source = items.filter(i => (i.category || i.type) === category);
    if (!source.length) {
      const text = category === 'food' ? 'ăn uống' : category === 'cafe' ? 'cafe/nước uống' : 'đi chơi';
      alert(`Chưa có mục nào trong nhóm ${text} để random nha ❤️`);
      return;
    }
  } else {
    const pool = currentFilter === 'all' ? items : items.filter(i => (i.category || i.type) === currentFilter);
    source = pool.length ? pool : items;
  }

  const item = source[Math.floor(Math.random() * source.length)];
  const dialog = document.getElementById('randomDialog');
  const nameEl = document.getElementById('randomName');
  const imageEl = document.getElementById('randomImage');
  const linkEl = document.getElementById('randomLink');
  const imageUrl = getItemImageUrl(item);
  const categoryEmoji = getCategoryEmoji(item.category || item.type);

  nameEl.textContent = item.name;
  const headingEl = document.getElementById('dialogHeading');
  if (headingEl) headingEl.textContent = `${categoryEmoji} Kèo hôm nay là...`;
  if (imageEl) {
    imageEl.src = imageUrl;
    imageEl.alt = `Ảnh ${item.name || 'kèo hôm nay'}`;
    imageEl.style.display = 'block';
    imageEl.onerror = () => {
      imageEl.style.display = 'none';
    };
  }
  if (item.link) {
    linkEl.style.display = 'block';
    linkEl.href = item.link;
    linkEl.textContent = 'Mở link / Maps ↗️';
  } else {
    linkEl.style.display = 'none';
  }
  dialog.showModal();
}

document.getElementById('randomEatBtn').addEventListener('click', () => pickRandom('food'));
document.getElementById('randomCafeBtn').addEventListener('click', () => pickRandom('cafe'));
document.getElementById('randomPlayBtn').addEventListener('click', () => pickRandom('play'));
document.getElementById('randomAgain').addEventListener('click', () => pickRandom(currentFilter === 'all' ? null : currentFilter));
document.getElementById('closeDialog').addEventListener('click', () => document.getElementById('randomDialog').close());

// Background music playlist (random one each page load)
const bgMusic = document.getElementById('bgMusic');
let playlist = [];
let chosenTrack = null;
let playlistLoaded = false;
let musicLoading = false;

async function loadPlaylist() {
  try {
    const res = await fetch('music/playlist.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function pickRandomTrack(tracks) {
  const pool = (tracks || []).filter(t => typeof t === 'string' && t.length > 0);
  if (!pool.length) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const url = pool[idx];
  return { file: url };
}

async function ensureTrackReady() {
  if (chosenTrack && bgMusic.src) return true;
  if (musicLoading) return false;

  musicLoading = true;
  if (!playlistLoaded) {
    playlist = await loadPlaylist();
    playlistLoaded = true;
  }

  chosenTrack = pickRandomTrack(playlist);
  if (!chosenTrack || !chosenTrack.file) {
    musicLoading = false;
    return false;
  }

  bgMusic.src = chosenTrack.file;
  bgMusic.load();
  musicLoading = false;
  return true;
}

async function startPlayback() {
  try {
    const ready = await ensureTrackReady();
    if (!ready) return;
    await bgMusic.play();
  } catch (e) {
    console.warn('Autoplay failed:', e);
  }
}

async function initMusic() {
  if (!bgMusic) return;

  // Pre-load playlist
  loadPlaylist().then(data => {
    playlist = data;
    playlistLoaded = true;
  });

  // Try to autoplay immediately
  startPlayback();

  // Auto-play on first user interaction
  const autoPlayOnce = async () => {
    await startPlayback();
    document.removeEventListener('click', autoPlayOnce);
    document.removeEventListener('touchstart', autoPlayOnce);
    document.removeEventListener('scroll', autoPlayOnce);
  };

  document.addEventListener('click', autoPlayOnce);
  document.addEventListener('touchstart', autoPlayOnce);
  document.addEventListener('scroll', autoPlayOnce);
}

setupImageUpload();
initMusic();
loadItems();
