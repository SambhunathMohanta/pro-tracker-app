// All imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA_9LWNHTUYjW9o5ZgBoEfQqdtYhIUIX0s",
    authDomain: "gate-tracker-final.firebaseapp.com",
    projectId: "gate-tracker-final",
    storageBucket: "gate-tracker-final.firebasestorage.app",
    messagingSenderId: "586102213734",
    appId: "1:586102213734:web:88fa9b3a3f0e421b9131a7"
};

// --- FIREBASE & APP STATE ---
let app, db, auth, storage, userId;
let trackersUnsubscribe = null, itemsUnsubscribe = null;
let currentTrackerId = null, currentTrackerName = null;

// --- DOM ELEMENTS ---
const loaderOverlay = document.getElementById('loader-overlay');
const appContainer = document.getElementById('app-container');
const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');
const trackerPage = document.getElementById('tracker-page');
const settingsBtn = document.getElementById('settings-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const backToDashboardFromTrackerBtn = document.getElementById('back-to-dashboard-from-tracker-btn');
const createTrackerBtn = document.getElementById('create-tracker-btn');
const trackersGrid = document.getElementById('trackers-grid');
const addNewItemBtn = document.getElementById('add-new-item-btn');


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAppLogic();
    attachInitialEventListeners();
});

function initializeAppLogic() {
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
            if (!user) { signInAnonymously(auth).catch(err => console.error(err)); return; }
            userId = user.uid;
            loadProfilePicture(userId);
            renderTrackers();
            
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
                appContainer.style.opacity = '1';
            }, 2200);
        });
    } catch (error) { console.error("Firebase Init Error:", error); }
}

function attachInitialEventListeners() {
    settingsBtn.addEventListener('click', showSettingsPage);
    backToDashboardBtn.addEventListener('click', showDashboardPage);
    backToDashboardFromTrackerBtn.addEventListener('click', showDashboardPage);
    createTrackerBtn.addEventListener('click', handleCreateTracker);
    document.getElementById('profile-pic-container').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('photo-upload').click());
    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    addNewItemBtn.addEventListener('click', handleAddNewItem);
}


// --- PAGE NAVIGATION ---
function showDashboardPage() {
    dashboardPage.classList.remove('hidden');
    settingsPage.classList.add('hidden');
    trackerPage.classList.add('hidden');
    if (itemsUnsubscribe) itemsUnsubscribe();
}
function showSettingsPage() {
    dashboardPage.classList.add('hidden');
    settingsPage.classList.remove('hidden');
    trackerPage.classList.add('hidden');
}
function showTrackerPage() {
    dashboardPage.classList.add('hidden');
    settingsPage.classList.add('hidden');
    trackerPage.classList.remove('hidden');
}


// --- RENDER FUNCTIONS ---
function renderTrackers() {
    if (trackersUnsubscribe) trackersUnsubscribe();
    const trackersQuery = collection(db, "users", userId, "trackers");
    
    trackersUnsubscribe = onSnapshot(trackersQuery, (querySnapshot) => {
        trackersGrid.innerHTML = querySnapshot.empty ? `<p class="text-center col-span-full text-gray-500">No trackers yet. Go to settings to create one!</p>` : '';
        querySnapshot.forEach((doc) => {
            const tracker = doc.data();
            const trackerCard = document.createElement('div');
            trackerCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            trackerCard.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
            trackerCard.addEventListener('click', () => openTracker(doc.id, tracker.name));
            trackersGrid.appendChild(trackerCard);
        });
    });
}

function openTracker(trackerId, trackerName) {
    currentTrackerId = trackerId;
    currentTrackerName = trackerName;
    showTrackerPage();
    document.getElementById('tracker-title').textContent = trackerName;
    
    if (itemsUnsubscribe) itemsUnsubscribe();
    
    const itemsContainer = document.getElementById('items-container');
    const itemsQuery = query(collection(db, "users", userId, "trackers", trackerId, "items"), where("parentId", "==", "root"), orderBy("createdAt"));
    
    itemsUnsubscribe = onSnapshot(itemsQuery, (querySnapshot) => {
        itemsContainer.innerHTML = querySnapshot.empty ? `<p class="text-center text-gray-500">This tracker is empty. Add a new folder or item.</p>` : '';
        querySnapshot.forEach(doc => {
            const item = doc.data();
            const itemElement = document.createElement('div');
            itemElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4';
            itemElement.innerHTML = `
                <span class="text-2xl">${item.type === 'FOLDER' ? '📁' : '📄'}</span>
                <span class="font-semibold flex-grow">${item.name}</span>
            `;
            itemsContainer.appendChild(itemElement);
        });
    });
}


// --- HANDLER FUNCTIONS ---
async function handleCreateTracker() {
    const trackerNameInput = document.getElementById('new-tracker-name');
    const trackerName = trackerNameInput.value.trim();
    if (!trackerName) return alert("Please enter a name.");
    
    try {
        await addDoc(collection(db, "users", userId, "trackers"), {
            name: trackerName,
            createdAt: serverTimestamp(),
            taskColumns: ['Videos', 'Notes', 'PYQs', 'Revision 1', 'Revision 2']
        });
        alert(`Tracker "${trackerName}" created!`);
        trackerNameInput.value = '';
        backToDashboardBtn.click();
    } catch (error) { console.error("Error creating tracker: ", error); }
}

async function handleAddNewItem() {
    const itemName = prompt("Enter name for new folder or item:");
    if (!itemName) return;
    const itemType = confirm("Is this a folder? (OK for Folder, Cancel for Item)") ? "FOLDER" : "ITEM";

    try {
        await addDoc(collection(db, "users", userId, "trackers", currentTrackerId, "items"), {
            name: itemName,
            type: itemType,
            parentId: "root", // For now, all items are top-level
            createdAt: serverTimestamp(),
            tasks: itemType === 'ITEM' ? {} : null
        });
    } catch (error) { console.error("Error adding new item: ", error); }
}

async function loadProfilePicture(uid) {
    const profilePicImg = document.getElementById('profile-pic');
    const defaultPicIcon = document.getElementById('default-pic-icon');
    const userDocRef = doc(db, "users", uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists() && docSnap.data().profilePicUrl) {
            profilePicImg.src = docSnap.data().profilePicUrl;
            profilePicImg.classList.remove('hidden');
            defaultPicIcon.classList.add('hidden');
        } else {
            profilePicImg.classList.add('hidden');
            defaultPicIcon.classList.remove('hidden');
        }
    } catch (error) { console.error("Error loading profile picture:", error); }
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    
    try {
        alert("Uploading picture...");
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        await setDoc(doc(db, "users", userId), { profilePicUrl: downloadURL }, { merge: true });
        loadProfilePicture(userId);
        alert("Profile picture updated successfully!");
    } catch (error) { console.error("Error uploading file:", error); }
}