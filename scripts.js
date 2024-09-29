// Global vars
var treatmentIndex = 0;
var originalParsedText = [];
var parsedText = [];
var instructions = [];

// #region Load Document
const inputElement = document.getElementById("fileInput");
inputElement.type = "file";
inputElement.accept = ".pdf, .docx, .txt";
const uploadArea = document.getElementById("uploadArea");
uploadArea.onclick = function () {
    inputElement.click();
}

// Read and parse the selected file
function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.name.split(".").pop().toLowerCase();

    reader.onload = function (e) {
        let fileText = e.target.result;

        if (fileType === "pdf") {
            parsePDF(file, fileText);
        } else if (fileType === "docx") {
            parseDOCX(fileText);
        } else if (fileType === "txt") {
            parseTXT(fileText);
        }
    };

    if (fileType === "pdf") {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }

    inputElement.value = "";
}

// PDF files
function parsePDF(file, fileArrayBuffer) {
    const loadingTask = pdfjsLib.getDocument(fileArrayBuffer);
    loadingTask.promise.then(function (pdf) {
        let textContent = [];
        const numPages = pdf.numPages;

        function processPageSequentially(pageNum) {
            if (pageNum > numPages) {
                initText(textContent.join("\n"));
                return;
            }

            pdf.getPage(pageNum).then(function (page) {
                return page.getTextContent().then(function (textContentObj) {
                    let pageText = textContentObj.items.map((item) => item.str).join(" ");
                    textContent.push(pageText);
                    processPageSequentially(pageNum + 1);
                });
            });
        }

        processPageSequentially(1);
    });
}

// DOCX files
function parseDOCX(fileText) {
    const zip = new JSZip();
    zip.loadAsync(fileText).then(function (content) {
        const doc = new window.docxtemplater();
        doc.loadZip(content);
        const _parsedText = doc.getFullText();
        initText(_parsedText);
    });
}

// TXT files
function parseTXT(fileText) {
    initText(fileText);
}

function initText(text) {
    const textLines = text.split("\n");
    textLines.forEach((line) => {
        line = line.replace(/\s+/g, " ").trim();
        originalParsedText.push({ text: line, column: 0 });
    });
    parsedText = [...originalParsedText];
    addTextToTable();
}
// #endregion

// #region Parse Text
// Reparse all tables if editing or deleting a treatment, parse new table if not
function determineParse(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filterType = event.target.getAttribute("filter-type");
    const isEdit = document.getElementById("isEdit" + _treatmentIndex).value === "true";
    
    if (isEdit) {
        reparseAllTables(true, _treatmentIndex);
    } else {
        parseTable(false, null, filterType);
    }
}

// Reparse all tables with new instructions
function reparseAllTables(isEdit, _treatmentIndex) {
    if (isEdit) {
        // If reparsing for edit, capture new filter type and expression
        const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
        const expresssionInputB = document.getElementById("expressionInputB" + _treatmentIndex);
        const filterType = expressionInputA.getAttribute("filter-type");
        const expressionA = expressionInputA.value;
        const expressionB = expresssionInputB.value;
        
        if (filterType) {
            instructions[_treatmentIndex] = { filterType: filterType, regex: expressionA, matchCount: 0, replaceText: expressionB, treatmentLabel: filterType.charAt(0).toUpperCase() + filterType.slice(1) };
        } else {
            alert("Please select an operation and enter an expression to parse the text.");
        }
    } else {
        // If reparsing for delete, remove instruction
        instructions.splice(_treatmentIndex, 1);
    }

    // Reset all tables, history, and parsedText
    resetAll();
    // Reparse all tables using instructions
    loadFromInstructions();
}

// Applies treatment and tracks instructions
function parseTable(isEdit, instruction, filterType) {
    // Init regex expressions and match count
    let filterRegex, replaceText;
    if (isEdit) {
        filterRegex = instruction.regex;
        replaceText = instruction.replaceText;
    } else {
        filterRegex = document.getElementById("expressionInputA" + treatmentIndex).value;
        replaceText = document.getElementById("expressionInputB" + treatmentIndex).value;
    }
    const re = new RegExp(filterRegex, "g");
    let matches = 0;

    // Apply treatment to parsedText
    if (filterRegex) {
        switch (filterType) {
            case "remove":
                parsedText.forEach((line, index) => {
                    if (re.test(line.text)) {
                        parsedText[index] = {
                            text: line.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return "";
                                }
                                return match;
                            }),
                            column: line.column,
                        };
                    }
                });
                break;
            case "extract":
                var _parsedText = [];
                parsedText.forEach((line) => {
                    Array.from(line.text.matchAll(re)).forEach((match) => {
                        if (match[0] !== "") {
                            matches++;
                            _parsedText.push({ text: match[0], column: line.column });
                        }
                    });
                });
                parsedText = _parsedText;
                break;
            case "replace":
                parsedText.forEach((line, index) => {
                    if (re.test(line.text)) {
                        parsedText[index] = {
                            text: line.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return replaceText;
                                }
                                return match;
                            }),
                            column: line.column,
                        };
                    }
                });
                break;
            default:
                break;
        }

        // Tracks instructions
        if (!isEdit) {
            instructions.push({ filterType: filterType, regex: filterRegex, matchCount: matches, replaceText: replaceText, treatmentLabel: filterType.charAt(0).toUpperCase() + filterType.slice(1) });
        } else {
            instructions[treatmentIndex].matchCount = matches;
        }

        parsedText = parsedText.filter(item => item.text); // Removes all empty entries after each treatment, might want to remove or make a separate treatment option?

        // Adds treatment to UI
        addTreatment();
        addTextToTable();
    } else {
        alert("Please enter a filter to parse the text.");
    }
}

// Add parsed text to the table
function addTextToTable() {
    document.getElementById("uploadArea").style.display = "none";
    document.getElementById("textTable" + treatmentIndex).style.display = "block";

    const tableBody = document.getElementById("tableBody" + treatmentIndex);
    tableBody.innerHTML = "";

    let rowIndex = 0;
    let row;
    for (let i = 0; i < parsedText.length; i++) {
        if (parsedText[i].column === 0 && i > 0) {
            tableBody.appendChild(row);
        }

        if (parsedText[i].column === 0) {
            row = document.createElement("tr");
            const indexCell = document.createElement("td");
            indexCell.textContent = rowIndex;
            rowIndex++;
            row.appendChild(indexCell);
        }

        const textCell = document.createElement("td");
        textCell.textContent = parsedText[i].text;
        row.appendChild(textCell);
    }
    tableBody.appendChild(row);
}

// Re-add all filter previews to tables
function readdFilterPreviews() {
    instructions.forEach((instruction, index) => {
        const re = new RegExp(instruction.regex, "g");
        const tableBody = document.getElementById("tableBody" + index);
        const rows = tableBody.getElementsByTagName("tr");

        for (let row of rows) {
            const textCell = row.getElementsByTagName("td")[1]; // Assuming the text is in the second column
            let text = textCell.textContent;

            if (re.test(text)) {
                const newHTML = text.replace(re, (match) => {
                    if (match !== "") {
                        switch (instruction.filterType) {
                            case "remove":
                                return `<span style="background-color: red; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "extract":
                                return `<span style="background-color: green; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "replace":
                                return `<span style="background-color: blue; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            default:
                                break;
                        }
                    }
                    return match;
                });
                textCell.innerHTML = newHTML;
            } else {
                textCell.innerHTML = text;
            }
        }
    });
}
// #endregion

// #region HTML-only functions
// Sets filter-type attribute of expressionInput
function setFilterType(event) {
    const filterType = event.target.getAttribute("filter-type");
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    const expressionInput = document.getElementById("expressionInputA" + _treatmentIndex);
    expressionInput.setAttribute("filter-type", filterType);
    expressionInput.disabled = false;

    const parseButton = document.getElementById("parseButton" + _treatmentIndex);
    parseButton.setAttribute("filter-type", filterType);

    if (filterType === "replace") {
        const replaceInput = document.getElementById("expressionInputB" + _treatmentIndex);
        replaceInput.style.display = "block";
        replaceInput.parentNode.classList.add("d-flex");

        expressionInput.classList.add("unround");
        replaceInput.classList.add("unround");
        expressionInput.classList.add("unround-right");
        replaceInput.classList.add("unround-left");
    } else {
        const replaceInput = document.getElementById("expressionInputB" + _treatmentIndex);
        replaceInput.style.display = "none";
        replaceInput.parentNode.classList.remove("d-flex");

        expressionInput.classList.remove("unround");
        replaceInput.classList.remove("unround");
        expressionInput.classList.remove("unround-right");
        replaceInput.classList.remove("unround-left");
    }
}

// Adds inline styling to table to preview treatment
function filterPreview(event) {
    const filterType = event.target.getAttribute("filter-type");
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filter = document.getElementById("expressionInputA" + _treatmentIndex).value;

    const tableBody = document.getElementById("tableBody" + _treatmentIndex);
    const rows = tableBody.getElementsByTagName("tr");

    // If the input is empty, reset the table content to original text (no spans)
    if (filter === "") {
        for (let row of rows) {
            const textCell = row.getElementsByTagName("td")[1]; // Assuming the text is in the second column
            let originalText = textCell.textContent;
            textCell.innerHTML = originalText;
        }
        return;
    }

    try {
        const re = new RegExp(filter, "g");

        for (let row of rows) {
            const textCell = row.getElementsByTagName("td")[1]; // Assuming the text is in the second column
            let text = textCell.textContent;

            if (re.test(text)) {
                const newHTML = text.replace(re, (match) => {
                    if (match !== "") {
                        switch (filterType) {
                            case "remove":
                                return `<span style="background-color: red; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "extract":
                                return `<span style="background-color: green; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "replace":
                                return `<span style="background-color: blue; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            default:
                                break;
                        }
                    }
                    return match;
                });
                textCell.innerHTML = newHTML;
            } else {
                textCell.innerHTML = text;
            }
        }
    } catch (e) {}
}

function setFilters(_treatmentIndex, isEdit) {
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const expressionInputB = document.getElementById("expressionInputB" + _treatmentIndex);

    // Set value of expressionInputA and expressionInputB
    expressionInputA.value = instructions[_treatmentIndex].regex;
    expressionInputB.value = instructions[_treatmentIndex].replaceText;
    
    // Remove all active filters
    const allFilters = document.querySelectorAll(".treatment-type");
    allFilters.forEach((filter) => {
        filter.classList.remove("active");
    });

    // Set active filter
    switch (instructions[_treatmentIndex].filterType) {
        case "remove":
            const removeFilter = document.getElementById("removeFilter" + _treatmentIndex);
            removeFilter.parentNode.classList.add("active");
            expressionInputA.setAttribute("filter-type", "remove");
            break;
        case "extract":
            const extractFilter = document.getElementById("extractFilter" + _treatmentIndex);
            extractFilter.parentNode.classList.add("active");
            expressionInputA.setAttribute("filter-type", "extract");
            break;
        case "replace":
            const replaceFilter = document.getElementById("replaceFilter" + _treatmentIndex);
            replaceFilter.parentNode.classList.add("active");
            expressionInputA.setAttribute("filter-type", "replace");
            break;
        default:
            break;
    }

    const treatmentTypeContainer = document.getElementById("treatmentTypeContainer" + _treatmentIndex);
    if (!isEdit) {
        // If not editing, disable operation and expression input
        treatmentTypeContainer.classList.add("disabled");
        expressionInputA.disabled = true;
        expressionInputB.disabled = true;
    } else {
        // If editing, enable operation and expression input
        treatmentTypeContainer.classList.remove("disabled");
        expressionInputA.disabled = false;
        expressionInputB.disabled = false;
    }
}

function setupEditHistory(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    // Set active tab and content
    resetActiveHistory();
    document.getElementById("historyTab" + _treatmentIndex).classList.add("active");
    resetActiveTable();
    document.getElementById("treatment" + _treatmentIndex).classList.add("active");

    // Show/hide buttons
    document.getElementById("editHistory" + _treatmentIndex).style.display = "none";
    document.getElementById("deleteHistory" + _treatmentIndex).style.display = "none";
    document.getElementById("cancelEditHistory" + _treatmentIndex).style.display = "inline-block";
    document.getElementById("cancelButton" + _treatmentIndex).style.display = "inline-block";

    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.remove("col-md-1");
    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.add("col-md-2");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.remove("col-md-10");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.add("col-md-9");
    document.getElementById("isEdit" + _treatmentIndex).parentNode.classList.add("d-flex");

    // Set hidden edit flag
    document.getElementById("isEdit" + _treatmentIndex).value = "true";

    // Enable filters
    setFilters(_treatmentIndex, true);

    // Prevent event from bubbling up
    event.stopPropagation();
}

function deleteHistory(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    // Set active tab and content
    resetActiveHistory();
    document.getElementById("historyTab" + _treatmentIndex).classList.add("active");
    resetActiveTable();
    document.getElementById("treatment" + _treatmentIndex).classList.add("active");

    reparseAllTables(false, _treatmentIndex);

    // Prevent event from bubbling up
    event.stopPropagation();
}

function cancelEditHistory(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    // Show/hide buttons
    document.getElementById("editHistory" + _treatmentIndex).style.display = "inline-block";
    document.getElementById("deleteHistory" + _treatmentIndex).style.display = "inline-block";
    document.getElementById("cancelEditHistory" + _treatmentIndex).style.display = "none";
    document.getElementById("cancelButton" + _treatmentIndex).style.display = "none";

    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.remove("col-md-2");
    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.add("col-md-1");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.remove("col-md-9");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.add("col-md-10");
    document.getElementById("isEdit" + _treatmentIndex).parentNode.classList.remove("d-flex");

    // Set hidden edit flag
    document.getElementById("isEdit" + _treatmentIndex).value = "false";

    // Disable filters
    setFilters(_treatmentIndex, false);

    // Prevent event from bubbling up
    event.stopPropagation();
}
// #endregion

// #region Helper Functions
function addTreatment() {
    treatmentIndex++;
    addHistory();
    addTable();
}

function addHistory() {
    resetActiveHistory();

    // Remove all current steps
    const currentSteps = document.querySelectorAll("a.current-treatment");
    currentSteps.forEach((steps) => {
        steps.remove();
    });

    // Create new step
    const historyList = document.getElementById("historyList");
    var newHistory = `
    <a id="historyTab${treatmentIndex - 1}" href="#treatment${treatmentIndex - 1}" class="history-list-item list-group-item list-group-item-action flex-column align-items-start" data-toggle="tab" onclick="setFilters(${treatmentIndex - 1}, false);resetEditFields(${treatmentIndex - 1});">
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1">Treatment #${treatmentIndex}</h5>
            <small class="text-muted">${instructions[treatmentIndex - 1].matchCount} macthes</small>
        </div>
        <div class="treatment-description-actions d-flex w-100 justify-content-between">
            <div class="treatment-description">
    `;
    if (instructions[treatmentIndex - 1].replaceText !== "") {
        newHistory += `
                <small class="text-muted">${instructions[treatmentIndex - 1].treatmentLabel}: ${instructions[treatmentIndex - 1].regex}, ${instructions[treatmentIndex - 1].replaceText}</small>
        `;
    } else {
        newHistory += `
                <small class="text-muted">${instructions[treatmentIndex - 1].treatmentLabel}: ${instructions[treatmentIndex - 1].regex}</small>
        `;
    }
    newHistory += `
            </div>
            <div class="d-flex">
                <button id="editHistory${treatmentIndex - 1}" type="button" class="btn btn-edit" data-treatment-index="${treatmentIndex - 1}" onclick="setupEditHistory(event);"><i class="fa-solid fa-pen" data-treatment-index="${treatmentIndex - 1}" onclick="setupEditHistory(event);"></i></button>
                <button id="deleteHistory${treatmentIndex - 1}" type="button" class="btn btn-delete" data-treatment-index="${treatmentIndex - 1}" onclick="deleteHistory(event);"><i class="fa-solid fa-trash" data-treatment-index="${treatmentIndex - 1}" onclick="deleteHistory(event);"></i></button>
                <button id="cancelEditHistory${treatmentIndex - 1}" type="button" class="btn btn-cancel" data-treatment-index="${treatmentIndex - 1}" onclick="cancelEditHistory(event);" style="display: none;"><i class="fa-solid fa-ban" data-treatment-index="${treatmentIndex - 1}" onclick="cancelEditHistory(event);"></i></button>
            </div>
        </div>
    </a>
    `;

    // Create new current step
    newHistory += `
    <a href="#treatment${treatmentIndex}" class="current-treatment history-list-item list-group-item list-group-item-action flex-column align-items-start active" data-toggle="tab" onclick="resetEditFields(${treatmentIndex});">
          <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1 mt-1">Current treatment</h5>
          </div>
    </a>
    `;

    historyList.innerHTML += newHistory;
}

function addTable() {
    resetActiveTable();

    // Create new active content container
    const mainContainer = document.querySelector(".main-container");
    const newContentContainer = `
    <div id="treatment${treatmentIndex}" class="content-container active">
      <!-- Table Section -->
      <div class="table-container">
        <div id="textTable${treatmentIndex}" class="table-responsive" style="display: none">
          <table class="table table-bordered table-hover mb-0">
            <thead class="thead-dark">
              <tr>
                <th style="width: 4.25rem;">Index</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody id="tableBody${treatmentIndex}" class="table-body"></tbody>
          </table>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-container card p-3">
        
        <div class="row mb-3">
          <div class="operation-label-container col-md-1">
            <label class="operation-label">Operation:</label>
          </div>
          
          <div class="col-md-11">
            <div id="treatmentTypeContainer${treatmentIndex}" class="treatment-type-container btn-group btn-group-toggle" data-toggle="buttons">
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="removeFilter${treatmentIndex}" autocomplete="off" filter-type="remove" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);"> Remove
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="extractFilter${treatmentIndex}" autocomplete="off" filter-type="extract" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);"> Extract
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="replaceFilter${treatmentIndex}" autocomplete="off" filter-type="replace" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);"> Find/Replace
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="splitFilter${treatmentIndex}" autocomplete="off" filter-type="split" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);"> Split
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="combineFilter${treatmentIndex}" autocomplete="off" filter-type="combine" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);"> Combine
              </label>
            </div>
          </div>
        </div>
        
        <div class="row mb-3">
          <div class="expression-label-container col-md-1">
            <label class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-10">
            <input type="text" id="expressionInputA${treatmentIndex}" class="expression-input-a form-control text-white" placeholder="" filter-type="" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);" disabled/>
            <input type="text" id="expressionInputB${treatmentIndex}" class="expression-input-b form-control text-white" placeholder="" data-treatment-index="${treatmentIndex}" style="display: none;"/>
          </div>
          
          <div class="action-button-container col-md-1">
            <input type="hidden" id="isEdit${treatmentIndex}" class="hid hid-edit" data-treatment-index="${treatmentIndex}" value="false">
            <button type="button" id="parseButton${treatmentIndex}" class="action-button btn btn-success" data-treatment-index="${treatmentIndex}" onclick="determineParse(event);">Parse</button>
            <button type="button" id="cancelButton${treatmentIndex}" class="action-button btn btn-danger ml-2" data-treatment-index="${treatmentIndex}" onclick="cancelEditHistory(event);" style="display: none;">Cancel</button>
          </div>
        </div>
        
      </div>
    </div>
    `;
    mainContainer.innerHTML += newContentContainer;
}

function loadFromInstructions() {
    addTextToTable();
    instructions.forEach((instruction, index) => {
        parseTable(true, instruction, instruction.filterType);
        resetEditFields(index);
    });
    readdFilterPreviews();
}

function resetAll() {
    // Reset global vars (except originalParsedText and instructions)
    treatmentIndex = 0;
    parsedText = [...originalParsedText]
    // Remove all history items
    const historyItems = document.querySelectorAll("a.history-list-item");
    historyItems.forEach((item) => {
        item.remove();
    });
    // Remove all content containers
    const contentContainers = document.querySelectorAll(".content-container");
    contentContainers.forEach((container) => {
        container.remove();
    });
    // Add inital history item
    const mainContainer = document.querySelector(".main-container");
    mainContainer.innerHTML += `
    <div id="treatment0" class="content-container active">
      <!-- Table Section -->
      <div class="table-container">
        <div id="uploadArea" class="upload-area">
          <input type="file" id="fileInput" class="d-none" onchange="handleFileLoad(event);">
          <div class="upload-placeholder">
            <i class="fa-solid fa-cloud-arrow-up mb-2"></i>
            <p><strong>Choose a file</strong> or drag it here</p>
          </div>
        </div>
        <div id="textTable0" class="table-responsive" style="display: none">
          <table class="table table-bordered table-hover mb-0">
            <thead class="thead-dark">
              <tr>
                <th style="width: 4.25rem;">Index</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody id="tableBody0" class="table-body"></tbody>
          </table>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-container card p-3">
        
        <div class="row mb-3">
          <div class="operation-label-container col-md-1">
            <label class="operation-label">Operation:</label>
          </div>
          
          <div class="col-md-11">
            <div id="treatmentTypeContainer0" class="treatment-type-container btn-group btn-group-toggle" data-toggle="buttons">
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="removeFilter0" autocomplete="off" filter-type="remove" data-treatment-index="0" onchange="setFilterType(event);"> Remove
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="extractFilter0" autocomplete="off" filter-type="extract" data-treatment-index="0" onchange="setFilterType(event);"> Extract
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="replaceFilter0" autocomplete="off" filter-type="replace" data-treatment-index="0" onchange="setFilterType(event);"> Find/Replace
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="splitFilter0" autocomplete="off" filter-type="split" data-treatment-index="0" onchange="setFilterType(event);"> Split
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="combineFilter0" autocomplete="off" filter-type="combine" data-treatment-index="0" onchange="setFilterType(event);"> Combine
              </label>
            </div>
          </div>
        </div>
        
        <div class="row mb-3">
          <div class="expression-label-container col-md-1">
            <label class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-10">
            <input type="text" id="expressionInputA0" class="expression-input-a form-control text-white" placeholder="" filter-type="" data-treatment-index="0" oninput="filterPreview(event);" disabled/>
            <input type="text" id="expressionInputB0" class="expression-input-b form-control text-white d-none" placeholder="" data-treatment-index="0" style="display: none;"/>
          </div>
          
          <div class="action-button-container col-md-1">
            <input type="hidden" id="isEdit0" class="hid hid-edit" data-treatment-index="0" value="false">
            <button type="button" id="parseButton0" class="action-button btn btn-success" data-treatment-index="0" onclick="determineParse(event);">Parse</button>
            <button type="button" id="cancelButton0" class="action-button btn btn-danger ml-2" data-treatment-index="0" onclick="cancelEditHistory(event);" style="display: none;">Cancel</button>
          </div>
        </div>
        
      </div>
    </div>
    `;
}

function resetActiveHistory() {
    // Set all steps to non-active
    const activeSteps = document.querySelectorAll("a.history-list-item.active");
    activeSteps.forEach((step) => {
        step.classList.remove("active");
    });
}

function resetActiveTable() {
    // Set all content containers to non-active
    const activeContentContainers = document.querySelectorAll(".content-container.active");
    activeContentContainers.forEach((container) => {
        container.classList.remove("active");
    });
}

function resetEditFields(_treatmentIndex) {
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const expressionInputB = document.getElementById("expressionInputB" + _treatmentIndex);
    const treatmentFilterType = expressionInputA.getAttribute("filter-type");
    const cancelEditHistoryButton = document.getElementById("cancelEditHistory" + _treatmentIndex);
    const cancelButton = document.getElementById("cancelButton" + _treatmentIndex);
    const editHistoryButton = document.getElementById("editHistory" + _treatmentIndex);
    const deleteHistoryButton = document.getElementById("deleteHistory" + _treatmentIndex);
    const isEditFlag = document.getElementById("isEdit" + _treatmentIndex);

    if (_treatmentIndex !== treatmentIndex) {
        cancelEditHistoryButton.style.display = "none";
        editHistoryButton.style.display = "inline-block";
        deleteHistoryButton.style.display = "inline-block";
    }
    cancelButton.style.display = "none";
    cancelButton.parentNode.classList.remove("col-md-2");
    cancelButton.parentNode.classList.add("col-md-1");
    isEditFlag.value = "false";
    expressionInputA.parentNode.classList.remove("col-md-9");
    expressionInputA.parentNode.classList.add("col-md-10");
    if (treatmentFilterType !== "replace") {
        expressionInputB.style.display = "none";
        expressionInputB.parentNode.classList.remove("d-flex");
    } else {
        expressionInputB.style.display = "block";
        expressionInputB.parentNode.classList.add("d-flex");
        expressionInputB.classList.add("unround");
        expressionInputB.classList.add("unround-left");
        expressionInputA.classList.add("unround");
        expressionInputA.classList.add("unround-right");
    }

    // // Cancel buttons
    // const cancelHistoryButtons = document.querySelectorAll(".btn.btn-cancel");
    // cancelHistoryButtons.forEach((button) => {
    //     button.style.display = "none";
    // });
    // const cancelButtons = document.querySelectorAll(".btn.btn-danger");
    // cancelButtons.forEach((button) => {
    //     button.style.display = "none";
    //     button.parentNode.classList.remove("col-md-2");
    //     button.parentNode.classList.add("col-md-1");
    // });
    // // Edit and delete buttons
    // const editButtons = document.querySelectorAll(".btn.btn-edit");
    // const deleteButtons = document.querySelectorAll(".btn.btn-delete");
    // editButtons.forEach((button) => {
    //     button.style.display = "inline-block";
    // });
    // deleteButtons.forEach((button) => {
    //     button.style.display = "inline-block";
    // });
    // // Expression inputs
    // const expressionInputs = document.querySelectorAll(".expression-input-b.form-control");
    // expressionInputs.forEach((input) => {
    //     input.parentNode.classList.remove("col-md-9");
    //     input.parentNode.classList.add("col-md-10");
    //     if (treatmentFilterType !== "replace") {
    //         input.style.display = "none";
    //     } else {
    //         const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    //         input.style.display = "block";
    //         input.parentNode.classList.add("d-flex");
    //         expressionInputA.classList.add("unround");
    //         input.classList.add("unround");
    //         expressionInputA.classList.add("unround-right");
    //         input.classList.add("unround-left");
    //     }
    // });
    // // Set all hidden edit flags to false
    // const isEditFlags = document.querySelectorAll(".hid.hid-edit");
    // isEditFlags.forEach((flag) => {
    //     flag.value = "false";
    //     flag.parentNode.classList.remove("d-flex");
    // });
}
// #endregion
