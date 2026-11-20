(function (root) {
  const PATTERNS = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20],[0,4,20,24]
  ];

  function seededRandom(seed) {
    let value = seed | 0;
    return function () {
      value |= 0;
      value = value + 0x6D2B79F5 | 0;
      let next = Math.imul(value ^ value >>> 15, 1 | value);
      next = next + Math.imul(next ^ next >>> 7, 61 | next) ^ next;
      return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
  }

  function generateCard(id) {
    const random = seededRandom(Number(id) * 7919);
    const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
    const numbers = Array(25).fill(0);

    ranges.forEach(([low, high], column) => {
      const pool = Array.from({ length: high - low + 1 }, (_, index) => low + index);
      const picked = [];
      for (let index = 0; index < 5; index++) {
        picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
      }
      picked.sort((left, right) => left - right);
      for (let row = 0; row < 5; row++) {
        const cell = row * 5 + column;
        numbers[cell] = cell === 12 ? 0 : picked[row];
      }
    });

    return { id: Number(id), numbers };
  }

  function getWinningNumber(card, calledNumbers) {
    if (!card || !Array.isArray(card.numbers) || card.numbers.length !== 25 || !Array.isArray(calledNumbers)) return null;
    const called = new Set(calledNumbers.map(Number).filter(Number.isFinite));
    const completed = PATTERNS.find(pattern => pattern.every(index => index === 12 || called.has(card.numbers[index])));
    if (!completed) return null;

    for (let index = calledNumbers.length - 1; index >= 0; index--) {
      const value = Number(calledNumbers[index]);
      if (completed.some(cell => cell !== 12 && card.numbers[cell] === value)) return value;
    }
    return null;
  }

  function findWinners(cards, calledNumbers) {
    if (!Array.isArray(cards)) return [];
    return cards.flatMap(card => {
      const winningNumber = getWinningNumber(card, calledNumbers);
      return winningNumber === null ? [] : [{ cardId: card.id, winningNumber }];
    });
  }

  function drawNumber(calledNumbers, random = Math.random) {
    const called = new Set((Array.isArray(calledNumbers) ? calledNumbers : []).map(Number));
    const remaining = Array.from({ length: 75 }, (_, index) => index + 1).filter(number => !called.has(number));
    if (!remaining.length) return null;
    const sample = Number(random());
    const index = Math.min(remaining.length - 1, Math.max(0, Math.floor(sample * remaining.length)));
    return remaining[index];
  }

  function getAudioFilename(number) {
    const value = Number(number);
    if (!Number.isInteger(value) || value < 1 || value > 75) return null;
    const letter = value <= 15 ? 'b' : value <= 30 ? 'i' : value <= 45 ? 'n' : value <= 60 ? 'g' : 'o';
    return `${letter}${value}.mp3`;
  }

  function normalizeCallInterval(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 1) return 10;
    return Math.min(120, value);
  }

  function migrateLegacyCallInterval(seconds, version) {
    const value = Number(seconds);
    if (Number(version) >= 2) {
      if (!Number.isFinite(value) || value < 1) return 10;
      return Math.min(120, value);
    }
    if (!Number.isFinite(value) || value < 8) return 10;
    return normalizeCallInterval(value);
  }

  const api = { generateCard, getWinningNumber, findWinners, drawNumber, getAudioFilename, normalizeCallInterval, migrateLegacyCallInterval };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OfflineBingo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);