(function () {
  const API_BASE = document.documentElement.dataset.apiBase || "";
  const POLL_INTERVAL = 6000;
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "admin123";

  const state = {
    tokens: [],
    currentNumber: 1,
    loading: false,
    pollingHandle: null,
    adminLoggedIn: false,
    currentPage: "landing",
    // Track if patient page was opened from admin dashboard
    returnToAdminFromPatient: false,
  };

  const pages = {
    landing: document.getElementById("landing-page"),
    patient: document.getElementById("patient-page"),
    adminLogin: document.getElementById("admin-login-page"),
    adminDashboard: document.getElementById("admin-dashboard-page"),
    upcoming: document.getElementById("upcoming-page"),
    visited: document.getElementById("visited-page"),
  };

  const ui = {
    connectionStatus: document.getElementById("connection-status"),
    estimatedInfo: document.getElementById("estimated-wait-info"),
    bookingForm: document.getElementById("booking-form"),
    bookingAlert: document.getElementById("booking-alert"),
    bookButton: document.getElementById("book-token-btn"),
    department: document.getElementById("department"),
    customDepartmentField: document.getElementById("custom-department-field"),
    customDepartment: document.getElementById("custom-department"),
    tokenTable: document.getElementById("token-table"),
    adminLoginForm: document.getElementById("admin-login-form"),
    adminAlert: document.getElementById("admin-alert"),
    adminCurrent: document.getElementById("admin-current"),
    adminWaiting: document.getElementById("admin-waiting"),
    adminLogoutBtn: document.getElementById("admin-logout-btn"),
    adminHomeBtn: document.getElementById("admin-home-btn"),
    nextNumberBtn: document.getElementById("next-number-btn"),
    resetQueueBtn: document.getElementById("reset-queue-btn"),
    upcomingList: document.getElementById("upcoming-list"),
    upcomingEmpty: document.getElementById("upcoming-empty"),
    visitedList: document.getElementById("visited-list"),
    visitedEmpty: document.getElementById("visited-empty"),
    // New UI elements
    patientBookingBtn: document.getElementById("patient-booking-btn"),
    adminBookingBtn: document.getElementById("admin-booking-btn"),
    adminBookingPatientBtn: document.getElementById("admin-booking-patient-btn"),
    adminVisitedPatientsBtn: document.getElementById("admin-visited-patients-btn"),
    adminUpcomingPatientsBtn: document.getElementById("admin-upcoming-patients-btn"),
    adminFormsContainer: document.getElementById("admin-forms-container"),
    backToLandingFromPatient: document.getElementById("back-to-landing-from-patient"),
    backToLandingFromAdmin: document.getElementById("back-to-landing-from-admin"),
    backToAdminFromUpcoming: document.getElementById("back-to-admin-from-upcoming"),
    backToAdminFromVisited: document.getElementById("back-to-admin-from-visited"),
    adminPatientForm: document.getElementById("admin-patient-form"),
    adminPatientAlert: document.getElementById("admin-patient-alert"),
    adminBookTokenBtn: document.getElementById("admin-book-token-btn"),
    adminDepartment: document.getElementById("admin-department"),
    adminCustomDepartmentField: document.getElementById("admin-custom-department-field"),
    adminCustomDepartment: document.getElementById("admin-custom-department"),
    // Queue status elements
    landingNowServing: document.getElementById("landing-now-serving"),
    landingInQueue: document.getElementById("landing-in-queue"),
    landingEstimatedWait: document.getElementById("landing-estimated-wait"),
    patientNowServing: document.getElementById("patient-now-serving"),
    patientInQueue: document.getElementById("patient-in-queue"),
    patientEstimatedWait: document.getElementById("patient-estimated-wait"),
    adminNowServing: document.getElementById("admin-now-serving"),
    adminInQueue: document.getElementById("admin-in-queue"),
    adminEstimatedWait: document.getElementById("admin-estimated-wait"),
  };

  const bookFormFields = {
    name: document.getElementById("name"),
    phone: document.getElementById("phone"),
    age: document.getElementById("age"),
  };

  const adminFormFields = {
    name: document.getElementById("admin-name"),
    phone: document.getElementById("admin-phone"),
    age: document.getElementById("admin-age"),
  };

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Page Navigation Functions
  function showPage(pageName) {
    Object.keys(pages).forEach((key) => {
      if (pages[key]) {
        pages[key].classList.toggle("hidden", key !== pageName);
      }
    });
    state.currentPage = pageName;
    
    // Start/stop polling based on current page
    if (pageName === "adminDashboard") {
      startPolling();
    } else {
      if (state.pollingHandle) {
        clearInterval(state.pollingHandle);
        state.pollingHandle = null;
      }
    }
  }

  function navigateToLanding() {
    showPage("landing");
  }

  function navigateToPatient() {
    showPage("patient");
    fetchQueue(); // Fetch queue data when patient page is shown
  }

  function navigateToAdminLogin() {
    showPage("adminLogin");
  }

  function navigateToAdminDashboard() {
    showPage("adminDashboard");
    fetchQueue();
  }

  // Admin sections are now separate pages; admin dashboard always shows booking + recent tokens

  function setConnectionStatus(text, isError = false) {
    if (!ui.connectionStatus) return;
    ui.connectionStatus.textContent = text;
    ui.connectionStatus.classList.toggle("error", isError);
  }

  function showAlert(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle("error", type === "error");
  }

  function hideAlert(element) {
    if (!element) return;
    element.hidden = true;
    element.classList.remove("error");
    element.textContent = "";
  }

  function getWaitingTokens() {
    return state.tokens.filter((token) => token.tokenNumber >= state.currentNumber);
  }

  function getVisitedTokens() {
    return state.tokens.filter((token) => token.tokenNumber < state.currentNumber);
  }

  function formatTime(value) {
    try {
      return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "--";
    }
  }

  function updateQueueView() {
    const waitingTokens = getWaitingTokens();
    const visitedTokens = getVisitedTokens();
    const waitingCount = waitingTokens.length;
    const displayCurrent = state.tokens.length > 0 ? Math.max(state.currentNumber - 1, 0) : 0;
    const estimatedMinutes = waitingCount * 5;

    // Update landing page queue status
    if (ui.landingNowServing) ui.landingNowServing.textContent = displayCurrent;
    if (ui.landingInQueue) ui.landingInQueue.textContent = waitingCount;
    if (ui.landingEstimatedWait) ui.landingEstimatedWait.textContent = estimatedMinutes;

    // Update patient page queue status
    if (ui.patientNowServing) ui.patientNowServing.textContent = displayCurrent;
    if (ui.patientInQueue) ui.patientInQueue.textContent = waitingCount;
    if (ui.patientEstimatedWait) ui.patientEstimatedWait.textContent = estimatedMinutes;

    // Update admin page queue status
    if (ui.adminNowServing) ui.adminNowServing.textContent = displayCurrent;
    if (ui.adminInQueue) ui.adminInQueue.textContent = waitingCount;
    if (ui.adminEstimatedWait) ui.adminEstimatedWait.textContent = estimatedMinutes;

    if (ui.estimatedInfo) {
      if (waitingCount > 0) {
        ui.estimatedInfo.textContent = `Estimated waiting time: ${estimatedMinutes} minutes.`;
      } else {
        ui.estimatedInfo.textContent = "No waiting time. You will be served next.";
      }
    }

    updateTokenTable();
    updateAdminView();
    renderVisited(visitedTokens);
  }

  function updateTokenTable() {
    if (!ui.tokenTable) return;
    const rowsFragment = document.createDocumentFragment();
    const recentTokens = [...state.tokens].slice(-10).reverse();

    if (recentTokens.length === 0) {
      const emptyRow = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "No tokens booked yet.";
      emptyRow.appendChild(cell);
      rowsFragment.appendChild(emptyRow);
    } else {
      for (const token of recentTokens) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>#${token.tokenNumber}</td>
          <td>${token.name ?? "Unknown"}</td>
          <td>${token.department ?? "-"}</td>
          <td>${formatTime(token.bookedAt)}</td>
        `;
        rowsFragment.appendChild(row);
      }
    }

    ui.tokenTable.replaceChildren(rowsFragment);
  }

  function updateAdminView() {
    if (state.currentPage !== "adminDashboard") return;

    const waitingTokens = getWaitingTokens();
    const waitingCount = waitingTokens.length;
    const displayCurrent = state.tokens.length > 0 ? Math.max(state.currentNumber - 1, 0) : 0;

    if (ui.adminCurrent) ui.adminCurrent.textContent = displayCurrent;
    if (ui.adminWaiting) ui.adminWaiting.textContent = waitingCount;

    if (ui.nextNumberBtn) ui.nextNumberBtn.disabled = waitingCount === 0;
    renderUpcoming(waitingTokens);
  }

  function renderUpcoming(waitingTokens) {
    if (!ui.upcomingList || !ui.upcomingEmpty) return;

    ui.upcomingList.textContent = "";

    if (waitingTokens.length === 0) {
      ui.upcomingEmpty.classList.remove("hidden");
      return;
    }

    ui.upcomingEmpty.classList.add("hidden");
    const fragment = document.createDocumentFragment();

    waitingTokens.slice(0, 10).forEach((token, index) => {
      const item = document.createElement("li");
      if (index === 0) item.classList.add("next");
      item.innerHTML = `
        <header>
          <span>Token #${token.tokenNumber}</span>
          <span>${formatTime(token.bookedAt)}</span>
        </header>
        <div>${token.name ?? "Patient"}</div>
        <span>${token.department ?? "General"}${token.age ? ` • Age: ${token.age}` : ""}</span>
      `;
      fragment.appendChild(item);
    });

    ui.upcomingList.appendChild(fragment);
  }

  function renderVisited(visitedTokens) {
    if (!ui.visitedList || !ui.visitedEmpty) return;

    ui.visitedList.textContent = "";

    if (visitedTokens.length === 0) {
      ui.visitedEmpty.classList.remove("hidden");
      return;
    }

    ui.visitedEmpty.classList.add("hidden");
    const fragment = document.createDocumentFragment();

    visitedTokens
      .slice(-20) // show last 20 visited patients
      .reverse()
      .forEach((token) => {
        const item = document.createElement("li");
        item.innerHTML = `
          <header>
            <span>Token #${token.tokenNumber}</span>
            <span>${formatTime(token.bookedAt)}</span>
          </header>
          <div>${token.name ?? "Patient"}</div>
          <span>${token.department ?? "General"}${token.age ? ` • Age: ${token.age}` : ""}</span>
        `;
        fragment.appendChild(item);
      });

    ui.visitedList.appendChild(fragment);
  }

  async function fetchQueue() {
    try {
      const response = await fetch(`${API_BASE}/api/queue`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch queue");
      const data = await response.json();
      state.tokens = Array.isArray(data.tokens) ? data.tokens : [];
      state.currentNumber = typeof data.currentNumber === "number" ? data.currentNumber : 1;
      setConnectionStatus("Online", false);
      updateQueueView();
    } catch (error) {
      console.error(error);
      setConnectionStatus("Offline", true);
    }
  }

  async function bookToken(payload, isAdmin = false) {
    const button = isAdmin ? ui.adminBookTokenBtn : ui.bookButton;
    const alert = isAdmin ? ui.adminPatientAlert : ui.bookingAlert;
    const form = isAdmin ? ui.adminPatientForm : ui.bookingForm;

    if (button) button.disabled = true;
    showAlert(alert, "Booking token…");

    try {
      const response = await fetch(`${API_BASE}/api/book-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to book token");
      }

      const token = await response.json();
      showAlert(alert, `Token booked successfully! Patient number is #${token.tokenNumber}.`);
      alert.classList.remove("error");
      if (form) form.reset();
      if (isAdmin && ui.adminCustomDepartmentField) {
        ui.adminCustomDepartmentField.classList.add("hidden");
      } else if (!isAdmin && ui.customDepartmentField) {
        ui.customDepartmentField.classList.add("hidden");
      }
      await fetchQueue();
    } catch (error) {
      console.error(error);
      showAlert(alert, error.message || "Unable to book token. Please try again.", "error");
    } finally {
      if (button) button.disabled = false;
      setTimeout(() => hideAlert(alert), 6000);
    }
  }

  async function callNextNumber() {
    try {
      if (ui.nextNumberBtn) ui.nextNumberBtn.disabled = true;
      const response = await fetch(`${API_BASE}/api/next-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Unable to advance the queue");
      await fetchQueue();
    } catch (error) {
      console.error(error);
      showAlert(ui.adminPatientAlert, error.message || "Failed to call next patient", "error");
    } finally {
      if (ui.nextNumberBtn) ui.nextNumberBtn.disabled = false;
      setTimeout(() => hideAlert(ui.adminPatientAlert), 4000);
    }
  }

  async function resetQueue() {
    const shouldReset = confirm("This will reset the entire queue. Continue?");
    if (!shouldReset) return;

    try {
      if (ui.resetQueueBtn) ui.resetQueueBtn.disabled = true;
      const response = await fetch(`${API_BASE}/api/reset-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reset queue");
      showAlert(ui.adminPatientAlert, "Queue reset successfully");
      await fetchQueue();
    } catch (error) {
      console.error(error);
      showAlert(ui.adminPatientAlert, error.message || "Unable to reset queue", "error");
    } finally {
      if (ui.resetQueueBtn) ui.resetQueueBtn.disabled = false;
      setTimeout(() => hideAlert(ui.adminPatientAlert), 4000);
    }
  }

  function validateBookingForm(isAdmin = false) {
    const nameField = isAdmin ? adminFormFields.name : bookFormFields.name;
    const phoneField = isAdmin ? adminFormFields.phone : bookFormFields.phone;
    const ageField = isAdmin ? adminFormFields.age : bookFormFields.age;
    const departmentSelect = isAdmin ? ui.adminDepartment : ui.department;
    const customDepartmentInput = isAdmin ? ui.adminCustomDepartment : ui.customDepartment;
    const alert = isAdmin ? ui.adminPatientAlert : ui.bookingAlert;

    const name = nameField ? nameField.value.trim() : "";
    const phone = phoneField ? phoneField.value.trim() : "";
    const age = ageField ? ageField.value.trim() : "";
    const departmentValue = departmentSelect ? departmentSelect.value : "";
    const customDepartmentValue = customDepartmentInput ? customDepartmentInput.value.trim() : "";

    if (!name || !phone || !age || !departmentValue) {
      showAlert(alert, "Please fill in all fields", "error");
      return null;
    }

    const ageNumber = Number.parseInt(age, 10);
    if (Number.isNaN(ageNumber) || ageNumber < 0 || ageNumber > 150) {
      showAlert(alert, "Please enter a valid age between 0 and 150", "error");
      return null;
    }

    let department = departmentValue;
    if (departmentValue === "others") {
      if (!customDepartmentValue) {
        showAlert(alert, "Please specify the department", "error");
        return null;
      }
      department = customDepartmentValue;
    }

    return {
      name,
      phone,
      age: ageNumber,
      department,
      bookedAt: new Date().toISOString(),
    };
  }

  function initEventListeners() {
    // Navigation buttons
    if (ui.patientBookingBtn) {
      ui.patientBookingBtn.addEventListener("click", navigateToPatient);
    }

    if (ui.adminBookingBtn) {
      ui.adminBookingBtn.addEventListener("click", navigateToAdminLogin);
    }

    if (ui.backToLandingFromPatient) {
      ui.backToLandingFromPatient.addEventListener("click", () => {
        if (state.returnToAdminFromPatient && state.adminLoggedIn) {
          // If patient page was opened from admin dashboard, go back there
          state.returnToAdminFromPatient = false;
          navigateToAdminDashboard();
        } else {
          // Default: go back to landing page
          navigateToLanding();
        }
      });
    }

    if (ui.backToLandingFromAdmin) {
      ui.backToLandingFromAdmin.addEventListener("click", navigateToLanding);
    }

    if (ui.backToAdminFromUpcoming) {
      ui.backToAdminFromUpcoming.addEventListener("click", navigateToAdminDashboard);
    }

    if (ui.backToAdminFromVisited) {
      ui.backToAdminFromVisited.addEventListener("click", navigateToAdminDashboard);
    }

    // Department dropdown handlers
    if (ui.department) {
      ui.department.addEventListener("change", (event) => {
        if (!ui.customDepartmentField || !ui.customDepartment) return;
        if (event.target.value === "others") {
          ui.customDepartmentField.classList.remove("hidden");
          ui.customDepartment.required = true;
        } else {
          ui.customDepartmentField.classList.add("hidden");
          ui.customDepartment.required = false;
          ui.customDepartment.value = "";
        }
      });
    }

    if (ui.adminDepartment) {
      ui.adminDepartment.addEventListener("change", (event) => {
        if (!ui.adminCustomDepartmentField || !ui.adminCustomDepartment) return;
        if (event.target.value === "others") {
          ui.adminCustomDepartmentField.classList.remove("hidden");
          ui.adminCustomDepartment.required = true;
        } else {
          ui.adminCustomDepartmentField.classList.add("hidden");
          ui.adminCustomDepartment.required = false;
          ui.adminCustomDepartment.value = "";
        }
      });
    }

    // Patient booking form
    if (ui.bookingForm) {
      ui.bookingForm.addEventListener("submit", (event) => {
        event.preventDefault();
        hideAlert(ui.bookingAlert);
        const payload = validateBookingForm(false);
        if (payload) {
          bookToken(payload, false);
        }
      });
    }

    // Admin login form
    if (ui.adminLoginForm) {
      ui.adminLoginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        hideAlert(ui.adminAlert);
        const username = document.getElementById("admin-username").value.trim();
        const password = document.getElementById("admin-password").value.trim();

        if (username === ADMIN_USER && password === ADMIN_PASS) {
          state.adminLoggedIn = true;
          showAlert(ui.adminAlert, "Admin login successful");
          document.getElementById("admin-username").value = "";
          document.getElementById("admin-password").value = "";
          navigateToAdminDashboard();
          setTimeout(() => {
            hideAlert(ui.adminAlert);
          }, 2000);
        } else {
          showAlert(ui.adminAlert, "Invalid credentials", "error");
        }

        setTimeout(() => hideAlert(ui.adminAlert), 4000);
      });
    }

    // Admin logout
    if (ui.adminLogoutBtn) {
      ui.adminLogoutBtn.addEventListener("click", () => {
        state.adminLoggedIn = false;
        navigateToLanding();
      });
    }

    if (ui.adminHomeBtn) {
      ui.adminHomeBtn.addEventListener("click", () => {
        navigateToLanding();
      });
    }

    // Admin dashboard section buttons
    if (ui.adminBookingPatientBtn) {
      ui.adminBookingPatientBtn.addEventListener("click", () => {
        // Mark that patient page was opened from admin dashboard
        state.returnToAdminFromPatient = true;
        navigateToPatient();
      });
    }

    if (ui.adminVisitedPatientsBtn) {
      ui.adminVisitedPatientsBtn.addEventListener("click", () => {
        showPage("visited");
      });
    }

    if (ui.adminUpcomingPatientsBtn) {
      ui.adminUpcomingPatientsBtn.addEventListener("click", () => {
        showPage("upcoming");
      });
    }

    // Admin patient form
    if (ui.adminPatientForm) {
      ui.adminPatientForm.addEventListener("submit", (event) => {
        event.preventDefault();
        hideAlert(ui.adminPatientAlert);
        const payload = validateBookingForm(true);
        if (payload) {
          bookToken(payload, true);
        }
      });
    }

    // Admin controls
    if (ui.nextNumberBtn) {
      ui.nextNumberBtn.addEventListener("click", (event) => {
        event.preventDefault();
        callNextNumber();
      });
    }

    if (ui.resetQueueBtn) {
      ui.resetQueueBtn.addEventListener("click", (event) => {
        event.preventDefault();
        resetQueue();
      });
    }
  }

  function startPolling() {
    if (state.pollingHandle) clearInterval(state.pollingHandle);
    // Only poll if on admin dashboard
    if (state.currentPage === "adminDashboard") {
      fetchQueue(); // Fetch immediately
      state.pollingHandle = setInterval(fetchQueue, POLL_INTERVAL);
    }
  }

  function init() {
    initEventListeners();
    showPage("landing");
    // Don't fetch queue on initial load, only when needed
  }

  window.addEventListener("focus", () => {
    if (state.currentPage === "adminDashboard" || state.currentPage === "patient") {
      fetchQueue();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (state.currentPage === "adminDashboard" || state.currentPage === "patient")) {
      fetchQueue();
    }
  });

  init();
})();
