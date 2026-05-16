class CoupleWishlistApp {
  constructor() {
    this.items = [];
    this.currentFilter = 'all';
    this.channel = null;

    // Điền Supabase URL và anon key của bạn ở đây nếu muốn sync giữa 2 máy.
    this.supabaseUrl = 'PASTE_SUPABASE_URL_HERE';
    this.supabaseKey = 'PASTE_SUPABASE_ANON_KEY_HERE';
    this.tableName = 'couple_wishlist';
    this.listId = 1;
    this.supabase = this.canUseSupabase()
      ? window.supabase.createClient(this.supabaseUrl, this.supabaseKey)
      : null;

    this.init();
  }

  canUseSupabase() {
    return window.supabase
      && this.supabaseUrl.startsWith('https://')
      && this.supabaseKey.length > 30
      && !this.supabaseUrl.includes('PASTE_')
      && !this.supabaseKey.includes('PASTE_');
  }

  async init() {
    this.bindEvents();
    this.initTheme();
    await this.loadItems();
    this.setupRealtime();
    this.render();
  }

  bindEvents() {
    document.getElementById('wishlistForm').addEventListener('submit', (event) => {
      event.preventDefault();
      this.addItem();
    });

    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('randomBtn').addEventListener('click', () => this.pickRandom());
    document.getElementById('randomAgain').addEventListener('click', () => this.pickRandom());
    document.getElementById('closeDialog').addEventListener('click', () => document.getElementById('randomDialog').close());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJson());

    document.querySelectorAll('.filter-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.currentFilter = button.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        this.render();
      });
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('couple_theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
    document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('couple_theme', nextTheme);
    document.getElementById('themeToggle').textContent = nextTheme === 'dark' ? '☀️' : '🌙';
  }

  async loadItems() {
    if (!this.supabase) {
      this.items = JSON.parse(localStorage.getItem('couple_wishlist_items') || '[]');
      this.setSyncStatus('Chế độ local: dữ liệu chỉ lưu trên máy này', 'warn');
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('items')
        .eq('id', this.listId)
        .single();

      if (error && error.code === 'PGRST116') {
        await this.supabase.from(this.tableName).insert({ id: this.listId, items: [] });
        this.items = [];
      } else if (error) {
        throw error;
      } else {
        this.items = Array.isArray(data.items) ? data.items : [];
      }

      this.setSyncStatus('Đã kết nối cloud — hai máy sẽ sync với nhau', 'ok');
    } catch (error) {
      console.error(error);
      this.items = JSON.parse(localStorage.getItem('couple_wishlist_items') || '[]');
      this.setSyncStatus('Lỗi cloud, đang dùng dữ liệu local', 'warn');
    }
  }

  setupRealtime() {
    if (!this.supabase) return;
    this.channel = this.supabase
      .channel('couple_wishlist_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: this.tableName,
        filter: `id=eq.${this.listId}`,
      }, (payload) => {
        if (payload.new?.items) {
          this.items = payload.new.items;
          this.render();
          this.setSyncStatus('Vừa sync dữ liệu mới 🔄', 'ok');
        }
      })
      .subscribe();
  }

  async saveItems() {
    localStorage.setItem('couple_wishlist_items', JSON.stringify(this.items));
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from(this.tableName)
      .upsert({ id: this.listId, items: this.items, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) {
      console.error(error);
      this.setSyncStatus('Không lưu được lên cloud, đã lưu local', 'warn');
    } else {
      this.setSyncStatus('Đã lưu và sync cloud 💖', 'ok');
    }
  }

  async addItem() {
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: document.getElementById('itemName').value.trim(),
      type: document.getElementById('itemType').value,
      status: document.getElementById('itemStatus').value,
      addedBy: document.getElementById('itemAddedBy').value,
      date: document.getElementById('itemDate').value,
      link: document.getElementById('itemLink').value.trim(),
      note: document.getElementById('itemNote').value.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!item.name) return alert('Nhập tên món / địa điểm trước nha ❤️');
    this.items.unshift(item);
    document.getElementById('wishlistForm').reset();
    await this.saveItems();
    this.render();
  }

  async updateStatus(id, status) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;
    item.status = status;
    await this.saveItems();
    this.render();
  }

  async deleteItem(id) {
    if (!confirm('Xóa mục này khỏi danh sách nha?')) return;
    this.items = this.items.filter((item) => item.id !== id);
    await this.saveItems();
    this.render();
  }

  getFilteredItems() {
    if (this.currentFilter === 'all') return this.items;
    if (this.currentFilter === 'done') return this.items.filter((item) => item.status === 'done');
    return this.items.filter((item) => item.type === this.currentFilter);
  }

  render() {
    const list = document.getElementById('wishlist');
    const emptyState = document.getElementById('emptyState');
    const items = this.getFilteredItems();

    this.renderStats();
    emptyState.hidden = items.length !== 0;
    list.innerHTML = items.map((item) => this.renderItem(item)).join('');
  }

  renderStats() {
    document.getElementById('totalCount').textContent = this.items.length;
    document.getElementById('todoCount').textContent = this.items.filter((i) => i.status === 'todo').length;
    document.getElementById('plannedCount').textContent = this.items.filter((i) => i.status === 'planned').length;
    document.getElementById('doneCount').textContent = this.items.filter((i) => i.status === 'done').length;
  }

  renderItem(item) {
    const type = this.typeMeta(item.type);
    const status = this.statusMeta(item.status);
    return `
      <article class="wish-card ${item.status === 'done' ? 'is-done' : ''}">
        <div class="wish-top">
          <span class="type-pill ${item.type}">${type}</span>
          <select class="status-select" onchange="app.updateStatus('${item.id}', this.value)">
            ${this.statusOptions(item.status)}
          </select>
        </div>
        <h3>${this.escapeHtml(item.name)}</h3>
        <div class="meta-line">
          <span>👤 ${this.escapeHtml(item.addedBy || 'Cả hai')}</span>
          ${item.date ? `<span>📅 ${this.formatDate(item.date)}</span>` : ''}
        </div>
        ${item.note ? `<p class="note">${this.escapeHtml(item.note)}</p>` : ''}
        <div class="card-actions">
          ${item.link ? `<a class="open-link" href="${this.escapeAttr(item.link)}" target="_blank" rel="noopener">Mở link / Maps ↗</a>` : '<span></span>'}
          <button class="delete-btn" onclick="app.deleteItem('${item.id}')">Xóa</button>
        </div>
      </article>
    `;
  }

  typeMeta(type) {
    return {
      food: '🍜 Món ăn', restaurant: '🍽️ Nhà hàng', cafe: '☕ Cafe', play: '🎡 Vui chơi',
      movie: '🎬 Xem phim', travel: '✈️ Du lịch', other: '💭 Khác'
    }[type] || '💭 Khác';
  }

  statusMeta(status) {
    return { todo: 'Muốn thử', planned: 'Đã lên kèo', done: 'Đã đi', again: 'Muốn đi lại' }[status] || 'Muốn thử';
  }

  statusOptions(selected) {
    return ['todo', 'planned', 'done', 'again'].map((value) =>
      `<option value="${value}" ${value === selected ? 'selected' : ''}>${this.statusMeta(value)}</option>`
    ).join('');
  }

  pickRandom() {
    const pool = this.items.filter((item) => item.status !== 'done');
    if (!pool.length) return alert('Chưa có mục nào để random, hoặc tất cả đã đi rồi nha ❤️');
    const item = pool[Math.floor(Math.random() * pool.length)];
    document.getElementById('randomContent').innerHTML = `
      <p class="eyebrow">Kèo hôm nay là...</p>
      <h2>${this.escapeHtml(item.name)}</h2>
      <p>${this.typeMeta(item.type)} · ${this.statusMeta(item.status)}</p>
      ${item.note ? `<p class="note">${this.escapeHtml(item.note)}</p>` : ''}
      ${item.link ? `<a class="open-link" href="${this.escapeAttr(item.link)}" target="_blank" rel="noopener">Mở link ↗</a>` : ''}
    `;
    document.getElementById('randomDialog').showModal();
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'couple-wishlist.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  setSyncStatus(text, mode) {
    const el = document.getElementById('syncStatus');
    el.textContent = text;
    el.className = `sync-pill ${mode}`;
  }

  formatDate(value) {
    return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
  }

  escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  escapeAttr(value = '') {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  }
}

const app = new CoupleWishlistApp();
