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
        drawContexts: [null, null, null, null],
        hasPriorValidAction: false,
        pendingUpgradeGang: [],
        pendingConcealedGang: [],
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
    const TILE_KEYS = [
        ...SUITS.flatMap(suit =>
            Array.from({ length: suit.max }, (_, index) => `${suit.key}${index + 1}`)
        ),
        ...HONORS.map(honor => `${honor.key}${honor.value}`),
    ];
    const TILE_INDEX = new Map(TILE_KEYS.map((key, index) => [key, index]));
    const PATTERN_NAMES = {
        standard: '标准和牌',
        sevenPairs: '七对',
        deluxeSevenPairs: '豪华七对',
        thirteenOrphans: '十三幺',
        thirteenUnconnected: '十三不靠',
        sevenStarsUnconnected: '七星不靠',
        nineGates: '九莲宝灯',
        pureOneSuit: '清一色',
        halfFlush: '混一色',
        allHonors: '字一色',
        pureTerminals: '清幺九',
        mixedTerminals: '混幺九',
        allGreen: '绿一色',
        bigThreeDragons: '大三元',
        smallThreeDragons: '小三元',
        bigFourWinds: '大四喜',
        smallFourWinds: '小四喜',
        fourConcealedTriplets: '四暗刻',
        threeKongs: '三杠子',
        fourKongs: '四杠子',
        kongDraw: '杠上开花',
        lastTileDraw: '海底捞月',
        heavenlyHand: '天胡',
        earthlyHand: '地胡',
    };
    const PATTERN_FANS = {
        standard: 1,
        sevenPairs: 2,
        deluxeSevenPairs: 4,
        thirteenOrphans: 4,
        thirteenUnconnected: 4,
        sevenStarsUnconnected: 8,
        nineGates: 8,
        pureOneSuit: 3,
        halfFlush: 2,
        allHonors: 6,
        pureTerminals: 6,
        mixedTerminals: 4,
        allGreen: 8,
        bigThreeDragons: 4,
        smallThreeDragons: 2,
        bigFourWinds: 8,
        smallFourWinds: 4,
        fourConcealedTriplets: 4,
        threeKongs: 2,
        fourKongs: 4,
        kongDraw: 1,
        lastTileDraw: 1,
        heavenlyHand: 8,
        earthlyHand: 8,
    };
    const EXCLUSIVE_PATTERNS = [
        ['sevenPairs', 'deluxeSevenPairs'],
        [
            'thirteenOrphans',
            'thirteenUnconnected',
            'sevenStarsUnconnected',
            'nineGates',
        ],
        ['pureOneSuit', 'halfFlush', 'allHonors'],
        ['pureTerminals', 'mixedTerminals'],
        ['bigThreeDragons', 'smallThreeDragons'],
        ['bigFourWinds', 'smallFourWinds'],
        ['threeKongs', 'fourKongs'],
    ];

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
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
    function sortHand(hand) {
        const order = { wan: 0, tiao: 1, tong: 2, feng: 3, jian: 4 };
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
        return null;
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
    function canCompleteGroupsWithLaizi(handCounts, allCounts, laiziCount, groupsRequired) {
        const remaining = [...handCounts];
        const visible = [...allCounts];
        const memo = new Map();
        function search(jokers, groupsLeft) {
            const key = `${jokers}:${groupsLeft}:${remaining.join(',')}:${visible.join(',')}`;
            if (memo.has(key)) return memo.get(key);
            if (groupsLeft === 0)
                return remaining.every(count => count === 0) && jokers === 0;
            const first = remaining.findIndex(count => count > 0);
            if (first < 0) return jokers === groupsLeft * 3;
            const count = remaining[first];
            const tripletUse = Math.min(3, count);
            const tripletJokers = 3 - tripletUse;
            if (
                tripletJokers <= jokers &&
                visible[first] + tripletJokers <= 4
            ) {
                remaining[first] -= tripletUse;
                visible[first] += tripletJokers;
                const result = search(jokers - tripletJokers, groupsLeft - 1);
                visible[first] -= tripletJokers;
                remaining[first] += tripletUse;
                if (result) {
                    memo.set(key, true);
                    return true;
                }
            }
            if (first < 27) {
                const suitStart = Math.floor(first / 9) * 9;
                for (
                    let start = Math.max(suitStart, first - 2);
                    start <= Math.min(first, suitStart + 6);
                    start++
                ) {
                    const sequence = [start, start + 1, start + 2];
                    const used = [];
                    const missing = [];
                    for (const index of sequence) {
                        if (remaining[index]) {
                            remaining[index]--;
                            used.push(index);
                        } else missing.push(index);
                    }
                    const hasCapacity = missing.every(index => visible[index] < 4);
                    if (
                        hasCapacity &&
                        missing.length <= jokers
                    ) {
                        for (const index of missing) visible[index]++;
                        const result = search(
                            jokers - missing.length,
                            groupsLeft - 1
                        );
                        for (const index of missing) visible[index]--;
                        for (const index of used) remaining[index]++;
                        if (result) {
                            memo.set(key, true);
                            return true;
                        }
                    } else {
                        for (const index of used) remaining[index]++;
                    }
                }
            }
            memo.set(key, false);
            return false;
        }
        for (let pair = 0; pair < handCounts.length; pair++) {
            const used = Math.min(2, remaining[pair]);
            const missing = 2 - used;
            if (missing > laiziCount || visible[pair] + missing > 4) continue;
            remaining[pair] -= used;
            visible[pair] += missing;
            const result = search(laiziCount - missing, groupsRequired);
            visible[pair] -= missing;
            remaining[pair] += used;
            if (result) return true;
        }
        for (let pair = 0; pair < handCounts.length; pair++) {
            if (visible[pair] > 2 || laiziCount < 2) continue;
            visible[pair] += 2;
            const result = search(laiziCount - 2, groupsRequired);
            visible[pair] -= 2;
            if (result) return true;
        }
        return false;
    }
    function unconnectedSuitOptions(counts, suit, requiredSize) {
        const fixed = new Set(
            counts
                .slice(suit * 9, suit * 9 + 9)
                .flatMap((count, rank) => (count ? [rank] : []))
        );
        if (fixed.size > requiredSize) return [];
        const options = [];
        for (let mask = 0; mask < 1 << 9; mask++) {
            const ranks = [];
            for (let rank = 0; rank < 9; rank++)
                if (mask & (1 << rank)) ranks.push(rank);
            if (
                ranks.length === requiredSize &&
                [...fixed].every(rank => ranks.includes(rank)) &&
                ranks.every((rank, index) => !index || rank - ranks[index - 1] >= 3)
            )
                options.push(ranks);
        }
        return options;
    }
    function getFastReadyPatterns(hand, melds) {
        const meldCount = melds.length;
        if (hand.length !== 14 - meldCount * 3) return [];
        const laiziCount =
            state.ruleMode === 'red-center-laizi'
                ? hand.filter(tile => tile.key === 'jian红中').length
                : 0;
        if (!laiziCount) {
            const result = getWinningHandInfo(hand, 0);
            return result ? result.patterns : [];
        }
        const handCounts = new Array(TILE_KEYS.length).fill(0);
        const allCounts = new Array(TILE_KEYS.length).fill(0);
        for (const tile of hand) {
            if (tile.key === 'jian红中') continue;
            const index = TILE_INDEX.get(tile.key);
            if (index === undefined) return [];
            handCounts[index]++;
            allCounts[index]++;
        }
        for (const meld of melds)
            for (const tile of meld.tiles) {
                const index = TILE_INDEX.get(tile.key);
                if (index === undefined) return [];
                allCounts[index]++;
            }
        if (allCounts.some(count => count > 4)) return [];
        const patterns = [];
        if (
            canCompleteGroupsWithLaizi(
                handCounts,
                allCounts,
                laiziCount,
                4 - meldCount
            )
        )
            patterns.push('standard');
        if (meldCount === 0) {
            const naturalPairs = handCounts.reduce(
                (sum, count) => sum + Math.floor(count / 2),
                0
            );
            const singles = handCounts.filter(count => count % 2).length;
            if (
                handCounts.every(count => count <= 4) &&
                singles <= laiziCount &&
                (laiziCount - singles) % 2 === 0 &&
                naturalPairs +
                    singles +
                    (laiziCount - singles) / 2 ===
                    7
            )
                patterns.push('sevenPairs');
            const orphans = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
            const missing = [...orphans].filter(index => handCounts[index] === 0).length;
            const duplicates = [...orphans].filter(index => handCounts[index] === 2).length;
            const invalidOrphans = handCounts.some(
                (count, index) => !orphans.has(index) && count > 0
            );
            if (
                !invalidOrphans &&
                handCounts.every(count => count <= 2) &&
                duplicates <= 1 &&
                laiziCount === missing + (duplicates ? 0 : 1)
            )
                patterns.push('thirteenOrphans');
            const honorCount = handCounts
                .slice(27)
                .reduce((sum, count) => sum + count, 0);
            const numberCount = handCounts
                .slice(0, 27)
                .reduce((sum, count) => sum + count, 0);
            const validUnconnectedCounts = handCounts.every(count => count <= 1);
            const canExtendThreePerSuit = [0, 1, 2].every(
                suit => unconnectedSuitOptions(handCounts, suit, 3).length > 0
            );
            if (
                validUnconnectedCounts &&
                honorCount <= 5 &&
                canExtendThreePerSuit
            )
                patterns.push('thirteenUnconnected');
            const canExtendSevenNumbers = (() => {
                const options = [0, 1, 2].map(suit =>
                    [0, 1, 2, 3].flatMap(size =>
                        unconnectedSuitOptions(handCounts, suit, size)
                    )
                );
                return options[0].some(first =>
                    options[1].some(second =>
                        options[2].some(
                            third =>
                                first.length + second.length + third.length === 7
                        )
                    )
                );
            })();
            if (
                validUnconnectedCounts &&
                handCounts.slice(27).every(count => count <= 1) &&
                numberCount <= 7 &&
                canExtendSevenNumbers
            )
                patterns.push('sevenStarsUnconnected');
            if (numberCount && honorCount === 0) {
                for (let suit = 0; suit < 3; suit++) {
                    if (
                        handCounts
                            .slice(0, 27)
                            .some((count, index) => Math.floor(index / 9) !== suit && count)
                    )
                        continue;
                    const counts = handCounts.slice(suit * 9, suit * 9 + 9);
                    for (let extra = 0; extra < 9; extra++) {
                        const target = [3, 1, 1, 1, 1, 1, 1, 1, 3];
                        target[extra]++;
                        if (target.every((count, rank) => counts[rank] <= count)) {
                            patterns.push('nineGates');
                            break;
                        }
                    }
                    if (patterns.includes('nineGates')) break;
                }
            }
        }
        return patterns;
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
                const remaining = remainingCopies(tile, visibleCounts);
                if (remaining <= 0) continue;
                const completedHand = [...option.hand, tile];
                const patterns = getFastReadyPatterns(
                    completedHand,
                    state.melds[0]
                );
                if (!patterns.length) continue;
                candidates.push({
                    key,
                    label: tile.label,
                    remaining,
                    patterns,
                });
            }
            if (!candidates.length) continue;
            candidates.sort(
                (a, b) => b.remaining - a.remaining || a.label.localeCompare(b.label)
            );
            results.push({
                entries:
                    state.ruleMode === 'red-center-laizi'
                        ? candidates
                        : candidates.slice(0, 6),
                discard: option.discard,
                copies: candidates.reduce(
                    (sum, candidate) => sum + candidate.remaining,
                    0
                ),
            });
        }
        results.sort((a, b) => b.copies - a.copies);
        const best = results[0];
        if (!best) return null;
        const waitingHand = best.discard
            ? hand.filter(tile => tile.id !== best.discard.id)
            : hand;
        for (const entry of best.entries) {
            const completedHand = [...waitingHand, tileFromKey(entry.key)];
            const winInfo = getWinningHandInfo(completedHand, 0);
            entry.groups = getReadyTileGroups(completedHand, winInfo);
            entry.waitKey =
                entry.key === 'jian红中' && winInfo?.substitutions.length
                    ? TILE_KEYS[winInfo.substitutions.at(-1)]
                    : entry.key;
            entry.substituteWaits =
                entry.key === 'jian红中'
                    ? [...new Set(winInfo?.substitutions || [])]
                          .filter(index => TILE_KEYS[index] !== 'jian红中')
                          .map(index => {
                              const key = TILE_KEYS[index];
                              const tile = tileFromKey(key);
                              return {
                                  key,
                                  label: tile.label,
                                  remaining: remainingCopies(tile, visibleCounts),
                              };
                          })
                    : [];
        }
        return best;
    }
    function findStandardTileGroups(counts, groupsRequired) {
        const remaining = [...counts];
        function findGroups(groupsLeft) {
            if (groupsLeft === 0)
                return remaining.every(count => count === 0) ? [] : null;
            const first = remaining.findIndex(count => count > 0);
            if (first < 0) return null;
            if (remaining[first] >= 3) {
                remaining[first] -= 3;
                const rest = findGroups(groupsLeft - 1);
                remaining[first] += 3;
                if (rest)
                    return [
                        [TILE_KEYS[first], TILE_KEYS[first], TILE_KEYS[first]],
                        ...rest,
                    ];
            }
            if (
                first < 27 &&
                first % 9 <= 6 &&
                remaining[first + 1] &&
                remaining[first + 2]
            ) {
                remaining[first]--;
                remaining[first + 1]--;
                remaining[first + 2]--;
                const rest = findGroups(groupsLeft - 1);
                remaining[first]++;
                remaining[first + 1]++;
                remaining[first + 2]++;
                if (rest)
                    return [
                        [TILE_KEYS[first], TILE_KEYS[first + 1], TILE_KEYS[first + 2]],
                        ...rest,
                    ];
            }
            return null;
        }
        for (let pair = 0; pair < remaining.length; pair++) {
            if (remaining[pair] < 2) continue;
            remaining[pair] -= 2;
            const groups = findGroups(groupsRequired);
            remaining[pair] += 2;
            if (groups) return [[TILE_KEYS[pair], TILE_KEYS[pair]], ...groups];
        }
        return null;
    }
    function getReadyTileGroups(hand, winInfo) {
        if (!winInfo) return [];
        const laiziCount =
            state.ruleMode === 'red-center-laizi'
                ? hand.filter(tile => tile.key === 'jian红中').length
                : 0;
        const keys = hand
            .filter(tile => !laiziCount || tile.key !== 'jian红中')
            .map(tile => tile.key);
        keys.push(...winInfo.substitutions.map(index => TILE_KEYS[index]));
        const counts = new Array(TILE_KEYS.length).fill(0);
        for (const key of keys) {
            const index = TILE_INDEX.get(key);
            if (index !== undefined) counts[index]++;
        }
        const groupsRequired = 4 - state.melds[0].length;
        if (winInfo.patterns.includes('standard')) {
            const groups = findStandardTileGroups(counts, groupsRequired);
            if (groups) return groups;
        }
        if (winInfo.patterns.includes('sevenPairs'))
            return counts.flatMap((count, index) =>
                Array.from({ length: Math.floor(count / 2) }, () => [
                    TILE_KEYS[index],
                    TILE_KEYS[index],
                ])
            );
        const groups = [];
        const pair = counts.findIndex(count => count >= 2);
        if (pair >= 0) {
            groups.push([TILE_KEYS[pair], TILE_KEYS[pair]]);
            counts[pair] -= 2;
        }
        for (let index = 0; index < counts.length; index++) {
            while (counts[index] > 0) {
                groups.push([TILE_KEYS[index]]);
                counts[index]--;
            }
        }
        return groups;
    }
    function possibleTileKeys() {
        return TILE_KEYS;
    }
    function calculateWinScore(patterns, selfDraw) {
        const selected = new Set(patterns);
        for (const group of EXCLUSIVE_PATTERNS) {
            const matches = group.filter(pattern => selected.has(pattern));
            if (matches.length < 2) continue;
            matches.sort((left, right) => PATTERN_FANS[right] - PATTERN_FANS[left]);
            for (const pattern of matches.slice(1)) selected.delete(pattern);
        }
        const chosen = patterns.filter(
            (pattern, index) =>
                selected.has(pattern) && patterns.indexOf(pattern) === index
        );
        const breakdown = chosen.map(pattern => ({
            name: PATTERN_NAMES[pattern],
            fan: PATTERN_FANS[pattern],
        }));
        if (selfDraw) breakdown.push({ name: '自摸', fan: 1 });
        const fan = Math.min(
            8,
            breakdown.reduce((sum, item) => sum + item.fan, 0)
        );
        if (fan < 1)
            return { patterns: chosen, breakdown, fan, points: 0, total: 0 };
        const points = 2 ** (fan - 1);
        return {
            patterns: chosen,
            breakdown,
            fan,
            points,
            total: selfDraw ? points * 3 : points,
        };
    }
    function isStandardStructure(counts, groupsRequired) {
        const remaining = [...counts];
        const memo = new Map();
        function search(groupsLeft) {
            const memoKey = `${groupsLeft}:${remaining.join(',')}`;
            if (memo.has(memoKey)) return memo.get(memoKey);
            if (groupsLeft === 0) return remaining.every(count => count === 0);
            const first = remaining.findIndex(count => count > 0);
            if (first < 0) return false;
            if (remaining[first] >= 3) {
                remaining[first] -= 3;
                const result = search(groupsLeft - 1);
                remaining[first] += 3;
                if (result) {
                    memo.set(memoKey, true);
                    return true;
                }
            }
            if (first < 27 && first % 9 <= 6) {
                if (remaining[first + 1] && remaining[first + 2]) {
                    remaining[first]--;
                    remaining[first + 1]--;
                    remaining[first + 2]--;
                    const result = search(groupsLeft - 1);
                    remaining[first]++;
                    remaining[first + 1]++;
                    remaining[first + 2]++;
                    if (result) {
                        memo.set(memoKey, true);
                        return true;
                    }
                }
            }
            memo.set(memoKey, false);
            return false;
        }
        for (let pair = 0; pair < counts.length; pair++) {
            if (remaining[pair] < 2) continue;
            remaining[pair] -= 2;
            const result = search(groupsRequired);
            remaining[pair] += 2;
            if (result) return true;
        }
        return false;
    }
    function isUnconnectedNumbers(counts) {
        for (let suit = 0; suit < 3; suit++) {
            let previous = -10;
            for (let rank = 0; rank < 9; rank++) {
                if (!counts[suit * 9 + rank]) continue;
                if (rank - previous < 3) return false;
                previous = rank;
            }
        }
        return true;
    }
    function getPatternsForAssignment(handCounts, allCounts, melds, context) {
        const handTileCount = handCounts.reduce((sum, count) => sum + count, 0);
        const meldCount = melds.length;
        if (handTileCount !== 14 - meldCount * 3 || allCounts.some(count => count > 4))
            return [];
        const patterns = [];
        const standard = isStandardStructure(handCounts, 4 - meldCount);
        const allIndexes = [];
        for (let index = 0; index < allCounts.length; index++)
            for (let count = 0; count < allCounts[index]; count++) allIndexes.push(index);
        if (standard) {
            patterns.push('standard');
            const suits = new Set(allIndexes.filter(index => index < 27).map(index => Math.floor(index / 9)));
            const hasHonors = allIndexes.some(index => index >= 27);
            if (suits.size === 1 && !hasHonors) patterns.push('pureOneSuit');
            if (suits.size === 1 && hasHonors) patterns.push('halfFlush');
            if (allIndexes.every(index => index >= 27)) patterns.push('allHonors');
            const isTerminal = index => index >= 27 || index % 9 === 0 || index % 9 === 8;
            if (allIndexes.every(index => index < 27 && isTerminal(index)))
                patterns.push('pureTerminals');
            if (
                allIndexes.every(isTerminal) &&
                hasHonors &&
                allIndexes.some(index => index < 27)
            )
                patterns.push('mixedTerminals');
            const green = new Set(
                ['tiao2', 'tiao3', 'tiao4', 'tiao6', 'tiao8', 'jian发财'].map(
                    key => TILE_INDEX.get(key)
                )
            );
            if (allIndexes.every(index => green.has(index))) patterns.push('allGreen');
            const dragonCounts = [31, 32, 33].map(index => allCounts[index]);
            if (dragonCounts.every(count => count >= 3)) {
                patterns.push('bigThreeDragons');
            } else if (
                dragonCounts.filter(count => count >= 3).length === 2 &&
                dragonCounts.includes(2)
            ) {
                patterns.push('smallThreeDragons');
            }
            const windCounts = [27, 28, 29, 30].map(index => allCounts[index]);
            if (windCounts.every(count => count >= 3)) {
                patterns.push('bigFourWinds');
            } else if (
                windCounts.filter(count => count >= 3).length === 3 &&
                windCounts.includes(2)
            ) {
                patterns.push('smallFourWinds');
            }
            const concealedKongs = melds.filter(
                meld => meld.type === 'gang' && meld.concealed
            ).length;
            const hasOpenMeld = melds.some(
                meld => meld.type === 'peng' || (meld.type === 'gang' && !meld.concealed)
            );
            if (!hasOpenMeld) {
                for (let pair = 0; pair < handCounts.length; pair++) {
                    if (handCounts[pair] < 2) continue;
                    const remainder = [...handCounts];
                    remainder[pair] -= 2;
                    if (
                        remainder.every(count => count % 3 === 0) &&
                        remainder.reduce((sum, count) => sum + count / 3, 0) +
                            concealedKongs ===
                            4
                    ) {
                        patterns.push('fourConcealedTriplets');
                        break;
                    }
                }
            }
            const kongCount = melds.filter(meld => meld.type === 'gang').length;
            if (kongCount >= 3) patterns.push('threeKongs');
            if (kongCount === 4) patterns.push('fourKongs');
        }
        if (meldCount === 0 && handTileCount === 14) {
            if (
                handCounts.every(count => count % 2 === 0) &&
                handCounts.reduce((sum, count) => sum + count / 2, 0) === 7
            ) {
                patterns.push('sevenPairs');
                if (handCounts.some(count => count === 4))
                    patterns.push('deluxeSevenPairs');
            }
            const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
            if (
                handCounts.every((count, index) => orphans.includes(index) || count === 0) &&
                orphans.every(index => handCounts[index] >= 1) &&
                orphans.some(index => handCounts[index] === 2)
            )
                patterns.push('thirteenOrphans');
            const honors = handCounts.slice(27).reduce((sum, count) => sum + count, 0);
            const suitCounts = [0, 1, 2].map(suit =>
                handCounts.slice(suit * 9, suit * 9 + 9).reduce((sum, count) => sum + count, 0)
            );
            if (
                handCounts.every(count => count <= 1) &&
                honors === 5 &&
                suitCounts.every(count => count === 3) &&
                isUnconnectedNumbers(handCounts)
            )
                patterns.push('thirteenUnconnected');
            if (
                handCounts.slice(27).every(count => count === 1) &&
                suitCounts.reduce((sum, count) => sum + count, 0) === 7 &&
                handCounts.every(count => count <= 1) &&
                isUnconnectedNumbers(handCounts)
            )
                patterns.push('sevenStarsUnconnected');
            const numberedSuits = new Set(
                allIndexes.filter(index => index < 27).map(index => Math.floor(index / 9))
            );
            if (
                allIndexes.length === 14 &&
                allIndexes.every(index => index < 27) &&
                numberedSuits.size === 1
            ) {
                const suitStart = [...numberedSuits][0] * 9;
                const suit = handCounts.slice(suitStart, suitStart + 9);
                if (
                    suit[0] >= 3 &&
                    suit[8] >= 3 &&
                    suit.slice(1, 8).every(count => count >= 1)
                )
                    patterns.push('nineGates');
            }
        }
        if (!patterns.length) return patterns;
        if (context.afterKong && context.selfDraw) patterns.push('kongDraw');
        if (context.lastTile && context.selfDraw) patterns.push('lastTileDraw');
        if (context.isDealer && context.isInitialHand && !context.hasPriorValidAction)
            patterns.push('heavenlyHand');
        if (
            !context.isDealer &&
            context.isFirstTurn &&
            context.selfDraw &&
            !context.hasPriorValidAction
        )
            patterns.push('earthlyHand');
        return [...new Set(patterns)];
    }
    function getWinningHandInfo(hand, player = 0, context = {}) {
        const melds = state.melds[player] || [];
        const meldCount = melds.length;
        if (hand.length !== 14 - meldCount * 3) return null;
        const concealedKongs = melds.filter(
            meld => meld.type === 'gang' && meld.concealed
        ).length;
        if (
            melds.some(meld => meld.type !== 'peng' && meld.type !== 'gang') ||
            melds.some(
                meld =>
                    !Array.isArray(meld.tiles) ||
                    meld.tiles.length !== (meld.type === 'peng' ? 3 : 4) ||
                    meld.tiles.some(tile => tile.key !== meld.tiles[0].key)
            ) ||
            concealedKongs > meldCount
        )
            return null;
        const wildCount =
            state.ruleMode === 'red-center-laizi'
                ? hand.filter(tile => tile.key === 'jian红中').length
                : 0;
        const baseHandCounts = new Array(TILE_KEYS.length).fill(0);
        const baseAllCounts = new Array(TILE_KEYS.length).fill(0);
        for (const tile of hand) {
            const index = TILE_INDEX.get(tile.key);
            if (index === undefined) return null;
            if (wildCount && tile.key === 'jian红中') continue;
            baseHandCounts[index]++;
            baseAllCounts[index]++;
        }
        for (const meld of melds)
            for (const tile of meld.tiles) {
                const index = TILE_INDEX.get(tile.key);
                if (index === undefined) return null;
                baseAllCounts[index]++;
            }
        const assignments = [];
        let best = null;
        function visit(minimumIndex) {
            if (assignments.length === wildCount) {
                const handCounts = [...baseHandCounts];
                const allCounts = [...baseAllCounts];
                for (const index of assignments) {
                    handCounts[index]++;
                    allCounts[index]++;
                }
                if (allCounts.some(count => count > 4)) return;
                const patterns = getPatternsForAssignment(
                    handCounts,
                    allCounts,
                    melds,
                    context
                );
                if (!patterns.length) return;
                const score = calculateWinScore(patterns, context.selfDraw === true);
                const candidate = {
                    patterns: score.patterns,
                    breakdown: score.breakdown,
                    fan: score.fan,
                    points: score.points,
                    total: score.total,
                    substitutions: [...assignments],
                };
                if (
                    !best ||
                    candidate.total > best.total ||
                    (candidate.total === best.total && candidate.fan > best.fan) ||
                    (candidate.total === best.total &&
                        candidate.fan === best.fan &&
                        candidate.patterns.length > best.patterns.length) ||
                    (candidate.total === best.total &&
                        candidate.fan === best.fan &&
                        candidate.patterns.length === best.patterns.length &&
                        candidate.substitutions.filter(index => index !== 31).length <
                            best.substitutions.filter(index => index !== 31).length)
                )
                    best = candidate;
                return;
            }
            for (
                let index = minimumIndex;
                index < TILE_KEYS.length;
                index++
            ) {
                assignments.push(index);
                visit(index);
                assignments.pop();
            }
        }
        visit(0);
        return best;
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
        const laizi =
            state.ruleMode === 'red-center-laizi' && tile.key === 'jian红中';
        const label = laizi ? `赖子${tile.label}` : tile.label;
        const ribbon = laizi
            ? '<span class="tile-laizi-ribbon" aria-hidden="true">赖</span>'
            : '';
        return `<div class="tile ${mini ? 'mini ' : ''}suit-${tile.suit} ${
            waiting ? 'wait-tile' : ''
        }${laizi ? ' laizi-tile' : ''}" aria-label="${label}" ${
            mini
                ? ''
                : `data-id="${tile.id}" role="button" tabindex="0"`
        }>${ribbon}<span class="tile-unicode">${tileUnicode(tile)}</span></div>`;
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
    function meldLabel(meld) {
        if (meld.type === 'peng') return '碰';
        return {
            exposed: '明杠',
            concealed: '暗杠',
            added: '补杠',
        }[meld.kongKind] || '杠';
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
            state.ruleMode === 'red-center-laizi'
                ? '红中可作真牌或赖子；仅自摸胡；最低1番、封顶8番'
                : '136张无花牌；不吃牌，仅自摸胡；最低1番、封顶8番';
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
        readyPanel.classList.toggle(
            'laizi-ready-panel',
            state.ruleMode === 'red-center-laizi'
        );
        if (readyInfo) {
            readyPanel.hidden = false;
            readyPanel.innerHTML = `<div class="ready-heading">听牌组合</div><div class="ready-list">${readyInfo.entries
                .map(entry => {
                    let fadedWaitTile = false;
                    const patterns = entry.groups
                        .map(
                            group =>
                                `<span class="ready-pattern">${group
                                    .map(key => {
                                        const isWaitTile =
                                            !fadedWaitTile && key === entry.waitKey;
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
                    const substituteWaits = entry.substituteWaits?.length
                        ? `<span class="ready-laizi-waits">赖子可代 ${entry.substituteWaits
                              .map(
                                  wait =>
                                      `<span>${wait.label}<em>余${wait.remaining}</em></span>`
                              )
                              .join('')}</span>`
                        : '';
                    return `<div class="ready-option" title="${entry.patterns
                        .map(pattern => PATTERN_NAMES[pattern])
                        .join('、')}"><span class="ready-chip">${entry.label}<em>余${entry.remaining}</em></span>${substituteWaits}<div class="ready-patterns">${patterns}</div></div>`;
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
                    `<div class="meld"><span class="meld-kind">${meldLabel(
                        meld
                    )}</span>${meld.tiles.map(t => tileMarkup(t, true)).join('')}</div>`
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
                              `<div class="seat-meld"><span>${meldLabel(meld)}</span>${meld.tiles
                                  .map(tile => tileMarkup(tile, true))
                                  .join('')}</div>`
                      )
                      .join('')}</div>`
                : '';
            seatEl.innerHTML =
                index === 2
                    ? `${label}${action}${counts}${publicMelds}`
                    : `${label}${counts}${publicMelds}${action}`;
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
            : state.pendingUpgradeGang.length
            ? `可将${state.pendingUpgradeGang[0].tile.label}碰牌补杠`
            : state.pendingConcealedGang.length
            ? `可以暗杠${state.pendingConcealedGang[0].tile.label}`
            : youTurn
            ? state.phase === 'draw'
                ? '轮到你，正在自动摸牌…'
                : '方向键选牌 · 空格打出选中牌'
            : `${NAMES[state.current]}正在思考…`;
        $('tableMessage').textContent = state.finished
            ? '牌局结束 · 点击下方开启下一局'
            : state.pending
            ? `${NAMES[state.pending.from]}打出${state.pending.tile.label}，你可以响应`
            : state.pendingUpgradeGang.length
            ? `你可以将${state.pendingUpgradeGang[0].tile.label}补杠`
            : state.pendingConcealedGang.length
            ? `你可以暗杠${state.pendingConcealedGang[0].tile.label}`
            : youTurn
            ? state.phase === 'draw'
                ? '轮到你摸牌'
                : '请打出一张牌'
            : `${NAMES[state.current]}的回合`;
        $('claimActions').hidden = !state.pending && !hasPendingGang();
        if (state.pending || hasPendingGang()) renderClaims();
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
        const score = state.winInfo.score;
        panel.innerHTML = `<div class="winner-reveal-heading"><strong>${
            NAMES[winner]
        } · ${kind}</strong><span>${
            `胡牌：${tile ? `${tile.label} · ` : ''}${score.fan} 番 · +${score.total} 分`
        }</span></div><div class="winner-reveal-tiles">${winningHand
            .map(t => tileMarkup(t, true))
            .join('')}</div><div class="winner-reveal-melds">${score.breakdown
            .map(item => `${item.name} ${item.fan}番`)
            .join(' · ')}</div>${
            state.melds[winner].length
                ? `<div class="winner-reveal-melds">副露：${state.melds[winner]
                      .map(meld => meld.tiles.map(t => t.label).join(' '))
                      .join('　 /　 ')}</div>`
                : ''
        }`;
    }
    function claimOptions(tile, hand) {
        const opts = [];
        const same = hand.filter(t => t.key === tile.key).length;
        if (same >= 3) opts.push({ type: 'gang', label: '杠' });
        if (same >= 2) opts.push({ type: 'peng', label: '碰' });
        return opts;
    }
    function getClaimShortcut(type, index) {
        const map = { peng: 'q', gang: 'w' };
        if (map[type]) return map[type];
        const fallback = ['r', 't', 'y', 'u', 'i', 'o', 'p'];
        return fallback[index] || 'k';
    }
    function renderClaims() {
        const pending = state.pending;
        if (hasPendingGang()) {
            const actions = $('claimActions');
            actions.innerHTML = '';
            const shortcuts = ['W', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
            let shortcutIndex = 0;
            for (const gang of state.pendingConcealedGang) {
                const kong = document.createElement('button');
                kong.className = 'claim-button';
                kong.textContent = `暗杠 ${gang.tile.label} [${shortcuts[shortcutIndex++]}]`;
                kong.dataset.action = 'concealed-gang';
                kong.addEventListener('click', () => acceptConcealedGang(gang));
                actions.append(kong);
            }
            for (const upgrade of state.pendingUpgradeGang) {
                const kong = document.createElement('button');
                kong.className = 'claim-button';
                kong.textContent = `补杠 ${upgrade.tile.label} [${shortcuts[shortcutIndex++]}]`;
                kong.dataset.action = 'upgrade-gang';
                kong.addEventListener('click', () => acceptUpgradeGang(upgrade));
                actions.append(kong);
            }
            const pass = document.createElement('button');
            pass.className = 'claim-button secondary';
            pass.textContent = '暂不杠 [Esc]';
            pass.dataset.action = 'pass-gang';
            pass.addEventListener('click', () => {
                state.pendingUpgradeGang = [];
                state.pendingConcealedGang = [];
                render();
            });
            actions.append(pass);
            focusClaimAction(
                actions,
                `${state.pendingConcealedGang.map(gang => gang.tile.id).join(',')}:${
                    state.pendingUpgradeGang.map(gang => gang.tile.id).join(',')
                },pass-gang`
            );
            return;
        }
        const options = claimOptions(pending.tile, state.hands[0]);
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
        const removed = [];
        const indexes = [];
        for (const key of keys) {
            const index = hand.findIndex(
                (tile, candidate) =>
                    tile.key === key && !indexes.includes(candidate)
            );
            if (index < 0) return [];
            indexes.push(index);
            removed.push(hand[index]);
        }
        indexes.sort((left, right) => right - left);
        for (const index of indexes) hand.splice(index, 1);
        return removed;
    }
    function acceptClaim(type) {
        const pending = state.pending;
        if (!pending) return;
        const hand = state.hands[0];
        const tile = pending.tile;
        if (type === 'peng' || type === 'gang') {
            const count = type === 'gang' ? 3 : 2;
            const matchingTiles = removeTiles(hand, Array(count).fill(tile.key));
            if (matchingTiles.length !== count) return;
            state.melds[0].push({
                type,
                tiles: [...matchingTiles, tile],
                from: pending.from,
                concealed: false,
                kongKind: type === 'gang' ? 'exposed' : null,
            });
        }
        removeDiscard(pending.from, tile);
        state.pending = null;
        state.lastDiscard = null;
        state.current = 0;
        state.phase = 'discard';
        state.selected = null;
        state.hasPriorValidAction = true;
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
            applyKongScore(0, 'exposed');
            if (!drawReplacement(0)) return;
            if (promptSelfDrawWin(0)) return;
            refreshGangOpportunities(0);
        } else refreshGangOpportunities(0);
        render();
    }
    function findUpgradeGangs(player) {
        const hand = state.hands[player];
        const upgrades = [];
        for (const meld of state.melds[player]) {
            if (meld.type !== 'peng') continue;
            const matching = hand.find(tile => tile.key === meld.tiles[0].key);
            if (matching) upgrades.push({ meld, tile: matching });
        }
        return upgrades;
    }
    function findUpgradeGang(player) {
        return findUpgradeGangs(player)[0] || null;
    }
    function findConcealedGangs(player) {
        const hand = state.hands[player];
        return [...countsFor(hand)]
            .filter(([, count]) => count >= 4)
            .map(([key]) => ({ key, tile: hand.find(tile => tile.key === key) }));
    }
    function findConcealedGang(player) {
        return findConcealedGangs(player)[0] || null;
    }
    function hasPendingGang() {
        return state.pendingUpgradeGang.length > 0 || state.pendingConcealedGang.length > 0;
    }
    function refreshGangOpportunities(player) {
        state.pendingUpgradeGang = findUpgradeGangs(player);
        state.pendingConcealedGang = findConcealedGangs(player);
    }
    function applyKongScore(owner, kind) {
        const points = { exposed: 1, concealed: 2, added: 1 }[kind];
        if (owner === 0) state.score += points * 3;
        else state.score -= points;
    }
    function drawReplacement(player) {
        if (!state.wall.length) {
            endDraw();
            return false;
        }
        const lastTile = state.wall.length === 1;
        const replacement = state.wall.pop();
        state.hands[player].push(replacement);
        state.drawContexts[player] = {
            selfDraw: true,
            afterKong: true,
            lastTile,
            isDealer: player === 0,
            isFirstTurn: false,
            hasPriorValidAction: state.hasPriorValidAction,
        };
        if (player === 0) {
            state.newTileId = replacement.id;
            state.selected = replacement.id;
        }
        state.phase = 'discard';
        addHistory(`${NAMES[player]}杠后补了一张牌`);
        return true;
    }
    function promptSelfDrawWin(player) {
        const context = state.drawContexts[player] || {};
        const result = getWinningHandInfo(state.hands[player], player, context);
        if (!result) return false;
        if (player !== 0) {
            finishHand(player, '自摸', null, result);
            return true;
        }
        render();
        setTimeout(() => {
            if (!state.finished && state.current === player) {
                const win = window.confirm(
                    `恭喜！${result.patterns.map(pattern => PATTERN_NAMES[pattern]).join('、')}，要现在自摸吗？`
                );
                if (win) finishHand(player, '自摸', null, result);
                else {
                    refreshGangOpportunities(player);
                    render();
                }
            }
        }, 120);
        return true;
    }
    function drawUserGangReplacement() {
        if (!drawReplacement(0)) return;
        if (promptSelfDrawWin(0)) return;
        refreshGangOpportunities(0);
        render();
    }
    function acceptUpgradeGang(upgrade = state.pendingUpgradeGang[0]) {
        if (
            !upgrade ||
            !state.pendingUpgradeGang.includes(upgrade) ||
            state.current !== 0 ||
            state.finished
        )
            return;
        const handIndex = state.hands[0].findIndex(tile => tile.id === upgrade.tile.id);
        if (handIndex < 0) return;
        const [tile] = state.hands[0].splice(handIndex, 1);
        upgrade.meld.tiles.push(tile);
        upgrade.meld.type = 'gang';
        upgrade.meld.concealed = false;
        upgrade.meld.kongKind = 'added';
        state.pendingUpgradeGang = [];
        state.pendingConcealedGang = [];
        state.newTileId = null;
        state.hasPriorValidAction = true;
        addHistory('你将碰牌补杠为', tile.label);
        toast(`补杠成功：${tile.label}`);
        showSeatAction(0, '补杠', tile.label);
        applyKongScore(0, 'added');
        drawUserGangReplacement();
    }
    function acceptConcealedGang(gang = state.pendingConcealedGang[0]) {
        if (
            !gang ||
            !state.pendingConcealedGang.includes(gang) ||
            state.current !== 0 ||
            state.finished
        )
            return;
        const tiles = state.hands[0].filter(tile => tile.key === gang.key);
        if (tiles.length < 4) return;
        removeTiles(state.hands[0], Array(4).fill(gang.key));
        state.melds[0].push({
            type: 'gang',
            concealed: true,
            kongKind: 'concealed',
            tiles: tiles.slice(0, 4),
        });
        state.pendingUpgradeGang = [];
        state.pendingConcealedGang = [];
        state.newTileId = null;
        state.hasPriorValidAction = true;
        addHistory('你暗杠了', gang.tile.label);
        toast(`暗杠成功：${gang.tile.label}`);
        showSeatAction(0, '暗杠', gang.tile.label);
        applyKongScore(0, 'concealed');
        drawUserGangReplacement();
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
        const lastTile = state.wall.length === 1;
        const tile = state.wall.pop();
        state.hands[player].push(tile);
        if (player === 0) state.newTileId = tile.id;
        sortHand(state.hands[player]);
        state.drawContexts[player] = {
            selfDraw: true,
            afterKong: false,
            lastTile,
            isDealer: player === 0,
            isFirstTurn:
                player !== 0 &&
                state.discards[player].length === 0 &&
                !state.hasPriorValidAction,
            hasPriorValidAction: state.hasPriorValidAction,
        };
        state.phase = 'discard';
        addHistory(`${NAMES[player]}摸了一张牌`);
        return true;
    }
    function drawForUser() {
        if (state.current !== 0 || state.phase !== 'draw' || state.finished) return;
        if (!drawFor(0)) return;
        state.selected = state.newTileId;
        if (promptSelfDrawWin(0)) return;
        refreshGangOpportunities(0);
        render();
    }
    function discardForUser(tileId) {
        if (
            state.current !== 0 ||
            state.phase !== 'discard' ||
            state.finished ||
            hasPendingGang() ||
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
        const matchingCount = type === 'gang' ? 3 : 2;
        const matchingTiles = removeTiles(
            state.hands[player],
            Array(matchingCount).fill(tile.key)
        );
        if (matchingTiles.length !== matchingCount) return;
        removeDiscard(fromPlayer, tile);
        state.melds[player].push({
            type,
            tiles: [...matchingTiles, tile],
            from: fromPlayer,
            concealed: false,
            kongKind: type === 'gang' ? 'exposed' : null,
        });
        state.current = player;
        state.phase = 'discard';
        state.hasPriorValidAction = true;
        const action = type === 'gang' ? '杠' : '碰';
        addHistory(`${NAMES[player]}${action}了${NAMES[fromPlayer]}的`, tile.label);
        toast(`${NAMES[player]}${action}了${NAMES[fromPlayer]}打出的${tile.label}`);
        showSeatAction(player, action, tile.label);
        if (type === 'gang') {
            applyKongScore(player, 'exposed');
            if (!drawReplacement(player)) return;
            promptSelfDrawWin(player);
        }
    }
    function performBotSelfGang(player) {
        const concealed = findConcealedGang(player);
        const upgrade = concealed ? null : findUpgradeGang(player);
        if (!concealed && !upgrade) return false;
        if (concealed) {
            const tiles = state.hands[player].filter(
                tile => tile.key === concealed.key
            );
            removeTiles(state.hands[player], Array(4).fill(concealed.key));
            state.melds[player].push({
                type: 'gang',
                concealed: true,
                kongKind: 'concealed',
                tiles: tiles.slice(0, 4),
            });
            applyKongScore(player, 'concealed');
            addHistory(`${NAMES[player]}暗杠了`, concealed.tile.label);
            showSeatAction(player, '暗杠', concealed.tile.label);
        } else {
            const index = state.hands[player].findIndex(
                tile => tile.id === upgrade.tile.id
            );
            if (index < 0) return false;
            const [tile] = state.hands[player].splice(index, 1);
            upgrade.meld.tiles.push(tile);
            upgrade.meld.type = 'gang';
            upgrade.meld.concealed = false;
            upgrade.meld.kongKind = 'added';
            applyKongScore(player, 'added');
            addHistory(`${NAMES[player]}将碰牌补杠为`, tile.label);
            showSeatAction(player, '补杠', tile.label);
        }
        state.hasPriorValidAction = true;
        if (!drawReplacement(player)) return true;
        promptSelfDrawWin(player);
        return true;
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
                if (promptSelfDrawWin(player)) return;
            }
            while (performBotSelfGang(player)) {
                if (state.finished) return;
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
                state.hands[0]
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
    function finishHand(winner, kind, winningTile = null, result = null) {
        const winResult =
            result || getWinningHandInfo(state.hands[winner], winner, {
                selfDraw: true,
                ...state.drawContexts[winner],
            });
        if (!winResult) return;
        state.finished = true;
        state.phase = 'done';
        state.pending = null;
        state.current = winner;
        state.winInfo = { winner, kind, tile: winningTile, score: winResult };
        if (winner === 0) {
            state.score += winResult.total;
            $('tableMessage').textContent = `恭喜胡牌！${kind} · ${winResult.fan} 番 · +${winResult.total} 分`;
            toast(`恭喜胡牌！${kind}，${winResult.fan} 番，获得 ${winResult.total} 分`);
        } else {
            state.score -= winResult.points;
            $('tableMessage').textContent = `${NAMES[winner]}${kind} · ${winResult.fan} 番 · -${winResult.points} 分`;
            toast(`${NAMES[winner]}${kind}，${winResult.fan} 番`);
        }
        addHistory(
            winner === 0 ? `你${kind}，本局胜利` : `${NAMES[winner]}${kind}，本局结束`
        );
        if (winner !== 0) showSeatAction(winner, '自摸胡');
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
        state.drawContexts = [null, null, null, null];
        state.hasPriorValidAction = false;
        state.pendingUpgradeGang = [];
        state.pendingConcealedGang = [];
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
        state.drawContexts[0] = {
            selfDraw: true,
            afterKong: false,
            lastTile: false,
            isDealer: true,
            isInitialHand: true,
            isFirstTurn: true,
            hasPriorValidAction: false,
        };
        refreshGangOpportunities(0);
        $('historyList').innerHTML =
            '<div class="empty-history">新的一局开始了，祝你手气好！</div>';
        addHistory('新的一局开始，你是庄家，先打出一张牌');
        render();
        promptSelfDrawWin(0);
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
        const hasClaim = state.pending || hasPendingGang();
        if (hasClaim && event.key === 'Escape') {
            event.preventDefault();
            if (hasPendingGang()) {
                state.pendingUpgradeGang = [];
                state.pendingConcealedGang = [];
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
        if (state.pending || hasPendingGang()) {
            const key = event.key.toLowerCase();
            if (['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].includes(key)) {
                event.preventDefault();
                const gangShortcuts = ['w', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
                const options = hasPendingGang()
                    ? [
                          ...state.pendingConcealedGang.map((gang, index) => ({
                              type: 'concealed-gang',
                              gang,
                              shortcut: gangShortcuts[index],
                          })),
                          ...state.pendingUpgradeGang.map((upgrade, index) => ({
                              type: 'upgrade-gang',
                              upgrade,
                              shortcut:
                                  gangShortcuts[
                                      state.pendingConcealedGang.length + index
                                  ],
                          })),
                      ]
                    : claimOptions(state.pending.tile, state.hands[0]);
                const match = options.find((option, index) => {
                    const type = option.type;
                    if (option.shortcut) return key === option.shortcut;
                    return getClaimShortcut(type, index).toLowerCase() === key;
                });
                if (match) {
                    if (match.type === 'concealed-gang')
                        acceptConcealedGang(match.gang);
                    else if (match.type === 'upgrade-gang')
                        acceptUpgradeGang(match.upgrade);
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
        state.ruleMode =
            event.target.value === 'red-center-laizi'
                ? 'red-center-laizi'
                : 'guangdong';
        startGame(true);
        toast(
            state.ruleMode === 'red-center-laizi'
                ? '已切换到广东红中赖子规则：红中可当真牌或赖子'
                : '已切换到广东麻将规则：仅自摸胡牌'
        );
    });
    $('historyList').innerHTML = '<div class="empty-history">等待牌局开始…</div>';
    window.__mahjongDebug = {
        getState: () => state,
        getReadyWaitInfo,
        getHandDisplayOrder,
        getWinningHandInfo,
        getFastReadyPatterns,
        getClaimOptions: claimOptions,
        calculateWinScore,
        acceptConcealedGang,
        acceptUpgradeGang,
        acceptClaim,
        render,
    };
    startGame(false);
})();
