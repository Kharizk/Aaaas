
// ... existing imports ...
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  writeBatch,
  limit,
  getDoc,
  where,
  addDoc,
  updateDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOX8Aki0Cb5rfIxtUb2zoZZuV9h8Z-yJY",
  authDomain: "sales-495ee.firebaseapp.com",
  projectId: "sales-495ee",
  storageBucket: "sales-495ee.firebasestorage.app",
  messagingSenderId: "44885503140",
  appId: "1:44885503140:web:5589564599fa23b1d3ca31",
  measurementId: "G-C219JTHC23"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const snapshotToArray = (snapshot: any) => {
    return snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
    }));
};

export const db = {
  // ... existing methods ...
  async testConnection() {
      try {
          const q = query(collection(firestore, "products"), limit(1));
          await getDocs(q);
          return true;
      } catch (e) { return false; }
  },
  auth: {
    async login(username: string) {
        const q = query(collection(firestore, "users"), where("username", "==", username));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    async initAdminIfNeeded() {
        const q = query(collection(firestore, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            const adminId = crypto.randomUUID();
            await setDoc(doc(firestore, "users", adminId), {
                id: adminId, username: 'admin', password: 'admin123', fullName: 'المدير العام', role: 'admin', isActive: true,
                permissions: ['manage_users', 'view_dashboard', 'view_products', 'manage_products', 'manage_branches', 'record_sales', 'view_reports', 'manage_settlements', 'print_labels', 'manage_settings', 'manage_database']
            });
        }
    },
    async getAdminPassword() {
        const q = query(collection(firestore, "users"), where("role", "==", "admin"), limit(1));
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : snapshot.docs[0].data().password;
    },
    async setAdminPassword(newPassword: string) {
        const q = query(collection(firestore, "users"), where("role", "==", "admin"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) await updateDoc(doc(firestore, "users", snapshot.docs[0].id), { password: newPassword });
    },
    async updateUserPassword(userId: string, newPassword: string) {
        await updateDoc(doc(firestore, "users", userId), { password: newPassword });
    },
    async updateProfile(userId: string, data: { fullName: string }) {
        await updateDoc(doc(firestore, "users", userId), data);
    }
  },
  users: {
      async getAll() {
          const snapshot = await getDocs(collection(firestore, "users"));
          return snapshotToArray(snapshot);
      },
      async upsert(user: any) { await setDoc(doc(firestore, "users", user.id), user); },
      async delete(id: string) { await deleteDoc(doc(firestore, "users", id)); },
      async updateLastLogin(id: string) { await updateDoc(doc(firestore, "users", id), { lastLogin: new Date().toISOString() }); }
  },
  logs: {
      async add(log: any) { await addDoc(collection(firestore, "activity_logs"), { ...log, timestamp: new Date().toISOString() }); },
      async getAll(limitCount = 100) {
          const q = query(collection(firestore, "activity_logs"), orderBy("timestamp", "desc"), limit(limitCount));
          const snapshot = await getDocs(q);
          return snapshotToArray(snapshot);
      }
  },
  settings: {
    async get() {
      const docSnap = await getDoc(doc(firestore, "settings", "global"));
      return docSnap.exists() ? docSnap.data() : { orgName: 'مؤسسة المدير برو التجارية' };
    },
    async upsert(data: any) { await setDoc(doc(firestore, "settings", "global"), data); }
  },
  products: {
    async getAll() { return snapshotToArray(await getDocs(collection(firestore, "products"))); },
    async upsert(product: any) { await setDoc(doc(firestore, "products", product.id), product); },
    async delete(id: string) { await deleteDoc(doc(firestore, "products", id)); }
  },
  posPoints: {
    async getAll() { return snapshotToArray(await getDocs(collection(firestore, "pos_points"))); },
    async upsert(pos: any) { await setDoc(doc(firestore, "pos_points", pos.id), pos); },
    async delete(id: string) { await deleteDoc(doc(firestore, "pos_points", id)); }
  },
  cashiers: {
    async getAll() { return snapshotToArray(await getDocs(collection(firestore, "cashiers"))); },
    async upsert(cashier: any) { await setDoc(doc(firestore, "cashiers", cashier.id), cashier); },
    async delete(id: string) { await deleteDoc(doc(firestore, "cashiers", id)); }
  },
  settlements: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "settlements"), orderBy("date", "desc")))); },
    async upsert(settlement: any) { await setDoc(doc(firestore, "settlements", settlement.id), settlement); },
    async delete(id: string) { await deleteDoc(doc(firestore, "settlements", id)); }
  },
  priceGroups: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "price_groups"), orderBy("date", "desc")))); },
    async upsert(group: any) { await setDoc(doc(firestore, "price_groups", group.id), group); },
    async delete(id: string) { await deleteDoc(doc(firestore, "price_groups", id)); }
  },
  units: {
    async getAll() { return snapshotToArray(await getDocs(collection(firestore, "units"))); },
    async upsert(unit: any) { await setDoc(doc(firestore, "units", unit.id), unit); },
    async delete(id: string) { await deleteDoc(doc(firestore, "units", id)); }
  },
  lists: {
      async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "lists"), orderBy("date", "desc")))); },
      async upsert(list: any) { await setDoc(doc(firestore, "lists", list.id), list); },
      async delete(id: string) { await deleteDoc(doc(firestore, "lists", id)); },
      async updateRowDismissed(listId: string, rowId: string) {
          const docRef = doc(firestore, "lists", listId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              const updatedRows = data.rows.map((r: any) => r.id === rowId ? { ...r, isDismissed: true } : r);
              await updateDoc(docRef, { rows: updatedRows });
          }
      }
  },
  tagLists: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "tag_lists"), orderBy("date", "desc")))); },
    async upsert(tagList: any) { await setDoc(doc(firestore, "tag_lists", tagList.id), tagList); },
    async delete(id: string) { await deleteDoc(doc(firestore, "tag_lists", id)); }
  },
  offerLists: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "offer_lists"), orderBy("date", "desc")))); },
    async upsert(offerList: any) { await setDoc(doc(firestore, "offer_lists", offerList.id), offerList); },
    async delete(id: string) { await deleteDoc(doc(firestore, "offer_lists", id)); }
  },
  catalogs: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "catalogs"), orderBy("date", "desc")))); },
    async get(id: string) { 
        const docSnap = await getDoc(doc(firestore, "catalogs", id));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },
    async upsert(cat: any) { await setDoc(doc(firestore, "catalogs", cat.id), cat); },
    async delete(id: string) { await deleteDoc(doc(firestore, "catalogs", id)); }
  },
  branches: {
      async getAll() { return snapshotToArray(await getDocs(collection(firestore, "branches"))); },
      async upsert(branch: any) { await setDoc(doc(firestore, "branches", branch.id), branch); },
      async delete(id: string) { await deleteDoc(doc(firestore, "branches", id)); }
  },
  dailySales: {
    async getAll() { return snapshotToArray(await getDocs(query(collection(firestore, "daily_sales"), orderBy("date", "desc")))); },
    async upsert(sale: any) { await setDoc(doc(firestore, "daily_sales", sale.id), sale); },
    async delete(id: string) { await deleteDoc(doc(firestore, "daily_sales", id)); },
    async deleteByBranch(branchId: string) {
        const q = query(collection(firestore, "daily_sales"));
        const snapshot = await getDocs(q);
        const batch = writeBatch(firestore);
        snapshot.docs.forEach(d => { if (d.data().branchId === branchId) batch.delete(d.ref); });
        await batch.commit();
    },
    async deleteMany(ids: string[]) {
        const batch = writeBatch(firestore);
        ids.forEach(id => batch.delete(doc(firestore, "daily_sales", id)));
        await batch.commit();
    }
  }
};
