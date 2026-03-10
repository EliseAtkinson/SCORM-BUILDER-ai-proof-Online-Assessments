// =======================================================
// SCORM BUILDER —  ai proof Online Assessments
// No Screenshot + Copy/Paste to prevent AI prompting
// Elise Atkinson, MA & Kristy Brinker Brouwer, Ph.D.
// =======================================================

// Inject builder styles
const style = document.createElement('style');
style.textContent = `
  .question-block {
    border: 1px solid #ddd;
    padding: 16px;
    margin-bottom: 20px;
    border-radius: 8px;
    background: #fafafa;
  }
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .mcq-container {
    margin-top: 12px;
  }
  .option-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 10px 0;
    padding: 4px 0;
  }
  .mcq-correct {
    width: 20px;
    height: 20px;
    margin: 0;
    flex-shrink: 0;
  }
  .mcq-option {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    font-size: 15px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }
  .mcq-option::placeholder {
    color: #aaa;
    font-style: italic;
  }
`;
document.head.appendChild(style);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c] || c));
}

function escapeXml(str) {
  return escapeHtml(str);  // Usually same for manifest XML in this case
}

function buildManifest(title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="scormpackage"
          version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2
                              imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2
                              adlcp_rootv1p2.xsd">
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${escapeXml(title)}</title>
      <item identifier="ITEM1" identifierref="RES1">
        <title>${escapeXml(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1"
              type="webcontent"
              adlcp:scormtype="sco"
              href="index.html">
      <file href="index.html"/>
      <file href="runtime.js"/>
      <file href="scorm_api_wrapper.js"/>
    </resource>
  </resources>
</manifest>`;
}

function scormApiWrapperSource() {
  return `
// =======================================================
// UNIVERSAL SCORM 1.2 API FINDER
// Works with Blackboard, Canvas, Moodle, D2L, SCORM Cloud
// =======================================================

var api = null;

function findAPI(win) {

  var attempts = 0;

  while ((win.API == null) && (win.parent != null) && (win.parent != win)) {

    attempts++;

    if (attempts > 500) {
      console.warn("SCORM API search exceeded limit.");
      return null;
    }

    win = win.parent;
  }

  return win.API;
}

function getAPI() {

  var api = findAPI(window);

  if ((api == null) && (window.opener != null)) {
    api = findAPI(window.opener);
  }

  return api;
}

api = getAPI();

// =======================================================
// SCORM INITIALIZE
// =======================================================

function scormInitialize() {

  if (!api) {
    console.warn("SCORM API not found.");
    return false;
  }

  var result = api.LMSInitialize("");

  if (result !== "true") {
    console.warn("SCORM initialization failed.");
  }

  return result;
}

window.addEventListener("load", scormInitialize);

// =======================================================
// SCORE REPORTING
// =======================================================

function scormReportScore(percent) {

  if (!api) return;

  try {

    api.LMSSetValue("cmi.core.score.raw", String(percent));
    api.LMSSetValue("cmi.core.score.max", "100");
    api.LMSSetValue("cmi.core.score.min", "0");

    var status = percent >= 70 ? "passed" : "failed";

    api.LMSSetValue("cmi.core.lesson_status", status);

    api.LMSCommit("");

  } catch (e) {
    console.error("SCORM reporting error:", e);
  }

}

// =======================================================
// SAFE FINISH
// =======================================================

function scormFinish() {

  if (!api) return;

  try {
    api.LMSCommit("");
    api.LMSFinish("");
  } catch (e) {
    console.warn("SCORM finish error", e);
  }

}

window.addEventListener("beforeunload", scormFinish);
`;
}

const questionsContainer = document.getElementById("questionsContainer");
const addQuestionBtn     = document.getElementById("addQuestionBtn");
const generateBtn        = document.getElementById("generateBtn");

let questionCount = 0;

function createQuestionBlock() {
    questionCount++;

    const wrapper = document.createElement("div");
    wrapper.className = "question-block";

    // Header
    const header = document.createElement("div");
    header.className = "question-header";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = `Question ${questionCount}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => {
        wrapper.remove();
        renumberQuestions();
    };

    header.appendChild(titleSpan);
    header.appendChild(removeBtn);

    // Question type selector
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Question type:";

    const typeSelect = document.createElement("select");
    typeSelect.className = "question-type";
    typeSelect.innerHTML = `
        <option value="mcq">Multiple Choice</option>
        <option value="tf">True/False</option>
        <option value="sa">Short Answer</option>
    `;

    // Question text
    const textLabel = document.createElement("label");
    textLabel.textContent = "Question text:";

    const textArea = document.createElement("textarea");
    textArea.rows = 3;
    textArea.className = "question-text";
    textArea.placeholder = "Enter question text here...";

    // ── Multiple Choice ─────────────────────────────────────
    const mcqContainer = document.createElement("div");
    mcqContainer.className = "mcq-container";

    for (let i = 0; i < 4; i++) {
        const row = document.createElement("div");
        row.className = "option-row";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `correct-${questionCount}`;
        radio.className = "mcq-correct";

        const optInput = document.createElement("input");
        optInput.type = "text";
        optInput.placeholder = `Option ${i + 1}`;
        optInput.className = "mcq-option";

        row.appendChild(radio);
        row.appendChild(optInput);
        mcqContainer.appendChild(row);
    }

    // ── True/False ──────────────────────────────────────────
    const tfContainer = document.createElement("div");
    tfContainer.className = "tf-container";
    tfContainer.style.display = "none";
    tfContainer.innerHTML = `
        <label>Correct answer (True/False):</label>
        <select class="tf-answer">
            <option value="true">True</option>
            <option value="false">False</option>
        </select>
    `;

    // ── Short Answer ────────────────────────────────────────
    const saContainer = document.createElement("div");
    saContainer.className = "sa-container";
    saContainer.style.display = "none";
    saContainer.innerHTML = `
        <label>Correct answer (short text, case-insensitive):</label>
        <input type="text" class="sa-answer" placeholder="Correct answer">
    `;

    // Show/hide containers based on type
    typeSelect.addEventListener("change", () => {
        const type = typeSelect.value;
        mcqContainer.style.display = type === "mcq" ? "block" : "none";
        tfContainer.style.display = type === "tf"  ? "block" : "none";
        saContainer.style.display = type === "sa"  ? "block" : "none";
    });

    // Assemble question block
    wrapper.appendChild(header);
    wrapper.appendChild(typeLabel);
    wrapper.appendChild(typeSelect);
    wrapper.appendChild(textLabel);
    wrapper.appendChild(textArea);
    wrapper.appendChild(mcqContainer);
    wrapper.appendChild(tfContainer);
    wrapper.appendChild(saContainer);

    questionsContainer.appendChild(wrapper);
}

function renumberQuestions() {
    const blocks = document.querySelectorAll(".question-block");
    questionCount = 0;

    blocks.forEach((block, idx) => {
        questionCount = idx + 1;

        const headerSpan = block.querySelector(".question-header span");
        headerSpan.textContent = `Question ${questionCount}`;

        const radios = block.querySelectorAll(".mcq-correct");
        radios.forEach(r => {
            r.name = `correct-${questionCount}`;
        });
    });
}

// Event listeners
addQuestionBtn.addEventListener("click", () => {
    createQuestionBlock();
});

// Start with one question
createQuestionBlock();

generateBtn.addEventListener("click", async () => {
    const moduleTitleInput = document.getElementById("moduleTitle");
    const moduleTitle = moduleTitleInput.value.trim() || "SCORM ai proof Online Assessments";

    const blocks = Array.from(document.querySelectorAll(".question-block"));
    if (blocks.length === 0) {
        alert("Please add at least one question.");
        return;
    }

    const questions = [];

    for (const block of blocks) {
        const type = block.querySelector(".question-type").value;
        const text = block.querySelector(".question-text").value.trim();

        if (!text) {
            alert("All questions must have text.");
            return;
        }

        if (type === "mcq") {
            const options = Array.from(block.querySelectorAll(".mcq-option"))
                .map(o => o.value.trim())
                .filter(o => o.length > 0);

            const radios = Array.from(block.querySelectorAll(".mcq-correct"));
            const correctIndex = radios.findIndex(r => r.checked);

            if (options.length < 2) {
                alert("MCQ questions need at least two options.");
                return;
            }
            if (correctIndex === -1) {
                alert("MCQ questions must have one correct option selected.");
                return;
            }

            questions.push({ type: "mcq", text, options, correctIndex });
        }
        else if (type === "tf") {
            const ans = block.querySelector(".tf-answer").value === "true";
            questions.push({ type: "tf", text, correct: ans });
        }
        else if (type === "sa") {
            const ans = block.querySelector(".sa-answer").value.trim();
            if (!ans) {
                alert("Short answer questions must have a correct answer.");
                return;
            }
            questions.push({ type: "sa", text, correct: ans });
        }
    }

    // ── Package generation ──────────────────────────────────
    const zip = new JSZip();

    const runtimeHtml    = buildRuntimeHtml(moduleTitle);
    const runtimeJs      = buildRuntimeJs(questions);
    const manifest       = buildManifest(moduleTitle);
    const scormApiJs     = scormApiWrapperSource();   // assuming this function exists

    zip.file("index.html",        runtimeHtml);
    zip.file("runtime.js",        runtimeJs);
    zip.file("imsmanifest.xml",   manifest);
    zip.file("scorm_api_wrapper.js", scormApiJs);

    const content = await zip.generateAsync({ type: "blob" });

// sanitize filename
const safeTitle = moduleTitle.replace(/[^\w\d]+/g, "_").toLowerCase();

const link = document.createElement("a");
link.href = URL.createObjectURL(content);
link.download = safeTitle + ".zip";
link.click();
});
// =======================================================
// RUNTIME GENERATION
// =======================================================

function buildRuntimeHtml(title) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
<style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      line-height: 1.5;
    }
    .question {
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ddd;
    }
    .option {
      margin: 4px 0;
    }

    /* ── Overlay: always in DOM, only opacity changes ── */
    #overlayMessage {
      position: fixed;
      inset: 0;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      text-align: center;
      padding: 20px;
      z-index: 9999;
      visibility: visible;     /* always laid out */
      opacity: 0;
      pointer-events: none;    /* clicks pass through when hidden */
    }

    #overlayMessage.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* Score overlay (unchanged) */
    #scoreOverlay {
      position: fixed;
      inset: 0;
      background: white;
      color: black;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      font-weight: bold;
      text-align: center;
      z-index: 10000;
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.6s ease;
      padding: 20px;
    }

    #scoreOverlay.visible {
      visibility: visible;
      opacity: 1;
    }

    #scoreOverlay .score-main {
      font-size: 4rem;
      margin: 20px 0;
    }

    #scoreOverlay .score-detail {
      font-size: 1.6rem;
      margin: 10px 0;
      opacity: 1;
    }

    #scoreOverlay .status {
      font-size: 2.2rem;
      margin-top: 30px;
      font-weight: 600;
    }

    body.submitted {
      pointer-events: none;
    }
  </style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>Answer all questions and click <strong>Submit</strong> to record your score.</p>
<form id="quizForm"></form>
<button id="submitBtn">Submit</button>

<div id="overlayMessage">Please return to the activity window to continue.</div>

<div id="scoreOverlay">
  <div class="score-main"></div>
  <div class="score-detail"></div>
  <div class="status"></div>
</div>

<script src="scorm_api_wrapper.js"></script>
<script src="runtime.js"></script>
</body>
</html>`;
}

function buildRuntimeJs(questions) {
  const questionsJson = JSON.stringify(questions);

  return `
// ===============================
// GENERATED QUESTIONS
// ===============================
const QUESTIONS = ${questionsJson};

// ===============================
// RENDER QUESTIONS
// ===============================
const form = document.getElementById("quizForm");

QUESTIONS.forEach((q, idx) => {
  const div = document.createElement("div");
  div.className = "question";
  const label = document.createElement("div");
  label.innerHTML = "<strong>Q" + (idx + 1) + ".</strong> " + q.text;
  div.appendChild(label);

  if (q.type === "mcq") {
    q.options.forEach((opt, i) => {
      if (!opt) return;
      const optDiv = document.createElement("div");
      optDiv.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "q" + idx;
      input.value = i;
      const span = document.createElement("span");
      span.textContent = " " + opt;
      optDiv.appendChild(input);
      optDiv.appendChild(span);
      div.appendChild(optDiv);
    });
  } else if (q.type === "tf") {
    ["true", "false"].forEach(val => {
      const optDiv = document.createElement("div");
      optDiv.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "q" + idx;
      input.value = val;
      const span = document.createElement("span");
      span.textContent = " " + (val === "true" ? "True" : "False");
      optDiv.appendChild(input);
      optDiv.appendChild(span);
      div.appendChild(optDiv);
    });
  } else if (q.type === "sa") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = "q" + idx;
    input.style.width = "60%";
    div.appendChild(input);
  }

  form.appendChild(div);
});

// =======================================================
// ANTI-AI SYSTEM
// =======================================================

// Get overlay message from css
const overlay = document.getElementById("overlayMessage");

let hidden = false;
let hideTimeout = null;
let cmdOverlayTimeout = null;
const MIN_VISIBLE_MS = 1000; // Minimum time overlay must stay visible
const MAX_VISIBLE_MS = 1100; // Max time overlay must stay visible
let shownAt = 0;

// Show overlay with aggressive forced repaint & layer promotion
function showOverlay() {
  hidden = true;
  shownAt = Date.now();

  // ── Force GPU layer creation + immediate repaint ──
  overlay.style.willChange = 'opacity, transform';
  overlay.style.transform = 'translate3d(0,0,0)';  // Stronger layer promotion

  overlay.style.opacity = '1';
  overlay.classList.add("visible");

  // Force multiple synchronous reflows
  void overlay.offsetHeight;
  overlay.offsetHeight;

  // Extra repaint in next frame + cleanup
  requestAnimationFrame(() => {
    void overlay.offsetHeight;  // third flush
    overlay.style.willChange = 'auto';
  });
  // ── End forced repaint ──
}

// Hide overlay (respects minimum visible duration)
function hideOverlay() {
  if (!hidden) return;

  const elapsed = Date.now() - shownAt;

  const doHide = () => {
    overlay.classList.remove("visible");
    overlay.style.opacity = '0';
    hidden = false;
    shownAt = 0;
  };

  if (elapsed < MIN_VISIBLE_MS) {
    setTimeout(doHide, MIN_VISIBLE_MS - elapsed);
  } else {
    doHide();
  }
}

// 1. Snipping tool prevention
window.addEventListener("blur", showOverlay);
window.addEventListener("resize", showOverlay);

// Mouse leave -> show overlay immediately
document.addEventListener("mouseleave", () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  showOverlay();
});

// Mouse enter -> hide overlay after 1 sec
document.addEventListener("mouseenter", () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    hideOverlay();
    hideTimeout = null;
  }, 1000);
});

// Micro-resize detector
let lastW = window.innerWidth;
let lastH = window.innerHeight;
setInterval(() => {
  if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
    showOverlay();
  }
  lastW = window.innerWidth;
  lastH = window.innerHeight;
}, 120);

// Render-freeze detector (unchanged)
let lastFrame = performance.now();
function detectFreeze() {
  const now = performance.now();
  if (now - lastFrame > 200) {
    showOverlay();
  }
  lastFrame = now;
  requestAnimationFrame(detectFreeze);
}
requestAnimationFrame(detectFreeze);

// Visibility change
document.addEventListener("visibilitychange", () => {
  if (document.hidden) showOverlay();
  else hideOverlay();
});

// Fullscreen change
document.addEventListener("fullscreenchange", showOverlay);

// PrintScreen detection
window.addEventListener("keyup", (e) => {
  if (e.code === "PrintScreen" || e.key === "PrintScreen" || e.keyCode === 44) {
    showOverlay();
  }
});

// Command key detection on macOS – auto-hide after max time ONLY here
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.key === "Meta") {
    showOverlay();

    // Clear any previous max-timer (from earlier ⌘ presses)
    if (cmdOverlayTimeout) {
      clearTimeout(cmdOverlayTimeout);
    }

    // Start 1.1-second auto-hide timer ONLY for Command key trigger
    cmdOverlayTimeout = setTimeout(() => {
      hideOverlay();
      cmdOverlayTimeout = null;
    }, MAX_VISIBLE_MS);
  }
});

// Copy interception
document.addEventListener("copy", function(e) {
  e.preventDefault();
  if (e.clipboardData) {
    e.clipboardData.setData(
      "text/plain",
      "This activity is not to be solved with AI. Pasting is disabled."
    );
  }
});

document.addEventListener("paste", function(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    e.preventDefault();
    let msg = document.createElement("div");
    msg.textContent = "Pasting is disabled.";
    msg.style.color = "red";
    msg.style.fontSize = "0.9em";
    e.target.parentNode.insertBefore(msg, e.target.nextSibling);
    setTimeout(() => msg.remove(), 1500);
  }
});

// =======================================================
// SCORING + SCORM REPORTING + LOCK AFTER SUBMIT + SCORE OVERLAY
// =======================================================
const submitBtn = document.getElementById("submitBtn");
const quizForm = document.getElementById("quizForm");
const scoreOverlay = document.getElementById("scoreOverlay");

let hasSubmitted = false;

submitBtn.addEventListener("click", function(e) {
  e.preventDefault();
  if (hasSubmitted) return;
  hasSubmitted = true;

  let correct = 0;
  QUESTIONS.forEach((q, idx) => {
    if (q.type === "mcq") {
      const chosen = document.querySelector('input[name="q' + idx + '"]:checked');
      if (chosen && parseInt(chosen.value, 10) === q.correctIndex) correct++;
    } else if (q.type === "tf") {
      const chosen = document.querySelector('input[name="q' + idx + '"]:checked');
      if (chosen && (chosen.value === "true") === q.correct) correct++;
    } else if (q.type === "sa") {
      const input = document.querySelector('input[name="q' + idx + '"]');
      if (input && input.value.trim().toLowerCase() === q.correct.trim().toLowerCase()) correct++;
    }
  });

  const total = QUESTIONS.length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Fill the overlay – fixed syntax here
// Fill the overlay
scoreOverlay.querySelector(".score-main").textContent = percent + "%";
scoreOverlay.querySelector(".score-detail").textContent = correct + " correct out of " + total;
  const statusEl = scoreOverlay.querySelector(".status");

  // Show overlay
  scoreOverlay.classList.add("visible");

  // Lock the page
  document.body.classList.add("submitted");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitted";
document.querySelectorAll("#quizForm input").forEach(el => {
  el.disabled = true;
});

  // SCORM reporting
if (typeof scormReportScore === "function") {
  scormReportScore(percent);
}
});
`;
}