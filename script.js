// All imports MUST be at the very top of the file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Your Firebase configuration for the "gate-tracker-final" project
const firebaseConfig = {
    apiKey: "AIzaSyA_9LWNHTUYjW9o5ZgBoEfQqdtYhIUIX0s",
    authDomain: "gate-tracker-final.firebaseapp.com",
    projectId: "gate-tracker-final",
    storageBucket: "gate-tracker-final.appspot.com",
    messagingSenderId: "586102213734",
    appId: "1:586102213734:web:88fa9b3a3f0e421b9131a7"
};

// --- DOM ELEMENTS ---
const loaderOverlay = document.getElementById('loader-overlay');
const loaderPercentage = document.getElementById('loader-percentage');
const loaderCircle = document.querySelector('.loader-circle');
const appContainer = document.getElementById('app-container');

const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');
const settingsBtn = document.getElementById('settings-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');


// --- APPLICATION INITIALIZATION ---
async function initializeAppLogic() {
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderCircle = document.querySelector('.loader-circle');
    const appContainer = document.getElementById('app-container');

    // 1. Start the loading animation
    let currentPercent = 0;
    const interval = setInterval(() => {
        if (currentPercent < 100) {
            currentPercent++;
            loaderPercentage.textContent = `${currentPercent}%`;
            // Update conic gradient for the loading bar effect
            const hue = (currentPercent / 100) * 120; // 0=red, 120=green
            loaderCircle.style.background = `conic-gradient(hsl(${hue}, 70%, 50%) ${currentPercent}%, #1f2937 ${currentPercent}%)`;
        } else {
            clearInterval(interval);
        }
    }, 20); // Animate over 2 seconds

    // 2. Connect to Firebase
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app); // This is a new line to add

        onAuthStateChanged(auth, user => {
            if (!user) {
                signInAnonymously(auth).catch(err => console.error(err));
                return;
            }
            userId = user.uid;
            console.log("User is signed in:", userId);

            loadProfilePicture(userId); // This is a new line to add
            
            // 3. Hide loader and show the app
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
                appContainer.style.opacity = '1';
            }, 2200); // Ensure animation finishes
        });
    } catch (error) {
        console.error("Firebase Init Error:", error);
        loaderOverlay.innerHTML = `<p class="text-red-500 font-bold">Connection Failed</p>`;
    }
}

// --- PAGE NAVIGATION ---
settingsBtn.addEventListener('click', () => {
    dashboardPage.classList.add('hidden');
    settingsPage.classList.remove('hidden');
});

backToDashboardBtn.addEventListener('click', () => {
    settingsPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
});

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', initializeAppLogic);
// --- PROFILE PICTURE LOGIC ---
const profilePicImg = document.getElementById('profile-pic');
const defaultPicIcon = document.getElementById('default-pic-icon');
const profilePicContainer = document.getElementById('profile-pic-container');
const photoUploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');

let storage; // Will be initialized with other Firebase services

// Function to load the user's profile picture
async function loadProfilePicture(uid) {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists() && docSnap.data().profilePicUrl) {
        profilePicImg.src = docSnap.data().profilePicUrl;
        profilePicImg.classList.remove('hidden');
        defaultPicIcon.classList.add('hidden');
    }
}

// Function to handle file selection and upload
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!userId) {
        alert("You must be signed in to upload a picture.");
        return;
    }
    
    // Create a storage reference
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    
    try {
        // Upload the file
        alert("Uploading picture...");
        const snapshot = await uploadBytes(storageRef, file);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Save the URL to the user's profile in Firestore
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { profilePicUrl: downloadURL }, { merge: true });

        // Display the new picture
        profilePicImg.src = downloadURL;
        profilePicImg.classList.remove('hidden');
        defaultPicIcon.classList.add('hidden');
        
        alert("Profile picture updated successfully!");

    } catch (error) {
        console.error("Error uploading file:", error);
        alert("Upload failed. Please try again.");
    }
}

// Event listeners for the upload buttons
profilePicContainer.addEventListener('click', () => photoUploadInput.click());
uploadBtn.addEventListener('click', () => photoUploadInput.click());
photoUploadInput.addEventListener('change', handlePhotoUpload);