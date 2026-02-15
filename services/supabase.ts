
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

let app;
let firestore: any;

try {
    app = initializeApp(firebaseConfig);
    firestore = getFirestore(app);
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}

const snapshotToArray = (snapshot: any) => {
    return snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
    }));
};

// Helper to safely execute DB calls
const safeDbCall = async (fn: () => Promise<any>, fallback: any = null) => {
    if (!firestore) return fallback;
    try {
        return await fn();
    } catch (e) {
        console.error("DB Error:", e);
        throw e;
    }
};

export const db = {
  async testConnection() {
      if (!firestore) return false;
      try {
          const q = query(collection(firestore, "products"), limit(1));
          await getDocs(q);
          return true;
      } catch (e) { return false; }
  },
  auth: {
    async login(username: string) {
        return safeDbCall(async () => {
            const q = query(collection(firestore, "users"), where("username", "==", username));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        });
    },
    async initAdminIfNeeded() {
        return safeDbCall(async () => {
            const q = query(collection(firestore, "users"), where("role", "==", "admin"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                const adminId = crypto.randomUUID();
                await setDoc(doc(firestore, "users", adminId), {
                    id: adminId, username: 'admin', password: 'admin123', fullName: 'المدير العام', role: 'admin', isActive: true,
                    permissions: ['manage_users', 'view_dashboard', 'view_products', 'manage_products', 'manage_branches', 'record_sales', 'view_reports', 'manage_settlements', 'print_labels', 'manage_settings', 'manage_database']
                });
            }
        });
    },
    async getAdminPassword() {
        return safeDbCall(async () => {
            const q = query(collection(firestore, "users"), where("role", "==", "admin"), limit(1));
            const snapshot = await getDocs(q);
            return snapshot.empty ? null : snapshot.docs[0].data().password;
        });
    },
    async setAdminPassword(newPassword: string) {
        return safeDbCall(async () => {
            const q = query(collection(firestore, "users"), where("role", "==", "admin"), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) await updateDoc(doc(firestore, "users", snapshot.docs[0].id), { password: newPassword });
        });
    },
    async updateUserPassword(userId: string, newPassword: string) {
        return safeDbCall(async () => { await updateDoc(doc(firestore, "users", userId), { password: newPassword }); });
    },
    async updateProfile(userId: string, data: { fullName: string }) {
        return safeDbCall(async () => { await updateDoc(doc(firestore, "users", userId), data); });
    }
  },
  users: {
      async getAll() {
          return safeDbCall(async () => {
              const snapshot = await getDocs(collection(firestore, "users"));
              return snapshotToArray(snapshot);
          }, []);
      },
      async upsert(user: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "users", user.id), user); }); },
      async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "users", id)); }); },
      async updateLastLogin(id: string) { return safeDbCall(async () => { await updateDoc(doc(firestore, "users", id), { lastLogin: new Date().toISOString() }); }); }
  },
  logs: {
      async add(log: any) { return safeDbCall(async () => { await addDoc(collection(firestore, "activity_logs"), { ...log, timestamp: new Date().toISOString() }); }); },
      async getAll(limitCount = 100) {
          return safeDbCall(async () => {
              const q = query(collection(firestore, "activity_logs"), orderBy("timestamp", "desc"), limit(limitCount));
              const snapshot = await getDocs(q);
              return snapshotToArray(snapshot);
          }, []);
      }
  },
  settings: {
    async get() {
      return safeDbCall(async () => {
          const docSnap = await getDoc(doc(firestore, "settings", "global"));
          return docSnap.exists() ? docSnap.data() : { orgName: 'مؤسسة المدير برو التجارية' };
      }, { orgName: 'مؤسسة المدير برو التجارية' });
    },
    async upsert(data: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "settings", "global"), data); }); }
  },
  products: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "products"))), []); },
    async upsert(product: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "products", product.id), product); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "products", id)); }); }
  },
  expenses: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "expenses"), orderBy("date", "desc")))), []); },
    async upsert(expense: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "expenses", expense.id), expense); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "expenses", id)); }); }
  },
  customers: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "customers"))), []); },
    async upsert(customer: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "customers", customer.id), customer); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "customers", id)); }); }
  },
  posPoints: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "pos_points"))), []); },
    async upsert(pos: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "pos_points", pos.id), pos); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "pos_points", id)); }); }
  },
  networks: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "networks"))), []); },
    async upsert(network: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "networks", network.id), network); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "networks", id)); }); }
  },
  cashiers: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "cashiers"))), []); },
    async upsert(cashier: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "cashiers", cashier.id), cashier); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "cashiers", id)); }); }
  },
  settlements: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "settlements"), orderBy("date", "desc")))), []); },
    async upsert(settlement: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "settlements", settlement.id), settlement); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "settlements", id)); }); }
  },
  priceGroups: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "price_groups"), orderBy("date", "desc")))), []); },
    async upsert(group: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "price_groups", group.id), group); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "price_groups", id)); }); }
  },
  units: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "units"))), []); },
    async upsert(unit: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "units", unit.id), unit); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "units", id)); }); }
  },
  lists: {
      async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "lists"), orderBy("date", "desc")))), []); },
      async upsert(list: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "lists", list.id), list); }); },
      async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "lists", id)); }); },
      async updateRowDismissed(listId: string, rowId: string) {
          return safeDbCall(async () => {
              const docRef = doc(firestore, "lists", listId);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const updatedRows = data.rows.map((r: any) => r.id === rowId ? { ...r, isDismissed: true } : r);
                  await updateDoc(docRef, { rows: updatedRows });
              }
          });
      }
  },
  tagLists: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "tag_lists"), orderBy("date", "desc")))), []); },
    async upsert(tagList: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "tag_lists", tagList.id), tagList); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "tag_lists", id)); }); }
  },
  offerLists: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "offer_lists"), orderBy("date", "desc")))), []); },
    async upsert(offerList: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "offer_lists", offerList.id), offerList); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "offer_lists", id)); }); }
  },
  catalogs: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "catalogs"), orderBy("date", "desc")))), []); },
    async get(id: string) { 
        return safeDbCall(async () => {
            const docSnap = await getDoc(doc(firestore, "catalogs", id));
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        }, null);
    },
    async upsert(cat: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "catalogs", cat.id), cat); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "catalogs", id)); }); }
  },
  branches: {
      async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(collection(firestore, "branches"))), []); },
      async upsert(branch: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "branches", branch.id), branch); }); },
      async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "branches", id)); }); }
  },
  dailySales: {
    async getAll() { return safeDbCall(async () => snapshotToArray(await getDocs(query(collection(firestore, "daily_sales"), orderBy("date", "desc")))), []); },
    async upsert(sale: any) { return safeDbCall(async () => { await setDoc(doc(firestore, "daily_sales", sale.id), sale); }); },
    async delete(id: string) { return safeDbCall(async () => { await deleteDoc(doc(firestore, "daily_sales", id)); }); },
    async deleteByBranch(branchId: string) {
        return safeDbCall(async () => {
            const q = query(collection(firestore, "daily_sales"));
            const snapshot = await getDocs(q);
            const batch = writeBatch(firestore);
            snapshot.docs.forEach(d => { if (d.data().branchId === branchId) batch.delete(d.ref); });
            await batch.commit();
        });
    },
    async deleteMany(ids: string[]) {
        return safeDbCall(async () => {
            const batch = writeBatch(firestore);
            ids.forEach(id => batch.delete(doc(firestore, "daily_sales", id)));
            await batch.commit();
        });
    }
  }
};
