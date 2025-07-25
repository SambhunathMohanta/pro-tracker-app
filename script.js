// All imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA_9LWNHTUYjW9o5ZgBoEfQqdtYhIUIX0s",
    authDomain: "gate-tracker-final.firebaseapp.com",
    projectId: "gate-tracker-final",
    storageBucket: "gate-tracker-final.appspot.com",
    messagingSenderId: "586102213734",
    appId: "1:586102213734:web:88fa9b3a3f0e421b9131a7"
};

// --- FIREBASE & APP STATE ---
let app, db, auth, storage, userId;
let trackersUnsubscribe = null;
let itemsUnsubscribe = null; // New listener for items

// --- DOM ELEMENTS ---
// (Getting all the necessary elements from the HTML)
const loaderOverlay = document.getElementById('loader-overlay');
const appContainer = document.getElementById('app-container');
const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');
const trackerPage = document.getElementById('tracker-page'); // New tracker page element
const settingsBtn = document.getElementById('settings-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const createTrackerBtn = document.getElementById('create-tracker-btn');
const profilePicContainer = document.getElementById('profile-pic-container');
const photoUploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');
const trackersGrid = document.getElementById('trackers-grid');
const backToDashboardFromTrackerBtn = document.getElementById('back-to-dashboard-from-tracker-btn');


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (Loader animation code remains the same)

    // Initialize Firebase
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);

        onAuthStateChanged(auth, user => {
            if (!user) {
                signInAnonymously(auth).catch(err => console.error(err));
                return;
            }
            userId = user.uid;
            loadProfilePicture(userId);
            renderTrackers();
            
            // Hide loader and show app
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
                appContainer.style.opacity = '1';
            }, 1000);
        });
    } catch (error) {
        console.error("Firebase Init Error:", error);
    }

    // --- EVENT LISTENERS ---
    settingsBtn.addEventListener('click', showSettingsPage);
    backToDashboardBtn.addEventListener('click', showDashboardPage);
    backToDashboardFromTrackerBtn.addEventListener('click', showDashboardPage);
    createTrackerBtn.addEventListener('click', handleCreateTracker);
    profilePicContainer.addEventListener('click', () => photoUploadInput.click());
    uploadBtn.addEventListener('click', () => photoUploadInput.click());
    photoUploadInput.addEventListener('change', handlePhotoUpload);
});


// --- PAGE NAVIGATION ---
function showDashboardPage() {
    dashboardPage.classList.remove('hidden');
    settingsPage.classList.add('hidden');
    trackerPage.classList.add('hidden');
    if (itemsUnsubscribe) itemsUnsubscribe(); // Stop listening to items when leaving tracker page
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
        if (querySnapshot.empty) {
            trackersGrid.innerHTML = `<p class="text-center col-span-full text-gray-500">You don't have any trackers yet. Go to settings to create one!</p>`;
            return;
        }
        
        trackersGrid.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const tracker = doc.data();
            const trackerId = doc.id;
            const trackerCard = document.createElement('div');
            trackerCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            trackerCard.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
            
            // NEW: Add click event listener to open the tracker
            trackerCard.addEventListener('click', () => {
                openTracker(trackerId, tracker.name);
            });
            
            trackersGrid.appendChild(trackerCard);
        });
    });
}

// --- NEW: Open a specific tracker and show its items ---
function openTracker(trackerId, trackerName) {
    showTrackerPage();
    document.getElementById('tracker-title').textContent = trackerName;
    
    if (itemsUnsubscribe) itemsUnsubscribe(); // Stop previous listener
    
    const itemsContainer = document.getElementById('items-container');
    const itemsQuery = collection(db, "users", userId, "trackers", trackerId, "items");
    
    itemsUnsubscribe = onSnapshot(itemsQuery, (querySnapshot) => {
        if (querySnapshot.empty) {
            itemsContainer.innerHTML = `<p class="text-center text-gray-500">This tracker is empty. We will add a button to create items next.</p>`;
            return;
        }
        // Logic to display items will go here in the next step
        itemsContainer.innerHTML = `<p class="text-green-500 text-center">Successfully loaded ${querySnapshot.size} items! (Display logic coming next)</p>`;
    });
}

// ... (The rest of your functions: handleCreateTracker, loadProfilePicture, handlePhotoUpload remain the same)
// ... (Make sure they are still here in your file)
async function handleCreateTracker() {
    const trackerNameInput = document.getElementById('new-tracker-name');
    const trackerName = trackerNameInput.value.trim();
    if (!trackerName) return alert("Please enter a name.");
    if (!userId) return alert("Error: Not signed in.");
    try {
        const trackersCollectionRef = collection(db, "users", userId, "trackers");
        await addDoc(trackersCollectionRef, { name: trackerName, createdAt: serverTimestamp(), taskColumns: ['Videos', 'Notes', 'PYQs', 'Revision 1', 'Revision 2'] });
        alert(`Tracker "${trackerName}" created!`);
        trackerNameInput.value = '';
        backToDashboardBtn.click();
    } catch (error) { console.error("Error creating tracker: ", error); alert("Could not create tracker."); }
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
    if (!file || !userId) return;
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    try {
        alert("Uploading picture...");
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { profilePicUrl: downloadURL }, { merge: true });
        loadProfilePicture(userId);
        alert("Profile picture updated successfully!");
    } catch (error) { console.error("Error uploading file:", error); alert("Upload failed."); }
}