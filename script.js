// All imports MUST be at the very top of the file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Your Firebase configuration for the "pro-tracker-final" project
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

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Select all DOM elements once the document is ready
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderCircle = document.querySelector('.loader-circle');
    const appContainer = document.getElementById('app-container');
    const dashboardPage = document.getElementById('dashboard-page');
    const settingsPage = document.getElementById('settings-page');
    const settingsBtn = document.getElementById('settings-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const createTrackerBtn = document.getElementById('create-tracker-btn');
    const profilePicContainer = document.getElementById('profile-pic-container');
    const photoUploadInput = document.getElementById('photo-upload');
    const uploadBtn = document.getElementById('upload-btn');

    // Start the loading animation
    let currentPercent = 0;
    const interval = setInterval(() => {
        if (currentPercent < 100) {
            currentPercent++;
            loaderPercentage.textContent = `${currentPercent}%`;
            const hue = (currentPercent / 100) * 120;
            loaderCircle.style.background = `conic-gradient(hsl(${hue}, 70%, 50%) ${currentPercent}%, #1f2937 ${currentPercent}%)`;
        } else {
            clearInterval(interval);
        }
    }, 20);

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
            
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
                appContainer.style.opacity = '1';
            }, 2200);
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


// --- FUNCTIONS ---

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
    } catch (error) {
        console.error("Error creating tracker: ", error);
        alert("Could not create tracker.");
    }
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
    if (!file || !userId) return;
    
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    
    try {
        alert("Uploading picture...");
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { profilePicUrl: downloadURL }, { merge: true });
        loadProfilePicture(userId);
        alert("Profile picture updated!");
    } catch (error) {
        console.error("Error uploading file:", error);
        alert("Upload failed.");
    }
}