(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.BinaryMifApp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WIDTH = 32;
  const DEPTH = 8192;
  const DEFAULT_INSTRUCTION = "FC000000";
  const LAST_ADDRESS = DEPTH - 1;

  const MESSAGES = {
    ko: {
      invalidCharacter: (line) => `${line}번째 줄: 0과 1 이외의 문자가 있습니다.`,
      invalidWidth: (line, width) => `${line}번째 줄: ${width}비트입니다. 32비트가 필요합니다.`,
      emptyInput: "변환할 이진 명령어를 입력해 주세요.",
      tooMany: (count) => `명령어가 ${count}개입니다. 최대 ${DEPTH}개까지 변환할 수 있습니다.`,
      count: (count) => `${count.toLocaleString("ko-KR")}개 명령어`,
      converted: (count, fill) => `${count.toLocaleString("ko-KR")}개 명령어를 변환했습니다. 남은 ${fill.toLocaleString("ko-KR")}개 주소는 ${DEFAULT_INSTRUCTION}으로 채웠습니다.`,
      changed: "입력 내용을 변경했습니다. 다시 변환해 주세요.",
      cleared: "입력 내용을 비웠습니다.",
      copied: "변환 결과를 클립보드에 복사했습니다.",
      copyFailed: "복사하지 못했습니다. 결과를 선택해 직접 복사해 주세요.",
      downloaded: "memory.mif 파일을 다운로드했습니다.",
    },
    en: {
      invalidCharacter: (line) => `Line ${line}: contains characters other than 0 and 1.`,
      invalidWidth: (line, width) => `Line ${line}: contains ${width} bits; exactly 32 are required.`,
      emptyInput: "Enter binary instructions to convert.",
      tooMany: (count) => `There are ${count} instructions. The maximum is ${DEPTH}.`,
      count: (count) => `${count.toLocaleString("en-US")} instruction${count === 1 ? "" : "s"}`,
      converted: (count, fill) => `Converted ${count.toLocaleString("en-US")} instruction${count === 1 ? "" : "s"}. Filled the remaining ${fill.toLocaleString("en-US")} addresses with ${DEFAULT_INSTRUCTION}.`,
      changed: "Input changed. Convert again to update the result.",
      cleared: "Input cleared.",
      copied: "Conversion result copied to the clipboard.",
      copyFailed: "Could not copy. Select the result and copy it manually.",
      downloaded: "Downloaded memory.mif.",
    },
  };

  const SAMPLE_BINARY = [
    "1100_1110_0000_0000_0000_0011_0101_0100",
    "1011_0100_1111_1110_1111_1111_0010_0000",
    "1011_0100_1111_1110_1101_1111_0001_1100",
    "0000_0000_1101_0000_1110_0000_0000_0000",
    "0000_0110_1110_1101_1111_1111_0001_1000",
    "0000_0010_0001_0000_0000_0000_0000_0001",
  ].join("\n");

  function parseBinaryLines(input, messages = MESSAGES.ko) {
    const instructions = [];
    const errors = [];
    const lines = String(input).replace(/\r\n?/g, "\n").split("\n");

    lines.forEach((rawLine, index) => {
      const withoutComment = rawLine.replace(/\/\/.*$|#.*$/g, "").trim();
      if (!withoutComment) return;

      const binary = withoutComment.replace(/[\s_]/g, "").replace(/^0b/i, "");
      if (!/^[01]+$/.test(binary)) {
        errors.push(messages.invalidCharacter(index + 1));
        return;
      }

      if (binary.length !== WIDTH) {
        errors.push(messages.invalidWidth(index + 1, binary.length));
        return;
      }

      instructions.push(binary);
    });

    if (!instructions.length && !errors.length) {
      errors.push(messages.emptyInput);
    }

    if (instructions.length > DEPTH) {
      errors.push(messages.tooMany(instructions.length));
    }

    if (errors.length) {
      throw new Error(errors.slice(0, 5).join("\n"));
    }

    return instructions;
  }

  function binaryToHex(binary) {
    return Number.parseInt(binary, 2).toString(16).toUpperCase().padStart(WIDTH / 4, "0");
  }

  function formatAddress(address) {
    const digits = LAST_ADDRESS.toString(16).length;
    return address.toString(16).toUpperCase().padStart(digits, "0");
  }

  function convertBinaryToMif(input, messages = MESSAGES.ko) {
    const instructions = parseBinaryLines(input, messages);
    const lines = [
      `WIDTH=${WIDTH};`,
      `DEPTH=${DEPTH};`,
      "ADDRESS_RADIX=HEX;",
      "DATA_RADIX=HEX;",
      "CONTENT begin",
    ];

    instructions.forEach((binary, address) => {
      lines.push(`    ${formatAddress(address)} : ${binaryToHex(binary)};`);
    });

    if (instructions.length < DEPTH) {
      lines.push(
        `    [${formatAddress(instructions.length)}..${formatAddress(LAST_ADDRESS)}] : ${DEFAULT_INSTRUCTION};`,
      );
    }

    lines.push("END;");
    return {
      mif: lines.join("\n"),
      instructionCount: instructions.length,
      fillCount: DEPTH - instructions.length,
    };
  }

  function countNonEmptyLines(input) {
    return String(input)
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line) => line.replace(/\/\/.*$|#.*$/g, "").trim()).length;
  }

  function boot() {
    const container = document.querySelector("[data-binary-mif]");
    if (!container || container.dataset.initialized === "true") return;
    container.dataset.initialized = "true";

    const language = document.documentElement.lang === "en" ? "en" : "ko";
    const messages = MESSAGES[language];
    const binaryInput = container.querySelector("#binary-input");
    const mifOutput = container.querySelector("#mif-output");
    const inputCount = container.querySelector("#input-count");
    const message = container.querySelector("#message");
    const copyButton = container.querySelector("#copy-output");
    const downloadButton = container.querySelector("#download-output");

    function setMessage(text, state = "") {
      message.textContent = text;
      message.className = `message${state ? ` ${state}` : ""}`;
    }

    function updateCount() {
      const count = countNonEmptyLines(binaryInput.value);
      inputCount.textContent = messages.count(count);
    }

    function clearResult() {
      mifOutput.value = "";
      copyButton.disabled = true;
      downloadButton.disabled = true;
    }

    function runConversion() {
      try {
        const result = convertBinaryToMif(binaryInput.value, messages);
        mifOutput.value = result.mif;
        copyButton.disabled = false;
        downloadButton.disabled = false;
        setMessage(
          messages.converted(result.instructionCount, result.fillCount),
          "success",
        );
      } catch (error) {
        clearResult();
        setMessage(error instanceof Error ? error.message : String(error), "error");
      }
    }

    binaryInput.addEventListener("input", () => {
      updateCount();
      clearResult();
      setMessage(messages.changed);
    });

    container.querySelector("#load-sample").addEventListener("click", () => {
      binaryInput.value = SAMPLE_BINARY;
      updateCount();
      runConversion();
    });

    container.querySelector("#clear-input").addEventListener("click", () => {
      binaryInput.value = "";
      clearResult();
      updateCount();
      setMessage(messages.cleared);
      binaryInput.focus();
    });

    container.querySelector("#convert").addEventListener("click", runConversion);

    copyButton.addEventListener("click", async () => {
      if (!mifOutput.value) return;

      let copied = false;
      try {
        await navigator.clipboard.writeText(mifOutput.value);
        copied = true;
      } catch (_error) {
        mifOutput.focus();
        mifOutput.select();
        try {
          copied = document.execCommand("copy");
        } catch (_fallbackError) {
          copied = false;
        }
      }

      setMessage(copied ? messages.copied : messages.copyFailed, copied ? "success" : "error");
    });

    downloadButton.addEventListener("click", () => {
      if (!mifOutput.value) return;

      const blob = new Blob([mifOutput.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "memory.mif";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(messages.downloaded, "success");
    });

    updateCount();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  return {
    WIDTH,
    DEPTH,
    DEFAULT_INSTRUCTION,
    SAMPLE_BINARY,
    parseBinaryLines,
    binaryToHex,
    formatAddress,
    convertBinaryToMif,
  };
});
