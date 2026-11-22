/**
 * ST Set Collection tracker
 *
 * Shows how many ST sets (and set pieces) are owned across all loaded accounts, or a single account.
 * Ownership comes from each account's totals counter, which covers characters, vaults, gifts,
 * potion/material storage, pets and quickslots regardless of what is displayed.
 * Set data is generated into lib/stsets.js by tools/datagen/build_stsets.py.
 */

setuptools.app.muledump.stsets = {};

//  view settings for this session
setuptools.tmp.stsetsView = {
    show: 'all',
    cls: 'all',
    legacy: true
};

/**
 * @function
 * @param {string} [guid] - limit to a single account
 * @returns {Object} item id -> quantity owned
 */
setuptools.app.muledump.stsets.counts = function(guid) {

    var counts = {};
    var guids = ( typeof guid === 'string' ) ? [guid] : Object.keys(window.mules || {});
    guids.forEach(function(g) {
        var mule = window.mules[g];
        if ( !mule || mule.disabled === true ) return;
        var counter = mule.totals;
        if ( !counter || !counter.data || typeof counter.data.totals !== 'object' ) return;
        var totals = counter.data.totals;
        for ( var id in totals ) {
            if ( !totals.hasOwnProperty(id) || id === '-1' ) continue;
            counts[id] = (counts[id] || 0) + (+totals[id] || 0);
        }
    });
    return counts;

};

/**
 * @function
 * @param {Object} counts - item id -> quantity
 * @returns {Array} per-set progress
 */
setuptools.app.muledump.stsets.progress = function(counts) {

    return (window.stSets || []).map(function(set) {
        var pieces = set.pieces.map(function(piece) {
            //  alternate item ids for the same piece count towards it
            var qty = 0;
            [piece[0]].concat(piece[1] || []).forEach(function(id) { qty += counts[id] || 0; });
            return {id: piece[0], qty: qty};
        });
        var owned = pieces.filter(function(p) { return p.qty > 0; }).length;
        return {
            set: set,
            pieces: pieces,
            owned: owned,
            total: pieces.length,
            complete: owned === pieces.length,
            copies: Math.min.apply(null, pieces.map(function(p) { return p.qty; })),
            legacy: /^Legacy /.test(set.name)
        };
    });

};

/**
 * @function
 * @param {Array} rows - progress rows
 * @returns {Object} summary totals
 */
setuptools.app.muledump.stsets.summarize = function(rows) {

    var s = {sets: rows.length, complete: 0, started: 0, pieces: 0, owned: 0, copies: 0};
    rows.forEach(function(r) {
        if ( r.complete ) s.complete++;
        if ( r.owned > 0 ) s.started++;
        s.pieces += r.total;
        s.owned += r.owned;
        s.copies += r.copies;
    });
    s.setPct = s.sets ? Math.floor(1000 * s.complete / s.sets) / 10 : 0;
    s.piecePct = s.pieces ? Math.floor(1000 * s.owned / s.pieces) / 10 : 0;
    return s;

};

/**
 * @function
 * @param {string} [guid] - limit to a single account
 * @description Display the ST Set Collection tracker
 */
setuptools.app.muledump.stsets.display = function(guid) {

    if ( typeof guid !== 'string' || !window.mules[guid] ) guid = undefined;
    setuptools.lightbox.close();

    if ( !Array.isArray(window.stSets) || window.stSets.length === 0 ) {
        setuptools.lightbox.build('stsets', 'ST set data is missing. Make sure lib/stsets.js is loaded.');
        setuptools.lightbox.settitle('stsets', 'ST Set Collection');
        setuptools.lightbox.display('stsets');
        return;
    }

    var view = setuptools.tmp.stsetsView;
    var rows = setuptools.app.muledump.stsets.progress(setuptools.app.muledump.stsets.counts(guid));

    //  class options in set order
    var classList = [];
    rows.forEach(function(r) { if ( classList.indexOf(r.set.cls) === -1 ) classList.push(r.set.cls); });

    var classOptions = '<option value="all">All Classes</option>' + classList.map(function(c) {
        return '<option value="' + c + '"' + ( (view.cls === c) ? ' selected' : '' ) + '>' + c + '</option>';
    }).join('');
    var showOptions = {
        all: 'All Sets',
        complete: 'Complete',
        incomplete: 'Incomplete',
        almost: 'Missing 1 Piece',
        started: 'Started',
        none: 'Not Started'
    };
    var showHtml = Object.keys(showOptions).map(function(k) {
        return '<option value="' + k + '"' + ( (view.show === k) ? ' selected' : '' ) + '>' + showOptions[k] + '</option>';
    }).join('');

    setuptools.lightbox.build('stsets', ' \
        <div class="stsets"> \
            <div class="stsetsHeader">' + ( guid ? 'Account: <strong>' + $('<span>').text(setuptools.app.muledump.getName(guid)).html() + '</strong>' : 'All loaded accounts' ) + '</div> \
            <div class="stsetsSummary"></div> \
            <div class="stsetsControls flex-container"> \
                <select class="setuptools menuTiny" name="stsetsShow">' + showHtml + '</select> \
                <select class="setuptools menuTiny" name="stsetsClass">' + classOptions + '</select> \
                <label class="stsetsLegacy"><input type="checkbox" name="stsetsLegacy"' + ( view.legacy ? ' checked' : '' ) + '> Include legacy sets</label> \
            </div> \
            <div class="stsetsList"></div> \
            <div class="stsetsLegend">Bright items are owned (the number is how many). Click an item to find the accounts holding it.</div> \
        </div> \
    ');
    setuptools.lightbox.settitle('stsets', 'ST Set Collection');
    setuptools.lightbox.drawhelp('stsets', 'docs/muledump/stsets', 'ST Set Collection Help');
    setuptools.lightbox.display('stsets', {variant: 'fl-StSets'});

    var render = function() {

        //  summary always covers every set in scope (legacy toggle only), not the display filters
        var scoped = rows.filter(function(r) { return view.legacy || !r.legacy; });
        var all = setuptools.app.muledump.stsets.summarize(scoped);
        $('div.stsetsSummary').html(' \
            <div class="stsetsBar"><div style="width: ' + all.setPct + '%;"></div></div> \
            <div><strong>' + all.complete + ' / ' + all.sets + '</strong> sets complete (' + all.setPct + '%) \
            &middot; <strong>' + all.owned + ' / ' + all.pieces + '</strong> pieces (' + all.piecePct + '%) \
            &middot; ' + all.started + ' sets started \
            &middot; ' + all.copies + ' full set' + ( all.copies === 1 ? '' : 's' ) + ' could be assembled</div> \
        ');

        var list = $('div.stsetsList').empty();
        var visible = scoped.filter(function(r) {
            if ( view.cls !== 'all' && r.set.cls !== view.cls ) return false;
            switch ( view.show ) {
                case 'complete': return r.complete;
                case 'incomplete': return !r.complete;
                case 'almost': return r.total - r.owned === 1;
                case 'started': return r.owned > 0;
                case 'none': return r.owned === 0;
            }
            return true;
        });

        if ( visible.length === 0 ) {
            list.append('<div class="stsetsEmpty">No sets match these filters.</div>');
            return;
        }

        var lastCls;
        visible.forEach(function(r) {

            if ( r.set.cls !== lastCls ) {
                lastCls = r.set.cls;
                var cs = setuptools.app.muledump.stsets.summarize(scoped.filter(function(x) { return x.set.cls === lastCls; }));
                list.append(
                    $('<div class="stsetsClass">').text(lastCls + ' — ' + cs.complete + ' / ' + cs.sets + ' sets, ' + cs.owned + ' / ' + cs.pieces + ' pieces')
                );
            }

            var row = $('<div class="stsetsRow flex-container">').toggleClass('complete', r.complete);
            var info = $('<div class="stsetsInfo">');
            $('<div class="stsetsName">').text(r.set.name).appendTo(info);
            $('<div class="stsetsCount">').text(
                r.owned + ' / ' + r.total + ( r.copies > 1 ? ' (×' + r.copies + ')' : '' )
            ).appendTo(info);
            info.appendTo(row);

            var icons = $('<div class="stsetsPieces flex-container noFlexAutoWidth">');
            r.pieces.forEach(function(p) {
                //  noselect keeps the main page's click-and-find highlighting off these icons
                var $i = setuptools.app.muledump.item(p.id, 'noselect stsetsPiece ' + ( p.qty > 0 ? 'owned' : 'missing' ), p.qty > 0 ? p.qty : undefined);
                $i.on('click.stsets', function() {
                    window.toggle_filter(this);
                });
                $i.appendTo(icons);
            });
            icons.appendTo(row);
            row.appendTo(list);

        });

    };

    $('select[name="stsetsShow"]').on('change.stsets', function() { view.show = $(this).val(); render(); });
    $('select[name="stsetsClass"]').on('change.stsets', function() { view.cls = $(this).val(); render(); });
    $('input[name="stsetsLegacy"]').on('change.stsets', function() { view.legacy = $(this).is(':checked'); render(); });

    render();

};
