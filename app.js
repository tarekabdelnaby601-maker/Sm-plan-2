// ============================================
// SmPlan Ultimate Edition v4.5 (Settings Integrated)
// Part 1/2
// ============================================

let tasks = safeParse(localStorage.getItem('smplan_tasks_v41')) || [];
let categories = safeParse(localStorage.getItem('smplan_cats_v41')) || ['غير المنجزة','اليوم','بدون وقت','منجزة'];
let habits = safeParse(localStorage.getItem('smplan_habits_v41')) || [];
let weeklyJournal = localStorage.getItem('smplan_journal_v41') || '';
let savedEmail = localStorage.getItem('smplan_user_email') || '';
let userXP = parseInt(localStorage.getItem('smplan_xp_v41')) || 0;
let currentCategory = 'غير المنجزة';
let currentEnergyFilter = 'all';
let completionLog = safeParse(localStorage.getItem('smplan_completion_log')) || {};
let objectives = safeParse(localStorage.getItem('smplan_okr')) || [];
let leaderboard = safeParse(localStorage.getItem('smplan_leaderboard')) || [];

let pomoTimer = null;
let pomoSeconds = 1500;
let isPomoRunning = false;
let pomoTotal = 1500;
let pomoLinkedTaskId = null;

let audioCtx = null;
let soundNodes = [];
let currentSoundscape = null;
let searchDebounceTimer = null;
let confirmCallback = null;
let notificationPermission = 'default';
let notificationChecker = null;

let alertTone = localStorage.getItem('smplan_alert_tone') || 'chime';
let alertVolume = parseFloat(localStorage.getItem('smplan_alert_volume') || '0.7');
let vibrationEnabled = localStorage.getItem('smplan_vibration') !== 'false';
let alertOnComplete = localStorage.getItem('smplan_alert_complete') !== 'false';
let alertOnPomoEnd = localStorage.getItem('smplan_alert_pomo') !== 'false';
let alertOnHabit = localStorage.getItem('smplan_alert_habit') !== 'false';
let alertOnReminder = localStorage.getItem('smplan_alert_reminder') !== 'false';

let voiceRecognition = null;
let isRecording = false;
let lastTranscript = '';

function safeParse(str) { try { return JSON.parse(str); } catch(e) { return null; } }

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'}[m]));
}

function saveToStorage() {
  localStorage.setItem('smplan_tasks_v41', JSON.stringify(tasks));
  localStorage.setItem('smplan_cats_v41', JSON.stringify(categories));
  localStorage.setItem('smplan_habits_v41', JSON.stringify(habits));
  localStorage.setItem('smplan_xp_v41', userXP);
  localStorage.setItem('smplan_completion_log', JSON.stringify(completionLog));
  localStorage.setItem('smplan_okr', JSON.stringify(objectives));
  localStorage.setItem('smplan_leaderboard', JSON.stringify(leaderboard));
  const xpEl = document.getElementById('userXP');
  if (xpEl) xpEl.innerText = userXP + ' XP';
  if (typeof renderTasks === 'function') renderTasks();
  updateProgressBar();
}

function updateProgressBar() {
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const pb = document.getElementById('progressBar');
  if (pb) pb.style.width = percent + '%';
}

function getLevel(xp) { return Math.floor(xp / 100) + 1; }
function logCompletion() { const today = new Date().toISOString().split('T')[0]; completionLog[today] = (completionLog[today] || 0) + 1; }
function triggerConfetti() { try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.85 } }); } catch(e) {} }

function showToast(msg) {
  const t = document.getElementById('toastMsg');
  const quotes = ["بطل! خطوة جديدة 🚀", "إنجاز رائع! استمر 💥", "عاش! مهمة اتمت 🎯", "إنتاجية ممتازة ⭐", "أداء مبدع 🔥"];
  t.innerText = msg || quotes[Math.floor(Math.random() * quotes.length)];
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function showConfirm(title, message, callback) {
  document.getElementById('confirmDialogTitle').innerText = title;
  document.getElementById('confirmDialogMessage').innerText = message;
  confirmCallback = callback;
  document.getElementById('confirmDialogOverlay').classList.add('active');
}

function closeConfirmDialog(result) {
  document.getElementById('confirmDialogOverlay').classList.remove('active');
  if (confirmCallback) confirmCallback(result);
  confirmCallback = null;
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function closeAllDropdowns(e) { document.getElementById('categoryMenu').classList.remove('active'); }
function togglePopupWindow(e) { if (e && e.stopPropagation) e.stopPropagation(); document.getElementById('popupWindow').classList.toggle('active'); }
function toggleCategoryMenu(e) { if (e && e.stopPropagation) e.stopPropagation(); const menu = document.getElementById('categoryMenu'); const isActive = menu.classList.contains('active'); closeAllDropdowns(); if (!isActive) menu.classList.add('active'); }
function toggleSearchBox(e) { if (e && e.stopPropagation) e.stopPropagation(); const sb = document.getElementById('searchBox'); sb.classList.toggle('active'); if (sb.classList.contains('active')) setTimeout(() => document.getElementById('searchInput').focus(), 100); }
function changeEnergyFilter(val) { currentEnergyFilter = val; renderTasks(); }

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('smplan_theme', next);
  showToast(next === 'light' ? '☀️ الوضع الفاتح' : '🌙 الوضع الداكن');
  const cb = document.getElementById('darkModeToggle');
  if(cb) cb.checked = (next === 'dark');
}

const TONE_PRESETS = {
  chime: { freqs: [880, 1108, 1318], durations: [0.15, 0.15, 0.3], type: 'sine' },
  bell: { freqs: [1046, 1318, 1568, 2093], durations: [0.2, 0.2, 0.2, 0.4], type: 'sine' },
  digital: { freqs: [800, 800, 1200, 800], durations: [0.08, 0.08, 0.08, 0.15], type: 'square' },
  success: { freqs: [523, 659, 784, 1046], durations: [0.1, 0.1, 0.1, 0.3], type: 'triangle' },
  urgent: { freqs: [1000, 1400, 1000, 1400], durations: [0.1, 0.1, 0.1, 0.25], type: 'sawtooth' },
  nature: { freqs: [440, 554, 659], durations: [0.3, 0.3, 0.6], type: 'sine' },
  retro: { freqs: [262, 330, 392, 523, 659], durations: [0.1, 0.1, 0.1, 0.1, 0.3], type: 'square' },
  none: { freqs: [], durations: [], type: 'sine' }
};

function playAlertTone(toneName) {
  const tone = toneName || alertTone;
  if (tone === 'none' || alertVolume === 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const preset = TONE_PRESETS[tone] || TONE_PRESETS.chime;
    let startTime = ctx.currentTime;
    preset.freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = preset.type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(alertVolume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + preset.durations[i]);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(startTime); osc.stop(startTime + preset.durations[i] + 0.05);
      startTime += preset.durations[i] * 0.8;
    });
  } catch(e) {}
}

function triggerVibration(pattern) { if (!vibrationEnabled) return; if ('vibrate' in navigator) { try { navigator.vibrate(pattern || [50, 30, 50]); } catch(e) {} } }
function previewAlertTone(tone) { playAlertTone(tone); triggerVibration([30]); }

function updateAlertVolume(val) { alertVolume = val / 100; localStorage.setItem('smplan_alert_volume', alertVolume); const label = document.getElementById('volumeLabel'); if (label) label.innerText = val + '%'; }
function saveVibrationSetting(val) { vibrationEnabled = val; localStorage.setItem('smplan_vibration', val); if (val) triggerVibration([50, 30, 50]); }
function saveAlertSetting(type, val) {
  localStorage.setItem('smplan_alert_' + type, val);
  if (type === 'complete') alertOnComplete = val;
  if (type === 'pomo') alertOnPomoEnd = val;
  if (type === 'habit') alertOnHabit = val;
  if (type === 'reminder') alertOnReminder = val;
}
function testAlertTone() { playAlertTone(); triggerVibration([100, 50, 100]); showToast('🔔 تم اختبار النغمة'); }

function showXPGain(xp, x, y) {
  const el = document.createElement('div'); el.className = 'xp-float'; el.innerText = `+${xp} XP`;
  el.style.left = (x || window.innerWidth / 2) + 'px'; el.style.top = (y || window.innerHeight / 2) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
}

function renderTasks() {
  const container = document.getElementById('taskListMain'); if (!container) return;
  const searchInput = document.getElementById('searchInput');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase();
  
  let filtered = tasks.filter(t => {
    const matchesSearch = (t.title || '').toLowerCase().includes(searchQuery);
    if (!matchesSearch) return false;
    if (currentEnergyFilter !== 'all' && (t.energy || 'medium') !== currentEnergyFilter) return false;
    if (currentCategory === 'منجزة') return t.completed;
    if (currentCategory === 'غير المنجزة') return !t.completed;
    if (currentCategory === 'بدون وقت') return !t.date && !t.completed;
    if (currentCategory === 'اليوم') return t.date === new Date().toISOString().split('T')[0] && !t.completed;
    return t.category === currentCategory && !t.completed;
  });

  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1;
    const pMap = { high: 3, medium: 2, low: 1 };
    return (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
  });

  const labelEl = document.getElementById('currentCategoryLabel'); const countEl = document.getElementById('categoryCount');
  if (labelEl) labelEl.innerText = currentCategory; if (countEl) countEl.innerText = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon material-symbols-outlined">task_alt</div><div>✨ لا توجد مهام حالياً</div><div style="font-size:0.8rem;margin-top:8px;opacity:0.7">أضف مهمة جديدة</div></div>`;
    renderCategoryMenu(); return;
  }

  container.innerHTML = '';
  filtered.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority || 'medium'} ${task.completed ? 'completed' : ''} ${task.pinned ? 'pinned' : ''}`;
    card.dataset.id = task.id;
    
    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksHtml = `<div style="margin-top:8px;padding-right:12px;border-right:2px dashed var(--border-color);display:flex;flex-direction:column;gap:4px">`;
      task.subtasks.forEach(sub => {
        subtasksHtml += `<div style="display:flex;align-items:center;gap:8px;font-size:0.85rem"><input type="checkbox" style="width:14px;height:14px;accent-color:var(--primary-color)" ${sub.completed ? 'checked' : ''} onchange="toggleSubtask('${task.id}','${sub.id}')"><span style="${sub.completed ? 'text-decoration:line-through;color:var(--text-secondary)' : ''}">${escapeHTML(sub.title)}</span></div>`;
      });
      subtasksHtml += `</div>`;
    }

    let tagsHtml = '';
    if (task.tags && task.tags.length > 0) {
      tagsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">`;
      task.tags.forEach(tag => { tagsHtml += `<span style="font-size:0.7rem;background:rgba(192,132,252,0.15);color:#c084fc;padding:2px 6px;border-radius:4px">#${escapeHTML(tag)}</span>`; });
      tagsHtml += `</div>`;
    }

    card.innerHTML = `
      <div class="task-main-row">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}', event)">
        <div class="task-content">
          <div class="task-title">${task.pinned ? '<span class="material-symbols-outlined task-pin-icon">push_pin</span>' : ''}${escapeHTML(task.title)}</div>
          ${task.location ? `<div class="task-location-tag"><span class="material-symbols-outlined" style="font-size:14px">location_on</span> ${escapeHTML(task.location)}</div>` : ''}
          ${task.date ? `<div class="task-location-tag" style="background:rgba(253,214,99,0.15);color:var(--accent-yellow)"><span class="material-symbols-outlined" style="font-size:14px">calendar_today</span> ${escapeHTML(task.date)}</div>` : ''}
          ${task.notes ? `<div class="task-notes-text">${escapeHTML(task.notes)}</div>` : ''}
          ${subtasksHtml}
          ${tagsHtml}
        </div>
        <div class="task-actions">
          <button class="task-action-btn" onclick="togglePin('${task.id}')"><span class="material-symbols-outlined" style="font-size:18px">push_pin</span></button>
          <button class="task-action-btn" onclick="deleteTask('${task.id}')"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button>
        </div>
      </div>`;
    container.appendChild(card);
  });
  renderCategoryMenu();
}

function debouncedSearch() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(renderTasks, 250); }

function toggleTask(id, e) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  if (!t.completed) {
    t.completed = true;
    if (!t.xpAwarded) {
      userXP += 15; t.xpAwarded = true; logCompletion(); triggerConfetti(); showToast();
      if (e) showXPGain(15, e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
      if (alertOnComplete) { playAlertTone('success'); triggerVibration([50, 30, 50]); }
      if (card) card.classList.add('completing');
    }
    if (t.repeat && t.repeat !== 'none') createRecurringInstance(t);
    if (t.objectiveId) updateOKRProgress(t.objectiveId);
  } else {
    t.completed = false;
    if (t.xpAwarded) { userXP = Math.max(0, userXP - 15); t.xpAwarded = false; }
  }
  saveToStorage();
}

function createRecurringInstance(task) {
  const newTask = JSON.parse(JSON.stringify(task)); newTask.id = Date.now().toString() + Math.random(); newTask.completed = false; newTask.xpAwarded = false;
  newTask.subtasks = (newTask.subtasks || []).map(s => ({...s, completed: false, xpAwarded: false}));
  const now = new Date();
  if (task.repeat === 'daily') now.setDate(now.getDate() + 1);
  else if (task.repeat === 'weekly') now.setDate(now.getDate() + 7);
  else if (task.repeat === 'monthly') now.setMonth(now.getMonth() + 1);
  newTask.date = now.toISOString().split('T')[0]; tasks.push(newTask); showToast('🔁 تم إنشاء نسخة متكررة');
}

function toggleSubtask(taskId, subId) {
  const t = tasks.find(x => x.id === taskId); if (!t || !t.subtasks) return;
  const sub = t.subtasks.find(s => s.id === subId); if (!sub) return;
  if (!sub.completed) { sub.completed = true; if (!sub.xpAwarded) { userXP += 5; sub.xpAwarded = true; triggerConfetti(); } }
  else { sub.completed = false; if (sub.xpAwarded) { userXP = Math.max(0, userXP - 5); sub.xpAwarded = false; } }
  saveToStorage();
}

function togglePin(id) { const t = tasks.find(x => x.id === id); if (t) { t.pinned = !t.pinned; saveToStorage(); } }
function deleteTask(id) { showConfirm('حذف المهمة', 'هل تريد حذف هذه المهمة؟', (result) => { if (result) { tasks = tasks.filter(x => x.id !== id); saveToStorage(); showToast('🗑️ تم الحذف'); } }); }

function parseNaturalTask(text) {
  const task = { id: Date.now().toString() + Math.random(), title: text, priority: 'medium', energy: 'medium', completed: false, category: currentCategory, repeat: 'none', tags: [] };
  if (/!!|عاجل|مهم جدا|urgent/i.test(text)) { task.priority = 'high'; task.title = text.replace(/!!|عاجل|مهم جدا|urgent/gi, '').trim(); }
  if (/صعب|مركز|تركيز/.test(text)) task.energy = 'high';
  if (/سهل|بسيط|خفيف/.test(text)) task.energy = 'low';
  if (/اليوم|today/i.test(text)) task.date = new Date().toISOString().split('T')[0];
  else if (/غدا|غداً|بكرة|tomorrow/i.test(text)) { const tm = new Date(); tm.setDate(tm.getDate() + 1); task.date = tm.toISOString().split('T')[0]; }
  const tagMatches = text.match(/#[\w\u0600-\u06FF]+/g); if (tagMatches) task.tags = tagMatches.map(t => t.substring(1));
  
  if (!task.date) {
    const defaultTime = localStorage.getItem('smplan_quick_task_time') || 'none';
    if (defaultTime === 'morning') { task.date = new Date().toISOString().split('T')[0]; task.notes = (task.notes ? task.notes + ' ' : '') + '⏰ صباحاً (9 ص)'; }
    else if (defaultTime === 'evening') { task.date = new Date().toISOString().split('T')[0]; task.notes = (task.notes ? task.notes + ' ' : '') + '⏰ مساءً (6 م)'; }
  }
  if (localStorage.getItem('smplan_quick_task_pin') === 'true') task.pinned = true;
  return task;
}

function handleQuickTask(e) { if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) { tasks.unshift(parseNaturalTask(val)); e.target.value = ''; saveToStorage(); showToast('✨ تمت الإضافة'); } } }
function handlePopupTask(e) { if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) { tasks.unshift(parseNaturalTask(val)); e.target.value = ''; togglePopupWindow(null); saveToStorage(); } } }

function saveNewTaskModal() {
  const title = document.getElementById('modalTaskTitle').value.trim();
  if (!title) { showToast('⚠️ أدخل اسم المهمة'); return; }
  const rawSubs = document.getElementById('modalSubtasksInput').value; const tagsRaw = document.getElementById('modalTaskTags').value;
  let subs = [];
  if (rawSubs.trim()) { rawSubs.split('\n').forEach(s => { if (s.trim()) subs.push({ id: Date.now().toString() + Math.random(), title: s.trim(), completed: false, xpAwarded: false }); }); }
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
  const objectiveId = document.getElementById('modalTaskObjective').value;
  const newTask = { id: Date.now().toString(), title, location: document.getElementById('modalTaskLocation').value.trim(), energy: document.getElementById('modalTaskEnergy').value, priority: document.getElementById('modalTaskPriority').value, notes: document.getElementById('modalTaskNotes').value.trim(), date: document.getElementById('modalTaskDate').value, repeat: document.getElementById('modalTaskRepeat').value, tags, objectiveId, completed: false, xpAwarded: false, subtasks: subs, category: currentCategory };
  tasks.unshift(newTask); closeModal('newTaskModal'); saveToStorage(); if (newTask.date) scheduleTaskNotification(newTask); showToast('✅ تم حفظ المهمة');
}

function openNewTaskModal() {
  document.getElementById('modalTaskTitle').value = ''; document.getElementById('modalTaskLocation').value = ''; document.getElementById('modalTaskNotes').value = ''; document.getElementById('modalSubtasksInput').value = ''; document.getElementById('modalTaskDate').value = ''; document.getElementById('modalTaskTags').value = ''; document.getElementById('modalTaskRepeat').value = 'none';
  const objSelect = document.getElementById('modalTaskObjective'); objSelect.innerHTML = '<option value="">بدون ربط</option>';
  objectives.forEach(obj => { objSelect.innerHTML += `<option value="${obj.id}">${escapeHTML(obj.title)}</option>`; });
  document.getElementById('newTaskModal').classList.add('active');
}

function renderCategoryMenu() {
  const container = document.getElementById('dynamicCategories'); if (!container) return; container.innerHTML = '';
  categories.forEach(cat => {
    const count = tasks.filter(t => t.category === cat && !t.completed).length;
    container.innerHTML += `<div class="dropdown-item" onclick="selectCategory('${escapeHTML(cat)}')"><span>${escapeHTML(cat)}</span><span class="task-count-badge">${count}</span></div>`;
  });
}
function selectCategory(cat) { currentCategory = cat; closeAllDropdowns(); renderTasks(); }
function openNewCategoryDialog() { closeAllDropdowns(); document.getElementById('newCategoryInput').value = ''; document.getElementById('categoryDialogOverlay').classList.add('active'); setTimeout(() => document.getElementById('newCategoryInput').focus(), 100); }
function closeNewCategoryDialog() { document.getElementById('categoryDialogOverlay').classList.remove('active'); }
function submitNewCategory() { const val = document.getElementById('newCategoryInput').value.trim(); if (val && !categories.includes(val)) { categories.push(val); currentCategory = val; closeNewCategoryDialog(); saveToStorage(); showToast('✅ تمت إضافة القائمة'); } }
function deleteCurrentCategory() { closeAllDropdowns(); if (['غير المنجزة', 'اليوم', 'بدون وقت', 'منجزة'].includes(currentCategory)) { showToast('⚠️ لا يمكن حذف القوائم الافتراضية'); return; } showConfirm('حذف القائمة', `سيتم حذف "${currentCategory}" وكل مهامها. متأكد؟`, (result) => { if (result) { categories = categories.filter(c => c !== currentCategory); tasks = tasks.filter(t => t.category !== currentCategory); currentCategory = 'غير المنجزة'; saveToStorage(); } }); }

function openHabitTrackerModal() { closeAllDropdowns(); renderHabits(); document.getElementById('habitModal').classList.add('active'); }
function addHabit() { const val = document.getElementById('newHabitInput').value.trim(); if (val) { habits.push({ id: Date.now().toString(), title: val, count: 0, lastDone: null }); document.getElementById('newHabitInput').value = ''; saveToStorage(); renderHabits(); } }
function incrementHabit(id) { const h = habits.find(x => x.id === id); if (h) { const today = new Date().toISOString().split('T')[0]; if (h.lastDone === today) { showToast('✅ أنجزت هذه العادة اليوم'); return; } h.count++; h.lastDone = today; userXP += 10; saveToStorage(); renderHabits(); triggerConfetti(); if (alertOnHabit) { playAlertTone('success'); triggerVibration([50]); } showToast('🔥 +10 XP'); } }
function deleteHabit(id) { showConfirm('حذف العادة', 'حذف هذه العادة؟', (result) => { if (result) { habits = habits.filter(h => h.id !== id); saveToStorage(); renderHabits(); } }); }
function renderHabits() {
  const container = document.getElementById('habitListContainer'); container.innerHTML = '';
  if (habits.length === 0) { container.innerHTML = `<div style="color:var(--text-secondary);text-align:center;padding:20px">لا توجد عادات بعد</div>`; return; }
  const today = new Date().toISOString().split('T')[0];
  habits.forEach(h => {
    const doneToday = h.lastDone === today;
    container.innerHTML += `
      <div style="background:var(--surface-card);border:1px solid var(--border-color);padding:12px;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="flex:1"><div style="font-weight:bold;font-size:0.95rem">${escapeHTML(h.title)}</div><div style="font-size:0.8rem;color:var(--primary-color);margin-top:2px">تم: ${h.count} 🔥</div></div>
        <button class="dialog-btn ${doneToday ? '' : 'primary'}" onclick="incrementHabit('${h.id}')" ${doneToday ? 'disabled style="opacity:0.5"' : ''}>${doneToday ? '✓ اليوم' : '+ إنجاز'}</button>
        <button class="task-action-btn" onclick="deleteHabit('${h.id}')"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button>
      </div>`;
  });
}

function openPomodoroModal() { closeAllDropdowns(); const taskSelect = document.getElementById('pomoTaskSelect'); taskSelect.innerHTML = '<option value="">بدون ربط</option>'; tasks.filter(t => !t.completed).forEach(t => { taskSelect.innerHTML += `<option value="${t.id}">${escapeHTML(t.title)}</option>`; }); document.getElementById('pomodoroModal').classList.add('active'); }
function setCustomFocus() { const min = parseInt(document.getElementById('customFocusMin').value) || 0; const sec = parseInt(document.getElementById('customFocusSec').value) || 0; const total = min * 60 + sec; if (total <= 0) { showToast('⚠️ أدخل وقت صالح'); return; } if (total > 180 * 60) { showToast('⚠️ الحد 3 ساعات'); return; } clearInterval(pomoTimer); isPomoRunning = false; pomoSeconds = total; pomoTotal = total; updatePomoDisplay(); document.getElementById('pomoToggleBtn').innerText = "إبدأ ⏱️"; document.querySelectorAll('.pomo-preset-btn').forEach(b => b.classList.remove('active')); showToast(`✅ تم ضبط ${min}د ${sec}ث`); }
function setPomodoroTime(minutes, btn) { clearInterval(pomoTimer); isPomoRunning = false; pomoSeconds = minutes * 60; pomoTotal = pomoSeconds; updatePomoDisplay(); document.getElementById('pomoToggleBtn').innerText = "إبدأ ⏱️"; document.querySelectorAll('.pomo-preset-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); }
function updatePomoDisplay() { const m = Math.floor(pomoSeconds / 60).toString().padStart(2, '0'); const s = (pomoSeconds % 60).toString().padStart(2, '0'); const pomoEl = document.getElementById('pomoTime'); const focusEl = document.getElementById('focusTimer'); if (pomoEl) pomoEl.innerText = `${m}:${s}`; if (focusEl) focusEl.innerText = `${m}:${s}`; const circle = document.getElementById('focusProgressCircle'); if (circle && pomoTotal > 0) { const total = 2 * Math.PI * 130; const progress = 1 - (pomoSeconds / pomoTotal); circle.style.strokeDashoffset = (total * progress).toFixed(2); } }
function togglePomodoro() {
  const btn = document.getElementById('pomoToggleBtn'); const focusBtn = document.getElementById('focusToggleBtn');
  if (!isPomoRunning) {
    isPomoRunning = true; if (btn) btn.innerText = "إيقاف ⏸️"; if (focusBtn) focusBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
    const taskSelect = document.getElementById('pomoTaskSelect'); pomoLinkedTaskId = taskSelect ? taskSelect.value : null;
    pomoTimer = setInterval(() => {
      if (pomoSeconds > 0) { pomoSeconds--; updatePomoDisplay(); }
      else {
        clearInterval(pomoTimer); isPomoRunning = false; if (btn) btn.innerText = "إبدأ ⏱️"; if (focusBtn) focusBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        showToast("🎉 انتهت الجلسة!"); triggerConfetti(); userXP += 25; saveToStorage();
        if (alertOnPomoEnd) { playAlertTone('success'); triggerVibration([100, 50, 100, 50, 100]); }
        if (Notification.permission === 'granted') { try { new Notification('🎉 جلسة تركيز اكتملت', { body: 'أحسنت! حصلت على 25 XP' }); } catch(e) {} }
        if (pomoLinkedTaskId) {
          const linkedTask = tasks.find(t => t.id === pomoLinkedTaskId);
          if (linkedTask && !linkedTask.completed) {
            setTimeout(() => {
              showConfirm('🎯 أكملت التركيز', `هل تريد وضع علامة "منجزة" على "${linkedTask.title}"؟`, (result) => {
                if (result) { linkedTask.completed = true; if (!linkedTask.xpAwarded) { userXP += 15; linkedTask.xpAwarded = true; logCompletion(); } saveToStorage(); showToast('✅ مهمة مكتملة!'); }
              });
            }, 500);
          }
        }
      }
    }, 1000);
  } else { clearInterval(pomoTimer); isPomoRunning = false; if (btn) btn.innerText = "استئناف ▶️"; if (focusBtn) focusBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>'; }
}
function resetPomodoro() { clearInterval(pomoTimer); isPomoRunning = false; pomoSeconds = pomoTotal; updatePomoDisplay(); const btn = document.getElementById('pomoToggleBtn'); if (btn) btn.innerText = "إبدأ ⏱️"; }

function startFocusMode() {
  document.getElementById('focusOverlay').classList.add('active');
  const particleContainer = document.getElementById('focusParticles');
  if (particleContainer && particleContainer.children.length === 0) {
    for (let i = 0; i < 20; i++) { const p = document.createElement('div'); p.className = 'focus-particle'; p.style.left = Math.random() * 100 + '%'; p.style.animationDuration = (3 + Math.random() * 5) + 's'; p.style.animationDelay = Math.random() * 3 + 's'; p.style.opacity = 0.3 + Math.random() * 0.5; particleContainer.appendChild(p); }
  }
  const focusLabel = document.getElementById('focusTaskLabel');
  if (pomoLinkedTaskId) { const t = tasks.find(x => x.id === pomoLinkedTaskId); if (t) focusLabel.innerText = '🎯 ' + t.title; } else { focusLabel.innerText = 'وضع التركيز'; }
  if (!isPomoRunning) togglePomodoro();
}
function exitFocusMode() { document.getElementById('focusOverlay').classList.remove('active'); }

function openSoundscapesModal() { closeAllDropdowns(); document.getElementById('soundscapesModal').classList.add('active'); }
function toggleSoundscape(type) {
  if (currentSoundscape === type) { stopAllSoundscapes(); return; }
  stopAllSoundscapes(); if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume(); currentSoundscape = type;
  const card = document.getElementById('sound' + type.charAt(0).toUpperCase() + type.slice(1)); if (card) card.classList.add('playing');
  const bufferSize = audioCtx.sampleRate * 3; const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
  const source = audioCtx.createBufferSource(); source.buffer = noiseBuffer; source.loop = true;
  const filter = audioCtx.createBiquadFilter(); const gain = audioCtx.createGain();
  switch(type) {
    case 'rain': filter.type = 'lowpass'; filter.frequency.value = 1000; gain.gain.value = 0.12; break;
    case 'waves': filter.type = 'lowpass'; filter.frequency.value = 400; const lfo = audioCtx.createOscillator(); const lfoGain = audioCtx.createGain(); lfo.frequency.value = 0.1; lfoGain.gain.value = 0.05; lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start(); soundNodes.push(lfo); gain.gain.value = 0.1; break;
    case 'cafe': filter.type = 'bandpass'; filter.frequency.value = 1000; filter.Q.value = 0.8; gain.gain.value = 0.08; break;
    default: filter.type = 'allpass'; gain.gain.value = 0.1;
  }
  source.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); source.start(); soundNodes.push(source, filter, gain); showToast("🎧 جاري التشغيل...");
}
function stopAllSoundscapes() { soundNodes.forEach(node => { try { node.stop(); } catch(e) {} }); soundNodes = []; currentSoundscape = null; document.querySelectorAll('.soundscape-card').forEach(c => c.classList.remove('playing')); }

function openWallpapersModal() { closeAllDropdowns(); document.getElementById('wallpapersModal').classList.add('active'); }
function setWallpaper(url) { if (url) { document.body.style.setProperty('--bg-image', `url('${url}')`); try { localStorage.setItem('smplan_bg_url', url); } catch(e) { showToast('⚠️ الصورة كبيرة'); } } else { document.body.style.setProperty('--bg-image', 'none'); localStorage.removeItem('smplan_bg_url'); } closeModal('wallpapersModal'); }
function applyCustomWallpaper() { const url = document.getElementById('customBgUrlInput').value.trim(); if (url) { setWallpaper(url); document.getElementById('customBgUrlInput').value = ''; } else showToast('⚠️ أدخل رابطاً'); }
function changeBgDimming(val) { document.documentElement.style.setProperty('--bg-overlay-opacity', val / 100); localStorage.setItem('smplan_bg_opacity', val); }
function handleDeviceImageSelect(e) { const file = e.target.files[0]; if (file) { if (file.size > 2 * 1024 * 1024) { showToast('⚠️ الحد 2MB'); return; } const reader = new FileReader(); reader.onload = (evt) => { setWallpaper(evt.target.result); showToast("🖼️ تم التطبيق!"); }; reader.readAsDataURL(file); } }

function openGoogleSyncModal() { closeAllDropdowns(); if (savedEmail) document.getElementById('userEmailInput').value = savedEmail; document.getElementById('googleSyncModal').classList.add('active'); }
function syncWithGmailAccount() { const email = document.getElementById('userEmailInput').value.trim(); if (!email) { showToast('⚠️ أدخل بريدك'); return; } savedEmail = email; localStorage.setItem('smplan_user_email', email); const backupData = { email, timestamp: new Date().toISOString(), tasks, categories, habits, weeklyJournal, userXP, completionLog, objectives, leaderboard }; const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SmPlan_Backup_${email.split('@')[0]}_${new Date().toISOString().split('T')[0]}.json`; a.click(); showToast(`☁️ تم الحفظ`); closeModal('googleSyncModal'); }
function restoreFromGmailFile(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { try { const data = JSON.parse(evt.target.result); if (data.tasks) { tasks = data.tasks; categories = data.categories || categories; habits = data.habits || habits; weeklyJournal = data.weeklyJournal || ''; userXP = data.userXP || 0; completionLog = data.completionLog || {}; objectives = data.objectives || []; leaderboard = data.leaderboard || []; saveToStorage(); showToast("🔄 تم الاسترجاع!"); closeModal('googleSyncModal'); } else showToast('⚠️ ملف غير صالح'); } catch(err) { showToast('⚠️ خطأ'); } }; reader.readAsText(file); }
function exportData() { closeAllDropdowns(); const blob = new Blob([JSON.stringify({ tasks, categories, habits, weeklyJournal, userXP, completionLog, objectives, leaderboard }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SmPlan_Export_${new Date().toISOString().split('T')[0]}.json`; a.click(); }
function clearAll() { closeAllDropdowns(); showConfirm('مسح كافة المهام', 'سيتم حذف كل شيء. متأكد؟', (result) => { if (result) { tasks = []; saveToStorage(); showToast('🗑️ تم المسح'); } }); }

// ============================================
// Part 2/2 — Settings + AI + Stats & Init
// ============================================

// --- Settings Hub Logic ---
function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
}

function openGeneralSettings() {
  document.getElementById('languageSelect').value = localStorage.getItem('smplan_lang') || 'ar';
  document.getElementById('timeFormatSelect').value = localStorage.getItem('smplan_time_format') || '12';
  document.getElementById('weekStartSelect').value = localStorage.getItem('smplan_week_start') || 'sat';
  document.getElementById('systemVoiceToggle').checked = localStorage.getItem('smplan_system_voice') !== 'false';
  document.getElementById('generalSettingsModal').classList.add('active');
}

function openDefaultValuesSettings() {
  document.getElementById('defaultReminderInput').value = localStorage.getItem('smplan_default_reminder') || '10';
  document.getElementById('defaultSnoozeInput').value = localStorage.getItem('smplan_default_snooze') || '5';
  document.getElementById('defaultValuesModal').classList.add('active');
}

function openQuickTaskSettings() {
  document.getElementById('quickTaskBarToggle').checked = localStorage.getItem('smplan_quick_task_bar') !== 'false';
  document.getElementById('quickTaskTimeSelect').value = localStorage.getItem('smplan_quick_task_time') || 'none';
  document.getElementById('quickTaskPinToggle').checked = localStorage.getItem('smplan_quick_task_pin') === 'true';
  document.getElementById('quickTaskSettingsModal').classList.add('active');
}

function openSoundSettings() {
  document.getElementById('alertToneSelect').value = alertTone;
  document.getElementById('alertVolumeRange').value = Math.round(alertVolume * 100);
  document.getElementById('volumeLabel').innerText = Math.round(alertVolume * 100) + '%';
  document.getElementById('vibrationToggle').checked = vibrationEnabled;
  document.getElementById('alertOnComplete').checked = alertOnComplete;
  document.getElementById('alertOnPomoEnd').checked = alertOnPomoEnd;
  document.getElementById('alertOnHabit').checked = alertOnHabit;
  document.getElementById('alertOnReminder').checked = alertOnReminder;
  document.getElementById('soundSettingsModal').classList.add('active');
}

function openAppearanceSettings() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const toggle = document.getElementById('darkModeToggle');
  if(toggle) toggle.checked = isDark;
  document.getElementById('appearanceModal').classList.add('active');
}

// --- Save Settings Changes ---
document.addEventListener('change', (e) => {
  const id = e.target.id;
  const val = e.target.value;
  const checked = e.target.checked;

  switch(id) {
    case 'languageSelect':
      localStorage.setItem('smplan_lang', val);
      showToast('تم حفظ اللغة');
      break;
    case 'timeFormatSelect':
      localStorage.setItem('smplan_time_format', val);
      showToast('تم حفظ صيغة الوقت');
      break;
    case 'weekStartSelect':
      localStorage.setItem('smplan_week_start', val);
      showToast('تم حفظ بداية الأسبوع');
      break;
    case 'systemVoiceToggle':
      localStorage.setItem('smplan_system_voice', checked);
      break;
    case 'defaultReminderInput':
      localStorage.setItem('smplan_default_reminder', val);
      break;
    case 'defaultSnoozeInput':
      localStorage.setItem('smplan_default_snooze', val);
      break;
    case 'quickTaskBarToggle':
      localStorage.setItem('smplan_quick_task_bar', checked);
      const qtBar = document.getElementById('quickTaskInput');
      if (qtBar) {
        const bottomBar = qtBar.closest('.bottom-bar');
        if (bottomBar) bottomBar.style.display = checked ? 'flex' : 'none';
      }
      break;
    case 'quickTaskTimeSelect':
      localStorage.setItem('smplan_quick_task_time', val);
      break;
    case 'quickTaskPinToggle':
      localStorage.setItem('smplan_quick_task_pin', checked);
      break;
    case 'alertToneSelect':
      alertTone = val;
      localStorage.setItem('smplan_alert_tone', val);
      break;
  }
});

function applyQuickTaskSettings() {
  const isBarEnabled = localStorage.getItem('smplan_quick_task_bar') !== 'false';
  const qtBar = document.getElementById('quickTaskInput');
  if (qtBar) {
    const bottomBar = qtBar.closest('.bottom-bar');
    if (bottomBar) bottomBar.style.display = isBarEnabled ? 'flex' : 'none';
  }
}

// ============================================
// AI Input System
// ============================================
function openAIInput(tab) {
  closeAllDropdowns();
  document.getElementById('aiTextInput').value = '';
  document.getElementById('voiceTranscript').innerText = '';
  document.getElementById('aiResultsPreview').innerHTML = '';
  document.getElementById('aiImagePreview').innerHTML = '';
  document.getElementById('aiInputModal').classList.add('active');
  switchAITab(tab || 'text');
}

function switchAITab(tab, btn) {
  document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ai-tab-content').forEach(c => c.style.display = 'none');
  
  const target = document.getElementById('aiTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (target) target.style.display = 'block';
  
  if (btn) btn.classList.add('active');
  else {
    const tabs = document.querySelectorAll('.ai-tab');
    const idx = tab === 'text' ? 0 : tab === 'voice' ? 1 : 2;
    if (tabs[idx]) tabs[idx].classList.add('active');
  }
  
  document.getElementById('aiResultsPreview').innerHTML = '';
}

async function processAIText() {
  const input = document.getElementById('aiTextInput').value.trim();
  if (!input) { showToast('⚠️ اكتب حاجة الأول'); return; }
  const results = await analyzeTextWithAI(input);
  showAIResults(results);
}

async function analyzeTextWithAI(text) {
  if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `حلل النص التالي واستخرج المهام. أرجع JSON فقط بهذا الشكل:
{"tasks":[{"title":"...","priority":"high|medium|low","energy":"high|medium|low","date":"YYYY-MM-DD or null","notes":"..."}]}

النص: "${text}"` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const raw = data.candidates[0].content.parts[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
        }
      }
    } catch(e) { console.warn('Gemini failed, using local parser'); }
  }
  return analyzeTextLocally(text);
}

function analyzeTextLocally(text) {
  const lines = text.split(/[.\n•·]/).map(l => l.trim()).filter(l => l.length > 2);
  const results = [];
  
  lines.forEach(line => {
    const task = { title: line, priority: 'medium', energy: 'medium', date: null, notes: '' };
    
    if (/!!|عاجل|مهم جدا|ضروري|urgent|critical/i.test(line)) {
      task.priority = 'high';
      task.title = line.replace(/!!|عاجل|مهم جدا|ضروري|urgent|critical/gi, '').trim();
    }
    if (/صعب|مركز|تركيز|شاق|معقد/.test(line)) task.energy = 'high';
    if (/سهل|بسيط|خفيف|سريع/.test(line)) task.energy = 'low';
    
    if (/اليوم|today/i.test(line)) { task.date = new Date().toISOString().split('T')[0]; } 
    else if (/غدا|غداً|بكرة|tomorrow/i.test(line)) { const tm = new Date(); tm.setDate(tm.getDate() + 1); task.date = tm.toISOString().split('T')[0]; } 
    else if (/بعد\s*غد|day after/i.test(line)) { const tm = new Date(); tm.setDate(tm.getDate() + 2); task.date = tm.toISOString().split('T')[0]; } 
    else if (/الأسبوع القادم|next week/i.test(line)) { const tm = new Date(); tm.setDate(tm.getDate() + 7); task.date = tm.toISOString().split('T')[0]; }
    
    const timeMatch = line.match(/(الساعة\s*)?(\d{1,2})(:(\d{2}))?\s*(ص|م|am|pm)/i);
    if (timeMatch) { task.notes = `⏰ ${timeMatch[0]}`; }
    
    if (task.title.length > 2) results.push(task);
  });
  
  return results.length > 0 ? results : [{ title: text, priority: 'medium', energy: 'medium', date: null, notes: '' }];
}

function showAIResults(tasks) {
  const preview = document.getElementById('aiResultsPreview');
  if (!preview) return;
  
  if (!tasks || tasks.length === 0) {
    preview.innerHTML = '<div style="text-align:center;color:var(--text-secondary)">لا توجد مهام</div>';
    return;
  }
  
  let html = `<h3 style="color:var(--primary-color);margin-bottom:12px;font-size:0.95rem">✨ تم استخراج ${tasks.length} مهمة:</h3>`;
  tasks.forEach((task) => {
    const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    html += `
      <div class="ai-result-item">
        <span class="material-symbols-outlined">task_alt</span>
        <div class="ai-result-content">
          <div class="ai-result-title">${escapeHTML(task.title)}</div>
          <div class="ai-result-meta">
            <span>${priorityEmoji} ${task.priority}</span>
            <span>⚡ ${task.energy}</span>
            ${task.date ? `<span>📅 ${task.date}</span>` : ''}
            ${task.notes ? `<span>${escapeHTML(task.notes)}</span>` : ''}
          </div>
        </div>
      </div>`;
  });
  
  const tasksJsonStr = JSON.stringify(tasks).replace(/'/g, "&apos;");
  html += `<div style="display:flex;gap:8px;margin-top:16px">
    <button class="form-input" style="background:var(--primary-gradient);color:#000;font-weight:bold;border:none;cursor:pointer;flex:1" onclick='confirmAIResults(${tasksJsonStr})'>✅ إضافة الكل</button>
    <button class="form-input" style="background:var(--surface-card);color:var(--text-color);border:1px solid var(--border-color);cursor:pointer;flex:1" onclick="document.getElementById('aiResultsPreview').innerHTML=''">إلغاء</button>
  </div>`;
  
  preview.innerHTML = html;
}

function confirmAIResults(tasksToAdd) {
  tasksToAdd.forEach(t => {
    tasks.unshift({ id: Date.now().toString() + Math.random(), title: t.title, priority: t.priority || 'medium', energy: t.energy || 'medium', date: t.date || '', notes: t.notes || '', tags: [], completed: false, xpAwarded: false, subtasks: [], category: currentCategory, repeat: 'none' });
  });
  saveToStorage();
  closeModal('aiInputModal');
  showToast(`✅ تمت إضافة ${tasksToAdd.length} مهمة`);
}

function toggleVoiceRecording() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { showToast('⚠️ الإدخال الصوتي غير مدعوم'); return; }
  
  const orb = document.getElementById('voiceOrb');
  const status = document.getElementById('voiceStatus');
  const transcript = document.getElementById('voiceTranscript');
  const btn = document.getElementById('voiceRecordBtn');
  
  if (isRecording) {
    if (voiceRecognition) voiceRecognition.stop();
    isRecording = false; orb.classList.remove('recording'); status.innerText = 'توقف التسجيل'; btn.innerText = '🎤 ابدأ التسجيل'; return;
  }
  
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SR(); voiceRecognition.lang = 'ar-SA'; voiceRecognition.continuous = false; voiceRecognition.interimResults = true;
  
  voiceRecognition.onstart = () => {
    isRecording = true; orb.classList.add('recording'); status.innerText = '🎤 جاري التسجيل...'; btn.innerText = '⏹️ إيقاف التسجيل'; transcript.innerText = '';
  };
  voiceRecognition.onresult = (e) => {
    let finalTranscript = ''; let interimTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t; else interimTranscript += t;
    }
    transcript.innerText = finalTranscript || interimTranscript;
    if (finalTranscript) lastTranscript = finalTranscript;
  };
  voiceRecognition.onerror = (e) => {
    status.innerText = '❌ خطأ: ' + e.error; orb.classList.remove('recording'); isRecording = false; btn.innerText = '🎤 ابدأ التسجيل';
  };
  voiceRecognition.onend = () => {
    isRecording = false; orb.classList.remove('recording'); status.innerText = '✅ انتهى التسجيل'; btn.innerText = '🎤 ابدأ التسجيل';
    if (lastTranscript) {
      setTimeout(async () => {
        const results = await analyzeTextWithAI(lastTranscript);
        showAIResults(results);
      }, 500);
    }
  };
  try { voiceRecognition.start(); } catch(e) { showToast('⚠️ خطأ في بدء التسجيل'); }
}

function processAIImage(e) {
  const file = e.target.files[0]; if (!file) return;
  const preview = document.getElementById('aiImagePreview');
  preview.innerHTML = `<div style="text-align:center;padding:20px;background:var(--surface-card);border-radius:var(--radius-md)"><div class="typing-dots" style="color:var(--primary-color);font-weight:bold;font-size:1rem">📷 جاري تحليل الصورة</div></div>`;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64 = evt.target.result;
    preview.innerHTML = `<img src="${base64}" style="width:100%;border-radius:var(--radius-md);margin-bottom:12px">`;
    
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
      try {
        const base64Data = base64.split(',')[1]; const mimeType = base64.split(';')[0].split(':')[1];
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `استخرج كل المهام أو العناصر المكتوبة في هذه الصورة. أرجع JSON فقط: {"tasks":[{"title":"...","priority":"high|medium|low","energy":"medium","date":null,"notes":""}]}` }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
          })
        });
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          const raw = data.candidates[0].content.parts[0].text;
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) { const parsed = JSON.parse(jsonMatch[0]); if (parsed.tasks && Array.isArray(parsed.tasks)) { showAIResults(parsed.tasks); return; } }
        }
      } catch(err) { console.warn('Vision API failed', err); }
    }
    
    preview.innerHTML += `
      <div style="background:var(--surface-card);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-color);margin-top:12px">
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:10px">⚠️ تحليل الصور يحتاج مفتاح Gemini API. يمكنك كتابة المهام يدوياً:</p>
        <textarea class="form-textarea" id="manualFromImage" placeholder="اكتب المهام اللي شوفتها في الصورة..." style="min-height:80px"></textarea>
        <button class="form-input" style="background:var(--primary-gradient);color:#000;font-weight:bold;border:none;cursor:pointer;margin-top:8px" onclick="processManualImageText()">✨ حلل وأضف</button>
      </div>`;
  };
  reader.readAsDataURL(file);
}

async function processManualImageText() {
  const text = document.getElementById('manualFromImage').value.trim(); if (!text) return;
  const results = await analyzeTextWithAI(text);
  showAIResults(results);
}

// ============================================
// Stats & Extras
// ============================================
function openStatsModal() {
  closeAllDropdowns();
  document.getElementById('statTotalDone').innerText = tasks.filter(t => t.completed).length;
  let streak = 0; const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i); const key = d.toISOString().split('T')[0];
    if (completionLog[key] && completionLog[key] > 0) streak++; else if (i > 0) break;
  }
  document.getElementById('statStreak').innerText = streak; document.getElementById('statXP').innerText = userXP; document.getElementById('statLevel').innerText = getLevel(userXP);
  
  const labels = [], data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i); const key = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('ar-EG', { weekday: 'short' })); data.push(completionLog[key] || 0);
  }
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  if (window.weeklyChartInstance) window.weeklyChartInstance.destroy();
  window.weeklyChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'المهام المنجزة', data, backgroundColor: 'rgba(138,180,248,0.6)', borderColor: '#8ab4f8', borderWidth: 1, borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9aa0a6' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9aa0a6' }, grid: { display: false } } } } });
  
  const heatContainer = document.getElementById('heatmapContainer'); heatContainer.innerHTML = '';
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i); const key = d.toISOString().split('T')[0];
    const count = completionLog[key] || 0; const intensity = Math.min(count / 5, 1);
    const cell = document.createElement('div'); cell.className = 'heatmap-cell'; cell.style.background = `rgba(138,180,248,${0.15 + intensity * 0.85})`; cell.title = `${key}: ${count}`;
    heatContainer.appendChild(cell);
  }
  document.getElementById('statsModal').classList.add('active');
}
function showLevelInfo() { const lvl = getLevel(userXP); showToast(`المستوى ${lvl} • ${userXP}/${lvl * 100} XP`); }

function openWeeklyJournalModal() {
  closeAllDropdowns();
  const doneCount = tasks.filter(t => t.completed).length; const totalCount = tasks.length;
  const rate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  document.getElementById('journalStatsText').innerText = `أنجزت ${doneCount} من ${totalCount} مهمة (${rate}%). استمر! ⭐`;
  document.getElementById('journalNotesInput').value = weeklyJournal;
  document.getElementById('weeklyJournalModal').classList.add('active');
}
function saveWeeklyJournal() { weeklyJournal = document.getElementById('journalNotesInput').value; localStorage.setItem('smplan_journal_v41', weeklyJournal); showToast("📖 تم الحفظ!"); closeModal('weeklyJournalModal'); }

function openMultiAddModal() { closeAllDropdowns(); document.getElementById('multiAddModal').classList.add('active'); }
function saveMultiTasks() {
  const raw = document.getElementById('multiTasksInput').value; let count = 0;
  raw.split('\n').forEach(l => { if (l.trim()) { tasks.unshift(parseNaturalTask(l.trim())); count++; } });
  document.getElementById('multiTasksInput').value = ''; closeModal('multiAddModal'); saveToStorage(); showToast(`✅ ${count} مهمة`);
}

const GEMINI_API_KEY = '';

async function aiBreakdownTask(event) {
  const title = document.getElementById('modalTaskTitle').value.trim();
  if (!title) { showToast('⚠️ أدخل اسم المهمة'); return; }
  const btn = event ? event.target : null; const originalText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳...'; btn.disabled = true; }
  
  if (!GEMINI_API_KEY) {
    document.getElementById('modalSubtasksInput').value = generateSmartBreakdown(title);
    showToast('✨ تم توليد خطوات محلية');
    if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    return;
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `فكك هذه المهمة إلى 4-5 خطوات قصيرة (كل خطوة في سطر): "${title}"` }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 300 } })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (generated) { const cleaned = generated.split('\n').map(l => l.replace(/^[\d\-\.\*\•]+\s*/, '').trim()).filter(l => l.length > 0).join('\n'); document.getElementById('modalSubtasksInput').value = cleaned; showToast("✨ تم التوليد!"); }
  } catch (err) {
    document.getElementById('modalSubtasksInput').value = generateSmartBreakdown(title); showToast('✨ تم توليد خطوات بديلة');
  } finally { if (btn) { btn.innerHTML = originalText; btn.disabled = false; } }
}

function generateSmartBreakdown(title) { return [`تحديد الهدف من "${title}"`, `جمع الموارد والمعلومات`, `تقسيم المهمة لأجزاء`, `تنفيذ الجزء الأول`, `إنهاء الأجزاء المتبقية`].join('\n'); }

function startSpeech() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { showToast('⚠️ غير مدعوم'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const rec = new SR(); rec.lang = 'ar-SA';
  rec.onresult = (e) => { document.getElementById('quickTaskInput').value = e.results[0][0].transcript; }; rec.start(); showToast('🎤 جاري الاستماع...');
}
function startSpeechModal() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { showToast('⚠️ غير مدعوم'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const rec = new SR(); rec.lang = 'ar-SA';
  rec.onresult = (e) => { document.getElementById('modalTaskTitle').value = e.results[0][0].transcript; }; rec.start(); showToast('🎤 جاري الاستماع...');
}

function saveObjectives() { localStorage.setItem('smplan_okr', JSON.stringify(objectives)); }
function openOKRModal() { closeAllDropdowns(); renderOKRList(); document.getElementById('okrModal').classList.add('active'); }
function openNewObjectiveDialog() {
  const modal = document.createElement('div'); modal.className = 'custom-dialog-overlay active';
  modal.innerHTML = `
    <div class="custom-dialog-card">
      <div class="dialog-title">🎯 هدف جديد</div>
      <input type="text" class="form-input" id="newObjTitle" placeholder="مثال: أتعلم البرمجة">
      <input type="text" class="form-input" id="newObjDesc" placeholder="لماذا هذا الهدف مهم؟" style="margin-top:10px">
      <input type="date" class="form-input" id="newObjDeadline" style="margin-top:10px">
      <div class="dialog-btn-row"><button class="dialog-btn" onclick="this.closest('.custom-dialog-overlay').remove()">إلغاء</button><button class="dialog-btn primary" onclick="saveNewObjective()">إضافة</button></div>
    </div>`; document.body.appendChild(modal);
}
function saveNewObjective() {
  const title = document.getElementById('newObjTitle').value.trim(); if (!title) { showToast('⚠️ أدخل عنوان'); return; }
  objectives.push({ id: Date.now().toString(), title, desc: document.getElementById('newObjDesc').value.trim(), deadline: document.getElementById('newObjDeadline').value, keyResults: [], createdAt: new Date().toISOString(), completed: false });
  saveObjectives(); renderOKRList(); document.querySelectorAll('.custom-dialog-overlay').forEach(m => { if (m.querySelector('#newObjTitle')) m.remove(); }); showToast('✅ تم إضافة الهدف');
}
function addKeyResult(objId) {
  const modal = document.createElement('div'); modal.className = 'custom-dialog-overlay active';
  modal.innerHTML = `
    <div class="custom-dialog-card">
      <div class="dialog-title">➕ نتيجة رئيسية</div>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:10px">النتائج الرئيسية (Key Results)</p>
      <input type="text" class="form-input" id="newKRTitle" placeholder="مثال: 100 ساعة تدريب">
      <div style="display:flex;gap:8px;margin-top:10px"><input type="number" class="form-input" id="newKRCurrent" placeholder="الحالي" value="0"><input type="number" class="form-input" id="newKRTarget" placeholder="الهدف" value="100"></div>
      <div class="dialog-btn-row"><button class="dialog-btn" onclick="this.closest('.custom-dialog-overlay').remove()">إلغاء</button><button class="dialog-btn primary" onclick="saveKeyResult('${objId}')">إضافة</button></div>
    </div>`; document.body.appendChild(modal);
}
function saveKeyResult(objId) {
  const title = document.getElementById('newKRTitle').value.trim(); if (!title) { showToast('⚠️ أدخل عنوان'); return; }
  const obj = objectives.find(o => o.id === objId);
  if (obj) { obj.keyResults.push({ id: Date.now().toString(), title, current: parseInt(document.getElementById('newKRCurrent').value) || 0, target: parseInt(document.getElementById('newKRTarget').value) || 100 }); saveObjectives(); renderOKRList(); }
  document.querySelectorAll('.custom-dialog-overlay').forEach(m => { if (m.querySelector('#newKRTitle')) m.remove(); });
}
function updateKeyResult(objId, krId, delta) {
  const obj = objectives.find(o => o.id === objId); if (!obj) return;
  const kr = obj.keyResults.find(k => k.id === krId); if (!kr) return;
  kr.current = Math.max(0, Math.min(kr.target, kr.current + delta)); saveObjectives(); renderOKRList();
}
function deleteObjective(objId) {
  showConfirm('حذف هدف', 'هل تريد حذف هذا الهدف؟', (result) => { if (result) { objectives = objectives.filter(o => o.id !== objId); saveObjectives(); renderOKRList(); } });
}
function updateOKRProgress(objectiveId) {
  const obj = objectives.find(o => o.id === objectiveId);
  if (obj && obj.keyResults.length > 0) { const kr = obj.keyResults[0]; kr.current = Math.min(kr.target, kr.current + 1); saveObjectives(); }
}
function renderOKRList() {
  const container = document.getElementById('okrListContainer');
  if (objectives.length === 0) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon material-symbols-outlined">flag</div><div>لا توجد أهداف بعد</div><div style="font-size:0.8rem;margin-top:8px">اضغط + لإضافة</div></div>`; return; }
  container.innerHTML = '';
  objectives.forEach(obj => {
    const progress = obj.keyResults.length > 0 ? Math.round(obj.keyResults.reduce((sum, kr) => sum + (kr.current / kr.target), 0) / obj.keyResults.length * 100) : 0;
    const card = document.createElement('div'); card.style.cssText = 'background:var(--surface-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;margin-bottom:14px';
    
    let krsHtml = '';
    obj.keyResults.forEach(kr => {
      const pct = Math.round((kr.current / kr.target) * 100);
      krsHtml += `<div style="background:var(--surface-elevated);padding:10px;border-radius:8px;margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:0.85rem;flex:1">${escapeHTML(kr.title)}</span><span style="font-size:0.75rem;color:var(--primary-color);font-weight:bold">${kr.current}/${kr.target}</span></div><div style="display:flex;align-items:center;gap:6px;margin-top:6px"><div style="flex:1;height:6px;background:var(--border-color);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--primary-gradient);transition:width 0.3s"></div></div><button class="task-action-btn" onclick="updateKeyResult('${obj.id}','${kr.id}',-1)" style="padding:2px 6px">−</button><button class="task-action-btn" onclick="updateKeyResult('${obj.id}','${kr.id}',1)" style="padding:2px 6px">+</button></div></div>`;
    });
    
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1"><div style="font-weight:800;font-size:1rem;color:var(--text-color)">${escapeHTML(obj.title)}</div>${obj.desc ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${escapeHTML(obj.desc)}</div>` : ''}${obj.deadline ? `<div style="font-size:0.75rem;color:var(--accent-yellow);margin-top:4px">📅 ${escapeHTML(obj.deadline)}</div>` : ''}</div><button class="task-action-btn" onclick="deleteObjective('${obj.id}')"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button></div><div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary)"><span>التقدم الإجمالي</span><span style="color:var(--primary-color);font-weight:bold">${progress}%</span></div><div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;margin-top:4px"><div style="width:${progress}%;height:100%;background:var(--primary-gradient);transition:width 0.5s"></div></div></div>${krsHtml}<button class="dialog-btn" style="width:100%;margin-top:10px;background:var(--surface-elevated);color:var(--primary-color);font-weight:bold" onclick="addKeyResult('${obj.id}')">+ إضافة نتيجة رئيسية</button>`;
    container.appendChild(card);
  });
}

function saveLeaderboard() { localStorage.setItem('smplan_leaderboard', JSON.stringify(leaderboard)); }
function openLeaderboardModal() { closeAllDropdowns(); document.getElementById('myXPDisplay').innerText = userXP + ' XP'; document.getElementById('myLevelDisplay').innerText = 'المستوى ' + getLevel(userXP); renderLeaderboard(); document.getElementById('leaderboardModal').classList.add('active'); }
function openNewScoreDialog() {
  const modal = document.createElement('div'); modal.className = 'custom-dialog-overlay active';
  modal.innerHTML = `<div class="custom-dialog-card"><div class="dialog-title">🏆 إضافة نتيجة صديق</div><input type="text" class="form-input" id="friendNameInput" placeholder="اسم الصديق"><input type="number" class="form-input" id="friendXPInput" placeholder="نقاط XP" style="margin-top:10px"><div class="dialog-btn-row"><button class="dialog-btn" onclick="this.closest('.custom-dialog-overlay').remove()">إلغاء</button><button class="dialog-btn primary" onclick="saveFriendScore()">إضافة</button></div></div>`;
  document.body.appendChild(modal);
}
function saveFriendScore() {
  const name = document.getElementById('friendNameInput').value.trim(); const xp = parseInt(document.getElementById('friendXPInput').value) || 0;
  if (!name) { showToast('⚠️ أدخل الاسم'); return; }
  leaderboard.push({ id: Date.now().toString(), name, xp, isMe: false }); saveLeaderboard(); renderLeaderboard();
  document.querySelectorAll('.custom-dialog-overlay').forEach(m => { if (m.querySelector('#friendNameInput')) m.remove(); });
}
function renderLeaderboard() {
  const container = document.getElementById('leaderboardContainer');
  const all = [{ id: 'me', name: 'أنت', xp: userXP, isMe: true }, ...leaderboard].sort((a, b) => b.xp - a.xp);
  let html = '';
  all.forEach((entry, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const bg = entry.isMe ? 'rgba(138,180,248,0.15)' : 'var(--surface-card)'; const border = entry.isMe ? '2px solid var(--primary-color)' : '1px solid var(--border-color)';
    html += `<div style="background:${bg};border:${border};border-radius:var(--radius-md);padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px"><span style="font-size:1.3rem;font-weight:bold;min-width:36px">${medal}</span><div style="flex:1"><div style="font-weight:bold">${escapeHTML(entry.name)}</div><div style="font-size:0.75rem;color:var(--text-secondary)">المستوى ${getLevel(entry.xp)}</div></div><div style="font-weight:800;color:var(--primary-color)">${entry.xp} XP</div>${!entry.isMe ? `<button class="task-action-btn" onclick="deleteFriendScore('${entry.id}')"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>` : ''}</div>`;
  });
  container.innerHTML = html;
}
function deleteFriendScore(id) { leaderboard = leaderboard.filter(l => l.id !== id); saveLeaderboard(); renderLeaderboard(); }

function generateICS(tasksToExport) {
  const pad = n => String(n).padStart(2, '0');
  function formatICSDate(date) { return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`; }
  let ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SmPlan//v3//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:SmPlan Tasks'];
  tasksToExport.forEach(task => {
    if (!task.date) return;
    const start = new Date(task.date + 'T09:00:00'); const end = new Date(start.getTime() + 30 * 60 * 1000);
    const summary = (task.title || '').replace(/[,;\\]/g, ' ').substring(0, 200);
    ics.push('BEGIN:VEVENT', `UID:${task.id}@smplan.app`, `DTSTAMP:${formatICSDate(new Date())}`, `DTSTART:${formatICSDate(start)}`, `DTEND:${formatICSDate(end)}`, `SUMMARY:${summary}`, task.location ? `LOCATION:${task.location.replace(/[,;\\]/g, ' ')}` : '', task.priority === 'high' ? 'PRIORITY:1' : 'PRIORITY:5', 'STATUS:' + (task.completed ? 'COMPLETED' : 'NEEDS-ACTION'), 'END:VEVENT');
  });
  ics.push('END:VCALENDAR'); return ics.filter(Boolean).join('\r\n');
}
function exportToGoogleCalendar() {
  closeAllDropdowns(); const tasksWithDate = tasks.filter(t => t.date);
  if (tasksWithDate.length === 0) { showToast('⚠️ لا مهام بتاريخ'); return; }
  showConfirm('📅 تصدير للتقويم', `سيتم تصدير ${tasksWithDate.length} مهمة. متابعة؟`, (result) => {
    if (!result) return;
    const ics = generateICS(tasksWithDate); const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `SmPlan_${new Date().toISOString().split('T')[0]}.ics`; a.click();
    setTimeout(() => { showToast('✅ تم التنزيل!'); showCalendarInstructions(); }, 500);
  });
}
function showCalendarInstructions() {
  const modal = document.createElement('div'); modal.className = 'custom-dialog-overlay active';
  modal.innerHTML = `<div class="custom-dialog-card" style="max-width:400px"><div class="dialog-title">📅 خطوات الاستيراد</div><ol style="color:var(--text-secondary);font-size:0.9rem;padding-right:20px;line-height:1.8"><li>افتح Google Calendar</li><li>⚙️ الإعدادات → Import & export</li><li>اختر ملف SmPlan_*.ics</li><li>اختر التقويم → Import</li></ol><div class="dialog-btn-row"><button class="dialog-btn primary" onclick="this.closest('.custom-dialog-overlay').remove()">فهمت</button></div></div>`;
  document.body.appendChild(modal);
}

function shareCurrentCategory() {
  closeAllDropdowns(); const catTasks = tasks.filter(t => t.category === currentCategory && !t.completed);
  if (catTasks.length === 0) { showToast('⚠️ لا مهام للمشاركة'); return; }
  const payload = { v: 1, name: currentCategory, tasks: catTasks.map(t => ({ t: t.title, p: t.priority, e: t.energy, n: t.notes || '', s: (t.subtasks || []).map(x => ({ t: x.title })), l: t.location || '', d: t.date || '', g: t.tags || [] })) };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  showShareDialog(currentCategory, `${location.origin}${location.pathname}#import=${encoded}`, catTasks.length);
}
function showShareDialog(categoryName, url, taskCount) {
  const modal = document.createElement('div'); modal.className = 'custom-dialog-overlay active'; modal.id = 'shareDialog';
  modal.innerHTML = `<div class="custom-dialog-card" style="max-width:420px"><div class="dialog-title">🤝 مشاركة "${escapeHTML(categoryName)}"</div><p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:12px">${taskCount} مهمة</p><div style="background:white;padding:12px;border-radius:12px;display:flex;justify-content:center;margin-bottom:14px"><canvas id="qrCanvas"></canvas></div><div class="form-group"><label class="form-label">الرابط:</label><div style="display:flex;gap:6px"><input type="text" class="form-input" id="shareUrlInput" value="${escapeHTML(url)}" readonly style="font-size:0.75rem"><button class="dialog-btn primary" onclick="copyShareUrl()">📋</button></div></div><div class="dialog-btn-row"><button class="dialog-btn" onclick="shareViaWhatsApp('${escapeHTML(url)}')">💬 WhatsApp</button><button class="dialog-btn" onclick="shareViaNative('${escapeHTML(url)}','${escapeHTML(categoryName)}')">📤 مشاركة</button><button class="dialog-btn primary" onclick="document.getElementById('shareDialog').remove()">إغلاق</button></div></div>`;
  document.body.appendChild(modal);
  if (window.QRCode) { try { QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 200, margin: 1, color: { dark: '#090a0f', light: '#ffffff' } }); } catch(e) {} }
}
function copyShareUrl() { const input = document.getElementById('shareUrlInput'); input.select(); navigator.clipboard.writeText(input.value).then(() => showToast('📋 تم النسخ!')); }
function shareViaWhatsApp(url) { window.open(`https://wa.me/?text=${encodeURIComponent('مشاركة قائمة مهام: ' + url)}`, '_blank'); }
function shareViaNative(url, title) { if (navigator.share) navigator.share({ title: `قائمة ${title}`, url }); else copyShareUrl(); }

function checkImportFromUrl() {
  const hash = location.hash; if (!hash.startsWith('#import=')) return;
  try {
    const encoded = hash.substring(8); const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    if (!decoded.tasks || !Array.isArray(decoded.tasks)) return;
    showConfirm('📥 استيراد قائمة', `استيراد "${decoded.name}" (${decoded.tasks.length} مهمة)؟`, (result) => {
      if (result) {
        const newCategory = `مشترك - ${decoded.name} (${new Date().toLocaleDateString('ar-EG')})`; categories.push(newCategory);
        decoded.tasks.forEach(t => { tasks.push({ id: Date.now().toString() + Math.random(), title: t.t, priority: t.p || 'medium', energy: t.e || 'medium', notes: t.n || '', location: t.l || '', date: t.d || '', tags: t.g || [], subtasks: (t.s || []).map(x => ({ id: Date.now().toString() + Math.random(), title: x.t, completed: false, xpAwarded: false })), completed: false, xpAwarded: false, category: newCategory, repeat: 'none' }); });
        saveToStorage(); showToast(`✅ تم استيراد ${decoded.tasks.length} مهمة`);
      }
      history.replaceState(null, '', location.pathname);
    });
  } catch (e) { console.error(e); }
}

async function requestNotificationPermission() {
  closeAllDropdowns(); if (!('Notification' in window)) { showToast('⚠️ غير مدعوم'); return false; }
  if (Notification.permission === 'granted') { notificationPermission = 'granted'; showToast('✅ الإشعارات مفعلة'); startNotificationScheduler(); return true; }
  if (Notification.permission === 'denied') { showToast('❌ محظورة من إعدادات المتصفح'); return false; }
  const permission = await Notification.requestPermission(); notificationPermission = permission;
  if (permission === 'granted') { showToast('✅ تم التفعيل'); startNotificationScheduler(); return true; }
  return false;
}
function scheduleTaskNotification(task) {
  if (!task.date || notificationPermission !== 'granted') return;
  const taskDate = new Date(task.date + 'T09:00:00'); const now = new Date(); const diff = taskDate.getTime() - now.getTime();
  const notifyAt = Math.max(diff - 30 * 60 * 1000, 1000);
  if (notifyAt > 0 && notifyAt < 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      if (Notification.permission === 'granted' && !task.completed) {
        try { new Notification('⏰ تذكير بمهمة', { body: `مهمتك "${task.title}" خلال 30 دقيقة`, tag: `task-${task.id}`, requireInteraction: true }); if (alertOnReminder) { playAlertTone('urgent'); triggerVibration([100, 50, 100]); } } catch(e) {}
      }
    }, notifyAt);
  }
}
function startNotificationScheduler() {
  if (notificationChecker) return;
  notificationChecker = setInterval(() => {
    if (Notification.permission !== 'granted') return;
    const today = new Date().toISOString().split('T')[0];
    tasks.forEach(task => {
      if (task.completed || !task.date || task.date !== today) return;
      const lastNotified = sessionStorage.getItem(`notif-${task.id}`); if (lastNotified) return;
      try { new Notification('📋 مهمة اليوم', { body: task.title, tag: `task-daily-${task.id}` }); if (alertOnReminder) { playAlertTone('chime'); triggerVibration([80, 40, 80]); } } catch(e) {}
      sessionStorage.setItem(`notif-${task.id}`, 'true');
    });
  }, 60000);
}

function injectPWAManifest() {
  try {
    const iconSVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%238ab4f8'/%3E%3Cstop offset='1' stop-color='%23c084fc'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='512' height='512' rx='100' fill='url(%23g)'/%3E%3Ctext x='256' y='340' font-size='280' font-family='Arial' font-weight='bold' text-anchor='middle' fill='%23090a0f'%3ES%3C/text%3E%3C/svg%3E";
    const manifest = { name: "SmPlan — المخطط الذكي", short_name: "SmPlan", description: "تطبيق مهام ذكي", start_url: "./", scope: "./", display: "standalone", orientation: "portrait", background_color: "#090a0f", theme_color: "#8ab4f8", lang: "ar", dir: "rtl", icons: [{ src: iconSVG, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" }, { src: iconSVG, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }], shortcuts: [{ name: "إضافة مهمة", short_name: "مهمة", url: "./#new-task", icons: [{ src: iconSVG, sizes: "192x192" }] }, { name: "وضع التركيز", short_name: "تركيز", url: "./#focus", icons: [{ src: iconSVG, sizes: "192x192" }] }, { name: "الإحصائيات", short_name: "إحصائيات", url: "./#stats", icons: [{ src: iconSVG, sizes: "192x192" }] }] };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }); const url = URL.createObjectURL(blob); const link = document.createElement('link'); link.rel = 'manifest'; link.href = url; document.head.appendChild(link);
  } catch(e) { console.warn('Manifest injection failed', e); }
}

function handleShortcuts() {
  const hash = location.hash;
  if (hash === '#new-task') { setTimeout(() => openNewTaskModal(), 500); history.replaceState(null, '', location.pathname); } 
  else if (hash === '#focus') { setTimeout(() => { openPomodoroModal(); }, 500); history.replaceState(null, '', location.pathname); } 
  else if (hash === '#stats') { setTimeout(() => openStatsModal(), 500); history.replaceState(null, '', location.pathname); }
}

function init() {
  const savedTheme = localStorage.getItem('smplan_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  const savedBg = localStorage.getItem('smplan_bg_url');
  if (savedBg) document.body.style.setProperty('--bg-image', `url('${savedBg}')`);
  const savedOpacity = localStorage.getItem('smplan_bg_opacity');
  if (savedOpacity) { document.documentElement.style.setProperty('--bg-overlay-opacity', savedOpacity / 100); const rangeEl = document.getElementById('bgOpacityRange'); if (rangeEl) rangeEl.value = savedOpacity; }
  
  const toneSelect = document.getElementById('alertToneSelect'); if (toneSelect) toneSelect.value = alertTone;
  const volRange = document.getElementById('alertVolumeRange'); if (volRange) volRange.value = Math.round(alertVolume * 100);
  const volLabel = document.getElementById('volumeLabel'); if (volLabel) volLabel.innerText = Math.round(alertVolume * 100) + '%';
  
  injectPWAManifest();
  if ('Notification' in window && Notification.permission === 'granted') { notificationPermission = 'granted'; startNotificationScheduler(); }
  
  checkImportFromUrl();
  handleShortcuts();
  
  // Apply quick task settings on load
  applyQuickTaskSettings();

  renderTasks();
  updateProgressBar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}