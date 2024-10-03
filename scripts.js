// Global vars
var treatmentIndex = 0;
var originalParsedText = [];
var parsedText = [];
var instructions = [];

// #region Event Listeners
document.addEventListener('keydown', function(event) {
    if (event.target.matches(`input[id="expressionInputA${treatmentIndex}"]`)) {
        if (event.key === 'Enter') {
            const input = event.target;

            // Ensure the input value is not empty
            if (input.value !== "") {
                // Simulate a click on the corresponding parse button
                const parseButton = document.getElementById('parseButton' + treatmentIndex);
                if (parseButton) {
                    parseButton.click();
                }
            }
        }
    }
});

document.addEventListener('keydown', function(event) {
    if (event.target.matches(`input[id="expressionInputB${treatmentIndex}"]`)) {
        if (event.key === 'Enter') {
            const input = event.target;

            // Ensure the input value is not empty
            if (input.value !== "") {
                // Simulate a click on the corresponding parse button
                const parseButton = document.getElementById('parseButton' + treatmentIndex);
                if (parseButton) {
                    parseButton.click();
                }
            }
        }
    }
});
// #endregion

// #region Load Document
const inputElement = document.getElementById("fileInput");
inputElement.type = "file";
inputElement.accept = ".pdf, .docx, .txt, .xlsx, .csv";
const uploadArea = document.getElementById("uploadArea");
uploadArea.onclick = function () {
    inputElement.click();
}

// Read and parse the selected file
function fileDropHandler(event) {
    event.preventDefault();

    let droppedFile = event.dataTransfer.items[0].getAsFile();
    handleFileLoad(null, droppedFile);
}

function fileDragHandler(event) {
    event.preventDefault();

    document.getElementById('uploadArea').style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--white');
    let uploadPlaceholder = document.querySelector("#uploadArea .upload-placeholder");
    uploadPlaceholder.querySelector('i').style.color = getComputedStyle(document.documentElement).getPropertyValue('--white');
    uploadPlaceholder.querySelector('p').style.color = getComputedStyle(document.documentElement).getPropertyValue('--white');
}

function fileDragLeaveHandler(event) {
    event.preventDefault();

    document.getElementById('uploadArea').style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--gray');
    let uploadPlaceholder = document.querySelector("#uploadArea .upload-placeholder");
    uploadPlaceholder.querySelector('i').style.color = getComputedStyle(document.documentElement).getPropertyValue('--gray');
    uploadPlaceholder.querySelector('p').style.color = getComputedStyle(document.documentElement).getPropertyValue('--gray');
}

function handleFileLoad(event, droppedFile) {
    const file = droppedFile || event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.name.split(".").pop().toLowerCase();

    reader.onload = function (e) {
        let fileText = e.target.result;

        if (fileType === "pdf") {
            parsePDF(fileText);
        } else if (fileType === "docx") {
            parseDOCX(fileText);
        } else if (fileType === "txt") {
            parseTXT(fileText);
        } else if (fileType === "xlsx") {
            parseXLSX(fileText);
        } else if (fileType === "csv") {
            parseCSV(fileText);
        }
    };

    if (fileType === "pdf" || fileType === "docx" || fileType === "xlsx") {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }

    inputElement.value = "";
}

// PDF files
function parsePDF(fileArrayBuffer) {
    const loadingTask = pdfjsLib.getDocument(fileArrayBuffer);
    loadingTask.promise.then(function (pdf) {
        let textContent = [];
        const numPages = pdf.numPages;

        function processPageSequentially(pageNum) {
            if (pageNum > numPages) {
                initTextNoColumns(textContent.join("\n"));
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
function parseDOCX(fileArrayBuffer) {
    const zip = new PizZip(fileArrayBuffer);

    try {
        const doc = new docxtemplater(zip);
        const _parsedText = doc.getFullText();
        initTextNoColumns(_parsedText);
    } catch (error) {
        console.error("Error parsing DOCX:", error);
    }
}

// TXT files
function parseTXT(fileText) {
    initTextNoColumns(fileText);
}

// XLSX files
function parseXLSX(fileText) {
    const rawData = new Uint8Array(fileText);
    const workbook = XLSX.read(rawData, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // Only reads the first sheet

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    initTextWithColumns(data);
}

// CSV files
function parseCSV(fileText) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < fileText.length; i++) {
        const char = fileText[i];

        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if (char === '\n' && !insideQuotes) {
            currentRow.push(currentCell);
            // Only push non-empty rows
            if (currentRow.some(cell => cell.trim() !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    // Handle the last cell and row (in case the file doesn’t end with a newline)
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        if (currentRow.some(cell => cell.trim() !== '')) {
            rows.push(currentRow);
        }
    }

    initTextWithColumns(rows);
}

function initTextNoColumns(text) {
    const textLines = text.split(/\r?\n/);
    textLines.forEach((line) => {
        line = line.replace(/\s+/g, " ").trim();
        originalParsedText.push({ text: line, column: 0 });
    });
    parsedText = structuredClone(originalParsedText);

    addTextToTable();
    document.getElementById("treatmentTypeContainer0").classList.remove("disabled");
}

function initTextWithColumns(data) {
    var maxColumn = data.reduce((max, line) => Math.max(max, line.length), 0);

    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < maxColumn; j++) {
            if (data[i][j]) {
                originalParsedText.push({ text: data[i][j], column: j });
            } else {
                originalParsedText.push({ text: "", column: j });
            }
        }
    }
    parsedText = structuredClone(originalParsedText);

    addTextToTable();
    document.getElementById("treatmentTypeContainer0").classList.remove("disabled");
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
                reIndexParsedText(_parsedText)
                fillInTable();
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
            case "split":
                if (isNaN(parseInt(filterRegex))) {
                    alert("Please enter a valid number to split the text.");
                    return;
                } else {
                    var columnCount = 0;
                    parsedText.forEach((line, index) => {
                        parsedText[index].column = columnCount;
                        if (columnCount !== parseInt(filterRegex) - 1) {
                            columnCount++;
                        } else {
                            columnCount = 0;
                            matches++;
                        }
                    });
                    matches++;
                    fillInTable();
                }
                break;
            case "combine":
                var _parsedText = [];
                var columnCount = 0;
                var text = "";
                parsedText.forEach((line, index) => {
                    text = (columnCount === 0) ? line.text : text + line.text;
                    
                    if (++columnCount === parseInt(filterRegex)) {
                        _parsedText.push({ text });
                        columnCount = 0;
                        matches++;
                    } else if (index === parsedText.length - 1) {
                        _parsedText.push({ text });
                    }
                });
                if (parsedText.length % parseInt(filterRegex) !== 0) {
                    matches++;
                }
                reIndexParsedText(_parsedText)
                fillInTable();
            default:
                break;
        }

        // Tracks instructions
        if (!isEdit) {
            instructions.push({ filterType: filterType, regex: filterRegex, matchCount: matches, replaceText: replaceText, treatmentLabel: filterType.charAt(0).toUpperCase() + filterType.slice(1) });
        } else {
            instructions[treatmentIndex].matchCount = matches;
        }

        //parsedText = parsedText.filter(item => item.text); // Removes all empty entries after each treatment, might want to remove or make a separate treatment option?

        // Adds treatment to UI
        addTreatment();
        addTextToTable();
    } else {
        alert("Please enter a filter to parse the text.");
    }
}

function reIndexParsedText(_parsedText) {
    var maxColumn = parsedText.reduce((max, line) => Math.max(max, line.column), 0);
    
    columnCount = 0;
    _parsedText.forEach((line, index) => {
        _parsedText[index] = { text: line.text, column: columnCount };
        if (++columnCount > maxColumn) columnCount = 0;
    });

    parsedText = structuredClone(_parsedText);
}

function fillInTable() {
    var maxColumn = parsedText.reduce((max, line) => Math.max(max, line.column), 0);
    
    const lastColumn = parsedText[parsedText.length - 1].column;
    if (parsedText[parsedText.length - 1].column !== maxColumn + 1) {
        for (let i = (lastColumn + 1); i <= maxColumn; i++) {
            parsedText.push({text: "", column: i});
        }
    }

    // Should fill in missing cells in each row, but can't test
    // let filledParsedText = [];
    // for (let i = 0; i < _parsedText.length - 1; i++) {
    //     filledParsedText.push(_parsedText[i]);

    //     if (_parsedText[i].column !== 0 && _parsedText[i + 1].column === 0) {
    //         if (_parsedText[i].column !== maxColumn) {
    //             for (let j = _parsedText[i].column + 1; j < maxColumn; j++) {
    //                 filledParsedText.push({text: "", column: j});
    //             }
    //         }
    //     }
    // }
}

function testFunction() {
    console.log(parsedText);
    console.log(instructions);
}

// Add parsed text to the table
function addTextToTable() {
    const uploadArea = document.getElementById("uploadArea");
    const textTable = document.getElementById("textTable" + treatmentIndex);
    const tableHead = document.getElementById("tableHead" + treatmentIndex);
    const tableBody = document.getElementById("tableBody" + treatmentIndex);

    // Hide upload area and show the table
    uploadArea.style.display = "none";
    textTable.style.display = "block";

    // Generate table headers
    const headerRow = tableHead.getElementsByTagName("tr")[0];
    headerRow.appendChild(createHeaderCell("Column1"));
    
    for (let i = 1; i < parsedText.length; i++) {
        if (parsedText[i].column !== 0) {
            headerRow.appendChild(createHeaderCell("Column" + (parsedText[i].column + 1)));
        } else {
            break;
        }
    }
    tableHead.appendChild(headerRow);

    // Generate table body rows
    tableBody.innerHTML = ""; // Clear existing rows
    let row = null, rowIndex = 0;

    parsedText.forEach((item, index) => {
        if (item.column === 0) {
            if (row) tableBody.appendChild(row); // Append the previous row if exists
            row = document.createElement("tr");
            row.appendChild(createCell(rowIndex++)); // Add row index
        }
        row.appendChild(createCell(item.text)); // Add text cell
        if (index === parsedText.length - 1) tableBody.appendChild(row); // Append the last row
    });
}

// Helper function to create table header cells
function createHeaderCell(text) {
    const th = document.createElement("th");
    th.textContent = text;
    return th;
}

// Helper function to create table cells
function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
}
// #endregion

// #region HTML-only functions
// Sets filter-type attribute of expressionInput
function setFilterType(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filterType = event.target.getAttribute("filter-type");
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const expressionInputB = document.getElementById("expressionInputB" + _treatmentIndex);
    const parseButton = document.getElementById("parseButton" + _treatmentIndex);

    expressionInputA.setAttribute("filter-type", filterType);
    expressionInputA.disabled = false;

    parseButton.setAttribute("filter-type", filterType);

    setExpressionInputStyling(filterType, expressionInputA, expressionInputB);
    setExpressionInputPlaceholder(filterType, expressionInputA, expressionInputB);
    setExpressionLabel(filterType, _treatmentIndex);
}

function setExpressionInputPlaceholder(filterType, expressionInputA, expressionInputB) {
    switch (filterType) {
        case "remove":
            expressionInputA.placeholder = "Enter an expression to remove"
            break;
        case "extract":
            expressionInputA.placeholder = "Enter an expression to extract"
            break;
        case "replace":
            expressionInputA.placeholder = "Enter an expression to find"
            expressionInputB.placeholder = "Enter replacement text";
            break;
        case "split":
            expressionInputA.placeholder = "Enter the number of columns to split"
            break;
        case "combine":
            expressionInputA.placeholder = "Enter the number of columns to combine"
            break;
        default:
            break;
    }
}

function setExpressionInputStyling(filterType, expressionInputA, expressionInputB) {
    if (filterType === "replace") {
        expressionInputB.style.display = "block";
        expressionInputB.parentNode.classList.add("d-flex");

        expressionInputA.classList.add("unround");
        expressionInputB.classList.add("unround");
        expressionInputA.classList.add("unround-right");
        expressionInputB.classList.add("unround-left");
    } else {
        expressionInputB.style.display = "none";
        expressionInputB.parentNode.classList.remove("d-flex");

        expressionInputA.classList.remove("unround");
        expressionInputB.classList.remove("unround");
        expressionInputA.classList.remove("unround-right");
        expressionInputB.classList.remove("unround-left");
    }
}

function setExpressionLabel(filterType, _treatmentIndex) {
    const expressionLabel = document.getElementById("expressionLabel" + _treatmentIndex);
    if (filterType === "split" || filterType === "combine") {
        expressionLabel.textContent = "Number:";
    } else {
        expressionLabel.textContent = "Expression:";
    }
}

// Adds inline styling to table to preview treatment
function filterPreview(event) {
    const filterType = event.target.getAttribute("filter-type");
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filter = document.getElementById("expressionInputA" + _treatmentIndex).value;

    const tableBody = document.getElementById("tableBody" + _treatmentIndex);
    const rows = tableBody.getElementsByTagName("tr");

    removePreviews(filter, tableBody, false);

    if (filterType === "remove" || filterType === "extract" || filterType === "replace") {
        try {
            const re = new RegExp(filter, "g");

            for (let row of rows) {
                const cells = row.getElementsByTagName("td");
                for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                    if (cellIndex === 0) {
                        // Skip the index column
                        continue;
                    }
            
                    let textCell = cells[cellIndex];
                    let text = textCell.textContent;
        
                    if (re.test(text)) {
                        const newHTML = text.replace(re, (match) => {
                            if (match !== "") {
                                switch (filterType) {
                                    case "remove":
                                        return `<span style="background-color: red; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
                                    case "extract":
                                        return `<span style="background-color: green; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
                                    case "replace":
                                        return `<span style="background-color: blue; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
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
            }
        } catch (e) {
            removePreviews(filter, tableBody, true);
        }
    } else if (filterType === "split" || filterType === "combine") {
        let splitCount = parseInt(filter);
        let colorCell = false;
        let count = 0;
        for (let i = 0; i < tableBody.getElementsByTagName("tr").length; i++) {
            for (let j = 0; j < tableBody.getElementsByTagName("tr")[i].getElementsByTagName("td").length; j++) {
                let cell = tableBody.getElementsByTagName("tr")[i].getElementsByTagName("td")[j];
                let originalText = cell.textContent;
                cell.innerHTML = originalText;
                if (j === 0) {
                    continue;
                } else {
                    count++;
                }
                if (count === splitCount * 2 + 1) {
                    count = 1;
                }
                if (count >= 1 && count <= splitCount) {
                    colorCell = false;
                } else if (count > splitCount && count <= splitCount * 2) {
                    colorCell = true;
                }
                if (colorCell) {
                    switch (filterType) {
                        case "split":
                            cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--outer-space');
                            break;
                        case "combine":
                            cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--outer-space');
                            break;
                        default:
                            break;
                    }
                }
            }
        }
    }
}

// Re-add all filter previews to tables
function readdFilterPreviews() {
    instructions.forEach((instruction, index) => {
        const re = new RegExp(instruction.regex, "g");
        const tableBody = document.getElementById("tableBody" + index);
        const rows = tableBody.getElementsByTagName("tr");

        if (instruction.filterType === "remove" || instruction.filterType === "extract" || instruction.filterType === "replace") {
            for (let row of rows) {
                const cells = row.getElementsByTagName("td");
                for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                    if (cellIndex === 0) {
                        // Skip the index column
                        continue;
                    }
            
                    let textCell = cells[cellIndex];
                    let text = textCell.textContent;
        
                    if (re.test(text)) {
                        const newHTML = text.replace(re, (match) => {
                            if (match !== "") {
                                switch (instruction.filterType) {
                                    case "remove":
                                        return `<span style="background-color: red; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
                                    case "extract":
                                        return `<span style="background-color: green; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
                                    case "replace":
                                        return `<span style="background-color: blue; box-shadow: -1px -1px 0 var(--black); white-space: pre-wrap;">${match}</span>`;
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
            }
        } else if (instruction.filterType === "split" || instruction.filterType === "combine") {
            let splitCount = parseInt(instruction.regex);
            let colorCell = false;
            let count = 0;
            for (let i = 0; i < tableBody.getElementsByTagName("tr").length; i++) {
                for (let j = 0; j < tableBody.getElementsByTagName("tr")[i].getElementsByTagName("td").length; j++) {
                    let cell = tableBody.getElementsByTagName("tr")[i].getElementsByTagName("td")[j];
                    if (j === 0) {
                        continue;
                    } else {
                        count++;
                    }
                    if (count === splitCount * 2 + 1) {
                        count = 1;
                    }
                    if (count >= 1 && count <= splitCount) {
                        colorCell = false;
                    } else if (count > splitCount && count <= splitCount * 2) {
                        colorCell = true;
                    }
                    if (colorCell) {
                        switch (instruction.filterType) {
                            case "split":
                                cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--outer-space');
                                break;
                            case "combine":
                                cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--outer-space');
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        }
    });
}

function removePreviews(filter, tableBody, clearAll) {
    const rows = tableBody.getElementsByTagName("tr");

    for (let row of rows) {
        for (let textCell of row.getElementsByTagName("td")) {
                if (filter === "" || clearAll) {
                let originalText = textCell.textContent;
                textCell.innerHTML = originalText;
            }
            let originalBackground = getComputedStyle(document.documentElement).getPropertyValue('--black');
            textCell.style.backgroundColor = originalBackground;
        }
    }
}

function setFilters(_treatmentIndex, isEdit) {
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const expressionInputB = document.getElementById("expressionInputB" + _treatmentIndex);

    // Set value of expressionInputA and expressionInputB
    expressionInputA.value = instructions[_treatmentIndex].regex;
    expressionInputB.value = instructions[_treatmentIndex].replaceText;
    
    if (_treatmentIndex !== treatmentIndex  - 1) {
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
            case "split":
                const splitFilter = document.getElementById("splitFilter" + _treatmentIndex);
                splitFilter.parentNode.classList.add("active");
                expressionInputA.setAttribute("filter-type", "split");
                break;
            case "combine":
                const combineFilter = document.getElementById("combineFilter" + _treatmentIndex);
                combineFilter.parentNode.classList.add("active");
                expressionInputA.setAttribute("filter-type", "combine");
                break;
            default:
                break;
        }
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
    <a href="#treatment${treatmentIndex}" class="current-treatment history-list-item list-group-item list-group-item-action flex-column align-items-start active" data-toggle="tab" onclick="setFilters(${treatmentIndex - 1}, false);resetEditFields(${treatmentIndex});">
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
            <thead id="tableHead${treatmentIndex}" class="thead-dark">
              <tr>
                <th style="width: 4.25rem;">Index</th>
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
                <input type="radio" id="removeFilter${treatmentIndex}" autocomplete="off" filter-type="remove" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Remove
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="extractFilter${treatmentIndex}" autocomplete="off" filter-type="extract" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Extract
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="replaceFilter${treatmentIndex}" autocomplete="off" filter-type="replace" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Find/Replace
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="splitFilter${treatmentIndex}" autocomplete="off" filter-type="split" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Split
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="combineFilter${treatmentIndex}" autocomplete="off" filter-type="combine" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Combine
              </label>
            </div>
          </div>
        </div>
        
        <div class="row mb-3">
          <div class="expression-label-container col-md-1">
            <label id="expressionLabel${treatmentIndex}" class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-10">
            <input type="text" id="expressionInputA${treatmentIndex}" class="expression-input-a form-control text-white" placeholder="Select an operation to begin parsing" filter-type="" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);" disabled/>
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
    parsedText = structuredClone(originalParsedText);
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
        <div id="uploadArea" class="upload-area" ondrop="fileDropHandler(event);" ondragover="fileDragHandler(event);" ondragleave="fileDragLeaveHandler(event);">
          <input type="file" id="fileInput" class="d-none" onchange="handleFileLoad(event);">
          <div class="upload-placeholder">
            <i class="fa-solid fa-cloud-arrow-up mb-2"></i>
            <p><strong>Choose a file</strong> or drag it here</p>
          </div>
        </div>
        <div id="textTable0" class="table-responsive" style="display: none">
          <table class="table table-bordered table-hover mb-0">
            <thead id="tableHead0" class="thead-dark">
              <tr>
                <th style="width: 4.25rem;">Index</th>
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
                <input type="radio" id="removeFilter0" autocomplete="off" filter-type="remove" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Remove
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="extractFilter0" autocomplete="off" filter-type="extract" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Extract
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="replaceFilter0" autocomplete="off" filter-type="replace" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Find/Replace
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="splitFilter0" autocomplete="off" filter-type="split" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Split
              </label>
              <label class="treatment-type btn btn-outline-secondary">
                <input type="radio" id="combineFilter0" autocomplete="off" filter-type="combine" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Combine
              </label>
            </div>
          </div>
        </div>
        
        <div class="row mb-3">
          <div class="expression-label-container col-md-1">
            <label id="expressionLabel0" class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-10">
            <input type="text" id="expressionInputA0" class="expression-input-a form-control text-white" placeholder="Select an operation to begin parsing" filter-type="" data-treatment-index="0" oninput="filterPreview(event);" disabled/>
            <input type="text" id="expressionInputB0" class="expression-input-b form-control text-white" placeholder="" data-treatment-index="0" style="display: none;"/>
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
    const treatmentFilterType = instructions[_treatmentIndex] ? instructions[_treatmentIndex].filterType : expressionInputA.getAttribute("filter-type");
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
    setExpressionInputStyling(treatmentFilterType, expressionInputA, expressionInputB);
    setExpressionLabel(treatmentFilterType, _treatmentIndex);
}
// #endregion
