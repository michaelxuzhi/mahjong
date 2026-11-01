(() => {
    'use strict';

    const SUITS = [
        { key: 'wan', label: '万', max: 9 },
        { key: 'tiao', label: '条', max: 9 },
        { key: 'tong', label: '筒', max: 9 },
    ];
    const HONORS = [
        { key: 'feng', value: '东风', label: '东风' },
        { key: 'feng', value: '南风', label: '南风' },
        { key: 'feng', value: '西风', label: '西风' },
        { key: 'feng', value: '北风', label: '北风' },
        { key: 'jian', value: '红中', label: '红中' },
        { key: 'jian', value: '发财', label: '发财' },
        { key: 'jian', value: '白板', label: '白板' },
    ];
    const NAMES = ['你', '阿强', '小雅', '老陈'];
    const state = {
        wall: [],
        hands: [[], [], [], []],
        discards: [[], [], [], []],
        river: [],
        melds: [[], [], [], []],
        winInfo: null,
        ruleMode: 'guangdong',
        pendingUpgradeGang: null,
        current: 0,
        selected: null,
        newTileId: null,
        lastDiscard: null,
        pending: null,
        claimActionIndex: 0,
        claimActionSignature: '',
        phase: 'draw',
        round: 0,
        score: 0,
        finished: false,
        actionNotes: ['', '', '', ''],
        actionTokens: [0, 0, 0, 0],
        sound: true,
        turnToken: 0,
    };
    const $ = id => document.getElementById(id);

    function makeDeck() {
        const deck = [];
        for (const suit of SUITS)
            for (let n = 1; n <= suit.max; n++)
                for (let copy = 0; copy < 4; copy++)
                    deck.push({
                        id: `${suit.key}${n}-${copy}`,
                        key: `${suit.key}${n}`,
                        suit: suit.key,
                        value: String(n),
                        label: `${n}${suit.label}`,
                        rank: n,
                    });
        for (const honor of HONORS)
            for (let copy = 0; copy < 4; copy++)
                deck.push({
                    id: `${honor.key}${honor.value}-${copy}`,
                    key: `${honor.key}${honor.value}`,
                    suit: honor.key,
                    value: honor.value,
                    label: honor.label,
                    rank: 0,
                });
        if (state.ruleMode === 'ghost')
            for (let copy = 0; copy < 4; copy++)
                deck.push({
                    id: `ghost-${copy}`,
                    key: 'ghost',
                    suit: 'ghost',
                    value: '鬼',
                    label: '鬼牌',
                    rank: 0,
                });
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
    function sortHand(hand) {
        const order = { wan: 0, tiao: 1, tong: 2, feng: 3, jian: 4, ghost: 5 };
        return hand.sort(
            (a, b) =>
                order[a.suit] - order[b.suit] ||
                a.rank - b.rank ||
                a.value.localeCompare(b.value)
        );
    }
    function countsFor(hand) {
        const counts = new Map();
        for (const tile of hand) counts.set(tile.key, (counts.get(tile.key) || 0) + 1);
        return counts;
    }
    function tileFromKey(key) {
        if (key === 'ghost') {
            return {
                id: `ghost-preview`,
                key: 'ghost',
                suit: 'ghost',
                value: '鬼',
                label: '鬼牌',
                rank: 0,
            };
        }
        if (key.startsWith('wan')) {
            const rank = Number(key.replace('wan', ''));
            return {
                id: `${key}-preview`,
                key,
                suit: 'wan',
                value: String(rank),
                label: `${rank}万`,
                rank,
            };
        }
        if (key.startsWith('tiao')) {
            const rank = Number(key.replace('tiao', ''));
            return {
                id: `${key}-preview`,
                key,
                suit: 'tiao',
                value: String(rank),
                label: `${rank}条`,
                rank,
            };
        }
        if (key.startsWith('tong')) {
            const rank = Number(key.replace('tong', ''));
            return {
                id: `${key}-preview`,
                key,
                suit: 'tong',
                value: String(rank),
                label: `${rank}筒`,
                rank,
            };
        }
        if (key.startsWith('feng')) {
            const label = key.replace('feng', '');
            return {
                id: `${key}-preview`,
                key,
                suit: 'feng',
                value: label,
                label,
                rank: 0,
            };
        }
        if (key.startsWith('jian')) {
            const label = key.replace('jian', '');
            return {
                id: `${key}-preview`,
                key,
                suit: 'jian',
                value: label,
                label,
                rank: 0,
            };
        }
        return {
            id: `${key}-preview`,
            key,
            suit: 'ghost',
            value: key,
            label: key,
            rank: 0,
        };
    }
    function getHandDisplayOrder(hand) {
        const ordered = sortHand([...hand]);
        const newTileIndex = ordered.findIndex(tile => tile.id === state.newTileId);
        if (newTileIndex >= 0) ordered.push(ordered.splice(newTileIndex, 1)[0]);
        return ordered;
    }
    function moveSelectedTile(delta) {
        if (state.current !== 0 || state.phase !== 'discard' || state.finished) return;
        const visible = getHandDisplayOrder(state.hands[0]);
        if (!visible.length) return;
        const currentId = state.selected || state.newTileId || visible[0]?.id || null;
        let index = visible.findIndex(tile => tile.id === currentId);
        if (index < 0) index = 0;
        index = (index + delta + visible.length) % visible.length;
        state.selected = visible[index].id;
        render();
    }
    function findWinningPattern(tiles) {
        const counts = countsFor(tiles.filter(tile => tile.key !== 'ghost'));
        const wildCount = tiles.filter(tile => tile.key === 'ghost').length;
        function findGroups(jokers) {
            const first = [...counts].find(([, count]) => count > 0)?.[0];
            if (!first) {
                if (jokers % 3 !== 0) return null;
                return Array.from({ length: jokers / 3 }, () => [
                    'ghost',
                    'ghost',
                    'ghost',
                ]);
            }
            const tile = tileFromKey(first);
            const count = counts.get(first);
            const tripletUse = Math.min(3, count);
            const tripletJokers = 3 - tripletUse;
            if (tripletJokers <= jokers) {
                counts.set(first, count - tripletUse);
                const rest = findGroups(jokers - tripletJokers);
                counts.set(first, count);
                if (rest) return [[first, first, first], ...rest];
            }
            if (['wan', 'tiao', 'tong'].includes(tile.suit)) {
                for (
                    let start = Math.max(1, tile.rank - 2);
                    start <= Math.min(tile.rank, 7);
                    start++
                ) {
                    const keys = [start, start + 1, start + 2].map(
                        rank => `${tile.suit}${rank}`
                    );
                    const changes = [];
                    let missing = 0;
                    for (const key of keys) {
                        const have = counts.get(key) || 0;
                        if (have) {
                            changes.push([key, have]);
                            counts.set(key, have - 1);
                        } else missing++;
                    }
                    const rest = missing <= jokers ? findGroups(jokers - missing) : null;
                    for (const [key, countBefore] of changes)
                        counts.set(key, countBefore);
                    if (rest) return [keys, ...rest];
                }
            }
            return null;
        }
        const pairKeys = [...counts.keys()];
        if (wildCount >= 2) pairKeys.push('ghost');
        for (const key of pairKeys) {
            const count = key === 'ghost' ? 0 : counts.get(key) || 0;
            const used = Math.min(2, count);
            const needed = 2 - used;
            if (needed > wildCount) continue;
            if (used) counts.set(key, count - used);
            const rest = findGroups(wildCount - needed);
            if (used) counts.set(key, count);
            if (rest) return [[key, key], ...rest];
        }
        return null;
    }
    function getReadyWaitInfo() {
        const hand = sortHand([...state.hands[0]]);
        if (!hand.length || state.finished) return null;
        const visibleCounts = visibleTileCounts();
        const meldCount = state.melds[0].length;
        const waitingHandSize = (4 - meldCount) * 3 + 1;
        const discardOptions =
            hand.length === waitingHandSize + 1
                ? hand.map(tile => ({
                      hand: hand.filter(other => other.id !== tile.id),
                      discard: tile,
                  }))
                : hand.length === waitingHandSize
                ? [{ hand, discard: null }]
                : [];
        const results = [];
        for (const option of discardOptions) {
            const candidates = [];
            for (const key of possibleTileKeys()) {
                const tile = tileFromKey(key);
                if (tile.key === 'ghost' && state.ruleMode !== 'ghost') continue;
                const remaining = remainingCopies(tile, visibleCounts);
                if (remaining <= 0) continue;
                const completedHand = [...option.hand, tile];
                if (!canWin(completedHand, meldCount)) continue;
                candidates.push({
                    key,
                    label: tile.label,
                    remaining,
                    patterns: findWinningPattern(completedHand) || [],
                });
            }
            if (!candidates.length) continue;
            candidates.sort(
                (a, b) => b.remaining - a.remaining || a.label.localeCompare(b.label)
            );
            results.push({
                entries: candidates.slice(0, 6),
                discard: option.discard,
                copies: candidates.reduce(
                    (sum, candidate) => sum + candidate.remaining,
                    0
                ),
            });
        }
        results.sort((a, b) => b.copies - a.copies);
        return results[0] || null;
    }
    function possibleTileKeys() {
        const keys = [];
        for (const suit of SUITS)
            for (let n = 1; n <= suit.max; n++) keys.push(`${suit.key}${n}`);
        for (const honor of HONORS) keys.push(`${honor.key}${honor.value}`);
        if (state.ruleMode === 'ghost') keys.push('ghost');
        return keys;
    }
    function canWin(hand, meldCount = 0) {
        if (hand.length !== (4 - meldCount) * 3 + 2) return false;
        const wildCount =
            state.ruleMode === 'ghost' ? hand.filter(t => t.key === 'ghost').length : 0;
        const counts = countsFor(hand.filter(t => t.key !== 'ghost'));
        const tileByKey = new Map(
            hand.filter(t => t.key !== 'ghost').map(t => [t.key, t])
        );
        function groups(jokers) {
            let first;
            for (const [key, count] of counts)
                if (count) {
                    first = key;
                    break;
                }
            if (!first) return jokers % 3 === 0;
            const tile = tileByKey.get(first);
            const count = counts.get(first);
            const tripletTiles = Math.min(3, count);
            const tripletJokers = 3 - tripletTiles;
            if (tripletJokers <= jokers) {
                counts.set(first, count - tripletTiles);
                if (groups(jokers - tripletJokers)) return true;
                counts.set(first, count);
            }
            if (['wan', 'tiao', 'tong'].includes(tile.suit)) {
                for (
                    let start = Math.max(1, tile.rank - 2);
                    start <= Math.min(tile.rank, 7);
                    start++
                ) {
                    const keys = [start, start + 1, start + 2].map(
                        rank => `${tile.suit}${rank}`
                    );
                    let neededJokers = 0;
                    const used = [];
                    for (const key of keys) {
                        const have = counts.get(key) || 0;
                        if (have) {
                            counts.set(key, have - 1);
                            used.push([key, have]);
                        } else neededJokers++;
                    }
                    if (neededJokers <= jokers && groups(jokers - neededJokers))
                        return true;
                    for (const [key, have] of used) counts.set(key, have);
                }
            }
            return false;
        }
        for (const [key, count] of counts) {
            const pairTiles = Math.min(2, count);
            const pairJokers = 2 - pairTiles;
            if (pairJokers <= wildCount) {
                counts.set(key, count - pairTiles);
                if (groups(wildCount - pairJokers)) return true;
                counts.set(key, count);
            }
        }
        if (wildCount >= 2 && groups(wildCount - 2)) return true;
        return false;
    }
    function tileUnicode(tile) {
        if (tile.suit === 'wan')
            return String.fromCodePoint(0x1f006 + tile.rank) + '\uFE0E';
        if (tile.suit === 'tiao')
            return String.fromCodePoint(0x1f00f + tile.rank) + '\uFE0E';
        if (tile.suit === 'tong')
            return String.fromCodePoint(0x1f018 + tile.rank) + '\uFE0E';
        if (tile.suit === 'feng') {
            const index = ['东风', '南风', '西风', '北风'].indexOf(tile.value);
            return String.fromCodePoint(0x1f000 + Math.max(0, index)) + '\uFE0E';
        }
        if (tile.suit === 'jian') {
            const index = ['红中', '发财', '白板'].indexOf(tile.value);
            return String.fromCodePoint(0x1f004 + Math.max(0, index)) + '\uFE0E';
        }
        return String.fromCodePoint(0x1f02b) + '\uFE0E';
    }
    function tileMarkup(tile, mini = false, waiting = false) {
        return `<div class="tile ${mini ? 'mini ' : ''}suit-${tile.suit} ${
            waiting ? 'wait-tile' : ''
        }" ${
            mini
                ? ''
                : `data-id="${tile.id}" role="button" tabindex="0" aria-label="${tile.label}"`
        } aria-label="${tile.label}"><span class="tile-unicode">${tileUnicode(
            tile
        )}</span></div>`;
    }
    function visibleTileCounts() {
        const counts = new Map();
        const add = tile => counts.set(tile.key, (counts.get(tile.key) || 0) + 1);
        for (const tile of state.hands[0]) add(tile);
        for (const entry of state.river) if (!entry.claimed) add(entry.tile);
        for (const melds of state.melds)
            for (const meld of melds) for (const tile of meld.tiles) add(tile);
        return counts;
    }
    function remainingCopies(tile, visibleCounts) {
        const total = 4;
        return Math.max(0, total - (visibleCounts.get(tile.key) || 0));
    }
    function backTiles(count, horizontal = true) {
        return `<div class="seat-count ${horizontal ? '' : 'vertical'}">${Array.from(
            { length: count },
            () => '<i class="back-tile"></i>'
        ).join('')}</div>`;
    }
    function addHistory(text, tileLabel = '') {
        const list = $('historyList');
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
        ).padStart(2, '0')}`;
        if (list.querySelector('.empty-history')) list.innerHTML = '';
        list.insertAdjacentHTML(
            'afterbegin',
            `<div class="history-item"><time>${time}</time><span>${text}${
                tileLabel ? ` <strong class="history-tile">${tileLabel}</strong>` : ''
            }</span></div>`
        );
        while (list.children.length > 6) list.lastElementChild.remove();
    }
    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => el.classList.remove('show'), 2100);
    }
    function showSeatAction(player, label, tileLabel = '') {
        const note = tileLabel ? `${label} ${tileLabel}` : label;
        state.actionNotes[player] = note;
        const token = ++state.actionTokens[player];
        render();
        setTimeout(() => {
            if (state.actionTokens[player] !== token) return;
            state.actionNotes[player] = '';
            render();
        }, 2600);
    }
    function celebrateWin(winner, kind) {
        const overlay = $('winCelebration');
        $('winTitle').textContent = winner === 0 ? '大胡！' : `${NAMES[winner]}胡牌！`;
        $('winSubtitle').textContent =
            winner === 0 ? `${kind} · 好手气，漂亮胡牌！` : `${kind} · 本局结束`;
        const confetti = $('winConfetti');
        const colors = ['#f5d477', '#f8f2d5', '#ee816b', '#64d6a0', '#8ccaff', '#d2a4ff'];
        confetti.innerHTML = Array.from({ length: 72 }, (_, index) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.9;
            const duration = 1.8 + Math.random() * 1.8;
            const color = colors[index % colors.length];
            const size = 6 + Math.random() * 11;
            return `<i style="--left:${left}%;--delay:${delay}s;--duration:${duration}s;--color:${color};--size:${size}px"></i>`;
        }).join('');
        overlay.classList.remove('celebrating');
        void overlay.offsetWidth;
        overlay.classList.add('celebrating');
        clearTimeout(celebrateWin.timer);
        celebrateWin.timer = setTimeout(
            () => overlay.classList.remove('celebrating'),
            4500
        );
    }
    function render() {
        $('wallCount').textContent = state.wall.length;
        $('roundNumber').textContent = state.round;
        $('ruleSelect').value = state.ruleMode;
        $('ruleDescription').textContent =
            state.ruleMode === 'ghost'
                ? '四张鬼牌，可代任意牌组成胡牌牌型'
                : '标准广东推倒胡';
        $('playerScore').textContent = state.score > 0 ? `+${state.score}` : state.score;
        $('handCount').textContent = state.hands[0].length;
        const sortedHand = getHandDisplayOrder(state.hands[0]);
        const userTurn =
            state.current === 0 && !state.finished && state.phase === 'discard';
        if (!userTurn) {
            state.selected = null;
        } else {
            if (!state.selected && state.newTileId) state.selected = state.newTileId;
            if (!state.selected && sortedHand.length) state.selected = sortedHand[0].id;
            if (
                state.selected &&
                !state.hands[0].some(tile => tile.id === state.selected)
            ) {
                state.selected = state.newTileId || sortedHand[0]?.id || null;
            }
        }
        const visibleCounts = visibleTileCounts();
        const readyInfo = getReadyWaitInfo();
        const readyPanel = $('readyPanel');
        if (readyInfo) {
            readyPanel.hidden = false;
            readyPanel.innerHTML = `<div class="ready-heading">听牌组合</div><div class="ready-list">${readyInfo.entries
                .map(entry => {
                    let fadedWaitTile = false;
                    const patterns = entry.patterns
                        .map(
                            group =>
                                `<span class="ready-pattern">${group
                                    .map(key => {
                                        const isWaitTile =
                                            !fadedWaitTile && key === entry.key;
                                        if (isWaitTile) fadedWaitTile = true;
                                        return tileMarkup(
                                            tileFromKey(key),
                                            true,
                                            isWaitTile
                                        );
                                    })
                                    .join('')}</span>`
                        )
                        .join('');
                    return `<div class="ready-option"><span class="ready-chip">${entry.label}<em>余${entry.remaining}</em></span><div class="ready-patterns">${patterns}</div></div>`;
                })
                .join('')}</div>${
                readyInfo.discard
                    ? `<div class="ready-miss">建议打出 ${readyInfo.discard.label} 后听牌</div>`
                    : ''
            }`;
        } else if (!state.finished) {
            readyPanel.hidden = false;
            readyPanel.innerHTML =
                '<div class="ready-heading">听牌组合</div><div class="ready-miss">当前手牌暂无可胡组合</div>';
        } else {
            readyPanel.hidden = false;
            readyPanel.innerHTML =
                '<div class="ready-heading">听牌提示</div><div class="ready-miss">本局已结束</div>';
        }
        $('playerHand').innerHTML = sortedHand
            .map(
                tile =>
                    `<div class="hand-tile-wrap ${
                        tile.id === state.newTileId ? 'new-draw' : ''
                    }" title="${tile.label}，可见剩余 ${remainingCopies(
                        tile,
                        visibleCounts
                    )} 张">${tileMarkup(
                        tile
                    )}<span class="tile-remaining">余${remainingCopies(
                        tile,
                        visibleCounts
                    )}</span></div>`
            )
            .join('');
        $('playerHand')
            .querySelectorAll('.tile')
            .forEach(el =>
                el.classList.toggle('selected', el.dataset.id === state.selected)
            );
        $('playerMelds').innerHTML = state.melds[0]
            .map(
                meld =>
                    `<div class="meld"><span class="meld-kind">${
                        meld.type === 'gang' ? '杠' : '碰'
                    }</span>${meld.tiles.map(t => tileMarkup(t, true)).join('')}</div>`
            )
            .join('');
        for (let seat = 1; seat < 4; seat++) {
            const seatEl = $(`seat-${seat}`);
            const index = seat;
            const active = state.current === index && !state.finished;
            const counts = backTiles(state.hands[index].length, seat === 2);
            const label = `<div class="seat-avatar ${active ? 'active' : ''}">${
                NAMES[index][0]
            }</div><div class="seat-label"><strong>${NAMES[index]}</strong><small>${
                ['', '西家', '北家', '东家'][index]
            } · ${
                state.melds[index].length
                    ? `${state.melds[index].length} 副`
                    : active
                    ? '出牌中'
                    : '等待中'
            }</small></div>`;
            const action = state.actionNotes[index]
                ? `<div class="seat-action-bubble">${state.actionNotes[index]}</div>`
                : '';
            const publicMelds = state.melds[index].length
                ? `<div class="seat-melds">${state.melds[index]
                      .map(
                          meld =>
                              `<div class="seat-meld"><span>${
                                  meld.type === 'gang' ? '杠' : '碰'
                              }</span>${meld.tiles
                                  .map(tile => tileMarkup(tile, true))
                                  .join('')}</div>`
                      )
                      .join('')}</div>`
                : '';
            seatEl.innerHTML = `${label}${counts}${publicMelds}${action}`;
        }
        $('discardArea').innerHTML = state.river
            .map(
                entry =>
                    `<div class="river-entry ${entry.claimed ? 'claimed' : ''}" title="${
                        NAMES[entry.player]
                    }打出${entry.tile.label}${
                        entry.claimed ? '（已被碰杠）' : ''
                    }"><span class="river-owner owner-${entry.player}">${
                        NAMES[entry.player][0]
                    }</span>${tileMarkup(entry.tile, true)}</div>`
            )
            .join('');
        const youTurn = state.current === 0 && !state.finished;
        $('playerStatus').textContent = state.finished
            ? '本局结束，点击开启下一局'
            : state.pending
            ? '可以响应'
            : youTurn
            ? state.phase === 'draw'
                ? '等待摸牌'
                : '请打出一张'
            : '等待对手';
        $('turnHint').textContent = state.finished
            ? '本局结束，点击开启下一局'
            : state.pending
            ? '选择操作，或跳过本次机会'
            : state.pendingUpgradeGang
            ? `摸到${state.pendingUpgradeGang.tile.label}，可将碰牌补杠`
            : youTurn
            ? state.phase === 'draw'
                ? '轮到你，正在自动摸牌…'
                : '方向键选牌 · 空格打出选中牌'
            : `${NAMES[state.current]}正在思考…`;
        $('tableMessage').textContent = state.finished
            ? '牌局结束 · 点击下方开启下一局'
            : state.pending
            ? `${NAMES[state.pending.from]}打出${state.pending.tile.label}，你可以响应`
            : state.pendingUpgradeGang
            ? `你摸到${state.pendingUpgradeGang.tile.label}，可以补杠`
            : youTurn
            ? state.phase === 'draw'
                ? '轮到你摸牌'
                : '请打出一张牌'
            : `${NAMES[state.current]}的回合`;
        $('claimActions').hidden = !state.pending && !state.pendingUpgradeGang;
        if (state.pending || state.pendingUpgradeGang) renderClaims();
        else $('claimActions').innerHTML = '';
        $('roundStatus').textContent = state.finished ? '本局已结束' : '牌局进行中';
        $('nextRoundButton').hidden = !state.finished;
        $('turnHint').hidden = state.finished;
        renderWinnerReveal();
        const river = $('discardArea');
        river.style.scrollBehavior = 'auto';
        river.scrollTop = river.scrollHeight;
        river.style.removeProperty('scroll-behavior');
    }
    function renderWinnerReveal() {
        const panel = $('winnerReveal');
        if (!state.winInfo) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }
        const { winner, kind, tile } = state.winInfo;
        const winningHand = [...sortHand([...state.hands[winner]])];
        if (tile) winningHand.push(tile);
        panel.hidden = false;
        panel.innerHTML = `<div class="winner-reveal-heading"><strong>${
            NAMES[winner]
        } · ${kind}</strong><span>${
            tile ? `胡牌：${tile.label}` : kind === '自摸' ? '自摸胡牌' : '胡牌牌型'
        }</span></div><div class="winner-reveal-tiles">${winningHand
            .map(t => tileMarkup(t, true))
            .join('')}</div>${
            state.melds[winner].length
                ? `<div class="winner-reveal-melds">副露：${state.melds[winner]
                      .map(meld => meld.tiles.map(t => t.label).join(' '))
                      .join('　 /　 ')}</div>`
                : ''
        }`;
    }
    function claimOptions(tile, hand, meldCount, from) {
        const opts = [];
        const same = hand.filter(t => t.key === tile.key).length;
        if (canWin([...hand, tile], meldCount)) opts.push({ type: 'hu', label: '胡牌' });
        if (same >= 3) opts.push({ type: 'gang', label: '杠' });
        if (same >= 2) opts.push({ type: 'peng', label: '碰' });
        return opts;
    }
    function getClaimShortcut(type, index) {
        const map = { peng: 'q', gang: 'w', hu: 'e' };
        if (map[type]) return map[type];
        const fallback = ['r', 't', 'y', 'u', 'i', 'o', 'p'];
        return fallback[index] || 'k';
    }
    function renderClaims() {
        const pending = state.pending;
        if (state.pendingUpgradeGang) {
            const actions = $('claimActions');
            actions.innerHTML = '';
            const tile = state.pendingUpgradeGang.tile;
            const kong = document.createElement('button');
            kong.className = 'claim-button';
            kong.textContent = `补杠 ${tile.label} [W]`;
            kong.dataset.action = 'upgrade-gang';
            kong.addEventListener('click', acceptUpgradeGang);
            actions.append(kong);
            const pass = document.createElement('button');
            pass.className = 'claim-button secondary';
            pass.textContent = '暂不杠 [Esc]';
            pass.dataset.action = 'pass-upgrade';
            pass.addEventListener('click', () => {
                state.pendingUpgradeGang = null;
                render();
            });
            actions.append(pass);
            focusClaimAction(actions, `upgrade-gang:${tile.id},pass-upgrade`);
            return;
        }
        const options = claimOptions(
            pending.tile,
            state.hands[0],
            state.melds[0].length,
            pending.from
        );
        const actions = $('claimActions');
        actions.innerHTML = '';
        for (const [index, option] of options.entries()) {
            const button = document.createElement('button');
            button.className = 'claim-button';
            const shortcut = getClaimShortcut(option.type, index).toUpperCase();
            button.textContent = `${option.label} [${shortcut}]`;
            button.dataset.action = option.type;
            button.addEventListener('click', () => {
                acceptClaim(option.type);
            });
            actions.append(button);
        }
        const pass = document.createElement('button');
        pass.className = 'claim-button secondary';
        pass.textContent = '跳过 [Esc]';
        pass.dataset.action = 'pass';
        pass.addEventListener('click', passClaim);
        actions.append(pass);
        focusClaimAction(
            actions,
            `${pending.from}:${pending.tile.id}:` +
                options
                    .map(option => option.type)
                    .concat('pass')
                    .join(',')
        );
    }
    function focusClaimAction(actions, signature) {
        if (state.claimActionSignature !== signature) {
            state.claimActionSignature = signature;
            state.claimActionIndex = 0;
        }
        const buttons = [...actions.querySelectorAll('.claim-button')];
        if (!buttons.length) return;
        state.claimActionIndex =
            ((state.claimActionIndex % buttons.length) + buttons.length) % buttons.length;
        buttons.forEach((button, index) => {
            const selected = index === state.claimActionIndex;
            button.classList.toggle('keyboard-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        buttons[state.claimActionIndex].focus({ preventScroll: true });
    }
    function removeTiles(hand, keys) {
        for (const key of keys) {
            const index = hand.findIndex(tile => tile.key === key);
            if (index >= 0) hand.splice(index, 1);
        }
    }
    function acceptClaim(type) {
        const pending = state.pending;
        if (!pending) return;
        const hand = state.hands[0];
        const tile = pending.tile;
        if (type === 'hu') return finishHand(0, '荣和', tile);
        if (type === 'peng' || type === 'gang') {
            const count = type === 'gang' ? 3 : 2;
            removeTiles(hand, Array(count).fill(tile.key));
            state.melds[0].push({
                type,
                tiles: [...Array(count).fill(tile), tile],
                from: pending.from,
            });
        }
        removeDiscard(pending.from, tile);
        state.pending = null;
        state.lastDiscard = null;
        state.current = 0;
        state.phase = 'discard';
        state.selected = null;
        addHistory(
            `你${type === 'peng' ? '碰' : '杠'}了${NAMES[pending.from]}的`,
            tile.label
        );
        toast(
            `你${type === 'peng' ? '碰' : '杠'}了${NAMES[pending.from]}打出的${
                tile.label
            }`
        );
        showSeatAction(0, type === 'peng' ? '碰' : '杠', tile.label);
        if (type === 'gang') {
            if (state.wall.length) {
                const replacement = state.wall.pop();
                hand.push(replacement);
                state.newTileId = replacement.id;
                state.selected = replacement.id;
                addHistory('你杠后补了一张牌');
            } else return endDraw();
        }
        render();
    }
    function findUpgradeGang(player) {
        const hand = state.hands[player];
        for (const meld of state.melds[player]) {
            if (meld.type !== 'peng') continue;
            const matching = hand.find(tile => tile.key === meld.tiles[0].key);
            if (matching) return { meld, tile: matching };
        }
        return null;
    }
    function acceptUpgradeGang() {
        const upgrade = state.pendingUpgradeGang;
        if (!upgrade || state.current !== 0 || state.finished) return;
        const handIndex = state.hands[0].findIndex(tile => tile.id === upgrade.tile.id);
        if (handIndex < 0) return;
        const [tile] = state.hands[0].splice(handIndex, 1);
        upgrade.meld.tiles.push(tile);
        upgrade.meld.type = 'gang';
        state.pendingUpgradeGang = null;
        state.newTileId = null;
        addHistory('你将碰牌补杠为', tile.label);
        toast(`补杠成功：${tile.label}`);
        showSeatAction(0, '补杠', tile.label);
        if (!state.wall.length) return endDraw();
        const replacement = state.wall.pop();
        state.hands[0].push(replacement);
        state.newTileId = replacement.id;
        state.selected = replacement.id;
        addHistory('你补杠后补了一张牌');
        if (canWin(state.hands[0], state.melds[0].length)) {
            render();
            setTimeout(() => {
                if (!state.finished && state.current === 0) {
                    const win = window.confirm('补杠后补牌已组成胡牌，要现在自摸吗？');
                    if (win) finishHand(0, '自摸');
                }
            }, 120);
            return;
        }
        render();
    }
    function passClaim() {
        if (!state.pending) return;
        const from = state.pending.from;
        state.pending = null;
        state.current = (from + 1) % 4;
        state.phase = 'draw';
        advanceTurn();
    }
    function drawFor(player) {
        if (!state.wall.length) {
            endDraw();
            return false;
        }
        const tile = state.wall.pop();
        state.hands[player].push(tile);
        if (player === 0) state.newTileId = tile.id;
        sortHand(state.hands[player]);
        state.phase = 'discard';
        addHistory(`${NAMES[player]}摸了一张牌`);
        return true;
    }
    function drawForUser() {
        if (state.current !== 0 || state.phase !== 'draw' || state.finished) return;
        if (!drawFor(0)) return;
        state.selected = state.newTileId;
        if (canWin(state.hands[0], state.melds[0].length)) {
            render();
            setTimeout(() => {
                if (!state.finished && state.current === 0) {
                    const win = window.confirm('恭喜！你已组成胡牌牌型，要现在自摸吗？');
                    if (win) finishHand(0, '自摸');
                    else {
                        state.pendingUpgradeGang = findUpgradeGang(0);
                        render();
                    }
                }
            }, 120);
            return;
        }
        state.pendingUpgradeGang = findUpgradeGang(0);
        render();
    }
    function discardForUser(tileId) {
        if (
            state.current !== 0 ||
            state.phase !== 'discard' ||
            state.finished ||
            state.pendingUpgradeGang ||
            !tileId
        )
            return;
        const hand = state.hands[0];
        const index = hand.findIndex(t => t.id === tileId);
        if (index < 0) return;
        const [tile] = hand.splice(index, 1);
        recordDiscard(0, tile);
        state.selected = null;
        state.newTileId = null;
        addHistory('你打出了', tile.label);
        state.phase = 'draw';
        const claimant = findBotClaim(tile, 0);
        if (claimant) {
            claimBotTile(claimant.player, tile, claimant.type, 0);
            render();
            if (!state.finished) advanceTurn();
            return;
        }
        state.current = 1;
        render();
        advanceTurn();
    }
    function recordDiscard(player, tile) {
        const entry = { tile, player };
        state.discards[player].push(entry);
        state.river.push(entry);
        return entry;
    }
    function removeDiscard(player, tile) {
        const index = state.discards[player].findLastIndex(
            entry => entry.tile.id === tile.id
        );
        if (index < 0) return;
        const [entry] = state.discards[player].splice(index, 1);
        entry.claimed = true;
    }
    function findBotClaim(tile, fromPlayer) {
        for (let offset = 1; offset <= 3; offset++) {
            const player = (fromPlayer + offset) % 4;
            const hand = state.hands[player];
            const melds = state.melds[player].length;
            if (canWin([...hand, tile], melds)) return { player, type: 'hu' };
        }
        for (let offset = 1; offset <= 3; offset++) {
            const player = (fromPlayer + offset) % 4;
            if (state.hands[player].filter(t => t.key === tile.key).length >= 3)
                return { player, type: 'gang' };
        }
        for (let offset = 1; offset <= 3; offset++) {
            const player = (fromPlayer + offset) % 4;
            const same = state.hands[player].filter(t => t.key === tile.key).length;
            if (same >= 2 && Math.random() < 0.18) return { player, type: 'peng' };
        }
        return null;
    }
    function claimBotTile(player, tile, type, fromPlayer) {
        if (type === 'hu') {
            finishHand(player, '荣和', tile);
            return;
        }
        removeDiscard(fromPlayer, tile);
        const matchingCount = type === 'gang' ? 3 : 2;
        removeTiles(state.hands[player], Array(matchingCount).fill(tile.key));
        state.melds[player].push({
            type,
            tiles: [...Array(matchingCount).fill(tile), tile],
            from: fromPlayer,
        });
        state.current = player;
        state.phase = 'discard';
        const action = type === 'gang' ? '杠' : '碰';
        addHistory(`${NAMES[player]}${action}了${NAMES[fromPlayer]}的`, tile.label);
        toast(`${NAMES[player]}${action}了${NAMES[fromPlayer]}打出的${tile.label}`);
        showSeatAction(player, action, tile.label);
        if (type === 'gang') {
            if (!state.wall.length) return endDraw();
            const replacement = state.wall.pop();
            state.hands[player].push(replacement);
            addHistory(`${NAMES[player]}杠后补了一张牌`);
        }
    }
    function advanceTurn() {
        const token = ++state.turnToken;
        if (state.pending || state.finished) return;
        if (state.current === 0) {
            render();
            if (state.phase === 'draw' && state.wall.length) {
                const userToken = ++state.turnToken;
                setTimeout(() => {
                    if (
                        userToken === state.turnToken &&
                        !state.pending &&
                        !state.finished &&
                        state.current === 0 &&
                        state.phase === 'draw'
                    )
                        drawForUser();
                }, 450);
            }
            return;
        }
        setTimeout(() => {
            if (token !== state.turnToken || state.finished || state.pending) return;
            const player = state.current;
            if (state.phase === 'draw') {
                if (!drawFor(player)) return;
                if (canWin(state.hands[player], state.melds[player].length)) {
                    finishHand(player, '自摸');
                    return;
                }
            }
            const hand = state.hands[player];
            // 以保留对子与相邻牌为优先的轻量电脑出牌策略。
            const counts = countsFor(hand);
            const valued = hand
                .map((tile, index) => {
                    const same = counts.get(tile.key) || 0;
                    const neighbors = tile.rank
                        ? (counts.get(`${tile.suit}${tile.rank - 1}`) || 0) +
                          (counts.get(`${tile.suit}${tile.rank + 1}`) || 0)
                        : 0;
                    return {
                        tile,
                        index,
                        value:
                            same * 3 +
                            neighbors * 1.4 +
                            (tile.suit === 'jian' ? 0.2 : 0) +
                            Math.random() * 0.3,
                    };
                })
                .sort((a, b) => a.value - b.value);
            const picked = valued[0];
            const [discarded] = hand.splice(picked.index, 1);
            recordDiscard(player, discarded);
            state.current = (player + 1) % 4;
            state.phase = 'draw';
            addHistory(`${NAMES[player]}打出了`, discarded.label);
            const claims = claimOptions(
                discarded,
                state.hands[0],
                state.melds[0].length,
                player
            );
            if (claims.length) {
                state.pending = { tile: discarded, from: player };
                render();
                return;
            }
            const botClaim = findBotClaim(discarded, player);
            if (botClaim) {
                claimBotTile(botClaim.player, discarded, botClaim.type, player);
                render();
                if (state.current !== 0) advanceTurn();
                return;
            }
            render();
            advanceTurn();
        }, 650);
    }
    function finishHand(winner, kind, winningTile = null) {
        state.finished = true;
        state.phase = 'done';
        state.pending = null;
        state.current = winner;
        state.winInfo = { winner, kind, tile: winningTile };
        if (winner === 0) {
            const points = kind === '自摸' ? 8 : 6;
            state.score += points;
            $('tableMessage').textContent = `恭喜胡牌！${kind} · +${points} 分`;
            toast(`恭喜胡牌！${kind}，获得 ${points} 分`);
        } else {
            state.score -= 3;
            $('tableMessage').textContent = `${NAMES[winner]}${kind} · 本局结束`;
            toast(`${NAMES[winner]}${kind}，再来一局吧`);
        }
        addHistory(
            winner === 0 ? `你${kind}，本局胜利` : `${NAMES[winner]}${kind}，本局结束`
        );
        if (winner !== 0) showSeatAction(winner, kind === '自摸' ? '自摸胡' : '胡牌');
        celebrateWin(winner, kind);
        render();
    }
    function endDraw() {
        state.finished = true;
        state.phase = 'done';
        $('tableMessage').textContent = '流局 · 牌墙已摸完';
        toast('流局，牌墙已摸完');
        addHistory('牌墙摸完，本局流局');
        render();
    }
    function startGame(keepScore = true) {
        const score = keepScore ? state.score : 0;
        state.wall = makeDeck();
        state.hands = [[], [], [], []];
        state.discards = [[], [], [], []];
        state.river = [];
        state.melds = [[], [], [], []];
        state.winInfo = null;
        state.pendingUpgradeGang = null;
        state.actionNotes = ['', '', '', ''];
        state.actionTokens = state.actionTokens.map(token => token + 1);
        state.current = 0;
        state.selected = null;
        state.newTileId = null;
        state.lastDiscard = null;
        state.pending = null;
        state.phase = 'discard';
        state.finished = false;
        state.score = score;
        state.turnToken++;
        state.round++;
        for (let i = 0; i < 13; i++)
            for (let p = 0; p < 4; p++) state.hands[p].push(state.wall.pop());
        const openingDraw = state.wall.pop();
        state.hands[0].push(openingDraw);
        state.newTileId = openingDraw.id;
        state.selected = openingDraw.id;
        state.hands.forEach(sortHand);
        $('historyList').innerHTML =
            '<div class="empty-history">新的一局开始了，祝你手气好！</div>';
        addHistory('新的一局开始，你是庄家，先打出一张牌');
        render();
    }

    $('playerHand').addEventListener('click', event => {
        const tile = event.target.closest('.tile[data-id]');
        if (!tile) return;
        state.selected = tile.dataset.id;
        $('playerHand')
            .querySelectorAll('.tile[data-id]')
            .forEach(el =>
                el.classList.toggle('selected', el.dataset.id === state.selected)
            );
    });
    $('playerHand').addEventListener('dblclick', event => {
        const tile = event.target.closest('.tile[data-id]');
        if (!tile) return;
        discardForUser(tile.dataset.id);
    });
    $('playerHand').addEventListener('keydown', event => {
        const tile = event.target.closest('.tile[data-id]');
        if (!tile || event.key !== 'Enter') return;
        event.preventDefault();
        const tileId = tile.dataset.id;
        discardForUser(tileId);
    });
    document.addEventListener('keydown', event => {
        const target = event.target;
        if (
            state.finished &&
            event.key.toLowerCase() === 'p' &&
            !event.repeat &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !(
                target instanceof HTMLElement &&
                (target.isContentEditable || target.closest('input, textarea, select'))
            )
        ) {
            event.preventDefault();
            startGame(true);
            return;
        }
        const hasClaim = state.pending || state.pendingUpgradeGang;
        if (hasClaim && event.key === 'Escape') {
            event.preventDefault();
            if (state.pendingUpgradeGang) {
                state.pendingUpgradeGang = null;
                render();
            } else {
                passClaim();
            }
            return;
        }
        if (
            hasClaim &&
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
            const buttons = [...$('claimActions').querySelectorAll('.claim-button')];
            if (buttons.length) {
                event.preventDefault();
                const direction =
                    event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                state.claimActionIndex =
                    (state.claimActionIndex + direction + buttons.length) %
                    buttons.length;
                buttons.forEach((button, index) => {
                    const selected = index === state.claimActionIndex;
                    button.classList.toggle('keyboard-selected', selected);
                    button.setAttribute('aria-pressed', String(selected));
                });
                buttons[state.claimActionIndex].focus({ preventScroll: true });
            }
            return;
        }
        if (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
                target.closest('input, textarea, select, button')) &&
            !(hasClaim && target.closest('#claimActions .claim-button'))
        )
            return;
        if (state.pending || state.pendingUpgradeGang) {
            const key = event.key.toLowerCase();
            if (['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].includes(key)) {
                event.preventDefault();
                const options = state.pendingUpgradeGang
                    ? [{ type: 'upgrade-gang' }]
                    : claimOptions(
                          state.pending.tile,
                          state.hands[0],
                          state.melds[0].length,
                          state.pending.from
                      );
                const match = options.find((option, index) => {
                    const type = option.type;
                    return getClaimShortcut(type, index).toLowerCase() === key;
                });
                if (match) {
                    if (state.pendingUpgradeGang) acceptUpgradeGang();
                    else acceptClaim(match.type);
                    return;
                }
            }
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            if (state.current !== 0 || state.phase !== 'discard' || state.finished)
                return;
            event.preventDefault();
            moveSelectedTile(event.key === 'ArrowLeft' ? -1 : 1);
            return;
        }
        if (
            event.code !== 'Space' ||
            event.repeat ||
            state.current !== 0 ||
            state.finished
        )
            return;
        event.preventDefault();
        const tileId = state.selected || state.newTileId;
        if (tileId) discardForUser(tileId);
    });
    $('nextRoundButton').addEventListener('click', () => startGame(true));
    $('ruleSelect').addEventListener('change', event => {
        state.ruleMode = event.target.value === 'ghost' ? 'ghost' : 'guangdong';
        startGame(true);
        toast(
            state.ruleMode === 'ghost'
                ? '已切换到广东鬼牌麻将：鬼牌可代任意牌胡牌'
                : '已切换到广东麻将'
        );
    });
    $('historyList').innerHTML = '<div class="empty-history">等待牌局开始…</div>';
    window.__mahjongDebug = {
        getState: () => state,
        getReadyWaitInfo,
        getHandDisplayOrder,
        render,
    };
    startGame(false);
})();
