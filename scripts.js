// Global vars
var treatmentIndex = 0;
var originalParsedText = [];
var parsedText = [];
var instructions = [];

// #region Load Document
const loadDocumentButton = document.getElementById("loadDocumentButton");
const inputElement = document.getElementById("file-input");
inputElement.type = "file";
inputElement.accept = ".pdf, .docx, .txt";

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
// Reparse all tables if editing a treatment, parse new table if not
function determineParse(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const isEdit = document.getElementById("isEdit" + _treatmentIndex).value === "true";
    
    if (isEdit) {
        reparseAllTables(_treatmentIndex, true);
    } else {
        parseTable(false, null);
    }
}

// Reparse all tables with new instructions
function reparseAllTables(_treatmentIndex, isEdit) {
    if (isEdit) {
        const removeFilter = document.getElementById("remove-filter" + _treatmentIndex).value;
        const parseFilter = document.getElementById("parse-filter" + _treatmentIndex).value;
        const findFilter = document.getElementById("find-filter" + _treatmentIndex).value;
        const replaceFilter = document.getElementById("replace-filter" + _treatmentIndex).value;
        
        if (removeFilter || parseFilter || (findFilter && replaceFilter)) {
            if (removeFilter) {
                instructions[_treatmentIndex] = { label: "Remove", regex: removeFilter, matchCount: 0 };
            } else if (parseFilter) {
                instructions[_treatmentIndex] = { label: "Parse", regex: parseFilter, matchCount: 0 };
            } else if (findFilter && replaceFilter) {
                instructions[_treatmentIndex] = { label: "Replace", regex: findFilter, replace: replaceFilter, matchCount: 0 };
            }
        } else {
            alert("Please enter a filter to parse the text.");
        }
    } else {
        instructions.splice(_treatmentIndex, 1);
    }

    resetAll();
    treatmentIndex = 0;
    parsedText = [...originalParsedText]

    addTextToTable();
    instructions.forEach((instruction) => {
        parseTable(true, instruction);
    });

    readdFilterPreviews();
}

// Applies given treatment to parsedText, tracks instructions
function parseTable(isEdit, instruction) {
    var removeFilter, parseFilter, findFilter, replaceFilter;
    if (isEdit) {
        switch (instruction.label) {
            case "Remove":
                removeFilter = instruction.regex;
                break;
            case "Parse":
                parseFilter = instruction.regex;
                break;
            case "Replace":
                findFilter = instruction.regex;
                replaceFilter = instruction.replace;
                break;
            default:
                break;
        }
    } else {
        removeFilter = document.getElementById("remove-filter" + treatmentIndex).value;
        parseFilter = document.getElementById("parse-filter" + treatmentIndex).value;
        findFilter = document.getElementById("find-filter" + treatmentIndex).value;
        replaceFilter = document.getElementById("replace-filter" + treatmentIndex).value;
    }
    var matches = 0;

    if (removeFilter || parseFilter || (findFilter && replaceFilter)) {
        // Remove
        if (removeFilter) {
            const re = new RegExp(removeFilter, "g");
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
            if (!isEdit) {
                instructions.push({ label: "Remove", regex: removeFilter, matchCount: matches });
            } else {
                instructions[treatmentIndex].matchCount = matches;
            }
        }
        // Parse out
        else if (parseFilter) {
            const re = new RegExp(parseFilter, "g");
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
            if (!isEdit) {
                instructions.push({ label: "Parse", regex: parseFilter, matchCount: matches });
            } else {
                instructions[treatmentIndex].matchCount = matches;
            }
        }
        // Find/Replace
        else if (findFilter && replaceFilter) {
            const re = new RegExp(findFilter, "g");
            parsedText.forEach((line, index) => {
                if (re.test(line.text)) {
                    parsedText[index] = {
                        text: line.text.replace(re, (match) => {
                            if (match !== "") {
                                matches++;
                                return replaceFilter;
                            }
                            return match;
                        }),
                        column: line.column,
                    };
                }
            });
            if (!isEdit) {
                instructions.push({ label: "Replace", regex: findFilter, replace: replaceFilter, matchCount: matches });
            } else {
                instructions[treatmentIndex].matchCount = matches;
            }
        }
        parsedText = parsedText.filter(item => item.text); // Removes all empty entries after each treatment, might want to remove or make a separate treatment option?
        addTreatment();
        addTextToTable();
    } else {
        alert("Please enter a filter to parse the text.");
    }
}

// Add parsed text to the table
function addTextToTable() {
    document.getElementById("noTextLoaded").style.display = "none";
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
                        switch (instruction.label) {
                            case "Remove":
                                return `<span style="background-color: red; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "Parse":
                                return `<span style="background-color: green; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "Replace":
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
// Adds inline styling to table to preview treatment
function filterPreview(event) {
    const filterType = event.target.getAttribute("filter-type");
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filter = document.getElementById(filterType + _treatmentIndex).value;

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
                            case "remove-filter":
                                return `<span style="background-color: red; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "parse-filter":
                                return `<span style="background-color: green; border: 1px solid black; white-space: pre-wrap;">${match}</span>`;
                            case "find-filter":
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

function setFilters(index, isEdit) {
    const removeFilter = document.getElementById("remove-filter" + index);
    const parseFilter = document.getElementById("parse-filter" + index);
    const findFilter = document.getElementById("find-filter" + index);
    const replaceFilter = document.getElementById("replace-filter" + index);

    switch (instructions[index].label) {
        case "Remove":
            removeFilter.value = instructions[index].regex;
            break;
        case "Parse":
            parseFilter.value = instructions[index].regex;
            break;
        case "Replace":
            findFilter.value = instructions[index].regex;
            replaceFilter.value = instructions[index].replace;
            break;
        default:
            break;
    }

    removeFilter.disabled = !isEdit;
    parseFilter.disabled = !isEdit;
    findFilter.disabled = !isEdit;
    replaceFilter.disabled = !isEdit;

    if (!isEdit) {
        removeFilter.placeholder = "";
        parseFilter.placeholder = "";
        findFilter.placeholder = "";
        replaceFilter.placeholder = "";
    } else {
        removeFilter.placeholder = "Enter text to remove";
        parseFilter.placeholder = "Enter text to parse out";
        findFilter.placeholder = "Enter text to find";
        replaceFilter.placeholder = "Enter replacement text";
    }
}

function setupEditHistory(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    // Set active tab and content
    resetActiveHistory();
    document.getElementById("historyTab" + _treatmentIndex).classList.add("active");
    resetActiveTable();
    document.getElementById("treatment" + _treatmentIndex).classList.add("active");

    // Show/hide history buttons
    document.getElementById("editHistory" + _treatmentIndex).style.display = "none";
    document.getElementById("deleteHistory" + _treatmentIndex).style.display = "none";
    document.getElementById("cancelEditHistory" + _treatmentIndex).style.display = "inline-block";
    // Show cancel button
    document.getElementById("cancelButton" + _treatmentIndex).style.display = "inline-block";
    
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

    reparseAllTables(_treatmentIndex, false);

    // Prevent event from bubbling up
    event.stopPropagation();
}

function cancelEditHistory(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");

    // Show/hide history buttons
    document.getElementById("editHistory" + _treatmentIndex).style.display = "inline-block";
    document.getElementById("deleteHistory" + _treatmentIndex).style.display = "inline-block";
    document.getElementById("cancelEditHistory" + _treatmentIndex).style.display = "none";
    // Hide cancel button
    document.getElementById("cancelButton" + _treatmentIndex).style.display = "none";

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
    <a id="historyTab${treatmentIndex - 1}" href="#treatment${treatmentIndex - 1}" class="history-list-item list-group-item list-group-item-action flex-column align-items-start" data-toggle="tab" onclick="setFilters(${treatmentIndex - 1}, false);resetEditFields();">
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1">Treatment #${treatmentIndex}</h5>
            <small class="text-muted">${instructions[treatmentIndex - 1].matchCount} macthes</small>
        </div>
        <div class="treatment-description-actions d-flex w-100 justify-content-between">
            <div class="treatment-description">
    `;
    if (instructions[treatmentIndex - 1].replace) {
        newHistory += `
                <small class="text-muted">${instructions[treatmentIndex - 1].label}: ${instructions[treatmentIndex - 1].regex}, ${instructions[treatmentIndex - 1].replace}</small>
        `;
    } else {
        newHistory += `
                <small class="text-muted">${instructions[treatmentIndex - 1].label}: ${instructions[treatmentIndex - 1].regex}</small>
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
    <a href="#treatment${treatmentIndex}" class="current-treatment history-list-item list-group-item list-group-item-action flex-column align-items-start active" data-toggle="tab">
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
    <div class="content-container active" id="treatment${treatmentIndex}">
      <!-- Table Section -->
      <div class="table-container">
        <div class="tab-pane fade show">
          <div class="table-responsive" id="textTable${treatmentIndex}">
            <table class="table table-bordered table-hover mb-0">
              <thead class="thead-dark">
                <tr>
                  <th style="width: 4.25rem;">Index</th>
                  <th>Text</th>
                </tr>
              </thead>
              <tbody class="table-body" id="tableBody${treatmentIndex}"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-container card p-3">
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="remove-filter${treatmentIndex}" class="filter-label">Remove:</label>
            <input type="text" class="form-control text-white" id="remove-filter${treatmentIndex}" placeholder="Enter text to remove" filter-type="remove-filter" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);"/>
          </div>
          <div class="col-md-6">
            <label for="parse-filter${treatmentIndex}" class="filter-label">Parse out:</label>
            <input type="text" class="form-control text-white" id="parse-filter${treatmentIndex}" placeholder="Enter text to parse out" filter-type="parse-filter" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);"/>
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="find-filter${treatmentIndex}" class="filter-label">Find:</label>
            <input type="text" class="form-control text-white" id="find-filter${treatmentIndex}" placeholder="Enter text to find" filter-type="find-filter" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);"/>
          </div>
          <div class="col-md-6">
            <label for="replace-filter${treatmentIndex}" class="filter-label">Replace:</label>
            <input type="text" class="form-control text-white" id="replace-filter${treatmentIndex}" placeholder="Enter replacement text" />
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <input type="hidden" id="isEdit${treatmentIndex}" data-treatment-index="${treatmentIndex}" value="false">
          <button type="button" id="parseButton${treatmentIndex}" data-treatment-index="${treatmentIndex}" class="btn btn-primary mr-2" onclick="determineParse(event);">Parse</button>
          <button type="button" id="cancelButton${treatmentIndex}" data-treatment-index="${treatmentIndex}" class="btn btn-danger ml-2" style="display: none" onclick="cancelEditHistory(event);">Cancel</button>
        </div>
      </div>
    </div>
    `;
    mainContainer.innerHTML += newContentContainer;
}

function resetAll() {
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
        <div class="content-container active" id="treatment0">
      <div class="table-container">
        <div class="tab-pane fade show">
          <div class="text-center" id="noTextLoaded">
            <h3>To start building your custom document parser, click "Load Document"</h3>
          </div>
          <div class="table-responsive" id="textTable0" style="display: none">
            <table class="table table-bordered table-hover mb-0">
              <thead class="thead-dark">
                <tr>
                  <th style="width: 4.25rem;">Index</th>
                  <th>Text</th>
                </tr>
              </thead>
              <tbody class="table-body" id="tableBody0"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="filter-container card p-3">
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="remove-filter0" class="filter-label">Remove:</label>
            <input type="text" class="form-control text-white" id="remove-filter0" placeholder="Enter text to remove" filter-type="remove-filter" data-treatment-index="0" oninput="filterPreview(event);"/>
          </div>
          <div class="col-md-6">
            <label for="parse-filter0" class="filter-label">Parse out:</label>
            <input type="text" class="form-control text-white" id="parse-filter0" placeholder="Enter text to parse out" filter-type="parse-filter" data-treatment-index="0" oninput="filterPreview(event);"/>
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="find-filter0" class="filter-label">Find:</label>
            <input type="text" class="form-control text-white" id="find-filter0" placeholder="Enter text to find" filter-type="find-filter" data-treatment-index="0" oninput="filterPreview(event);"/>
          </div>
          <div class="col-md-6">
            <label for="replace-filter0" class="filter-label">Replace:</label>
            <input type="text" class="form-control text-white" id="replace-filter0" placeholder="Enter replacement text" />
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <input type="file" id="file-input" accept=".pdf,.docx,.txt" style="display: none" onchange="handleFileLoad(event);"/>
          <input type="hidden" id="isEdit0" data-treatment-index="0" class="hid hid-edit" value="false">
          <button type="button" id="parseButton0" data-treatment-index="0" class="btn btn-primary mr-2" onclick="determineParse(event);">Parse</button>
          <button type="button" id="loadDocumentButton" class="btn btn-secondary" onclick="document.getElementById('file-input').click();">Load Document</button>
          <button type="button" id="cancelButton0" data-treatment-index="0" class="btn btn-danger ml-2" style="display: none" onclick="cancelEditHistory(event);">Cancel</button>
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

function resetEditFields() {
    // Set all cancel buttons to hidden
    const cancelHistoryButtons = document.querySelectorAll(".btn.btn-cancel");
    cancelHistoryButtons.forEach((button) => {
        button.style.display = "none";
    });
    const cancelButtons = document.querySelectorAll(".btn.btn-danger");
    cancelButtons.forEach((button) => {
        button.style.display = "none";
    });
    // Set all edit and delete buttons to visible
    const editButtons = document.querySelectorAll(".btn.btn-edit");
    const deleteButtons = document.querySelectorAll(".btn.btn-delete");
    editButtons.forEach((button) => {
        button.style.display = "inline-block";
    });
    deleteButtons.forEach((button) => {
        button.style.display = "inline-block";
    });
    // Set all hidden edit flags to false
    const isEditFlags = document.querySelectorAll(".hid.hid-edit");
    isEditFlags.forEach((flag) => {
        flag.value = "false";
    });
}
// #endregion
