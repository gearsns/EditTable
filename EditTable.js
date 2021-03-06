const editTableStyle = `div.EditTable {
    left: 0;
    top: 0;
    margin: 0;
    padding: 0;
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
}

div.sticky_table {
    background-color: rgba(255, 255, 255, 1.0);
    position: relative;
    margin: 0;
    overflow: scroll;
    height: 100%;
}

table.sticky_table {
    padding: 0;
    margin: 0;
    border: 0;
    border-collapse: collapse;
    font-size: 1.1rem;
    overflow: auto;
}

table.sticky_table thead th {
    position: -webkit-sticky;
    position: sticky;
    top: 0;
    z-index: 10;
}

table.sticky_table th:first-child {
    position: -webkit-sticky;
    position: sticky;
    text-align: center;
    left: 0;
}

table.sticky_table thead th:first-child {
    z-index: 20;
}

thead th {
    background: #444;
    color: #fff;
    border-right: 1px solid #aaa;
    border-bottom: 1px solid #aaa;
    white-space: nowrap;
    text-align: left;
    padding-right: 0.5em;
    padding-left: 0.5em;
}

tbody {
    background: #ffffff;
}

tbody th,
tbody td {
    padding-right: 0.5em;
    padding-left: 0.5em;
    white-space: nowrap;
    color: #333;
    border-right: 1px solid #aaa;
    border-bottom: 1px solid #aaa;
}

thead th.current,
tbody th.current {
    background-color : #222;
}

th::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 1px;
    background-color: #aaa;
    left: 0;
    bottom: -1px;
}

tbody th {
    background: #444;
    color: #fff;
}

table.sticky_table tbody th:first-child {
    position: -webkit-sticky;
    position: sticky;
    left: 0;
    z-index: 9;
} 

tbody tr:nth-child(even) td {
    background: #fff;
}

tbody tr:nth-child(odd) td {
    background: #f8f8f8;
}

#bk_area {
    position: absolute;
    width: 0;
    height: 0;
    z-index: 5;
}

#text_area {
    position: absolute;
    width: 0;
    height: 0;
    z-index: 4;
    overflow: hidden;
    margin: -1px 0 0 -1px;
    padding: 0;
}

#text {
    position: absolute;
	left: 0;
	top: 0;
    width: 100%;
    height: 100%;
    border: none;
    margin: 0;
    padding: 0;
    resize: none;
	overflow: hidden;
}

#text:focus {
    outline: none;
}

#cursor {
    position: absolute;
    border: 2px solid #488;
    padding: 0;
    margin-left: -2px;
    margin-top: -2px;
    z-index: 7;
}

#selection {
    position: absolute;
    border: 1px solid #488;
    padding: 0;
    margin-left: -1px;
    margin-top: -1px;
    z-index: 6;
	background-color: rgba(200,255,255,0.2)
}

#text_dummy {
	overflow: hidden;
	visibility: hidden;
	white-space: pre;
}
`;

class EditTableElement extends HTMLElement {
	constructor() {
		super();
		this.options = { newRow: false };
		this.shadow = this.attachShadow({ mode: 'open' });
		this.curRow = 0;
		this.curCol = 1;
		this.curSelection = { col: -1, row: -1, col_o: -1, row_o: -1 };
		this.bEditing = false;
		this.undoData = [];
		this.redoData = [];
		this.render();
		this.data = [];
		this.headData = [];
		this.mouseSelectionMode = "";
	}
	static get observedAttributes() {
		return ["new-row"];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "new-row") {
			this.options.newRow = newValue;
		}
	}
	render = () => {
		this.mainElement = document.createElement("div");
		this.mainElement.className = "EditTable";
		this.mainElement.innerHTML = `
		<div id='main' class='sticky_table'>
		<div id="bk_area"><div id="text_area"><div id="text_dummy" aria-hidden="true"></div><textarea id="text"></textarea></div><div id="cursor"></div><div id="selection"></div></div>
		<table id='table' class='sticky_table'><thead id='et_header'></thead><tbody id='et_body'></tbody></table>
		</div>`;
		this.shadow.appendChild(this.mainElement);
		if (this.shadowRoot.adoptedStyleSheets) {
			const css = new CSSStyleSheet()
			css.replaceSync(editTableStyle);
			this.shadowRoot.adoptedStyleSheets = [css]
		} else { // For Firefox
			const styles = document.createElement("style");
			styles.textContent = editTableStyle;
			this.shadow.appendChild(styles);
		}
		this.emain = this.shadow.getElementById("main");
		this.etable = this.shadow.getElementById("table");
		this.ethead = this.shadow.getElementById("et_header");
		this.etbody = this.shadow.getElementById("et_body");
		this.ecursor = this.shadow.getElementById("cursor");
		this.eselection = this.shadow.getElementById("selection");
		this.etext_area = this.shadow.getElementById("text_area");
		this.etext = this.shadow.getElementById("text");
		this.etext_dummy = this.shadow.getElementById("text_dummy");
		this.etext.focus();
		this.#setEvent();
	}
	#pushHistory = (type, x, y, old_val, new_val) => {
		if (y === undefined) { y = this.curRow; }
		if (x === undefined) { x = this.curCol; }
		this.undoData.push([type, x, y, old_val, new_val]);
		this.redoData = [];
	}
	canUndo = () => this.undoData.length > 0;
	canRedo = () => this.redoData.length > 0;

	setSelection = (col, row, col_o, row_o) => {
		const etbody = this.etbody;
		if (row < 0) {
			row = 0;
		} else if (row >= etbody.rows.length) {
			row = etbody.rows.length - 1;
		}
		const erow = etbody.rows[row];
		if (col < 1) {
			col = 1;
		} else if (col >= erow.cells.length) {
			col = erow.cells.length - 1;
		}
		//
		if (row_o === undefined) {
			this.curSelection.row_o = this.curRow;
		} else {
			if (row_o < 0) {
				row_o = etbody.rows.length - 1;
			}
			this.curSelection.row_o = row_o;
		}
		if (col_o === undefined) {
			this.curSelection.col_o = this.curCol;
		} else {
			if (col_o < 0) {
				col_o = etbody.rows[row_o].cells.length - 1;
			}
			this.curSelection.col_o = col_o;
		}
		this.curSelection.col = col;
		this.curSelection.row = row;
		///
		let left = this.curSelection.col_o;
		let right = this.curSelection.col;
		let top = this.curSelection.row_o;
		let bottom = this.curSelection.row;
		if (left > right) {
			[left, right] = [right, left];
		}
		if (top > bottom) {
			[top, bottom] = [bottom, top];
		}
		//
		const etable = this.etable;
		for (const e of [...etable.getElementsByClassName("current")]) {
			e.className = "";
		}
		for (let i = top; i <= bottom; ++i) {
			const e = etbody.rows[i].cells[0];
			e.className = "current";
		}
		const ethead = this.ethead;
		for (let i = left; i <= right; ++i) {
			const e = ethead.rows[0].cells[i];
			e.className = "current";
		}
		//
		const eselection = this.eselection;
		if (left === right && top === bottom) {
			eselection.style.display = "none";
			return;
		}
		eselection.style.display = "block";
		const cell1 = this.getCell(left, top);
		const cell2 = this.getCell(right, bottom);
		const emain = this.emain;
		const rect_main = emain.getBoundingClientRect();
		const rect_cell1 = cell1.getBoundingClientRect();
		const rect_cell2 = cell2.getBoundingClientRect();
		let zleft = Math.ceil(rect_cell1.left - rect_main.left + emain.scrollLeft);
		let ztop = Math.ceil(rect_cell1.top - rect_main.top + emain.scrollTop);
		let zright = Math.ceil(rect_cell2.left - rect_main.left + emain.scrollLeft + cell2.clientWidth);
		let zbottom = Math.ceil(rect_cell2.top - rect_main.top + emain.scrollTop + cell2.clientHeight);
		eselection.style.left = zleft + "px";
		eselection.style.top = ztop + "px";
		eselection.style.width = (zright - zleft) + "px";
		eselection.style.height = (zbottom - ztop) + "px";

		if (col_o === undefined && row_o === undefined) {
			this.#scrollBy(col, row);
		}
	}
	#scrollBy = (col, row) => {
		const emain = this.emain;
		const etbody = this.etbody;
		const erow = etbody.rows[row];
		const cell = this.getCell(col, row);
		if (!cell) {
			return;
		}
		let scrollY = 0;
		let scrollX = 0;
		if (emain.scrollTop + etbody.offsetTop > cell.offsetTop) {
			scrollY = cell.offsetTop - (emain.scrollTop + etbody.offsetTop);
		} else if (emain.scrollTop + emain.clientHeight < cell.offsetTop + cell.offsetHeight) {
			scrollY = cell.offsetTop + cell.offsetHeight - (emain.scrollTop + emain.clientHeight);
		}
		if (emain.scrollLeft + erow.cells[1].offsetLeft > cell.offsetLeft) {
			scrollX = cell.offsetLeft - (emain.scrollLeft + erow.cells[1].offsetLeft);
		} else if (emain.scrollLeft + emain.clientWidth < cell.offsetLeft + cell.offsetWidth) {
			scrollX = cell.offsetLeft + cell.offsetWidth - (emain.scrollLeft + emain.clientWidth);
		}
		if (scrollX != 0 || scrollY != 0) {
			emain.scrollBy(scrollX, scrollY);
		}
	}
	setCursor = (col, row) => {
		const ecursor = this.ecursor;
		const etbody = this.etbody;
		if (row < 0) {
			row = 0;
		} else if (row >= etbody.rows.length) {
			row = etbody.rows.length - 1;
		}
		const erow = etbody.rows[row];
		if (col < 1) {
			col = 1;
		} else if (col >= erow.cells.length) {
			col = erow.cells.length - 1;
		}
		const cell = erow.cells[col];
		ecursor.style.width = cell.clientWidth + "px";
		ecursor.style.height = cell.clientHeight + "px";
		const emain = this.emain;
		const rect_main = emain.getBoundingClientRect();
		const rect_cell = cell.getBoundingClientRect();
		ecursor.style.left = Math.ceil(rect_cell.left - rect_main.left + emain.scrollLeft) + "px";
		ecursor.style.top = Math.ceil(rect_cell.top - rect_main.top + emain.scrollTop) + "px";
		this.#scrollBy(col, row);
		this.curCol = col;
		this.curRow = row;
		this.setSelection(col, row);
		this.etext.focus();
	}
	#copyStyle = (ef, et) => {
		let style = window.getComputedStyle(ef);
		et.style.padding = style.padding;
		if (style.font) {
			et.style.font = style.font;
			et.style.fontSize = style.fontSize;
		} else { // For Firefox
			et.style.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.lineHeight} ${style.fontFamily} `;
			et.style.marginLeft = "3px";
			et.style.marginRight = "3px";
		}
	}
	beginEditing = () => {
		this.bEditing = true;
		const etext_area = this.etext_area;
		const etbody = this.etbody;
		const etext = this.etext;
		const erow = etbody.rows[this.curRow];
		const cell = erow.cells[this.curCol];
		etext_area.style.left = cell.offsetLeft + "px";
		etext_area.style.top = cell.offsetTop + "px";
		etext_area.style.width = "auto";
		etext_area.style.minWidth = (cell.offsetWidth + 2) + "px";
		etext_area.style.height = "auto";
		etext_area.style.minHeight = (cell.offsetHeight + 2) + "px";
		this.#copyStyle(cell, etext);
		etext.value = "";
		const etext_dummy = this.etext_dummy;
		this.#copyStyle(etext, etext_dummy);
		etext_dummy.textContent = etext.value + "\u200b";
		etext.focus();
	}
	finishEditing = (noupdate) => {
		if (!this.bEditing) {
			return;
		}
		const etext_area = this.etext_area;
		etext_area.style.width = 0;
		etext_area.style.height = 0;
		etext_area.style.minWidth = 0;
		etext_area.style.minHeight = 0;
		if (noupdate !== false) {
			this.setCellText(this.curCol, this.curRow, this.etext.value);
			this.setCursor(this.curCol, this.curRow);
		}
		this.bEditing = false;
	}
	getCell = (col, row) => {
		if (row === undefined) { row = this.curRow; }
		if (col === undefined) { col = this.curCol; }
		const etbody = this.etbody;
		if (row < 0 || row >= etbody.rows.length) {
			return null;
		}
		const erow = etbody.rows[row];
		if (col < 1 || col >= erow.cells.length) {
			return null;
		}
		return erow.cells[col];
	}
	getCellWithHead = (col, row) => {
		if (row === undefined) { row = this.curRow; }
		if (col === undefined) { col = this.curCol; }
		const etbody = this.etbody;
		if (row < 0 || row >= etbody.rows.length) {
			return null;
		}
		const erow = etbody.rows[row];
		if (col < 0 || col >= erow.cells.length) {
			return null;
		}
		return erow.cells[col];
	}
	#refreshHeader = () => {
		this.ethead.style.visibility = "hidden";
		setTimeout(() => {
			this.ethead.style.visibility = "visible";
		}, 0);
	}
	setCellText = (col, row, val, noHiistory) => {
		const cell = this.getCell(col, row);
		const w = cell.offsetWidth;
		if (noHiistory) {
			cell.innerText = val;
		} else {
			this.#pushHistory("begin");
			this.#pushHistory("setText", col, row, this.data[row][col - 1], val);
			cell.innerText = val;
			this.data[row][col - 1] = val;
			if (this.options.newRow) {
				if (this.data.length - 1 === row) {
					this.insertRow(row + 1);
				}
			}
			this.#pushHistory("end");
		}
		if (w !== cell.offsetWidth) {
			this.#refreshHeader();
		}
	}
	getCellText = (col, row) => {
		if (row === undefined) { row = this.curRow; }
		if (col === undefined) { col = this.curCol; }
		return this.data[row][col - 1];
	}
	#bulkSetText = (data, noHiistory) => {
		const etbody = this.etbody;
		let redoData = [];
		let pre_row = -1;
		let ecells = null;
		let badd_row = false;
		if (!noHiistory && this.options.newRow) {
			let max_row = -1;
			for (const item of data) {
				if (max_row < item.row) {
					max_row = item.row;
				}
			}
			if (this.data.length - 1 <= max_row) {
				badd_row = true;
				this.#pushHistory("begin");
				this.insertRow(this.data.length, max_row - this.data.length + 2);
			}
		}
		for (const item of data) {
			if (pre_row !== item.row) {
				pre_row = item.row;
				ecells = etbody.rows[item.row].cells;
			}
			redoData.push({ row: item.row, col: item.col, value: this.data[item.row][item.col - 1] });
			this.data[item.row][item.col - 1] = item.value;
			ecells[item.col].innerText = item.value;
		}
		if (!noHiistory) {
			this.#pushHistory("bulkSetText", this.curCol, this.curRow, redoData, data);
			if (badd_row) {
				this.#pushHistory("end");
			}
		}
	}
	dupCellText = () => {
		if (this.curSelection.row === this.curSelection.row_o) {
			return;
		}
		let col1 = this.curSelection.col_o;
		let col2 = this.curSelection.col;
		let row1 = this.curSelection.row_o;
		let row2 = this.curSelection.row;
		if (col1 > col2) {
			[col1, col2] = [col2, col1];
		}
		if (row1 > row2) {
			[row1, row2] = [row2, row1];
		}
		let data = [];
		for (let row = row1 + 1; row <= row2; ++row) {
			for (let col = col1; col <= col2; ++col) {
				data.push({ row: row, col: col, value: this.data[row1][col - 1] });
			}
		}
		this.#bulkSetText(data);
		this.#refreshHeader();
		this.setCursor(this.curCol, this.curRow);
		this.setSelection(this.curSelection.col, this.curSelection.row, this.curSelection.col_o, this.curSelection.row_o);
	}
	clearCell = () => {
		let col1 = this.curSelection.col_o;
		let col2 = this.curSelection.col;
		let row1 = this.curSelection.row_o;
		let row2 = this.curSelection.row;
		if (col1 > col2) {
			[col1, col2] = [col2, col1];
		}
		if (row1 > row2) {
			[row1, row2] = [row2, row1];
		}
		let data = [];
		for (let row = row1; row <= row2; ++row) {
			for (let col = col1; col <= col2; ++col) {
				data.push({ row: row, col: col, value: "" });
			}
		}
		this.#bulkSetText(data);
		this.#refreshHeader();
		this.setCursor(this.curCol, this.curRow);
		this.setSelection(this.curSelection.col, this.curSelection.row, this.curSelection.col_o, this.curSelection.row_o);
	}
	insertRow = (row, num, noHiistory) => {
		if (num === undefined) {
			num = 1;
		}
		if (this.curRow >= row) {
			++this.curRow;
		}
		if (!noHiistory) {
			this.#pushHistory("insertRow", this.curCol, this.curRow, row, num);
		}
		const ethead = this.ethead;
		const len = ethead.rows[0].cells.length - 1;
		let html_arr = [];
		let data = [];
		html_arr.push(`<th>${row}`);
		for (let col = 0; col < len; ++col) {
			html_arr.push("<td>");
			data.push("");
		}
		const etable = this.etable;
		for (let i = 0; i < num; ++i) {
			const el = etable.insertRow(row + 1 + i);
			this.data.splice(row + i, 0, data);
			el.innerHTML = html_arr.join("");
		}
		this.#renumberingRow(row);
		this.setCursor(this.curCol, this.curRow);
		this.setSelection(this.curSelection.col, this.curSelection.row, this.curSelection.col_o, this.curSelection.row_o);
	}
	#renumberingRow = row => {
		const etbody = this.etbody;
		for (; row < etbody.rows.length; ++row) {
			etbody.rows[row].cells[0].innerText = row + 1;
		}
	}
	deleteRow = (row, num, noHiistory) => {
		if (num === undefined) {
			num = 1;
		}
		if (num >= this.data.length) {
			return;
		}
		const etable = this.etable;
		let data = [];
		for (let i = 0; i < num; ++i) {
			let col = 0;
			for (const item of this.data[row + i]) {
				++col;
				data.push({ row: row + i, col: col, value: item });
			}
			etable.deleteRow(row + 1);
		}
		this.data.splice(row, num);
		if (!noHiistory) {
			this.#pushHistory("deleteRow", this.curCol, this.curRow, { row: row, num: num }, data);
		}
		this.#renumberingRow(row);
		this.setCursor(this.curCol, this.curRow);
		this.setSelection(this.curSelection.col, this.curSelection.row, this.curSelection.col_o, this.curSelection.row_o);
	}
	//
	getData = () => [...this.data];
	undo = (cnt) => {
		if (this.undoData.length > 0) {
			if (!cnt) { cnt = 0; }
			let data = this.undoData.pop();
			this.redoData.push(data);
			if (data[0] === 'begin') {
				this.setCursor(data[1], data[2]);
				--cnt;
			} else if (data[0] === 'end') {
				this.setCursor(data[1], data[2]);
				++cnt;
			} else if (data[0] === 'setText') {
				this.setCellText(data[1], data[2], data[3], true);
			} else if (data[0] === 'bulkSetText') {
				this.#bulkSetText(data[3], true);
				this.setCursor(data[1], data[2]);
			} else if (data[0] === 'insertRow') {
				this.deleteRow(data[3], data[4], true);
			} else if (data[0] === 'deleteRow') {
				this.insertRow(data[3].row, data[3].num, true);
				this.#bulkSetText(data[4], true);
			}
			if (cnt > 0) {
				this.undo(cnt);
			}
		}
	}
	redo = (cnt) => {
		if (this.redoData.length > 0) {
			if (!cnt) { cnt = 0; }
			let data = this.redoData.pop();
			this.undoData.push(data);
			if (data[0] === 'begin') {
				this.setCursor(data[1], data[2]);
				++cnt;
			} else if (data[0] === 'end') {
				this.setCursor(data[1], data[2]);
				--cnt;
			} else if (data[0] === 'setText') {
				this.setCellText(data[1], data[2], data[4], true);
			} else if (data[0] === 'bulkSetText') {
				this.#bulkSetText(data[4], true);
				this.setCursor(data[1], data[2]);
			} else if (data[0] === 'insertRow') {
				this.insertRow(data[3], data[4], true);
			} else if (data[0] === 'deleteRow') {
				this.deleteRow(data[3].row, data[3].num, true);
			}
			if (cnt > 0) {
				this.redo(cnt);
			}
		}
	}
	// http://liosk.blog103.fc2.com/blog-entry-75.html
	#parseCSV = (text, delim) => {
		if (!delim) delim = ',';
		const tokenizer = new RegExp(delim + '|\r?\n|[^' + delim + '"\r\n][^' + delim + '\r\n]*|"(?:[^"]|"")*"', 'g');

		let record = 0;
		let field = 0;
		let data = [['']];
		let qq = /""/g;
		text.replace(/\r?\n$/, '').replace(tokenizer, function (token) {
			switch (token) {
				case delim:
					data[record][++field] = '';
					break;
				case '\n':
				case '\r\n':
					data[++record] = [''];
					field = 0;
					break;
				default:
					data[record][field] = (token.charAt(0) != '"') ? token : token.slice(1, -1).replace(qq, '"');
			}
		});
		return data;
	}
	#pasteInput = () => {
		let data = [];
		let row = this.curRow;
		for (const line of this.#parseCSV(this.etext.value, "\t")) {
			let col = this.curCol;
			for (const item of line) {
				data.push({ row: row, col: col, value: item });
				++col;
			}
			++row;
		}
		this.#bulkSetText(data);
		this.setCursor(this.curCol, this.curRow);
	}
	#insertText = text => {
		const etext = this.etext;
		let val = etext.value;
		let len = val.length;
		let pos = etext.selectionStart;
		let before = val.substring(0, pos);
		let after = val.substring(pos, len);
		etext.value = before + text + after;
		this.#resizeText();
	}
	#resizeText = () => {
		const etext = this.etext;
		const etext_dummy = this.etext_dummy;
		this.#copyStyle(etext, etext_dummy);
		etext_dummy.textContent = etext.value + "\u200b";
		const rect = this.etext_area.getBoundingClientRect();
		const ecursor = this.ecursor;
		ecursor.style.width = (rect.width - 2) + "px";
		ecursor.style.height = (rect.height - 2) + "px";
	}
	#copyText = () => {
		const etext = this.etext;
		let col1 = this.curSelection.col_o;
		let col2 = this.curSelection.col;
		let row1 = this.curSelection.row_o;
		let row2 = this.curSelection.row;
		if (col1 > col2) {
			[col1, col2] = [col2, col1];
		}
		if (row1 > row2) {
			[row1, row2] = [row2, row1];
		}
		let text_arr = [];
		for (let row = row1; row <= row2; ++row) {
			let line_arr = [];
			for (let col = col1; col <= col2; ++col) {
				let text = this.getCellText(col, row);
				if (text.match(/(?:\r|\n|\t|")/)) {
					text = `"${text.replace(/"/g, "\"")}"`;
				}
				line_arr.push(text);
			}
			text_arr.push(line_arr.join("\t"));
		}
		etext.value = text_arr.join("\r\n");
		etext.select();
		const etext_area = this.etext_area;
		etext_area.style.width = "1px";
		etext_area.style.height = "1px";
		etext_area.style.minWidth = 0;
		etext_area.style.minHeight = 0;
		etext_area.style.left = "-2px";
		etext_area.style.top = "-2px";
	}
	#getKeyString = e => {
		let key = e.key;
		if (key === "Control" || key === "Alt" || key === "Shift") {
			return key;
		}
		if (e.shiftKey) {
			key = `S-${key}`;
		}
		if (e.altKey) {
			key = `Alt-${key}`;
		}
		if (e.ctrlKey) {
			key = `C-${key}`;
		}
		if (e.metaKey) { // For mac
			key = `C-${key}`;
		}
		return key;
	}
	#setEvent = () => {
		const etext = this.etext;
		etext.addEventListener("paste", e => {
			if (!this.bEditing) { // For mac
				this.etext.value = (e.clipboardData || window.clipboardData).getData('text');
				this.#pasteInput();
			}
		});
		etext.addEventListener("keyup", e => {
			if (this.bEditing) {
				this.#resizeText();
			}
		});
		etext.addEventListener("keydown", e => {
			const key = this.#getKeyString(e);
			if (this.bEditing) {
				switch (key) {
					case "Tab":
						this.finishEditing();
						this.setCursor(this.curCol + 1, this.curRow);
						break;
					case "Enter":
						this.finishEditing();
						this.setCursor(this.curCol, this.curRow + 1);
						break;
					case "Alt-Enter":
						this.#insertText("\r\n");
						break;
					case "Escape":
						this.finishEditing(false);
						this.setCursor(this.curCol, this.curRow);
						break;
					default:
						this.#resizeText();
						return;
				}
				e.preventDefault();
			} else {
				switch (key) {
					case "S-ArrowDown":
						this.finishEditing();
						this.setSelection(this.curSelection.col, this.curSelection.row + 1);
						break;
					case "S-ArrowUp":
						this.finishEditing();
						this.setSelection(this.curSelection.col, this.curSelection.row - 1);
						break;
					case "S-ArrowLeft":
						this.finishEditing();
						this.setSelection(this.curSelection.col - 1, this.curSelection.row);
						break;
					case "S-ArrowRight":
						this.finishEditing();
						this.setSelection(this.curSelection.col + 1, this.curSelection.row);
						break;
					case "ArrowDown":
						this.finishEditing();
						this.setCursor(this.curCol, this.curRow + 1);
						break;
					case "ArrowUp":
						this.finishEditing();
						this.setCursor(this.curCol, this.curRow - 1);
						break;
					case "ArrowLeft":
						this.finishEditing();
						this.setCursor(this.curCol - 1, this.curRow);
						break;
					case "ArrowRight":
						this.finishEditing();
						this.setCursor(this.curCol + 1, this.curRow);
						break;
					case "Home":
						this.finishEditing();
						this.setCursor(1, this.curRow);
						break;
					case "End":
						this.finishEditing();
						{
							const erows = this.etbody.rows[this.curRow];
							this.setCursor(erows.cells.length - 1, this.curRow);
						}
						break;
					case "C-Home":
						this.finishEditing();
						this.setCursor(this.curCol, 0);
						break;
					case "C-End":
						this.finishEditing();
						this.setCursor(this.curCol, this.etbody.rows.length - 1);
						break;
					case "S-Home":
						this.finishEditing();
						this.setSelection(1, this.curSelection.row);
						break;
					case "S-End":
						this.finishEditing();
						{
							const erows = this.etbody.rows[this.curSelection.row];
							this.setSelection(erows.cells.length - 1, this.curSelection.row);
						}
						break;
					case "C-S-Home":
						this.finishEditing();
						this.setSelection(this.curSelection.col, 0);
						break;
					case "C-S-End":
						this.finishEditing();
						this.setSelection(this.curSelection.col, this.etbody.rows.length - 1);
						break;
					case "PageUp":
						this.finishEditing();
						{
							const emain = this.emain;
							const etbody = this.etbody;
							const ethead = this.ethead;
							const rows = etbody.rows;
							const cell = this.getCell();
							const rect_head = ethead.getBoundingClientRect();
							const rect_cell = cell.getBoundingClientRect();
							emain.scrollBy(0, -(emain.clientHeight - rect_head.height));
							const y = rect_cell.y + rect_cell.height;
							for (let row = this.curRow - 1; row > 0; --row) {
								const item = rows[row];
								const rect_item = item.getBoundingClientRect();
								if (rect_item.y <= y && rect_item.y + rect_item.height >= y) {
									this.setCursor(this.curCol, row);
									break;
								}
							}
						}
						break;
					case "PageDown":
						this.finishEditing();
						{
							const emain = this.emain;
							const rect_main = emain.getBoundingClientRect();
							const etbody = this.etbody;
							const rows = etbody.rows;
							for (let row = this.curRow + 1; row < rows.length; ++row) {
								const item = rows[row];
								const rect_item = item.getBoundingClientRect();
								if (rect_item.y + rect_item.height - rect_main.y > emain.clientHeight) {
									emain.scrollBy(0, emain.clientHeight);
									this.setCursor(this.curCol, row);
									break;
								}
							}
						}
						break;
					case "C-a":
					case "C-A":
						this.setSelection(0, 0, -1, -1);
						break;
					case "C-d":
					case "C-D":
						this.dupCellText();
						break;
					case "C-z":
					case "C-Z":
						this.undo();
						break;
					case "C-y":
					case "C-Y":
						this.redo();
						break;
					case "C-c":
					case "C-C":
						this.#copyText();
						return;
					case "C-v":
					case "C-V":
						{
							const etext = this.etext;
							etext.value = "";
							etext.select();
							const etext_area = this.etext_area;
							etext_area.style.width = "1px";
							etext_area.style.height = "1px";
							etext_area.style.minWidth = 0;
							etext_area.style.minHeight = 0;
							const etbody = this.etbody;
							const row = etbody.rows[this.curRow];
							const cell = row.cells[this.curCol];
							etext_area.style.left = cell.offsetLeft + "px";
							etext_area.style.top = cell.offsetTop + "px";
							return;
						}
						break;
					case "C-S-+":
						this.insertRow(this.curRow, Math.abs(this.curSelection.row - this.curSelection.row_o) + 1);
						break;
					case "C-S-Insert":
						this.insertRow(this.curRow + 1, Math.abs(this.curSelection.row - this.curSelection.row_o) + 1);
						break;
					case "C-S--":
					case "C-S-Delete":
						this.deleteRow(Math.min(this.curSelection.row, this.curSelection.row_o), Math.abs(this.curSelection.row - this.curSelection.row_o) + 1);
						break;
					case "F2":
						{
							const val = this.getCellText();
							this.beginEditing();
							this.etext.value = val;
						}
						break;
					case "Delete":
						this.clearCell();
						break;
					default:
						if (!e.isComposing && !key.match(/\-*Process/) && key.match(/\-*(?:[0-9a-zA-Z][0-9a-zA-Z]+)/)) {
							// ????????????
						} else if (!key.match(/(?:C|Alt)\-/)) {
							this.beginEditing();
						}
						return;
				}
				e.preventDefault();
			}
		});
		this.addEventListener("pointerdown", e => {
			if (e.button === 0) {
				if (this.setPointerCapture) {
					this.setPointerCapture(e.pointerId);
				}
				const emain = this.emain;
				const emain_rect = emain.getBoundingClientRect();
				if (emain_rect.top + emain.clientHeight < e.clientY) {

				} else {
					for (const el of this.shadow.elementsFromPoint(e.clientX, e.clientY)) {
						if (el.tagName !== "TEXTAREA") {
							this.finishEditing();
						}
						if (el.tagName === "TD" || el.tagName === "TH") {
							if (el.cellIndex === 0 && el.parentNode.rowIndex === 0) {
								this.setSelection(0, 0, -1, -1);
								break;
							} else if (el.cellIndex === 0 && el.parentNode.rowIndex > 0) {
								this.mouseSelectionMode = "row";
								this.setCursor(this.curCol, el.parentNode.rowIndex - 1);
								const col = el.parentNode.cells.length - 1;
								this.setSelection(1, el.parentNode.rowIndex - 1, col, el.parentNode.rowIndex - 1);
								break;
							} else if (el.cellIndex > 0 && el.parentNode.rowIndex === 0) {
								this.mouseSelectionMode = "column";
								this.setCursor(el.cellIndex, this.curRow);
								const etbody = this.etbody;
								const rows = etbody.rows;
								this.setSelection(el.cellIndex, 0, el.cellIndex, rows.length - 1);
								break;
							} else if (el.cellIndex > 0 && el.parentNode.rowIndex > 0) {
								this.mouseSelectionMode = "cell";
								if (e.shiftKey) {
									this.setSelection(el.cellIndex, el.parentNode.rowIndex - 1);
								} else {
									this.setCursor(el.cellIndex, el.parentNode.rowIndex - 1);
								}
							}
						}
					}
				}
			}
			e.preventDefault();
		});
		this.addEventListener("pointerup", e => {
			this.mouseSelectionMode = "";
			const el = this.shadow.elementFromPoint(e.clientX, e.clientY);
			if (el != null && el.tagName === "HTML") {
				// Scrollbar????????????????????????????????? releaseCapture?????????
			} else {
				if (this.releasePointerCapture) {
					this.releasePointerCapture(e.pointerId);
				}
			}
		});
		this.addEventListener("pointermove", e => {
			if (this.mouseSelectionMode === "row") {
				const emain = this.emain;
				const emain_rect = emain.getBoundingClientRect();
				if (e.clientY < emain_rect.top) {
					for (let row = this.curSelection.row, count_r = 10; count_r > 0; row--, count_r--) {
						let cell = this.getCellWithHead(0, row);
						if (!cell) {
							break;
						}
						let rect = cell.getBoundingClientRect();
						if (rect.y <= e.clientY && e.clientY <= rect.y + rect.height) {
							this.setSelection(1, row, this.curSelection.col_o, this.curSelection.row_o);
							this.#scrollBy(1, row);
							return;
						}
					}
				} else if (emain_rect.top + emain.clientHeight < e.clientY) {
					for (let row = this.curSelection.row, count_r = 10; count_r > 0; row++, count_r--) {
						let cell = this.getCellWithHead(0, row);
						if (!cell) {
							break;
						}
						let rect = cell.getBoundingClientRect();
						if (rect.y <= e.clientY && e.clientY <= rect.y + rect.height) {
							this.setSelection(1, row, this.curSelection.col_o, this.curSelection.row_o);
							this.#scrollBy(1, row);
							return;
						}
					}
				} else {
					const eheader = this.ethead;
					const ltcell_rect = eheader.rows[0].cells[0].getBoundingClientRect();
					for (const el of this.shadow.elementsFromPoint(ltcell_rect.left, e.clientY)) {
						if (el.tagName === "TD" || el.tagName === "TH") {
							if (el.cellIndex >= 0 && el.parentNode.rowIndex > 0) {
								this.setSelection(1, el.parentNode.rowIndex - 1, this.curSelection.col_o, this.curSelection.row_o);
							}
						}
					}
				}
			} else if (this.mouseSelectionMode === "column") {
				const eheader = this.ethead;
				let col = 0;
				for (const cell of eheader.rows[0].cells) {
					col = cell.cellIndex;
					if (col < 0) {
						continue;
					}
					let rect = cell.getBoundingClientRect();
					if (rect.x <= e.clientX && e.clientX <= rect.x + rect.width) {
						this.setSelection(col, 0, this.curSelection.col_o, this.curSelection.row_o);
						this.#scrollBy(col, 0);
						return;
					} else if (col === 1 && e.clientX < rect.x) {
						this.setSelection(col, 0, this.curSelection.col_o, this.curSelection.row_o);
						this.#scrollBy(col, 0);
						return;
					}
				}
				this.setSelection(col, 0, this.curSelection.col_o, this.curSelection.row_o);
				this.#scrollBy(col, 0);
			} else if (this.mouseSelectionMode === "cell") {
				const emain = this.emain;
				const emain_rect = emain.getBoundingClientRect();
				let scol = Math.max(1, this.curSelection.col - 5);
				if (e.clientY < emain_rect.top) {
					for (let row = this.curSelection.row, count_r = 10; count_r > 0; row--, count_r--) {
						for (let col = scol, count_c = 10; count_c > 0; ++col, count_c--) {
							let cell = this.getCell(col, row);
							if (!cell) {
								break;
							}
							let rect = cell.getBoundingClientRect();
							if (rect.y <= e.clientY && e.clientY <= rect.y + rect.height
								&& rect.x <= e.clientX && e.clientX <= rect.x + rect.width) {
								this.setSelection(col, row);
								return;
							}
						}
					}
				} else if (emain_rect.top + emain.clientHeight < e.clientY) {
					for (let row = this.curSelection.row, count_r = 10; count_r > 0; row++, count_r--) {
						for (let col = scol, count_c = 10; count_c > 0; ++col, count_c--) {
							let cell = this.getCell(col, row);
							if (!cell) {
								break;
							}
							let rect = cell.getBoundingClientRect();
							if (rect.y <= e.clientY && e.clientY <= rect.y + rect.height
								&& rect.x <= e.clientX && e.clientX <= rect.x + rect.width) {
								this.setSelection(col, row);
								return;
							}
						}
					}
				} else {
					for (const el of this.shadow.elementsFromPoint(e.clientX, e.clientY)) {
						if (el.tagName !== "TEXTAREA") {
							this.finishEditing();
						}
						if (el.tagName === "TD" || el.tagName === "TH") {
							if (el.cellIndex > 0 && el.parentNode.rowIndex > 0) {
								this.setSelection(el.cellIndex, el.parentNode.rowIndex - 1);
							}
						}
					}
				}
			}
		});
		this.addEventListener("dblclick", e => {
			this.mouseSelectionMode = "";
			for (const el of this.shadow.elementsFromPoint(e.clientX, e.clientY)) {
				if (el.tagName === "TD" || el.tagName === "TH") {
					if (el.cellIndex > 0 && el.parentNode.rowIndex > 0) {
						this.setCursor(el.cellIndex, el.parentNode.rowIndex - 1);
						this.beginEditing();
						let arr = this.#retrieveCharactersRects(el);
						const x = e.clientX;
						const y = e.clientY;
						let pos = -1;
						for (const idx in arr) {
							const r = arr[idx];
							if (x >= r.rect.left && y >= r.rect.top
								&& x <= r.rect.left + r.rect.width && y <= r.rect.top + r.rect.height) {
								if (x <= r.rect.left + (r.rect.width / 2)) {
									pos = parseInt(idx);
								} else {
									pos = parseInt(idx) + 1;
								}
								break;
							}
						}
						const etext = this.etext;
						etext.value = el.innerText;
						if (pos < 0) {
							pos = etext.value.replace(/ +$/, '').length;
						}
						if (etext.selectionStart) {
							etext.selectionStart = etext.selectionEnd = pos;
						} else {
							const range = etext.createTextRange();
							range.collapse(true);
							range.moveEnd("character", pos);
							range.moveStart("character", pos);
							range.select();
						}
					}
					e.preventDefault();
				}
			}
		});
	}
	#retrieveCharactersRects = (elem) => {
		if (elem.nodeType === elem.TEXT_NODE) {
			const range = elem.ownerDocument.createRange();
			// selectNodeContents????????????????????????Text Node???Range???????????????????????????
			// ????????????offset???????????????
			range.selectNodeContents(elem);
			let current_pos = 0;
			let end_pos = range.endOffset;
			let results = [];
			while (current_pos + 1 <= end_pos) {
				range.setStart(elem, current_pos);
				range.setEnd(elem, current_pos + 1);
				current_pos += 1;
				results.push({ character: range.toString(), rect: range.getBoundingClientRect() });
			}
			range.detach();
			return results;
		} else {
			let results = [];
			for (let i = 0; i < elem.childNodes.length; i++) {
				results.push(this.#retrieveCharactersRects(elem.childNodes[i]));
			}
			// ???????????????????????????????????????
			return Array.prototype.concat.apply([], results);
		}
	}
	setHeader = (header) => {
		this.headData = [...header];
		let str = "<TH>";
		for (const item of header) {
			str += `<TH>${item}`;
		}
		this.ethead.innerHTML = str;
	}
	setData = (data) => {
		this.data = [...data];
		if (this.options.newRow || this.data.length === 0) {
			let line = [];
			line[this.headData.length - 1] = "";
			line.fill("");
			this.data.push(line);
		}
		this.undoData = [];
		this.redoData = [];
		let str = "";
		let line_no = 0;
		for (const line of this.data) {
			line_no++;
			str += `<TR><TH>${line_no}`;
			for (const item of line) {
				str += `<TD>${item}`;
			}
		}
		this.etbody.innerHTML = str;
		this.setCursor(this.curCol, this.curRow);
	}
	///
	static #regUnescapeHTML = null;
	static #UnescapeHTMLCharacterReference = { '<br>': '\n', '&nbsp;': ' ', '&quot;': '"', '&amp;': '&', '&#39;': '\'', '&lt;': '<', '&gt;': '>' };
	static #unescapeHTML(text) {
		if (!EditTableElement.#regUnescapeHTML) { // For Safari
			let keylist = [];
			for (const key in EditTableElement.#UnescapeHTMLCharacterReference) {
				keylist.push(key);
			}
			EditTableElement.#regUnescapeHTML = new RegExp(keylist.join("|"), 'ig');
		}
		if (text) {
			return text.replace(EditTableElement.#regUnescapeHTML,
				ch => EditTableElement.#UnescapeHTMLCharacterReference[ch.toLowerCase()]
			);
		} else {
			return '';
		}
	}
	static #regEscapeHTML = null;
	static #EscapeHTMLCharacterReference = { '\r\n': '<br>', '\r': '<br>', '\n': '<br>', ' ': '&nbsp;', '"': '&quot;', '&': '&amp;', '\'': '&#39;', '<': '&lt;', '>': '&gt;' };
	static #escapeHTML(text) {
		if (!EditTableElement.#regEscapeHTML) { // For Safari
			let keylist = [];
			for (const key in EditTableElement.#EscapeHTMLCharacterReference) {
				keylist.push(key);
			}
			EditTableElement.#regEscapeHTML = new RegExp(keylist.join("|"), 'ig');
		}
		return text.replace(EditTableElement.#regEscapeHTML,
			ch => EditTableElement.#EscapeHTMLCharacterReference[ch]
		);
	}
}
customElements.define('edit-table', EditTableElement);