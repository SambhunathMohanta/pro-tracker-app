// app.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, where, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence for Firestore (best-effort)
try { enableIndexedDbPersistence(db).catch(()=>{}); } catch(e){}

// App state
let userId = null;
let trackersUnsub = null;
let itemsUnsub = null;
let currentTrackerId = null;
let currentParentId = 'root';
let breadcrumbs = [];
let allTrackers = [];

// UI refs
const loader = document.getElementById('loader-overlay');
const loaderPct = document.getElementById('loader-percentage');
const appContainer = document.getElementById('app');
const profilePic = document.getElementById('profile-pic');
const defaultPicIcon = document.getElementById('default-pic-icon');
const profileContainer = document.getElementById('profile-pic-container');
const uploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');
const welcomeMessage = document.getElementById('welcome-message');

const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');
const trackerPage = document.getElementById('tracker-page');

const trackersGrid = document.getElementById('trackers-grid');
const createTrackerBtn = document.getElementById('create-tracker-btn');
const newTrackerName = document.getElementById('new-tracker-name');
const trackerSelect = document.getElementById('tracker-select');
const taskColumnsEditor = document.getElementById('task-columns-editor');
const displayNameInput = document.getElementById('display-name-input');
const signoutBtn = document.getElementById('signout-btn');

const backBtn = document.getElementById('back-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const addNewItemBtn = document.getElementById('add-new-item-btn');
const itemsContainer = document.getElementById('items-container');
const trackerTitle = document.getElementById('tracker-title');
const breadcrumbsEl = document.getElementById('breadcrumbs');

const itemModal = document.getElementById('item-modal');
const cancelItemBtn = document.getElementById('cancel-item-btn');
const saveItemBtn = document.getElementById('save-item-btn');
const itemNameInput = document.getElementById('item-name-input');
const itemTypeCheckbox = document.getElementById('item-type-checkbox');

const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteText = document.getElementById('delete-text');

// loader simulate
let pct = 0;
const loaderInterval = setInterval(()=> {
  pct = Math.min(100, pct + 4);
  loaderPct.textContent = pct + '%';
  if (pct >= 100) {
    clearInterval(loaderInterval);
  }
}, 60);

// Auth & init
onAuthStateChanged(auth, user => {
  if (!user) {
    signInAnonymously(auth).catch(err => console.error(err));
    return;
  }
  userId = user.uid;
  initApp();
});

function initApp(){
  // hide loader after short delay
  setTimeout(()=> { loader.classList.add('loader-hide'); appContainer.style.opacity = '1'; }, 700);

  attachListeners();
  loadUserProfile();
  renderTrackers();
  // push initial history state
  window.history.replaceState({page:'dashboard'}, '');
}

// Attach UI listeners
function attachListeners(){
  profileContainer.addEventListener('click', ()=> uploadInput.click());
  uploadBtn.addEventListener('click', ()=> uploadInput.click());
  uploadInput.addEventListener('change', (e)=> handlePhotoUpload(e));
  createTrackerBtn.addEventListener('click', handleCreateTracker);
  displayNameInput.addEventListener('change', (e)=> updateDisplayName(e.target.value));
  signoutBtn.addEventListener('click', async ()=> { await signOut(auth); location.reload(); });
  document.getElementById('settings-btn').addEventListener('click', ()=> { showSettingsPage(); window.history.pushState({page:'settings'}, ''); });
  backBtn.addEventListener('click', handleBack);
  backToDashboardBtn.addEventListener('click', ()=> { showDashboardPage(); window.history.pushState({page:'dashboard'}, ''); });
  addNewItemBtn.addEventListener('click', ()=> openItemModal());
  cancelItemBtn.addEventListener('click', ()=> itemModal.classList.add('hidden'));
  cancelDeleteBtn.addEventListener('click', ()=> deleteModal.classList.add('hidden'));
  window.addEventListener('popstate', (e)=> {
    const s = e.state?.page || 'dashboard';
    if (s === 'dashboard') showDashboardPage();
    else if (s === 'settings') showSettingsPage();
    else if (s === 'tracker') showTrackerPage();
  });
}

// UI view toggles
function showDashboardPage(){ dashboardPage.classList.remove('hidden'); settingsPage.classList.add('hidden'); trackerPage.classList.add('hidden'); if (itemsUnsub) itemsUnsub(); }
function showSettingsPage(){ dashboardPage.classList.add('hidden'); settingsPage.classList.remove('hidden'); trackerPage.classList.add('hidden'); populateTrackerSelect(); }
function showTrackerPage(){ dashboardPage.classList.add('hidden'); settingsPage.classList.add('hidden'); trackerPage.classList.remove('hidden'); }

// ---------- Profile -----------------
async function loadUserProfile(){
  try{
    const uref = doc(db, 'users', userId);
    const snap = await getDoc(uref);
    if (snap.exists()){
      const data = snap.data();
      if (data.profilePicUrl){
        profilePic.src = data.profilePicUrl; profilePic.classList.remove('hidden'); defaultPicIcon.classList.add('hidden');
      } else { profilePic.classList.add('hidden'); defaultPicIcon.classList.remove('hidden'); }
      if (data.displayName){
        welcomeMessage.textContent = `Welcome, ${data.displayName}!`;
        displayNameInput.value = data.displayName;
      }
    } else {
      // create user document
      await setDoc(uref, { createdAt: serverTimestamp() }, { merge: true });
    }
  } catch(err){ console.error('loadUserProfile', err); }
}

async function handlePhotoUpload(event){
  const file = event.target.files?.[0]; if (!file) return;
  try {
    alert('Uploading picture...');
    const path = `profile-pictures/${userId}/${file.name}`;
    const sref = ref(storage, path);
    await uploadBytes(sref, file);
    const url = await getDownloadURL(sref);
    await setDoc(doc(db,'users',userId), { profilePicUrl: url }, { merge: true });
    await loadUserProfile();
    alert('Profile picture updated!');
  } catch(err){
    console.error('upload error', err);
    alert('Upload failed. Check network / Firebase rules.');
  }
}

async function updateDisplayName(name){
  try { await setDoc(doc(db,'users',userId), { displayName: name }, { merge: true }); welcomeMessage.textContent = `Welcome, ${name}!`; } catch(e){ console.error(e); }
}

// ---------- Trackers CRUD & Render ----------
import { getDoc as getDocFn } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"; // alias if needed

function renderTrackers(){
  if (trackersUnsub) trackersUnsub();
  trackersGrid.innerHTML = '';
  const q = query(collection(db, 'users', userId, 'trackers'), orderBy('createdAt','desc'));
  trackersUnsub = onSnapshot(q, snapshot => {
    allTrackers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (snapshot.empty) {
      trackersGrid.innerHTML = `<p class="text-center text-gray-400 col-span-full">No trackers yet — create one in Settings.</p>`;
      return;
    }
    trackersGrid.innerHTML = '';
    allTrackers.forEach(tr => {
      const card = document.createElement('div');
      card.className = 'bg-gray-800 p-5 rounded-xl shadow cursor-pointer';
      card.innerHTML = `<h3 class="text-lg text-purple-400 font-semibold text-center">${tr.name}</h3>`;
      card.addEventListener('click', ()=> { openTracker(tr.id); window.history.pushState({page:'tracker'}, ''); });
      trackersGrid.appendChild(card);
    });
  }, err=> console.error('renderTrackers', err));
}

async function handleCreateTracker(){
  const name = newTrackerName.value.trim(); if (!name) return alert('Enter tracker name');
  try {
    await addDoc(collection(db, 'users', userId, 'trackers'), { name, createdAt: serverTimestamp(), taskColumns: ['Videos','Notes','PYQs','DPPs','Test Series','Revision'] });
    newTrackerName.value = '';
    showDashboardPage();
  } catch(e){ console.error(e); alert('Failed to create tracker'); }
}

// ---------- Open tracker and render items ----------
async function openTracker(trackerId, parentId='root'){
  currentTrackerId = trackerId; currentParentId = parentId;
  const tdoc = await getDoc(doc(db,'users', userId, 'trackers', trackerId));
  if (!tdoc.exists()) { return showDashboardPage(); }
  const tdata = tdoc.data();
  trackerTitle.textContent = tdata.name;
  // breadcrumbs
  if (parentId === 'root') breadcrumbs = [{ id:'root', name: tdata.name }];
  renderBreadcrumbs();
  showTrackerPage();

  // Items snapshot
  if (itemsUnsub) itemsUnsub();
  const q = query(collection(db, 'users', userId, 'trackers', trackerId, 'items'), where('parentId','==', currentParentId), orderBy('createdAt','asc'));
  itemsUnsub = onSnapshot(q, snap => {
    itemsContainer.innerHTML = snap.empty ? `<p class="text-gray-400">This folder is empty.</p>` : '';
    snap.forEach(docSnap => {
      const item = { id: docSnap.id, ...docSnap.data() };
      const el = createItemCard(item, tdata.taskColumns || []);
      itemsContainer.appendChild(el);
    });
    // add listeners for action buttons
    itemsContainer.querySelectorAll('.edit-item-btn').forEach(b=> b.addEventListener('click', (e)=> { e.stopPropagation(); openItemModal(b.dataset.id); }));
    itemsContainer.querySelectorAll('.delete-item-btn').forEach(b=> b.addEventListener('click', (e)=> { e.stopPropagation(); openDeleteModal(b.dataset.id); }));
    itemsContainer.querySelectorAll('input[type="checkbox"]').forEach(box=> box.addEventListener('change', handleTaskCheck));
  }, err=> console.error('items snapshot', err));
}

function createItemCard(item, taskColumns){
  const card = document.createElement('div');
  card.className = 'item-card bg-gray-800 p-4 rounded-lg shadow';
  if (item.type === 'FOLDER'){
    card.classList.add('cursor-pointer');
    card.addEventListener('click', ()=> { breadcrumbs.push({id:item.id, name: item.name}); openTracker(currentTrackerId, item.id); window.history.pushState({page:'tracker'}, ''); });
    card.innerHTML = `<div class="flex justify-between items-center"><div class="flex items-center gap-3"><span class="text-2xl">📁</span><span class="font-semibold">${item.name}</span></div><div class="context-menu-btn"><button data-id="${item.id}" class="edit-item-btn">✏️</button><button data-id="${item.id}" class="delete-item-btn">🗑️</button></div></div>`;
    return card;
  }
  // ITEM with checklist
  const taskCols = taskColumns || [];
  const total = taskCols.length;
  const completed = Object.values(item.tasks || {}).filter(Boolean).length;
  const progress = total > 0 ? Math.round((completed/total)*100) : 0;
  if (progress === 100) card.classList.add('is-complete');

  let checklist = '<div class="grid grid-cols-2 gap-2 mt-3">';
  taskCols.forEach(col => {
    const checked = item.tasks?.[col] ? 'checked' : '';
    checklist += `<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-id="${item.id}" data-task="${col}" ${checked} /> <span>${col}</span></label>`;
  });
  checklist += '</div>';

  card.innerHTML = `<div class="flex justify-between items-center"><span class="font-semibold">${item.name}</span><div class="context-menu-btn"><button data-id="${item.id}" class="edit-item-btn">✏️</button><button data-id="${item.id}" class="delete-item-btn">🗑️</button></div></div>
    <div class="w-full bg-gray-700 rounded-full h-2.5 my-2"><div class="bg-blue-600 h-2.5 rounded-full" style="width:${progress}%"></div></div>
    <p class="text-xs text-right text-gray-400">${completed} / ${total} tasks complete</p>
    ${checklist}`;

  return card;
}

// Task checkbox change
async function handleTaskCheck(e){
  const id = e.target.dataset.id;
  const task = e.target.dataset.task;
  const checked = e.target.checked;
  try {
    const itemRef = doc(db,'users',userId,'trackers', currentTrackerId,'items', id);
    await updateDoc(itemRef, { [`tasks.${task}`]: checked });
  } catch(err){ console.error(err); }
}

// ---------- Item modal handling ----------
let editingItemId = null;
function openItemModal(itemId=null){
  editingItemId = itemId;
  if (itemId){
    // edit mode: load item
    (async ()=> {
      const itemSnap = await getDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', itemId));
      const data = itemSnap.data();
      itemNameInput.value = data.name || '';
      itemTypeCheckbox.checked = data.type === 'FOLDER';
      document.getElementById('modal-title').textContent = 'Edit Item';
    })();
  } else {
    itemNameInput.value = '';
    itemTypeCheckbox.checked = false;
    document.getElementById('modal-title').textContent = 'Create New Item';
  }
  itemModal.classList.remove('hidden');
  saveItemBtn.onclick = saveItem;
}

async function saveItem(){
  const name = itemNameInput.value.trim(); if (!name) return alert('Provide name');
  const type = itemTypeCheckbox.checked ? 'FOLDER' : 'ITEM';
  const colRef = collection(db,'users',userId,'trackers',currentTrackerId,'items');
  try {
    if (editingItemId) {
      await updateDoc(doc(colRef, editingItemId), { name, type });
    } else {
      await addDoc(colRef, { name, type, parentId: currentParentId, createdAt: serverTimestamp(), tasks: {} });
    }
    itemModal.classList.add('hidden');
  } catch(e){
    console.error(e);
    alert('Failed to save item');
  }
}

// Delete modal
let deletingId = null, deletingIsTracker = false;
async function openDeleteModal(id, isTracker=false){
  deletingId = id; deletingIsTracker = isTracker;
  if (isTracker){
    const t = allTrackers.find(t=>t.id===id);
    deleteText.textContent = `Delete tracker "${t.name}"? This will remove all its items.`;
  } else {
    const itemSnap = await getDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', id));
    deleteText.textContent = `Delete "${itemSnap.data().name}"?`;
  }
  deleteModal.classList.remove('hidden');
  confirmDeleteBtn.onclick = confirmDelete;
}
async function confirmDelete(){
  if (deletingIsTracker){
    // For safety simple alert - implementing recursive deletion in client is possible but expensive
    alert('Tracker deletion is disabled in UI for safety. Please delete items or use console tools.');
    deleteModal.classList.add('hidden');
    return;
  }
  try {
    await deleteDoc(doc(db,'users',userId,'trackers',currentTrackerId,'items', deletingId));
    deleteModal.classList.add('hidden');
  } catch(e){
    console.error(e); alert('Delete failed');
  }
}

// ---------- Task Columns editor (settings) ----------
function populateTrackerSelect(){
  trackerSelect.innerHTML = '<option value="">-- Select tracker --</option>';
  allTrackers.forEach(t => trackerSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name}</option>`));
  taskColumnsEditor.innerHTML = '';
  document.getElementById('delete-tracker-btn').classList.add('hidden');
}
trackerSelect.addEventListener('change', ()=> renderTaskColumnsEditor(trackerSelect.value));

async function renderTaskColumnsEditor(trackerId){
  if (!trackerId) { taskColumnsEditor.innerHTML = ''; return; }
  const t = allTrackers.find(x => x.id === trackerId);
  if (!t) return;
  let html = '<h4 class="font-semibold mb-2">Task Columns</h4>';
  (t.taskColumns || []).forEach((col, idx) => {
    html += `<div class="flex gap-2 mb-2"><input class="task-column-input flex-1 p-2 rounded bg-gray-700" data-index="${idx}" value="${col}" /><button data-index="${idx}" class="remove-col-btn px-3 rounded bg-red-600">Remove</button></div>`;
  });
  html += `<div class="flex gap-2 mt-2"><input id="new-task-column" placeholder="New column name" class="flex-1 p-2 rounded bg-gray-700" /><button id="add-column-btn" class="px-3 rounded bg-blue-600">Add</button></div>`;
  taskColumnsEditor.innerHTML = html;

  // attach events
  taskColumnsEditor.querySelectorAll('.task-column-input').forEach(inp => inp.addEventListener('change', async (e) => {
    const idx = Number(e.target.dataset.index);
    t.taskColumns[idx] = e.target.value.trim();
    await updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
  }));
  taskColumnsEditor.querySelectorAll('.remove-col-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const idx = Number(e.target.dataset.index);
    t.taskColumns.splice(idx,1);
    await updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
    renderTaskColumnsEditor(trackerId);
  }));
  document.getElementById('add-column-btn').addEventListener('click', async () => {
    const v = document.getElementById('new-task-column').value.trim(); if (!v) return;
    t.taskColumns = t.taskColumns || [];
    t.taskColumns.push(v);
    await updateDoc(doc(db,'users',userId,'trackers',trackerId), { taskColumns: t.taskColumns });
    renderTaskColumnsEditor(trackerId);
  });
}

// ---------- Misc: render breadcrumbs & back ----------
function renderBreadcrumbs(){
  breadcrumbsEl.innerHTML = '';
  breadcrumbs.forEach((c, idx) => {
    const a = document.createElement('a'); a.className = 'cursor-pointer text-purple-400'; a.textContent = c.name;
    a.addEventListener('click', ()=> openTracker(currentTrackerId, c.id));
    breadcrumbsEl.appendChild(a);
    if (idx < breadcrumbs.length-1) breadcrumbsEl.append(' / ');
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
