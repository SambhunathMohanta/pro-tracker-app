// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyA_9LWNHTUYjW9o5ZgBoEfQqdtYhIUIX0s",
    authDomain: "gate-tracker-final.firebaseapp.com",
    projectId: "gate-tracker-final",
    storageBucket: "gate-tracker-final.appspot.com",
    messagingSenderId: "586102213734",
    appId: "1:586102213734:web:88fa9b3a3f0e421b9131a7"
};

// --- GLOBAL STATE ---
let app, db, auth, storage, userId;
let trackersUnsubscribe = null, itemsUnsubscribe = null;
let currentTrackerId = null, currentParentId = 'root';
let breadcrumbs = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Start loader animation
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderCircle = document.querySelector('.loader-circle');
    let currentPercent = 0;
    const interval = setInterval(() => {
        if (currentPercent < 100) {
            currentPercent++;
            loaderPercentage.textContent = `${currentPercent}%`;
            const hue = (currentPercent / 100) * 120; // 0=red, 120=green
            loaderCircle.style.background = `conic-gradient(hsl(${hue}, 70%, 50%) ${currentPercent}%, #1f2937 ${currentPercent}%)`;
        } else { clearInterval(interval); }
    }, 20);

    // Initialize Firebase
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);

        onAuthStateChanged(auth, user => {
            if (!user) { signInAnonymously(auth); return; }
            userId = user.uid;
            loadProfilePicture(userId);
            renderTrackers();
            attachEventListeners();
            
            setTimeout(() => {
                document.getElementById('loader-overlay').classList.add('hidden');
                document.getElementById('app-container').style.opacity = '1';
            }, 2200);
        });
    } catch (error) { console.error("Firebase Init Error:", error); }
});

// --- EVENT LISTENERS ---
function attachEventListeners() {
    document.getElementById('settings-btn').addEventListener('click', showSettingsPage);
    document.getElementById('back-to-dashboard-btn').addEventListener('click', showDashboardPage);
    document.getElementById('back-to-dashboard-from-tracker-btn').addEventListener('click', showDashboardPage);
    document.getElementById('create-tracker-btn').addEventListener('click', handleCreateTracker);
    document.getElementById('profile-pic-container').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    document.getElementById('add-new-item-btn').addEventListener('click', () => openItemModal());
    document.getElementById('cancel-item-btn').addEventListener('click', () => document.getElementById('item-modal').classList.add('hidden'));
    document.getElementById('cancel-delete-btn').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
}

// --- PAGE NAVIGATION ---
function showDashboardPage() {
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    document.getElementById('tracker-page').classList.add('hidden');
    if (itemsUnsubscribe) itemsUnsubscribe();
}
function showSettingsPage() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('settings-page').classList.remove('hidden');
    document.getElementById('tracker-page').classList.add('hidden');
}
function showTrackerPage() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    document.getElementById('tracker-page').classList.remove('hidden');
}

// --- RENDER FUNCTIONS ---
function renderTrackers() {
    if (trackersUnsubscribe) trackersUnsubscribe();
    const trackersGrid = document.getElementById('trackers-grid');
    const q = query(collection(db, "users", userId, "trackers"), orderBy("createdAt", "desc"));
    trackersUnsubscribe = onSnapshot(q, (snapshot) => {
        trackersGrid.innerHTML = snapshot.empty ? `<p class="text-center col-span-full text-gray-500">No trackers yet. Go to settings!</p>` : '';
        snapshot.forEach((doc) => {
            const tracker = doc.data();
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            card.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
            card.addEventListener('click', () => openTracker(doc.id, tracker.name));
            trackersGrid.appendChild(card);
        });
    });
}

function openTracker(trackerId, trackerName, parentId = 'root', parentName = trackerName) {
    currentTrackerId = trackerId;
    currentParentId = parentId;
    
    if (parentId === 'root') {
        breadcrumbs = [{ id: 'root', name: trackerName }];
    } else {
        const parentIndex = breadcrumbs.findIndex(b => b.id === parentId);
        if (parentIndex !== -1) {
            breadcrumbs.splice(parentIndex + 1);
        } else {
            breadcrumbs.push({ id: parentId, name: parentName });
        }
    }
    
    showTrackerPage();
    document.getElementById('tracker-title').textContent = trackerName;
    renderBreadcrumbs();
    
    if (itemsUnsubscribe) itemsUnsubscribe();
    const itemsContainer = document.getElementById('items-container');
    const q = query(collection(db, "users", userId, "trackers", trackerId, "items"), where("parentId", "==", currentParentId), orderBy("createdAt"));
    
    itemsUnsubscribe = onSnapshot(q, (snapshot) => {
        itemsContainer.innerHTML = snapshot.empty ? `<p class="text-center text-gray-500">This folder is empty.</p>` : '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const el = document.createElement('div');
            el.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4';
            el.innerHTML = `
                <span class="text-2xl">${item.type === 'FOLDER' ? '📁' : '📄'}</span>
                <span class="font-semibold flex-grow">${item.name}</span>
                <button data-id="${doc.id}" class="edit-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">✏️</button>
                <button data-id="${doc.id}" class="delete-item-btn p-1 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600">🗑️</button>
            `;
            if (item.type === 'FOLDER') {
                el.classList.add('cursor-pointer', 'hover:bg-gray-50', 'dark:hover:bg-gray-700');
                el.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    openTracker(trackerId, trackerName, doc.id, item.name);
                });
            }
            itemsContainer.appendChild(el);
        });
        
        document.querySelectorAll('.edit-item-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openItemModal(btn.dataset.id); }));
        document.querySelectorAll('.delete-item-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openDeleteModal(btn.dataset.id); }));
    });
}

function renderBreadcrumbs() {
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    breadcrumbsContainer.innerHTML = '';
    breadcrumbs.forEach((crumb, index) => {
        const el = document.createElement(index === breadcrumbs.length - 1 ? 'span' : 'a');
        el.className = index === breadcrumbs.length - 1 ? 'font-bold' : 'cursor-pointer hover:underline';
        el.textContent = crumb.name;
        if (index < breadcrumbs.length - 1) {
            el.onclick = () => openTracker(currentTrackerId, breadcrumbs[0].name, crumb.id, crumb.name);
            breadcrumbsContainer.appendChild(el);
            breadcrumbsContainer.append(' / ');
        } else {
            breadcrumbsContainer.appendChild(el);
        }
    });
}

// --- MODAL & DATA HANDLING ---
async function openItemModal(itemId = null) {
    const modal = document.getElementById('item-modal');
    const nameInput = document.getElementById('item-name-input');
    const typeCheckbox = document.getElementById('item-type-checkbox');
    const saveBtn = document.getElementById('save-item-btn'); // THIS WAS THE MISSING PIECE

    if (itemId) {
        document.getElementById('modal-title').textContent = 'Edit Item';
        const itemDoc = await getDoc(doc(db, "users", userId, "trackers", currentTrackerId, "items", itemId));
        const item = itemDoc.data();
        nameInput.value = item.name;
        typeCheckbox.checked = item.type === 'FOLDER';
    } else {
        document.getElementById('modal-title').textContent = 'Create New Item';
        nameInput.value = '';
        typeCheckbox.checked = false;
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
            const data = { name, type, parentId: currentParentId, createdAt: serverTimestamp(), tasks: {} };
            await addDoc(collectionRef, data);
        }
        document.getElementById('item-modal').classList.add('hidden');
    } catch (error) { console.error("Error saving item:", error); }
}

async function openDeleteModal(itemId) {
    const modal = document.getElementById('delete-modal');
    const text = document.getElementById('delete-text');
    const confirmBtn = document.getElementById('confirm-delete-btn'); // THIS WAS THE MISSING PIECE
    
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

// --- PROFILE & TRACKER CREATION ---
async function handleCreateTracker() {
    const name = document.getElementById('new-tracker-name').value.trim();
    if (!name) return alert("Please enter a name.");
    await addDoc(collection(db, "users", userId, "trackers"), { name, createdAt: serverTimestamp(), taskColumns: ['Videos', 'Notes', 'PYQs'] });
    document.getElementById('new-tracker-name').value = '';
    showDashboardPage();
}
async function loadProfilePicture(uid) {
    const profilePicImg = document.getElementById('profile-pic');
    const defaultPicIcon = document.getElementById('default-pic-icon');
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().profilePicUrl) {
        profilePicImg.src = docSnap.data().profilePicUrl;
        profilePicImg.classList.remove('hidden');
        defaultPicIcon.classList.add('hidden');
    }
}
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    alert("Uploading picture...");
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await setDoc(doc(db, "users", userId), { profilePicUrl: downloadURL }, { merge: true });
    loadProfilePicture(userId);
    alert("Profile picture updated!");
}