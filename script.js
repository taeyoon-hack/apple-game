const BOARD_SIZE = 8;
const ROUND_SECONDS = 60;
const BEST_SCORE_KEY = "apple-orchard-best-score";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const timerElement = document.querySelector("#timer");
const timerBlockElement = document.querySelector("#timer-block");
const selectionLabelElement = document.querySelector("#selection-label");
const selectionSumElement = document.querySelector("#selection-sum");
const selectionReadoutElement = document.querySelector(".selection-readout");
const messageElement = document.querySelector("#game-message");
const startButton = document.querySelector("#start-button");
const startButtonLabel = document.querySelector("#start-button-label");
const roundIndicator = document.querySelector(".round-indicator");
const confettiLayer = document.querySelector("#confetti-layer");

let values = [];
let score = 0;
let bestScore = readBestScore();
let secondsLeft = ROUND_SECONDS;
let gameState = "ready";
let timerInterval = null;
let selectedCells = [];
let activePointerId = null;
let startedAt = 0;
let fallDistances = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
let confettiCleanupTimeout = null;

bestScoreElement.textContent = String(bestScore);
createBoard();
renderBoard();
updateSelectionReadout();

function readBestScore() {
  try {
    return Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

function createBoard() {
  values = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, randomApple);
  fallDistances = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
}

function randomApple() {
  return Math.floor(Math.random() * 9) + 1;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();
  const existingCell = boardElement.querySelector(".cell");
  const cellHeight = existingCell?.getBoundingClientRect().height ?? 0;
  const rowGap = Number.parseFloat(getComputedStyle(boardElement).rowGap) || 0;
  const rowStep = cellHeight + rowGap;

  values.forEach((value, index) => {
    const cell = document.createElement("button");
    const selected = selectedCells.includes(index);
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.disabled = gameState !== "playing" || value === null;

    if (value !== null && fallDistances[index] > 0) {
      cell.classList.add("is-falling");
      cell.style.setProperty("--fall-offset", `${-fallDistances[index] * rowStep}px`);
      cell.style.animationDelay = `${Math.min(fallDistances[index] * 20, 120)}ms`;
    }

    if (value === null) {
      cell.classList.add("is-empty");
      cell.setAttribute("aria-label", `${Math.floor(index / BOARD_SIZE) + 1}행 ${index % BOARD_SIZE + 1}열, 빈칸`);
    } else {
      const apple = document.createElement("span");
      const count = document.createElement("span");
      apple.className = "apple-fruit";
      apple.textContent = "🍎";
      apple.setAttribute("aria-hidden", "true");
      count.className = "apple-count";
      count.textContent = String(value);
      count.setAttribute("aria-hidden", "true");
      cell.append(apple, count);
      cell.setAttribute("aria-label", `${Math.floor(index / BOARD_SIZE) + 1}행 ${index % BOARD_SIZE + 1}열, ${value}`);
    }

    if (selected) {
      cell.classList.add("is-selected");
      cell.setAttribute("aria-pressed", "true");
    } else {
      cell.setAttribute("aria-pressed", "false");
    }

    fragment.append(cell);
  });

  boardElement.replaceChildren(fragment);
  fallDistances.fill(0);
}

function refillClearedCells(clearedIndices) {
  fallDistances.fill(0);

  clearedIndices.forEach((index) => {
    values[index] = randomApple();
    fallDistances[index] = 1;
  });
}

function celebrateNewRecord() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const colors = ["#cf4d3e", "#e9b858", "#456b45", "#5b9b8e", "#f28c45", "#f7d7a3"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 76; index += 1) {
    const piece = document.createElement("span");
    const isStreamer = index % 5 === 0;
    piece.className = `confetti-piece${index % 4 === 0 ? " is-round" : ""}${isStreamer ? " is-streamer" : ""}`;
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${isStreamer ? 4 : 5 + Math.random() * 7}px`;
    piece.style.height = `${isStreamer ? 17 + Math.random() * 9 : 7 + Math.random() * 7}px`;
    piece.style.setProperty("--confetti-drift", `${Math.round(Math.random() * 260 - 130)}px`);
    piece.style.setProperty("--confetti-spin", `${Math.round(Math.random() * 1080 - 540)}deg`);
    piece.style.setProperty("--confetti-duration", `${2.2 + Math.random() * 1.2}s`);
    piece.style.setProperty("--confetti-delay", `${Math.random() * 0.3}s`);
    fragment.append(piece);
  }

  window.clearTimeout(confettiCleanupTimeout);
  confettiLayer.replaceChildren(fragment);
  confettiCleanupTimeout = window.setTimeout(() => confettiLayer.replaceChildren(), 4000);
}

function startGame() {
  window.clearInterval(timerInterval);
  createBoard();
  selectedCells = [];
  score = 0;
  secondsLeft = ROUND_SECONDS;
  gameState = "playing";
  startedAt = Date.now();
  scoreElement.textContent = "0";
  timerElement.textContent = "01:00";
  timerBlockElement.classList.remove("is-urgent");
  roundIndicator.classList.add("is-playing");
  startButtonLabel.textContent = "다시 시작";
  messageElement.textContent = "이웃한 숫자를 이어 합을 만들어보세요.";
  selectionLabelElement.textContent = "합계";
  selectionReadoutElement.classList.remove("is-valid", "is-invalid");
  updateSelectionReadout();
  renderBoard();
  timerInterval = window.setInterval(updateTimer, 200);
}

function updateTimer() {
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  secondsLeft = Math.max(0, ROUND_SECONDS - elapsedSeconds);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  timerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerBlockElement.classList.toggle("is-urgent", secondsLeft <= 10);

  if (secondsLeft === 0) {
    endGame();
  }
}

function endGame() {
  gameState = "finished";
  selectedCells = [];
  window.clearInterval(timerInterval);
  timerInterval = null;
  roundIndicator.classList.remove("is-playing");
  startButtonLabel.textContent = "한 판 더 하기";
  messageElement.textContent = `수확 종료! 이번 점수는 ${score}점입니다.`;
  selectionLabelElement.textContent = "합계";
  selectionReadoutElement.classList.remove("is-valid", "is-invalid");
  updateSelectionReadout();
  renderBoard();
}

function updateSelectionReadout() {
  const sum = selectedCells.reduce((total, index) => total + (values[index] ?? 0), 0);
  selectionSumElement.textContent = String(sum);
  selectionReadoutElement.classList.toggle("is-valid", sum > 0 && sum % 10 === 0);
  selectionReadoutElement.classList.toggle("is-invalid", sum > 0 && sum % 10 !== 0);

  if (sum > 0 && sum % 10 === 0) {
    selectionLabelElement.textContent = "수확 가능";
  } else {
    selectionLabelElement.textContent = "합계";
  }
}

function cellIndexFromTarget(target) {
  const cell = target instanceof Element ? target.closest(".cell") : null;
  if (!cell || !boardElement.contains(cell)) {
    return null;
  }
  return Number(cell.dataset.index);
}

function areAdjacent(firstIndex, secondIndex) {
  const rowDistance = Math.abs(Math.floor(firstIndex / BOARD_SIZE) - Math.floor(secondIndex / BOARD_SIZE));
  const columnDistance = Math.abs((firstIndex % BOARD_SIZE) - (secondIndex % BOARD_SIZE));
  return Math.max(rowDistance, columnDistance) === 1;
}

function extendSelection(index) {
  if (index === null || values[index] === null || selectedCells.at(-1) === index) {
    return;
  }

  if (selectedCells.length > 1 && selectedCells.at(-2) === index) {
    selectedCells.pop();
  } else if (!selectedCells.includes(index) && areAdjacent(selectedCells.at(-1), index)) {
    selectedCells.push(index);
  }

  renderBoard();
  updateSelectionReadout();
}

function finishSelection() {
  if (selectedCells.length === 0) {
    return;
  }

  const sum = selectedCells.reduce((total, index) => total + values[index], 0);
  if (sum > 0 && sum % 10 === 0) {
    const clearedIndices = [...selectedCells];
    clearedIndices.forEach((index) => {
      values[index] = null;
    });
    refillClearedCells(clearedIndices);
    score += sum;
    scoreElement.textContent = String(score);
    messageElement.textContent = `${clearedIndices.length}개의 사과를 수확했어요. +${sum}점`;

    if (score > bestScore) {
      bestScore = score;
      bestScoreElement.textContent = String(bestScore);
      saveBestScore();
      celebrateNewRecord();
    }
  } else {
    messageElement.textContent = sum === 0 ? "빈칸은 이어서 선택할 수 없어요." : `합이 ${sum}이에요. 10의 배수를 만들어보세요.`;
  }

  selectedCells = [];
  selectionLabelElement.textContent = "합계";
  selectionReadoutElement.classList.remove("is-valid", "is-invalid");
  updateSelectionReadout();
  renderBoard();
}

boardElement.addEventListener("pointerdown", (event) => {
  if (gameState !== "playing" || event.button !== 0) {
    return;
  }

  const index = cellIndexFromTarget(event.target);
  if (index === null || values[index] === null) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  selectedCells = [index];
  boardElement.setPointerCapture(event.pointerId);
  renderBoard();
  updateSelectionReadout();
});

boardElement.addEventListener("pointermove", (event) => {
  if (event.pointerId !== activePointerId || selectedCells.length === 0) {
    return;
  }

  const target = document.elementFromPoint(event.clientX, event.clientY);
  extendSelection(cellIndexFromTarget(target));
});

boardElement.addEventListener("pointerup", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }

  activePointerId = null;
  finishSelection();
});

boardElement.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }

  activePointerId = null;
  selectedCells = [];
  selectionLabelElement.textContent = "합계";
  selectionReadoutElement.classList.remove("is-valid", "is-invalid");
  updateSelectionReadout();
  renderBoard();
});

boardElement.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === activePointerId) {
    activePointerId = null;
    selectedCells = [];
    updateSelectionReadout();
    renderBoard();
  }
});

boardElement.addEventListener("contextmenu", (event) => event.preventDefault());
startButton.addEventListener("click", startGame);