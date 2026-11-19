//  support for Exalt unique items and enchantments
//
//  item lists now contain entries like "65280#5444412674441216" (itemId#uniqueId); the unique id
//  refers to an <ItemData id="..." type="...">base64url</ItemData> entry in a UniqueItemInfo block.
//  the blob is: [0x00, 0x02, slotCount, int16le enchantment ids x slotCount, ...trailer]
//  where -3 marks a locked slot (rarity system: items roll 1-4 open slots).
(function(window) {

    //  rarity is decided by how many enchantments an item carries
    var RARITIES = [
        undefined,
        {name: 'Uncommon', color: 'rgb(127, 255, 63)'},
        {name: 'Rare', color: 'rgb(50, 135, 255)'},
        {name: 'Legendary', color: 'rgb(195, 76, 255)'},
        {name: 'Divine', color: 'rgb(255, 221, 49)'}
    ];

    //  uid -> {slots: [enchantment type id | null, ...]}
    var uniqueItems = {};

    //  numeric item id from an item list entry ("2818", "65280#5444412674441216", -1)
    function itemId(entry) {
        if ( typeof entry === 'number' ) return entry;
        if ( typeof entry !== 'string' ) return Number(entry);
        var hash = entry.indexOf('#');
        return Number(hash === -1 ? entry : entry.substring(0, hash));
    }

    //  unique id from an item list entry, or undefined
    function itemUid(entry) {
        if ( typeof entry !== 'string' ) return undefined;
        var hash = entry.indexOf('#');
        return hash === -1 ? undefined : entry.substring(hash + 1);
    }

    //  decode an ItemData blob into its enchantment slots (null = empty slot)
    function decode(blob) {
        if ( typeof blob !== 'string' || blob.length === 0 ) return [];
        var b64 = blob.replace(/-/g, '+').replace(/_/g, '/');
        while ( b64.length % 4 ) b64 += '=';
        var raw;
        try { raw = atob(b64); } catch (e) { return []; }
        if ( raw.length < 3 ) return [];
        var count = raw.charCodeAt(2), out = [];
        for ( var i = 0; i < count && 4 + 2 * i < raw.length; i++ ) {
            var v = raw.charCodeAt(3 + 2 * i) | (raw.charCodeAt(4 + 2 * i) << 8);
            if ( v & 0x8000 ) v -= 0x10000;
            out.push(v >= 0 ? v : null);
        }
        return out;
    }

    //  collect uid -> blob from a parsed char/list XML document (before xmlToJson, which drops the ids)
    function collect(xmlDoc) {
        var map = {};
        var nodes = xmlDoc.getElementsByTagName('ItemData');
        for ( var i = 0; i < nodes.length; i++ ) {
            var id = nodes[i].getAttribute('id');
            if ( id ) map[id] = nodes[i].textContent || '';
        }
        return map;
    }

    //  register a uid -> blob map (from fresh or cached account data)
    function register(map) {
        if ( typeof map !== 'object' || map === null ) return;
        for ( var uid in map )
            if ( map.hasOwnProperty(uid) ) uniqueItems[uid] = decode(map[uid]);
    }

    function uidOf(entry) {
        return ( typeof entry === 'string' && entry.indexOf('#') === -1 ) ? entry : itemUid(entry);
    }

    //  full enchantment info for an item list entry or uid
    //  {slots: [{type, name, description, x, y} | null, ...], enchants: [non-null slots], rarity}
    function info(entry) {
        var slots = uniqueItems[uidOf(entry)] || [];
        var table = window.enchantments || {};
        var out = {slots: [], enchants: [], rarity: undefined};
        for ( var i = 0; i < slots.length; i++ ) {
            if ( slots[i] === null ) {
                out.slots.push(null);
                continue;
            }
            var e = table[slots[i]] || ['Unknown Enchantment ' + slots[i], '', 0, 0];
            var en = {type: slots[i], name: e[0], description: e[1], x: e[2], y: e[3]};
            out.slots.push(en);
            out.enchants.push(en);
        }
        out.rarity = RARITIES[Math.min(out.enchants.length, 4)];
        return out;
    }

    //  enchantments for an item list entry: [[name, description], ...]
    function forEntry(entry) {
        return info(entry).enchants.map(function(e) {
            return [e.name, e.description];
        });
    }

    //  icon element for one enchantment (scale: 1 = 16px)
    function icon(en, scale) {
        var $i = $('<span class="enchantIcon">');
        if ( !en ) return $i.addClass('empty');
        scale = scale || 1;
        return $i.css({
            'width': 16 * scale + 'px',
            'height': 16 * scale + 'px',
            'background-position': '-' + (en.x * scale) + 'px -' + (en.y * scale) + 'px',
            'background-size': (512 * scale) + 'px auto'
        });
    }

    //  strip of slot markers shown on top of an item icon (only for enchanted items)
    function markers(entry) {
        var data = info(entry);
        if ( data.enchants.length === 0 ) return undefined;
        var $m = $('<span class="enchantMarkers">');
        for ( var i = 0; i < data.slots.length; i++ ) icon(data.slots[i], 0.5).appendTo($m);
        return $m;
    }

    window.MuledumpUnique = {
        itemId: itemId,
        itemUid: itemUid,
        decode: decode,
        collect: collect,
        register: register,
        info: info,
        forEntry: forEntry,
        icon: icon,
        markers: markers
    };

})(window);
