import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, where, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
try { enableIndexedDbPersistence(db) } catch(e){}

let userId = null, trackersUnsub = null, itemsUnsub = null;
let currentTrackerId = null, currentParentId = 'root', currentTrackerData = {};
let breadcrumbs = [], allTrackers = [];

const UI = {
    loader: document.getElementById('loader-overlay'),
    loaderPct: document.getElementById('loader-percentage'),
    appContainer: document.getElementById('app'),
    profilePic: document.getElementById('profile-pic'),
    defaultPicIcon: document.getElementById('default-pic-icon'),
    uploadInput: document.getElementById('photo-upload'),
    welcomeMessage: document.getElementById('welcome-message'),
    dashboardPage: document.getElementById('dashboard-page'),
    settingsPage: document.getElementById('settings-page'),
    trackerPage: document.getElementById('tracker-page'),
    trackersGrid: document.getElementById('trackers-grid'),
    newTrackerName: document.getElementById('new-tracker-name'),
    trackerSelect: document.getElementById('tracker-select'),
    taskColumnsEditor: document.getElementById('task-columns-editor'),
    displayNameInput: document.getElementById('display-name-input'),
    itemsContainer: document.getElementById('items-container'),
    trackerTitle: document.getElementById('tracker-title'),
    breadcrumbsEl: document.getElementById('breadcrumbs'),
    itemModal: document.getElementById('item-modal'),
    itemNameInput: document.getElementById('item-name-input'),
    itemTypeCheckbox: document.getElementById('item-type-checkbox'),
    deleteModal: document.getElementById('delete-modal'),
    deleteText: document.getElementById('delete-text')
};

let pct = 0;
const loaderInterval = setInterval(()=> {
  pct = Math.min(100, pct + 3);
  UI.loaderPct.textContent = pct + '%';
  if (pct >= 100) clearInterval(loaderInterval);
}, 50);

onAuthStateChanged(auth, user => {
  if (!user) { signInAnonymously(auth); return; }
  userId = user.uid;
  setTimeout(()=> { UI.loader.classList.add('hidden'); UI.appContainer.style.opacity = '1'; }, 1800);
  attachListeners();
  loadUserProfile();
  renderTrackers();
});

function attachListeners(){
    document.getElementById('profile-pic-container').addEventListener('click', ()=> UI.uploadInput.click());
    document.getElementById('upload-btn').addEventListener('click', ()=> UI.uploadInput.click());
    UI.uploadInput.addEventListener('change', (e)=> handlePhotoUpload(e));
    document.getElementById('create-tracker-btn').addEventListener('click', handleCreateTracker);
    UI.displayNameInput.addEventListener('change', (e)=> updateDisplayName(e.target.value));
    document.getElementById('settings-btn').addEventListener('click', showSettingsPage);
    document.getElementById('back-btn').addEventListener('click', handleBack);
    document.getElementById('back-to-dashboard-btn').addEventListener('click', showDashboardPage);
    document.getElementById('add-new-item-btn').addEventListener('click', ()=> openItemModal());
    document.getElementById('cancel-item-btn').addEventListener('click', ()=> UI.itemModal.classList.add('hidden'));
    document.getElementById('cancel-delete-btn').addEventListener('click', ()=> UI.deleteModal.classList.add('hidden'));
    UI.trackerSelect.addEventListener('change', ()=> renderTaskColumnsEditor(UI.trackerSelect.value));
    document.getElementById('delete-tracker-btn').addEventListener('click', ()=> handleDeleteTracker());
}

function showDashboardPage(){ UI.dashboardPage.classList.remove('hidden'); UI.settingsPage.classList.add('hidden'); UI.trackerPage.classList.add('hidden'); if (itemsUnsub) itemsUnsub(); }
function showSettingsPage(){ UI.dashboardPage.classList.add('hidden'); UI.settingsPage.classList.remove('hidden'); UI.trackerPage.classList.add('hidden'); populateTrackerSelect(); }
function showTrackerPage(){ UI.dashboardPage.classList.add('hidden'); UI.settingsPage.classList.add('hidden'); UI.trackerPage.classList.remove('hidden'); }

async function loadUserProfile(){
  try{
    const uref = doc(db, 'users', userId);
    const snap = await getDoc(uref);
    if (snap.exists()){
      const data = snap.data();
      if (data.profilePicUrl){
        UI.profilePic.src = data.profilePicUrl; UI.profilePic.classList.remove('hidden'); UI.defaultPicIcon.classList.add('hidden');
      } else { UI.profilePic.classList.add('hidden'); UI.defaultPicIcon.classList.remove('hidden'); }
      if (data.displayName){
        UI.welcomeMessage.textContent = `Welcome, ${data.displayName}!`;
        UI.displayNameInput.value = data.displayName;
      }
    } else {
      await setDoc(uref, { createdAt: serverTimestamp() }, { merge: true });
    }
  } catch(err){ console.error('loadUserProfile', err); }
}

async function handlePhotoUpload(event){
  const file = event.target.files?.[0]; if (!file) return;
  try {
    alert('Uploading picture...');
    const path = `profile-pictures/${userId}`;
    const sref = ref(storage, path);
    await uploadBytes(sref, file);
    const url = await getDownloadURL(sref);
    await setDoc(doc(db,'users',userId), { profilePicUrl: url }, { merge: true });
    await loadUserProfile();
    alert('Profile picture updated!');
  } catch(err){ console.error('upload error', err); alert('Upload failed. Check storage rules.'); }
}

async function updateDisplayName(name){
  try { await setDoc(doc(db,'users',userId), { displayName: name }, { merge: true }); UI.welcomeMessage.textContent = `Welcome, ${name}!`; } catch(e){ console.error(e); }
}

function renderTrackers(){
  if (trackersUnsub) trackersUnsub();
  UI.trackersGrid.innerHTML = '';
  const q = query(collection(db, 'users', userId, 'trackers'), orderBy('createdAt','desc'));
  trackersUnsub = onSnapshot(q, snapshot => {
    allTrackers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    UI.trackersGrid.innerHTML = snapshot.empty ? `<p class="text-center text-gray-400 col-span-full">No trackers yet — create one in Settings.</p>` : '';
    allTrackers.forEach(tr => {
      const card = document.createElement('div');
      card.className = 'bg-gray-800 p-5 rounded-xl shadow cursor-pointer';
      card.innerHTML = `<h3 class="text-lg text-purple-400 font-semibold text-center">${tr.name}</h3>`;
      card.addEventListener('click', ()=> openTracker(tr.id));
      UI.trackersGrid.appendChild(card);
    });
  }, err=> console.error('renderTrackers', err));
}

async function handleCreateTracker(){
  const name = UI.newTrackerName.value.trim(); if (!name) return alert('Enter tracker name');
  try {
    await addDoc(collection(db, 'users', userId, 'trackers'), { name, createdAt: serverTimestamp(), taskColumns: ['Videos','Notes','PYQs'] });
    UI.newTrackerName.value = '';
    showDashboardPage();
  } catch(e){ console.error(e); alert('Failed to create tracker'); }
}

async function openTracker(trackerId, parentId='root'){
  currentTrackerId = trackerId; currentParentId = parentId;
  const tdoc = await getDoc(doc(db,'users', userId, 'trackers', trackerId));
  if (!tdoc.exists()) { return showDashboardPage(); }
  currentTrackerData = tdoc.data();
  UI.trackerTitle.textContent = currentTrackerData.name;
  if (parentId === 'root') breadcrumbs = [{ id:'root', name: currentTrackerData.name }];
  renderBreadcrumbs();
  showTrackerPage();
  if (itemsUnsub) itemsUnsub();
  const q = query(collection(db, 'users', userId, 'trackers', trackerId, 'items'), where('parentId','==', currentParentId), orderBy('createdAt','asc'));
  itemsUnsub = onSnapshot(q, snap => {
    UI.itemsContainer.innerHTML = snap.empty ? `<p class="text-gray-400">This folder is empty.</p>` : '';
    snap.forEach(docSnap => {
      const item = { id: docSnap.id, ...docSnap.data() };
      const el = createItemCard(item, currentTrackerData.taskColumns || []);
      UI.itemsContainer.appendChild(el);
    });
    UI.itemsContainer.querySelectorAll('.edit-item-btn').forEach(b=> b.addEventListener('click', (e)=> { e.stopPropagation(); openItemModal(b.dataset.id); }));
    UI.itemsContainer.querySelectorAll('.delete-item-btn').forEach(b=> b.addEventListener('click', (e)=> { e.stopPropagation(); openDeleteModal(b.dataset.id); }));
    UI.itemsContainer.querySelectorAll('input[type="checkbox"]').forEach(box=> box.addEventListener('change', handleTaskCheck));
  }, err=> console.error('items snapshot', err));
}

function createItemCard(item, taskColumns){
  const card = document.createElement('div');
  card.className = 'item-card bg-gray-800 p-4 rounded-lg shadow';
  if (item.type === 'FOLDER'){
    card.classList.add('cursor-pointer');
    card.addEventListener('click', ()=> { breadcrumbs.push({id:item.id, name: item.name}); openTracker(currentTrackerId, item.id); });
    card.innerHTML = `<div class="flex justify-between items-center"><div class="flex items-center gap-3"><span class="text-2xl">📁</span><span class="font-semibold">${item.name}</span></div><div class="context-menu-btn"><button data-id="${item.id}" class="edit-item-btn p-1">✏️</button><button data-id="${item.id}" class="delete-item-btn p-1">🗑️</button></div></div>`;
    return card;
  }
  const taskCols = taskColumns || [];
  const total = taskCols.length;
  const completed = Object.values(item.tasks || {}).filter(Boolean).length;
  const progress = total > 0 ? Math.round((completed/total)*100) : 0;
  if (progress === 100) card.classList.add('is-complete');
  let checklist = '<div class="grid grid-cols-2 gap-2 mt-3">';
  taskCols.forEach(col => {
    const checked = item.tasks?.[col] ? 'checked' : '';
    checklist += `<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-id="${item.id}" data-task="${col}" ${checked} class="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 bg-gray-700 border-gray-600"/> <span>${col}</span></label>`;
  });
  checklist += '</div>';
  card.innerHTML = `<div class="flex justify-between items-center"><span class="font-semibold">${item.name}</span><div class="context-menu-btn"><button data-id="${item.id}" class="edit-item-btn p-1">✏️</button><button data-id="${item.id}" class="delete-item-btn p-1">🗑️</button></div></div><div class="w-full bg-gray-700 rounded-full h-2.5 my-2"><div class="bg-blue-600 h-2.5 rounded-full" style="width:${progress}%"></div></div><p class="text-xs text-right text-gray-400">${completed} / ${total} tasks complete</p>${checklist}`;
  return card;
}

async function handleTaskCheck(e){
  const id = e.target.dataset.id, task = e.target.dataset.task, checked = e.target.checked;
  await updateDoc(doc(db,'users',userId,'trackers', currentTrackerId,'items', id), { [`tasks.${task}`]: checked });
}

let editingItemId = null;
function openItemModal(itemId=null){
  editingItemId = itemId;
  if (itemId){
    (async ()=> {
      const itemSnap = await getDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', itemId));
      const data = itemSnap.data();
      UI.itemNameInput.value = data.name || '';
      UI.itemTypeCheckbox.checked = data.type === 'FOLDER';
      document.getElementById('modal-title').textContent = 'Edit Item';
    })();
  } else {
    UI.itemNameInput.value = '';
    UI.itemTypeCheckbox.checked = false;
    document.getElementById('modal-title').textContent = 'Create New Item';
  }
  UI.itemModal.classList.remove('hidden');
  document.getElementById('save-item-btn').onclick = saveItem;
}

async function saveItem(){
  const name = UI.itemNameInput.value.trim(); if (!name) return alert('Provide name');
  const type = UI.itemTypeCheckbox.checked ? 'FOLDER' : 'ITEM';
  const colRef = collection(db,'users',userId,'trackers',currentTrackerId,'items');
  try {
    if (editingItemId) {
      await updateDoc(doc(colRef, editingItemId), { name, type });
    } else {
      await addDoc(colRef, { name, type, parentId: currentParentId, createdAt: serverTimestamp(), tasks: {} });
    }
    UI.itemModal.classList.add('hidden');
  } catch(e){ console.error(e); alert('Failed to save item'); }
}

let deletingId = null, deletingIsTracker = false;
async function openDeleteModal(id, isTracker=false){
  deletingId = id; deletingIsTracker = isTracker;
  if (isTracker){
    const t = allTrackers.find(t=>t.id===id);
    UI.deleteText.textContent = `Delete tracker "${t.name}"? This will remove all its items.`;
  } else {
    const itemSnap = await getDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', id));
    UI.deleteText.textContent = `Delete "${itemSnap.data().name}"?`;
  }
  UI.deleteModal.classList.remove('hidden');
  document.getElementById('confirm-delete-btn').onclick = confirmDelete;
}
async function confirmDelete(){
  if (deletingIsTracker){
    alert('Tracker deletion is disabled for safety.');
    UI.deleteModal.classList.add('hidden');
    return;
  }
  await deleteDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', deletingId));
  UI.deleteModal.classList.add('hidden');
}

function populateTrackerSelect(){
  UI.trackerSelect.innerHTML = '<option value="">-- Select tracker --</option>';
  allTrackers.forEach(t => UI.trackerSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name}</option>`));
  UI.taskColumnsEditor.innerHTML = '';
  document.getElementById('delete-tracker-btn')?.classList.add('hidden');
}
function renderTaskColumnsEditor(trackerId){
  if (!trackerId) { UI.taskColumnsEditor.innerHTML = ''; return; }
  const t = allTrackers.find(x => x.id === trackerId); if (!t) return;
  let html = '<h4 class="font-semibold mb-2">Task Columns</h4>';
  (t.taskColumns || []).forEach((col, idx) => {
    html += `<div class="flex gap-2 mb-2"><input class="task-column-input flex-1 p-2 rounded bg-gray-700" data-index="${idx}" value="${col}" /><button data-index="${idx}" class="remove-col-btn px-3 rounded bg-red-600">Remove</button></div>`;
  });
  html += `<div class="flex gap-2 mt-2"><input id="new-task-column" placeholder="New column name" class="flex-1 p-2 rounded bg-gray-700" /><button id="add-column-btn" class="px-3 rounded bg-blue-600">Add</button></div>`;
  UI.taskColumnsEditor.innerHTML = html;

  UI.taskColumnsEditor.querySelectorAll('.task-column-input').forEach(inp => inp.addEventListener('change', (e) => {
    const idx = Number(e.target.dataset.index);
    t.taskColumns[idx] = e.target.value.trim();
    updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
  }));
  UI.taskColumnsEditor.querySelectorAll('.remove-col-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const idx = Number(e.target.dataset.index);
    t.taskColumns.splice(idx,1);
    updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
    renderTaskColumnsEditor(trackerId);
  }));
  document.getElementById('add-column-btn').addEventListener('click', () => {
    const v = document.getElementById('new-task-column').value.trim(); if (!v) return;
    t.taskColumns = t.taskColumns || [];
    t.taskColumns.push(v);
    updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
    renderTaskColumnsEditor(trackerId);
  });
  document.getElementById('delete-tracker-btn').classList.remove('hidden');
  document.getElementById('delete-tracker-btn').onclick = ()=> openDeleteModal(trackerId, true);
}

function renderBreadcrumbs(){
  UI.breadcrumbsEl.innerHTML = '';
  breadcrumbs.forEach((c, idx) => {
    const a = document.createElement('a'); a.className = 'cursor-pointer text-purple-400'; a.textContent = c.name;
    a.addEventListener('click', ()=> openTracker(currentTrackerId, c.id));
    UI.breadcrumbsEl.appendChild(a);
    if (idx < breadcrumbs.length-1) UI.breadcrumbsEl.append(' / ');
  });
}
function handleBack(){
  if (breadcrumbs.length > 1){
    breadcrumbs.pop();
    const prev = breadcrumbs[breadcrumbs.length-1];
    openTracker(currentTrackerId, prev.id);
  } else {
    showDashboardPage();
  }
}