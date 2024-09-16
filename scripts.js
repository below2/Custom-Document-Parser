// Get the 'Load Document' button and table body elements
const loadDocumentButton = document.getElementById("loadDocumentButton");

// Create a file input element once, and use it each time to avoid reopening the file explorer
const inputElement = document.getElementById("file-input");
inputElement.type = "file";
inputElement.accept = ".pdf, .docx, .txt";

var treatmentIndex = 0;
var parsedText = [];

// const removeFilter = document.getElementById("remove-filter" + treatmentIndex);
// removeFilter.addEventListener("input", function () {
//     const re = new RegExp(removeFilter.value, 'g');

//     const tableBody = document.getElementById("tableBody" + treatmentIndex);
//     const rows = tableBody.getElementsByTagName("tr");

//     // Loop through each row to check for matches in the text
//     for (let row of rows) {
//         const textCell = row.getElementsByTagName("td")[1]; // Assuming the text is in the second column
//         let text = textCell.textContent;

//         // If there is a match, wrap the matching text with a span that adds strikethrough and color red
//         if (re.test(text)) {
//             // Replace all matching parts with wrapped span
//             const newHTML = text.replace(re, (match) => `<span style="color: red; text-decoration: line-through;">${match}</span>`);
//             textCell.innerHTML = newHTML; // Set the new HTML content
//         } else {
//             // If no match, reset to the original text (remove previous spans)
//             textCell.innerHTML = text;
//         }
//     }
// });

function removePreview(event) {
    // Get the treatment index from the data attribute of the event target
    const treatmentIndex = event.target.getAttribute('data-treatment-index');

    // Get the input field based on the treatmentIndex
    const removeFilter = document.getElementById("remove-filter" + treatmentIndex);

    // Create a regular expression based on the input value
    const re = new RegExp(removeFilter.value, 'g');

    // Get the table body based on the treatmentIndex
    const tableBody = document.getElementById("tableBody" + treatmentIndex);
    const rows = tableBody.getElementsByTagName("tr");

    // Loop through each row to check for matches in the text
    for (let row of rows) {
        const textCell = row.getElementsByTagName("td")[1]; // Assuming the text is in the second column
        let text = textCell.textContent;

        // If there is a match, wrap the matching text with a span that adds strikethrough and color red
        if (re.test(text)) {
            // Replace all matching parts with wrapped span
            const newHTML = text.replace(re, (match) => `<span style="color: red; text-decoration: line-through;">${match}</span>`);
            textCell.innerHTML = newHTML; // Set the new HTML content
        } else {
            // If no match, reset to the original text (remove previous spans)
            textCell.innerHTML = text;
        }
    }
}

// Function to read and parse the selected file
function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return; // Avoid further processing if no file is selected

    const reader = new FileReader();

    // Check the file type
    const fileType = file.name.split(".").pop().toLowerCase();

    // Define how to handle different file types
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

    // Reset the input element to allow re-selecting the same file
    inputElement.value = "";
}

// Function to parse PDF files and accumulate text from all pages sequentially
function parsePDF(file, fileArrayBuffer) {
    const loadingTask = pdfjsLib.getDocument(fileArrayBuffer);
    loadingTask.promise.then(function (pdf) {
        let textContent = [];
        const numPages = pdf.numPages;

        // Process pages sequentially to ensure order
        function processPageSequentially(pageNum) {
            if (pageNum > numPages) {
                // When all pages are processed, add the text to the table
                initText(textContent.join("\n"));
                return;
            }

            pdf.getPage(pageNum).then(function (page) {
                return page.getTextContent().then(function (textContentObj) {
                    let pageText = textContentObj.items.map((item) => item.str).join(" ");
                    textContent.push(pageText);
                    processPageSequentially(pageNum + 1); // Process next page
                });
            });
        }

        processPageSequentially(1); // Start processing from the first page
    });
}

// Function to parse DOCX files
function parseDOCX(fileText) {
    const zip = new JSZip();
    zip.loadAsync(fileText).then(function (content) {
        const doc = new window.docxtemplater();
        doc.loadZip(content);
        const parsedText = doc.getFullText();
        initText(parsedText);
    });
}

// Function to parse TXT files
function parseTXT(fileText) {
    initText(fileText);
}

function initText(text) {
    const textLines = text.split("\n");
    textLines.forEach((line) => {
        line = line.replace(/\s+/g, " ").trim();
        parsedText.push(line);
    });
    addTextToTable();
}

// Function to add parsed text to the table
function addTextToTable() {
    document.getElementById("noTextLoaded").style.display = "none";
    document.getElementById("textTable" + treatmentIndex).style.display = "block";

    // Clear the existing table rows
    const tableBody = document.getElementById("tableBody" + treatmentIndex);
    tableBody.innerHTML = "";

    parsedText.forEach((line, index) => {
        const row = document.createElement("tr");
        const indexCell = document.createElement("td");
        const textCell = document.createElement("td");

        indexCell.textContent = index;
        textCell.textContent = line;

        row.appendChild(indexCell);
        row.appendChild(textCell);
        tableBody.appendChild(row);
    });
}

function parseTable() {
    const removeFilter = document.getElementById("remove-filter" + treatmentIndex).value;
    const parseOutFilter = document.getElementById("parse-out-filter" + treatmentIndex).value;
    const findFilter = document.getElementById("find-filter" + treatmentIndex).value;
    const replaceFilter = document.getElementById("replace-filter" + treatmentIndex).value;

    if (removeFilter || parseOutFilter || (findFilter && replaceFilter)) {
        addTab();
        const re = new RegExp(removeFilter, "g");
        if (removeFilter) {
            parsedText.forEach((line, index) => {
                parsedText[index] = line.replace(re, "");
            });
        }
        addTextToTable();
    } else {
        alert("Please enter a filter to parse the text.");
    }
}

function addTab() {
    treatmentIndex++;
    
    // Set all tabs to non-active
    const activeTab = document.querySelectorAll("a.nav-link.active");
    activeTab.forEach((tab) => {
        tab.classList.remove("active");
    });

    // Create new active tab
    const tabList = document.getElementById("tabList");
    const newTab = `
        <li class="nav-item">
            <a class="nav-link active" href="#treatment${treatmentIndex}" data-toggle="tab">${treatmentIndex}</a>
        </li>
    `;
    tabList.innerHTML += newTab;

    // Set all content containers to non-active
    const allContentContainers = document.querySelectorAll(".content-container.active");
    allContentContainers.forEach((container) => {
        container.classList.remove("show");
        container.classList.remove("active");
    });

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
                  <th>Index</th>
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
            <input type="text" class="form-control bg-dark text-white" id="remove-filter${treatmentIndex}" placeholder="Enter text to remove" data-treatment-index="${treatmentIndex}" oninput="removePreview(event);"/>
          </div>
          <div class="col-md-6">
            <label for="parse-out-filter${treatmentIndex}" class="filter-label">Parse out:</label>
            <input type="text" class="form-control bg-dark text-white" id="parse-out-filter${treatmentIndex}" placeholder="Enter text to parse out" />
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-6">
            <label for="find-filter${treatmentIndex}" class="filter-label">Find:</label>
            <input type="text" class="form-control bg-dark text-white" id="find-filter${treatmentIndex}" placeholder="Enter text to find" />
          </div>
          <div class="col-md-6">
            <label for="replace-filter${treatmentIndex}" class="filter-label">Replace:</label>
            <input type="text" class="form-control bg-dark text-white" id="replace-filter${treatmentIndex}" placeholder="Enter replacement text" />
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <button type="button" id="parseButton${treatmentIndex}" class="btn btn-primary mr-2" onclick="parseTable();">Parse</button>
        </div>
      </div>
    </div>
    `
    mainContainer.innerHTML += newContentContainer;
}
