/**!
* TableSorter 3.0.0 - Client-side table sorting with ease!
* @requires jQuery v1.2.6+
*
* Copyright (c) 2007 Christian Bach
* Examples and docs at: http://tablesorter.com
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*
* @type jQuery
* @name tablesorter
* @cat Plugins/Tablesorter
* @author Christian Bach/christian.bach@polyester.se
* @contributor Rob Garrison/https://github.com/Mottie/tablesorter
*/
/*jshint browser:true, jquery:true, unused:false, expr: true */
/*global console:false, alert:false */
!(function($) {
"use strict";
var ts = $.tablesorter = $.extend({}, $.tablesorter, {

	version: "3.0.0 beta",

	defaults: {

		// *** appearance
		theme            : 'default',  // adds tablesorter-{theme} to the table for styling
		widthFixed       : false,      // adds colgroup to fix widths of columns
		showProcessing   : false,      // show an indeterminate timer icon in the header when the table is sorted or filtered.

		headerTemplate   : '{content}',// header layout template (HTML ok); {content} = innerHTML, {icon} = <i/> (class from cssIcon)
		onRenderTemplate : null,       // function(index, template){ return template; }, (template is a string)
		onRenderHeader   : null,       // function(index){}, (nothing to return)

		// *** functionality
		cancelSelection  : true,       // prevent text selection in the header
		dateFormat       : 'mmddyyyy', // other options: "ddmmyyy" or "yyyymmdd"
		sortMultiSortKey : 'shiftKey', // key used to select additional columns
		sortResetKey     : 'ctrlKey',  // key used to remove sorting on a column
		usNumberFormat   : true,       // false for German "1.234.567,89" or French "1 234 567,89"
		delayInit        : false,      // if false, the parsed table contents will not update until the first sort
		serverSideSorting: false,      // if true, server-side sorting should be performed because client-side sorting will be disabled, but the ui and events will still be used.

		// *** sort options
		headers          : {},         // set sorter, string, empty, locked order, sortInitialOrder, filter, etc.
		ignoreCase       : true,       // ignore case while sorting
		sortForce        : null,       // column(s) first sorted; always applied
		sortList         : [],         // Initial sort order; applied initially; updated when manually sorted
		sortAppend       : null,       // column(s) sorted last; always applied

		sortInitialOrder : 'asc',      // sort direction on first click
		sortLocaleCompare: false,      // replace equivalent character (accented characters)
		sortReset        : false,      // third click on the header will reset column to default - unsorted
		sortRestart      : false,      // restart sort to "sortInitialOrder" when clicking on previously unsorted columns

		emptyTo          : 'bottom',   // sort empty cell to bottom, top, none, zero
		stringTo         : 'max',      // sort strings in numerical column as max, min, top, bottom, zero
		textExtraction   : 'simple',   // text extraction method/function - function(node, table, cellIndex){}
		textSorter       : null,       // choose overall or specific column sorter function(a, b, direction, table, columnIndex) [alt: ts.sort.text]
		numberSorter     : null,       // choose overall numeric sorter function(a, b, direction, maxColumnValue)

		// *** widget options
		widgets: [],                   // method to add widgets, e.g. widgets: ['zebra']
		widgetOptions    : {
			zebra : [ 'even', 'odd' ]    // zebra widget alternating row class names
		},
		initWidgets      : true,       // apply widgets on tablesorter initialization

		// *** callbacks
		initialized      : null,       // function(table){},

		// *** extra css class names
		tableClass       : '',
		cssAsc           : '',
		cssDesc          : '',
		cssHeader        : '',
		cssHeaderRow     : '',
		cssProcessing    : '', // processing icon applied to header during sort/filter

		cssChildRow      : 'tablesorter-childRow', // class name indiciating that a row is to be attached to the its parent 
		cssIcon          : 'tablesorter-icon',     //  if this class exists, a <i> will be added to the header automatically
		cssInfoBlock     : 'tablesorter-infoOnly', // don't sort tbody with this class name (only one class name allowed here!)

		// *** selectors
		selectorSort     : 'th, td',   // jQuery selector of content within headers that is clickable to trigger a sort
		selectorRemove   : '.remove-me',

		// *** advanced
		debug            : false,

		// *** Internal variables
		headerList: [],
		empties: {},
		strings: {},
		parsers: []

	},

	// internal css classes - these will ALWAYS be added to
	// the table and MUST only contain one class name - fixes #381
	css: {
		table      : 'tablesorter',
		childRow   : 'tablesorter-childRow',
		header     : 'tablesorter-header',
		headerRow  : 'tablesorter-headerRow',
		icon       : 'tablesorter-icon',
		info       : 'tablesorter-infoOnly',
		processing : 'tablesorter-processing',
		sortAsc    : 'tablesorter-headerAsc',
		sortDesc   : 'tablesorter-headerDesc'
	},

	regex: {
		// parsers (complex format regex only)
		nonDigit    : /[^\w,. \-()]/g,
		url         : /(https?|ftp|file):\/\//,
		shortDate   : /(\d{1,2})[\/\s](\d{1,2})[\/\s](\d{4})/,
		shortDateYr : /(\d{4})[\/\s](\d{1,2})[\/\s](\d{1,2})/,

		// natural sort chunk/tokenize numbers & letters 
		chunk : /(^([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)?$|^0x[0-9a-f]+$|\d+)/gi,
		// natural sort hex
		hex   : /^0x[0-9a-f]+$/i
	},

	widget: {

		// previously addWidget
		add: function(widget) {
			ts.widgets.push(widget);
		},

		// previously getWidgetById
		get: function(name) {
			var i, w, l = ts.widgets.length;
			for (i = 0; i < l; i++) {
				w = ts.widgets[i];
				if (w && w.hasOwnProperty('id') && w.id.toLowerCase() === name.toLowerCase()) {
					return w;
				}
			}
		},

		// previously applyWidget
		apply: function(table, init) {
			table = $(table)[0]; // in case this is called externally
			var c = table.config,
				wo = c.widgetOptions,
				widgets = [],
				time, w, wd;
			if (c.debug) { time = new Date(); }
			if (c.widgets.length) {
				// ensure unique widget ids
				c.widgets = $.grep(c.widgets, function(v, k){
					return $.inArray(v, c.widgets) === k;
				});
				// build widget array & add priority as needed
				$.each(c.widgets || [], function(i,n){
					wd = tsw.get(n);
					if (wd && wd.id) {
						// set priority to 10 if not defined
						if (!wd.priority) { wd.priority = 10; }
						widgets[i] = wd;
					}
				});
				// sort widgets by priority
				widgets.sort(function(a, b){
					return a.priority < b.priority ? -1 : a.priority === b.priority ? 0 : 1;
				});
				// add/update selected widgets
				$.each(widgets, function(i,w){
					if (w) {
						if (init || !(c.widgetInit[w.id])) {
							if (w.hasOwnProperty('options')) {
								wo = table.config.widgetOptions = $.extend( true, {}, w.options, wo );
								c.widgetInit[w.id] = true;
							}
							if (w.hasOwnProperty('init')) {
								w.init(table, w, c, wo);
							}
						}
						if (!init && w.hasOwnProperty('format')) {
							w.format(table, c, wo, false);
						}
					}
				});
			}
			if (c.debug) {
				w = c.widgets.length;
				benchmark("Completed " + (init === true ? "initializing " : "applying ") + w + " widget" + (w !== 1 ? "s" : ""), time);
			}
		},

		// previously refreshWidgets
		refresh: function(table, doAll, dontapply) {
			table = $(table)[0]; // see issue #243
			var i, c = table.config,
				cw = c.widgets,
				w = ts.widgets, l = w.length;
			// remove previous widgets
			for (i = 0; i < l; i++){
				if ( w[i] && w[i].id && (doAll || $.inArray( w[i].id, cw ) < 0) ) {
					if (c.debug) { log( 'Refeshing widgets: Removing ' + w[i].id  ); }
					if (w[i].hasOwnProperty('remove')) {
						w[i].remove(table, c, c.widgetOptions);
						c.widgetInit[w[i].id] = false;
					}
				}
			}
			if (dontapply !== true) {
				tsw.apply(table, doAll);
			}
		},

		update: function(table, resort, callback){
			// update sorting (if enabled/disabled)
			tss.updateHeader(table);
			tss.update(table, resort, callback);
		}

	},

	parser: {

		// previously addParser
		add: function(parser) {
			var i, l = ts.parsers.length, a = true;
			for (i = 0; i < l; i++) {
				if (ts.parsers[i].id.toLowerCase() === parser.id.toLowerCase()) {
					a = false;
				}
			}
			if (a) {
				ts.parsers.push(parser);
			}
		},

		// previously detectParserForColumn
		detect: function(table, rows, rowIndex, cellIndex) {
			var cur,
			i = ts.parsers.length,
			node = false,
			nodeValue = '',
			keepLooking = true;
			while (nodeValue === '' && keepLooking) {
				rowIndex++;
				if (rows[rowIndex]) {
					node = rows[rowIndex].cells[cellIndex];
					nodeValue = getText(table, node, cellIndex);
					if (table.config.debug) {
						log('Checking if value was empty on row ' + rowIndex + ', column: ' + cellIndex + ': "' + nodeValue + '"');
					}
				} else {
					keepLooking = false;
				}
			}
			while (--i >= 0) {
				cur = ts.parsers[i];
				// ignore the default text parser because it will always be true
				if (cur && cur.id !== 'text' && cur.is && cur.is(nodeValue, table, node)) {
					return cur;
				}
			}
			// nothing found, return the generic parser (text)
			return tsp.get('text');
		},

		// previously getParserById
		get: function(name) {
			var i, l = ts.parsers.length;
			for (i = 0; i < l; i++) {
				if (ts.parsers[i].id.toLowerCase() === (name.toString()).toLowerCase()) {
					return ts.parsers[i];
				}
			}
			return false;
		}

	},

	build: {

		// previously buildHeaders
		headers: function(table) {
			var ch, $t, h, i, t, lock, time, that,
			header_index = tsu.computeThIndexes(table), 
				c = table.config;
			c.headerList = [];
			c.headerContent = [];
			if (c.debug) {
				time = new Date();
			}
			i = c.cssIcon ? '<i class="' + c.cssIcon + ' ' + ts.css.icon + '"></i>' : ''; // add icon if cssIcon option exists
			c.$headers = $(table).children('thead').children('tr').children('th, td').each(function(index) {
				that = this;
				$t = $(that);
				ch = c.headers[index];
				c.headerContent[index] = $t.html(); // save original header content
				// set up header template
				t = c.headerTemplate.replace(/\{content\}/g, $t.html()).replace(/\{icon\}/g, i);
				if (c.onRenderTemplate) {
					h = c.onRenderTemplate.apply($t, [index, t]);
					if (h && typeof h === 'string') { t = h; } // only change t if something is returned
				}
				$t.html('<div class="tablesorter-header-inner">' + t + '</div>'); // faster than wrapInner

				if (c.onRenderHeader) { c.onRenderHeader.apply($t, [index]); }

				that.column = header_index[that.parentNode.rowIndex + "-" + that.cellIndex];
				that.order = tss.formatOrder( tsu.getData($t, ch, 'sortInitialOrder') || c.sortInitialOrder ) ? [1,0,2] : [0,1,2];
				that.count = -1; // set to -1 because clicking on the header automatically adds one
				that.lockedOrder = false;
				lock = tsu.getData($t, ch, 'lockedOrder') || false;
				if (typeof lock !== 'undefined' && lock !== false) {
					that.order = that.lockedOrder = tss.formatOrder(lock) ? [1,1,1] : [0,0,0];
				}
				$t.addClass(ts.css.header + ' ' + c.cssHeader);
				// add cell to headerList
				c.headerList[index] = that;
				// add to parent in case there are multiple rows
				$t.parent().addClass(ts.css.headerRow + ' ' + c.cssHeaderRow);
				// allow keyboard cursor to focus on element
				$t.attr("tabindex", 0);
			});
			// enable/disable sorting
			tss.updateHeader(table);
			if (c.debug) {
				benchmark("Built headers:", time);
				log(c.$headers);
			}
		},

		// previously buildParserCache
		parsers: function(table) {
			var c = table.config,
				// update table bodies in case we start with an empty table
				tb = c.$tbodies = c.$table.children('tbody:not(.' + c.cssInfoBlock + ')'),
				rows, list, l, i, h, ch, p, parsersDebug = "";
			if ( tb.length === 0) {
				return c.debug ? log('*Empty table!* Not building a parser cache') : '';
			}
			rows = tb[0].rows;
			if (rows[0]) {
				list = [];
				l = rows[0].cells.length;
				for (i = 0; i < l; i++) {
					// tons of thanks to AnthonyM1229 for working out the following selector (issue #74) to make this work in IE8!
					// More fixes to this selector to work properly in iOS and jQuery 1.8+ (issue #132 & #174)
					h = c.$headers.filter(':not([colspan])');
					h = h.add( c.$headers.filter('[colspan="1"]') ) // ie8 fix
						.filter('[data-column="' + i + '"]').eq(-1);
					ch = c.headers[i];
					// get column parser
					p = tsp.get( tsu.getData(h, ch, 'sorter') );
					// empty cells behaviour
					c.empties[i] = tsu.getData(h, ch, 'empty') || c.emptyTo;
					// text strings behaviour in numerical sorts
					c.strings[i] = tsu.getData(h, ch, 'string') || c.stringTo || 'max';
					if (!p) {
						p = tsp.detect(table, rows, -1, i);
					}
					if (c.debug) {
						parsersDebug += "column:" + i + "; parser:" + p.id + "; string:" + c.strings[i] + '; empty: ' + c.empties[i] + "\n";
					}
					list.push(p);
				}
			}
			if (c.debug) {
				log(parsersDebug);
			}
			c.parsers = list;
		},

		// previously buildCache
		cache: function(table) {
			var totalRows, totalCells, t, v, i, j, k, $row, cols, cache, cacheTime,
			b = table.tBodies,
			c = table.config,
			parsers = c.parsers,
			colMax = [];
			c.cache = {};
			// if no parsers found, return - it's an empty table.
			if (!parsers) {
				return c.debug ? log('*Empty table!* Not building a cache') : '';
			}
			if (c.debug) {
				cacheTime = new Date();
			}
			// processing icon
			if (c.showProcessing) {
				tsu.isProcessing(table, true);
			}
			for (k = 0; k < b.length; k++) {
				cache = c.cache[k] = { row: [], normalized: [] };
				// ignore tbodies with class name from c.cssInfoBlock
				if (!$(b[k]).hasClass(c.cssInfoBlock)) {
					totalRows = (b[k] && b[k].rows.length) || 0;
					totalCells = (b[k].rows[0] && b[k].rows[0].cells.length) || 0;
					for (i = 0; i < totalRows; ++i) {
						/** Add the table data to main data array */
						$row = $(b[k].rows[i]);
						cols = [];
						// if this is a child row, add it to the last row's children and continue to the next row
						if ($row.hasClass(c.cssChildRow)) {
							t = cache.row.length - 1;
							cache.row[t] = cache.row[t].add($row);
							// go to the next for loop
							continue;
						}
						cache.row.push($row);
						for (j = 0; j < totalCells; ++j) {
							t = getText(table, $row[0].cells[j], j);
							// allow parsing if the string is empty, previously parsing would change it to zero,
							// in case the parser needs to extract data from the table cell attributes
							v = parsers[j].format(t, table, $row[0].cells[j], j);
							cols.push(v);
							if ((parsers[j].type || '').toLowerCase() === "numeric") {
								colMax[j] = Math.max(Math.abs(v) || 0, colMax[j] || 0); // determine column max value (ignore sign)
							}
						}
						cols.push(cache.normalized.length); // add position for rowCache
						cache.normalized.push(cols);
					}
					cache.colMax = colMax;
				}
			}
			if (c.showProcessing) {
				tsu.isProcessing(table); // remove processing icon
			}
			if (c.debug) {
				benchmark("Building cache for " + totalRows + " rows", cacheTime);
			}
		}

	},

	sort: {

		bindEvents: function(table){
			var c = table.config,
				$this = c.$table,
				j, downTime;
			// apply event handling to headers
			c.$headers
			// http://stackoverflow.com/questions/5312849/jquery-find-self;
			.find(c.selectorSort).add( c.$headers.filter(c.selectorSort) )
			.off('mousedown.tablesorter mouseup.tablesorter sort.tablesorter keypress.tablesorter')
			.on('mousedown.tablesorter mouseup.tablesorter sort.tablesorter keypress.tablesorter', function(e, external) {
				// only recognize left clicks or enter
				if ( ((e.which || e.button) !== 1 && !/sort|keypress/.test(e.type)) || (e.type === 'keypress' && e.which !== 13) ) {
					return;
				}
				// ignore long clicks (prevents resizable widget from initializing a sort)
				if (e.type === 'mouseup' && external !== true && (new Date().getTime() - downTime > 250)) { return; }
				// set timer on mousedown
				if (e.type === 'mousedown') {
					downTime = new Date().getTime();
					return e.target.tagName === "INPUT" ? '' : !c.cancelSelection;
				}
				if (c.delayInit && tsu.isEmptyObject(c.cache)) { tsb.cache(table); }
				var $cell = /TH|TD/.test(this.tagName) ? $(this) : $(this).closest('th, td'), cell = $cell[0];
				if (!cell.sortDisabled) {
					tss.init(table, cell, e);
				}
			});
			if (c.cancelSelection) {
				// cancel selection
				c.$headers
					.attr('unselectable', 'on')
					.on('selectstart', false)
					.css({
						'user-select': 'none',
						'MozUserSelect': 'none' // not needed for jQuery 1.8+
					});
			}
			// apply easy methods that trigger bound events
			$this
			.off('sortReset update updateRows updateCell updateAll addRows sorton appendCache applyWidgetId applyWidgets refreshWidgets destroy mouseup mouseleave '.split(' ').join('.tablesorter '))
			.on("sortReset.tablesorter", function(e){
				e.stopPropagation();
				c.sortList = [];
				tss.setHeadersCss(table);
				tss.multi(table);
				tss.append(table);
			})
			.on("updateAll.tablesorter", function(e, resort, callback){
				e.stopPropagation();
				tsw.refresh(table, true, true);
				tss.restoreHeaders(table);
				tsb.headers(table);
				tss.bindEvents(table);
				tss.update(table, resort, callback);
			})
			.on("update.tablesorter updateRows.tablesorter", function(e, resort, callback) {
				e.stopPropagation();
				tsw.update(table, resort, callback);
			})
			.on("updateCell.tablesorter", function(e, cell, resort, callback) {
				e.stopPropagation();
				$this.find(c.selectorRemove).remove();
				// get position from the dom
				var l, row, icell,
				$tb = $this.find('tbody'),
				// update cache - format: function(s, table, cell, cellIndex)
				tbdy = $tb.index( $(cell).closest('tbody') ),
				$row = $(cell).closest('tr');
				cell = $(cell)[0]; // in case cell is a jQuery object
				// tbody may not exist if update is initialized while tbody is removed for processing
				if ($tb.length && tbdy >= 0) {
					row = $tb.eq(tbdy).find('tr').index( $row );
					icell = cell.cellIndex;
					l = c.cache[tbdy].normalized[row].length - 1;
					c.cache[tbdy].row[table.config.cache[tbdy].normalized[row][l]] = $row;
					c.cache[tbdy].normalized[row][icell] = c.parsers[icell].format( getText(table, cell, icell), table, cell, icell );
					tss.checkResort($this, resort, callback);
				}
			})
			.on("addRows.tablesorter", function(e, $row, resort, callback) {
				e.stopPropagation();
				var i, rows = $row.filter('tr').length,
				dat = [], l = $row[0].cells.length,
				tbdy = $this.find('tbody').index( $row.closest('tbody') );
				// fixes adding rows to an empty table - see issue #179
				if (!c.parsers) {
					tsb.parsers(table);
				}
				// add each row
				for (i = 0; i < rows; i++) {
					// add each cell
					for (j = 0; j < l; j++) {
						dat[j] = c.parsers[j].format( getText(table, $row[i].cells[j], j), table, $row[i].cells[j], j );
					}
					// add the row index to the end
					dat.push(c.cache[tbdy].row.length);
					// update cache
					c.cache[tbdy].row.push([$row[i]]);
					c.cache[tbdy].normalized.push(dat);
					dat = [];
				}
				// resort using current settings
				tss.checkResort($this, resort, callback);
			})
			.on("sorton.tablesorter", function(e, list, callback, init) {
				var c = table.config;
				e.stopPropagation();
				$this.trigger("sortStart", this);
				// update header count index
				tss.updateCount(table, list);
				// set css for headers
				tss.setHeadersCss(table);
				// fixes #346
				if (c.delayInit && tsu.isEmptyObject(c.cache)) { tsb.cache(table); }
				$this.trigger("sortBegin", this);
				// sort the table and append it to the dom
				tss.multi(table);
				tss.append(table, init);
				if (typeof callback === "function") {
					callback(table);
				}
			})
			.on("appendCache.tablesorter", function(e, callback, init) {
				e.stopPropagation();
				tss.append(table, init);
				if (typeof callback === "function") {
					callback(table);
				}
			})
			.on("applyWidgetId.tablesorter", function(e, id) {
				e.stopPropagation();
				tsw.get(id).format(table, c, c.widgetOptions);
			})
			.on("applyWidgets.tablesorter", function(e, init) {
				e.stopPropagation();
				// apply widgets
				tsw.apply(table, init);
			})
			.on("refreshWidgets.tablesorter", function(e, all, dontapply){
				e.stopPropagation();
				tsw.refresh(table, all, dontapply);
			})
			.on("destroy.tablesorter", function(e, c, cb){
				e.stopPropagation();
				tss.destroy(table, c, cb);
			});
		},

		// previously formatSortingOrder
		formatOrder: function(v) {
			// look for "d" in "desc" order; return true
			return (/^d/i.test(v) || v === 1);
		},

		// previously updateHeaderSortCount
		updateCount: function(table, list) {
			var s, t, o, c = table.config,
				sl = list || c.sortList;
			c.sortList = [];
			$.each(sl, function(i,v){
				// ensure all sortList values are numeric - fixes #127
				s = [ parseInt(v[0], 10), parseInt(v[1], 10) ];
				// make sure header exists
				o = c.headerList[s[0]];
				if (o) { // prevents error if sorton array is wrong
					c.sortList.push(s);
					t = $.inArray(s[1], o.order); // fixes issue #167
					o.count = t >= 0 ? t : s[1] % (c.sortReset ? 3 : 2);
				}
			});
		},

		// previously getCachedSortType
		getType: function(parsers, i) {
			return (parsers && parsers[i]) ? parsers[i].type || '' : '';
		},

		// previously commonUpdate
		update: function(table, resort, callback) {
			var c = table.config;
			// remove rows/elements before update
			c.$table.find(c.selectorRemove).remove();
			// rebuild parsers
			tsb.parsers(table);
			// rebuild the cache map
			tsb.cache(table);
			tss.checkResort(c.$table, resort, callback);
		},

		updateHeader: function(table) {
			var s, c = table.config;
			c.$headers.each(function(index, th){
				s = tsu.getData( th, c.headers[index], 'sorter' ) === 'false';
				th.sortDisabled = s;
				$(th).toggleClass('sorter-false', s);
			});
		},

		setHeadersCss: function(table) {
			var f, i, j, l,
				c = table.config,
				list = c.sortList,
				css = [ts.css.sortAsc + ' ' + c.cssAsc, ts.css.sortDesc + ' ' + c.cssDesc],
				// find the footer
				$t = $(table).find('tfoot tr').children().removeClass(css.join(' '));
			// remove all header information
			c.$headers.removeClass(css.join(' '));
			l = list.length;
			for (i = 0; i < l; i++) {
				// direction = 2 means reset!
				if (list[i][1] !== 2) {
					// multicolumn sorting updating - choose the :last in case there are nested columns
					f = c.$headers.not('.sorter-false').filter('[data-column="' + list[i][0] + '"]');
					if (l === 1) { f = f.eq(-1); }
					if (f.length) {
						for (j = 0; j < f.length; j++) {
							if (!f[j].sortDisabled) {
								f.eq(j).addClass(css[list[i][1]]);
								// add sorted class to footer, if it exists
								if ($t.length) {
									$t.filter('[data-column="' + list[i][0] + '"]').eq(j).addClass(css[list[i][1]]);
								}
							}
						}
					}
				}
			}
		},

		// previously initSort
		init: function(table, cell, e){
			var a, i, j, o, s,
				c = table.config,
				k = !e[c.sortMultiSortKey],
				$this = $(table);
			// Only call sortStart if sorting is enabled
			$this.trigger("sortStart", table);
			// get current column sort order
			cell.count = e[c.sortResetKey] ? 2 : (cell.count + 1) % (c.sortReset ? 3 : 2);
			// reset all sorts on non-current column - issue #30
			if (c.sortRestart) {
				i = cell;
				c.$headers.each(function() {
					// only reset counts on columns that weren't just clicked on and if not included in a multisort
					if (this !== i && (k || !$(this).is('.' + ts.css.sortDesc + ',.' + ts.css.sortAsc))) {
						this.count = -1;
					}
				});
			}
			// get current column index
			i = cell.column;
			// user only wants to sort on one column
			if (k) {
				// flush the sort list
				c.sortList = [];
				if (c.sortForce !== null) {
					a = c.sortForce;
					for (j = 0; j < a.length; j++) {
						if (a[j][0] !== i) {
							c.sortList.push(a[j]);
						}
					}
				}
				// add column to sort list
				o = cell.order[cell.count];
				if (o < 2) {
					c.sortList.push([i, o]);
					// add other columns if header spans across multiple
					if (cell.colSpan > 1) {
						for (j = 1; j < cell.colSpan; j++) {
							c.sortList.push([i + j, o]);
						}
					}
				}
				// multi column sorting
			} else {
				// get rid of the sortAppend before adding more - fixes issue #115
				if (c.sortAppend && c.sortList.length > 1) {
					if (tsu.isValueInArray(c.sortAppend[0][0], c.sortList)) {
						c.sortList.pop();
					}
				}
				// the user has clicked on an already sorted column
				if (tsu.isValueInArray(i, c.sortList)) {
					// reverse the sorting direction for all tables
					for (j = 0; j < c.sortList.length; j++) {
						s = c.sortList[j];
						o = c.headerList[s[0]];
						if (s[0] === i) {
							s[1] = o.order[o.count];
							if (s[1] === 2) {
								c.sortList.splice(j,1);
								o.count = -1;
							}
						}
					}
				} else {
					// add column to sort list array
					o = cell.order[cell.count];
					if (o < 2) {
						c.sortList.push([i, o]);
						// add other columns if header spans across multiple
						if (cell.colSpan > 1) {
							for (j = 1; j < cell.colSpan; j++) {
								c.sortList.push([i + j, o]);
							}
						}
					}
				}
			}
			if (c.sortAppend !== null) {
				a = c.sortAppend;
				for (j = 0; j < a.length; j++) {
					if (a[j][0] !== i) {
						c.sortList.push(a[j]);
					}
				}
			}
			// sortBegin event triggered immediately before the sort
			$this.trigger("sortBegin", table);
			// setTimeout needed so the processing icon shows up
			setTimeout(function(){
				// set css for headers
				tss.setHeadersCss(table);
				tss.multi(table);
				tss.append(table);
			}, 1);
		},

		// sort multiple columns; previously multisort
		multi: function(table) { /*jshint loopfunc:true */
			var i, k, e, num, col, colMax, cache, lc,
				order, orgOrderCol, sortTime, sort, x, y,
				dir = 0,
				c = table.config,
				cts = c.textSorter || '',
				sortList = c.sortList,
				l = sortList.length,
				bl = table.tBodies.length;
			if (c.serverSideSorting || tsu.isEmptyObject(c.cache)) { // empty table - fixes #206/#346
				return;
			}
			if (c.debug) { sortTime = new Date(); }
			for (k = 0; k < bl; k++) {
				colMax = c.cache[k].colMax;
				cache = c.cache[k].normalized;
				lc = cache.length;
				orgOrderCol = (cache && cache[0]) ? cache[0].length - 1 : 0;
				cache.sort(function(a, b) {
					// cache is undefined here in IE, so don't use it!
					for (i = 0; i < l; i++) {
						col = sortList[i][0];
						order = sortList[i][1];
						// sort direction, true = asc, false = desc
						dir = order === 0;

						// set a & b depending on sort direction
						x = dir ? a : b;
						y = dir ? b : a;

						// determine how to sort empty cells
						e = c.string[ (c.empties[col] || c.emptyTo ) ];
						if (x[col] === '' && e !== 0) { return ((typeof(e) === 'boolean') ? (e ? -1 : 1) : (e || 1)) * (dir ? 1 : -1); }
						if (y[col] === '' && e !== 0) { return ((typeof(e) === 'boolean') ? (e ? 1 : -1) : (-e || -1)) * (dir ? 1 : -1); }

						// fallback to natural sort since it is more robust
						num = /n/i.test(tss.getType(c.parsers, col));
						if (num && c.strings[col]) {
							// sort strings in numerical columns
							if (typeof (c.string[c.strings[col]]) === 'boolean') {
								num = (dir ? 1 : -1) * (c.string[c.strings[col]] ? -1 : 1);
							} else {
								num = (c.strings[col]) ? c.string[c.strings[col]] || 0 : 0;
							}
							// fall back to built-in numeric sort
							sort = c.numberSorter ? c.numberSorter(x[col], y[col], dir, colMax[col], table) : tss.numeric(x[col], y[col], num, colMax[col]);
						} else {
							// text sort function
							if (typeof(cts) === 'function') {
								// custom OVERALL text sorter
								sort = cts(x[col], y[col], dir, col, table);
							} else if (typeof(cts) === 'object' && cts.hasOwnProperty(col)) {
								// custom text sorter for a SPECIFIC COLUMN
								sort = cts[col](x[col], y[col], dir, col, table);
							} else {
								// fall back to natural sort
								sort = tss.natural(x[col], y[col]);
							}
						}
						if (sort) { return sort; }
					}
					return a[orgOrderCol] - b[orgOrderCol];
				});
			}
			if (c.debug) { benchmark("Sorting on " + sortList.toString() + " and dir " + order + " time", sortTime); }
		},

		// Natural sort - https://github.com/overset/javascript-natural-sort (date sorting removed)
		natural: function(a, b) {
			if (a === b) { return 0; }
			var xN, xD, yN, yD, xF, yF, i, mx,
				r = ts.regex;
			// first try and sort Hex codes
			if (r.hex.test(b)) {
				xD = parseInt(a.match(r.hex), 16);
				yD = parseInt(b.match(r.hex), 16);
				if ( xD < yD ) { return -1; }
				if ( xD > yD ) { return 1; }
			}
			// chunk/tokenize
			xN = a.replace(r.chunk, '\\0$1\\0').replace(/\\0$/, '').replace(/^\\0/, '').split('\\0');
			yN = b.replace(r.chunk, '\\0$1\\0').replace(/\\0$/, '').replace(/^\\0/, '').split('\\0');
			mx = Math.max(xN.length, yN.length);
			// natural sorting through split numeric strings and default strings
			for (i = 0; i < mx; i++) {
				// find floats not starting with '0', string or 0 if not defined
				xF = isNaN(xN[i]) ? xN[i] || 0 : parseFloat(xN[i]) || 0;
				yF = isNaN(yN[i]) ? yN[i] || 0 : parseFloat(yN[i]) || 0;
				// handle numeric vs string comparison - number < string - (Kyle Adams)
				if (isNaN(xF) !== isNaN(yF)) { return (isNaN(xF)) ? 1 : -1; }
				// rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
				if (typeof xF !== typeof yF) {
					xF += '';
					yF += '';
				}
				if (xF < yF) { return -1; }
				if (xF > yF) { return 1; }
			}
			return 0;
		},

		// basic alphabetical sort
		text: function(a, b) {
			return a > b ? 1 : (a < b ? -1 : 0);
		},

		// return text string value by adding up ascii value
		// so the text is somewhat sorted when using a digital sort
		// this is NOT an alphanumeric sort
		getTextValue: function(a, d, mx) {
			if (mx) {
				// make sure the text value is greater than the max numerical value (mx)
				var i, l = a ? a.length : 0, n = mx + d;
				for (i = 0; i < l; i++) {
					n += a.charCodeAt(i);
				}
				return d * n;
			}
			return 0;
		},

		numeric: function(a, b, dir, mx) {
			if (a === b) { return 0; }
			if (isNaN(a)) { a = tss.getTextValue(a, dir, mx); }
			if (isNaN(b)) { b = tss.getTextValue(b, dir, mx); }
			return a - b;
		},

		checkResort: function($table, flag, callback) {
			// don't try to resort if the table is still processing
			// this will catch spamming of the updateCell method
			if (flag !== false && !$table[0].isProcessing) {
				$table.trigger("sorton", [$table[0].config.sortList, function(){
					tss.complete($table, callback);
				}]);
			} else {
				tss.complete($table, callback);
			}
		},

		// previously resortComplete
		complete: function($table, callback){
			var c = $table[0].config;
			if (c.pager && !c.pager.ajax) {
				$table.trigger('updateComplete');
			}
			if (typeof callback === "function") {
				callback($table[0]);
			}
		},

		// init flag (true) used by pager plugin to prevent widget application
		// previously appendToTable
		append: function(table, init) {
			var c = table.config,
			b = table.tBodies,
			rows = [],
			c2 = c.cache,
			r, n, totalRows, checkCell, $bk, $tb,
			i, j, k, l, pos, appendTime;
			if (tsu.isEmptyObject(c2)) { return; } // empty table - fixes #206/#346
			if (c.debug) {
				appendTime = new Date();
			}
			for (k = 0; k < b.length; k++) {
				$bk = $(b[k]);
				if ($bk.length && !$bk.hasClass(c.cssInfoBlock)) {
					// get tbody
					$tb = tsu.processTbody(table, $bk, true);
					r = c2[k].row;
					n = c2[k].normalized;
					totalRows = n.length;
					checkCell = totalRows ? (n[0].length - 1) : 0;
					for (i = 0; i < totalRows; i++) {
						pos = n[i][checkCell];
						rows.push(r[pos]);
						// removeRows used by the pager plugin
						if (!c.appender || !c.removeRows) {
							l = r[pos].length;
							for (j = 0; j < l; j++) {
								$tb.append(r[pos][j]);
							}
						}
					}
					// restore tbody
					tsu.processTbody(table, $tb, false);
				}
			}
			if (c.appender) {
				c.appender(table, rows);
			}
			if (c.debug) {
				benchmark("Rebuilt table", appendTime);
			}
			// apply table widgets
			if (!init) { tsw.apply(table); }
			// trigger sortend
			c.$table.trigger("sortEnd", table);
			c.$table.trigger("updateComplete", table);
		},

		// restore headers
		restoreHeaders: function(table){
			var c = table.config;
			// don't use c.$headers here in case header cells were swapped
			c.$table.children('thead').children().children('th, td').each(function(i){
				// only restore header cells if it is wrapped
				// because this is also used by the updateAll method
				if ($(this).find('.tablesorter-header-inner').length){
					$(this).html( c.headerContent[i] );
				}
			});
		},

		destroy: function(table, removeClasses, callback){
			table = $(table)[0];
			if (!table.hasInitialized) { return; }
			// remove all widgets
			tsw.refresh(table, true, true);
			var $t = $(table), c = table.config,
			$h = $t.find('thead').eq(0),
			$r = $h.find('tr.' + ts.css.headerRow).removeClass(ts.css.headerRow + ' ' + c.cssHeaderRow),
			$f = $t.find('tfoot').eq(0).children('tr').children('th, td');
			// remove widget added rows, just in case
			$h.find('tr').not($r).remove();
			// disable tablesorter
			$t
				.removeData('tablesorter')
				.off('sortReset update updateAll updateRows updateCell addRows sorton appendCache applyWidgetId applyWidgets refreshWidgets destroy mouseup mouseleave keypress sortBegin sortEnd '.split(' ').join('.tablesorter '));
			c.$headers.add($f)
				.removeClass( [ts.css.header, c.cssHeader, c.cssAsc, c.cssDesc, ts.css.sortAsc, ts.css.sortDesc].join(' ') )
				.removeAttr('data-column');
			$r.find(c.selectorSort).off('mousedown.tablesorter mouseup.tablesorter keypress.tablesorter');
			tss.restoreHeaders(table);
			if (removeClasses !== false) {
				$t.removeClass(ts.css.table + ' ' + c.tableClass + ' tablesorter-' + c.theme);
			}
			// clear flag in case the plugin is initialized again
			table.hasInitialized = false;
			if (typeof callback === 'function') {
				callback(table);
			}
		}

	},

	utility : {

		// automatically add col group, and column sizes if set
		fixColumnWidth: function(table) {
			if (table.config.widthFixed && $(table).find('colgroup').length === 0) {
				var colgroup = $('<colgroup>'),
					overallWidth = $(table).width();
				// only add col for visible columns - fixes #371
				$(table.tBodies[0]).find("tr:first").children("td:visible").each(function() {
					colgroup.append($('<col>').css('width', parseInt(($(this).width()/overallWidth)*1000, 10)/10 + '%'));
				});
				$(table).prepend(colgroup);
			}
		},

		// computeTableHeaderCellIndexes from:
		// http://www.javascripttoolbox.com/lib/table/examples.php
		// http://www.javascripttoolbox.com/temp/table_cellindex.html
		computeThIndexes: function(t) {
			var matrix = [],
			lookup = {},
			cols = 0, // determine the number of columns
			trs = $(t).children('thead, tfoot').children('tr'), // children tr in tfoot - see issue #196
			i, j, k, l, c, cells, rowIndex, cellId, rowSpan, colSpan, firstAvailCol, matrixrow;
			for (i = 0; i < trs.length; i++) {
				cells = trs[i].cells;
				for (j = 0; j < cells.length; j++) {
					c = cells[j];
					rowIndex = c.parentNode.rowIndex;
					cellId = rowIndex + "-" + c.cellIndex;
					rowSpan = c.rowSpan || 1;
					colSpan = c.colSpan || 1;
					if (typeof(matrix[rowIndex]) === "undefined") {
						matrix[rowIndex] = [];
					}
					// Find first available column in the first row
					for (k = 0; k < matrix[rowIndex].length + 1; k++) {
						if (typeof(matrix[rowIndex][k]) === "undefined") {
							firstAvailCol = k;
							break;
						}
					}
					lookup[cellId] = firstAvailCol;
					cols = Math.max(firstAvailCol, cols);
					// add data-column
					$(c).attr({ 'data-column' : firstAvailCol }); // 'data-row' : rowIndex
					for (k = rowIndex; k < rowIndex + rowSpan; k++) {
						if (typeof(matrix[k]) === "undefined") {
							matrix[k] = [];
						}
						matrixrow = matrix[k];
						for (l = firstAvailCol; l < firstAvailCol + colSpan; l++) {
							matrixrow[l] = "x";
						}
					}
				}
			}
			// may not be accurate if # header columns !== # tbody columns
			t.config.columns = cols + 1; // add one because it's a zero-based index
			return lookup;
		},

		getElementText: function(table, node, cellIndex) {
			if (!node) { return ''; }
			var c = table.config,
				t = c.textExtraction,
				text = '';
			if (t === 'simple') {
				text = node.textContent || node.innerText || $(node).text();
			} else {
				if (typeof t === "function") {
					text = t(node, table, cellIndex);
				} else if (typeof t === "object" && t.hasOwnProperty(cellIndex)) {
					text = t[cellIndex](node, table, cellIndex);
				} else {
					text = node.textContent || node.innerText || $(node).text();
				}
			}
			return $.trim(text || '');
		},

		// get sorter, string, empty, etc options for each column from
		// jQuery data, metadata, header option or header class name ("sorter-false")
		// priority = jQuery data > meta > headers option > header class name
		getData: function(h, ch, key) {
			var val = '', $h = $(h), m, cl;
			if (!$h.length) { return ''; }
			m = $.metadata ? $h.metadata() : false;
			cl = ' ' + ($h.attr('class') || '');
			if (typeof $h.data(key) !== 'undefined' || typeof $h.data(key.toLowerCase()) !== 'undefined'){
				// "data-lockedOrder" is assigned to "lockedorder"; but "data-locked-order" is assigned to "lockedOrder"
				// "data-sort-initial-order" is assigned to "sortInitialOrder"
				val += $h.data(key) || $h.data(key.toLowerCase());
			} else if (m && typeof m[key] !== 'undefined') {
				val += m[key];
			} else if (ch && typeof ch[key] !== 'undefined') {
				val += ch[key];
			} else if (cl !== ' ' && cl.match(' ' + key + '-')) {
				// include sorter class name "sorter-text", etc; now works with "sorter-my-custom-parser"
				val = cl.match( new RegExp('\\s' + key + '-([\\w-]+)') )[1] || '';
			}
			return $.trim(val);
		},

		formatFloat: function(s, table) {
			if (typeof s !== 'string' || s === '') { return s; }
			// allow using formatFloat without a table; defaults to US number format
			var i,
				t = table && table.config ? table.config.usNumberFormat !== false :
					typeof table !== "undefined" ? table : true;
			if (t) {
				// US Format - 1,234,567.89 -> 1234567.89
				s = s.replace(/,/g,'');
			} else {
				// German Format = 1.234.567,89 -> 1234567.89
				// French Format = 1 234 567,89 -> 1234567.89
				s = s.replace(/[\s|\.]/g,'').replace(/,/g,'.');
			}
			if(/^\s*\([.\d]+\)/.test(s)) {
				// make (#) into a negative number -> (10) = -10
				s = s.replace(/^\s*\(([.\d]+)\)/, '-$1');
			}
			i = parseFloat(s);
			// return the text instead of zero
			return isNaN(i) ? $.trim(s) : i;
		},

		isDigit: function(s) {
			// replace all unwanted chars and match
			return isNaN(s) ? (/^[\-+(]?\d+[)]?$/).test(s.toString().replace(/[,.'"\s]/g, '')) : true;
		},

		// *** Process table ***
		// add processing indicator
		isProcessing: function(table, toggle, $ths) {
			table = $(table);
			var c = table[0].config,
				// default to all headers
				$h = $ths || table.find('.' + ts.css.header);
			if (toggle) {
				if (c.sortList.length > 0) {
					// get headers from the sortList
					$h = $h.filter(function(){
						// get data-column from attr to keep  compatibility with jQuery 1.2.6
						return this.sortDisabled ? false : tsu.isValueInArray( parseFloat($(this).attr('data-column')), c.sortList);
					});
				}
				$h.addClass(ts.css.processing + ' ' + c.cssProcessing);
			} else {
				$h.removeClass(ts.css.processing + ' ' + c.cssProcessing);
			}
		},

		// detach tbody but save the position
		// don't use tbody because there are portions that look for a tbody index (updateCell)
		processTbody: function(table, $tb, getIt){
			var holdr;
			if (getIt) {
				table.isProcessing = true;
				$tb.before('<span class="tablesorter-savemyplace"/>');
				holdr = ($.fn.detach) ? $tb.detach() : $tb.remove();
				return holdr;
			}
			holdr = $(table).find('span.tablesorter-savemyplace');
			$tb.insertAfter( holdr );
			holdr.remove();
			table.isProcessing = false;
		},

		clearTableBody: function(table) {
			$(table)[0].config.$tbodies.empty();
		},

		// used when replacing accented characters during sorting
		characterEquivalents: {
			"a" : "\u00e1\u00e0\u00e2\u00e3\u00e4\u0105\u00e5", // áàâãäąå
			"A" : "\u00c1\u00c0\u00c2\u00c3\u00c4\u0104\u00c5", // ÁÀÂÃÄĄÅ
			"c" : "\u00e7\u0107\u010d", // çćč
			"C" : "\u00c7\u0106\u010c", // ÇĆČ
			"e" : "\u00e9\u00e8\u00ea\u00eb\u011b\u0119", // éèêëěę
			"E" : "\u00c9\u00c8\u00ca\u00cb\u011a\u0118", // ÉÈÊËĚĘ
			"i" : "\u00ed\u00ec\u0130\u00ee\u00ef\u0131", // íìİîïı
			"I" : "\u00cd\u00cc\u0130\u00ce\u00cf", // ÍÌİÎÏ
			"o" : "\u00f3\u00f2\u00f4\u00f5\u00f6", // óòôõö
			"O" : "\u00d3\u00d2\u00d4\u00d5\u00d6", // ÓÒÔÕÖ
			"ss": "\u00df", // ß (s sharp)
			"SS": "\u1e9e", // ẞ (Capital sharp s)
			"u" : "\u00fa\u00f9\u00fb\u00fc\u016f", // úùûüů
			"U" : "\u00da\u00d9\u00db\u00dc\u016e" // ÚÙÛÜŮ
		},

		replaceAccents: function(s) {
			var a, acc = '[', eq = tsu.characterEquivalents;
			if (!ts.regex.charEquiv) {
				ts.regex.charEquivArray = {};
				for (a in eq) {
					if (typeof a === 'string') {
						acc += eq[a];
						ts.regex.charEquivArray[a] = new RegExp('[' + eq[a] + ']', 'g');
					}
				}
				ts.regex.charEquiv = new RegExp(acc + ']');
			}
			if (ts.regex.charEquiv.test(s)) {
				for (a in eq) {
					if (typeof a === 'string') {
						s = s.replace( ts.regex.charEquivArray[a], a );
					}
				}
			}
			return s;
		},

		isValueInArray: function(v, a) {
			var i, l = a.length;
			for (i = 0; i < l; i++) {
				if (a[i][0] === v) {
					return true;
				}
			}
			return false;
		},

		// $.isEmptyObject from jQuery v1.4
		isEmptyObject: function(obj) {
			/*jshint forin: false */
			for (var name in obj) {
				return false;
			}
			return true;
		},

		/* debuging utils */
		log: function log(s) {
			if (typeof console !== "undefined" && typeof console.log !== "undefined") {
				console.log(s);
			} else {
				alert(s);
			}
		},

		benchmark: function(s, d) {
			log(s + " (" + (new Date().getTime() - d.getTime()) + "ms)");
		}

	},

	construct: function(table, settings) {
		// merge & extend config options
		var c = $.extend(true, {}, ts.defaults, settings);
		// create a table from data (build table widget)
		if (!table.hasInitialized && ts.build.table && this.tagName !== 'TABLE') {
			// return the table (in case the original target is the table's container)
			ts.build.table(table, c);
		}
		ts.setup(table, c);
	},

	setup: function(table, c){
		// if no thead or tbody, or tablesorter is already present, quit
		if (!table || !table.tHead || table.tBodies.length === 0 || table.hasInitialized === true) {
			return c.debug ? log('stopping initialization! No table, thead, tbody or tablesorter has already been initialized') : '';
		}

		var k = '',
			$this = $(table),
			m = $.metadata;
		// initialization flag
		table.hasInitialized = false;
		// table is being processed flag
		table.isProcessing = true;
		// make sure to store the config object
		table.config = c;
		// save the settings where they read
		$this.data('tablesorter', c);
		if (c.debug) { $this.data('startoveralltimer', new Date()); }

		// removing this in version 3 (only supports jQuery 1.7+)
		c.supportsDataObject = $.fn.jquery ? (function(version) {
			version[0] = parseInt(version[0], 10);
			return (version[0] > 1) || (version[0] === 1 && parseInt(version[1], 10) >= 4);
		})($.fn.jquery.split(".")) : true;
		// digit sort text location;
		c.string = { 'max': 1, 'min': -1, 'zero': 0, 'none': 0, 'null': 0, 'top': true, 'bottom': false };
		// add table theme class only if there isn't already one there
		if (!/tablesorter\-/.test($this.attr('class'))) {
			k = (c.theme !== '' ? ' tablesorter-' + c.theme : '');
		}
		c.$table = $this.addClass(ts.css.table + ' ' + c.tableClass + k);
		c.$tbodies = $this.children('tbody:not(.' + c.cssInfoBlock + ')');
		c.widgetInit = {}; // keep a list of initialized widgets
		// build headers
		tsb.headers(table);
		// fixate columns if the users supplies the fixedWidth option
		// do this after theme has been applied
		tsu.fixColumnWidth(table);
		// try to auto detect column type, and store in tables config
		tsb.parsers(table);
		// build the cache for the tbody cells
		// delayInit will delay building the cache until the user starts a sort
		if (!c.delayInit) { tsb.cache(table); }
		// bind all header events and methods
		tss.bindEvents(table);
		// get sort list from jQuery data or metadata
		// in jQuery < 1.4, an error occurs when calling $this.data()
		if (c.supportsDataObject && typeof $this.data().sortlist !== 'undefined') {
			c.sortList = $this.data().sortlist;
		} else if (m && ($this.metadata() && $this.metadata().sortlist)) {
			c.sortList = $this.metadata().sortlist;
		}
		// apply widget init code
		tsw.apply(table, true);
		// if user has supplied a sort list to constructor
		if (c.sortList.length > 0) {
			$this.trigger("sorton", [c.sortList, {}, !c.initWidgets]);
		} else if (c.initWidgets) {
			// apply widget format
			tsw.apply(table);
		}

		// show processesing icon
		if (c.showProcessing) {
			$this
			.off('sortBegin.tablesorter sortEnd.tablesorter')
			.on('sortBegin.tablesorter sortEnd.tablesorter', function(e) {
				tsu.isProcessing(table, e.type === 'sortBegin');
			});
		}

		// initialized
		table.hasInitialized = true;
		table.isProcessing = false;
		if (c.debug) {
			benchmark("Overall initialization time", c.$table.data('startoveralltimer'));
		}
		$this.trigger('tablesorter-initialized', table);
		if (typeof c.initialized === 'function') { c.initialized(table); }
	},

	// storage for parsers & widgets (after being added)
	parsers: [],
	widgets: []

});

	$.fn.tablesorter = function(options, callback, resort) {
		return this.each(function(){
			// prevent multiple initializations
			if (this.config) {
				if (options) {
					$.extend( true, this.config, options );
				}
				tsw.update(this, resort, callback);
			} else {
				ts.construct(this, options);
			}
		});
	};

	// names for better compression
	var tsw = ts.widget,
		tsp = ts.parser,
		tsu = ts.utility,
		tss = ts.sort,
		tsb = ts.build,
		formatFloat = tsu.formatFloat,
		benchmark = tsu.benchmark,
		log = tsu.log,
		getText = tsu.getElementText;

	/* cross reference for commonly functions
	ts.addWidget = tsw.add;
	ts.addParser = tsp.add;
	ts.getParserById = tsp.get;
	ts.isDigit = tsu.isDigit;
	ts.formatFloat = formatFloat;
	ts.getData = tsu.getData;
	ts.replaceAccents = tsu.replaceAccents;
	ts.processTbody = tsu.processTbody;
*/
	// add default parsers
	tsp.add({
		id: "text",
		is: function() {
			return true;
		},
		format: function(s, table) {
			var c = table.config;
			if (s) {
				s = $.trim( c.ignoreCase ? s.toLocaleLowerCase() : s );
				s = c.sortLocaleCompare ? tsu.replaceAccents(s) : s;
			}
			return s;
		},
		type: "text"
	});

	tsp.add({
		id: "digit",
		is: function(s) {
			return tsu.isDigit(s);
		},
		format: function(s, table) {
			var n = formatFloat((s || '').replace(ts.regex.nonDigit, ""), table);
			return s && typeof n === 'number' ? n : s ? $.trim( s && table.config.ignoreCase ? s.toLocaleLowerCase() : s ) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "currency",
		is: function(s) {
			return (/^\(?\d+[\u00a3$\u20ac\u00a4\u00a5\u00a2?.]|[\u00a3$\u20ac\u00a4\u00a5\u00a2?.]\d+\)?$/).test((s || '').replace(/[,. ]/g,'')); // £$€¤¥¢
		},
		format: function(s, table) {
			var n = formatFloat((s || '').replace(ts.regex.nonDigit, ""), table);
			return s && typeof n === 'number' ? n : s ? $.trim( s && table.config.ignoreCase ? s.toLocaleLowerCase() : s ) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "ipAddress",
		is: function(s) {
			return (/^\d{1,3}[\.]\d{1,3}[\.]\d{1,3}[\.]\d{1,3}$/).test(s);
		},
		format: function(s, table) {
			var i, a = s ? s.split(".") : '',
			r = "",
			l = a.length;
			for (i = 0; i < l; i++) {
				r += ("00" + a[i]).slice(-3);
			}
			return s ? formatFloat(r, table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "url",
		is: function(s) {
			return (/^(https?|ftp|file):\/\//).test(s);
		},
		format: function(s) {
			return s ? $.trim(s.replace(ts.regex.url, '')) : s;
		},
		type: "text"
	});

	tsp.add({
		id: "isoDate",
		is: function(s) {
			return (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/).test(s);
		},
		format: function(s, table) {
			return s ? formatFloat((s !== "") ? (new Date(s.replace(/-/g, "/")).getTime() || "") : "", table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "percent",
		is: function(s) {
			return (/(\d\s*?%|%\s*?\d)/).test(s) && s.length < 15;
		},
		format: function(s, table) {
			return s ? formatFloat(s.replace(/%/g, ""), table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "usLongDate",
		is: function(s) {
			// two digit years are not allowed cross-browser
			// Jan 01, 2013 12:34:56 PM or 01 Jan 2013
			return (/^[A-Z]{3,10}\.?\s+\d{1,2},?\s+(\d{4})(\s+\d{1,2}:\d{2}(:\d{2})?(\s+[AP]M)?)?$/i).test(s) || (/^\d{1,2}\s+[A-Z]{3,10}\s+\d{4}/i).test(s);
		},
		format: function(s, table) {
			return s ? formatFloat( (new Date(s.replace(/(\S)([AP]M)$/i, "$1 $2")).getTime() || ''), table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "shortDate", // "mmddyyyy", "ddmmyyyy" or "yyyymmdd"
		is: function(s) {
			// testing for ##-##-#### or ####-##-##, so it's not perfect; time can be included
			return (/(^\d{1,2}[\/\s]\d{1,2}[\/\s]\d{4})|(^\d{4}[\/\s]\d{1,2}[\/\s]\d{1,2})/).test((s || '').replace(/\s+/g," ").replace(/[\-.,]/g, "/"));
		},
		format: function(s, table, cell, cellIndex) {
			if (s) {
				var c = table.config, ci = c.headerList[cellIndex],
				format = ci.dateFormat || tsu.getData( ci, c.headers[cellIndex], 'dateFormat') || c.dateFormat;
				s = s.replace(/\s+/g," ").replace(/[\-.,]/g, "/"); // escaped - because JSHint in Firefox was showing it as an error
				if (format === "mmddyyyy") {
					s = s.replace(ts.regex.shortDate, "$3/$1/$2");
				} else if (format === "ddmmyyyy") {
					s = s.replace(ts.regex.shortDate, "$3/$2/$1");
				} else if (format === "yyyymmdd") {
					s = s.replace(ts.regex.shortDateYr, "$1/$2/$3");
				}
			}
			return s ? formatFloat( (new Date(s).getTime() || ''), table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "time",
		is: function(s) {
			return (/^(([0-2]?\d:[0-5]\d)|([0-1]?\d:[0-5]\d\s?([AP]M)))$/i).test(s);
		},
		format: function(s, table) {
			return s ? formatFloat( (new Date("2000/01/01 " + s.replace(/(\S)([AP]M)$/i, "$1 $2")).getTime() || ""), table) : s;
		},
		type: "numeric"
	});

	tsp.add({
		id: "metadata",
		is: function() {
			return false;
		},
		format: function(s, table, cell) {
			var c = table.config,
			p = (!c.parserMetadataName) ? 'sortValue' : c.parserMetadataName;
			return $(cell).metadata()[p];
		},
		type: "numeric"
	});

	// add default widgets
	tsw.add({
		id: "zebra",
		priority: 90,
		format: function(table, c, wo) {
			var $tb, $tv, $tr, row, even, time, k, l,
			child = new RegExp(c.cssChildRow, 'i'),
			b = c.$tbodies;
			if (c.debug) {
				time = new Date();
			}
			for (k = 0; k < b.length; k++ ) {
				// loop through the visible rows
				$tb = b.eq(k);
				l = $tb.children('tr').length;
				if (l > 1) {
					row = 0;
					$tv = $tb.children('tr:visible');
					// revered back to using jQuery each - strangely it's the fastest method
					/*jshint loopfunc:true */
					$tv.each(function(){
						$tr = $(this);
						// style children rows the same way the parent row was styled
						if (!child.test(this.className)) { row++; }
						even = (row % 2 === 0);
						$tr.removeClass(wo.zebra[even ? 1 : 0]).addClass(wo.zebra[even ? 0 : 1]);
					});
				}
			}
			if (c.debug) {
				benchmark("Applying Zebra widget", time);
			}
		},
		remove: function(table, c, wo){
			var k, $tb,
				b = c.$tbodies,
				rmv = (wo.zebra || [ "even", "odd" ]).join(' ');
			for (k = 0; k < b.length; k++ ){
				$tb = tsu.processTbody(table, b.eq(k), true); // remove tbody
				$tb.children().removeClass(rmv);
				tsu.processTbody(table, $tb, false); // restore tbody
			}
		}
	});

})(window.jQuery || window.Zepto);
