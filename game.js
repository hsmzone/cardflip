'use strict';
let characters = window.CARD_CHARACTERS || [];
let localUrls = [];
if (location.protocol === 'file:' && window.CARD_MASK_DATA) {
  document.documentElement.style.setProperty('--character-mask', `url("${window.CARD_MASK_DATA}")`);
}
async function loadCharacters() {
  if (location.protocol !== 'file:') {
    const localServer = ['localhost', '127.0.0.1'].includes(location.hostname);
    const response = await fetch(localServer ? '/api/characters' : './characters.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('이미지 목록을 읽을 수 없습니다. 새로고침 후 다시 시도해주세요.');
    characters = await response.json();
  }
  // Use the exact file name as the only source of display labels.
  characters = characters.map(character => ({ ...character, name: character.file.replace(/\.[^.]+$/, '') }));
  const status = document.querySelector('#library-status');
  status.textContent = `캐릭터 ${characters.length}종 · 매 게임 무작위 선택` +
    (location.protocol === 'file:' ? ' (폴더 자동 반영: start-game.bat으로 실행)' : ' · 최신 이미지 목록 반영');
  for (const option of difficulty.options) option.disabled = Number(option.value) > characters.length;
  if (Number(difficulty.value) > characters.length) {
    const available = Array.from(difficulty.options).filter(option => !option.disabled);
    difficulty.value = available.length ? available[available.length - 1].value : '';
  }
  document.querySelector('#start').disabled = characters.length < 6;
}
const board = document.querySelector('#board');
const difficulty = document.querySelector('#difficulty');
const pairsLabel = document.querySelector('#pairs');
const movesLabel = document.querySelector('#moves');
const timeLabel = document.querySelector('#time');
const message = document.querySelector('#message');
const setup = document.querySelector('#setup');
const play = document.querySelector('#play');
const result = document.querySelector('#result');
let active = false, pairCount = 6, flipDelay = 1050;
let first = null, locked = false, pairs = 0, moves = 0, startedAt = null, timer = null, pendingFlip = null;
// Pick the arrangement with the largest cards that fits the available board.
function chooseLayout(count, width, height, gap) {
  const ratio = 968 / 606;
  let best = { columns: 1, rows: count, cardWidth: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const cardWidth = Math.max(0, Math.min(
      (width - gap * (columns - 1)) / columns,
      (height - gap * (rows - 1)) / rows / ratio
    ));
    if (cardWidth > best.cardWidth) best = { columns, rows, cardWidth };
  }
  return best;
}
function fitBoard() {
  if (!active || !board.children.length) return;
  const gap = parseFloat(getComputedStyle(board).gap) || 0;
  const layout = chooseLayout(board.children.length, board.clientWidth, board.clientHeight, gap);
  const width = Math.floor(layout.cardWidth * 100) / 100;
  board.style.gridTemplateColumns = `repeat(${layout.columns}, ${width}px)`;
  board.style.gridTemplateRows = `repeat(${layout.rows}, ${width * 968 / 606}px)`;
  board.style.setProperty('--name-size', `${Math.min(innerWidth <= 700 ? 16 : 24, width * 0.14)}px`);
  board.style.setProperty('--name-stroke', `${Math.min(2, width * 0.008)}px`);
}
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function updateTime() {
  const elapsed = startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
  timeLabel.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
}
function makeCard(character, index) {
  const { name, file } = character;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.name = name;
  card.dataset.key = file;
  card.setAttribute('aria-label', `${index + 1}번 카드 뒤집기`);
  card.innerHTML = '<span class="card-inner"><span class="face back"></span><span class="face front"><span class="character-mask"><img class="character" alt="" draggable="false"></span><img class="ribbon" src="name.png" alt="" draggable="false"><span class="character-name"></span></span></span>';
  card.querySelector('.character').src = character.src || `cha/${encodeURIComponent(file)}`;
  card.querySelector('.character-name').textContent = name;
  card.addEventListener('click', () => flip(card, index));
  return card;
}
function flip(card, index) {
  if (!active || locked || card.classList.contains('is-open') || card.classList.contains('is-matched')) return;
  if (startedAt === null) { startedAt = Date.now(); timer = setInterval(updateTime, 1000); }
  card.classList.add('is-open');
  card.setAttribute('aria-label', `${index + 1}번 카드: ${card.dataset.name}`);
  if (!first) { first = card; message.textContent = '같은 모험가가 있는 카드를 찾아보세요.'; return; }
  moves++;
  movesLabel.textContent = moves;
  const previous = first;
  first = null;
  if (previous.dataset.key === card.dataset.key) {
    for (const matched of [previous, card]) {
      matched.classList.add('is-matched');
      matched.setAttribute('aria-disabled', 'true');
      matched.setAttribute('aria-label', `${matched.dataset.name}, 짝 찾기 완료`);
    }
    pairs++;
    pairsLabel.textContent = `${pairs} / ${pairCount}`;
    message.textContent = `${card.dataset.name}, 짝을 찾았어요!`;
    if (pairs === pairCount) {
      clearInterval(timer); updateTime();
      locked = true;
      pendingFlip = setTimeout(() => result.showModal(), 650);
      message.textContent = `모든 모험가를 찾았어요! ${moves}번의 시도 · ${timeLabel.textContent} 소요. 새 모험을 시작해 보세요.`;
    }
  } else {
    locked = true;
    message.textContent = '조금 달라요. 위치를 기억해 주세요!';
    pendingFlip = setTimeout(() => {
      for (const unmatched of [previous, card]) {
        unmatched.classList.remove('is-open');
        unmatched.setAttribute('aria-label', `${Array.from(board.children).indexOf(unmatched) + 1}번 카드 뒤집기`);
      }
      locked = false;
      message.textContent = '다시 두 장을 골라보세요.';
    }, flipDelay);
  }
}
function startGame() {
  clearInterval(timer); clearTimeout(pendingFlip);
  first = null; locked = false; pairs = 0; moves = 0; startedAt = null;
  pairCount = Number(difficulty.value);
  flipDelay = Number(document.querySelector('#flip-delay').value);
  active = true;
  setup.hidden = true;
  play.hidden = false;
  document.body.classList.add('is-playing');
  pairsLabel.textContent = `0 / ${pairCount}`;
  movesLabel.textContent = '0'; updateTime();
  message.textContent = '첫 카드를 골라 모험을 시작하세요.';
  const chosen = shuffle(characters).slice(0, pairCount);
  board.replaceChildren(...shuffle([...chosen, ...chosen]).map(makeCard));
  fitBoard();
  board.children[0].focus({ preventScroll: true });
}
function showSetup() {
  clearInterval(timer); clearTimeout(pendingFlip);
  active = false;
  if (result.open) result.close();
  play.hidden = true;
  setup.hidden = false;
  document.body.classList.remove('is-playing');
  board.replaceChildren();
  document.querySelector('#start').focus({ preventScroll: true });
}
document.querySelector('#settings').addEventListener('submit', async event => {
  event.preventDefault();
  const start = document.querySelector('#start');
  if (start.disabled) return;
  start.disabled = true;
  try {
    await loadCharacters();
    if (characters.length < 6) throw new Error('cha 폴더에 캐릭터 이미지를 최소 6개 넣어주세요.');
    history.pushState({ cardflipPlay: true }, '');
    startGame();
  } catch (error) {
    document.querySelector('#library-status').textContent = error.message;
  } finally {
    start.disabled = characters.length < 6;
  }
});
function leaveGame() {
  if (!active) return;
  showSetup();
  if (history.state?.cardflipPlay) history.back();
}
document.querySelector('#restart').addEventListener('click', leaveGame);
window.addEventListener('popstate', () => { if (active) showSetup(); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active) { event.preventDefault(); leaveGame(); }
});
result.addEventListener('cancel', event => { event.preventDefault(); leaveGame(); });
new ResizeObserver(fitBoard).observe(board);
window.addEventListener('resize', fitBoard);
document.querySelector('#folder-control').hidden = location.protocol !== 'file:';
document.querySelector('#character-folder').addEventListener('change', async event => {
  const files = Array.from(event.target.files).filter(file => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file.name));
  if (!files.length) return;
  localUrls.forEach(url => URL.revokeObjectURL(url));
  localUrls = [];
  characters = files.map(file => {
    const src = URL.createObjectURL(file);
    localUrls.push(src);
    return { file: file.name, src };
  });
  await loadCharacters();
});
loadCharacters().catch(error => { document.querySelector('#library-status').textContent = error.message; });
