//  character stats (PCStats) and the Exalt fame bonus system
//
//  PCStats (Exalt): base64url of
//      [4 byte magic 0e f0 ad ba][8 x uint32be presence mask; bit n of word w = stat 32*w+n][LEB128 varint per present stat]
//  the legacy format (5 byte records: [stat id][int32be value]) is still decoded for old cached data.
//
//  stat names and fame bonuses are generated from the game client (playerStats / fameBonuses in constants.js)

var pcstatnames = (function() {
    var out = {};
    var src = window.playerStats || {};
    for ( var i in src )
        if ( src.hasOwnProperty(i) ) out[i] = src[i][1] || src[i][0].replace(/Completed$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
    return out;
})();

//  stat id (e.g. "TilesUncovered") -> index
var pcstatindex = (function() {
    var out = {};
    var src = window.playerStats || {};
    for ( var i in src ) if ( src.hasOwnProperty(i) ) out[src[i][0]] = +i;
    return out;
})();

var shortdungeonnames = { // sorted by "tier"
    13: 'Pirate',
    23: 'Jungle',
    17: 'Spider',
    16: 'Snake',
    18: 'Sprite',
    24: 'Manor',
    14: 'UDL',
    15: 'Abyss',
    22: 'Trench',
    21: 'Tomb'
};

//  legacy multiplier bonuses no longer exist; kept so old references don't throw
var bonuses = {};

function readstats(pcstats) {

    pcstats = pcstats || '';
    var b;
    try {
        var b64 = pcstats.replace(/-/g, '+').replace(/_/g, '/');
        while ( b64.length % 4 ) b64 += '=';
        b = atob(b64);
    } catch (e) {
        b = '';
    }
    var r = [];

    if ( b.length >= 36 && b.charCodeAt(0) === 0x0e && b.charCodeAt(1) === 0xf0 && b.charCodeAt(2) === 0xad && b.charCodeAt(3) === 0xba ) {

        //  exalt format
        var present = [];
        for ( var w = 0; w < 8; w++ ) {
            var word = ((b.charCodeAt(4 + w * 4) << 24) | (b.charCodeAt(5 + w * 4) << 16) | (b.charCodeAt(6 + w * 4) << 8) | b.charCodeAt(7 + w * 4)) >>> 0;
            for ( var bit = 0; bit < 32; bit++ )
                if ( (word >>> bit) & 1 ) present.push(32 * w + bit);
        }
        var pos = 36;
        for ( var p = 0; p < present.length && pos < b.length; p++ ) {
            var val = 0, mul = 1, x;
            do {
                x = b.charCodeAt(pos++);
                val += (x & 0x7f) * mul;
                mul *= 128;
            } while ( (x & 0x80) && pos < b.length );
            r[present[p]] = val;
        }

    } else {

        //  legacy format
        for ( var i = 0; i + 4 < b.length; i += 5 ) {
            var v = 0;
            for ( var k = 1; k <= 4; k++ ) v = v * 256 + b.charCodeAt(i + k);
            r[b.charCodeAt(i)] = v;
        }

    }

    //  legacy code (e.g. wawawa's tracker) reads fixed indexes, some of which the game has since retired
    //  (19 Level Up Assists, 46 Hard LODs), so every index up to the highest known one is defined
    var maxIndex = 59;
    for ( var n in pcstatnames ) if ( +n > maxIndex ) maxIndex = +n;
    for ( var z = 0; z <= maxIndex; z++ ) if ( !r[z] ) r[z] = 0;

    //  party level-ups replaced level up assists (old index 19)
    if ( !r[19] && typeof pcstatindex.PartyLevelUps === 'number' ) r[19] = r[pcstatindex.PartyLevelUps] || 0;

    return r;

}

//  class max check for MaxedStat conditions
var FAMESTATS = {health: 0, magic: 1, attack: 2, defense: 3, speed: 4, dexterity: 5, vitality: 6, wisdom: 7};
var FAMESTATTAGS = 'MaxHitPoints MaxMagicPoints Attack Defense Speed Dexterity HpRegen MpRegen'.split(' ');

function famestatmaxed(c, stat) {
    var cl = window.classes[+c.ObjectType];
    var i = FAMESTATS[stat];
    if ( !cl || typeof i !== 'number' ) return false;
    return +c[FAMESTATTAGS[i]] >= cl[3][i];
}

//  how many times a fame bonus is earned (0 = not earned)
function famebonuscount(bonus, st, c, d) {
    var conds = bonus[8], times = Infinity;
    for ( var i = 0; i < conds.length; i++ ) {
        var cond = conds[i];
        if ( cond[0] === '#maxed' ) {
            if ( !famestatmaxed(c, cond[1]) ) return 0;
            times = Math.min(times, 1);
        } else if ( cond[0] === '#FirstCharacter' ) {
            if ( !(d && d.Account && d.Account.Stats && +d.Account.Stats.TotalFame === 0) ) return 0;
            times = Math.min(times, 1);
        } else if ( cond[0].charAt(0) === '#' ) {
            return 0;
        } else {
            var value = st[pcstatindex[cond[0]]] || 0;
            if ( value < cond[1] ) return 0;
            times = Math.min(times, bonus[5] ? Math.floor(value / cond[1]) : 1);
        }
    }
    if ( times === Infinity ) return 0;
    if ( bonus[5] && bonus[6] > 0 ) times = Math.min(times, bonus[6]);
    return times;
}

//  total fame for a character: base + flat bonuses + % of base fame from milestone bonuses
//  returns {base, total, earned: [{name, category, fame, times}]}
function calcfame(c, d, base, st) {
    st = st || readstats(c.PCStats);
    base = ( typeof base === 'number' ) ? base : +c.CurrentFame || 0;
    var out = {base: base, total: base, earned: []};
    var list = window.fameBonuses || [];
    for ( var i = 0; i < list.length; i++ ) {
        var times = famebonuscount(list[i], st, c, d);
        if ( !times ) continue;
        var fame = Math.floor(list[i][3] * times + base * list[i][4] / 100);
        out.total += fame;
        out.earned.push({name: list[i][0].replace('{0}', times), category: list[i][2], fame: fame, times: times});
    }
    return out;
}

//  next unearned tier for each fame bonus category the character has started
function famegoals(c, d, st) {
    st = st || readstats(c.PCStats);
    var list = window.fameBonuses || [], seen = {}, out = [];
    for ( var i = 0; i < list.length; i++ ) {
        var b = list[i];
        if ( seen[b[2]] ) continue;
        if ( b[8].length !== 1 || b[8][0][0].charAt(0) === '#' ) continue;
        var value = st[pcstatindex[b[8][0][0]]] || 0;
        var need = b[8][0][1];
        var times = famebonuscount(b, st, c, d);
        if ( b[5] ) {
            if ( b[6] > 0 && times >= b[6] ) continue;
            need = need * (times + 1);
        } else if ( times > 0 ) continue;
        seen[b[2]] = true;
        if ( value <= 0 ) continue;
        out.push([need - value, b[0].replace('{0}', times + 1), pcstatnames[pcstatindex[b[8][0][0]]] || b[8][0][0]]);
    }
    return out;
}

function printstats(c, d, dogoals, dostats, Mule) {
    var st = readstats(c.PCStats);
    var $c = $('<table class="pcstats">');

    function tline(name, val, cl, title) {
        var $r = $('<tr>')
            .append($('<td>').text(name))
            .append($('<td>').addClass(cl || 'pcstat').text(val))
            .appendTo($c);
        if ( title ) $r.attr('title', title);
    }
    function gline(t, b) {
        $('<tr>')
            .append($('<td colspan=2>')
                .addClass('goal')
                .append($('<span>').text(t))
                .append($('<span class="bonus">').text(b))).appendTo($c);
    }

    if (dogoals) {
        var goals = famegoals(c, d, st);
        for ( var g = 0; g < goals.length; g++ )
            gline('• ' + goals[g][0].toLocaleString() + ' ' + goals[g][2].toLowerCase() + ' for ', goals[g][1]);
    }
    if (!dostats) return $c;

    for (var i in st) {
        if (!st[i]) continue;
        if ( +i === 19 && !(i in pcstatnames) ) continue;   // alias of party level-ups, listed under its own name
        var sname = pcstatnames[i] || '#' + i;
        tline(sname, st[i]);
    }
    if (st[20] > 59) {
        var v = st[20], r = [];
        var divs = { 'd': 24 * 60, 'h': 60, 'm': 1 }
        for (var s in divs) {
            if (r.length > 2) break;
            var t = Math.floor(v / divs[s]);
            if (t) r.push(t + s);
            v %= divs[s];
        }
        tline('Active', r.join(' '), 'info');
    }
    if (st[0] && st[1]) {
        tline('Accuracy', Math.round(10000 * st[1] / st[0]) / 100 + '%', 'info');
    }

    var fame = calcfame(c, d, undefined, st);
    if (!fame.base) return $c;
    tline('Base Fame', fame.base, 'info');
    for ( var e = 0; e < fame.earned.length; e++ )
        tline(fame.earned[e].name, '+' + fame.earned[e].fame, 'bonus', fame.earned[e].category);
    tline('Total Fame', fame.total, 'bonus');

    return $c;
}
