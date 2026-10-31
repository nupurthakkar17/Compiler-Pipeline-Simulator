# Compiler Pipeline Simulator
Mini project for Compiler Design.

Run: open index.html in a browser (Chrome / Edge / Firefox).

Files: index.html (page), style.css (styling), script.js (all compiler phases).

Phases: Lexical -> Syntax -> Semantic -> Intermediate Code -> Optimization -> Code Generation -> Execution

Grammar:
  statement -> IDENT = expr ; | print expr ;
  expr      -> term ((+|-) term)*
  term      -> factor ((*|/) factor)*
  factor    -> NUMBER | IDENT | ( expr ) | - factor
