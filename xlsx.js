/* Lager Excel-filer (.xlsx) med flere ark, formatering og ekte diagrammer – helt uten biblioteker.
   En .xlsx er en zip-fil med XML-filer. Zip-en lagres ukomprimert (gyldig og raskt nok for våre mengder).

   Bruk: XLSX.build({ sheets: [{ name, cols: [bredde, …], rows: [[celle, …], …], freeze, filter, charts }] }) → Blob
   Celle: tall, tekst, null, eller { v, s: { bold, size, color, fill, fmt, wrap, align, border } }.
   Dato-celler: { v: XLSX.date('2026-11-12'), s: { fmt: 'dd.mm.yyyy' } }.
   Diagram: { type: 'bar' | 'stacked' | 'line', title, from: [kol, rad], to: [kol, rad],
              cats: 'A2:A10', series: [{ name, ref: 'B2:B10', color: 'EC6100' }], catFmt } (refs gjelder arket selv). */
window.XLSX = (function () {
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; })
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  };
  var colName = function (i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  var abs = function (sheet, ref) {
    var q = "'" + sheet.replace(/'/g, "''") + "'!";
    return q + ref.split(':').map(function (p) { return p.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2'); }).join(':');
  };
  var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  var NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

  /* ---------- Stiler: hver unike kombinasjon blir én cellXf ---------- */
  function Styles() {
    this.fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = [];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = { '{}': 0 };
  }
  Styles.prototype.add = function (list, xml) { var i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
  Styles.prototype.id = function (s) {
    if (!s) return 0;
    var key = JSON.stringify(s);
    if (key in this.cache) return this.cache[key];
    var font = 0, fill = 0, border = 0, fmt = 0;
    if (s.bold || s.size || s.color || s.italic) {
      font = this.add(this.fonts, '<font>' + (s.bold ? '<b/>' : '') + (s.italic ? '<i/>' : '') + '<sz val="' + (s.size || 11) + '"/>' +
        (s.color ? '<color rgb="FF' + s.color + '"/>' : '') + '<name val="Calibri"/><family val="2"/></font>');
    }
    if (s.fill) fill = this.add(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + s.fill + '"/><bgColor indexed="64"/></patternFill></fill>');
    if (s.border) border = this.add(this.borders, '<border><left/><right/><top/><bottom style="thin"><color rgb="FF' + s.border + '"/></bottom><diagonal/></border>');
    if (s.fmt) {
      var builtIn = { '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4 }[s.fmt];
      if (builtIn) fmt = builtIn;
      else { var i = this.numFmts.indexOf(s.fmt); if (i < 0) { this.numFmts.push(s.fmt); i = this.numFmts.length - 1; } fmt = 164 + i; }
    }
    var align = s.wrap || s.align || s.valign ? '<alignment' + (s.align ? ' horizontal="' + s.align + '"' : '') + ' vertical="' + (s.valign || 'center') + '"' + (s.wrap ? ' wrapText="1"' : '') + '/>' : '';
    var xf = '<xf numFmtId="' + fmt + '" fontId="' + font + '" fillId="' + fill + '" borderId="' + border + '" xfId="0"' +
      (fmt ? ' applyNumberFormat="1"' : '') + (font ? ' applyFont="1"' : '') + (fill ? ' applyFill="1"' : '') + (border ? ' applyBorder="1"' : '') +
      (align ? ' applyAlignment="1">' + align + '</xf>' : '/>');
    this.xfs.push(xf);
    return (this.cache[key] = this.xfs.length - 1);
  };
  Styles.prototype.xml = function () {
    return XML + '<styleSheet xmlns="' + NS_MAIN + '">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* ---------- Ark ---------- */
  function sheetXml(sh, styles, hasDrawing) {
    var rows = sh.rows.map(function (row, r) {
      if (!row) return '';
      var cells = row.map(function (cell, c) {
        if (cell == null || cell === '') return '';
        var v = cell, s = null;
        if (typeof cell === 'object') { v = cell.v; s = cell.s; }
        var ref = colName(c) + (r + 1), st = styles.id(s), sa = st ? ' s="' + st + '"' : '';
        if (v == null || v === '') return st ? '<c r="' + ref + '"' + sa + '/>' : '';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
        return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('');
      var ht = sh.heights && sh.heights[r] ? ' ht="' + sh.heights[r] + '" customHeight="1"' : '';
      return '<row r="' + (r + 1) + '"' + ht + '>' + cells + '</row>';
    }).join('');
    var pane = sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>' : '';
    return XML + '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '">' +
      '<sheetViews><sheetView workbookViewId="0"' + (sh.gridlines === false ? ' showGridLines="0"' : '') + '>' + pane + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (sh.cols ? '<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '') +
      '<sheetData>' + rows + '</sheetData>' +
      (sh.filter ? '<autoFilter ref="' + sh.filter + '"/>' : '') +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      (hasDrawing ? '<drawing r:id="rId1"/>' : '') + '</worksheet>';
  }

  /* ---------- Diagrammer ---------- */
  function chartXml(ch, sheetName) {
    var line = ch.type === 'line';
    var ser = ch.series.map(function (s, i) {
      var color = s.color || 'EC6100';
      var sp = line
        ? '<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:round/></a:ln></c:spPr>' +
          '<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>'
        : '<c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>';
      return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/><c:tx><c:v>' + esc(s.name) + '</c:v></c:tx>' + sp +
        '<c:cat><c:' + (ch.catNum ? 'numRef' : 'strRef') + '><c:f>' + esc(abs(sheetName, ch.cats)) + '</c:f></c:' + (ch.catNum ? 'numRef' : 'strRef') + '></c:cat>' +
        '<c:val><c:numRef><c:f>' + esc(abs(sheetName, s.ref)) + '</c:f></c:numRef></c:val>' + (line ? '<c:smooth val="0"/>' : '') + '</c:ser>';
    }).join('');
    var txt = function (sz, color) { return '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + sz + '"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="nb-NO"/></a:p></c:txPr>'; };
    var grid = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E5E5"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
    var noLine = '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>';
    var plot = line
      ? '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + ser + '<c:marker val="1"/><c:axId val="10"/><c:axId val="20"/></c:lineChart>'
      : '<c:barChart><c:barDir val="col"/><c:grouping val="' + (ch.type === 'stacked' ? 'stacked' : 'clustered') + '"/><c:varyColors val="0"/>' + ser +
        '<c:gapWidth val="60"/>' + (ch.type === 'stacked' ? '<c:overlap val="100"/>' : '') + '<c:axId val="10"/><c:axId val="20"/></c:barChart>';
    return XML + '<c:chartSpace xmlns:c="' + NS_C + '" xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '"><c:roundedCorners val="0"/><c:chart>' +
      '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="nb-NO" sz="1200" b="1"/><a:t>' + esc(ch.title) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>' + plot +
      '<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' +
      '<c:numFmt formatCode="' + esc(ch.catFmt || 'General') + '" sourceLinked="' + (ch.catFmt ? 0 : 1) + '"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>' + txt(900, '595959') +
      '<c:crossAx val="20"/><c:crosses val="autoZero"/><c:auto val="' + (ch.catNum ? 0 : 1) + '"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>' + grid +
      '<c:numFmt formatCode="' + esc(ch.valFmt || 'General') + '" sourceLinked="' + (ch.valFmt ? 0 : 1) + '"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' + noLine + txt(900, '595959') +
      '<c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>' +
      '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>' +
      (ch.series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/>' + txt(900, '404040') + '</c:legend>' : '') +
      '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:chartSpace>';
  }
  function drawingXml(charts, firstId) {
    var NS_X = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
    return XML + '<xdr:wsDr xmlns:xdr="' + NS_X + '" xmlns:a="' + NS_A + '">' + charts.map(function (ch, i) {
      var pt = function (tag, p) { return '<xdr:' + tag + '><xdr:col>' + p[0] + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + p[1] + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:' + tag + '>'; };
      return '<xdr:twoCellAnchor editAs="oneCell">' + pt('from', ch.from) + pt('to', ch.to) +
        '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (firstId + i + 1) + '" name="' + esc(ch.title) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="' + NS_C + '">' +
        '<c:chart xmlns:c="' + NS_C + '" xmlns:r="' + NS_R + '" r:id="rId' + (i + 1) + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
    }).join('') + '</xdr:wsDr>';
  }
  var rels = function (list) {
    return XML + '<Relationships xmlns="' + NS_PKG + '">' + list.map(function (r, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + r[0] + '" Target="' + r[1] + '"/>'; }).join('') + '</Relationships>';
  };
  var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

  /* ---------- Zip (ukomprimert) ---------- */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (a, b) { return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function build(book) {
    var styles = new Styles(), files = [], chartNo = 0, drawingNo = 0, defined = [];
    var types = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'];
    book.sheets.forEach(function (sh, i) {
      var n = i + 1, charts = sh.charts || [];
      files.push(['xl/worksheets/sheet' + n + '.xml', sheetXml(sh, styles, charts.length > 0)]);
      types.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      if (sh.filter) defined.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + esc(abs(sh.name, sh.filter)) + '</definedName>');
      if (!charts.length) return;
      var d = ++drawingNo;
      files.push(['xl/worksheets/_rels/sheet' + n + '.xml.rels', rels([[REL + 'drawing', '../drawings/drawing' + d + '.xml']])]);
      files.push(['xl/drawings/drawing' + d + '.xml', drawingXml(charts, chartNo)]);
      types.push('<Override PartName="/xl/drawings/drawing' + d + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
      var chartRels = charts.map(function (ch) {
        var c = ++chartNo;
        files.push(['xl/charts/chart' + c + '.xml', chartXml(ch, sh.name)]);
        types.push('<Override PartName="/xl/charts/chart' + c + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
        return [REL + 'chart', '../charts/chart' + c + '.xml'];
      });
      files.push(['xl/drawings/_rels/drawing' + d + '.xml.rels', rels(chartRels)]);
    });
    var stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return zip([
      ['[Content_Types].xml', XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + types.join('') + '</Types>'],
      ['_rels/.rels', rels([[REL + 'officeDocument', 'xl/workbook.xml'], ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml']])],
      ['docProps/core.xml', XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + esc(book.title || 'Treningsloggen') + '</dc:title><dc:creator>Treningsloggen</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + stamp + '</dcterms:created></cp:coreProperties>'],
      ['xl/workbook.xml', XML + '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_R + '"><bookViews><workbookView/></bookViews><sheets>' +
        book.sheets.map(function (sh, i) { return '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        (defined.length ? '<definedNames>' + defined.join('') + '</definedNames>' : '') + '</workbook>'],
      ['xl/_rels/workbook.xml.rels', rels(book.sheets.map(function (sh, i) { return [REL + 'worksheet', 'worksheets/sheet' + (i + 1) + '.xml']; }).concat([[REL + 'styles', 'styles.xml']]))],
      ['xl/styles.xml', styles.xml()],
    ].concat(files));
  }

  return {
    build: build,
    col: colName,
    // Dato (ÅÅÅÅ-MM-DD) som Excel-serienummer
    date: function (iso) { var p = iso.split('-'); return (Date.UTC(+p[0], p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 864e5; },
    // Sekunder som andel av et døgn (vises med formatet [m]:ss eller m:ss)
    secs: function (s) { return s == null ? null : s / 86400; },
  };
})();
