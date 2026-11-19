//  exaltations: per-class dungeon completions with 8/8 characters (<PowerUpStats> in char/list)
//
//  <PowerUpStats><ClassStats class="803">60,5,0,3,0,0,0,0</ClassStats>...</PowerUpStats>
//  values are completion counts in the client's order Dex, Spd, Vit, Wis, Def, Att, Mana, Life
//  (field order of the client's power-up class stats; verified against RealmEye's exaltations page).
//  each stat has 5 exaltation levels at 5/15/30/50/75 completions; every level gives +5 HP/MP or +1 to other stats.
(function(window) {

    var THRESHOLDS = [5, 15, 30, 50, 75];
    var STATS = ['HP', 'MP', 'ATT', 'DEF', 'SPD', 'DEX', 'VIT', 'WIS'];
    //  position of each display stat inside the PowerUpStats value list
    var VALUE_INDEX = [7, 6, 5, 4, 1, 0, 2, 3];
    var POWERUPS = ['LIFE', 'MANA', 'ATT', 'DEF', 'SPD', 'DEX', 'VIT', 'WIS'];
    var PER_LEVEL = [5, 5, 1, 1, 1, 1, 1, 1];

    //  collect class -> "counts" from the parsed XML (xmlToJson drops the class attribute)
    function collect(xmlDoc) {
        var map = {};
        var root = xmlDoc.getElementsByTagName('PowerUpStats')[0];
        if ( !root ) return map;
        var nodes = root.getElementsByTagName('ClassStats');
        for ( var i = 0; i < nodes.length; i++ ) {
            var cls = nodes[i].getAttribute('class');
            if ( cls ) map[cls] = nodes[i].textContent || '';
        }
        return map;
    }

    function level(count) {
        var l = 0;
        while ( l < THRESHOLDS.length && count >= THRESHOLDS[l] ) l++;
        return l;
    }

    //  exaltation info for a class type: [{stat, count, level, bonus, next, dungeon}] or undefined
    function forClass(map, classType) {
        if ( typeof map !== 'object' || map === null ) return undefined;
        var raw = map[+classType];
        if ( typeof raw !== 'string' ) return undefined;
        var counts = raw.split(',').map(Number);
        var dungeons = {};
        (window.exaltationDungeons || []).forEach(function(d) { dungeons[d[0]] = d; });
        return STATS.map(function(stat, i) {
            var count = counts[VALUE_INDEX[i]] || 0, l = level(count);
            return {
                stat: stat,
                count: count,
                level: l,
                bonus: l * PER_LEVEL[i],
                next: ( l < THRESHOLDS.length ) ? THRESHOLDS[l] : undefined,
                dungeon: dungeons[POWERUPS[i]]
            };
        });
    }

    //  total exaltation levels on a class
    function total(info) {
        return ( info || [] ).reduce(function(a, e) { return a + e.level; }, 0);
    }

    //  compact row of exaltation levels for a character card
    function row(map, classType) {
        var info = forClass(map, classType);
        if ( !info || total(info) === 0 && info.every(function(e) { return e.count === 0; }) ) return undefined;
        var $r = $('<div class="exalts">');
        info.forEach(function(e) {
            var title = e.stat + ': ' + e.count + ' completions, exaltation ' + e.level + '/5 (+' + e.bonus + ')' +
                ( e.next ? ', next at ' + e.next : ', maxed' ) + ( e.dungeon ? '\n' + e.dungeon[1] + ( e.dungeon[2] ? ' / ' + e.dungeon[2] : '' ) : '' );
            $('<span class="exalt">')
                .addClass('lv' + e.level)
                .attr('title', title)
                .append($('<span class="exaltstat">').text(e.stat))
                .append($('<span class="exaltlevel">').text(e.level ? '+' + e.bonus : '0'))
                .appendTo($r);
        });
        return $r;
    }

    window.MuledumpExalts = {
        THRESHOLDS: THRESHOLDS,
        STATS: STATS,
        collect: collect,
        level: level,
        forClass: forClass,
        total: total,
        row: row
    };

})(window);
