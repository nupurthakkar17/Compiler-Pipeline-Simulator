// Mini compiler for a very small language
// Example:  a = 5 + 3 * 2;   print a;

var phaseNames = [
  "Lexical Analysis",
  "Syntax Analysis",
  "Semantic Analysis",
  "Intermediate Code Generation",
  "Code Optimization",
  "Code Generation",
  "Execution"
];

var phaseInfo = [
  "Breaks the source code into tokens.",
  "Checks the grammar and builds the syntax tree (AST).",
  "Checks that variables are declared before use and makes the symbol table.",
  "Converts the tree into three address code.",
  "Does constant folding and removes unused temporary variables.",
  "Converts the optimized code into assembly instructions.",
  "Runs the assembly code on a small virtual machine."
];

var examples = [
  "a = 5 + 3 * 2;\nb = a - 4;\nprint b;\nprint (a + b) / 2;",
  "x = 10;\ny = x * 2 + 1;\nz = y - x;\nprint z;",
  "a = 4;\nprint a + c;",
  "a = 4 +* 2;",
  "a = 4 @ 2;"
];

function loadExample() {
  var n = document.getElementById("examples").value;
  document.getElementById("source").value = examples[n];
  runCompiler();
}

// ---------- Phase 1 : Lexical Analysis ----------
function lexer(code) {
  var tokens = [];
  var i = 0;
  while (i < code.length) {
    var ch = code[i];
    if (ch == " " || ch == "\n" || ch == "\t" || ch == "\r") {
      i++;
      continue;
    }
    var m = /^(\d+(\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[=+\-*\/();])/.exec(code.slice(i));
    if (m == null) {
      throw { phase: 0, msg: "Invalid character '" + ch + "' at position " + i };
    }
    var text = m[0];
    var type;
    if (/^[0-9]/.test(text)) type = "NUMBER";
    else if (text == "print") type = "KEYWORD";
    else if (/^[A-Za-z_]/.test(text)) type = "IDENTIFIER";
    else if (text == "=") type = "ASSIGN";
    else if (text == "(") type = "LPAREN";
    else if (text == ")") type = "RPAREN";
    else if (text == ";") type = "SEMICOLON";
    else type = "OPERATOR";
    tokens.push({ type: type, text: text });
    i = i + text.length;
  }
  return tokens;
}

// ---------- Phase 2 : Syntax Analysis (recursive descent) ----------
// expr   -> term ((+|-) term)*
// term   -> factor ((*|/) factor)*
// factor -> NUMBER | IDENTIFIER | ( expr ) | - factor
var tokens, pos;

function peek() {
  return tokens[pos];
}

function expect(type) {
  var t = tokens[pos];
  if (t == undefined) {
    throw { phase: 1, msg: "Expected " + type + " but reached end of program" };
  }
  if (t.type != type) {
    throw { phase: 1, msg: "Expected " + type + " but found '" + t.text + "'" };
  }
  pos++;
  return t;
}

function parseFactor() {
  var t = peek();
  if (t == undefined) throw { phase: 1, msg: "Unexpected end of program" };
  if (t.type == "NUMBER") {
    pos++;
    return { kind: "num", value: parseFloat(t.text) };
  }
  if (t.type == "IDENTIFIER") {
    pos++;
    return { kind: "var", name: t.text };
  }
  if (t.type == "LPAREN") {
    pos++;
    var e = parseExpr();
    expect("RPAREN");
    return e;
  }
  if (t.text == "-") {
    pos++;
    return { kind: "op", op: "-", left: { kind: "num", value: 0 }, right: parseFactor() };
  }
  throw { phase: 1, msg: "Unexpected token '" + t.text + "'" };
}

function parseTerm() {
  var left = parseFactor();
  while (peek() != undefined && (peek().text == "*" || peek().text == "/")) {
    var op = tokens[pos].text;
    pos++;
    var right = parseFactor();
    left = { kind: "op", op: op, left: left, right: right };
  }
  return left;
}

function parseExpr() {
  var left = parseTerm();
  while (peek() != undefined && (peek().text == "+" || peek().text == "-")) {
    var op = tokens[pos].text;
    pos++;
    var right = parseTerm();
    left = { kind: "op", op: op, left: left, right: right };
  }
  return left;
}

function parser(tokenList) {
  tokens = tokenList;
  pos = 0;
  var program = [];
  while (pos < tokens.length) {
    var t = peek();
    if (t.type == "KEYWORD") {
      pos++;
      var e = parseExpr();
      expect("SEMICOLON");
      program.push({ kind: "print", expr: e });
    } else if (t.type == "IDENTIFIER") {
      pos++;
      expect("ASSIGN");
      var e2 = parseExpr();
      expect("SEMICOLON");
      program.push({ kind: "assign", name: t.text, expr: e2 });
    } else {
      throw { phase: 1, msg: "A statement cannot start with '" + t.text + "'" };
    }
  }
  return program;
}

// prints the tree using indentation
function treeText(node, level) {
  var space = "";
  for (var i = 0; i < level; i++) space += "    ";
  var s = "";
  if (node.kind == "num") s = space + "Number " + node.value + "\n";
  else if (node.kind == "var") s = space + "Variable " + node.name + "\n";
  else if (node.kind == "op") {
    s = space + "Operator " + node.op + "\n";
    s += treeText(node.left, level + 1) + treeText(node.right, level + 1);
  } else if (node.kind == "assign") {
    s = space + "Assign " + node.name + "\n" + treeText(node.expr, level + 1);
  } else if (node.kind == "print") {
    s = space + "Print\n" + treeText(node.expr, level + 1);
  }
  return s;
}

// ---------- Phase 3 : Semantic Analysis ----------
function checkExpr(e, symbols) {
  if (e.kind == "var" && symbols.indexOf(e.name) == -1) {
    throw { phase: 2, msg: "Variable '" + e.name + "' is used before it is assigned" };
  }
  if (e.kind == "op") {
    checkExpr(e.left, symbols);
    checkExpr(e.right, symbols);
  }
}

function semanticAnalysis(program) {
  var symbols = [];
  for (var i = 0; i < program.length; i++) {
    var s = program[i];
    checkExpr(s.expr, symbols);
    if (s.kind == "assign" && symbols.indexOf(s.name) == -1) {
      symbols.push(s.name);
    }
  }
  return symbols;
}

// ---------- Phase 4 : Intermediate Code (three address code) ----------
var tempCount;
var tac;

function genExpr(e) {
  if (e.kind == "num") return e.value;
  if (e.kind == "var") return e.name;
  var a = genExpr(e.left);
  var b = genExpr(e.right);
  tempCount++;
  var temp = "t" + tempCount;
  tac.push({ type: "op", result: temp, op: e.op, a: a, b: b });
  return temp;
}

function generateTAC(program) {
  tempCount = 0;
  tac = [];
  for (var i = 0; i < program.length; i++) {
    var s = program[i];
    var v = genExpr(s.expr);
    if (s.kind == "assign") tac.push({ type: "copy", result: s.name, a: v });
    else tac.push({ type: "print", a: v });
  }
  return tac;
}

function tacText(list) {
  var s = "";
  for (var i = 0; i < list.length; i++) {
    var x = list[i];
    if (x.type == "op") s += x.result + " = " + x.a + " " + x.op + " " + x.b + "\n";
    else if (x.type == "copy") s += x.result + " = " + x.a + "\n";
    else s += "print " + x.a + "\n";
  }
  return s;
}

// ---------- Phase 5 : Optimization ----------
function calculate(op, a, b) {
  if (op == "+") return a + b;
  if (op == "-") return a - b;
  if (op == "*") return a * b;
  return a / b;
}

function isNumber(x) {
  return typeof x == "number";
}

function isTemp(name) {
  return /^t[0-9]+$/.test(name);
}

function optimize(list) {
  var known = {};   // variables whose value is known at compile time
  var result = [];

  // constant folding + constant propagation
  for (var i = 0; i < list.length; i++) {
    var x = { type: list[i].type, result: list[i].result, op: list[i].op, a: list[i].a, b: list[i].b };
    if (known[x.a] !== undefined) x.a = known[x.a];
    if (x.b !== undefined && known[x.b] !== undefined) x.b = known[x.b];

    if (x.type == "op" && isNumber(x.a) && isNumber(x.b) && !(x.op == "/" && x.b == 0)) {
      x = { type: "copy", result: x.result, a: parseFloat(calculate(x.op, x.a, x.b).toFixed(10)) };
    }
    if (x.type == "copy") {
      if (isNumber(x.a)) known[x.result] = x.a;
      else delete known[x.result];
    } else if (x.type == "op") {
      delete known[x.result];
    }
    result.push(x);
  }

  // dead code removal: remove temporaries that are never used
  var changed = true;
  while (changed) {
    changed = false;
    var used = [];
    for (var j = 0; j < result.length; j++) {
      if (typeof result[j].a == "string") used.push(result[j].a);
      if (typeof result[j].b == "string") used.push(result[j].b);
    }
    var newList = [];
    for (var k = 0; k < result.length; k++) {
      var r = result[k];
      if (r.result != undefined && isTemp(r.result) && used.indexOf(r.result) == -1) {
        changed = true;
      } else {
        newList.push(r);
      }
    }
    result = newList;
  }
  return result;
}

// ---------- Phase 6 : Code Generation ----------
// machine has only one register R1
function generateAssembly(list) {
  var names = { "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV" };
  var asm = [];
  for (var i = 0; i < list.length; i++) {
    var x = list[i];
    if (x.type == "op") {
      asm.push({ ins: "LOAD", arg: x.a });
      asm.push({ ins: names[x.op], arg: x.b });
      asm.push({ ins: "STORE", arg: x.result });
    } else if (x.type == "copy") {
      asm.push({ ins: "LOAD", arg: x.a });
      asm.push({ ins: "STORE", arg: x.result });
    } else {
      asm.push({ ins: "OUT", arg: x.a });
    }
  }
  return asm;
}

function asmText(asm) {
  var s = "";
  for (var i = 0; i < asm.length; i++) {
    if (asm[i].ins == "STORE") s += "STORE " + asm[i].arg + ", R1\n";
    else if (asm[i].ins == "OUT") s += "OUT   " + asm[i].arg + "\n";
    else s += asm[i].ins + "   R1, " + asm[i].arg + "\n";
  }
  return s;
}

// ---------- Phase 7 : Execution ----------
function execute(asm) {
  var memory = {};
  var output = [];
  var R1 = 0;

  function getValue(x) {
    if (isNumber(x)) return x;
    if (memory[x] === undefined) throw { phase: 6, msg: "Variable " + x + " has no value" };
    return memory[x];
  }

  for (var i = 0; i < asm.length; i++) {
    var ins = asm[i].ins;
    var arg = asm[i].arg;
    if (ins == "LOAD") R1 = getValue(arg);
    else if (ins == "STORE") memory[arg] = R1;
    else if (ins == "OUT") output.push(parseFloat(getValue(arg).toFixed(10)));
    else {
      var v = getValue(arg);
      if (ins == "DIV" && v == 0) throw { phase: 6, msg: "Runtime error: division by zero" };
      if (ins == "ADD") R1 = R1 + v;
      if (ins == "SUB") R1 = R1 - v;
      if (ins == "MUL") R1 = R1 * v;
      if (ins == "DIV") R1 = R1 / v;
    }
  }
  return { output: output, memory: memory };
}

// ---------- Main ----------
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function runCompiler() {
  var code = document.getElementById("source").value;
  var outputs = [];
  var errorPhase = -1;
  var errorMsg = "";

  try {
    var tokenList = lexer(code);
    var s1 = "";
    for (var i = 0; i < tokenList.length; i++) {
      s1 += (i + 1) + "   " + tokenList[i].type + "   " + tokenList[i].text + "\n";
    }
    outputs[0] = s1;

    var program = parser(tokenList);
    var treeStr = "Program\n";
    for (var p = 0; p < program.length; p++) treeStr += treeText(program[p], 1);
    outputs[1] = treeStr;

    var symbols = semanticAnalysis(program);
    outputs[2] = "Symbol Table:\n" + symbols.join("\n") + "\n\nNo semantic errors found.";

    var icode = generateTAC(program);
    outputs[3] = tacText(icode);

    var optimized = optimize(icode);
    outputs[4] = tacText(optimized) + "\nInstructions: " + icode.length + " before, " + optimized.length + " after optimization";

    var asm = generateAssembly(optimized);
    outputs[5] = asmText(asm);

    var res = execute(asm);
    var s7 = "Output:\n" + res.output.join("\n") + "\n\nVariables:\n";
    for (var name in res.memory) {
      if (!isTemp(name)) s7 += name + " = " + parseFloat(res.memory[name].toFixed(10)) + "\n";
    }
    outputs[6] = s7;
  } catch (e) {
    if (e.phase === undefined) throw e;
    errorPhase = e.phase;
    errorMsg = e.msg;
  }

  var html = "";
  for (var n = 0; n < 7; n++) {
    var cls = "phase";
    var body = "";
    if (errorPhase == -1 || n < errorPhase) {
      body = "<pre>" + escapeHtml(outputs[n]) + "</pre>";
    } else if (n == errorPhase) {
      cls = "phase error";
      body = "<pre>Error: " + escapeHtml(errorMsg) + "</pre>";
    } else {
      cls = "phase skipped";
      body = "Skipped because of the error above.";
    }
    html += "<div class='" + cls + "'><h3>Phase " + (n + 1) + ": " + phaseNames[n] + "</h3>" +
            "<p>" + phaseInfo[n] + "</p>" + body + "</div>";
  }
  document.getElementById("result").innerHTML = html;
}

// load the first example when page opens
document.getElementById("source").value = examples[0];
runCompiler();
