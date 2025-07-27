// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = { apiKey: "AIzaSyA_9LWNHTUYjW9o5ZgBoEfQqdtYhIUIX0s", authDomain: "gate-tracker-final.firebaseapp.com", projectId: "gate-tracker-final", storageBucket: "gate-tracker-final.firebasestorage.app", messagingSenderId: "586102213734", appId: "1:586102213734:web:88fa9b3a3f0e421b9131a7" };

// --- GLOBAL STATE ---
let app, db, auth, storage, userId;
let trackersUnsubscribe = null, itemsUnsubscribe = null;
let currentTrackerId = null, currentTrackerData = null, currentParentId = 'root';
let breadcrumbs = [];
let allTrackers = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderCircle = document.querySelector('.loader-circle');
    let currentPercent = 0;
    const interval = setInterval(() => {
        if (currentPercent < 100) { currentPercent++; loaderPercentage.textContent = `${currentPercent}%`; const hue = (currentPercent / 100) * 120; loaderCircle.style.background = `conic-gradient(hsl(${hue}, 70%, 50%) ${currentPercent}%, #1f2937 ${currentPercent}%)`; } else { clearInterval(interval); }
    }, 20);

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app); auth = getAuth(app); storage = getStorage(app);
        onAuthStateChanged(auth, user => {
            if (!user) { signInAnonymously(auth); return; }
            userId = user.uid;
            attachEventListeners();
            loadUserProfile();
            renderTrackers();
            setTimeout(() => { document.getElementById('loader-overlay').classList.add('hidden'); document.getElementById('app-container').style.opacity = '1'; }, 2200);
        });
    } catch (error) { console.error("Firebase Init Error:", error); }
});

// --- EVENT LISTENERS ---
function attachEventListeners() {
    document.getElementById('settings-btn').addEventListener('click', showSettingsPage);
    document.getElementById('back-to-dashboard-btn').addEventListener('click', showDashboardPage);
    document.getElementById('back-btn').addEventListener('click', handleBackNavigation);
    document.getElementById('create-tracker-btn').addEventListener('click', handleCreateTracker);
    document.getElementById('profile-pic-container').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    document.getElementById('add-new-item-btn').addEventListener('click', () => openItemModal());
    document.getElementById('cancel-item-btn').addEventListener('click', () => document.getElementById('item-modal').classList.add('hidden'));
    document.getElementById('cancel-delete-btn').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
    document.getElementById('tracker-select').addEventListener('change', (e) => renderTaskColumnsEditor(e.target.value));
    document.getElementById('delete-tracker-btn').addEventListener('click', handleDeleteTracker);
    document.getElementById('display-name-input').addEventListener('change', (e) => updateDisplayName(e.target.value));
}

// --- PAGE NAVIGATION ---
function showDashboardPage() { document.getElementById('dashboard-page').classList.remove('hidden'); document.getElementById('settings-page').classList.add('hidden'); document.getElementById('tracker-page').classList.add('hidden'); if (itemsUnsubscribe) itemsUnsubscribe(); }
function showSettingsPage() { document.getElementById('dashboard-page').classList.add('hidden'); document.getElementById('settings-page').classList.remove('hidden'); document.getElementById('tracker-page').classList.add('hidden'); populateTrackerSelect(); }
function showTrackerPage() { document.getElementById('dashboard-page').classList.add('hidden'); document.getElementById('settings-page').classList.add('hidden'); document.getElementById('tracker-page').classList.remove('hidden'); }

function handleBackNavigation() {
    if (breadcrumbs.length > 1) {
        breadcrumbs.pop();
        const prevCrumb = breadcrumbs[breadcrumbs.length - 1];
        openTracker(currentTrackerId, prevCrumb.id);
    } else {
        showDashboardPage();
    }
}

// --- RENDER FUNCTIONS ---
function renderTrackers() {
    if (trackersUnsubscribe) trackersUnsubscribe();
    const trackersGrid = document.getElementById('trackers-grid');
    const q = query(collection(db, "users", userId, "trackers"), orderBy("createdAt", "desc"));
    trackersUnsubscribe = onSnapshot(q, (snapshot) => {
        allTrackers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        trackersGrid.innerHTML = snapshot.empty ? `<p class="text-center col-span-full text-gray-500">No trackers yet. Go to settings!</p>` : '';
        allTrackers.forEach(tracker => {
            const card = document.createElement('div');
            card.className = 'bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            card.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-400">${tracker.name}</h3>`;
            card.addEventListener('click', () => openTracker(tracker.id));
            trackersGrid.appendChild(card);
        });
    });
}

async function openTracker(trackerId, parentId = 'root') {
    currentTrackerId = trackerId; currentParentId = parentId;
    const trackerDoc = await getDoc(doc(db, "users", userId, "trackers", trackerId));
    if (!trackerDoc.exists()) return showDashboardPage();
    currentTrackerData = trackerDoc.data();
    
    document.getElementById('tracker-title').textContent = currentTrackerData.name;
    if (parentId === 'root') { breadcrumbs = [{ id: 'root', name: currentTrackerData.name }]; }
    
    showTrackerPage();
    renderBreadcrumbs();
    
    if (itemsUnsubscribe) itemsUnsubscribe();
    const itemsContainer = document.getElementById('items-container');
    const q = query(collection(db, "users", userId, "trackers", trackerId, "items"), where("parentId", "==", currentParentId), orderBy("createdAt"));
    
    itemsUnsubscribe = onSnapshot(q, (snapshot) => {
        itemsContainer.innerHTML = snapshot.empty ? `<p class="text-center text-gray-500">This folder is empty.</p>` : '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const el = document.createElement('div');
            el.className = 'item-card bg-gray-800 p-4 rounded-lg shadow';
            
            let contentHTML = '';
            if (item.type === 'FOLDER') {
                el.classList.add('cursor-pointer', 'hover:bg-gray-700');
                el.addEventListener('click', (e) => { if (e.target.closest('button')) return; breadcrumbs.push({ id: doc.id, name: item.name }); openTracker(trackerId, doc.id); });
                contentHTML = `<div class="flex justify-between items-center"><div class="flex items-center space-x-3"><span class="text-2xl">📁</span><span class="font-semibold">${item.name}</span></div><div class="item-card-actions space-x-2"><button data-id="${doc.id}" class="edit-item-btn p-1 rounded-full text-xs hover:bg-gray-600">✏️</button><button data-id="${doc.id}" class="delete-item-btn p-1 rounded-full text-xs hover:bg-gray-600">🗑️</button></div></div>`;
            } else { // ITEM
                const taskColumns = item.taskColumns || currentTrackerData.taskColumns;
                const totalTasks = taskColumns.length;
                const completedTasks = Object.values(item.tasks || {}).filter(Boolean).length;
                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                if(progress === 100) el.classList.add('is-complete');

                let checklistHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">';
                taskColumns.forEach(task => {
                    const isChecked = item.tasks?.[task] || false;
                    checklistHTML += `<label class="flex items-center space-x-2 text-sm"><input type="checkbox" data-id="${doc.id}" data-task="${task}" class="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 bg-gray-700 border-gray-600" ${isChecked ? 'checked' : ''}><span>${task}</span></label>`;
                });
                checklistHTML += '</div>';
                contentHTML = `<div class="flex justify-between items-center"><span class="font-semibold">${item.name}</span><div class="item-card-actions space-x-2"><button data-id="${doc.id}" class="edit-item-btn p-1 rounded-full text-xs hover:bg-gray-600">✏️</button><button data-id="${doc.id}" class="delete-item-btn p-1 rounded-full text-xs hover:bg-gray-600">🗑️</button></div></div><div class="w-full bg-gray-700 rounded-full h-2.5 my-2"><div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progress}%"></div></div><p class="text-xs text-right text-gray-400">${completedTasks} / ${totalTasks} tasks complete</p>${checklistHTML}`;
            }
            el.innerHTML = contentHTML;
            itemsContainer.appendChild(el);
        });
        
        document.querySelectorAll('.edit-item-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openItemModal(btn.dataset.id); }));
        document.querySelectorAll('.delete-item-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openDeleteModal(btn.dataset.id); }));
        document.querySelectorAll('input[type="checkbox"]').forEach(box => box.addEventListener('change', handleTaskCheck));
    });
}
function renderBreadcrumbs() {
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    breadcrumbsContainer.innerHTML = '';
    breadcrumbs.forEach((crumb) => {
        const el = document.createElement('a');
        el.className = 'cursor-pointer hover:underline text-purple-400';
        el.textContent = crumb.name;
        el.onclick = () => openTracker(currentTrackerId, crumb.id);
        breadcrumbsContainer.appendChild(el);
        breadcrumbsContainer.append(' / ');
    });
    breadcrumbsContainer.removeChild(breadcrumbsContainer.lastChild);
}

// --- DATA HANDLING ---
async function handleCreateTracker() {
    const name = document.getElementById('new-tracker-name').value.trim(); if (!name) return;
    await addDoc(collection(db, "users", userId, "trackers"), { name, createdAt: serverTimestamp(), taskColumns: ['Videos', 'Notes', 'PYQs'] });
    document.getElementById('new-tracker-name').value = ''; showDashboardPage();
}
async function openItemModal(itemId = null) {
    const modal = document.getElementById('item-modal'); const nameInput = document.getElementById('item-name-input'); const typeCheckbox = document.getElementById('item-type-checkbox'); const saveBtn = document.getElementById('save-item-btn');
    if (itemId) {
        document.getElementById('modal-title').textContent = 'Edit Item';
        const itemDoc = await getDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
        const item = itemDoc.data(); nameInput.value = item.name; typeCheckbox.checked = item.type === 'FOLDER';
    } else {
        document.getElementById('modal-title').textContent = 'Create New Item';
        nameInput.value = ''; typeCheckbox.checked = false;
    }
    saveBtn.onclick = () => saveItem(itemId); modal.classList.remove('hidden');
}
async function saveItem(itemId) {
    const name = document.getElementById('item-name-input').value.trim(); if (!name) return;
    const type = document.getElementById('item-type-checkbox').checked ? 'FOLDER' : 'ITEM';
    const collectionRef = collection(db, "users", userId, "trackers", currentTrackerId, "items");
    try {
        if (itemId) { await updateDoc(doc(collectionRef, itemId), { name, type }); } 
        else { await addDoc(collectionRef, { name, type, parentId: currentParentId, createdAt: serverTimestamp(), tasks: {} }); }
        document.getElementById('item-modal').classList.add('hidden');
    } catch (error) { console.error("Error saving item:", error); }
}
async function openDeleteModal(itemId, isTracker = false) {
    const modal = document.getElementById('delete-modal'); const text = document.getElementById('delete-text'); const confirmBtn = document.getElementById('confirm-delete-btn');
    if (isTracker) {
        const tracker = allTrackers.find(t => t.id === itemId);
        text.textContent = `Delete tracker "${tracker.name}"? This cannot be undone.`;
        confirmBtn.onclick = () => deleteTracker(itemId);
    } else {
        const itemDoc = await getDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
        text.textContent = `Delete "${itemDoc.data().name}"? This cannot be undone.`;
        confirmBtn.onclick = () => deleteItem(itemId);
    }
    modal.classList.remove('hidden');
}
async function deleteItem(itemId) {
    await deleteDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
    document.getElementById('delete-modal').classList.add('hidden');
}
async function handleDeleteTracker() { const trackerId = document.getElementById('tracker-select').value; if (trackerId) openDeleteModal(trackerId, true); }
async function deleteTracker(trackerId) { alert("For safety, deleting entire trackers requires a Cloud Function (a future upgrade). You can delete individual items inside the tracker for now."); document.getElementById('delete-modal').classList.add('hidden'); }
async function handleTaskCheck(event) {
    const { id, task } = event.target.dataset; const isChecked = event.target.checked;
    await updateDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", id), { [`tasks.${task}`]: isChecked });
}
async function populateTrackerSelect() {
    const trackerSelect = document.getElementById('tracker-select');
    trackerSelect.innerHTML = '<option value="">-- Select a Tracker to Edit --</option>';
    allTrackers.forEach(tracker => { trackerSelect.innerHTML += `<option value="${tracker.id}">${tracker.name}</option>`; });
    document.getElementById('task-columns-editor').innerHTML = ''; document.getElementById('delete-tracker-btn').classList.add('hidden');
}
async function renderTaskColumnsEditor(trackerId) {
    const editorDiv = document.getElementById('task-columns-editor'); const deleteBtn = document.getElementById('delete-tracker-btn');
    if (!trackerId) { editorDiv.innerHTML = ''; deleteBtn.classList.add('hidden'); return; }
    const trackerData = allTrackers.find(t => t.id === trackerId);
    let columnsHTML = '<h4 class="text-md font-semibold mt-4 mb-2">Task Columns</h4>';
    trackerData.taskColumns.forEach((col, index) => {
        columnsHTML += `<div class="flex items-center space-x-2 mb-2"><input type="text" value="${col}" data-index="${index}" class="task-column-input flex-grow p-2 border rounded-md bg-gray-700 border-gray-600"><button data-index="${index}" class="delete-column-btn text-red-500 hover:text-red-400">🗑️</button></div>`;
    });
    columnsHTML += `<div class="flex items-center space-x-2 mt-3"><input type="text" id="new-task-column" placeholder="New column name" class="flex-grow p-2 border rounded-md bg-gray-700 border-gray-600"><button id="add-column-btn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Add</button></div>`;
    editorDiv.innerHTML = columnsHTML; deleteBtn.classList.remove('hidden');
    document.querySelectorAll('.task-column-input').forEach(input => input.addEventListener('change', (e) => updateTaskColumn(trackerId, e.target.dataset.index, e.target.value)));
    document.querySelectorAll('.delete-column-btn').forEach(btn => btn.addEventListener('click', (e) => deleteTaskColumn(trackerId, e.target.dataset.index)));
    document.getElementById('add-column-btn').addEventListener('click', () => addTaskColumn(trackerId));
}
async function updateTaskColumn(trackerId, index, newName) { const d = allTrackers.find(t => t.id === trackerId); d.taskColumns[index] = newName.trim(); await updateDoc(doc(db, "users", userId, "trackers", trackerId), { taskColumns: d.taskColumns }); }
async function deleteTaskColumn(trackerId, index) { const d = allTrackers.find(t => t.id === trackerId); d.taskColumns.splice(index, 1); await updateDoc(doc(db, "users", userId, "trackers", trackerId), { taskColumns: d.taskColumns }); renderTaskColumnsEditor(trackerId); }
async function addTaskColumn(trackerId) { const newName = document.getElementById('new-task-column').value.trim(); if (newName) { const d = allTrackers.find(t => t.id === trackerId); d.taskColumns.push(newName); await updateDoc(doc(db, "users", userId, "trackers", trackerId), { taskColumns: d.taskColumns }); renderTaskColumnsEditor(trackerId); } }
async function loadUserProfile() {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().profilePicUrl) {
        document.getElementById('profile-pic').src = docSnap.data().profilePicUrl;
        document.getElementById('profile-pic').classList.remove('hidden'); document.getElementById('default-pic-icon').classList.add('hidden');
    }
    if (docSnap.exists() && docSnap.data().displayName) {
        document.getElementById('welcome-message').textContent = `Welcome, ${docSnap.data().displayName}!`;
        document.getElementById('display-name-input').value = docSnap.data().displayName;
    }
}
async function updateDisplayName(name) { await setDoc(doc(db, "users", userId), { displayName: name.trim() }, { merge: true }); document.getElementById('welcome-message').textContent = `Welcome, ${name.trim()}!`; }
async function handlePhotoUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    alert("Uploading picture...");
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await setDoc(doc(db, "users", userId), { profilePicUrl: downloadURL }, { merge: true });
    loadUserProfile();
    alert("Profile picture updated!");
}