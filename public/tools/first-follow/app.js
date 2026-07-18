(function () {
  "use strict";

  const EPSILON = "ε";
  const EOF = "$";

  const MESSAGES = {
    ko: {
      missingLhs: (line) => `${line}번째 줄에서 왼쪽 비단말 기호를 찾지 못했습니다.`,
      emptyGrammar: "계산할 문법을 입력해 주세요.",
      invalidProduction: (line) => `${line}번째 생성 규칙 형식이 올바르지 않습니다.`,
      undefinedNonTerminals: (symbols) => `정의되지 않은 비단말 기호: ${symbols}`,
      calculated: "계산이 완료되었습니다.",
      copied: "계산 결과를 복사했습니다.",
      copyFailed: "복사하지 못했습니다. 브라우저 권한을 확인해 주세요.",
      unparsedLeft: (count) => `버전 A에서 ${count}줄을 해석하지 못했습니다.`,
      unparsedRight: (count) => `버전 B에서 ${count}줄을 해석하지 못했습니다.`,
      noDifference: "차이점이 없습니다.",
      empty: "없음",
    },
    en: {
      missingLhs: (line) => `Could not find a left-hand nonterminal on line ${line}.`,
      emptyGrammar: "Enter a grammar to calculate.",
      invalidProduction: (line) => `Production ${line} is not in a valid format.`,
      undefinedNonTerminals: (symbols) => `Undefined nonterminals: ${symbols}`,
      calculated: "Calculation complete.",
      copied: "Results copied.",
      copyFailed: "Could not copy the results. Check your browser permissions.",
      unparsedLeft: (count) => `${count} line(s) in version A could not be parsed.`,
      unparsedRight: (count) => `${count} line(s) in version B could not be parsed.`,
      noDifference: "No differences found.",
      empty: "None",
    },
  };

  const SAMPLE_GRAMMAR = `
    <program> ::= <function_list>
    <function_list> ::= <function_declr> <function_list> | ε
    <declr> ::= <function_declr> | <variable_declr>
    <function_declr> ::= 2 0 5 <param_list> 6 <function_content>
    <param_list> ::= 3 | <param> 0 <param_having>
    <param_having> ::= 62 <param> 0 <param_having> | ε
    <param> ::= 2
    <function_content> ::= <block> | 9
    <block> ::= 7 <instr_list> 8
    <instr_list> ::= <instr> <instr_list> | ε
    <instr> ::= <content> | <declr> | <goto> | <label>
    <content> ::= 4 <exp> 9 | <exp> 9 | 9 | 49 5 <exp> 6 <instr> <else> | <block> | 57 9 | 58 9 | 55 5 <exp> 6 <instr> | 54 <instr> 55 5 <exp> 6 9 | 56 5 <for_init> <for_exp> 9 <for_exp> 6 <instr>
    <else> ::= 50 <instr> | ε
    <goto> ::= 53 0 9
    <label> ::= 0 52
    <variable_declr> ::= 2 0 <assign> 9
    <assign> ::= 33 <exp> | ε
    <for_init> ::= <variable_declr> | <exp> 9 | 9
    <for_exp> ::= <exp> | ε
    <exp> ::= <factor> | <exp> <binary_op> <exp> | <exp> 51 <exp> 52 <exp>
    <factor> ::= 1 | 0 <ident_postfix> | <unary_op> <factor> | 5 <exp> 6
    <ident_postfix> ::= 13 | 44 | 5 <argument_list> 6 | ε
    <argument_list> ::= <exp> <argument> | ε
    <argument> ::= 62 <exp> <argument> | ε
    <unary_op> ::= 10 | 11 | 13 | 24 | 44
    <binary_op> ::= 11 | 14 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23
                    25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33
                    34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43
  `.trim();

  function parseGrammar(input, messages = MESSAGES.ko) {
    const rawLines = input.replace(/\r\n?/g, "\n").split("\n");
    const logicalLines = [];
    let current = "";

    rawLines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;

      if (line.includes("::=")) {
        if (current) logicalLines.push(current);
        current = line;
        return;
      }

      if (!current) {
        throw new Error(messages.missingLhs(index + 1));
      }

      const separator = shouldInsertAlternativeSeparator(current, line) ? " | " : " ";
      current += `${separator}${line}`;
    });

    if (current) logicalLines.push(current);
    if (!logicalLines.length) {
      throw new Error(messages.emptyGrammar);
    }

    const nonTerminals = [];
    const nonTerminalSet = new Set();
    const productions = [];

    logicalLines.forEach((line, index) => {
      const match = line.match(/^(<[^>]+>)\s*::=\s*(.+)$/);
      if (!match) {
        throw new Error(messages.invalidProduction(index + 1));
      }

      const lhs = match[1];
      if (!nonTerminalSet.has(lhs)) {
        nonTerminalSet.add(lhs);
        nonTerminals.push(lhs);
      }
    });

    logicalLines.forEach((line) => {
      const match = line.match(/^(<[^>]+>)\s*::=\s*(.+)$/);
      if (!match) return;
      const [, lhs, rhs] = match;
      const alternatives = rhs.split("|").map((part) => tokenizeAlternative(part.trim()));
      alternatives.forEach((symbols) => productions.push({ lhs, symbols }));
    });

    const terminals = new Set();
    const undefinedNonTerminals = new Set();
    productions.forEach(({ symbols }) => {
      symbols.forEach((symbol) => {
        if (symbol === EPSILON) return;
        if (isNonTerminal(symbol)) {
          if (!nonTerminalSet.has(symbol)) undefinedNonTerminals.add(symbol);
          return;
        }
        terminals.add(symbol);
      });
    });

    return {
      start: nonTerminals[0],
      nonTerminals,
      nonTerminalSet,
      productions,
      terminals,
      undefinedNonTerminals,
    };
  }

  function shouldInsertAlternativeSeparator(current, nextLine) {
    if (nextLine.startsWith("|") || current.trim().endsWith("|")) return false;
    return current.includes("|") && nextLine.includes("|");
  }

  function tokenizeAlternative(text) {
    if (!text || text === EPSILON) return [EPSILON];
    const tokens = text.match(/<[^>]+>|ε|\S+/g) || [];
    return tokens.length ? tokens : [EPSILON];
  }

  function isNonTerminal(symbol) {
    return /^<[^>]+>$/.test(symbol);
  }

  function computeFirst(grammar) {
    const first = createSetMap(grammar.nonTerminals);
    let changed = true;

    while (changed) {
      changed = false;
      grammar.productions.forEach(({ lhs, symbols }) => {
        const before = first.get(lhs).size;
        addFirstOfSequence(symbols, first, grammar.nonTerminalSet, first.get(lhs));
        if (first.get(lhs).size !== before) changed = true;
      });
    }

    return first;
  }

  function addFirstOfSequence(symbols, first, nonTerminalSet, target) {
    if (!symbols.length || symbols.every((symbol) => symbol === EPSILON)) {
      target.add(EPSILON);
      return;
    }

    let canBeEmpty = true;
    for (const symbol of symbols) {
      if (symbol === EPSILON) {
        target.add(EPSILON);
        canBeEmpty = false;
        break;
      }

      if (!nonTerminalSet.has(symbol)) {
        target.add(symbol);
        canBeEmpty = false;
        break;
      }

      const symbolFirst = first.get(symbol) || new Set();
      addAll(target, symbolFirst, EPSILON);
      if (!symbolFirst.has(EPSILON)) {
        canBeEmpty = false;
        break;
      }
    }

    if (canBeEmpty) target.add(EPSILON);
  }

  function computeFollow(grammar, first) {
    const follow = createSetMap(grammar.nonTerminals);
    follow.get(grammar.start).add(EOF);

    let changed = true;
    while (changed) {
      changed = false;

      grammar.productions.forEach(({ lhs, symbols }) => {
        let trailer = new Set(follow.get(lhs));

        for (let index = symbols.length - 1; index >= 0; index -= 1) {
          const symbol = symbols[index];
          if (symbol === EPSILON) continue;

          if (grammar.nonTerminalSet.has(symbol)) {
            const before = follow.get(symbol).size;
            addAll(follow.get(symbol), trailer);
            if (follow.get(symbol).size !== before) changed = true;

            const symbolFirst = first.get(symbol) || new Set();
            if (symbolFirst.has(EPSILON)) {
              const nextTrailer = new Set(trailer);
              addAll(nextTrailer, symbolFirst, EPSILON);
              trailer = nextTrailer;
            } else {
              trailer = without(symbolFirst, EPSILON);
            }
          } else {
            trailer = new Set([symbol]);
          }
        }
      });
    }

    return follow;
  }

  function calculateFirstFollow(input, messages = MESSAGES.ko) {
    const grammar = parseGrammar(input, messages);
    const first = computeFirst(grammar);
    const follow = computeFollow(grammar, first);
    const warnings = [];

    if (grammar.undefinedNonTerminals.size) {
      warnings.push(
        messages.undefinedNonTerminals(
          sortSymbols([...grammar.undefinedNonTerminals]).join(", "),
        ),
      );
    }

    return { grammar, first, follow, warnings };
  }

  function formatFirstFollow(result) {
    const { grammar, first, follow } = result;
    const firstLines = grammar.nonTerminals.map(
      (nonTerminal) => `\tFIRST(${nonTerminal}) = ${formatSet(first.get(nonTerminal))}`,
    );
    const followLines = grammar.nonTerminals.map(
      (nonTerminal) => `\tFOLLOW(${nonTerminal}) = ${formatSet(follow.get(nonTerminal))}`,
    );
    return `${firstLines.join("\n")}\n\n${followLines.join("\n")}`;
  }

  function formatCFirstFollow(result) {
    const { grammar, first, follow } = result;
    return [
      formatCFunction("first", grammar.nonTerminals, first),
      formatCFunction("follow", grammar.nonTerminals, follow),
    ].join("\n\n");
  }

  function formatCFunction(functionName, nonTerminals, setMap) {
    const lines = [`int ${functionName}(int input_token, int nt_set){`, "    switch(nt_set){"];

    nonTerminals.forEach((nonTerminal) => {
      lines.push(`        case ${toNtConstant(nonTerminal)}:`);
      lines.push(`            return ${formatCCondition(setMap.get(nonTerminal))};`);
    });

    lines.push("        default:");
    lines.push("            return 0;");
    lines.push("    }");
    lines.push("}");
    return lines.join("\n");
  }

  function formatCCondition(set) {
    const tokens = sortSymbols([...set])
      .filter((token) => token !== EPSILON)
      .map((token) => (token === EOF ? "999" : token));

    if (!tokens.length) return "0";
    return `(${tokens.map((token) => `input_token == ${token}`).join(" || ")})`;
  }

  function toNtConstant(nonTerminal) {
    const body = nonTerminal
      .replace(/[<>]/g, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    return `NT_${body}`;
  }

  function formatSet(set) {
    return `{${sortSymbols([...set]).join(", ")}}`;
  }

  function sortSymbols(symbols) {
    return [...symbols].sort(compareSymbols);
  }

  function compareSymbols(left, right) {
    if (left === right) return 0;
    if (left === EOF) return -1;
    if (right === EOF) return 1;
    if (left === EPSILON) return 1;
    if (right === EPSILON) return -1;

    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const leftNumeric = Number.isFinite(leftNumber) && String(leftNumber) === left;
    const rightNumeric = Number.isFinite(rightNumber) && String(rightNumber) === right;

    if (leftNumeric && rightNumeric) return leftNumber - rightNumber;
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left.localeCompare(right, "ko");
  }

  function createSetMap(keys) {
    return new Map(keys.map((key) => [key, new Set()]));
  }

  function addAll(target, source, except) {
    source.forEach((value) => {
      if (value !== except) target.add(value);
    });
  }

  function without(source, except) {
    const result = new Set();
    addAll(result, source, except);
    return result;
  }

  function parseFirstFollowText(input) {
    const entries = new Map();
    const unparsed = [];
    const lines = input.replace(/\r\n?/g, "\n").split("\n");

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;

      const match = line.match(/^(FIRST|FOLLOW)\s*\(\s*(<[^>]+>)\s*\)\s*=\s*\{([^}]*)\}\s*$/);
      if (!match) {
        unparsed.push({ line: index + 1, text: line });
        return;
      }

      const [, kind, nonTerminal, body] = match;
      const tokens = body
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      entries.set(`${kind}:${nonTerminal}`, {
        kind,
        nonTerminal,
        tokens: new Set(tokens),
      });
    });

    return { entries, unparsed };
  }

  function compareFirstFollow(leftText, rightText) {
    const left = parseFirstFollowText(leftText);
    const right = parseFirstFollowText(rightText);
    const keys = new Set([...left.entries.keys(), ...right.entries.keys()]);
    const differences = [];

    sortComparisonKeys([...keys]).forEach((key) => {
      const leftEntry = left.entries.get(key);
      const rightEntry = right.entries.get(key);

      if (!leftEntry || !rightEntry) {
        differences.push({
          key: formatComparisonKey(leftEntry || rightEntry),
          left: leftEntry ? sortSymbols([...leftEntry.tokens]) : [],
          right: rightEntry ? sortSymbols([...rightEntry.tokens]) : [],
          removed: leftEntry ? sortSymbols([...leftEntry.tokens]) : [],
          added: rightEntry ? sortSymbols([...rightEntry.tokens]) : [],
        });
        return;
      }

      const removed = [...leftEntry.tokens].filter((token) => !rightEntry.tokens.has(token));
      const added = [...rightEntry.tokens].filter((token) => !leftEntry.tokens.has(token));

      if (removed.length || added.length) {
        differences.push({
          key: formatComparisonKey(leftEntry),
          left: sortSymbols([...leftEntry.tokens]),
          right: sortSymbols([...rightEntry.tokens]),
          removed: sortSymbols(removed),
          added: sortSymbols(added),
        });
      }
    });

    return {
      differences,
      leftUnparsed: left.unparsed,
      rightUnparsed: right.unparsed,
    };
  }

  function sortComparisonKeys(keys) {
    return keys.sort((left, right) => {
      const [leftKind, leftNt] = left.split(":");
      const [rightKind, rightNt] = right.split(":");
      if (leftKind !== rightKind) return leftKind === "FIRST" ? -1 : 1;
      return leftNt.localeCompare(rightNt, "ko");
    });
  }

  function formatComparisonKey(entry) {
    return `${entry.kind}(${entry.nonTerminal})`;
  }

  function boot() {
    const root = document.querySelector("[data-first-follow]");
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const language = document.documentElement.lang === "en" ? "en" : "ko";
    const messages = MESSAGES[language];
    const grammarInput = root.querySelector("#grammar-input");
    const resultOutput = root.querySelector("#result-output");
    const codeOutput = root.querySelector("#code-output");
    const messageOutput = root.querySelector("#messages");
    const leftInput = root.querySelector("#ff-left");
    const rightInput = root.querySelector("#ff-right");
    const diffOutput = root.querySelector("#diff-output");

    grammarInput.value = SAMPLE_GRAMMAR;

    root.querySelector("#load-sample").addEventListener("click", () => {
      grammarInput.value = SAMPLE_GRAMMAR;
      runCalculation();
    });

    root.querySelector("#clear-grammar").addEventListener("click", () => {
      grammarInput.value = "";
      resultOutput.textContent = "";
      codeOutput.textContent = "";
      setMessage("");
      grammarInput.focus();
    });

    root.querySelector("#calculate").addEventListener("click", runCalculation);

    root.querySelector("#copy-result").addEventListener("click", async () => {
      const text = [resultOutput.textContent, codeOutput.textContent]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (!text) return;

      const copied = await copyText(text);
      setMessage(copied ? messages.copied : messages.copyFailed, !copied);
    });

    root.querySelector("#clear-compare").addEventListener("click", () => {
      leftInput.value = "";
      rightInput.value = "";
      diffOutput.innerHTML = "";
      leftInput.focus();
    });

    root.querySelector("#compare-button").addEventListener("click", () => {
      renderDiff(compareFirstFollow(leftInput.value, rightInput.value), diffOutput, messages);
    });

    runCalculation();

    function runCalculation() {
      try {
        const result = calculateFirstFollow(grammarInput.value, messages);
        const formatted = formatFirstFollow(result);
        resultOutput.textContent = formatted;
        codeOutput.textContent = formatCFirstFollow(result);
        leftInput.value = leftInput.value || formatted;
        setMessage(result.warnings.length ? result.warnings.join(" / ") : messages.calculated);
      } catch (error) {
        resultOutput.textContent = "";
        codeOutput.textContent = "";
        setMessage(error instanceof Error ? error.message : String(error), true);
      }
    }

    function setMessage(text, isError = false) {
      messageOutput.textContent = text;
      messageOutput.classList.toggle("error", isError);
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function renderDiff(result, container, messages) {
    container.innerHTML = "";

    const warnings = [];
    if (result.leftUnparsed.length) warnings.push(messages.unparsedLeft(result.leftUnparsed.length));
    if (result.rightUnparsed.length) warnings.push(messages.unparsedRight(result.rightUnparsed.length));

    if (warnings.length) {
      const warning = document.createElement("div");
      warning.className = "status-line warn";
      warning.textContent = warnings.join(" ");
      container.appendChild(warning);
    }

    if (!result.differences.length) {
      const empty = document.createElement("div");
      empty.className = "status-line";
      empty.textContent = messages.noDifference;
      container.appendChild(empty);
      return;
    }

    const summary = document.createElement("div");
    summary.className = "diff-summary";

    result.differences.forEach((difference) => {
      const row = document.createElement("div");
      row.className = "diff-row";
      row.appendChild(createKeyCell(difference.key));
      row.appendChild(createTokenCell("A", difference.left, difference.removed, "removed", messages));
      row.appendChild(createTokenCell("B", difference.right, difference.added, "added", messages));
      summary.appendChild(row);
    });

    container.appendChild(summary);
  }

  function createKeyCell(key) {
    const cell = document.createElement("div");
    cell.className = "diff-cell diff-key";
    cell.textContent = key;
    return cell;
  }

  function createTokenCell(label, tokens, highlighted, className, messages) {
    const cell = document.createElement("div");
    cell.className = "diff-cell";

    const list = document.createElement("div");
    list.className = "token-list";
    list.setAttribute("aria-label", label);

    const highlightedSet = new Set(highlighted);
    if (!tokens.length) {
      const empty = document.createElement("span");
      empty.className = "token";
      empty.textContent = messages.empty;
      list.appendChild(empty);
    } else {
      tokens.forEach((token) => {
        const chip = document.createElement("span");
        chip.className = highlightedSet.has(token) ? `token ${className}` : "token";
        chip.textContent = token;
        list.appendChild(chip);
      });
    }

    cell.appendChild(list);
    return cell;
  }

  globalThis.FirstFollowApp = {
    EPSILON,
    EOF,
    SAMPLE_GRAMMAR,
    parseGrammar,
    calculateFirstFollow,
    formatFirstFollow,
    formatCFirstFollow,
    compareFirstFollow,
    parseFirstFollowText,
    sortSymbols,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
