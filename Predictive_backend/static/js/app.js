// app.js — shared logic for separated pages (FULL file)

// ---------------- Risk categorization ----------------
function riskFromGPA(gpa) {
  const val = Number(gpa);
  if (isNaN(val)) return { label: 'Unknown', badgeClass: '' };
  if (val >= 4.0) return { label: 'High', badgeClass: 'badge-risk-high' };
  if (val >= 2.5) return { label: 'Medium', badgeClass: 'badge-risk-medium' };
  return { label: 'Low', badgeClass: 'badge-risk-low' };
}

// ---------------- Suggestions generator ----------------
function suggestionsForGPA(gpa) {
  if (gpa >= 4.0) return [
    "Excellent performance — continue current study routines and peer mentoring.",
    "Maintain strong note-taking and time management."
  ];
  if (gpa >= 2.5) return [
    "Moderate performance — increase focused study time and practice past papers.",
    "Attend tutorials and consider study groups."
  ];
  return [
    "Low performance — book an advisor meeting and consider tutoring.",
    "Improve attendance, create a study schedule and use practice problems."
  ];
}

// ---------------- Local predictor (temporary fallback) ----------------
// Simple fallback combining Age, Study_Hours_Per_Day, WAEC_Average
function localLinearPredict(payload) {
  const intercept = 1.2;
  const coefStudy = 0.30; // effect per study hour/day
  const coefAge = 0.02;   // small age effect
  const coefWaec = 0.40;  // stronger effect for WAEC average (numeric 1..6)

  const age = Number(payload.Age || 18);
  const study = Number(payload.Study_Hours_Per_Day || 1);
  const waec = Number(payload.WAEC_Average || 4);

  let gpa = intercept + coefStudy * study + coefAge * (age / 10) + coefWaec * ( (6 - (waec - 1)) / 6 * 2 ); 
  // this is a rough heuristic fallback to map lower numeric grades -> higher contribution.
  // Bound to 0..5
  if (gpa < 0) gpa = 0;
  if (gpa > 5.0) gpa = 5.0;
  return Math.round(gpa * 100) / 100;
}

// ---------------- Student Login (redirect to questionnaire) ----------------
(function studentLoginHandler(){
  const form = document.getElementById('studentLoginForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = document.getElementById('studentId').value.trim();
    const pwd = document.getElementById('studentPassword').value.trim();
    if (!studentId || !pwd) {
      alert('Please enter Student ID and password.');
      return;
    }
    sessionStorage.setItem('studentId', studentId);
    window.location.href = '/student-questionnaire';
  });
})();

// ---------------- Student Questionnaire handler ----------------
(function studentQuestionnaireHandler(){
  const qForm = document.getElementById('questionnaireForm');
  if (!qForm) return;

  // Show welcome if studentId present
  const sid = sessionStorage.getItem('studentId');
  const welcome = document.getElementById('welcomeStudent');
  if (welcome && sid) {
    welcome.textContent = 'Welcome, ' + sid + '. Please complete the form below.';
  }

  // Logout button
  const logoutBtn = document.getElementById('studentLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('studentId');
      window.location.href = '/student-login';
    });
  }

  qForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const spinner = document.getElementById('predictSpinner');
    spinner && spinner.classList.remove('d-none');

    // --- Collect required model features ---

    // Age
    const ageVal = Number(document.getElementById('age').value);

    // Study hours per day
    const shpdVal = Number(document.getElementById('studyHoursPerDay').value);

    // WAEC grades -> multiple checkbox values (1..6). Compute numeric average.
    const gradeChecks = document.querySelectorAll('input[name="waecGrades"]:checked');
    if (gradeChecks.length === 0) {
      spinner && spinner.classList.add('d-none');
      alert('Please select at least one WAEC grade (you can select multiple subjects).');
      return;
    }
    const waecVals = Array.from(gradeChecks).map(cb => Number(cb.value));
    const waecAverage = waecVals.reduce((a,b) => a + b, 0) / waecVals.length;

    // exam prep flags (0/1)
    const checked = id => (document.getElementById(id) && document.getElementById(id).checked) ? 1 : 0;
    const Exam_Preparation_Collaborating_with_study_partners = checked('prep_collab');
    const Exam_Preparation_Practicing_past_exam_papers = checked('prep_past');
    const Exam_Preparation_Reviewing_lecture_notes_and_materials = checked('prep_notes');
    const Exam_Preparation_Seeking_help_from_instructors_or_tutors = checked('prep_help');

    // helpful materials flags (0/1)
    const Helpful_Study_Materials_Lecture_notes = checked('mat_notes');
    const Helpful_Study_Materials_Online_resources_eg = checked('mat_online');
    const Helpful_Study_Materials_Practice_problems_and_exercises = checked('mat_practice');
    const Helpful_Study_Materials_Textbooks = checked('mat_textbook');
    const Helpful_Study_Materials_tutorials = checked('mat_tutorials');
    const Helpful_Study_Materials_video_lectures = checked('mat_videos');

    // Validate required numeric fields
    if (isNaN(ageVal) || ageVal <= 0) {
      spinner && spinner.classList.add('d-none');
      alert('Please enter a valid Age.');
      return;
    }
    if (isNaN(shpdVal) || shpdVal < 0) {
      spinner && spinner.classList.add('d-none');
      alert('Please enter a valid number of study hours per day.');
      return;
    }

    // Payload with ALL 21 features as expected
    const payload = {
      Age: ageVal,
      Study_Hours_Per_Day: shpdVal,
      WAEC_Average: waecAverage,
      Exam_Preparation_Collaborating_with_study_partners,
      Exam_Preparation_Practicing_past_exam_papers,
      Exam_Preparation_Reviewing_lecture_notes_and_materials,
      Exam_Preparation_Seeking_help_from_instructors_or_tutors,
      Helpful_Study_Materials_Lecture_notes,
      Helpful_Study_Materials_Online_resources_eg,
      Helpful_Study_Materials_Practice_problems_and_exercises,
      Helpful_Study_Materials_Textbooks,
      Helpful_Study_Materials_tutorials,
      Helpful_Study_Materials_video_lectures,
      
      // Scaled features
      Age_standardized: (ageVal - 18) / 2.0,  // Simple standardization approximation
      Age_minmax: Math.min(Math.max((ageVal - 15) / 10, 0), 1),  // Min-max scaling approximation
      Study_Hours_Per_Day_standardized: (shpdVal - 3) / 2.0,
      Study_Hours_Per_Day_minmax: Math.min(Math.max(shpdVal / 8, 0), 1),
      WAEC_Average_standardized: (waecAverage - 3) / 1.5,
      WAEC_Average_minmax: Math.min(Math.max((waecAverage - 1) / 5, 0), 1),
      
      // Target variable features
      First_Year_GPA_Average_standardized: 0.0,
      First_Year_GPA_Average_minmax: 0.0
    };

    try {
      // --- Send to backend ---
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        // If backend responds with non-200, try to read JSON for details, else fallback.
        let errText = 'Backend returned error';
        try {
          const eBody = await resp.json();
          errText = eBody.error || JSON.stringify(eBody);
        } catch (err) {
          errText = `HTTP ${resp.status}`;
        }
        throw new Error(errText);
      }

      const data = await resp.json();
      // Backend returns { predicted_gpa: <num>, suggestions: [...] }
      const predicted = Number(data.predicted_gpa);
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : suggestionsForGPA(predicted);

      displayPredictionResult(predicted, suggestions);
    } catch (err) {
      // If backend fails, fall back to local predictor
      console.warn('Backend call failed — using local fallback.', err);
      const fallbackGpa = localLinearPredict(payload);
      const suggestions = suggestionsForGPA(fallbackGpa);
      displayPredictionResult(fallbackGpa, suggestions);
    } finally {
      spinner && spinner.classList.add('d-none');
    }
  });

  // Display result helper
  function displayPredictionResult(gpa, suggestions) {
    const resultCard = document.getElementById('resultCard');
    const predGPA = document.getElementById('predGPA');
    const riskBadge = document.getElementById('riskBadge');
    const suggestionsList = document.getElementById('suggestionsList');

    predGPA.textContent = gpa.toFixed(2);
    const risk = riskFromGPA(gpa);
    riskBadge.textContent = ' ' + risk.label + ' ';
    // Use existing CSS badge classes if present, otherwise fallback to Bootstrap classes
    riskBadge.className = 'badge ' + (risk.badgeClass || 'bg-secondary');

    suggestionsList.innerHTML = '<h6>Suggestions</h6><ul>' + suggestions.map(s => `<li>${s}</li>`).join('') + '</ul>';
    resultCard.classList.remove('d-none');
  }
})();

// ---------------- Admin Login---------------
(function adminLoginHandler() {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const adminId = document.getElementById('adminId').value.trim();

    if (!adminId) {
      alert('Please enter Admin ID.');
      return;
    }

    if (adminId === "AdminID") {
      sessionStorage.setItem('adminId', adminId);
      window.location.href = '/admin-dashboard';
    } else {
      alert('Invalid Admin ID. Access denied.');
    }
  });
})();


// ---------------- Admin Dashboard ----------------
(function adminDashboardHandler(){
  const table = document.getElementById('predTable');
  if (!table) return;

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('adminId');
      window.location.href = '/admin-login';
    });
  }

  // Demo data for UI
  const data = [
    {id: 'S1001', gpa: 3.45, predictors: 'Age 18; Study 3h/day; WAEC avg 2.1'},
    {id: 'S1002', gpa: 2.6,  predictors: 'Age 19; Study 1h/day; WAEC avg 3.8'},
    {id: 'S1003', gpa: 1.8,  predictors: 'Age 17; Study <1h/day; WAEC avg 4.5'},
    {id: 'S1004', gpa: 4.5,  predictors: 'Age 20; Study 5h/day; WAEC avg 1.6'}
  ];

  const tbody = table.querySelector('tbody');
  const filterRisk = document.getElementById('filterRisk');
  const exportBtn = document.getElementById('exportCsv');

  function render(filter='all') {
    tbody.innerHTML = '';
    data.forEach(row => {
      const r = riskFromGPA(row.gpa);
      if (filter !== 'all') {
        const map = {low:'Low', medium:'Medium', high:'High'};
        if (r.label.toLowerCase() !== map[filter]) return;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.id}</td>
                      <td>${row.gpa.toFixed(2)}</td>
                      <td><span class="badge ${r.badgeClass}">${r.label}</span></td>
                      <td>${row.predictors}</td>`;
      tbody.appendChild(tr);
    });
  }

  render();

  filterRisk && filterRisk.addEventListener('change', (e) => render(e.target.value));

  exportBtn && exportBtn.addEventListener('click', () => {
    const rows = data.filter(r => riskFromGPA(r.gpa).label !== 'Low');
    if (rows.length === 0) {
      alert('No at-risk students in current view.');
      return;
    }
    const csvRows = [
      ['Student ID','Predicted GPA','Risk','Key Predictors'],
      ...rows.map(r => [r.id, r.gpa.toFixed(2), riskFromGPA(r.gpa).label, `"${r.predictors}"`])
    ];
    const csvString = csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'at_risk_students.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();

