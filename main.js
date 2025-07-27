import { db, handleAuthentication, loadProfilePicture, handlePhotoUpload } from './auth.js';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- GLOBAL STATE ---
let userId;
let trackersUnsubscribe = null, itemsUnsubscribe = null;
let currentTrackerId = null, currentTrackerData = null, currentParentId = 'root';
let breadcrumbs = [];
let isEditMode = false;

// --- DOM ELEMENTS ---
const allDOMElements = {
    loaderOverlay: document.getElementById('loader-overlay'),
    appContainer: document.getElementById('app-container'),
    dashboardPage: document.getElementById('dashboard-page'),
    settingsPage: document.getElementById('settings-page'),
    trackerPage: document.getElementById('tracker-page'),
    settingsBtn: document.getElementById('settings-btn'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    backToDashboardFromTrackerBtn: document.getElementById('back-to-dashboard-from-tracker-btn'),
    createTrackerBtn: document.getElementById('create-tracker-btn'),
    trackersGrid: document.getElementById('trackers-grid'),
    photoUpload: document.getElementById('photo-upload'),
    addItemBtn: document.getElementById('add-new-item-btn'),
    toggleEditBtn: document.getElementById('toggle-edit-mode-btn')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Start loader animation...
    
    handleAuthentication(uid => {
        userId = uid;
        loadProfilePicture(userId);
        renderTrackers();
        attachEventListeners();
        setTimeout(() => {
            allDOMElements.loaderOverlay.classList.add('hidden');
            allDOMElements.appContainer.style.opacity = '1';
        }, 1000);
    });
});

// --- EVENT LISTENERS ---
function attachEventListeners() {
    allDOMElements.settingsBtn.addEventListener('click', showSettingsPage);
    allDOMElements.backToDashboardBtn.addEventListener('click', showDashboardPage);
    allDOMElements.backToDashboardFromTrackerBtn.addEventListener('click', showDashboardPage);
    allDOMElements.createTrackerBtn.addEventListener('click', createNewTracker);
    document.getElementById('profile-pic-container').addEventListener('click', () => allDOMElements.photoUpload.click());
    document.getElementById('upload-btn').addEventListener('click', () => allDOMElements.photoUpload.click());
    allDOMElements.photoUpload.addEventListener('change', (e) => handlePhotoUpload(e, userId));
    allDOMElements.addItemBtn.addEventListener('click', () => openItemModal());
    allDOMElements.toggleEditBtn.addEventListener('click', toggleEditMode);
    document.getElementById('cancel-item-btn').addEventListener('click', () => document.getElementById('item-modal').classList.add('hidden'));
    document.getElementById('cancel-delete-btn').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
}

// --- PAGE NAVIGATION & UI TOGGLES ---
function showDashboardPage() { allDOMElements.dashboardPage.classList.remove('hidden'); allDOMElements.settingsPage.classList.add('hidden'); allDOMElements.trackerPage.classList.add('hidden'); if (itemsUnsubscribe) itemsUnsubscribe(); }
function showSettingsPage() { allDOMElements.dashboardPage.classList.add('hidden'); allDOMElements.settingsPage.classList.remove('hidden'); allDOMElements.trackerPage.classList.add('hidden'); }
function showTrackerPage() { allDOMElements.dashboardPage.classList.add('hidden'); allDOMElements.settingsPage.classList.add('hidden'); allDOMElements.trackerPage.classList.remove('hidden'); }
function toggleEditMode() { isEditMode = !isEditMode; document.getElementById('items-container').classList.toggle('edit-mode'); }

// --- RENDER FUNCTIONS ---
function renderTrackers() {
    if (trackersUnsubscribe) trackersUnsubscribe();
    const q = query(collection(db, "users", userId, "trackers"), orderBy("createdAt", "desc"));
    trackersUnsubscribe = onSnapshot(q, (snapshot) => {
        allDOMElements.trackersGrid.innerHTML = snapshot.empty ? `<p class="text-center col-span-full text-gray-500">No trackers yet. Go to settings!</p>` : '';
        snapshot.forEach((doc) => {
            const tracker = doc.data();
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            card.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
            card.addEventListener('click', () => openTracker(doc.id));
            allDOMElements.trackersGrid.appendChild(card);
        });
    });
}

async function openTracker(trackerId, parentId = 'root') {
    currentTrackerId = trackerId;
    currentParentId = parentId;
    
    const trackerDoc = await getDoc(doc(db, "users", userId, "trackers", trackerId));
    currentTrackerData = trackerDoc.data();
    
    document.getElementById('tracker-title').textContent = currentTrackerData.name;
    showTrackerPage();
    
    if (parentId === 'root') breadcrumbs = [{ id: 'root', name: currentTrackerData.name }];
    renderBreadcrumbs();
    
    if (itemsUnsubscribe) itemsUnsubscribe();
    const itemsContainer = document.getElementById('items-container');
    const q = query(collection(db, "users", userId, "trackers", trackerId, "items"), where("parentId", "==", currentParentId), orderBy("createdAt"));
    
    itemsUnsubscribe = onSnapshot(q, (snapshot) => {
        itemsContainer.innerHTML = snapshot.empty ? `<p class="text-center text-gray-500">This folder is empty.</p>` : '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const el = document.createElement('div');
            el.className = 'item-card bg-white dark:bg-gray-800 p-4 rounded-lg shadow';
            
            let contentHTML = '';
            if (item.type === 'FOLDER') {
                el.classList.add('cursor-pointer', 'hover:bg-gray-50', 'dark:hover:bg-gray-700');
                el.addEventListener('click', (e) => { if (e.target.closest('button')) return; breadcrumbs.push({ id: doc.id, name: item.name }); openTracker(trackerId, doc.id); });
                contentHTML = `<div class="flex justify-between items-center"><div class="flex items-center space-x-3"><span class="text-2xl">📁</span><span class="font-semibold">${item.name}</span></div><div class="item-card-actions space-x-2"><button data-id="${doc.id}" class="edit-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">✏️</button><button data-id="${doc.id}" class="delete-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">🗑️</button></div></div>`;
            } else {
                const totalTasks = currentTrackerData.taskColumns.length;
                const completedTasks = Object.values(item.tasks || {}).filter(Boolean).length;
                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                if(progress === 100) el.classList.add('is-complete');

                let checklistHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">';
                currentTrackerData.taskColumns.forEach(task => {
                    const isChecked = item.tasks?.[task] || false;
                    checklistHTML += `<label class="flex items-center space-x-2 text-sm"><input type="checkbox" data-id="${doc.id}" data-task="${task}" class="h-4 w-4 rounded text-purple-600 focus:ring-purple-500" ${isChecked ? 'checked' : ''}><span>${task}</span></label>`;
                });
                checklistHTML += '</div>';

                contentHTML = `<div class="flex justify-between items-center"><span class="font-semibold">${item.name}</span><div class="item-card-actions space-x-2"><button data-id="${doc.id}" class="edit-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">✏️</button><button data-id="${doc.id}" class="delete-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">🗑️</button></div></div><div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-2"><div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progress}%"></div></div><p class="text-xs text-right">${completedTasks} / ${totalTasks} tasks complete</p>${checklistHTML}`;
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
    breadcrumbs.forEach((crumb, index) => {
        const el = document.createElement('a');
        el.className = 'cursor-pointer hover:underline';
        el.textContent = crumb.name;
        el.onclick = () => openTracker(currentTrackerId, crumb.id);
        breadcrumbsContainer.appendChild(el);
        if (index < breadcrumbs.length - 1) breadcrumbsContainer.append(' / ');
    });
}

// --- DATA HANDLING ---
async function createNewTracker() {
    const name = document.getElementById('new-tracker-name').value.trim();
    if (!name) return alert("Please enter a name.");
    await addDoc(collection(db, "users", userId, "trackers"), { name, createdAt: serverTimestamp(), taskColumns: ['Videos', 'Notes', 'PYQs', 'DPPs', 'Test Series', 'Revision'] });
    document.getElementById('new-tracker-name').value = '';
    showDashboardPage();
}
async function handleTaskCheck(event) {
    const { id, task } = event.target.dataset;
    const isChecked = event.target.checked;
    const itemRef = doc(db, "users", userId, "trackers", currentTrackerId, "items", id);
    await updateDoc(itemRef, { [`tasks.${task}`]: isChecked });
}
async function openItemModal(itemId = null) {
    const modal = document.getElementById('item-modal');
    const nameInput = document.getElementById('item-name-input');
    const typeCheckbox = document.getElementById('item-type-checkbox');
    const saveBtn = document.getElementById('save-item-btn');
    if (itemId) {
        document.getElementById('modal-title').textContent = 'Edit Item';
        const itemDoc = await getDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
        const item = itemDoc.data();
        nameInput.value = item.name; typeCheckbox.checked = item.type === 'FOLDER';
    } else {
        document.getElementById('modal-title').textContent = 'Create New Item';
        nameInput.value = ''; typeCheckbox.checked = false;
    }
    saveBtn.onclick = () => saveItem(itemId);
    modal.classList.remove('hidden');
}
async function saveItem(itemId) {
    const name = document.getElementById('item-name-input').value.trim();
    if (!name) return alert('Name is required.');
    const type = document.getElementById('item-type-checkbox').checked ? 'FOLDER' : 'ITEM';
    const collectionRef = collection(db, "users", userId, "trackers", currentTrackerId, "items");
    try {
        if (itemId) {
            await updateDoc(doc(collectionRef, itemId), { name, type });
        } else {
            await addDoc(collectionRef, { name, type, parentId: currentParentId, createdAt: serverTimestamp(), tasks: {} });
        }
        document.getElementById('item-modal').classList.add('hidden');
    } catch (error) { console.error("Error saving item:", error); }
}
async function openDeleteModal(itemId) {
    const modal = document.getElementById('delete-modal');
    const text = document.getElementById('delete-text');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const itemDoc = await getDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
    text.textContent = `This will permanently delete "${itemDoc.data().name}".`;
    confirmBtn.onclick = () => deleteItem(itemId);
    modal.classList.remove('hidden');
}
async function deleteItem(itemId) {
    try {
        await deleteDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
        document.getElementById('delete-modal').classList.add('hidden');
    } catch (error) { console.error("Error deleting item:", error); }
}