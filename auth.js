import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- AUTHENTICATION ---
export function handleAuthentication(callback) {
    onAuthStateChanged(auth, user => {
        if (user) {
            callback(user.uid);
        } else {
            signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
        }
    });
}

// --- PROFILE PICTURE LOGIC ---
export async function loadProfilePicture(uid) {
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

export async function handlePhotoUpload(event, userId) {
    const file = event.target.files[0];
    if (!file || !userId) return;
    
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    alert("Uploading picture...");
    try {
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        await setDoc(doc(db, "users", userId), { profilePicUrl: downloadURL }, { merge: true });
        loadProfilePicture(userId);
        alert("Profile picture updated!");
    } catch (error) { console.error("Error uploading file:", error); }
}

// --- EXPORT SERVICES ---
export { db, auth, storage };