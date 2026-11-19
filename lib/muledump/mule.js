(function($, window) {

    var options = window.options;
    var accounts = window.accounts;
    var items = window.items;
    var classes = window.classes;

// max width of an account box in columns
    var ROW = ( setuptools.data.config.rowlength ) ? setuptools.data.config.rowlength : 7;
    var vaultlayout = ( setuptools.data.config.vaultlayout ) ? setuptools.data.config.vaultlayout : 0;

//  we'll prepare this later
    VAULTORDER = [];
    vaultwidth = ROW;

// dom snippet generators

    function stat(where, type, text) {
        return $('<strong class="stat">').addClass(type).text(text).appendTo(where);
    }

    function maketable(classname, items, row) {
        row = row || ROW;
        var $t = $('<table>').addClass(classname);
        var $row;
        for (var i = 0; i < items.length; i++) {
            if (i % row === 0) {
                if ($row) $t.append($row);
                $row = $('<tr>');
            }
            $('<td class="cont">').append(items[i]).appendTo($row);
        }
        if ($row) $t.append($row);
        var cols = items.length >= row ? row : items.length;
        cols = cols || 1;
        $t.css('width', '' + (184 * cols + 14 * (cols - 1)) + 'px');
        return $t;
    }

    //  backpack slot count: 0, 8 (backpack) or 16 (backpack + extender)
    function backpackSlots(c) {
        if ( typeof c !== 'object' || c === null ) return 0;
        if ( typeof c.BackpackSlots === 'string' && c.BackpackSlots !== '' ) return Math.max(0, +c.BackpackSlots || 0);
        return ( +c.HasBackpack === 1 ) ? 8 : 0;
    }

    //  consumable quickslots: [[itemEntry, count], ...] from "id|count,id|count"
    function quickslots(c) {
        if ( typeof c !== 'object' || c === null || typeof c.EquipQS !== 'string' || c.EquipQS === '' ) return [];
        var slots = c.EquipQS.split(',').map(function(q) {
            var parts = q.split('|');
            return [parts[0] || '-1', +parts[1] || 0];
        });
        var max = ( c.Has3Quickslots === '1' || c.Has3Quickslots === 'True' ) ? 3 : 2;
        while ( slots.length < max ) slots.push(['-1', 0]);
        return slots;
    }

    function escapeHtml(text) {
        return $('<span>').text(text).html().replace(/"/g, '&quot;');
    }

    //  owned cosmetics (titles / emotes / entrances) as a count with the names in a tooltip
    function cosmeticRow(label, list, table, nameOf) {
        var ids = ( typeof list === 'string' && list !== '' ) ? list.split(',') : [];
        var names = ids.map(function(id) {
            var e = (table || {})[+id];
            return e ? nameOf(e) : 'Unknown #' + id;
        }).filter(Boolean).sort();
        return '<div class="flex-container" title="' + escapeHtml(names.join('\n')) + '"><div>' + label + '</div><div>' + ids.length + '</div></div>';
    }

    //  exalt-era account data for the account info panel
    function exaltAccountInfo(a) {
        if ( typeof a !== 'object' || a === null ) return '';
        var cos = window.cosmetics || {};
        var rows = '';
        var row = function(label, value, title) {
            if ( value === undefined || value === null || value === '' ) return;
            rows += '<div class="flex-container"' + ( title ? ' title="' + escapeHtml(title) + '"' : '' ) + '><div>' + label + '</div><div>' + escapeHtml(String(value)) + '</div></div>';
        };
        if ( a.AccountLvl ) {
            row('Account Level', a.AccountLvl + ( (a.AccountLvlClaimed && a.AccountLvlClaimed !== a.AccountLvl) ? ' (' + a.AccountLvlClaimed + ' claimed)' : '' ),
                'Account XP: ' + (+a.ALXPCurrent || 0).toLocaleString());
            row('Account Level Boosts', '+' + (+a.AccountLVLRewardBoostExp || 0) + '% XP, +' + (+a.AccountLVLRewardBoostLoot || 0) + '% Loot',
                ( +a.AccountLVLRewardDiscountBP ) ? 'Battle Pass discount: ' + a.AccountLVLRewardDiscountBP : undefined);
        }
        row('Fortune Tokens', a.FortuneToken);
        row('Campaign Points', a.UnityCampaignPoints);
        row('Forge Fire Energy', a.ForgeFireEnergy);
        var blueprints = ( typeof a.RegularForgeFireBlueprints === 'string' && a.RegularForgeFireBlueprints !== '' ) ? a.RegularForgeFireBlueprints.split(',').length : 0;
        if ( blueprints ) row('Forge Blueprints', blueprints);
        if ( a.NextCharSlotPrice ) row('Next Character Slot', (+a.NextCharSlotPrice).toLocaleString() + ' gold');
        rows += cosmeticRow('Titles Owned', a.OwnedTitles, cos.titles, function(e) { return e[0]; });
        rows += cosmeticRow('Emotes Owned', a.OwnedEmotes, cos.emotes, function(e) { return e; });
        rows += cosmeticRow('Entrances Owned', a.OwnedEntrances, cos.entrances, function(e) { return e; });
        return rows;
    }

    var NUMCLASSES = 0;
    for (var i in classes) NUMCLASSES++;

    //  exalt star ranks (class quests) are unlocked by best base fame per class
    var STARFAME = [20, 500, 1500, 5000, 15000];
    var STARCOLOR = ['#8a98de', '#314ddb', '#c1272d', '#f7931e', '#ffff00', '#ffffff'];
    function addstar($t, d, guid) {
        var r = 0;
        if (!d.Account.Stats || !d.Account.Stats.ClassStats) return;
        var s = d.Account.Stats.ClassStats;
        if (!s.length) s = [s];
        for (var i = 0; i < s.length; i++) {
            var b = +(s[i].BestBaseFame || s[i].BestFame) || 0;
            for (var j = 0; b >= STARFAME[j] && j < 5; j++);
            r += j;
        }
        //if (r < 1) return;
        var $s = $('<span>').addClass('scont');
        $('<span>').text(r).appendTo($s);
        var $st = $('<span>').text('\u2605').addClass('star');
        $st.css('color', STARCOLOR[Math.floor(r / NUMCLASSES)] || 'lime');
        $st.appendTo($s);

        //  exalt account level
        if ( d.Account.AccountLvl )
            $('<span class="acctlvl">').text('Lv ' + d.Account.AccountLvl)
                .attr('title', 'Account Level ' + d.Account.AccountLvl + '\nAccount XP: ' + (+d.Account.ALXPCurrent || 0).toLocaleString())
                .appendTo($s);

        //  testing server indicator
        if (
            setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true &&
            typeof setuptools.data.accounts.accounts[guid] === 'object' &&
            setuptools.data.accounts.accounts[guid].testing === true
        ) $('<span>').text('T').css({margin: '0 0 0 0.2em'}).appendTo($s);

        $s.appendTo($t);
        setuptools.app.ga('send', 'event', {
            eventCategory: 'stars',
            eventAction: r
        });
    }

    function addreloader(mule, target) {
        var button = $('<div class="button reloader">');
        button.text('\u21bb');
        if (mule.data) {
            var updated = new Date(mule.data.query.created);
            button.attr('title', 'last updated: ' + updated.toLocaleString())
        }
        button.on('click.muledump.reloader', function(){
            setuptools.app.mulequeue.task.start(mule.guid);
        });
        button.appendTo(target);
    }

    function addmainbutton(mule, target) {

        //  reload button
        addreloader(mule, target);

        //  one-click login
        if ( mule.guid.match(setuptools.config.regex.guid) === null ) {

            var l = $('<a>').addClass('button ocl');
            l.text('\u21d7');
            l.attr('title', 'Open Account');
            if ( setuptools.data.config.mulelogin !== 1 ) {
                l.attr('href', '#');
                l.css({display: 'none'});
            } else {

                if ( setuptools.data.config.muleloginCopyLinks === 0 ) {
                    l.attr('href', '#');
                } else {
                    l.attr('href', setuptools.app.muledump.ocl.mulelink(mule.guid));
                }

            }

            l.appendTo(target);

            l.on('click.mulelogin', function(e) {

                if ( setuptools.data.config.muleloginCopyLinks === 0 ) {

                    $(this).attr('href', setuptools.app.muledump.ocl.mulelink(mule.guid));
                    setTimeout(function (self) {
                        $(self).attr('href', '#');
                    }, setuptools.config.muleloginCopyLinksTtl, this);

                }

                setuptools.app.muledump.ocl.record(mule.guid);

            })

        }

    }

    function addmulemenu(mule) {

        var menu = $('<div class="button muleMenu noselect" title="Mule Menu">');
        menu.html('&#8801;');
        menu.off('click.muledump.mulemenu').on('click.muledump.mulemenu', function (e) {
            setuptools.app.muledump.mulemenu(e, mule.guid, menu, menu, {
                option: 'pos',
                vpx: 26
            });
        });
        if ( setuptools.data.config.muleMenu === false ) menu.css({visibility: 'hidden', width: 0, height: 0});
        menu.appendTo(mule.dom);

        $('div.mule > div.name').off('contextmenu.muledump.mulemenu').on('contextmenu.muledump.mulemenu', function(e) {
            setuptools.app.muledump.mulemenu(e, mule.guid, menu);
        });

        mule.dom.off('contextmenu.muledump.mulemenu').on('contextmenu.muledump.mulemenu', function(e) {
            if (
                ( $(e.target)[0].localName === 'img' && $(e.target)[0].className === 'portrait' ) ||
                ( $(e.target)[0].localName === 'a' && $(e.target)[0].className === 'button ocl' )
            ) return;
            setuptools.app.muledump.mulemenu(e, mule.guid, menu);
        });

    }

    function arrangevaults(v, layout) {

        //  this doesn't seem necessary presently
        //while(VAULTORDER.length < v.length){
        //	var a = VAULTORDER[0] + 2;
        //	VAULTORDER.splice(0, 0, a+5, a+3, a+1, a, a+2, a+4, a+6);
        //}
        if ( !setuptools.data.muledump.vaultbuilder.layouts[layout] ) layout = 0;
        var vaultwidth = setuptools.data.muledump.vaultbuilder.layouts[layout].vaultwidth;
        var VAULTORDER = setuptools.data.muledump.vaultbuilder.layouts[layout].vaultorder;
        var r = [], i, j;
        for (i = 0; i < VAULTORDER.length; i++) {
            if (i % vaultwidth === 0 && r.length) {
                for (j = 0; j < r.length; j++) if (r[j]) break;
                if (j >= r.length) r = [];
            }
            var c = v[VAULTORDER[i] - 1];
            if (typeof c !== 'undefined') r.push(c); else r.push((VAULTORDER[i] === 0) ? 0 : (setuptools.data.muledump.vaultbuilder.layouts[layout].vaultshowempty === true ?
                    '-1' : (
                        (setuptools.data.muledump.vaultbuilder.layouts[layout].vaultcompressed === false) ? '-1' : 0
                    )
            ));
        }

        var w = vaultwidth;
        for (i = (vaultwidth-1); i >= 0; i--) {
            for (j = i; j < r.length; j+=w) if (r[j]) break;
            if (j < r.length) continue;
            w--;
            for (j = i; j < r.length; j+=w) r.splice(j, 1);
        }
        if (vaultwidth < w) return [0, v];

        //  chests the layout has no position for (exalt vaults exceed the 140 slot layouts) go below it
        var placed = {};
        for (i = 0; i < VAULTORDER.length; i++) placed[VAULTORDER[i]] = true;
        var extra = [];
        for (i = 0; i < v.length; i++) if ( !placed[i + 1] && typeof v[i] !== 'undefined' ) extra.push(v[i]);
        if ( extra.length > 0 ) {
            w = w || vaultwidth;
            while ( r.length % w ) r.push(0);
            r = r.concat(extra);
            while ( r.length % w ) r.push(0);
        }
        return [w, r];

    }

    //  xml to json
    function xmlToJson(xml) {

        // Create the return object
        var obj = {};

        //  element
        if (xml.nodeType === 1) {


            //  attributes are treated as keys
            if (xml.attributes.length > 0) {
                for (var j = 0; j < xml.attributes.length; j++) {
                    var attribute = xml.attributes.item(j);
                    obj[attribute.nodeName] = attribute.nodeValue;
                }
            }

            //  text
        } else if (xml.nodeType === 3) {
            obj = xml.nodeValue;
        }

        // do children
        if (xml.hasChildNodes()) {
            for(var i = 0; i < xml.childNodes.length; i++) {
                var item = xml.childNodes.item(i);
                var nodeName = item.nodeName;
                if (typeof(obj[nodeName]) === "undefined") {
                    obj[nodeName] = xmlToJson(item);
                    if ( nodeName === '#text' ) obj = obj[nodeName];
                } else {
                    if (typeof(obj[nodeName].push) === "undefined") {
                        var old = obj[nodeName];
                        obj[nodeName] = [];
                        obj[nodeName].push(old);
                    }
                    obj[nodeName].push(xmlToJson(item));
                    if ( nodeName === '#text' ) obj = obj[nodeName];
                }
            }
        }

        return obj;
    }

// Mule object

    var Mule = function(guid) {

        if (!guid || !(guid in window.accounts)) return;
        var self = this;
        this.guid = guid;
        this.fails = 0;
        this.loaded = false;
        this.fresh = false;
        this.customSorting = false;
        this.shrunk = false;
        this.dom = $('<div class="mule">');
        if ( setuptools.app.muledump.totals.config.getKey('accountFilter').indexOf(this.guid) > -1 ) this.dom.addClass('filteringEnabled');
        this.dom.appendTo($('#stage')).hide();

        //  make sure no secondary account data caches are kept if the main data cache is missing
        if ( !localStorage[this.cache_id()] ) setuptools.app.muledump.cleanupDataForGuid(this.guid);

        //  prepare totals counter and import cache
        this.totals = new Muledump_TotalsCounter(this.guid, true, function(self) {

            //  we will skip importing if account filter is active and we're not on it
            if (
                setuptools.app.muledump.totals.config.getKey('accountFilter').length === 0 ||
                (typeof self === 'object' && typeof self.guid === 'string' && setuptools.app.muledump.totals.config.getKey('accountFilter').indexOf(self.guid) > -1)
            ) setuptools.tmp.globalTotalsCounter.import(self);

        });

        if ( Array.isArray(setuptools.data.options.disabled) === true && setuptools.data.options.disabled.indexOf(this.guid) > -1 ) {
            this.disabled = true;
            self.dom.toggleClass('disabled', this.disabled);
        }

        //  ctrl+click to disable/enable a mule
        this.dom.on('click.muledump.disableMule', ':not(.item)', function(e) {
            if (setuptools.app.muledump.keys('ctrl', e) === true && setuptools.app.muledump.keys('shift', e) === false) {
                self.disabled = !self.disabled;
                self.dom.toggleClass('disabled', self.disabled);
                if ( self.disabled === true && setuptools.app.muledump.totals.config.getKey('disabled').indexOf(self.guid) === -1 ) setuptools.app.muledump.totals.config.getKey('disabled').push(self.guid);
                if ( self.disabled === false && setuptools.app.muledump.totals.config.getKey('disabled').indexOf(self.guid) > -1 ) setuptools.app.muledump.totals.config.getKey('disabled').splice(setuptools.app.muledump.totals.config.getKey('disabled').indexOf(self.guid), 1);
                setuptools.app.muledump.totals.config.setKey('disabled', setuptools.app.muledump.totals.config.getKey('disabled'));
                setuptools.tmp.globalTotalsCounter.import(self.guid, self.disabled);
                setuptools.app.muledump.totals.updateSecondaryFilter();
                if ( setuptools.app.muledump.totals.config.getKey('sortingMode') === 'items' ) window.init_totals();
                window.update_totals();
                window.update_filter();
                option_updated('totals');
                return;
            }
        });

        //  adjust account filter on shift+click of the mule
        this.dom.on('click.muledump.mule', function(e) {

            if ( setuptools.app.muledump.keys('shift', e) === false || setuptools.app.muledump.keys('ctrl', e) === true ) return;

            //  add account to account filter
            if ( setuptools.app.muledump.totals.config.getKey('accountFilter').indexOf(self.guid) === -1 ) {

                self.dom.addClass('filteringEnabled');
                setuptools.app.muledump.totals.config.getKey('accountFilter').push(self.guid);
                setuptools.app.muledump.totals.config.setKey('accountFilter', setuptools.app.muledump.totals.config.getKey('accountFilter'));

                if ( setuptools.tmp.updateFilterTimer1 ) clearTimeout(setuptools.tmp.updateFilterTimer1);
                setuptools.tmp.updateFilterTimer1 = setTimeout(function() {
                    setuptools.tmp.globalTotalsCounter.import(self.guid);
                    setuptools.app.muledump.totals.updateSecondaryFilter();
                    if ( setuptools.app.muledump.totals.config.getKey('sortingMode') === 'items' ) window.init_totals();
                    window.update_totals();
                    window.update_filter();
                    option_updated('totals');
                }, 1000);

            }
            //  remove account from account filter
            else {

                function updateFilter() {

                    setuptools.tmp.globalTotalsCounter.import();
                    setuptools.app.muledump.totals.updateSecondaryFilter();
                    if ( setuptools.app.muledump.totals.config.getKey('sortingMode') === 'items' ) window.init_totals();
                    window.update_totals();
                    window.update_filter();
                    option_updated('totals');

                }

                self.dom.removeClass('filteringEnabled');
                setuptools.app.muledump.totals.config.getKey('accountFilter').splice(setuptools.app.muledump.totals.config.getKey('accountFilter').indexOf(self.guid), 1);
                setuptools.app.muledump.totals.config.setKey('accountFilter', setuptools.app.muledump.totals.config.getKey('accountFilter'));
                if ( setuptools.tmp.updateFilterTimer2 ) clearTimeout(setuptools.tmp.updateFilterTimer2);
                setuptools.tmp.updateFilterTimer2 = setTimeout(updateFilter, 1000);

            }

        });
    };

    Mule.prototype.opt = function(name) {
        var o = options[this.guid];
        if (o && name in o) {
            return o[name];
        }
        return options[name];
    };

    Mule.prototype.cache_id = function() {
        return 'muledump:' + this.guid
    };

    //
    Mule.prototype.log = function(s, cl) {
    };

    Mule.prototype.error = function(s, callback, options) {

        if ( typeof options !== 'object' ) options = {};

        //  don't show if errors are turned off
        if ( setuptools.data.config.errors === false ) return;

        //  build the message
        var self = this;

        //  if this account isn't set to loginOnly and there's no scrollHeight/width, then the dom isn't rendered
        //  in this situation we will forward the error to a lightbox
        if ( this.canParse !== true ) {
            setuptools.app.assistants.muledumperror(this.guid, s);
            return;
        }

        if ( this.errorBar instanceof jQuery ) {

            this.errorBar.html(' \
                <div class="flex-container">\
                    <div style="margin-right: 5px;">' + s + '</div> \
                    <div class="setuptools link errorAck menuStyle ack mr0 ml5" title="Dismiss" style="width: auto; height: auto; opacity: 1; border: 0; box-shadow: 0 0 0px 2px #000000;">Dismiss</div>\
                </div>\
            ');
            if ( setuptools.tmp.masonry ) setuptools.tmp.masonry.layout();

        }

        //  bind the acknowledgement button
        $('div.mule[data-guid="' + this.guid + '"] div.setuptools.link.errorAck').on('click.muledump.errorAck', function () {

            //  remove the bar
            if ( setuptools.data.config.animations === 1 ) {

                //  custom callback on click
                if ( typeof callback === 'function' ) callback();

                if ( options.action === 'removeall' ) {

                    self.dom.fadeOut(600, function() {
                        self.dom.remove();
                    });

                } else $(this).fadeOut(600, function () {
                    this.remove();
                });

                self.errorBar.slideUp(700, function () {
                    self.errorBar.show().text('');
                    if ( setuptools.tmp.masonry ) setuptools.tmp.masonry.layout();
                });

            } else {

                this.remove();
                self.errorBar.text('');
                if ( setuptools.tmp.masonry ) setuptools.tmp.masonry.layout();

            }

        });

    };

    //  complete a MuleQueue task
    Mule.prototype.queueFinish = function(guid, status, cache_only, errorMessage) {

        //  return a promise
        if ( typeof this.MuleQueue === 'function' ) {

            this.MuleQueue({
                state: 'finished',
                guid: guid,
                status: status,
                cache_only: cache_only,
                errorMessage: errorMessage
            });

        }

        if ( this.deleteAccount === true ) setuptools.app.config.userDelete(guid);

    };

    Mule.prototype.createCounter = function(cache, callback) {

        if ( typeof cache !== 'boolean' ) cache = false;
        if ( typeof callback !== 'function' && callback !== false ) callback = function(self) {

            if (
                setuptools.app.muledump.totals.config.getKey('accountFilter').length === 0 ||
                setuptools.app.muledump.totals.config.getKey('accountFilter').indexOf(self.guid) > -1
            ) {
                setuptools.tmp.globalTotalsCounter.import(self);
            }

        };
        setuptools.app.muledump.cleanupSecondaryCache(this.guid);
        this.totals = new Muledump_TotalsCounter(this.guid, cache, callback);

    };

    Mule.prototype.query = function(ignore_cache, cache_only, freshness, MuleQueue) {
        if ( !cache_only ) cache_only = false;
        if ( !freshness ) freshness = false;
        if ( setuptools.state.loaded === true && setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true && setuptools.data.accounts.accounts[this.guid].cacheEnabled === false ) {
            ignore_cache = true;
        }
        var self = this;
        if ( typeof MuleQueue === 'function' ) this.MuleQueue = MuleQueue;
        $('#accopts').hide().data('guid', '');

        // read from cache if possible
        if (!ignore_cache || ignore_cache === false ) {
            var c = '';
            try {
                c = setuptools.storage.read(this.cache_id(), true);
                c = JSON.parse(c);
            } catch(e) {}
            if (c) {

                //  users can specify a maximum age of cache data before reloading automatically
                var cacheStale = false;

                //  caches written before exalt unique item / exaltation support lack that data; refresh them once
                var cachedAccount = ( c.query && c.query.results && c.query.results.Chars ) ? c.query.results.Chars.Account : undefined;
                var cachePredatesExalt = (
                    typeof cachedAccount === 'object' && cachedAccount !== null &&
                    ( typeof cachedAccount.UniqueItemMap !== 'object' || typeof cachedAccount.ExaltMap !== 'object' )
                );
                if ( cachePredatesExalt && cache_only !== true ) {
                    cacheStale = true;
                    window.techlog('MuleQueue/StaleCache ' + this.guid + ' predates enchantment support', 'string');
                }
                if (
                    (cache_only !== true || freshness === true) &&
                    setuptools.state.loaded === true &&
                    setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true &&
                    setuptools.data.config.autoReloadDays > 0 &&
                    setuptools.data.accounts.accounts[this.guid].autoReload === true
                ) {

                    //  let's convert the cache date to utc midnight of the same day
                    var date = new Date(c.query.created);
                    var utcCacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
                    var cacheDate = utcCacheDate.getTime();
                    var currentDate = Date.now()-setuptools.tmp.timeOffset;
                    var cacheAge = Math.floor(((currentDate-cacheDate)/1000)/86400);
                    //setuptools.app.techlog('MuleQueue/CacheInfo age for ' + this.guid + ' is ' + ((currentDate-cacheDate)/1000).toFixed(0));
                    if ( cacheAge >= setuptools.data.config.autoReloadDays ) {

                        cacheStale = true;
                        window.techlog('MuleQueue/StaleCache found for ' + this.guid, 'string');
                        setuptools.app.ga('send', 'event', {
                            eventCategory: 'detect',
                            eventAction: 'staleCache'
                        });

                    }

                }

                //  users can disable cache data for specific accounts
                if (
                    setuptools.state.loaded === false ||
                    setuptools.app.config.validateFormat(setuptools.data.accounts, 0) === true ||
                    (setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true && setuptools.data.accounts.accounts[this.guid].cacheEnabled === true )
                ) {

                    //  parse the cache data as-is while we sort out what else to do
                    this.parse(c, true);

                    //  page loads are cache_only; an old cache would never be refreshed, so queue one reload
                    if ( cachePredatesExalt && cache_only === true && this.exaltRefreshQueued !== true ) {
                        this.exaltRefreshQueued = true;
                        var staleGuid = this.guid;
                        window.techlog('MuleQueue/StaleCache ' + staleGuid + ' predates enchantment support, queuing reload', 'string');
                        setTimeout(function() {
                            if ( setuptools.state.loaded === true && setuptools.app.mulequeue && setuptools.app.mulequeue.task && typeof setuptools.app.mulequeue.task.reload === 'function' ) {
                                setuptools.app.mulequeue.task.reload([staleGuid]);
                            } else {
                                window.mules[staleGuid].query(true);
                            }
                        }, 0);
                    }

                    //  now we will enforce cache freshness
                    if ( cacheStale === false ) {

                        this.fresh = true;
                        if (cache_only === false) this.queueFinish(this.guid, 'cache');
                        return;

                    }

                }

            }

        }

        if ( cache_only === true ) return;

        var CR = { guid: this.guid };
        var pass = window.accounts[this.guid] || '';

        //  don't accept blank passwords
        if ( pass === '' ) {
            this.error("Password is empty");
            this.queueFinish(this.guid, 'error', false, 'Password is empty');
            return;
        }

        var platform = this.guid.split(':')[0];
        if (['kongregate', 'steamworks', 'kabam'].indexOf(platform) >= 0) {
            CR.secret = pass
        } else {
            CR.password = pass
        }

        var realmApiURL = setuptools.config.appspotProd;
        if (
            setuptools.state.loaded === true &&
            setuptools.data.accounts.accounts[this.guid].testing === true
        ) realmApiURL = setuptools.config.appspotTesting;

        //  deca now requires account/verify to obtain an access token before char/list
        var clientToken;
        try {
            clientToken = localStorage['muledump:clienttoken'];
            if ( !clientToken ) {
                clientToken = (Date.now().toString(16) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).slice(0, 32);
                localStorage['muledump:clienttoken'] = clientToken;
            }
        } catch(e) {
            clientToken = (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 32);
        }

        var unityParams = {game_net: 'Unity', play_platform: 'Unity', game_net_user_id: ''};
        var verifyParams = $.extend({}, CR, unityParams, {clientToken: clientToken});

        setuptools.app.uaTiming('mule', 'realmAPICharListGet', 'start', this.guid);
        window.realmAPI(
            'account/verify',
            verifyParams,
            {url: realmApiURL},
            function(xhr) {
                xhr.done(function(xml, textStatus, request) {

                    var token = (typeof xml === 'string') ? xml.match(/<AccessToken>(.*?)<\/AccessToken>/) : null;

                    //  pass errors (invalid credentials, rate limits, etc) through to the normal handler
                    if ( !token ) {
                        onResponse(xml, textStatus, request);
                        return;
                    }

                    window.realmAPI(
                        'char/list',
                        $.extend({}, unityParams, {do_login: true, accessToken: token[1]}),
                        {url: realmApiURL},
                        function(xhr2) {
                            xhr2.done(onResponse).fail(onFail)
                        }
                    );

                }).fail(onFail)
            }
        );

        function onFail(xhr) {

            setuptools.app.uaTiming('mule', 'realmAPICharListGet', 'cancel', self.guid);
            self.busy = false;
            self.fails++;
            setuptools.tmp.corsAttempts++;
            if ( self.fails < setuptools.config.muledump.corsMaxAttempts) {

                setTimeout(function() { self.query(true); }, 1000);

            } else {

                //  cors error have status code 0
                if ( xhr.status === 0 ) {

                    self.queueFinish(self.guid, 'error', false, 'Could not connect to Appspot (CORS error?)');
                    self.error('There was a problem connecting to ROTMG servers. <a href="#" class="setuptools link cors">Click here</a> for help.');
                    $('.setuptools.link.cors').off('click.setuptools.corsAssistant').on('click.setuptools.corsAssistant', function () {
                        setuptools.app.assistants.cors(true);
                    });

                    //  help the user with potential cors issues (maybe network, or otherwise) on first occurrence
                    setuptools.app.assistants.cors();

                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'corsError'
                    });

                    return;

                }

                if ( xhr.status > 0 ) {

                    self.queueFinish(self.guid, 'error', false, 'Could not connect to Appspot due to HTTP Error ' + xhr.status);
                    self.error('HTTP Error ' + xhr.status + ' was returned. <a href="' + setuptools.config.httpErrorHelp + '" target="_blank">Click here</a> for help.');
                    setuptools.app.assistants.xhrError(xhr);
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'realmApiHttpError',
                        eventLabel: xhr.status.toString()
                    });

                }

            }

        }

        function onResponse(xml, textStatus, request) {

            setuptools.app.uaTiming('mule', 'realmAPICharListGet', 'stop', self.guid);

            //  check for the x-jakcodex-cors response header
            if ( setuptools.state.extension === undefined ) {

                if ( !request.getResponseHeader('X-Jakcodex-CORS') ) {

                    setuptools.state.extension = false;
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'nonJakcodexCORS'
                    });
                    if (['opera', 'firefox'].indexOf(setuptools.browser) > -1) setuptools.app.muledump.notices.add('New CORS Extension Available', setuptools.app.assistants.jakcodexcors);

                } else {

                    setuptools.state.extension = true;
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'isJakcodexCORS',
                        eventLabel: request.getResponseHeader('X-Jakcodex-CORS')
                    });

                }

            }

            self.busy = false;
            parser = new DOMParser();
            date = new Date(Date.now()-( (typeof setuptools.tmp.timeOffset === 'number') ? setuptools.tmp.timeOffset : 0 ));
            window.techlog("Response from api: " + xml, "api");

            //  check for an error response
            if ( error = xml.match(/^<Error\/?>(.*?)<\/?Error>$/) ) {

                var errOpts = {};
                if ( error[1] === 'Account credentials not valid' ) {

                    //  disabled invalid accounts
                    if ( [0,4].indexOf(setuptools.data.config.badaccounts) > -1 ) {
                        errOpts.action = 'removeall';
                        setuptools.app.config.userToggle(self.guid);
                    }

                    //  delete invalid accounts
                    if ( [2,5].indexOf(setuptools.data.config.badaccounts) > -1 ) {
                        errOpts.action = 'removeall';
                        self.deleteAccount = true;
                    }

                    self.queueFinish(self.guid, 'error', false, error[1]);
                    self.error(error[1], undefined, errOpts);
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'invalidCredentials'
                    });

                } else if ( error[1] === 'Internal error, please wait 5 minutes to try again!' ) {

                    self.log("Your IP is being rate limited by Deca. Waiting 5 minutes to retry.");
                    self.queueFinish(self.guid, 'rateLimited', 'Request was rate limited by Appspot');

                    //  we'll not send any xhr requests for 5 minutes
                    window.RateLimitExpiration = Date.now()+300000;

                    try {
                        localStorage['muledump:ratelimitexpiration'] = window.RateLimitExpiration
                    } catch(e) {}

                } else if ( error[1] === 'Account is under maintenance' ) {

                    if ( setuptools.state.loaded === true && setuptools.data.accounts.accounts[self.guid].banned === false ) {
                        setuptools.data.accounts.accounts[self.guid].banned = true;
                        setuptools.app.config.save('Banned, boo!', true);
                    }

                    //  disabled banned accounts
                    if ( [1,4].indexOf(setuptools.data.config.badaccounts) > -1 ) setuptools.app.config.userToggle(self.guid);

                    //  delete invalid accounts
                    if ( [3,5].indexOf(setuptools.data.config.badaccounts) > -1 ) self.deleteAccount = true;

                    self.queueFinish(self.guid, 'error', false, error[1]);
                    self.error("This account is banned - RIP");
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'accountBanned'
                    });

                } else if ( error[1].match(/^Account in use/) ) {

                    self.queueFinish(self.guid, 'error', false, error[1]);
                    var regex = error[1].match(/\(([0-9]*) seconds/);
                    var endTime;
                    if ( regex ) endTime = new Date(Date.now()+(Number(regex[1])*1000)).timeString(false);
                    self.error("Account in use - " + ( (endTime) ? 'please try again or wait until " + endTime' : 'Please logout of the account in-game and try again' ));
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'accountInUse'
                    });

                } else {

                    self.queueFinish(self.guid, 'error', false, error[1]);
                    self.error(error[1]);
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'detect',
                        eventAction: 'genericServerError'
                    });

                }

                //  no errors, this is a good start
            } else {

                self.queueFinish(self.guid, 'ok');
                if ( setuptools.state.loaded === true && setuptools.data.accounts.accounts[self.guid].banned === true ) {
                    setuptools.data.accounts.accounts[self.guid].banned = false;
                    setuptools.app.config.save('Unbanned, hooray!');
                }
                if ( this.loginOnly === false ) self.errorBar.empty();

                //  let's simulate a YQL response
                setuptools.app.uaTiming('mule', 'xmlToJson', 'start', self.guid, false, setuptools.app.uaTimingAggregate);
                var xmlParse = parser.parseFromString(xml, "text/xml");
                //console.log(xmlParse);
                var JSONData = xmlToJson(xmlParse);
                setuptools.app.uaTiming('mule', 'xmlToJson', 'stop', self.guid);

                //  exalt unique items: keep uid -> enchantment data (stored on the account so it survives caching)
                if ( JSONData.Chars && typeof JSONData.Chars.Account === 'object' )
                    JSONData.Chars.Account.UniqueItemMap = window.MuledumpUnique.collect(xmlParse);
                if ( JSONData.Chars && typeof JSONData.Chars.Account === 'object' )
                    JSONData.Chars.Account.ExaltMap = window.MuledumpExalts.collect(xmlParse);
                JSONData.other = {
                    maxCharNum: xmlParse.querySelectorAll('[maxNumChars]')[0].attributes['maxNumChars'].value,
                    nextCharId: xmlParse.querySelectorAll('[nextCharId]')[0].attributes['nextCharId'].value
                };

                data = {
                    query: {
                        created: date.toISOString(),
                        updated: date.toISOString(),
                        results: JSONData
                    },
                    meta: {
                        token: setuptools.config.actoken,
                        version: $.extend(true, {}, setuptools.version)
                    }
                };

                var res = data.query.results;
                window.techlog("Response data for " + self.guid, 'api');
                window.techlog(JSON.stringify(data, null, 5), 'api');

                if (res.Error) {
                    self.error("server error");
                    window.techlog('Server error processing ' + self.guid + ': ' + JSON.stringify(data, null, 5), 'verbose');
                    return;
                }

                function watchProgress(percent) {
                    if (typeof percent !== 'string') {
                        self.error('migration failed');
                        return
                    }
                    if (percent === '100') {
                        self.reload();
                        return
                    }
                    self.log('migration: ' + percent + '%');
                    window.realmAPI('migrate/progress', CR, function (xhr) {
                        xhr.fail(onFail).done(function (data) {
                            date = new Date();
                            data = {
                                query: {
                                    created: date.toISOString(),
                                    updated: date.toISOString(),
                                    results: xmlToJson(parser.parseFromString(data, "text/xml"))
                                }
                            };
                            var res = data && data.query && data.query.results;
                            var per = res.Progress && res.Progress.Percent;
                            watchProgress(per);
                        })
                    })
                }

                if (res.Migrate) {
                    self.log('attempting migration');

                    window.realmAPI('migrate/doMigration', CR, {url: true, type: 'migration'}, function () {
                        watchProgress('0')
                    });
                    return
                }

                if ( !res.Chars ) return;

                res = res.Chars;

                if ('TOSPopup' in res) {
                    window.realmAPI('account/acceptTOS', CR, {url: true, type: 'tos'})
                }

                if (res.Account && res.Account.IsAgeVerified !== "1") {
                    CR.isAgeVerified = 1;
                    window.realmAPI('account/verifyage', CR, {url: true, type: 'ageVerify'})
                }

                //  reinitialize totals counting for this mule before parsing
                self.createCounter();

                self.parse(data, false);
            }
        }
    };

    Mule.prototype.reload = function() {

        this.fails = 0;
        if (this.overlay) this.overlay.find('.log').empty();
        if (window.RateLimitExpiration >= Date.now()) {
            this.query(false, true);
        } else {
            this.query(true);
        }

    };


    var PROPTAGS = 'ObjectType Level Exp CurrentFame'.split(' ');
    var STATTAGS = 'MaxHitPoints MaxMagicPoints Attack Defense Speed Dexterity HpRegen MpRegen'.split(' ');
    var STATABBR = 'HP MP ATT DEF SPD DEX VIT WIS'.split(' ');
    Mule.prototype.parse = function(data, skipCacheWrite) {

        this.canParse = true;
        if ( !skipCacheWrite ) skipCacheWrite = false;

        //  calculate some account statistics
        function calculateStatTotals(data, guid) {

            var ign = '';
            var char = [];

            result = {
                TotalFame: 0,
                TotalExp: 0,
                TotalDeathFame: 0,
                TotalDeathExp: 0,
                TotalGifts: 0,
                TotalChars: 0,
                TotalActive: 0,
                TotalChests: 1,
                CacheAge: 0,
                ign: ( typeof data.Account === 'object' ) ? data.Account.Name : ''
            };

            //  determine cache age
            var date = new Date(q.created);
            var cacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
            result.CacheAge = Math.floor(((Date.now()-cacheDate.getTime())/1000)/86400);

            //  count chests
            var chests = d.Account.Vault ? d.Account.Vault.Chest || ['-1'] : ['-1'];
            if ( Array.isArray(chests) ) {
                result.TotalChests = chests.length;
            } else if ( typeof chests === 'object' || typeof chests === 'string' ) {
                result.TotalChests = 1;
            }

            //  single character account
            if (
                typeof data.Char === 'object' &&
                typeof data.Char.Account === 'object' &&
                typeof data.Char.Account.Name === 'string'
            ) {

                char.push(data.Char);

            }
            //  multiple character account
            else if (
                typeof data.Char === 'object' &&
                data.Char.length > 0
            ) {

                char = data.Char;

            }

            //  add up the numbers
            for ( x = 0; x < char.length; x++ ) {
                var stats = readstats(char[x].PCStats); //id 20
                result.TotalActive += Number(stats[20]);
            }

            //  let's reduce this as much as possible
            var TimeActive = result.TotalActive/60;
            var ActiveSuffix = ' hours';
            TimeActive = Math.floor(TimeActive);
            result.TotalActive = TimeActive + ActiveSuffix;

            //  calculate gift stats
            if ( typeof data.Account.Gifts === 'string' ) result.TotalGifts = data.Account.Gifts.split(',').length;

            //  calculate fame and exp stats
            if ( typeof data.Char !== 'undefined' ) {

                //  if the user has multiple characters this will be an array
                if (data.Char.length) {

                    result.TotalChars = data.Char.length;
                    for ( var i = 0; i < data.Char.length; i++ ) {

                        result.TotalFame = Number(result.TotalFame) + Number(data.Char[i].CurrentFame);
                        result.TotalExp = Number(result.TotalExp) + Number(data.Char[i].Exp);
                        result.TotalDeathFame += data.Char[i].muledump.TotalFame || 0;

                    }

                    //  otherwise it is an object
                } else {

                    result.TotalChars = Number(1);
                    result.TotalFame = Number(result.TotalFame) + Number(data.Char.CurrentFame);
                    result.TotalExp = Number(result.TotalExp) + Number(data.Char.Exp);
                    result.TotalDeathFame += data.Char.muledump.TotalFame || 0;

                }

            }

            //  format last gold purchase date
            result.LastGoldPurchase = "N/A";
            if ( typeof data.SalesForce.last_purchase_date === 'string' ) result.LastGoldPurchase = data.SalesForce.last_purchase_date;
            if ( result.LastGoldPurchase.indexOf(':') > -1 ) result.LastGoldPurchase = result.LastGoldPurchase.substr(0, result.LastGoldPurchase.length-3);

            return result;

        }

        if (this.overlay) this.overlay.hide();

        if ( setuptools.state.loaded === true ) ROW = setuptools.data.config.rowlength;

        function parseQueryString(queryString) {
            var query = {};
            var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split('=');
                query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            }
            return query;
        }

        //  start parse timer
        setuptools.app.uaTiming('mule', 'parse', 'start', this.guid, false, setuptools.app.uaTimingAggregate);

        //  shortcut
        var self = this;
        var d = data.query.results.Chars;
        var q = data.query;

        //  store the updated server list if it is present
        if ( typeof d.Servers === 'object' && typeof d.Servers.Server === 'object' && typeof d.Servers.Server.push === 'function' )
            setuptools.storage.write('ServerList', JSON.stringify(d.Servers.Server, true, 5));

        //  we only need the following information
        //  use this to see full xml contents
        //  console.log(parser.parseFromString(xml, "text/xml"));
        if ( !d.OwnedSkins && d.Account && typeof d.Account.OwnedSkins === 'string' ) d.OwnedSkins = d.Account.OwnedSkins;   // moved under Account in exalt
        if ( !d.OwnedSkins ) d.OwnedSkins = [];
        if ( !d.SalesForce ) d.SalesForce = {lifetime_spend: "0"};
        d = {
            Char: d.Char,
            Account: d.Account || {},
            OwnedSkins: ( typeof d.OwnedSkins === 'object' && typeof d.OwnedSkins.push === 'function' ) ? d.OwnedSkins : (
                ( typeof d.OwnedSkins === 'object' ) ? [] : d.OwnedSkins.split(',')
            ),
            SalesForce: ( typeof d.SalesForce === 'object' ) ? d.SalesForce : (
                ( d.SalesForce === "undefined" ) ? {} : parseQueryString(atob(d.SalesForce))
            )
        };

        //  reset the cache object for storage
        data.query.results.Chars = d;
        window.MuledumpUnique.register(d.Account.UniqueItemMap);

        this.data = data;
        this.dom.hide().empty();
        this.overlay = null;

        //  moved up here because we're modifying the structure to add sort keys and such

        var carr = [];
        if (d.Char) { // stupid array/object detection
            if (!d.Char.length) carr = [d.Char]; else carr = d.Char;
        }

        //  add keys for sorting
        for ( var i in carr ) {

            if (carr.hasOwnProperty(i)) {

                if (typeof carr[i].muledump === 'undefined') carr[i].muledump = {};

                //  add ClassName
                carr[i].muledump.ClassName = ( typeof carr[i].ObjectType && Array.isArray(classes[carr[i].ObjectType]) === true ) ? classes[carr[i].ObjectType][0] : '????';

                //  record FirstSeen
                setuptools.app.muledump.charSeen(self.guid, carr[i].id);

                //  add TotalFame
                carr[i].muledump.TotalFame = window.calcfame(carr[i], d).total;

                //  add ?/8
                carr[i].muledump.MaxedStats = 0;
                for (var t = 0; t < STATTAGS.length; t++) {
                    var s = carr[i][STATTAGS[t]] || 0;
                    var carrcl = classes[carr[i].ObjectType];
                    if(parseInt(s) >= carrcl[3][t]){
                        carr[i].muledump.MaxedStats++;
                    }
                }

                //  add value
                //carr[i].muledump.CharValue = setuptools.app.muledump.value.char(this.guid, carr[i].id, true);

            }

        }

        // write cache (even with cacheEnabled===false we'll still write it; just won't use it on reload)
        if ( skipCacheWrite !== true ) {

            try {
                window.techlog('Muledump/DataCache writing to ' + this.cache_id());
                setuptools.app.uaTiming('mule', 'writeAccountDataCache', 'start', this.guid, false, setuptools.app.uaTimingAggregate);
                setuptools.storage.write(this.cache_id(), data, true);
                setuptools.app.uaTiming('mule', 'writeAccountDataCache', 'stop', this.guid);
            } catch (e) {

            }

        }

        //  add ign to the user account object
        if (
            setuptools.state.loaded === true &&
            setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true &&
            setuptools.app.config.userExists(this.guid) === true &&
            typeof d.Account === 'object' &&
            typeof d.Account.Name === 'string' &&
            d.Account.Name.length > 0
        ) setuptools.data.accounts.accounts[this.guid].ign = d.Account.Name;

        //  if this account is marked login-only then we are done
        this.loginOnly = false;
        if (
            setuptools.state.loaded === true &&
            setuptools.app.config.validateFormat(setuptools.data.accounts, 1) === true &&
            setuptools.data.accounts.accounts[this.guid].loginOnly === true
        ) this.loginOnly = true;

        var f = false;
        var arr = [];
        var CountingCharList = carr;

        if ( this.loginOnly === false ) {

            this.dom.attr('data-guid', this.guid);

            //  display guid
            if (this.opt('email')) {
                $('<input type="text" readonly="readonly">').addClass('guid').val(this.guid).appendTo(this.dom);
                $('<br>').appendTo(this.dom);
            }

            //  error bar
            this.errorBar = $('<div>').addClass('errorBar stickynotice').css({'font-size': '12px'});
            if (setuptools.data.config.animations < 1) this.errorBar.addClass('AReduced');
            this.errorBar.appendTo(this.dom);

            addmainbutton(this, this.dom);
            addmulemenu(this);

            //  check if email address is verified (but skip steamworks/kongregate/etc)
            if (!('VerifiedEmail' in d.Account) && !this.guid.match(/(?:\:)/)) {
                var $warn = $('<span class="button warn">').text('!!');
                $warn.attr('title', 'email not verified').appendTo(this.dom)
            }

            d.Account = d.Account || {};
            if ((this.opt('accountName') === false)) d.Account.Name = '&nbsp;';
            var $name = $('<div>').addClass('name').html(d.Account.Name || '(no name)');
            addstar(this.dom, d, this.guid);

            //  click name to access account options
            $name.on('click.muledump.muleAccountName', function (e) {
                if (e.target !== this) return;
                setuptools.lightbox.menu.context.close();
                if ( setuptools.app.muledump.keys('ctrl', e) === true || setuptools.app.muledump.keys('shift', e) === true ) return;
                var $ao = $('#accopts');
                $ao.css({
                    left: e.pageX - 5 + 'px',
                    top: e.pageY - 5 + 'px'
                });
                window.updaccopts(self.guid);
                $ao.css({
                    'display': 'block',
                    'visibility': 'visible'
                });
            });
            $name.appendTo(this.dom);

            if ( !this.opt('shrink') ) {

                //  display account info
                if (this.opt('accountinfo')) {
                    stats = calculateStatTotals(this.data.query.results.Chars, this.guid);
                    $('<div class="stats">\
                        <div class="flex-container"><div>Account Data Cache Age</div><div>' + stats.CacheAge + ' ' + ((stats.CacheAge === 1) ? 'day' : 'days') + '</div></div> \
                        <div class="flex-container"><div>Account Fame</div><div>' + this.data.query.results.Chars.Account.Stats.Fame + '</div></div> \
                        <div class="flex-container"><div>All Time Account Fame</div><div>' + this.data.query.results.Chars.Account.Stats.TotalFame + '</div></div> \
                        <div class="flex-container"><div>Account Gold</div><div>' + this.data.query.results.Chars.Account.Credits + '</div></div> \
                        ' + exaltAccountInfo(this.data.query.results.Chars.Account) + ' \
                        <div class="flex-container"><div>Gift Items</div><div>' + stats.TotalGifts + '</div></div> \
                        <div class="flex-container"><div>Last Gold Purchase</div><div>' + stats.LastGoldPurchase + '</div></div> \
                        <div class="flex-container"><div>Total Char Exp</div><div>' + stats.TotalExp + '</div></div> \
                        <div class="flex-container"><div>Total Char Fame</div><div>' + stats.TotalFame + '</div></div> \
                        <div class="flex-container"><div>Total Death Fame</div><div>' + stats.TotalDeathFame + '</div></div> \
                        <div class="flex-container"><div>Total Characters</div><div>' + stats.TotalChars + '</div></div> \
                        <div class="flex-container"><div>Total Character Slots</div><div>' + ((data.query.results.other) ? data.query.results.other.maxCharNum : 'N/A') + '</div></div> \
                        <div class="flex-container"><div>Total Lifetime Characters</div><div>' + ((data.query.results.other) ? (data.query.results.other.nextCharId - 1) : 'N/A') + '</div></div> \
                        <div class="flex-container"><div>Total Skins Unlocked</div><div>' + (this.data.query.results.Chars.OwnedSkins.length + Object.keys(classes).length) + ' of ' + Object.keys(skins).length + '</div></div>\
                        <div class="flex-container"><div>Total Time Active</div><div>' + stats.TotalActive + '</div></div> \
                        <!-- removed for now due to inaccurate data coming from deca -- <div class="flex-container"><div>Lifetime Gold Purchased</div><div>' + this.data.query.results.Chars.SalesForce.lifetime_spend + '</div></div>--> \
                        <div class="flex-container"><div>Total Unlocked Chests</div><div>' + stats.TotalChests + '</div></div> \
                </div>').appendTo(this.dom);
                }

                //  for future use - skins owned by percentage to append total skins unlocked
                //' / ' + ( ((this.data.query.results.Chars.OwnedSkins.length/Object.keys(skins).length)*100).toFixed(0) ) + '%</div></div> \

                //  check for gift chests bug
                var TotalGifts = 0;
                if (typeof d.Account.Gifts === 'string') TotalGifts = d.Account.Gifts.split(',').length;
                if (TotalGifts >= setuptools.config.giftsWarningThreshold) {

                    //  check if we should alert the user
                    if (
                        setuptools.app.config.determineFormat(setuptools.data.accounts) === 0 ||
                        setuptools.data.accounts.accounts[this.guid].giftsBugAck !== true
                    ) {

                        this.error('Warning: Account is nearing the <a href="' + setuptools.config.giftChestsBugHelp + '" class="rateLimited nopulse" target="_blank">gift chests bug</a>!', function () {

                            if (setuptools.app.config.determineFormat(setuptools.data.accounts) === 1) {

                                setuptools.data.accounts.accounts[self.guid].giftsBugAck = true;
                                setuptools.app.config.save('Gift Chests Bug Ack');

                            }

                        });

                    }

                }
                //  reset the acknowledgement if the issue isn't detected
                else if (
                    setuptools.state.loaded === true &&
                    setuptools.app.config.determineFormat(setuptools.data.accounts) === 1 &&
                    setuptools.data.accounts.accounts[self.guid].giftsBugAck === true
                ) setuptools.data.accounts.accounts[self.guid].giftsBugAck = false;

            }

            //  sort the character list
            if (setuptools.data.config.debugging === true) setuptools.app.uaTiming('mule', 'parseCharacterSorting', 'start', this.guid, false, setuptools.app.uaTimingAggregate);

            //  if we had been customSorting we need to regenerate the totals
            if (this.customSorting === true && this.opt('chsort') !== '100') {

                this.createCounter();
                this.redoTotals = true;
                this.customSorting = false;

            }

            //  custom
            if (this.opt('chsort') === '100') {

                //  clean and read the active char sorting list
                if (skipCacheWrite !== true) setuptools.app.muledump.charsort.clean(this.guid);
                var CharList = setuptools.app.muledump.charsort.read(this.guid, true);
                if (Array.isArray(CharList) && CharList.length > 0) {

                    CharList = setuptools.app.muledump.charsort.disabled(this.guid, setuptools.app.muledump.charsort.read(this.guid), CharList);
                    this.createCounter();
                    this.redoTotals = true;
                    this.customSorting = true;

                    carr = CharList;
                    if (setuptools.data.options.totalsGlobal === false) CountingCharList = CharList;

                } else {

                    //  reset the active list
                    if (Array.isArray(CharList) && CharList.length === 0) setuptools.app.muledump.charsort.active(this.guid);

                    //  use default
                    carr.sort(function (a, b) {
                        return a.id - b.id
                    });

                }

                //  character value
            } else if (this.opt('chsort') === '7') {
                carr.sort(function (a, b) {
                    return b.muledump.CharValue - a.muledump.CharValue;
                });
                //  active time
            } else if (this.opt('chsort') === '6') {
                carr.sort(function (a, b) {
                    return b.muledump.MaxedStats - a.muledump.MaxedStats;
                })
            } else if (this.opt('chsort') === '5') {

                carr.sort(function (a, b) {

                    var statsA = readstats(a.PCStats);
                    var statsB = readstats(b.PCStats);
                    return Number(statsB[20]) - Number(statsA[20])

                });

                //  class, by fame
            } else if (this.opt('chsort') === '4') {

                //  sort alphabetically and by current fame
                carr.sort(function (a, b) {
                    if (a.muledump.ClassName < b.muledump.ClassName) return -1;
                    if (a.muledump.ClassName > b.muledump.ClassName) return 1;
                    if (a.muledump.ClassName === b.muledump.ClassName) {
                        return b.CurrentFame - a.CurrentFame;
                    }
                    return 0;
                });

                //  base exp
            } else if (this.opt('chsort') === '3') {

                carr.sort(function (a, b) {
                    return b.Exp - a.Exp
                });

                //  total fame
            } else if (this.opt('chsort') === '2') {

                carr.sort(function (a, b) {
                    return b.muledump.TotalFame - a.muledump.TotalFame
                });

                //  base fame
            } else if (this.opt('chsort') === '1') {

                carr.sort(function (a, b) {
                    return b.CurrentFame - a.CurrentFame
                });

                //  id (default)
            } else {
                carr.sort(function (a, b) {
                    return a.id - b.id
                });
            }

            if (setuptools.data.config.debugging === true) setuptools.app.uaTiming('mule', 'parseCharacterSorting', 'stop', this.guid);

        }

        if (this.opt('classstats') && d.Account && d.Account.Stats && d.Account.Stats.ClassStats && d.Account.Stats.ClassStats.length > 0 ) {

            var cswidth = setuptools.data.config.rowlength*220;
            var cshtml = ' \
                <div class="classstats flex-container noFlexAutoWidth" style="flex-wrap: wrap; justify-content: flex-start; width: ' + cswidth + 'px;">\
            ';
            var cslist = {};
            d.Account.Stats.ClassStats.forEach(function(stats, index) {
                //  classes newer than the bundled constants may be missing from skins
                var csclass = skins[+stats.objectType] || classes[+stats.objectType] || ['Class ' + stats.objectType];
                cslist[csclass[0]] = index;
            });

            var csmap = [];
            Object.keys(cslist).sort(function(a,b) {
                if ( a < b ) return -1;
                if ( a === b ) return 0;
                if ( a > b ) return 1;
            }).forEach(function(csname) {
                csmap.push(cslist[csname]);
            });

            csmap.forEach(function(csid) {
                var stats = d.Account.Stats.ClassStats[csid];
                var baseFame = +(stats.BestBaseFame || stats.BestFame) || 0;
                var classStars = 0;
                while ( classStars < 5 && baseFame >= STARFAME[classStars] ) classStars++;
                var starHtml = '';
                for ( var cq = 0; cq < 5; cq++ ) starHtml += '<span class="classquest' + ( (cq < classStars) ? ' done' : '' ) + '" title="Class quest ' + (cq + 1) + ': ' + STARFAME[cq] + ' base fame">\u2605</span>';
                var exaltInfo = window.MuledumpExalts.forClass(d.Account.ExaltMap, +stats.objectType);
                var exaltTotal = window.MuledumpExalts.total(exaltInfo);
                cshtml += ' \
                    <div class="class flex-container noFlexAutoWidth ml5 mr5 mb5 mt5 menuStyle nohover" style="flex-wrap: wrap; justify-content: space-between;"> \
                        <div class="className flex-container noFlexAutoWidth" style="width: 41%;">' + (skins[+stats.objectType] || classes[+stats.objectType] || ['Class ' + stats.objectType])[0] + '</div>\
                        <div class="flex-container noFlexAutoWidth" style="width: 59%; flex-wrap: wrap;">\
                            <div class="cell bestLevel flex-container" style="justify-content: space-between; padding-left: 4px;"> \
                                <div>Best Level</div>\
                                <div>' + stats.BestLevel + '</div>\
                            </div>\
                            <div class="cell bestFame flex-container" style="justify-content: space-between; padding-left: 4px;"> \
                                <div>Base Fame</div>\
                                <div>' + baseFame + '</div>\
                            </div>\
                            <div class="cell bestTotalFame flex-container" style="justify-content: space-between; padding-left: 4px;"> \
                                <div>Total Fame</div>\
                                <div>' + (+stats.BestTotalFame || 0) + '</div>\
                            </div>\
                            <div class="cell classQuests flex-container" style="justify-content: space-between; padding-left: 4px;"> \
                                <div>Stars</div>\
                                <div>' + starHtml + '</div>\
                            </div>\
                            <div class="cell exaltations flex-container" style="justify-content: space-between; padding-left: 4px;"> \
                                <div>Exaltations</div>\
                                <div>' + exaltTotal + ' / 40</div>\
                            </div>\
                        </div>\
                    </div>\
                ';
            });
            cshtml += ' \
                </div>\
            ';
            $('<div class="classstats flex-container">').html(cshtml).appendTo(this.dom);

        }

        //  main character loop
        if ( typeof setuptools.tmp.wawawaTimers === 'undefined' ) setuptools.tmp.wawawaTimers = {};
        if ( typeof setuptools.tmp.mainCharLoopTimers === 'undefined' ) setuptools.tmp.mainCharLoopTimers = {};
        setuptools.tmp.wawawaTimers[this.guid] = 0;
        setuptools.tmp.mainCharLoopTimers[this.guid] = 0;

        //  loop chars for counting
        if ( this.totals.cache === false ) {

            for ( var z = 0; z < CountingCharList.length; z++ ) {

                if ( typeof CountingCharList[z] !== 'object' ) CountingCharList[z] = {};
                var eqc = (CountingCharList[z].Equipment || '').split(',');
                for ( var tec = 0; tec < 4; tec++ ) this.totals.count(eqc[tec] || "-1", 'equipment');
                for ( var tic = 4; tic < 12; tic++ ) this.totals.count(eqc[tic] || "-1", 'inv');
                var bpSlots = backpackSlots(CountingCharList[z]);
                for ( var tbc = 12; tbc < 12 + bpSlots; tbc++ ) this.totals.count(eqc[tbc] || "-1", 'backpack');
                var qsc = quickslots(CountingCharList[z]);
                for ( var tqc = 0; tqc < qsc.length; tqc++ ) if ( qsc[tqc][0] !== '-1' ) this.totals.count(qsc[tqc][0], 'quickslots', qsc[tqc][1]);

            }

        }

        //  loop chars for display
        for (var i = 0; i < carr.length; i++) {

            setuptools.app.uaTiming('mule', 'mainCharLoopTimer', 'start', this.guid);
            var c = carr[i], $c = $('<div class="char">');
            if (!c) continue;
            var cl = classes[c.ObjectType];
            if (!cl) continue;
            if ( this.loginOnly === false && !this.opt('shrink') && this.opt('chdesc') ) {

                f = true;

                //  draw character portrait and description
                setuptools.app.muledump.drawPortrait(c, $c);

            }

            var charExalts = window.MuledumpExalts.forClass(d.Account.ExaltMap, c.ObjectType);
            if ( this.loginOnly === false && !this.opt('shrink') && this.opt('stats') ) {
                f = true;
                var $stats = $('<table class="stats">');

                for (var t = 0; t < STATTAGS.length; t++) {
                    var $row;
                    if (t % 2 === 0) $row = $('<tr>');
                    $('<td class="sname">').text(STATABBR[t]).appendTo($row);
                    var $s = $('<td>');
                    var s = +c[STATTAGS[t]] || 0;
                    var stt = this.opt('sttype');
                    if (stt === 'base') {
                        stat($s, 'base', s).toggleClass('maxed', s === cl[3][t]);
                    } else if (stt === 'avg') {
                        var avgd = s - Math.floor(cl[1][t] + (cl[2][t] - cl[1][t]) * (+c.Level - 1) / 19);
                        stat($s, 'avg', (avgd > 0 ? '+' : '') + avgd)
                            .addClass(avgd > 0 ? 'good' : (avgd < 0 ? 'bad' : ''))
                            .toggleClass('very', Math.abs(avgd) > 14);
                    } else if (stt === 'max') {
                        var l2m = cl[3][t] - s;
                        if (t < 2) l2m = l2m + ' (' + Math.ceil(l2m / 5) + ')';
                        stat($s, 'max', l2m)
                            .toggleClass('maxed', cl[3][t] <= s);
                    } else if (stt === 'comb') {
                        if (s < cl[3][t]) {
                            var avgd = s - Math.floor(cl[1][t] + (cl[2][t] - cl[1][t]) * (+c.Level - 1) / 19);
                            stat($s, 'small', s + ' / ' + cl[3][t])
                                .addClass(avgd > 0 ? 'good' : (avgd < 0 ? 'bad' : ''))
                                .toggleClass('very', Math.abs(avgd) > 14)
                                .attr('title', avgd + ' from avg');
                        } else {
                            stat($s, 'maxed', s)
                        }
                    }
                    if ( charExalts && charExalts[t].bonus > 0 )
                        $('<span class="exaltbonus">').text('+' + charExalts[t].bonus)
                            .attr('title', 'Exaltation ' + charExalts[t].level + '/5 (' + charExalts[t].count + ' completions)')
                            .appendTo($s);
                    $s.appendTo($row);
                    if (t % 2) $row.appendTo($stats);
                }

                $c.append($stats);
            }

            if ( this.loginOnly === false && !this.opt('shrink') && this.opt('exalts') ) {
                var $exalts = window.MuledumpExalts.row(d.Account.ExaltMap, c.ObjectType);
                if ( $exalts ) $c.append($exalts);
            }

            // items
            var eq = (c.Equipment || '').split(',');
            var tcount = [];
            var bpSlots = backpackSlots(c);
            var dobp = this.opt('backpack') && bpSlots > 0;
            var qslots = quickslots(c);
            var doqs = this.opt('quickslots') && qslots.length > 0;

            if (this.opt('equipment') || this.opt('inv') || dobp) {

                f = true;
                if ( this.loginOnly === false && !this.opt('shrink') ) var itc = $('<div>').addClass('items');
                if (this.opt('equipment')) {
                    tcount = tcount.concat(eq.slice(0, 4));
                    if ( this.loginOnly === false && !this.opt('shrink') ) itc.append(setuptools.app.muledump.item_listing(eq.slice(0, 4), 'equipment', c.ObjectType));
                }
                if (this.opt('inv')) {
                    tcount = tcount.concat(eq.slice(4, 12));
                    if ( this.loginOnly === false && !this.opt('shrink') ) itc.append(setuptools.app.muledump.item_listing(eq.slice(4, 12), 'inv'));
                }
                if (dobp) {
                    //  first 8 slots are the backpack, the next 8 come from a backpack extender
                    var bp = eq.slice(12, 12 + bpSlots);
                    while (bp.length < bpSlots) bp.push('-1');
                    tcount = tcount.concat(bp);
                    if ( this.loginOnly === false && !this.opt('shrink') ) {
                        itc.append(setuptools.app.muledump.item_listing(bp.slice(0, 8), 'backpack'));
                        if ( bp.length > 8 ) itc.append(setuptools.app.muledump.item_listing(bp.slice(8, 16), 'backpack extender'));
                    }
                }


                if ( this.loginOnly === false && !this.opt('shrink') ) itc.appendTo($c);

            }

            //  consumable slots (replace the legacy HP/MP potion stacks)
            if ( this.loginOnly === false && !this.opt('shrink') && doqs ) {
                var $qs = $('<div class="w100 quickslots">').addClass('qs' + qslots.length);
                for ( var qi = 0; qi < qslots.length; qi++ ) {
                    var qid = window.MuledumpUnique.itemId(qslots[qi][0]);
                    var $slot = $('<div class="qslot">').appendTo($qs);
                    var $icon = $('<div class="qsicon">').appendTo($slot);
                    //  window.items: parse() has a local `items` (gift chests) that shadows the global table
                    var qitem = window.items[qid];
                    if ( qid > 0 && qitem ) {
                        $icon.css('background-position', '-' + (qitem[3] / 2) + 'px -' + (qitem[4] / 2) + 'px');
                        $slot.attr('data-itemId', qid).prepend($('<div class="qscount">').attr('data-qty', qslots[qi][1]).text(qslots[qi][1]));
                        if ( setuptools.data.config.tooltipItems > 0 ) setuptools.app.muledump.tooltip($slot);
                    } else {
                        $slot.addClass('qsempty');
                    }
                }
                $c.append($qs);
            }

            //  keeping this separate from the wawawa code
            if ( this.loginOnly === false && !this.opt('shrink') && this.opt('wawawa')) {

                if (setuptools.tmp.gaSentWawawa !== true) {

                    setuptools.tmp.gaSentWawawa = true;
                    setuptools.app.ga('send', 'event', {
                        eventCategory: 'options',
                        eventAction: 'wawawa'
                    });

                }

            }

            /*
            //  Wawawa Option
            //  https://github.com/wawawawawawawa/muledump
            //  https://github.com/jakcodex/muledump/pull/19
            //  Thank you, Wawawa!
            */
            /////////////////////////
            // WAWAWA PART
            if (this.loginOnly === false && !this.opt('shrink') && this.opt('wawawa')) {

                if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseWawawa', 'start', this.guid);
                function round(value, decimals) {
                    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
                }

                function apply_bonus(value) {
                    return window.calcfame(c, d, value, st).total;
                }

                var st = readstats(c.PCStats); 			//FAME
                var iTotalFame = +c.CurrentFame;
                var fame = +c.CurrentFame;
                var fbonus = [];
                fbonus.push('Base Fame : ' + iTotalFame.toLocaleString() + '\n\n');
                var wfame = window.calcfame(c, d, iTotalFame, st);
                for ( var wf = 0; wf < wfame.earned.length; wf++ )
                    fbonus.push(wfame.earned[wf].name + ' : +' + wfame.earned[wf].fame.toLocaleString() + ' Fame\n');
                iTotalFame = wfame.total;
                fbonus.push('\nTotal Fame : ' + iTotalFame.toLocaleString() + ' Fame' + '\n\nFirst Born : ' + d.Account.Stats.BestCharFame);

                var boost = round((iTotalFame / fame), 2)
                var lower = 0;
                var upper = d.Account.Stats.BestCharFame;
                if (upper - lower == 1) {
                    upper = +c.CurrentFame + 1;
                }
                while (upper - lower > 1) {
                    var middle = lower + Math.floor((upper - lower) / 2);
                    var current = apply_bonus(middle);
                    if (current >= d.Account.Stats.BestCharFame) {
                        upper = middle;
                    } else {
                        lower = middle;
                    }
                }
                if (apply_bonus(+c.CurrentFame) < d.Account.Stats.BestCharFame) {
                    var upperleft = upper - +c.CurrentFame;
                    fbonus.push('\nBase Fame Needed for First Born : ' + lower.toLocaleString() + ' (' + upperleft.toLocaleString() + ' Base Fame Left)');
                }

                if (iTotalFame > 0) {
                    if (iTotalFame > 400) {
                        if (iTotalFame > 2000) {
                            $('<div>').append($('<div style="color:gold;font-weight:bold">').text(' Total Fame = ' + iTotalFame.toLocaleString() + ' Fame ').attr('title', fbonus.join('')))
                                .appendTo($c);
                        }
                        else {
                            $('<div>').append($('<div style="color:#39ef4e;font-weight:bold">').text(' Total Fame = ' + iTotalFame.toLocaleString() + ' Fame ').attr('title', fbonus.join('')))
                                .appendTo($c);
                        }
                    }
                    else {
                        $('<div>').append($('<div style="color:#99f7a4;font-weight:bold">').text(' Total Fame = ' + iTotalFame.toLocaleString() + ' Fame ').attr('title', fbonus.join('')))
                            .appendTo($c);
                    }
                }
                else {
                    $('<div>').append($('<div style="color:red;font-weight:bold">').text(' Total Fame = ' + iTotalFame.toLocaleString() + ' Fame ').attr('title', fbonus.join('')))
                        .appendTo($c);
                }

                var v = st[20], ATime = [];			//TIME
                var FPM = round(fame / v, 2) + ' Base Fame/Minute\n' + round(iTotalFame / v, 2) + ' Total Fame/Minute\nFame Boost : ' + round((iTotalFame / fame) * 100, 2) + ' %';
                var divs = { 'y': 525600, 'm': 43200, 'd': 1440, 'h': 60, 'min': 1 };
                for (var s in divs) {
                    if (ATime.length > 4) break;
                    var t = Math.floor(v / divs[s]);
                    if (t) ATime.push(t + s);
                    v %= divs[s];
                }

                if (st[20] > 60) {
                    $('<div>').append($('<div style="color:gold;font-weight:bold">').text(' Active Time = ' + ATime.join(' ')).attr('title', FPM))
                        .appendTo($c);
                }
                else if (st[20] > 30) {
                    $('<div>').append($('<div style="color:#39ef4e;font-weight:bold">').text(' Active Time = ' + ATime.join(' ')).attr('title', FPM))
                        .appendTo($c);
                }
                else if (st[20] > 10) {
                    $('<div>').append($('<div style="color:#99f7a4;font-weight:bold">').text(' Active Time = ' + ATime.join(' ')).attr('title', FPM))
                        .appendTo($c);
                }
                else {
                    if (ATime == "") {
                        $('<div>').append($('<div style="color:red;font-weight:bold">').text(' Active Time < 1 min ').attr('title', FPM))
                            .appendTo($c);
                    }
                    else {
                        $('<div>').append($('<div style="color:red;font-weight:bold">').text(' Active Time = ' + ATime.join(' ')).attr('title', FPM))
                            .appendTo($c);
                    }
                }

                //  the remaining 2020 sections tracked fame bonuses that no longer exist (Explorer, Tunnel Rat,
                //  Oryx Slayer, Accurate, Enemy of the Gods, Team Player, Doer of Deeds); show current data instead
                function wline(text, color, title) {
                    $('<div>').append($('<div style="font-weight:bold">').css('color', color).text(' ' + text).attr('title', title || ''))
                        .appendTo($c);
                }
                function wcolor(value, steps) {
                    if ( value <= 0 ) return 'red';
                    if ( value < steps[0] ) return '#99f7a4';
                    if ( value < steps[1] ) return '#39ef4e';
                    return 'gold';
                }

                //  tiles
                var wgoals = window.famegoals(c, d, st);
                var goalFor = function(statName) {
                    var g = wgoals.filter(function(x) { return x[2] === statName; })[0];
                    return g ? 'Next: ' + g[1] + ' in ' + g[0].toLocaleString() : 'All tiers earned';
                };
                var tpm = st[20] ? round(st[3] / st[20], 0) : 0;
                wline('Tiles Discovered = ' + st[3].toLocaleString(), wcolor(st[3], [1e6, 4e6]),
                    tpm.toLocaleString() + ' tiles/minute\n' + goalFor(window.pcstatnames[3] || 'Tiles discovered'));

                //  dungeons
                var dungeonList = [], dungeonTypes = 0, dungeonClears = 0;
                for ( var di in window.playerStats ) {
                    if ( !window.playerStats.hasOwnProperty(di) || !/Completed$/.test(window.playerStats[di][0]) || /^(Quests|DungeonTypes)/.test(window.playerStats[di][0]) ) continue;
                    if ( !st[di] ) continue;
                    dungeonTypes++;
                    dungeonClears += st[di];
                    dungeonList.push(st[di].toLocaleString() + ' ' + window.pcstatnames[di]);
                }
                dungeonList.sort(function(a, b) { return parseInt(b.replace(/,/g, '')) - parseInt(a.replace(/,/g, '')); });
                wline('Dungeons = ' + dungeonTypes + ' types, ' + dungeonClears.toLocaleString() + ' clears', wcolor(dungeonTypes, [10, 30]), dungeonList.join('\n'));

                //  accuracy
                if ( st[0] > 0 ) {
                    var acc = round(100 * st[1] / st[0], 2);
                    wline('Accuracy = ' + acc + '%', wcolor(acc, [25, 50]),
                        'Shots : ' + st[0].toLocaleString() + '\nHits : ' + st[1].toLocaleString() + '\nAbility uses : ' + st[2].toLocaleString());
                }

                //  god kills
                if ( st[6] + st[8] > 0 ) {
                    wline('God Kills = ' + st[8].toLocaleString() + ' (' + round(100 * st[8] / (st[6] + st[8]), 2) + '%)', wcolor(st[8], [100, 1000]),
                        'Monster kills : ' + st[6].toLocaleString() + '\nGod kills : ' + st[8].toLocaleString() + '\nOryx kills : ' + st[11].toLocaleString() + '\nCube kills : ' + st[10].toLocaleString());
                }

                //  closest fame bonus goals under the current system
                if ( wgoals.length > 0 ) {
                    var wsorted = wgoals.slice().sort(function(a, b) { return a[0] - b[0]; });
                    wline('Next Fame Goal = ' + wsorted[0][1] + ' (' + wsorted[0][0].toLocaleString() + ' ' + wsorted[0][2].toLowerCase() + ')', '#99f7a4',
                        wsorted.map(function(g) { return g[0].toLocaleString() + ' ' + g[2].toLowerCase() + ' for ' + g[1]; }).join('\n'));
                }

                if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseWawawa', 'stop', this.guid);

            }
            // WAWAWA PART END
            /////////////////////////

            if (this.opt('pcstats') || this.opt('goals')) {


                f = true;
                $c.append(window.printstats(c, d, this.opt('goals'), this.opt('pcstats'), this));
            }
            arr.push($c);

            setuptools.app.uaTiming('mule', 'mainCharLoopTimer', 'stop', this.guid);

        }

        if (!this.opt('shrink') && f) {
            this.dom.append($('<hr class="chars">'));
            maketable('chars', arr).appendTo(this.dom);
        }
        arr = [];

        //  record cummulative timing data
        /* too much noise
        if ( typeof timing.aggregate['mule-mainCharLoopTimer'] === 'object' ) setuptools.app.ga('timing', {
            category: 'mule',
            key: 'parseMainCharacterLoop',
            value: timing.aggregate['mule-mainCharLoopTimer'].mean
        });
        */

        function makechest(items, classname, index) {
            var il = setuptools.app.muledump.item_listing(items.slice(0, 8), classname)
            return $('<div class="items" data-vaultId="' + (setuptools.data.muledump.vaultbuilder.layouts[vaultlayout].vaultorder[index] || 0) + '">').append(il)
        }

        // select the vault order for this char
        vaultlayout = ( this.opt('vaultlayout') && setuptools.data.muledump.vaultbuilder.layouts[this.opt('vaultlayout')] ) ? this.opt('vaultlayout') : setuptools.data.options.vaultlayout;
        vaultwidth = (
            typeof setuptools.data.muledump.vaultbuilder.layouts[vaultlayout] === 'object' &&
            setuptools.data.muledump.vaultbuilder.layouts[vaultlayout].vaultwidth
        ) ? setuptools.data.muledump.vaultbuilder.layouts[vaultlayout].vaultwidth : ROW;
        VAULTORDER = setuptools.data.muledump.vaultbuilder.layouts[vaultlayout] ? setuptools.data.muledump.vaultbuilder.layouts[vaultlayout].vaultorder : vaultorders[0];

        //  vaults
        var chests;
        if ( d.Account.Vault && this.totals.cache === false ) {

            //  counting for totals
            chests = d.Account.Vault ? d.Account.Vault.Chest || ['-1'] : ['-1'];
            if (typeof chests === 'string') chests = [chests];
            if ( typeof chests === 'object' && Object.keys(chests).length === 0 ) chests = ['-1'];
            if ( Array.isArray(chests) === false ) {
                setuptools.app.techlog('Mule ' + this.guid + ' encountered bad chest data');
                setuptools.app.techlog(chests);
                chests = ['-1'];
            }
            for ( var tv = 0; tv < chests.length; tv++ ) {

                if ( chests[tv] === 0 ) continue;
                if ( typeof chests[tv] !== 'string' ) chests[tv] = '-1';
                if (chest = chests[tv].split(','))
                    for (var tv2 = 0; tv2 < 8; tv2++)
                        this.totals.count(chest[tv2] || '-1', 'vaults');

            }
        }

        //  display vaults
        if (this.opt('vaults')) {

            if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseVaults', 'start', this.guid, false, setuptools.app.uaTimingAggregate);
            if ( this.loginOnly === false && !this.opt('shrink') ) this.dom.append($('<hr class="vaults">'));

            if ( !chests ) {

                chests = d.Account.Vault ? d.Account.Vault.Chest || ['-1'] : ['-1'];
                if (typeof chests === 'string') chests = [chests];
                if (typeof chests === 'object' && Object.keys(chests).length === 0) chests = ['-1'];

            }
            var w = arrangevaults(chests, vaultlayout);
            chests = w[1];
            for (var x = 0; x < chests.length; x++) {

                //  non-existent chests are skipped
                if ( typeof chests[x] !== "string" ) {

                    //  this is a spacer
                    if ( chests[x] === 0 ) {

                        arr.push(null);
                        continue;

                    }

                    //  empty chests are empty
                    if ( typeof chests[x] === 'object' ) chests[x] = '-1,-1,-1,-1,-1,-1,-1,-1';

                }

                var chest = (chests[x] || '-1').split(',');
                while (chest.length < 8) chest.push('-1');
                arr.push(makechest(chest, 'vaults', x));

            }

            if ( this.loginOnly === false && !this.opt('shrink') ) maketable('vaults', arr, w[0]).appendTo(this.dom);
            if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseVaults', 'stop', this.guid);

        }

        //  gift chest (newest first) and exalt temporary gifts, both counted as gifts in totals
        var giftWidth = ( (setuptools.data.config.giftChestWidth === 0) ? setuptools.data.config.rowlength : setuptools.data.config.giftChestWidth );
        var giftSections = [
            {key: 'gifts', label: 'Gift Chest', list: d.Account.Gifts},
            {key: 'tempgifts', label: 'Temporary Gifts', list: d.Account.TemporaryGifts}
        ];
        for ( var gs = 0; gs < giftSections.length; gs++ ) {

            var gsec = giftSections[gs];
            var items = ( typeof gsec.list === 'string' && gsec.list !== '' ) ? gsec.list.split(',').reverse() : undefined;
            if ( Array.isArray(items) === true && this.totals.cache === false ) {
                for (var tg = 0; tg < items.length; tg++)
                    this.totals.count(items[tg], 'gifts');
            }

            //  display gift chests
            if ( !this.opt('gifts') || !Array.isArray(items) || items.length === 0 ) continue;

            if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseGifts', 'start', this.guid, false, setuptools.app.uaTimingAggregate);
            if ( this.loginOnly === false && !this.opt('shrink') ) {
                this.dom.append($('<hr class="' + gsec.key + '">'));
                this.dom.append($('<div class="storagelabel">').text(gsec.label + ' (' + items.length + ' item' + ( (items.length === 1) ? '' : 's' ) + ')'));
            }

            var garr = [];
            while (items.length) {
                while (items.length < 8) items.push("-1");
                garr.push(makechest(items, 'gifts'));
                items = items.slice(8);
            }
            if ( this.loginOnly === false && !this.opt('shrink') ) maketable('gifts' + ( (gsec.key === 'gifts') ? '' : ' ' + gsec.key ), garr, giftWidth).appendTo(this.dom);
            if ( setuptools.data.config.debugging === true ) setuptools.app.uaTiming('mule', 'parseGifts', 'stop', this.guid);

        }

        //  exalt storages: potion storage, material storage and pets
        var display = ( this.loginOnly === false && !this.opt('shrink') );

        function itemList(value) {
            return ( typeof value === 'string' && value !== '' ) ? value.split(',') : [];
        }

        function padChest(list) {
            list = list.slice(0, 8);
            while (list.length < 8) list.push('-1');
            return list;
        }

        function chunkChests(list) {
            var out = [];
            for ( var i = 0; i < list.length; i += 8 ) out.push(padChest(list.slice(i, i + 8)));
            return out;
        }

        var materialChests = ( d.Account.MaterialStorage && typeof d.Account.MaterialStorage === 'object' ) ? d.Account.MaterialStorage.Chest : undefined;
        if ( typeof materialChests === 'string' ) materialChests = [materialChests];
        if ( !Array.isArray(materialChests) ) materialChests = [];

        var storages = [
            {key: 'potions', label: 'Potion Storage', chests: chunkChests(itemList(d.Account.Potions))},
            {key: 'materials', label: 'Material Storage', chests: materialChests.map(function(chest) {
                return padChest(itemList( (typeof chest === 'string') ? chest : '' ));
            })}
        ];

        for ( var st = 0; st < storages.length; st++ ) {

            var storage = storages[st];
            if ( this.totals.cache === false )
                for ( var sc = 0; sc < storage.chests.length; sc++ )
                    for ( var si = 0; si < 8; si++ ) this.totals.count(storage.chests[sc][si], storage.key);

            if ( this.opt(storage.key) && display && storage.chests.length > 0 ) {
                this.dom.append($('<hr class="' + storage.key + '">'));
                this.dom.append($('<div class="storagelabel">').text(storage.label));
                maketable(storage.key, storage.chests.map(function(chest) {
                    return makechest(chest, storage.key);
                })).appendTo(this.dom);
            }

        }

        //  forge blueprints: items this account has unlocked for crafting (not owned items, so not in totals)
        var blueprintList = itemList(d.Account.RegularForgeFireBlueprints);
        if ( this.opt('forge') && display && blueprintList.length > 0 ) {
            this.dom.append($('<hr class="forge">'));
            this.dom.append($('<div class="storagelabel">').text('Forge Blueprints (' + blueprintList.length + ')' +
                ( d.Account.ForgeFireEnergy ? ' \u2022 Fire Energy ' + (+d.Account.ForgeFireEnergy).toLocaleString() : '' )));
            maketable('forge', chunkChests(blueprintList).map(function(chest) {
                return makechest(chest, 'forge');
            })).appendTo(this.dom);
        }

        //  pets travel with characters; show each pet once
        var petList = [], seenPets = {};
        for ( var pc = 0; pc < carr.length; pc++ ) {
            var pet = carr[pc] ? carr[pc].Pet : undefined;
            if ( !pet || typeof pet !== 'object' || !pet.type ) continue;
            var petKey = pet.instanceId || pet.type;
            if ( seenPets[petKey] ) continue;
            seenPets[petKey] = true;
            petList.push(pet);
        }

        var PETRARITY = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Divine'];
        var petCards = [];
        for ( var pi = 0; pi < petList.length; pi++ ) {

            var p = petList[pi];
            var inv = ( typeof p.inv === 'string' ) ? p.inv.substring(p.inv.lastIndexOf(';') + 1) : '';
            var petItems = itemList(inv);
            if ( this.totals.cache === false )
                for ( var pt = 0; pt < petItems.length; pt++ ) this.totals.count(petItems[pt], 'pets');
            if ( !this.opt('pets') || !display ) continue;

            var petData = window.pets[+p.type] || [];
            var skin = window.petSkins[+p.skin] || window.petSkins[petData[3]];
            var $card = $('<div class="petcard">');
            var $head = $('<div class="pethead">').appendTo($card);
            var $icon = $('<div class="item noselect">').appendTo($head);
            $icon.css('background-position', skin ? '-' + skin[1] + 'px -' + skin[2] + 'px' : '-40px 0px');
            if ( skin ) $icon.attr('title', skin[0]);

            var $info = $('<div class="petinfo">').appendTo($head);
            $('<div class="petname">').text(p.name || petData[0] || 'Pet').appendTo($info);
            $('<div>').text([PETRARITY[+p.rarity], petData[1]].filter(Boolean).join(' ')).appendTo($info);

            var abilities = ( p.Abilities && p.Abilities.Ability ) ? p.Abilities.Ability : [];
            if ( !Array.isArray(abilities) ) abilities = [abilities];
            for ( var ab = 0; ab < abilities.length; ab++ ) {
                var abName = window.petAbilities[+abilities[ab].type] || ('Ability ' + abilities[ab].type);
                $('<div>').text(abName + ' ' + (abilities[ab].power || 0)).appendTo($info);
            }

            if ( petItems.length > 0 ) $card.append(setuptools.app.muledump.item_listing(petItems, 'petinv'));
            petCards.push($card);

        }

        if ( petCards.length > 0 ) {
            this.dom.append($('<hr class="pets">'));
            this.dom.append($('<div class="storagelabel">').text('Pets'));
            maketable('pets', petCards).appendTo(this.dom);
        }

        setuptools.app.uaTiming('mule', 'parse', 'stop', this.guid);

        if ( this.totals.cache === false ) {
            this.totals.save();
            this.redoTotals = true;
        }

        if ( this.loginOnly === false ) {

            var original = this.loaded;
            this.loaded = true;
            this.dom.css('display', 'inline-block');
            relayout(( original === false || this.redoTotals === true ) ? undefined : false);

        }

        //  hotkey for creating image of mule
        this.dom.on('click.mule.screenshot', function(e) {
            var dom = $(this)[0];
             //  this does not work as intended; need to clone somehow instead: // $(dom).find('.button').remove();
            if ( setuptools.app.muledump.keys(['ctrl','shift'], e) === true ) setuptools.app.muledump.exporter.canvas(dom);
        });

        //  hotkey for creating image of all chars
        this.dom.find('table.chars').on('click.chars.screenshot', function(e) {
            if ( setuptools.app.muledump.keys(['ctrl','shift'], e) === true ) setuptools.app.muledump.exporter.canvas($(this)[0]);
        });

        //  hotkey for creating image of a char
        this.dom.find('table.chars > tr > td.cont').on('click.char.screenshot', function(e) {
            if ( setuptools.app.muledump.keys(['ctrl','shift'], e) === true ) setuptools.app.muledump.exporter.canvas($(this)[0]);
        });

        //  hotkey for creating image of specific vault
        this.dom.find('table.vaults > tr > td.cont').on('click.vault.screenshot', function(e) {
            if ( setuptools.app.muledump.keys(['ctrl','shift'], e) === true ) setuptools.app.muledump.exporter.canvas($(this)[0]);
        });

        //   hotkey for creating image of gift chests
        this.dom.find('table.gifts').on('click.gifts.screenshot', function(e) {
            if ( setuptools.app.muledump.keys(['ctrl','shift'], e) === true ) setuptools.app.muledump.exporter.canvas($(this)[0]);
        });

    };

    window.Mule = Mule


})($, window);
