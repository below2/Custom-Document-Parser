// Global vars
var treatmentIndex = 0;
var originalParsedText = [];
var parsedText = [];
var instructions = [];
var maxColumn = 0;
var maxRow = 0;

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

    document.getElementById('uploadArea').style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--light1');
    let uploadPlaceholder = document.querySelector("#uploadArea .upload-placeholder");
    uploadPlaceholder.querySelector('i').style.color = getComputedStyle(document.documentElement).getPropertyValue('--light1');
    uploadPlaceholder.querySelector('p').style.color = getComputedStyle(document.documentElement).getPropertyValue('--light1');
}

function fileDragLeaveHandler(event) {
    event.preventDefault();

    document.getElementById('uploadArea').style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--light2');
    let uploadPlaceholder = document.querySelector("#uploadArea .upload-placeholder");
    uploadPlaceholder.querySelector('i').style.color = getComputedStyle(document.documentElement).getPropertyValue('--light2');
    uploadPlaceholder.querySelector('p').style.color = getComputedStyle(document.documentElement).getPropertyValue('--light2');
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
    var row = [];
    textLines.forEach((line, index) => {
        line = line.replace(/\s+/g, " ").trim();
        row.push({ text: line.toString(), original: true, row: index, column: 0 });
        originalParsedText.push(row);
        maxRow++;
    });
    parsedText = structuredClone(originalParsedText);
    maxColumn = 1;

    addTextToTable();
    document.getElementById("treatmentTypeContainer0").classList.remove("disabled");
    document.getElementById("matchOptionTypeContainer0").classList.remove("disabled");
    document.getElementById("tableOptionTypeContainer0").classList.remove("disabled");
}

function initTextWithColumns(data) {
    maxColumn = Math.max(...data.map(item => item.length));
    for (let i = 0; i < data.length; i++) {
        var row = [];
        for (let j = 0; j < maxColumn; j++) {
            if (data[i][j]) {
                line = data[i][j].toString().replace(/\s+/g, " ").trim();
                row.push({ text: data[i][j].toString(), original: true, row: i, column: j });
            } else {
                row.push({ text: "", original: true, row: i, column: j });
            }
        }
        originalParsedText.push(row);
        maxRow++;
    }
    parsedText = structuredClone(originalParsedText);

    addTextToTable();
    document.getElementById("treatmentTypeContainer0").classList.remove("disabled");
    document.getElementById("matchOptionTypeContainer0").classList.remove("disabled");
    document.getElementById("tableOptionTypeContainer0").classList.remove("disabled");
}
// #endregion

// #region Parse Text
// Reparse all tables if editing or deleting a treatment, parse new table if not
function determineParse(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const filterType = event.target.getAttribute("filter-type");
    const matchOption = event.target.getAttribute("match-option-type");
    const tableOption = event.target.getAttribute("table-option-type");
    const isEdit = document.getElementById("isEdit" + _treatmentIndex).value === "true";
    
    if (isEdit) {
        reparseAllTables(true, _treatmentIndex);
    } else {
        parseTable(false, null, filterType, matchOption, tableOption);
    }
}

// Reparse all tables with new instructions
function reparseAllTables(isEdit, _treatmentIndex) {
    if (isEdit) {
        // If reparsing for edit, capture new filter type, match option, table option, and expression
        const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
        const expresssionInputB = document.getElementById("expressionInputB" + _treatmentIndex);
        const filterType = expressionInputA.getAttribute("filter-type");
        const matchOption = expressionInputA.getAttribute("match-option-type");
        const tableOption = expressionInputA.getAttribute("table-option-type");
        const expressionA = expressionInputA.value;
        const expressionB = expresssionInputB.value;
        
        if (filterType && matchOption && tableOption && expressionA) {
            instructions[_treatmentIndex] = {
                filterType: filterType,
                matchOption: matchOption,
                tableOption: tableOption,
                regex: expressionA,
                matchCount: 0,
                replaceText: expressionB,
                treatmentLabel: filterType.charAt(0).toUpperCase() + filterType.slice(1) };
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
function parseTable(isEdit, instruction, filterType, matchOption, tableOption) {
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
                matches = removeOperation(matchOption, re, matches);
                break;
            case "extract":
                matches = extractOperation(matchOption, re, matches);
                break;
            case "replace":
                matches = replaceOperation(matchOption, re, matches, replaceText);
                break;
            case "split":
                if (isNaN(parseInt(filterRegex))) {
                    alert("Please enter a valid number to split the text.");
                    return;
                }
                filterRegex = parseInt(filterRegex);
                matches = splitOperation(matchOption, re, matches, filterRegex);
                break;
            case "combine":
                if (isNaN(parseInt(filterRegex))) {
                    alert("Please enter a valid number to split the text.");
                    return;
                }
                filterRegex = parseInt(filterRegex);
                matches = combineOperation(matchOption, re, matches, filterRegex);
                break;
            case "uppercase":
                matches = uppercaseOperation(matchOption, re, matches);
                break;
            case "lowercase":
                matches = lowercaseOperation(matchOption, re, matches);
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

        //parsedText = parsedText.filter(item => item.text); // Removes all empty entries after each treatment, might want to remove or make a separate treatment option?

        // Adds treatment to UI
        addTreatment();
        addTextToTable();
    } else {
        alert("Please enter a filter to parse the text.");
    }
}

function removeOperation(matchOption, re, matches) {
    switch (matchOption) {
        case "all":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return "";
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "first":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches === 0) {
                                    matches++;
                                    return "";
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "firstN":
            var firstNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches < firstNMatches) {
                                    matches++;
                                    return "";
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "last":
            var lastMatchRow = -1;
            var lastMatchColumn = -1;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchRow = rowIndex;
                        lastMatchColumn = colIndex;
                    }
                })
            });

            if (lastMatchRow !== -1 && lastMatchColumn !== -1) {
                re.lastIndex = 0;
                matches++;
                var lineText = parsedText[lastMatchRow][lastMatchColumn].text;
                var allMatches = [...lineText.matchAll(re)];
                var lastMatch = allMatches[allMatches.length - 1];
        
                parsedText[lastMatchRow][lastMatchColumn].text = lineText.slice(0, lastMatch.index) + lineText.slice(lastMatch.index + lastMatch[0].length);
            }
            return matches;
        case "lastN":
            var lastNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var lastMatchIndices = [];
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchIndices.push({row: rowIndex, col: colIndex});
                    }
                })
            });
            lastMatchIndices.reverse();
            lastMatchIndices = new Set(lastMatchIndices);

            if (lastMatchIndices.size !== 0) {
                lastMatchIndices.forEach((rowColIndex) => {
                    re.lastIndex = 0;
                    var lineText = parsedText[rowColIndex.row][rowColIndex.col].text;
                    var allMatches = [...lineText.matchAll(re)];
                    allMatches.reverse();
                    allMatches.forEach((match) => {
                        if (matches < lastNMatches) {
                            lineText = lineText.slice(0, match.index) + lineText.slice(match.index + match[0].length);
                            parsedText[rowColIndex.row][rowColIndex.col].text = lineText;
                            matches++;
                        }
                    });
                });
            }
            return matches;
        case "even":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 === 0) {
                                    matches++;
                                    matchCount++;
                                    return "";
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "odd":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 !== 0) {
                                    matches++;
                                    matchCount++;
                                    return "";
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        default:
            return 0;
    }
}

function extractOperation(matchOption, re, matches) {
    switch (matchOption) {
        case "all":
            var _parsedTextExtract = [];
            var columnOffset = 0;
            var greatestMatchedCells = 0;
            parsedText.forEach((row) => {
                var _row = [];
                var pushCount = 0;
                columnOffset = 0;
                row.forEach((item) => {
                    Array.from(item.text.matchAll(re)).forEach((match, index) => {
                        if (match[0] !== "") {
                            matches++;
                            _row.push({ text: match[0], original: true, row: item.row, column: item.column + columnOffset + index });
                        }
                    });
                    if (_row.length > 0 && re.test(item.text)) {
                        columnOffset = _row.length - (pushCount + 1);
                        pushCount++;
                        re.lastIndex = 0;
                    };
                    greatestMatchedCells = pushCount > greatestMatchedCells ? pushCount : greatestMatchedCells;
                });
                _parsedTextExtract.push(_row);
            });
            if (matches !== 0) {
                var greatestMatches = _parsedTextExtract.reduce((max, line) => Math.max(max, line.length), 0);
                var _maxColumn = maxColumn + greatestMatches - greatestMatchedCells;
                maxColumn = _maxColumn > maxColumn ? _maxColumn : maxColumn;
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "first":
            var _parsedTextExtract = [];
            var columnOffset = 0;
            var greatestMatchedCells = 0;
            parsedText.forEach((row) => {
                var _row = [];
                var pushCount = 0;
                columnOffset = 0;
                row.forEach((item) => {
                    Array.from(item.text.matchAll(re)).forEach((match, index) => {
                        if (match[0] !== "" && matches === 0) {
                            matches++;
                            _row.push({ text: match[0], original: true, row: item.row, column: item.column + columnOffset + index });
                        }
                    });
                    if (_row.length > 0 && re.test(item.text)) {
                        columnOffset = _row.length - (pushCount + 1);
                        pushCount++;
                        re.lastIndex = 0;
                    };
                    greatestMatchedCells = pushCount > greatestMatchedCells ? pushCount : greatestMatchedCells;
                });
                _parsedTextExtract.push(_row);
            });
            if (matches !== 0) {
                var greatestMatches = _parsedTextExtract.reduce((max, line) => Math.max(max, line.length), 0);
                var _maxColumn = maxColumn + greatestMatches - greatestMatchedCells;
                maxColumn = _maxColumn > maxColumn ? _maxColumn : maxColumn;
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "firstN":
            var firstNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var _parsedTextExtract = [];
            var columnOffset = 0;
            var greatestMatchedCells = 0;
            parsedText.forEach((row) => {
                var _row = [];
                var pushCount = 0;
                columnOffset = 0;
                row.forEach((item) => {
                    Array.from(item.text.matchAll(re)).forEach((match, index) => {
                        if (match[0] !== "" && matches < firstNMatches) {
                            matches++;
                            _row.push({ text: match[0], original: true, row: item.row, column: item.column + columnOffset + index });
                        }
                    });
                    if (_row.length > 0 && re.test(item.text)) {
                        columnOffset = _row.length - (pushCount + 1);
                        pushCount++;
                        re.lastIndex = 0;
                    };
                    greatestMatchedCells = pushCount > greatestMatchedCells ? pushCount : greatestMatchedCells;
                });
                _parsedTextExtract.push(_row);
            });
            if (matches !== 0) {
                var greatestMatches = _parsedTextExtract.reduce((max, line) => Math.max(max, line.length), 0);
                var _maxColumn = maxColumn + greatestMatches - greatestMatchedCells;
                maxColumn = _maxColumn > maxColumn ? _maxColumn : maxColumn;
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "last":
            var _parsedTextExtract = [];
            var lastMatchRow, lastMatchCol;
            parsedText.forEach((row) => {
                row.forEach((col) => {
                    if (re.test(col.text)) {
                        lastMatchRow = col.row;
                        lastMatchCol = col.column;
                    }
                });
                re.lastIndex = 0;
            });

            if (lastMatchRow && lastMatchCol) {
                re.lastIndex = 0;
                matches++;
                var lineText = parsedText[lastMatchRow][lastMatchCol].text;
                var allMatches = [...lineText.matchAll(re)];
                var lastMatch = allMatches[allMatches.length - 1];
        
                _parsedTextExtract.push([{ text: lastMatch[0], original: true, row: lastMatchRow, column: lastMatchCol }]);
            }

            if (matches !== 0) {
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "lastN":
            var _parsedTextExtract = [];
            var lastNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var lastMatchIndices = [];

            parsedText.forEach((row) => {
                row.forEach((col) => {
                    re.lastIndex = 0;
                    if (re.test(col.text)) {
                        lastMatchIndices.push([col.row, col.column]);
                    }
                });
            });

            lastMatchIndices.reverse();
            lastMatchIndices = new Set(lastMatchIndices);

            if (lastMatchIndices.size !== 0) {
                lastMatchIndices.forEach((indices) => {
                    re.lastIndex = 0;
                    var lineText = parsedText[indices[0]][indices[1]].text;
                    var allMatches = [...lineText.matchAll(re)];
                    var row = [];
                    var reverseIndex = allMatches.length - 1;
                    allMatches.reverse();
                    allMatches.forEach((match) => {
                        if (matches < lastNMatches) {
                            row.push({ text: match[0], original: true, row: indices[0], column: indices[1] + reverseIndex });
                            matches++;
                            reverseIndex--;
                        }
                    });
                    row.reverse();
                    row.length > 0 ? _parsedTextExtract.push(row) : null;
                });
            }
            _parsedTextExtract.reverse();

            if (matches !== 0) {
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "even":
            var matchCount = 0;
            var _parsedTextExtract = [];
            var columnOffset = 0;
            var greatestMatchedCells = 0;
            parsedText.forEach((row) => {
                var _row = [];
                var pushCount = 0;
                columnOffset = 0;
                row.forEach((item) => {
                    Array.from(item.text.matchAll(re)).forEach((match, index) => {
                        if (match[0] !== "" && matchCount % 2 === 0) {
                            matches++;
                            _row.push({ text: match[0], original: true, row: item.row, column: item.column + columnOffset + index });
                        }
                        matchCount++;
                    });
                    if (_row.length > 0 && re.test(item.text)) {
                        columnOffset = _row.length - (pushCount + 1);
                        pushCount++;
                        re.lastIndex = 0;
                    };
                    greatestMatchedCells = pushCount > greatestMatchedCells ? pushCount : greatestMatchedCells;
                });
                _parsedTextExtract.push(_row);
            });
            if (matches !== 0) {
                var greatestMatches = _parsedTextExtract.reduce((max, line) => Math.max(max, line.length), 0);
                var _maxColumn = maxColumn + greatestMatches - greatestMatchedCells;
                maxColumn = _maxColumn > maxColumn ? _maxColumn : maxColumn;
                fillInTable(_parsedTextExtract);
            }
            return matches;
        case "odd":
            var matchCount = 0;
            var _parsedTextExtract = [];
            var columnOffset = 0;
            var greatestMatchedCells = 0;
            parsedText.forEach((row) => {
                var _row = [];
                var pushCount = 0;
                columnOffset = 0;
                row.forEach((item) => {
                    Array.from(item.text.matchAll(re)).forEach((match, index) => {
                        if (match[0] !== "" && matchCount % 2 !== 0) {
                            matches++;
                            _row.push({ text: match[0], original: true, row: item.row, column: item.column + columnOffset + index });
                        }
                        matchCount++;
                    });
                    if (_row.length > 0 && re.test(item.text)) {
                        columnOffset = _row.length - (pushCount + 1);
                        pushCount++;
                        re.lastIndex = 0;
                    };
                    greatestMatchedCells = pushCount > greatestMatchedCells ? pushCount : greatestMatchedCells;
                });
                _parsedTextExtract.push(_row);
            });
            if (matches !== 0) {
                var greatestMatches = _parsedTextExtract.reduce((max, line) => Math.max(max, line.length), 0);
                var _maxColumn = maxColumn + greatestMatches - greatestMatchedCells;
                maxColumn = _maxColumn > maxColumn ? _maxColumn : maxColumn;
                fillInTable(_parsedTextExtract);
            }
            return matches;
        default:
            return 0;
    }
}

function replaceOperation(matchOption, re, matches, replaceText) {
    switch (matchOption) {
        case "all":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return replaceText;
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "first":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches === 0) {
                                    matches++;
                                    return replaceText;
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "firstN":
            var firstNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches < firstNMatches) {
                                    matches++;
                                    return replaceText;
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "last":
            var lastMatchRow = -1;
            var lastMatchColumn = -1;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchRow = rowIndex;
                        lastMatchColumn = colIndex;
                    }
                })
            });

            if (lastMatchRow !== -1 && lastMatchColumn !== -1) {
                re.lastIndex = 0;
                matches++;
                var lineText = parsedText[lastMatchRow][lastMatchColumn].text;
                var allMatches = [...lineText.matchAll(re)];
                var lastMatch = allMatches[allMatches.length - 1];
        
                parsedText[lastMatchRow][lastMatchColumn].text = lineText.slice(0, lastMatch.index) + replaceText + lineText.slice(lastMatch.index + lastMatch[0].length);
            }
            return matches;
        case "lastN":
            var lastNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var lastMatchIndices = [];
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchIndices.push({row: rowIndex, col: colIndex});
                    }
                })
            });
            lastMatchIndices.reverse();
            lastMatchIndices = new Set(lastMatchIndices);

            if (lastMatchIndices.size !== 0) {
                lastMatchIndices.forEach((rowColIndex) => {
                    re.lastIndex = 0;
                    var lineText = parsedText[rowColIndex.row][rowColIndex.col].text;
                    var allMatches = [...lineText.matchAll(re)];
                    allMatches.reverse();
                    allMatches.forEach((match) => {
                        if (matches < lastNMatches) {
                            lineText = lineText.slice(0, match.index) + replaceText + lineText.slice(match.index + match[0].length);
                            parsedText[rowColIndex.row][rowColIndex.col].text = lineText;
                            matches++;
                        }
                    });
                });
            }
            return matches;
        case "even":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 === 0) {
                                    matches++;
                                    matchCount++;
                                    return replaceText;
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "odd":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 !== 0) {
                                    matches++;
                                    matchCount++;
                                    return replaceText;
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        default:
            return 0;
    }
}

function uppercaseOperation(matchOption, re, matches) {
    switch (matchOption) {
        case "all":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return match.toUpperCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "first":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches === 0) {
                                    matches++;
                                    return match.toUpperCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "firstN":
            var firstNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches < firstNMatches) {
                                    matches++;
                                    return match.toUpperCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "last":
            var lastMatchRow = -1;
            var lastMatchColumn = -1;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchRow = rowIndex;
                        lastMatchColumn = colIndex;
                    }
                })
            });

            if (lastMatchRow !== -1 && lastMatchColumn !== -1) {
                re.lastIndex = 0;
                matches++;
                var lineText = parsedText[lastMatchRow][lastMatchColumn].text;
                var allMatches = [...lineText.matchAll(re)];
                var lastMatch = allMatches[allMatches.length - 1];
        
                parsedText[lastMatchRow][lastMatchColumn].text = lineText.slice(0, lastMatch.index) + lastMatch[0].toUpperCase() + lineText.slice(lastMatch.index + lastMatch[0].length);
            }
            return matches;
        case "lastN":
            var lastNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var lastMatchIndices = [];
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchIndices.push({row: rowIndex, col: colIndex});
                    }
                })
            });
            lastMatchIndices.reverse();
            lastMatchIndices = new Set(lastMatchIndices);

            if (lastMatchIndices.size !== 0) {
                lastMatchIndices.forEach((rowColIndex) => {
                    re.lastIndex = 0;
                    var lineText = parsedText[rowColIndex.row][rowColIndex.col].text;
                    var allMatches = [...lineText.matchAll(re)];
                    allMatches.reverse();
                    allMatches.forEach((match) => {
                        if (matches < lastNMatches) {
                            lineText = lineText.slice(0, match.index) + match[0].toUpperCase() + lineText.slice(match.index + match[0].length);
                            parsedText[rowColIndex.row][rowColIndex.col].text = lineText;
                            matches++;
                        }
                    });
                });
            }
            return matches;
        case "even":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 === 0) {
                                    matches++;
                                    matchCount++;
                                    return match.toUpperCase();
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "odd":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 !== 0) {
                                    matches++;
                                    matchCount++;
                                    return match.toUpperCase();
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        default:
            return 0;
    }
}

function lowercaseOperation(matchOption, re, matches) {
    switch (matchOption) {
        case "all":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "") {
                                    matches++;
                                    return match.toLowerCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "first":
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches === 0) {
                                    matches++;
                                    return match.toLowerCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "firstN":
            var firstNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matches < firstNMatches) {
                                    matches++;
                                    return match.toLowerCase();
                                }
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "last":
            var lastMatchRow = -1;
            var lastMatchColumn = -1;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchRow = rowIndex;
                        lastMatchColumn = colIndex;
                    }
                })
            });

            if (lastMatchRow !== -1 && lastMatchColumn !== -1) {
                re.lastIndex = 0;
                matches++;
                var lineText = parsedText[lastMatchRow][lastMatchColumn].text;
                var allMatches = [...lineText.matchAll(re)];
                var lastMatch = allMatches[allMatches.length - 1];
        
                parsedText[lastMatchRow][lastMatchColumn].text = lineText.slice(0, lastMatch.index) + lastMatch[0].toLowerCase() + lineText.slice(lastMatch.index + lastMatch[0].length);
            }
            return matches;
        case "lastN":
            var lastNMatches = document.getElementById("matchOptionInput" + treatmentIndex).value;
            var lastMatchIndices = [];
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    re.lastIndex = 0;
                    if (re.test(item.text)) {
                        lastMatchIndices.push({row: rowIndex, col: colIndex});
                    }
                })
            });
            lastMatchIndices.reverse();
            lastMatchIndices = new Set(lastMatchIndices);

            if (lastMatchIndices.size !== 0) {
                lastMatchIndices.forEach((rowColIndex) => {
                    re.lastIndex = 0;
                    var lineText = parsedText[rowColIndex.row][rowColIndex.col].text;
                    var allMatches = [...lineText.matchAll(re)];
                    allMatches.reverse();
                    allMatches.forEach((match) => {
                        if (matches < lastNMatches) {
                            lineText = lineText.slice(0, match.index) + match[0].toLowerCase() + lineText.slice(match.index + match[0].length);
                            parsedText[rowColIndex.row][rowColIndex.col].text = lineText;
                            matches++;
                        }
                    });
                });
            }
            return matches;
        case "even":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 === 0) {
                                    matches++;
                                    matchCount++;
                                    return match.toLowerCase();
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        case "odd":
            var matchCount = 0;
            parsedText.forEach((row, rowIndex) => {
                row.forEach((item, colIndex) => {
                    if (re.test(item.text)) {
                        parsedText[rowIndex][colIndex] = {
                            text: item.text.replace(re, (match) => {
                                if (match !== "" && matchCount % 2 !== 0) {
                                    matches++;
                                    matchCount++;
                                    return match.toLowerCase();
                                }
                                matchCount++;
                                return match;
                            }),
                            row: item.row,
                            column: item.column,
                        };
                    }
                });
            });
            return matches;
        default:
            return 0;
    }
}

function splitOperation(matchOption, re, matches, filterRegex) {
    switch (matchOption) {
        case "all":
            var _parsedTextSplit = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));
            
            maxColumn = filterRegex;
            maxRow = Math.ceil(_concatParsedText.length / maxColumn);

            var startingRowIndex = 0;
            var startingColIndex = 0;
            var row = [];
            for (let rowIndex = startingRowIndex; rowIndex < Math.ceil(_concatParsedText.length / maxColumn); rowIndex++) {
                var rowLength = maxColumn * (rowIndex + 1);
                for (let colIndex = startingColIndex; colIndex < rowLength; colIndex++) {
                    item = _concatParsedText[colIndex] ? _concatParsedText[colIndex] : { text: "", original: true, row: rowIndex, column: colIndex % (maxColumn - 1) };
                    item.column = colIndex % maxColumn;
                    item.row = rowIndex;

                    row.push(item);
                    startingColIndex = colIndex
                }
                _parsedTextSplit.push(row);
                row = [];
                startingColIndex++;
                matches++;
            }

            parsedText = structuredClone(_parsedTextSplit);
            return matches;
        case "first":
            // If filterRegex >= current maxColumn or
            // filterRegex > all cells in table,
            // then operation is no different than splitting by match option all
            var notApplicable = filterRegex >= maxColumn || filterRegex > parsedText.reduce((acc, curr) => acc += curr.length, 0) - 1;
            if (notApplicable) return splitOperation("all", re, matches, filterRegex);

            maxRow++;

            var _parsedTextSplit = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));
        
            // Handle first match
            var row = [];
            for (let firstColIndex = 0; firstColIndex < filterRegex; firstColIndex++) {
                item = _concatParsedText[firstColIndex];
                item.column = firstColIndex;
                item.row = 0;

                row.push(item);
            }
            _parsedTextSplit.push(row);
            _concatParsedText = _concatParsedText.slice(filterRegex);
            matches++;

            // Handle rest of table
            var startingRowIndex = 1;
            var startingColIndex = 0;
            row = [];
            for (let rowIndex = startingRowIndex; rowIndex < Math.ceil(_concatParsedText.length / maxColumn) + 1; rowIndex++) {
                var rowLength = maxColumn * rowIndex;
                for (let colIndex = startingColIndex; colIndex < rowLength; colIndex++) {
                    item = _concatParsedText[colIndex] ? _concatParsedText[colIndex] : { text: "", original: true, row: rowIndex, column: colIndex % (maxColumn - 1) };
                    item.column = colIndex % maxColumn;
                    item.row = rowIndex;

                    row.push(item);
                    startingColIndex = colIndex
                }
                _parsedTextSplit.push(row);
                row = [];
                startingColIndex++;
            }

            fillInTable(_parsedTextSplit);
            return matches;
        case "firstN":
            // If filterRegex >= current maxColumn or
            // firstNMatches * filterRegex > all cells in table,
            // then operation is no different than splitting by match option all
            var firstNMatches = parseInt(document.getElementById("matchOptionInput" + treatmentIndex).value);
            var notApplicable = filterRegex >= maxColumn || firstNMatches * filterRegex > parsedText.reduce((acc, curr) => acc += curr.length, 0) - 1;
            if (notApplicable) return splitOperation("all", re, matches, filterRegex);

            console.log(maxColumn);
            maxColumn += filterRegex - Math.ceil((filterRegex * firstNMatches) / maxColumn)
            console.log(maxColumn);
            
            var _parsedTextSplit = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));
        
            // Handle firstNMatches
            var startingRowIndex = 0;
            var startingColIndex = 0;
            var row = [];
            for (let firstNRowIndex = startingRowIndex; firstNRowIndex < firstNMatches; firstNRowIndex++) {
                var rowLength = filterRegex * (firstNRowIndex + 1);
                for (let firstNColIndex = startingColIndex; firstNColIndex < rowLength; firstNColIndex++) {
                    item = _concatParsedText[firstNColIndex];
                    item.column = firstNColIndex % filterRegex;
                    item.row = firstNRowIndex;

                    row.push(item);
                    startingColIndex = firstNColIndex
                }
                _parsedTextSplit.push(row);
                row = [];
                startingColIndex++;
                matches++;
            }
            _concatParsedText = _concatParsedText.slice(filterRegex * firstNMatches);

            // Handle rest of table
            startingRowIndex = firstNMatches;
            startingColIndex = 0;
            row = [];
            for (let rowIndex = startingRowIndex; rowIndex < Math.ceil(_concatParsedText.length / maxColumn) + startingRowIndex; rowIndex++) {
                var rowLength = maxColumn * (rowIndex - startingRowIndex + 1);
                for (let colIndex = startingColIndex; colIndex < rowLength; colIndex++) {
                    item = _concatParsedText[colIndex] ? _concatParsedText[colIndex] : { text: "", original: true, row: rowIndex, column: colIndex % (maxColumn - 1) };
                    item.column = colIndex % maxColumn;
                    item.row = rowIndex;

                    row.push(item);
                    startingColIndex = colIndex;
                }
                _parsedTextSplit.push(row);
                row = [];
                startingColIndex++;
            }

            fillInTable(_parsedTextSplit);
            return matches;
        case "last":
            // If filterRegex >= current maxColumn or
            // filterRegex > all cells in table,
            // then operation is no different than splitting by match option all
            var notApplicable = filterRegex >= maxColumn || filterRegex > parsedText.reduce((acc, curr) => acc += curr.length, 0) - 1;
            if (notApplicable) return splitOperation("all", re, matches, filterRegex);

            maxColumn++;

            // Saving last match range locally, removing from parsedText
            var _parsedTextSplit = parsedText[parsedText.length - 1].slice(parsedText[parsedText.length - 1].length - filterRegex, parsedText[parsedText.length - 1].length);
            parsedText[parsedText.length - 1] = parsedText[parsedText.length - 1].slice(0, parsedText[parsedText.length - 1].length - filterRegex);


            // Reindexing row and cols of last match range
            for (let lastColIndex = 0; lastColIndex < _parsedTextSplit.length; lastColIndex++) {
                item = _parsedTextSplit[lastColIndex];
                item.column = lastColIndex;
                item.row = parsedText.length;
            }

            // Push last match range as new row to parsedText
            parsedText.push(_parsedTextSplit);

            fillInTable(parsedText);
            return matches;
        case "lastN":
            // If filterRegex >= current maxColumn or
            // lastNMatches * filterRegex > all cells in table,
            // then operation is no different than splitting by match option all
            var lastNMatches = parseInt(document.getElementById("matchOptionInput" + treatmentIndex).value);
            var notApplicable = filterRegex >= maxColumn || lastNMatches * filterRegex > parsedText.reduce((acc, curr) => acc += curr.length, 0) - 1;
            if (notApplicable) return splitOperation("all", re, matches, filterRegex);

            maxColumn += filterRegex - Math.ceil((filterRegex * firstNMatches) / maxColumn)

            var _parsedTextSplit = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));
            _concatParsedText.reverse();

            // Handle lastNMatches
            var startingRowIndex = 0;
            var startingColIndex = 0;
            var row = [];
            for (let lastNRowIndex = startingRowIndex; lastNRowIndex < lastNMatches; lastNRowIndex++) {
                var rowLength = filterRegex * (lastNRowIndex + 1);
                for (let lastNColIndex = startingColIndex; lastNColIndex < rowLength; lastNColIndex++) {
                    item = _concatParsedText[lastNColIndex];
                    item.column = filterRegex - (lastNColIndex % filterRegex) - 1;
                    item.row = parsedText.length - Math.floor((filterRegex * lastNMatches) / maxColumn) + (lastNMatches - lastNRowIndex) - 1;

                    row.push(item);
                    startingColIndex = lastNColIndex
                }
                row.reverse();
                _parsedTextSplit.push(row);
                row = [];
                startingColIndex++;
                matches++;
            }
            _parsedTextSplit.reverse();
            
            // Handle rest of table
            var popCount = 0;
            var totalRemove = filterRegex * lastNMatches;
            for (let rowIndex = parsedText.length - 1; rowIndex >= 0; rowIndex--) {
                for (let colIndex = parsedText[rowIndex].length - 1; colIndex >= 0; colIndex--) {
                    if (popCount < totalRemove) {
                        parsedText[rowIndex].pop();
                        popCount++;
                    }
                    colIndex === 0 && parsedText[rowIndex].length === 0 ? parsedText.pop() : null;
                }
            }
            
            // Push lastNMatches onto parsedText
            _parsedTextSplit.forEach((item) => {
                parsedText.push(item);
            });

            fillInTable(parsedText);
            return matches;
        case "even":
            break;
        case "odd":
            break;
        default:
            break;
    }

    function concatParsedText(_parsedText) {
        var _concatParsedText = [];
        _parsedText.forEach((row) => {
            _concatParsedText = _concatParsedText.concat(row);
        });
        return _concatParsedText;
    }
}

function combineOperation(matchOption, re, matches, filterRegex) {
    switch (matchOption) {
        case "all":
            var _parsedTextCombine = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));

            maxColumn = Math.ceil(maxColumn / filterRegex);

            var text = "";
            var combineCounter = 0;
            var rowCounter = 0;
            var colCounter = 0;
            var row = [];
            for (let i = 0; i < _concatParsedText.length; i++) {
                text === null ? text = _concatParsedText[i].text : text += _concatParsedText[i].text;
                combineCounter++;

                if (combineCounter === filterRegex) {
                    row.push({text: text, original: true, row: rowCounter, column: colCounter});
                    colCounter++;
                    text = null;
                    combineCounter = 0;

                    if (row.length === maxColumn) {
                        _parsedTextCombine.push(row);
                        row = [];
                        rowCounter++;
                        colCounter = 0;
                    }
                }
            }
            if (text !== null) row.push({ text, original: true, row: rowCounter, column: colCounter });
            if (row.length > 0) _parsedTextCombine.push(row);

            maxRow = calcMaxRow(_parsedTextCombine);
            fillInTable(_parsedTextCombine);
            return matches;
        case "first":
            var _parsedTextCombine = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));

            if (filterRegex > _concatParsedText.length - maxColumn) maxColumn = _concatParsedText.length - filterRegex + 1;

            var text = "";
            var combineCounter = 0;
            var rowCounter = 0;
            var colCounter = 0;
            var row = [];
            for (let i = 0; i < _concatParsedText.length; i++) {
                text === null ? text = _concatParsedText[i].text : text += _concatParsedText[i].text;
                combineCounter++;

                if (combineCounter >= filterRegex) {
                    row.push({text: text, original: true, row: rowCounter, column: colCounter});
                    colCounter++;
                    text = null;

                    if (row.length === maxColumn) {
                        _parsedTextCombine.push(row);
                        row = [];
                        rowCounter++;
                        colCounter = 0;
                    }
                }
            }
            if (text !== null) row.push({ text, original: true, row: rowCounter, column: colCounter });
            if (row.length > 0) _parsedTextCombine.push(row);

            maxRow = calcMaxRow(_parsedTextCombine);
            fillInTable(_parsedTextCombine);
            return matches;
        case "firstN":
            var firstNMatches = parseInt(document.getElementById("matchOptionInput" + treatmentIndex).value);
            var _parsedTextCombine = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));

            var matchesInLastRow = Math.ceil(((filterRegex * firstNMatches) - (_concatParsedText.length - maxColumn)) / filterRegex);
            var remainingCellsInLastRow = (_concatParsedText.length - (filterRegex * firstNMatches));
            if (filterRegex * firstNMatches > _concatParsedText.length - maxColumn) maxColumn = matchesInLastRow + remainingCellsInLastRow;

            var text = "";
            var combineCounter = 0;
            var rowCounter = 0;
            var colCounter = 0;
            var row = [];
            var firstNCombineCounter = 0;
            for (let i = 0; i < _concatParsedText.length; i++) {
                text === null ? text = _concatParsedText[i].text : text += _concatParsedText[i].text;
                combineCounter++;

                if (combineCounter === filterRegex || firstNCombineCounter >= firstNMatches) {
                    row.push({text: text, original: true, row: rowCounter, column: colCounter});
                    colCounter++;
                    text = null;
                    combineCounter = 0;
                    firstNCombineCounter++;

                    if (row.length === maxColumn) {
                        _parsedTextCombine.push(row);
                        row = [];
                        rowCounter++;
                        colCounter = 0;
                    }
                }
            }
            if (text !== null) row.push({ text, original: true, row: rowCounter, column: colCounter });
            if (row.length > 0) _parsedTextCombine.push(row);

            maxRow = calcMaxRow(_parsedTextCombine);
            fillInTable(_parsedTextCombine);
            return matches;
        case "last":
            var _parsedTextCombine = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));

            if (filterRegex > _concatParsedText.length - maxColumn) maxColumn = _concatParsedText.length - filterRegex + 1;

            var text = "";
            var combineCounter = _concatParsedText.length;
            var rowCounter = 0;
            var colCounter = 0;
            var row = [];
            for (let i = 0; i < _concatParsedText.length; i++) {
                text === null ? text = _concatParsedText[i].text : text += _concatParsedText[i].text;
                combineCounter--;

                if (combineCounter >= filterRegex || i === _concatParsedText.length - 1) {
                    row.push({text: text, original: true, row: rowCounter, column: colCounter});
                    colCounter++;
                    text = null;

                    if (row.length === maxColumn) {
                        _parsedTextCombine.push(row);
                        row = [];
                        rowCounter++;
                        colCounter = 0;
                    }
                }
            }
            if (text !== null) row.push({ text, original: true, row: rowCounter, column: colCounter });
            if (row.length > 0) _parsedTextCombine.push(row);

            maxRow = calcMaxRow(_parsedTextCombine);
            fillInTable(_parsedTextCombine);
            return matches;
        case "lastN":
            var lastNMatches = parseInt(document.getElementById("matchOptionInput" + treatmentIndex).value);
            var _parsedTextCombine = [];
            var _concatParsedText = concatParsedText(structuredClone(parsedText));

            var matchesInLastRow = Math.ceil(((filterRegex * lastNMatches) - (_concatParsedText.length - maxColumn)) / filterRegex);
            var remainingCellsInLastRow = (_concatParsedText.length - (filterRegex * lastNMatches));
            if (filterRegex * lastNMatches > _concatParsedText.length - maxColumn) maxColumn = matchesInLastRow + remainingCellsInLastRow;

            var text = "";
            var combineCounter = _concatParsedText.length;
            var rowCounter = 0;
            var colCounter = 0;
            var row = [];
            for (let i = 0; i < _concatParsedText.length; i++) {
                text === null ? text = _concatParsedText[i].text : text += _concatParsedText[i].text;
                combineCounter--;

                if (combineCounter >= filterRegex * lastNMatches || (_concatParsedText.length - i - 1) % filterRegex === 0) {
                    row.push({text: text, original: true, row: rowCounter, column: colCounter});
                    colCounter++;
                    text = null;

                    if (row.length === maxColumn) {
                        _parsedTextCombine.push(row);
                        row = [];
                        rowCounter++;
                        colCounter = 0;
                    }
                }
            }
            if (text !== null) row.push({ text, original: true, row: rowCounter, column: colCounter });
            if (row.length > 0) _parsedTextCombine.push(row);

            maxRow = calcMaxRow(_parsedTextCombine);
            fillInTable(_parsedTextCombine);
            return matches;
        case "even":
            break;
        case "odd":
            break;
        default:
            break;
    }

    function concatParsedText(_parsedText) {
        var _concatParsedText = [];
        _parsedText.forEach((row) => {
            _concatParsedText = _concatParsedText.concat(row);
        });
        return _concatParsedText;
    }
}

// function reIndexParsedText(_parsedText) {
//     var maxColumn = parsedText.reduce((max, line) => Math.max(max, line.column), 0);
    
//     columnCount = 0;
//     _parsedText.forEach((line, index) => {
//         _parsedText[index] = { text: line.text, column: columnCount };
//         if (++columnCount > maxColumn) columnCount = 0;
//     });

//     parsedText = structuredClone(_parsedText);
// }

function calcMaxRow(_parsedText = parsedText) {
    return _parsedText.length
}

function calcMaxColumn(_parsedText = parsedText) {
    return Math.max(..._parsedText.map(row => row.length))
}

function fillInTable(_parsedText) {
    let filledParsedText = [];
    let filledRow = [];
    let currentColumn, nextColumn;

    for (let i = 0; i < _parsedText.length; i++) {
        let innerIndex = _parsedText[i] ? _parsedText[i].length : 0;
        currentRow = _parsedText[i][0] ? _parsedText[i][0].row : null;

        if (innerIndex === 0) {
            for (let j = 0; j <= maxColumn - 1; j++) {
                filledRow.push({text: "", original: false, row: i, column: j});
            }
            currentRow = i;
        }
        
        if (filledParsedText.length !== currentRow) {
            for (let j = 0; j < currentRow; j++) {
                for (let x = 0; x <= maxColumn - 1; x++) {
                    filledRow.push({text: "", original: false, row: j, column: x});
                }
                filledParsedText.push(filledRow);
                filledRow = [];
            }
        }

        for (let j = 0; j < innerIndex; j++) {
            currentColumn = _parsedText[i][j].column;
            nextColumn = _parsedText[i][j + 1] ? _parsedText[i][j + 1].column : _parsedText[i][j].column + 1;

            // Fill missing columns at the start of the row (only if current column is not 0)
            if (filledRow.length === 0 && currentColumn > 0) {
                for (let x = 0; x < currentColumn; x++) {
                    filledRow.push({text: "", original: false, row: currentRow, column: x});
                }
            }

            // Add the current element to the current row
            filledRow.push(_parsedText[i][j]);

            // Fill missing columns within the row if next column is greater than current column + 1
            if (nextColumn > currentColumn + 1) {
                for (let x = currentColumn + 1; x < nextColumn; x++) {
                    filledRow.push({text: "", original: false, row: currentRow, column: x});
                }
            }

            // Fill missing columns at the end of the current row up to maxColumn
            if (j === innerIndex - 1 && currentColumn !== maxColumn - 1) {
                for (let x = currentColumn + 1; x <= maxColumn - 1; x++) {
                    filledRow.push({text: "", original: false, row: currentRow, column: x});
                }
            }
    
        }
        // Add the completed row to filledParsedText
        filledParsedText.push(filledRow);

        // Reset filledRow for the next row
        filledRow = [];
    }

    if (filledParsedText.length !== maxRow) {
        for (let i = filledParsedText.length; i < maxRow; i++) {
            for (let j = 0; j <= maxColumn - 1; j++) {
                filledRow.push({text: "", original: false, row: i, column: j});
            }
            filledParsedText.push(filledRow);
            filledRow = [];
        }
    }

    parsedText = structuredClone(filledParsedText);
}

function testFunction() {
    console.log(parsedText);
    console.log(instructions);
    console.log("maxColumn: " + maxColumn);
    console.log("maxRow: " + maxRow);
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
    for (let i = 0; i < maxColumn; i++) {
        headerRow.appendChild(createHeaderCell("Column" + i));
    }
    tableHead.appendChild(headerRow);

    // Generate table body rows
    tableBody.innerHTML = ""; // Clear existing rows

    parsedText.forEach((row, rowIndex) => {
        tableRow = document.createElement("tr");
        tableRow.appendChild(createCell(rowIndex)); 
        row.forEach(col => {
            tableRow.appendChild(createCell(col.text, col.original));
        });
        tableBody.appendChild(tableRow);
    });
}

// Helper function to create table header cells
function createHeaderCell(text) {
    const th = document.createElement("th");
    th.textContent = text;
    return th;
}

// Helper function to create table cells
function createCell(text, original = true) {
    const td = document.createElement("td");
    if (!original) td.classList.add('filled-in-cell'); // doesn't work with extract function
    td.textContent = text;
    return td;
}
// #endregion

// #region HTML-only functions
// Toggles history container open or closed
function toggleHistoryContainer() {
    const historyContainer = document.getElementById('historyContainer');
    
    if (historyContainer.classList.contains('open')) {
        document.querySelectorAll('.content-container').forEach((container) => {
            container.style.maxWidth = "100%";
        });
    } else if (historyContainer.classList.contains('closed')) {
        document.querySelectorAll('.content-container').forEach((container) => {
            container.style.maxWidth = "calc(100% - 300px)";
        });
    }
    historyContainer.classList.toggle('open');
    historyContainer.classList.toggle('closed');
}

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
        case "uppercase":
            expressionInputA.placeholder = "Enter an expression to uppercase"
            break;
        case "lowercase":
            expressionInputA.placeholder = "Enter an expression to lowercase"
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

function setMatchOption(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const matchOption = event.target.getAttribute("match-option-type");
    const matchOptionInput = document.getElementById("matchOptionInput" + _treatmentIndex);
    const matchOptionTypeContainer = document.getElementById("matchOptionTypeContainer" + _treatmentIndex);
    const matchOptionCancelContainer = document.getElementById("matchOptionCancelContainer" + _treatmentIndex);
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const parseButton = document.getElementById("parseButton" + _treatmentIndex);

    expressionInputA.setAttribute("match-option-type", matchOption);
    parseButton.setAttribute("match-option-type", matchOption);

    setMatchOptionPlaceholder(matchOption, matchOptionInput);
    setMatchOptionStyling(matchOption, matchOptionInput, matchOptionTypeContainer, matchOptionCancelContainer);
}

function setMatchOptionPlaceholder(matchOption, matchOptionInput) {
    switch (matchOption) {
        case "firstN":
            matchOptionInput.placeholder = "Enter the first number of matches to apply"
            break;
        case "lastN":
            matchOptionInput.placeholder = "Enter the last number of matches to apply"
            break;
        default:
            break;
    }
}

function setMatchOptionStyling(matchOption, matchOptionInput, matchOptionTypeContainer, matchOptionCancelContainer) {
    if (matchOption === "firstN" || matchOption === "lastN") {
        matchOptionTypeContainer.parentNode.classList.remove("col-md-11");
        matchOptionTypeContainer.parentNode.classList.add("col-md-9");
        matchOptionInput.parentNode.style.display = "block";
        matchOptionCancelContainer.style.display = "block";
        matchOptionTypeContainer.querySelectorAll("label").forEach((label) => {
            const input = label.querySelector("input");
            if (input.getAttribute("match-option-type") === matchOption) {
                label.classList.remove("unround-left");
                label.classList.remove("unround-right");
                label.classList.remove("round-left");
                label.classList.remove("round-right");

                label.classList.add("round-left");
                label.classList.add("unround-right");
            } else {
                label.style.display = "none";
            }
        });
    }
}

function cancelMatchOption(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const matchOptionInput = document.getElementById("matchOptionInput" + _treatmentIndex);
    const matchOptionTypeContainer = document.getElementById("matchOptionTypeContainer" + _treatmentIndex);
    const matchOptionCancelContainer = document.getElementById("matchOptionCancelContainer" + _treatmentIndex);

    matchOptionTypeContainer.parentNode.classList.remove("col-md-9");
    matchOptionTypeContainer.parentNode.classList.add("col-md-11");
    matchOptionInput.parentNode.style.display = "none";
    matchOptionCancelContainer.style.display = "none";
    matchOptionTypeContainer.querySelectorAll("label").forEach((label, index) => {
        label.classList.remove("unround-left");
        label.classList.remove("unround-right");
        label.classList.remove("round-left");
        label.classList.remove("round-right");

        if (index === 0) {
            label.classList.add("round-left");
            label.classList.add("unround-right");
        } else if (index === matchOptionTypeContainer.querySelectorAll("label").length - 1) {
            label.classList.add("unround-left");
            label.classList.add("round-right");
        } else {
            label.classList.add("unround-left");
            label.classList.add("unround-right");
        }

        label.style.display = "inline-block";
    });
}

function setTableOption(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const tableOption = event.target.getAttribute("table-option-type");
    const expressionInputA = document.getElementById("expressionInputA" + _treatmentIndex);
    const parseButton = document.getElementById("parseButton" + _treatmentIndex);

    expressionInputA.setAttribute("table-option-type", tableOption);
    parseButton.setAttribute("table-option-type", tableOption);
}

// Adds inline styling to table to preview treatment
function filterPreview(event) {
    const _treatmentIndex = event.target.getAttribute("data-treatment-index");
    const expressionInput = document.getElementById("expressionInputA" + _treatmentIndex);
    const matchOptionInput = document.getElementById("matchOptionInput" + _treatmentIndex).value;
    const expressionInputValue = expressionInput.value;
    const filterType = expressionInput.getAttribute("filter-type");
    const matchOption = expressionInput.getAttribute("match-option-type");
    const tableOption = expressionInput.getAttribute("table-option-type");

    const tableBody = document.getElementById("tableBody" + _treatmentIndex);
    const rows = tableBody.getElementsByTagName("tr");

    removePreviews(expressionInputValue, tableBody, true);

    var re, tableOperationValue;
    var textOperation = (filterType === "remove" || filterType === "extract" || filterType === "replace" || filterType === "uppercase" || filterType === "lowercase");
    var tableOperation = (filterType === "split" || filterType === "combine");
    if (textOperation) {
        try {
            re = new RegExp(expressionInputValue, "g");
        } catch (e) {
            return; // Needed for performance
        }
    } else if (tableOperation) {
        tableOperationValue = parseInt(expressionInputValue);
    }

    if (textOperation) {
        var spanOpenTag;
        var spanCloseTag = `</span>`;
        switch (filterType) {
            case "remove":
                spanOpenTag = `<span style="background-color: red; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">`;
                break;
            case "extract":
                spanOpenTag = `<span style="background-color: green; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">`;
                break;
            case "replace":
                spanOpenTag = `<span style="background-color: blue; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">`;
                break;
            case "uppercase":
                spanOpenTag = `<span style="background-color: orange; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">`;
                break;
            case "lowercase":
                spanOpenTag = `<span style="background-color: orange; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">`;
                break;
            default:
                break;
        }

        switch (matchOption) {
            case "all":
                var allMatches = initAllMatchesByTextRows();
                allMatches.forEach((match) => {
                    var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                    var text = cell.textContent;
                    match.matches.reverse().forEach((singleMatch) => {
                        if (singleMatch[0] !== "") text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                    });
                    cell.innerHTML = text;
                });
                break;
            case "first":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var firstMatchCell = allMatches[0];
                        var firstMatch = firstMatchCell.matches.filter(match => match[0] !== "")[0];
                        var cell = rows[firstMatchCell.rowIndex].getElementsByTagName("td")[firstMatchCell.colIndex];
                        var text = cell.textContent;
                        if (firstMatch) text = text.slice(0, firstMatch.index) + spanOpenTag + text.slice(firstMatch.index, firstMatch.index + firstMatch[0].length) + spanCloseTag + text.slice(firstMatch.index + firstMatch[0].length);
                        cell.innerHTML = text;
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var prevMatchRowIndex, firstMatch, cell, text;
                        allMatches.forEach((match) => {
                            if (match.rowIndex !== prevMatchRowIndex) {
                                firstMatch = match.matches.filter(match => match[0] !== "")[0];
                                cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                                text = cell.textContent;
                                if (firstMatch) text = text.slice(0, firstMatch.index) + spanOpenTag + text.slice(firstMatch.index, firstMatch.index + firstMatch[0].length) + spanCloseTag + text.slice(firstMatch.index + firstMatch[0].length);
                                cell.innerHTML = text;
                                prevMatchRowIndex = match.rowIndex;
                            }
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var lastMatchColndex, firstMatch, cell, text;
                        allMatches.forEach((match) => {
                            if (match.colIndex !== lastMatchColndex) {
                                firstMatch = match.matches.filter(match => match[0] !== "")[0];
                                cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                                text = cell.textContent;
                                if (firstMatch) text = text.slice(0, firstMatch.index) + spanOpenTag + text.slice(firstMatch.index, firstMatch.index + firstMatch[0].length) + spanCloseTag + text.slice(firstMatch.index + firstMatch[0].length);
                                cell.innerHTML = text;
                                lastMatchColndex = match.colIndex;
                            }
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var firstMatch, cell, text;
                        allMatches.forEach((match) => {
                            firstMatch = match.matches.filter(match => match[0] !== "")[0];
                            cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            text = cell.textContent;
                            if (firstMatch) text = text.slice(0, firstMatch.index) + spanOpenTag + text.slice(firstMatch.index, firstMatch.index + firstMatch[0].length) + spanCloseTag + text.slice(firstMatch.index + firstMatch[0].length);
                            cell.innerHTML = text;
                        });
                        break;
                    default:
                        break;
                }
                break;
            case "firstN":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        allMatches.forEach((match) => {
                            var matchesLength = match.matches.filter(match => match[0] !== "").length;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch, reverseIndex) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") {
                                    var remainingMatches = matchOptionInput - matchCount;
                                    var matchesToSkip = matchesLength - remainingMatches;
                    
                                    if (reverseIndex >= matchesToSkip) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        matchCount++;
                                    }
                                }
                            });
                            cell.innerHTML = text;
                        });
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        var prevMatchRowIndex;
                        allMatches.forEach((match) => {
                            if (match.rowIndex !== prevMatchRowIndex) matchCount = 0;
                            var matchesLength = match.matches.filter(match => match[0] !== "").length;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch, reverseIndex) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") {
                                    var remainingMatches = matchOptionInput - matchCount;
                                    var matchesToSkip = matchesLength - remainingMatches;
                    
                                    if (reverseIndex >= matchesToSkip) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        matchCount++;
                                    }
                                }
                            });
                            cell.innerHTML = text;
                            prevMatchRowIndex = match.rowIndex;
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var matchCount = 0;
                        var prevMatchColIndex;
                        allMatches.forEach((match) => {
                            if (match.colIndex !== prevMatchColIndex) matchCount = 0;
                            var matchesLength = match.matches.filter(match => match[0] !== "").length;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch, reverseIndex) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") {
                                    var remainingMatches = matchOptionInput - matchCount;
                                    var matchesToSkip = matchesLength - remainingMatches;
                    
                                    if (reverseIndex >= matchesToSkip) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        matchCount++;
                                    }
                                }
                            });
                            cell.innerHTML = text;
                            prevMatchColIndex = match.colIndex;
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        allMatches.forEach((match) => {
                            matchCount = 0;
                            var matchesLength = match.matches.filter(match => match[0] !== "").length;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch, reverseIndex) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") {
                                    var remainingMatches = matchOptionInput - matchCount;
                                    var matchesToSkip = matchesLength - remainingMatches;
                    
                                    if (reverseIndex >= matchesToSkip) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        matchCount++;
                                    }
                                }
                            });
                            cell.innerHTML = text;
                        });
                        break;
                    default:
                        break;
                }
                break;
            case "last":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var lastMatchCell = allMatches[allMatches.length - 1];
                        var lastMatch = lastMatchCell.matches.filter(match => match[0] !== "").reverse()[0];
                        var cell = rows[lastMatchCell.rowIndex].getElementsByTagName("td")[lastMatchCell.colIndex];
                        var text = cell.textContent;
                        if (lastMatch) text = text.slice(0, lastMatch.index) + spanOpenTag + text.slice(lastMatch.index, lastMatch.index + lastMatch[0].length) + spanCloseTag + text.slice(lastMatch.index + lastMatch[0].length);
                        cell.innerHTML = text;
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var prevMatchRowIndex, lastMatch, cell, text;
                        allMatches.reverse().forEach((match) => {
                            if (match.rowIndex !== prevMatchRowIndex) {
                                lastMatch = match.matches.filter(match => match[0] !== "").reverse()[0];
                                cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                                text = cell.textContent;
                                if (lastMatch) text = text.slice(0, lastMatch.index) + spanOpenTag + text.slice(lastMatch.index, lastMatch.index + lastMatch[0].length) + spanCloseTag + text.slice(lastMatch.index + lastMatch[0].length);
                                cell.innerHTML = text;
                                prevMatchRowIndex = match.rowIndex;
                            }
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var prevMatchColIndex, lastMatch, cell, text;
                        allMatches.reverse().forEach((match) => {
                            if (match.colIndex !== prevMatchColIndex) {
                                lastMatch = match.matches.filter(match => match[0] !== "").reverse()[0];
                                cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                                text = cell.textContent;
                                if (lastMatch) text = text.slice(0, lastMatch.index) + spanOpenTag + text.slice(lastMatch.index, lastMatch.index + lastMatch[0].length) + spanCloseTag + text.slice(lastMatch.index + lastMatch[0].length);
                                cell.innerHTML = text;
                                prevMatchColIndex = match.colIndex;
                            }
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var lastMatch, cell, text;
                        allMatches.reverse().forEach((match) => {
                            lastMatch = match.matches.filter(match => match[0] !== "").reverse()[0];
                            cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            text = cell.textContent;
                            if (lastMatch) text = text.slice(0, lastMatch.index) + spanOpenTag + text.slice(lastMatch.index, lastMatch.index + lastMatch[0].length) + spanCloseTag + text.slice(lastMatch.index + lastMatch[0].length);
                            cell.innerHTML = text;
                        });
                        break;
                    default:
                        break;
                }
                break;
            case "lastN":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        allMatches.reverse().forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") { 
                                    text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                    matchCount++;
                                }
                            });
                            cell.innerHTML = text;
                        });
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        var prevMatchRowIndex;
                        allMatches.reverse().forEach((match) => {
                            if (match.rowIndex !== prevMatchRowIndex) matchCount = 0;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") { 
                                    text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                    matchCount++;
                                }
                            });
                            cell.innerHTML = text;
                            prevMatchRowIndex = match.rowIndex;
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var matchCount = 0;
                        var prevMatchColIndex;
                        allMatches.reverse().forEach((match) => {
                            if (match.colIndex !== prevMatchColIndex) matchCount = 0;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") { 
                                    text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                    matchCount++;
                                }
                            });
                            cell.innerHTML = text;
                            prevMatchColIndex = match.colIndex;
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0;
                        allMatches.reverse().forEach((match) => {
                            matchCount = 0;
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
                            match.matches.reverse().forEach((singleMatch) => {
                                if (matchCount < matchOptionInput && singleMatch[0] !== "") { 
                                    text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                    matchCount++;
                                }
                            });
                            cell.innerHTML = text;
                        });
                        break;
                    default:
                        break;
                }
                break;
            case "even":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
        
                            totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 0) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                        });
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        var prevMatchRowIndex;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;

                            match.rowIndex !== prevMatchRowIndex ? totalMatches = match.matches.filter(match => match[0] !== "").length : totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 0) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                            prevMatchRowIndex = match.rowIndex;
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var matchCount = 0, totalMatches = 0;
                        var prevMatchColIndex;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;

                            match.colIndex !== prevMatchColIndex ? totalMatches = match.matches.filter(match => match[0] !== "").length : totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 0) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                            prevMatchColIndex = match.colIndex;
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
        
                            matchCount = match.matches.filter(match => match[0] !== "").length;
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 0) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                        });
                        break;
                    default:
                        break;
                }
                break;
            case "odd":
                switch (tableOption) {
                    case "table":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex].textContent;
        
                            totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 1) { 
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                        });
                        break;
                    case "rows":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        var prevMatchRowIndex;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex].textContent;
        
                            match.rowIndex !== prevMatchRowIndex ? totalMatches = match.matches.filter(match => match[0] !== "").length : totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 1) { 
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                            prevMatchRowIndex = match.rowIndex;
                        });
                        break;
                    case "columns":
                        var allMatches = initAllMatchesByTextCols();
                        var matchCount = 0, totalMatches = 0;
                        var prevMatchColIndex;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
    
                            match.colIndex !== prevMatchColIndex ? totalMatches = match.matches.filter(match => match[0] !== "").length : totalMatches += match.matches.filter(match => match[0] !== "").length;
                            matchCount = totalMatches
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 1) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                            prevMatchColIndex = match.colIndex;
                        });
                        break;
                    case "cells":
                        var allMatches = initAllMatchesByTextRows();
                        var matchCount = 0, totalMatches = 0;
                        allMatches.forEach((match) => {
                            var cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            var text = cell.textContent;
            
                            matchCount = match.matches.filter(match => match[0] !== "").length;
                            
                            match.matches.reverse().forEach((singleMatch) => {
                                if (singleMatch[0] !== "") {
                                    matchCount--;
                                    if (matchCount % 2 === 1) {
                                        text = text.slice(0, singleMatch.index) + spanOpenTag + text.slice(singleMatch.index, singleMatch.index + singleMatch[0].length) + spanCloseTag + text.slice(singleMatch.index + singleMatch[0].length);
                                        cell.innerHTML = text;
                                    }
                                }
                            });
                        });
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }
    } else if (tableOperation) {
        var cellBackgroundColorPrimary, cellBackgroundColorSecondary;
        switch (filterType) {
            case "split":
                cellBackgroundColorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--dark3');
                cellBackgroundColorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--dark2');
                break;
            case "combine":
                cellBackgroundColorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--dark3');
                cellBackgroundColorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--dark2');
                break;
            default:
                break;
        }

        switch (matchOption) {
            case "all":
                var allCells = initAllCellsByRows();
                var cellCount = 0;
                allCells.forEach((match) => {
                    const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                    if (cellCount >= 0 && cellCount < tableOperationValue) cell.style.backgroundColor = cellBackgroundColorPrimary;
                    if (cellCount >= tableOperationValue && cellCount < tableOperationValue * 2) cell.style.backgroundColor = cellBackgroundColorSecondary;
                    cellCount === (tableOperationValue * 2 - 1) ? cellCount = 0 : cellCount++;
                });
                break;
            case "first":
                switch (tableOption) {
                    case "table":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        allCells.forEach((match, index) => {
                            if (index >= tableOperationValue) return;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            if (cellCount >= 0 && cellCount < tableOperationValue) cell.style.backgroundColor = cellBackgroundColorPrimary;
                            if (cellCount >= tableOperationValue && cellCount < tableOperationValue * 2) cell.style.backgroundColor = cellBackgroundColorSecondary;
                            cellCount === (tableOperationValue * 2 - 1) ? cellCount = 0 : cellCount++;
                        });
                        break;
                    case "rows":
                        var allCells = initAllCellsByRows();
                        var prevRowIndex;
                        var colorCellPrimary = true;
                        allCells.forEach((match, index) => {
                            if ((index % maxColumn) >= tableOperationValue) return;
                            if (prevRowIndex !== match.rowIndex) colorCellPrimary = !colorCellPrimary;
                            prevRowIndex = match.rowIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "columns":
                        var allCells = initAllCellsByCols();
                        var prevColIndex;
                        var colorCellPrimary = true;
                        allCells.forEach((match, index) => {
                            if ((index % maxRow) >= tableOperationValue) return;
                            if (prevColIndex !== match.colIndex) colorCellPrimary = !colorCellPrimary;
                            prevColIndex = match.colIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "cells":
                        break;
                    default:
                        break;
                }
                break;
            case "firstN":
                switch (tableOption) {
                    case "table":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        allCells.forEach((match, index) => {
                            if (index >= tableOperationValue * matchOptionInput) return;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            if (cellCount >= 0 && cellCount < tableOperationValue) cell.style.backgroundColor = cellBackgroundColorPrimary;
                            if (cellCount >= tableOperationValue && cellCount < tableOperationValue * 2) cell.style.backgroundColor = cellBackgroundColorSecondary;
                            cellCount === (tableOperationValue * 2 - 1) ? cellCount = 0 : cellCount++;
                        });
                        break;
                    case "rows":
                        var allCells = initAllCellsByRows();
                        var prevRowIndex;
                        var colorCellPrimary = true;
                        allCells.forEach((match, index) => {
                            if ((index % maxColumn) >= tableOperationValue * matchOptionInput) return;
                            if (prevRowIndex !== match.rowIndex || index % maxColumn % matchOptionInput === 0) colorCellPrimary = !colorCellPrimary;
                            if ((prevRowIndex !== match.rowIndex && tableOperationValue % 2 === 0) || (prevRowIndex !== match.rowIndex && tableOperationValue * matchOptionInput > maxColumn)) colorCellPrimary = !colorCellPrimary; // prevents stacked cells from being the same color
                            prevRowIndex = match.rowIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "columns":
                        var allCells = initAllCellsByCols();
                        var prevColIndex;
                        var colorCellPrimary = true;
                        allCells.forEach((match, index) => {
                            if ((index % maxRow) >= tableOperationValue * matchOptionInput) return;
                            if (prevColIndex !== match.colIndex || index % maxRow % matchOptionInput === 0) colorCellPrimary = !colorCellPrimary;
                            if ((prevColIndex !== match.colIndex && tableOperationValue % 2 === 0) || (prevColIndex !== match.colIndex && tableOperationValue * matchOptionInput > maxRow)) colorCellPrimary = !colorCellPrimary; // prevents side by side cells from being the same color
                            prevColIndex = match.colIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "cells":
                        break;
                    default:
                        break;
                }
                break;
            case "last":
                switch (tableOption) {
                    case "table":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        allCells.reverse().forEach((match, index) => {
                            if (index >= tableOperationValue) return;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            if (cellCount >= 0 && cellCount < tableOperationValue) cell.style.backgroundColor = cellBackgroundColorPrimary;
                            if (cellCount >= tableOperationValue && cellCount < tableOperationValue * 2) cell.style.backgroundColor = cellBackgroundColorSecondary;
                            cellCount === (tableOperationValue * 2 - 1) ? cellCount = 0 : cellCount++;
                        });
                        break;
                    case "rows":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        var prevRowIndex;
                        var colorCellPrimary = true;
                        allCells.reverse().forEach((match, index) => {
                            if ((index % maxColumn) >= tableOperationValue) return;
                            if (prevRowIndex !== match.rowIndex) colorCellPrimary = !colorCellPrimary;
                            prevRowIndex = match.rowIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "columns":
                        var allCells = initAllCellsByCols();
                        var cellCount = 0;
                        var prevColIndex;
                        var colorCellPrimary = true;
                        allCells.reverse().forEach((match, index) => {
                            if ((index % maxRow) >= tableOperationValue) return;
                            if (prevColIndex !== match.colIndex) colorCellPrimary = !colorCellPrimary;
                            prevColIndex = match.colIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "cells":
                        break;
                    default:
                        break;
                }
                break;
            case "lastN":
                switch (tableOption) {
                    case "table":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        allCells.reverse().forEach((match, index) => {
                            if (index >= tableOperationValue * matchOptionInput) return;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            if (cellCount >= 0 && cellCount < tableOperationValue) cell.style.backgroundColor = cellBackgroundColorPrimary;
                            if (cellCount >= tableOperationValue && cellCount < tableOperationValue * 2) cell.style.backgroundColor = cellBackgroundColorSecondary;
                            cellCount === (tableOperationValue * 2 - 1) ? cellCount = 0 : cellCount++;
                        });
                        break;
                    case "rows":
                        var allCells = initAllCellsByRows();
                        var cellCount = 0;
                        var prevRowIndex;
                        var colorCellPrimary = true;
                        allCells.reverse().forEach((match, index) => {
                            if ((index % maxColumn) >= tableOperationValue * matchOptionInput) return;
                            if (prevRowIndex !== match.rowIndex) colorCellPrimary = !colorCellPrimary;
                            prevRowIndex = match.rowIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "columns":
                        var allCells = initAllCellsByCols();
                        var cellCount = 0;
                        var prevColIndex;
                        var colorCellPrimary = true;
                        allCells.reverse().forEach((match, index) => {
                            if ((index % maxRow) >= tableOperationValue * matchOptionInput) return;
                            if (prevColIndex !== match.colIndex) colorCellPrimary = !colorCellPrimary;
                            prevColIndex = match.colIndex;
                            const cell = rows[match.rowIndex].getElementsByTagName("td")[match.colIndex];
                            colorCellPrimary ? cell.style.backgroundColor = cellBackgroundColorPrimary : cell.style.backgroundColor = cellBackgroundColorSecondary;
                        });
                        break;
                    case "cells":
                        break;
                    default:
                        break;
                }
                break;
            // Even/odd match options don't even make sense, can be disblaed when selecting split/combine
            case "even":
                break;
            // Odd/even match options don't even make sense, can be disblaed when selecting split/combine
            case "odd":
                break;
            default:
                break;
        }
    }

    // init allMatches for all text operations, and when tableOption = table || rows || cells
    function initAllMatchesByTextRows() {
        const tableBody = document.getElementById("tableBody" + _treatmentIndex);
        const rows = tableBody.getElementsByTagName("tr");

        var allMatches = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = rows[rowIndex].getElementsByTagName("td");
            for (let colIndex = 1; colIndex < cells.length; colIndex++) { // Start at 1 to skip the index column
        
                let textCell = cells[colIndex];
                let text = textCell.textContent;

                try {
                    if (re.test(text)) {
                        re.lastIndex = 0;
                        const matches = [...text.matchAll(re)];
                        allMatches.push({ rowIndex: rowIndex, colIndex: colIndex, matches: matches });
                    }
                } catch (e) {
                    removePreviews(expressionInputValue, tableBody, true);
                }
            }
        }

        console.log(allMatches);
        return allMatches;
    }

    // init allMatches for all text operations, and when tableOption = columns
    function initAllMatchesByTextCols() {
        const tableBody = document.getElementById("tableBody" + _treatmentIndex);
        const rows = tableBody.getElementsByTagName("tr");

        var allMatches = [];
        for (let colIndex = 1; colIndex <= maxColumn; colIndex++) { // Start at 1 to skip the index column
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        
                let textCell = rows[rowIndex].getElementsByTagName("td")[colIndex];
                let text = textCell.textContent;

                try {
                    if (re.test(text)) {
                        re.lastIndex = 0;
                        const matches = [...text.matchAll(re)];
                        allMatches.push({ rowIndex: rowIndex, colIndex: colIndex, matches: matches });
                    }
                } catch (e) {
                    removePreviews(expressionInputValue, tableBody, true);
                }
            }
        }

        console.log(allMatches);
        return allMatches;
    }

    // init allCells for all table operations, and when tableOption = table || rows || cells
    function initAllCellsByRows() {
        const tableBody = document.getElementById("tableBody" + _treatmentIndex);
        const rows = tableBody.getElementsByTagName("tr");

        var allCells = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = rows[rowIndex].getElementsByTagName("td");
            for (let colIndex = 1; colIndex < cells.length; colIndex++) { // Start at 1 to skip the index column
                allCells.push({ rowIndex: rowIndex, colIndex: colIndex });
            }
        }

        console.log(allCells);
        return allCells;
    }

    // init allCells for all table operations, and tableOption = columns
    function initAllCellsByCols() {
        const tableBody = document.getElementById("tableBody" + _treatmentIndex);
        const rows = tableBody.getElementsByTagName("tr");

        var allCells = [];
        for (let colIndex = 1; colIndex <= maxColumn; colIndex++) { // Start at 1 to skip the index column
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                allCells.push({ rowIndex: rowIndex, colIndex: colIndex });
            }
        }

        console.log(allCells);
        return allCells;
    }
}

// Re-add all filter previews to tables
function readdFilterPreviews() {
    instructions.forEach((instruction, index) => {
        const re = new RegExp(instruction.regex, "g");
        const tableBody = document.getElementById("tableBody" + index);
        const rows = tableBody.getElementsByTagName("tr");

        if (instruction.filterType === "remove" || instruction.filterType === "extract" || instruction.filterType === "replace" || instruction.filterType === "uppercase" || instruction.filterType === "lowercase") {
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
                                        return `<span style="background-color: red; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">${match}</span>`;
                                    case "extract":
                                        return `<span style="background-color: green; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">${match}</span>`;
                                    case "replace":
                                        return `<span style="background-color: blue; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">${match}</span>`;
                                    case "uppercase":
                                        return `<span style="background-color: yellow; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">${match}</span>`;
                                    case "lowercase":
                                        return `<span style="background-color: yellow; box-shadow: -1px -1px 0 var(--dark1); white-space: pre-wrap;">${match}</span>`;
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
                                cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--dark3');
                                break;
                            case "combine":
                                cell.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--dark3');
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
            let originalBackground = getComputedStyle(document.documentElement).getPropertyValue('--dark1');
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
        case "uppercase":
            const uppercaseFilter = document.getElementById("uppercaseFilter" + _treatmentIndex);
            uppercaseFilter.parentNode.classList.add("active");
            expressionInputA.setAttribute("filter-type", "uppercase");
            break;
        case "lowercase":
            const lowercaseFilter = document.getElementById("lowercaseFilter" + _treatmentIndex);
            lowercaseFilter.parentNode.classList.add("active");
            expressionInputA.setAttribute("filter-type", "lowercase");
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

    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.remove("col-md-2");
    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.add("col-md-3");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.remove("col-md-9");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.add("col-md-8");

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

    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.remove("col-md-3");
    document.getElementById("cancelButton" + _treatmentIndex).parentNode.classList.add("col-md-2");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.remove("col-md-8");
    document.getElementById("expressionInputA" + _treatmentIndex).parentNode.classList.add("col-md-9");

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
      <div class="table-header">
        <h4>Output</h4>
      </div>
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
      <div class="filter-container p-3">

        <!-- Tabs -->
        <ul class="nav nav-tabs">
          <li class="nav-item">
            <a class="nav-link active" href="#operationsTab${treatmentIndex}" data-toggle="tab">Operations</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#matchOptionsTab${treatmentIndex}" data-toggle="tab">Match Options</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#tableOptionsTab${treatmentIndex}" data-toggle="tab">Table Options</a>
          </li>
        </ul>
        
        <div class="tab-content">
          <!-- Operations -->
          <div id="operationsTab${treatmentIndex}" class="tab-pane fade show active">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
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
                  <label class="treatment-type btn btn-outline-secondary">
                    <input type="radio" id="uppercaseFilter${treatmentIndex}" autocomplete="off" filter-type="uppercase" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Uppercase
                  </label>
                  <label class="treatment-type btn btn-outline-secondary">
                    <input type="radio" id="lowercaseFilter${treatmentIndex}" autocomplete="off" filter-type="lowercase" data-treatment-index="${treatmentIndex}" onchange="setFilterType(event);filterPreview(event);"> Lowercase
                  </label>
                </div>
              </div>
            </div>
          </div>
          <!-- Match Options -->
          <div id="matchOptionsTab${treatmentIndex}" class="tab-pane fade">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
                <label class="option-label">Match:</label>
              </div>
              
              <div class="col-md-11 d-flex">
                <div id="matchOptionTypeContainer${treatmentIndex}" class="match-option-type-container btn-group btn-group-toggle" data-toggle="buttons">
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="allOption${treatmentIndex}" autocomplete="off" match-option-type="all" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> All
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="firstOption${treatmentIndex}" autocomplete="off" match-option-type="first" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> First
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="firstNOption${treatmentIndex}" autocomplete="off" match-option-type="firstN" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> First N
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="lastOption${treatmentIndex}" autocomplete="off" match-option-type="last" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> Last
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="lastNOption${treatmentIndex}" autocomplete="off" match-option-type="lastN" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> Last N
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="evenOption${treatmentIndex}" autocomplete="off" match-option-type="even" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> Even
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="oddOption${treatmentIndex}" autocomplete="off" match-option-type="odd" data-treatment-index="${treatmentIndex}" onchange="setMatchOption(event);filterPreview(event);"> Odd
                  </label>
                </div>

                <div id="matchOptionInputContainer${treatmentIndex}" class="match-option-input-container" style="display: none;">
                  <input type="text" id="matchOptionInput${treatmentIndex}" class="form-control text-white unround-left" placeholder="" match-option-type="" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);"/>
                </div>
              </div>

              <div id="matchOptionCancelContainer${treatmentIndex}" class="action-button-container col-md-2" style="display: none;">
                <button type="button" id="matchOptionCancel${treatmentIndex}" class="cancel-match-option-button btn btn-danger" data-treatment-index="${treatmentIndex}" onclick="cancelMatchOption(event);"><i class="fa-solid fa-xmark" data-treatment-index="${treatmentIndex}" onclick="cancelMatchOption(event)"></i></button>
              </div>
            </div>
          </div>
          <!-- Table Options -->
          <div id="tableOptionsTab${treatmentIndex}" class="tab-pane fade">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
                <label class="option-label">Match:</label>
              </div>

              <div class="col-md-11">
                <div id="tableOptionTypeContainer${treatmentIndex}" class="table-option-type-container btn-group btn-group-toggle disabled" data-toggle="buttons">
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="tableOption${treatmentIndex}" autocomplete="off" table-option-type="table" data-treatment-index="${treatmentIndex}" onchange="setTableOption(event);filterPreview(event);"> Table
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="rowsOption${treatmentIndex}" autocomplete="off" table-option-type="rows" data-treatment-index="${treatmentIndex}" onchange="setTableOption(event);filterPreview(event);"> Rows
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="columnsOption${treatmentIndex}" autocomplete="off" table-option-type="columns" data-treatment-index="${treatmentIndex}" onchange="setTableOption(event);filterPreview(event);"> Columns
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="cellsOption${treatmentIndex}" autocomplete="off" table-option-type="cells" data-treatment-index="${treatmentIndex}" onchange="setTableOption(event);filterPreview(event);"> Cells
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Input -->
        <div class="row">
          <div class="label-container col-md-1">
            <label id="expressionLabel${treatmentIndex}" class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-9">
            <input type="text" id="expressionInputA${treatmentIndex}" class="expression-input-a form-control text-white" placeholder="Select an operation to begin parsing" filter-type="" match-option-type="" table-option-type="" data-treatment-index="${treatmentIndex}" oninput="filterPreview(event);" disabled/>
            <input type="text" id="expressionInputB${treatmentIndex}" class="expression-input-b form-control text-white" placeholder="" data-treatment-index="${treatmentIndex}" style="display: none;"/>
          </div>
          
          <div class="action-button-container col-md-2 d-flex">
            <input type="hidden" id="isEdit${treatmentIndex}" class="hid hid-edit" data-treatment-index="${treatmentIndex}" value="false">
            <button type="button" id="newLineButton${treatmentIndex}" class="action-button new-line-button btn btn-primary mr-2" data-treatment-index="${treatmentIndex}" onclick=""><i class="fa-solid fa-plus"></i><span class="new-line-long"> New Line</span><span class="new-line-short"> \\n</span></button>
            <button type="button" id="parseButton${treatmentIndex}" class="action-button parse-button btn btn-success" filter-type="" match-option-type="" table-option-type="" data-treatment-index="${treatmentIndex}" onclick="determineParse(event);">Parse</button>
            <button type="button" id="cancelButton${treatmentIndex}" class="action-button cancel-button btn btn-danger ml-2" data-treatment-index="${treatmentIndex}" onclick="cancelEditHistory(event);" style="display: none;">Cancel</button>
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
        parseTable(true, instruction, instruction.filterType, instruction.matchOption, instruction.tableOption);
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
      <div class="table-header">
        <h4>Output</h4>
      </div>
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
      <div class="filter-container p-3">

        <!-- Tabs -->
        <ul class="nav nav-tabs">
          <li class="nav-item">
            <a class="nav-link active" href="#operationsTab0" data-toggle="tab">Operations</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#matchOptionsTab0" data-toggle="tab">Match Options</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#tableOptionsTab0" data-toggle="tab">Table Options</a>
          </li>
        </ul>
        
        <div class="tab-content">
          <!-- Operations -->
          <div id="operationsTab0" class="tab-pane fade show active">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
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
                  <label class="treatment-type btn btn-outline-secondary">
                    <input type="radio" id="uppercaseFilter0" autocomplete="off" filter-type="uppercase" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Uppercase
                  </label>
                  <label class="treatment-type btn btn-outline-secondary">
                    <input type="radio" id="lowercaseFilter0" autocomplete="off" filter-type="lowercase" data-treatment-index="0" onchange="setFilterType(event);filterPreview(event);"> Lowercase
                  </label>
                </div>
              </div>
            </div>
          </div>
          <!-- Match Options -->
          <div id="matchOptionsTab0" class="tab-pane fade">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
                <label class="option-label">Match:</label>
              </div>
              
              <div class="col-md-11 d-flex">
                <div id="matchOptionTypeContainer0" class="match-option-type-container btn-group btn-group-toggle" data-toggle="buttons">
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="allOption0" autocomplete="off" match-option-type="all" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> All
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="firstOption0" autocomplete="off" match-option-type="first" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> First
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="firstNOption0" autocomplete="off" match-option-type="firstN" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> First N
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="lastOption0" autocomplete="off" match-option-type="last" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> Last
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="lastNOption0" autocomplete="off" match-option-type="lastN" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> Last N
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="evenOption0" autocomplete="off" match-option-type="even" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> Even
                  </label>
                  <label class="match-option-type btn btn-outline-secondary">
                    <input type="radio" id="oddOption0" autocomplete="off" match-option-type="odd" data-treatment-index="0" onchange="setMatchOption(event);filterPreview(event);"> Odd
                  </label>
                </div>

                <div id="matchOptionInputContainer0" class="match-option-input-container" style="display: none;">
                  <input type="text" id="matchOptionInput0" class="form-control text-white unround-left" placeholder="" match-option-type="" data-treatment-index="0" oninput="filterPreview(event);"/>
                </div>
              </div>

              <div id="matchOptionCancelContainer0" class="action-button-container col-md-2" style="display: none;">
                <button type="button" id="matchOptionCancel0" class="cancel-match-option-button btn btn-danger" data-treatment-index="0" onclick="cancelMatchOption(event);"><i class="fa-solid fa-xmark" data-treatment-index="0" onclick="cancelMatchOption(event)"></i></button>
              </div>
            </div>
          </div>
          <!-- Table Options -->
          <div id="tableOptionsTab0" class="tab-pane fade">
            <div class="row mb-3 mt-3">
              <div class="label-container col-md-1">
                <label class="option-label">Match:</label>
              </div>

              <div class="col-md-11">
                <div id="tableOptionTypeContainer0" class="table-option-type-container btn-group btn-group-toggle disabled" data-toggle="buttons">
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="tableOption0" autocomplete="off" table-option-type="table" data-treatment-index="0" onchange="setTableOption(event);filterPreview(event);"> Table
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="rowsOption0" autocomplete="off" table-option-type="rows" data-treatment-index="0" onchange="setTableOption(event);filterPreview(event);"> Rows
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="columnsOption0" autocomplete="off" table-option-type="columns" data-treatment-index="0" onchange="setTableOption(event);filterPreview(event);"> Columns
                  </label>
                  <label class="table-option-type btn btn-outline-secondary">
                    <input type="radio" id="cellsOption0" autocomplete="off" table-option-type="cells" data-treatment-index="0" onchange="setTableOption(event);filterPreview(event);"> Cells
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Input -->
        <div class="row">
          <div class="label-container col-md-1">
            <label id="expressionLabel0" class="expression-label">Expression:</label>
          </div>
          
          <div class="col-md-9">
            <input type="text" id="expressionInputA0" class="expression-input-a form-control text-white" placeholder="Select an operation to begin parsing" filter-type="" match-option-type="" table-option-type="" data-treatment-index="0" oninput="filterPreview(event);" disabled/>
            <input type="text" id="expressionInputB0" class="expression-input-b form-control text-white" placeholder="" data-treatment-index="0" style="display: none;"/>
          </div>
          
          <div class="action-button-container col-md-2 d-flex">
            <input type="hidden" id="isEdit0" class="hid hid-edit" data-treatment-index="0" value="false">
            <button type="button" id="newLineButton0" class="action-button new-line-button btn btn-primary mr-2" data-treatment-index="0" onclick=""><i class="fa-solid fa-plus"></i><span class="new-line-long"> New Line</span><span class="new-line-short"> \\n</span></button>
            <button type="button" id="parseButton0" class="action-button parse-button btn btn-success" filter-type="" match-option-type="" table-option-type="" data-treatment-index="0" onclick="determineParse(event);">Parse</button>
            <button type="button" id="cancelButton0" class="action-button cancel-button btn btn-danger ml-2" data-treatment-index="0" onclick="cancelEditHistory(event);" style="display: none;">Cancel</button>
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
    cancelButton.parentNode.classList.remove("col-md-3");
    cancelButton.parentNode.classList.add("col-md-2");
    isEditFlag.value = "false";

    expressionInputA.parentNode.classList.remove("col-md-8");
    expressionInputA.parentNode.classList.add("col-md-9");
    setExpressionInputStyling(treatmentFilterType, expressionInputA, expressionInputB);
    setExpressionLabel(treatmentFilterType, _treatmentIndex);
}
// #endregion
