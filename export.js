import { db, collection, getDocs, addDoc, query, where, doc, updateDoc,orderBy, 
    limit, 
    startAfter,
    getDocsFromServer,auth,onAuthStateChanged,signInWithEmailAndPassword} from './firebase-config.js';
  
  // --- Global Variables ---
  const localDB = new PouchDB('customers');

  let knownPhoneNumbers = new Set();
  const PAGE_SIZE = 25;
  let lastVisibleDoc = null;
  let firstVisibleDoc = null;
  let currentPageNumber = 1;
  
  // --- DOM Elements ---
  const loginPage = document.getElementById('loginPage');
  const mainContainer = document.querySelector('.container');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const form = document.getElementById('leadForm');
  const dataTable = document.getElementById('dataTable').querySelector('tbody');
  const phoneInput = document.getElementById('phone');
  const showAdminBtn = document.getElementById('showAdminBtn');
  const adminSection = document.getElementById('adminSection');
  const closeAdminBtn = document.getElementById('closeAdminBtn');
  const pdfBtn = document.getElementById('pdfBtn');
  const xlsxBtn = document.getElementById('xlsxBtn');
  const phoneValidationError = document.getElementById('phone-validation-error');
  const phoneStatus = document.getElementById('phone-status');
  const customerTypeInput = document.getElementById('customerType');
  const submitBtn = document.getElementById('submitBtn');
  const importBtn = document.getElementById('importBtn');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const pageInfo = document.getElementById('pageInfo');
  
  let debounceTimer;
  
  // --- Main App Initialization ---
// --- Main App Initialization (NEW VERSION) ---
function init() {
    // Listen for changes in the user's login state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is logged in (or was remembered from a previous session)
            loginPage.style.display = 'none';
            mainContainer.style.display = 'block';
            populateKnownNumbers(); // Load data now that we know they are logged in
        } else {
            // User is signed out
            loginPage.style.display = 'flex';
            mainContainer.style.display = 'none';
        }
    });

    // Attach all other event listeners
    loginForm.addEventListener('submit', handleLogin);
    form.addEventListener('submit', handleFormSubmit);
    phoneInput.addEventListener('input', handlePhoneInput);

    showAdminBtn.addEventListener('click', () => {
        adminSection.style.display = 'block';
        showAdminBtn.style.display = 'none';
        currentPageNumber = 1;
        lastVisibleDoc = null;
        firstVisibleDoc = null;
        loadDataTable('first');
    });

    closeAdminBtn.addEventListener('click', () => {
        adminSection.style.display = 'none';
        showAdminBtn.style.display = 'block';
    });

    pdfBtn.addEventListener('click', exportPDF);
    xlsxBtn.addEventListener('click', exportXLSX);
    importBtn.addEventListener('click', handleExcelImport);
    nextBtn.addEventListener('click', () => loadDataTable('next'));
    prevBtn.addEventListener('click', () => loadDataTable('prev'));

    window.addEventListener('online', syncOfflineData);
}
  
  // --- Phone Input Handler ---
  function handlePhoneInput() {
      phoneInput.value = phoneInput.value.replace(/[^0-9+\-]/g, '');
  
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
          const phone = phoneInput.value.trim();
          phoneValidationError.style.display = 'none';
          if (!phone) {
            phoneStatus.textContent = '';
            phoneStatus.className = '';
            customerTypeInput.value = 'New';
            submitBtn.textContent = 'Submit';
            document.getElementById('company').value = '';
            document.getElementById('name').value = '';
            document.getElementById('email').value = '';
            document.getElementById('address').value = '';
            const cardRadios = form.querySelectorAll('input[name="card"]');
            cardRadios.forEach(r => r.checked = false);
            return; // Exit the function
        }
          phoneStatus.textContent = '';
          phoneStatus.className = '';
          customerTypeInput.value = '';
          submitBtn.textContent = 'Submit';
          submitBtn.disabled = false;
  
          if (phone.length < 5) return;
  
          if (await isDuplicate(phone)) {
              phoneStatus.textContent = "Status: Existing Customer";
              phoneStatus.className = 'status-existing';
              customerTypeInput.value = 'Existing';
              submitBtn.textContent = 'Update Record';
              const existingData = await getCustomerDataByPhone(phone);
    if (existingData) {
        document.getElementById('company').value = existingData.company || '';
        document.getElementById('name').value = existingData.name || '';
        document.getElementById('email').value = existingData.email || '';
        document.getElementById('address').value = existingData.address || '';
        const cardValue = existingData.card;
        if (cardValue) {
            const cardRadio = form.querySelector(`input[name="card"][value="${cardValue}"]`);
            if (cardRadio) {
                cardRadio.checked = true;
            }
        } else {
            // Uncheck all radio buttons if no card value exists
            const cardRadios = form.querySelectorAll('input[name="card"]');
            cardRadios.forEach(r => r.checked = false);

        }
    }
          } else {
              phoneStatus.textContent = "Status: New Customer";
              phoneStatus.className = 'status-new';
              customerTypeInput.value = 'New';
              document.getElementById('company').value = '';
              document.getElementById('name').value = '';
              document.getElementById('email').value = '';
              document.getElementById('address').value = '';
              form.card.value = '';
              const cardRadios = form.querySelectorAll('input[name="card"]');
              cardRadios.forEach(r => r.checked = false);
          }
      }, 500);
  }
  
  // --- Login Handler ---
  // --- Login Handler (SIMPLIFIED VERSION) ---
async function handleLogin(e) {
    e.preventDefault();
    loginError.style.display = "none";

    const username = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const email = username + '@sivaprints.app'; 

    try {
        // Just attempt to sign in. The onAuthStateChanged listener will handle UI changes.
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error("Login failed:", error.code);
        loginError.textContent = "Invalid username or password.";
        loginError.style.display = "block";
    }
}
  
  // --- Form Submit Handler (Create or Update) ---
  async function handleFormSubmit(e) {
      e.preventDefault();
      submitBtn.disabled = true;
  
      try {
          const currentDate = new Date(); // Not toLocaleDateString
          const data = {
              company: document.getElementById('company').value,
              name: document.getElementById('name').value,
              phone: document.getElementById('phone').value,
              email: document.getElementById('email').value,
              address: document.getElementById('address').value,
              card: form.card.value,
              customerType: customerTypeInput.value,
              date: currentDate
          };
  
          if (!navigator.onLine) {
              await localDB.post(data);
              if (data.phone) knownPhoneNumbers.add(data.phone.trim());
              showToast("Offline. Data saved locally.");
              form.reset();
              return;
          }
  
          if (data.customerType === 'Existing') {
              const docId = await getDocIdByPhone(data.phone);
              if (docId) {
                  const docRef = doc(db, "customers", docId);
                  await updateDoc(docRef, data);
                  showToast("Record Updated!");
              } else {
                  await addDoc(collection(db, "customers"), data);
                  showToast("Record created as new (ID not found).");
              }
          } else {
              await addDoc(collection(db, "customers"), data);
              if (data.phone) knownPhoneNumbers.add(data.phone.trim());
              showToast("New Record Submitted!");
          }
  
          form.reset();
          currentPageNumber = 1;
          lastVisibleDoc = null;
          firstVisibleDoc = null;
          loadDataTable('first');
  
      } catch (err) {
          showToast("Error submitting form: " + err.message);
      } finally {
          submitBtn.disabled = false;
      }
  }
  
  // --- Data Functions ---
  async function isDuplicate(phone) {
      return knownPhoneNumbers.has(phone);
  }
  
  async function getDocIdByPhone(phone) {
      if (!navigator.onLine) return null;
      const q = query(collection(db, "customers"), where("phone", "==", phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
          return snap.docs[0].id;
      }
      return null;
  }
  async function getCustomerDataByPhone(phone) {
    const q = query(collection(db, "customers"), where("phone", "==", phone));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].data(); // return the first matching customer record
    }
    return null;
}

  async function syncOfflineData() {
      const allDocs = await localDB.allDocs({ include_docs: true });
      for (const row of allDocs.rows) {
          const entry = row.doc;
          if (!(await isDuplicate(entry.phone))) {
              await addDoc(collection(db, "customers"), entry);
          }
          await localDB.remove(entry);
      }
      showToast("Offline data synced!");
      currentPageNumber = 1;
      lastVisibleDoc = null;
      firstVisibleDoc = null;
      loadDataTable('first');
  }
  
  async function populateKnownNumbers() {
      console.log("Pre-loading phone numbers for validation...");
      knownPhoneNumbers.clear();
      try {
          const snap = await getDocs(collection(db, "customers"));
          snap.forEach(doc => {
              const data = doc.data();
              if (data.phone) {
                  knownPhoneNumbers.add(data.phone.trim());
              }
          });
          console.log(`${knownPhoneNumbers.size} phone numbers loaded into memory.`);
      } catch (err) {
          console.error("Error pre-loading phone numbers:", err);
          showToast("Could not load initial customer list.");
      }
  }
  
  // --- Table & Export Functions ---
  async function loadDataTable(direction) {
      if (!navigator.onLine) {
          showToast("Cannot load records while offline.");
          return;
      }
  
      const { orderBy, limit, startAfter, endBefore, getDocsFromServer } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      let q;
      const customersRef = collection(db, "customers");
      const pageQueryConstraints = [orderBy("date", "desc")];
  
      if (direction === 'first') {
          currentPageNumber = 1;
          pageQueryConstraints.push(limit(PAGE_SIZE));
      } else if (direction === 'next' && lastVisibleDoc) {
          pageQueryConstraints.push(startAfter(lastVisibleDoc), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisibleDoc) {
          // Going back is complex; we rely on disabling the button instead of complex queries.
          if (currentPageNumber <= 1) return; 
          currentPageNumber--;
          // To properly go back, you would need to store the first doc of each page.
          // For simplicity, we'll reload from the start to the new 'previous' page.
          // This is a common simplification.
          // Let's adjust the logic to be more straightforward for the prev button.
          // The most robust way is to store a history of firstVisibleDocs for each page.
          // For now, we will reset to first page if user tries to go back.
          loadDataTable('first');
          return;
      } else {
          pageQueryConstraints.push(limit(PAGE_SIZE));
      }
      
      q = query(customersRef, ...pageQueryConstraints);
  
      try {
          const documentSnapshots = await getDocsFromServer(q);
  
          if (documentSnapshots.empty) {
              if (direction === 'next') nextBtn.disabled = true;
              return;
          }
          
          if (direction === 'next') currentPageNumber++;
          
          firstVisibleDoc = documentSnapshots.docs[0];
          lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
  
          dataTable.innerHTML = "";
          documentSnapshots.forEach(doc => {
              const d = doc.data();
              const customerType = d.customerType || 'N/A';
              // Handle Firestore Timestamp or string date
              let displayDate = 'N/A';
              if (d.date) {
                  if (typeof d.date === 'object' && typeof d.date.toDate === 'function') {
                      displayDate = d.date.toDate().toLocaleDateString('en-IN');
                  } else {
                      displayDate = d.date;
                  }
              }
              const row = `<tr>
                  <td>${d.company}</td>
                  <td>${d.name}</td>
                  <td>${d.phone}</td>
                  <td>${d.email}</td>
                  <td>${d.address}</td>
                  <td>${d.card}</td>
                  <td>${customerType}</td>
                  <td>${displayDate}</td>
              </tr>`;
              dataTable.innerHTML += row;
          });
  
          pageInfo.textContent = `Page ${currentPageNumber}`;
          prevBtn.disabled = currentPageNumber === 1;
          nextBtn.disabled = documentSnapshots.docs.length < PAGE_SIZE;
  
      } catch (err) {
          console.error("Error loading data table:", err);
          showToast("Error loading records.");
      }
  }
  
  async function getAllDataForExport() {
      const allEntries = new Map();
      if (navigator.onLine) {
          const snap = await getDocs(collection(db, "customers"));
          snap.forEach(doc => {
              allEntries.set(doc.data().phone, doc.data());
          });
      }
      const localDocs = await localDB.allDocs({ include_docs: true });
      localDocs.rows.forEach(row => {
          allEntries.set(row.doc.phone, row.doc);
      });
  
      const rawData = Array.from(allEntries.values());
      const cleanedData = rawData.map(entry => {
          const { _id, _rev, ...cleanEntry } = entry;
          if (!cleanEntry.customerType) {
              cleanEntry.customerType = 'N/A';
          }
          return cleanEntry;
      });
  
      return cleanedData;
  }
  
  async function exportXLSX() {
      const data = await getAllDataForExport();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
      XLSX.writeFile(workbook, "expo-leads.xlsx");
  }
  
  async function exportPDF() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 10;
      doc.setFontSize(12);
      doc.text("Expo Leads Report", 10, y);
      y += 10;
  
      const data = await getAllDataForExport();
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      data.forEach(d => {
          const dateStr = d.date ? `[${d.date}] ` : '';
          doc.text(`${dateStr}${d.name} (${d.phone}) - ${d.company}`, 10, y);
          y += 8;
          if (y > 280) {
              doc.addPage();
              y = 10;
          }
      });
      doc.save("expo-leads.pdf");
  }
  
  // --- Utility Functions ---
  function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.style.display = 'block';
      setTimeout(() => {
          toast.style.display = 'none';
      }, 3000);
  }
  
  function yieldToMainThread() {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }
  
  // --- Excel Import Handler ---
  async function handleExcelImport() {
      const fileInput = document.getElementById('excelFile');
      const statusDiv = document.getElementById('import-status');
      const importBtn = document.getElementById('importBtn');
  
      if (fileInput.files.length === 0) {
          statusDiv.textContent = "Please select a file first."; return;
      }
  
      importBtn.disabled = true;
      importBtn.textContent = "Processing...";
      statusDiv.style.color = '#333';
  
      const file = fileInput.files[0];
      const reader = new FileReader();
  
      reader.onload = async (event) => {
          try {
              statusDiv.textContent = "Analyzing file...";
              await yieldToMainThread();
  
              const data = new Uint8Array(event.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
              const records = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  const currentDate = new Date(); // Use Date object for Firestore Timestamp
              const recordsToImport = [];
              let skippedCount = 0;
              const processedPhonesInThisFile = new Set();
  
              for (const record of records) {
                  const phone = record.phone ? String(record.phone).trim() : null;
                  if (!phone || knownPhoneNumbers.has(phone) || processedPhonesInThisFile.has(phone)) {
                      skippedCount++;
                      continue;
                  }
                  recordsToImport.push({ ...record, customerType: 'Existing',  date: record.date ? new Date(record.date) : currentDate });
                  processedPhonesInThisFile.add(phone);
              }
  
              const { writeBatch, doc: createDocRef } = await import('./firebase-config.js');
  
              for (let i = 0; i < recordsToImport.length; i += 500) {
                  const chunk = recordsToImport.slice(i, i + 500);
                  const batch = writeBatch(db);
                  statusDiv.textContent = `Importing batch ${Math.floor(i / 500) + 1}...`;
                  chunk.forEach(record => {
                      const docRef = createDocRef(collection(db, "customers"));
                      batch.set(docRef, record);
                  });
                  await batch.commit();
              }
  
              recordsToImport.forEach(record => knownPhoneNumbers.add(record.phone));
              statusDiv.textContent = `Import complete! ✅ ${recordsToImport.length} new records added, ${skippedCount} duplicates skipped.`;
              statusDiv.style.color = '#008000';
              
              currentPageNumber = 1;
              lastVisibleDoc = null;
              firstVisibleDoc = null;
              loadDataTable('first');
  
          } catch (error) {
              statusDiv.textContent = "Error during import: " + error.message;
              statusDiv.style.color = 'red';
          } finally {
              importBtn.disabled = false;
              importBtn.textContent = "Import from Excel";
              fileInput.value = "";
          }
      };
      
      reader.readAsArrayBuffer(file);
  }
  
  // --- Start the App ---
  document.addEventListener('DOMContentLoaded', init);