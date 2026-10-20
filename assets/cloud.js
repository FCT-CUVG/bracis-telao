import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig, adminEmails } from './cloud-config.js';
export const app=initializeApp(firebaseConfig), auth=getAuth(app), database=getFirestore(app);
const eventRef=doc(database,'events','bracis');
export const authorized=user=>!!(user?.emailVerified&&adminEmails.includes(user.email?.toLowerCase()));
export const watchAuth=callback=>onAuthStateChanged(auth,callback);
export const login=()=>{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return signInWithPopup(auth,provider);};
export const logout=()=>signOut(auth);
export const watchEvent=(next,error)=>onSnapshot(eventRef,snapshot=>next(snapshot.exists()?snapshot.data():null),error);
export async function publishEvent(value){
  if(!authorized(auth.currentUser))throw Error('Esta conta não tem permissão para publicar.');
  await setDoc(eventRef,{version:1,folderId:value.folderId,resourceKey:value.resourceKey||'',excludedIds:[...new Set(value.excludedIds||[])],settings:value.settings,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
}
export const ready=()=>window.Telao?Promise.resolve(window.Telao):new Promise(resolve=>window.addEventListener('telao:ready',()=>resolve(window.Telao),{once:true}));
