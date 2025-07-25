// All imports MUST be at the very top of the file.
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
let trackersUnsubscribe = null; // To stop listening for tracker changes when not needed

// --- DOM ELEMENTS ---
const loaderOverlay = document.getElementById('loader-overlay');
const appContainer = document.getElementById('app-container');
const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');
const settingsBtn = document.getElementById('settings-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const createTrackerBtn = document.getElementById('create-tracker-btn');
const profilePicContainer = document.getElementById('profile-pic-container');
const photoUploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');
const trackersGrid = document.getElementById('trackers-grid');


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Start loader animation... (This part remains the same)
    
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
            console.log("User is signed in:", userId);

            loadProfilePicture(userId);
            renderTrackers(); // Start listening for and displaying trackers
            
            // Hide loader and show app
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
                appContainer.style.opacity = '1';
            }, 1000); // Shortened delay
        });
    } catch (error) {
        console.error("Firebase Init Error:", error);
        loaderOverlay.innerHTML = `<p class="text-red-500 font-bold">Connection Failed</p>`;
    }

    // Attach all event listeners
    settingsBtn.addEventListener('click', () => {
        dashboardPage.classList.add('hidden');
        settingsPage.classList.remove('hidden');
    });

    backToDashboardBtn.addEventListener('click', () => {
        settingsPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
    });

    createTrackerBtn.addEventListener('click', handleCreateTracker);
    profilePicContainer.addEventListener('click', () => photoUploadInput.click());
    uploadBtn.addEventListener('click', () => photoUploadInput.click());
    photoUploadInput.addEventListener('change', handlePhotoUpload);
});


// --- NEW: Render Trackers from Firestore ---
function renderTrackers() {
    if (trackersUnsubscribe) trackersUnsubscribe(); // Stop any previous listener

    const trackersQuery = collection(db, "users", userId, "trackers");
    
    trackersUnsubscribe = onSnapshot(trackersQuery, (querySnapshot) => {
        if (querySnapshot.empty) {
            trackersGrid.innerHTML = `<p class="text-center col-span-full text-gray-500">You don't have any trackers yet. Go to settings to create one!</p>`;
            return;
        }
        
        trackersGrid.innerHTML = ''; // Clear the grid
        querySnapshot.forEach((doc) => {
            const tracker = doc.data();
            const trackerCard = document.createElement('div');
            trackerCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-105';
            trackerCard.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
            // We will add a click event here later to open the tracker
            trackersGrid.appendChild(trackerCard);
        });
    });
}


// --- Functions for Creating Tracker and Handling Profile Picture ---

async function handleCreateTracker() {
    const trackerNameInput = document.getElementById('new-tracker-name');
    const trackerName = trackerNameInput.value.trim();
    if (!trackerName) return alert("Please enter a name.");
    if (!userId) return alert("Error: Not signed in.");

    try {
        const trackersCollectionRef = collection(db, "users", userId, "trackers");
        await addDoc(trackersCollectionRef, {
            name: trackerName,
            createdAt: serverTimestamp(),
            taskColumns: ['Task 1', 'Task 2', 'Task 3', 'Revision 1', 'Revision 2']
        });
        alert(`Tracker "${trackerName}" created!`);
        trackerNameInput.value = '';
        // Go back to the dashboard to see the new tracker
        backToDashboardBtn.click();
    } catch (error) {
        console.error("Error creating tracker: ", error);
        alert("Could not create tracker. Check security rules.");
    }
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
        }
    } catch (error) {
        console.error("Error loading profile picture:", error);
    }
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

        // Immediately update the image on the screen
        loadProfilePicture(userId);
        
        alert("Profile picture updated successfully!");
    } catch (error) {
        console.error("Error uploading file:", error);
        alert("Upload failed. Please check storage rules.");
    }
}