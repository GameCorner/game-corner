// Global variables inherited from scripts.js
/*global rpgbot, updateModule, sys, SESSION, sendChanAll, escape, module*/
function RPG(rpgchan) {
    var name = "RPG";
    var game = this;
    var contentLoc;
    
    var charVersion = 1.1;
    
    var classes;
    var monsters;
    var skills;
    var items;
    var places;
    var elements;
    
    var tick = 0;
    
    var expTable = [40, 94, 166, 263, 393, 568, 804, 1122, 1551, 2130, 2911, 3965, 5387, 7306, 9896, 13392, 18111, 24481, 33080, 44688, 60358, 81512, 110069, 148620, 200663, 270921, 365769, 493813, 666672];
    
    var currentBattles = [];
    var duelChallenges = {};
    var tradeRequests = {};
    var currentParties = [];
    
    var startup = {
        classes: [],
        location: null,
        items: {},
        gold: 0,
        skills: 0,
        stats: 0
    };
    var leveling = {
        hp: 8,
        mp: 4,
        stats: 3,
        skills: 1,
        skillFromOtherClass: false,
        maxhp: 0,
        maxmp: 0,
        maxstats: 0,
        trade: 0,
        items: 0,
        itemsPerLevel: 0
    };
    var equipment = {
        rhand: "Right Hand",
        lhand: "Left Hand",
        body: "Body",
        head: "Head"
    };
    var battleSetup = {
        evasion: 1,
        defense: 1,
        damage: 1,
        critical: 1.5,
        instantCast: false,
        passive: 2,
        party: 6
    };
    
    var altSkills = {};
    var altPlaces = {};
    var altItems = {};
    var classHelp = [];
    
    this.walkTo = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        
        if (player.location === null || player.location === undefined || !(player.location in places)) {
            player.location = player.respawn;
            rpgbot.sendMessage(src, "You were in an unknown location! Moving you to the " + places[player.respawn].name + "!", rpgchan);
            return;
        }
        
        if (commandData === "*") {
            var out = ["", "You are at the " + places[player.location].name + "! You can move to the following locations: "];
            var access = places[player.location].access;
            for (var l in access) {
                var p = places[access[l]];
                if (!p.hide || p.hide !== true) {
                    out.push(p.name + " (" + access[l] + "): " + p.info + " [Type: " + cap(p.type) + "]");
                }
            }
            for (l in out) {
                sys.sendMessage(src, out[l], rpgchan);
            }
            return;
        }
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You can't move while dead!", rpgchan);
            return;
        }
        if (player.isBattling === true) {
            rpgbot.sendMessage(src, "Finish this battle before moving!", rpgchan);
            return;
        }
        
        var loc = commandData.toLowerCase();
        if (!(loc in places)) {
            if (loc in altPlaces) {
                loc = altPlaces[loc];
            } else {
                rpgbot.sendMessage(src, "No such place!", rpgchan);
                return;
            }
        }
        if (loc === player.location) {
            rpgbot.sendMessage(src, "You are already here!", rpgchan);
            return;
        }
        if (places[player.location].access.indexOf(loc) === -1) {
            rpgbot.sendMessage(src, "You can't go there from here!", rpgchan);
            return;
        }
        var r, s, req = places[loc].requisites;
        if (places[loc].requisites) {
            if ("key" in req) {
                for (s in req.key) {
                    if (!hasItem(player, s, req.key[s])) {
                        rpgbot.sendMessage(src, "You need at least " + req.key[s] + " " + items[s].name + "(s) to go there!", rpgchan);
                        return;
                    }
                }
            }
            if ("items" in req) {
                for (s in req.items) {
                    if (!hasItem(player, s, req.items[s])) {
                        rpgbot.sendMessage(src, "You need at least " + req.items[s] + " " + items[s].name + "(s) to go there!", rpgchan);
                        return;
                    }
                }
            }
            if ("level" in req) {
                if (player.level < req.level) {
                    rpgbot.sendMessage(src, "You need to be at least level " + req.level + " to go there!", rpgchan);
                    return;
                }
            }
            if ("classes" in req) {
                if (req.classes.indexOf(player.job) === -1) {
                    rpgbot.sendMessage(src, "You can't go there as a " + classes[player.job].name + "!", rpgchan);
                    return;
                }
            }
            if ("attributes" in req) {
                var att = ["hp", "mp", "str", "def", "spd", "dex", "mag"];
                for (s in req.attributes) {
                    if (att.indexOf(s) !== -1 && player[s] < req.attributes[s]) {
                        rpgbot.sendMessage(src, "You need at least " + req.attributes[s] + " " + cap(s) + " to go there!", rpgchan);
                        return;
                    }
                }
            }
            if ("events" in req) {
                for (s in req.events) {
                    var ev = req.events[s];
                    var v = s in player.events ? player.events[s] : false;
                    if (ev !== v) {
                        rpgbot.sendMessage(src, "You need to complete a mission to go there!", rpgchan);
                        return;
                    }
                }
            }
            if ("defeated" in req) {
                for (s in req.defeated) {
                    if (!(s in player.defeated) || player.defeated[s] < req.defeated[s]) {
                        rpgbot.sendMessage(src, "You need to defeat " + (req.defeated[s] - (s in player.defeated ? player.defeated[s] : 0)) + " more " + monsters[s].name + "(s) to go there!", rpgchan);
                        return;
                    }
                }
            }
        }
        
        var itemsConsumed = [];
        if (req && req.items) {
            for (r in req.items) {
                changeItemCount(player, r, -1 * req.items[r]);
                itemsConsumed.push(items[r].name + (req.items[r] > 1 ? "(" + req.items[r] + ")" : ""));
            }
        }
        
        sys.sendMessage(src, "", rpgchan);
        this.changeLocation(src, loc);
        if (itemsConsumed.length > 0) {
            rpgbot.sendMessage(src, "You consumed " + readable(itemsConsumed, "and") + " to enter here!", rpgchan);
        }
        sys.sendMessage(src, "", rpgchan);
    };
    this.changeLocation = function(src, loc, verb) {
        var player = SESSION.users(src).rpg;
        player.location = loc;
        
        var dest = [], x;
        for (var r in places[loc].access) {
            x = places[loc].access[r];
            if (!places[x].hide || places[x].hide !== true) {
                dest.push(places[x].name + " (" + x + ")");
            }
        }
        
        verb = verb === undefined ? "moved to" : verb;
        rpgbot.sendMessage(src, "You " + verb + " " + places[loc].name + "! ", rpgchan);
        if (dest.length > 0) {
            rpgbot.sendMessage(src, "From here, you can go to " + readable(dest, "or"), rpgchan);
        }
        rpgbot.sendMessage(src, places[loc].welcome, rpgchan);
        
        if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
            this.findParty(player.party).broadcast(player.name + " " + verb + " " + places[loc].name, src);
        }
    };
    this.talkTo = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You are dead! Type /revive to respawn!", rpgchan);
            return;
        }
        if (player.isBattling === true) {
            rpgbot.sendMessage(src, "Finish this battle before talking to someone!", rpgchan);
            return;
        }
        if (player.location === null || player.location === undefined || !(player.location in places)) {
            player.location = player.respawn in places ? player.respawn : startup.location;
            rpgbot.sendMessage(src, "You were in an unknown location! Moving you to the " + places[player.location].name + "!", rpgchan);
            return;
        }
        
        if (commandData === "*") {
            if (places[player.location].npc) {
                var talkable = [];
                for (var n in places[player.location].npc) {
                    if (!places[player.location].npc[n].hide || places[player.location].npc[n].hide !== true) {
                        talkable.push(cap(n));
                    }
                }
                if (talkable.length > 0) {
                    sys.sendMessage(src, "", rpgchan);
                    sys.sendMessage(src, "You can talk to the following persons:", rpgchan);
                    for (n in talkable) {
                        sys.sendMessage(src, talkable[n], rpgchan);
                    }
                    sys.sendMessage(src, "", rpgchan);
                } else {
                    rpgbot.sendMessage(src, "No one to talk to here!", rpgchan);
                }
                return;
            } else {
                rpgbot.sendMessage(src, "No one to talk to here!", rpgchan);
                return;
            }
        }
        
        if (!("npc" in places[player.location])) {
            rpgbot.sendMessage(src, "No one to talk to here!", rpgchan);
            return;
        }
        
        var people = places[player.location].npc;
        var data = commandData.split(":");
        var person = data[0].toLowerCase();
       
        if (!(person in people)) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        
        var npc = people[person];
        if (data.length < 2) {
            sys.sendMessage(src, npc.message, rpgchan);
            return;
        }
        
        var option = data[1].toLowerCase();
        if (!(option in npc) || option === "message" || option === "notopic" || option === "hide") {
            if (npc.notopic) {
                sys.sendMessage(src, npc.notopic, rpgchan);
            } else {
                sys.sendMessage(src, npc.message, rpgchan);
            }
            return;
        } 
        
        var topic = npc[option];
        if ("requisites" in topic) {
            var req = topic.requisites;
            var r;
            
            if ("classes" in req && req.classes.indexOf(player.job) === -1) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                return;
            }
            if ("level" in req && player.level < req.level) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                return;
            }
            if ("maxlevel" in req && player.level > req.maxlevel) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                return;
            }
            if ("events" in req) {
                for (r in req.events) {
                    var ev = req.events[r];
                    var v = r in player.events ? player.events[r] : false;
                    if (ev !== v) {
                        sys.sendMessage(src, topic.denymsg, rpgchan);
                        return;
                    }
                }
            }
            if ("gold" in req && player.gold < req.gold) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                return;
            }
            if ("items" in req) {
                for (r in req.items) {
                    if (!hasItem(player, r, req.items[r])) {
                        sys.sendMessage(src, topic.denymsg, rpgchan);
                        return; 
                    }
                }
            }
            if ("maxitems" in req) {
                for (r in req.maxitems) {
                    if (hasItem(player, r, req.maxitems[r] + 1)) {
                        sys.sendMessage(src, topic.denymsg, rpgchan);
                        return; 
                    }
                }
            }
            if ("attributes" in req) {
                var att = ["hp", "mp", "str", "def", "spd", "dex", "mag"];
                for (r in req.attributes) {
                    if (att.indexOf(r) !== -1 && player[r] < req.attributes[r]) {
                        sys.sendMessage(src, topic.denymsg, rpgchan);
                        return;
                    }
                }
            }
            if ("noSkillPoints" in req && req.noSkillPoints === true) {
                var points = 0;
                for (r in classes[player.job].skills) {
                    points += skills[r].levels - player.skills[r];
                }
                if (player.skillPoints > 0 && points > 0) {
                    sys.sendMessage(src, topic.denymsg + " [You must use all your Skill Points!]", rpgchan);
                    return;
                }
            }
            if ("defeated" in req) {
                for (r in req.defeated) {
                    if (!(r in player.defeated) || player.defeated[r] < req.defeated[r]) {
                        sys.sendMessage(src, topic.denymsg + " [You need to defeat " + (req.defeated[r] - (r in player.defeated ? player.defeated[r] : 0)) + " more " + monsters[r].name + "(s)]", rpgchan);
                        return;
                    }
                }
            }
            if ("hunt" in req) {
                var noHunt = false;
                if (!(person in player.hunted)) {
                    sys.sendMessage(src, topic.denymsg, rpgchan);
                    player.hunted[person] = {};
                    for (r in req.hunt) {
                        player.hunted[person][r] = 0;
                    }
                    noHunt = true;
                } else {
                    var huntNeeded = [];
                    for (r in req.hunt) {
                        if (!(r in player.hunted[person])) {
                            player.hunted[person][r] = 0;
                            huntNeeded.push(req.hunt[r] + " " + monsters[r].name + "(s)");
                            noHunt = true;
                        } else if (player.hunted[person][r] < req.hunt[r]) {
                            huntNeeded.push((req.hunt[r] - player.hunted[person][r]) + " " + monsters[r].name + "(s)");
                            noHunt = true;
                        }
                    }
                    if (noHunt) {
                        sys.sendMessage(src, topic.denymsg + " [You still need to defeat " + readable(huntNeeded, "and") + "]", rpgchan);
                    }
                }
                if (noHunt) {
                    return;
                }
            }
        }
        
        var it, i, goods, price, amount = 1, products;
        
        if ("sell" in topic) {
            products = topic.sell;
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                
                for (i in products) {
                    it = items[i];
                    sys.sendMessage(src, it.name + " (" + i + "): " + it.info + (it.type === "equip" ? " " + getEquipAttributes(i) : "") + " (" + (products[i] !== "*" ? products[i] : it.cost) + " Gold) ", rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in products)) {
                sys.sendMessage(src, topic.nobuymsg,rpgchan);
                return;
            }
            
            if (data.length > 3 && isNaN(parseInt(data[3], 10)) === false) {
                amount = parseInt(data[3], 10);
                amount = amount < 1 ? 1 : amount;
            }
            
            price = (products[goods] !== "*" ? products[goods] : items[goods].cost) * amount;
            
            if (player.gold < price) {
                sys.sendMessage(src, topic.nogoldmsg.replace(/~Price~/g, price),rpgchan);
                return;
            }
            
            if (!canHoldItems(player, getItemCount(player, goods) + amount)) {
                rpgbot.sendMessage(src, "You can't have more than " + getItemLimit(player) + " " + items[goods].name + "(s)!",rpgchan);
                return;
            }
            
            player.gold -= price;
            changeItemCount(player, goods, amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            sys.sendMessage(src, "",rpgchan);
            return;
        } else if ("buy" in topic && typeof topic.buy === "object") {
            products = topic.buy;
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                
                for (i in topic.buy) {
                    it = items[i];
                    sys.sendMessage(src, it.name + " (" + i + "): " + it.info + " (" + (products[i] !== "*" ? products[i] : Math.floor(it.cost / 2) ) + " Gold)", rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in products)) {
                sys.sendMessage(src, topic.nosellmsg,rpgchan);
                return;
            }
            
            if (data.length > 3 && isNaN(parseInt(data[3], 10)) === false) {
                amount = parseInt(data[3], 10);
                amount = amount < 1 ? 1 : amount;
            }
            
            price = (products[goods] !== "*" ? products[goods] : Math.floor(items[goods].cost/2)) * amount;
            
            if (!hasItem(player, goods, amount)) {
                sys.sendMessage(src, topic.noitemmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name),rpgchan);
                return;
            }
            
            player.gold += price;
            changeItemCount(player, goods, -amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            sys.sendMessage(src, "",rpgchan);
            return;
        } else if ("buy" in topic && topic.buy === "*") {
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in items)) {
                sys.sendMessage(src, topic.nosellmsg,rpgchan);
                return;
            }
            
            if (data.length > 3 && isNaN(parseInt(data[3], 10)) === false) {
                amount = parseInt(data[3], 10);
                amount = amount < 1 ? 1 : amount;
            } else {
                sys.sendMessage(src, topic.offermsg.replace(/~Item~/g, items[goods].name).replace(/~Price~/g, Math.floor(items[goods].cost/2)),rpgchan);
                return;
            }
            
            price = Math.floor(items[goods].cost / 2) * amount;
            
            if (!hasItem(player, goods, amount)) {
                sys.sendMessage(src, topic.noitemmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name),rpgchan);
                return;
            }
            
            player.gold += price;
            changeItemCount(player, goods, -amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            sys.sendMessage(src, "",rpgchan);
            return;
        } else if ("trade" in topic) {
            products = topic.trade;
            var t, materials, rewards;
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                
                for (i in products) {
                    materials = [];
                    rewards = [];
                    for (t in products[i].material) {
                        if (t === "gold") {
                            materials.push(products[i].material[t] + " Gold");
                        } else {
                            materials.push(items[t].name + (products[i].material[t] > 1 ? " (x" + products[i].material[t] + ")" : ""));
                        }
                    }
                    
                    for (t in products[i].reward) {
                        if (t === "gold") {
                            rewards.push(products[i].reward[t] + " Gold");
                        } else {
                            rewards.push(items[t].name + (products[i].reward[t] > 1 ? " (x" + products[i].reward[t] + ")" : ""));
                        }
                    }
                    sys.sendMessage(src, i + ": " + readable(materials, "and") + " for " + readable(rewards, "and"), rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in products)) {
                sys.sendMessage(src, topic.notrademsg,rpgchan);
                return;
            }
            
            materials = products[goods].material;
            for (t in materials) {
                if (t === "gold") {
                    if (player.gold < materials[t]) {
                        sys.sendMessage(src, topic.nomaterialmsg,rpgchan);
                        return;
                    }
                } else if (!hasItem(player, t, materials[t])) {
                    sys.sendMessage(src, topic.nomaterialmsg,rpgchan);
                    return;
                }
            }
            
            rewards = products[goods].reward;
            for (t in rewards) {
                if (t !== "gold") {
                    if (!canHoldItems(player, getItemCount(player, t) + rewards[t])) {
                        rpgbot.sendMessage(src, "You can't have more than " + getItemLimit(player) + " " + items[t].name + "(s)!",rpgchan);
                        return;
                    }
                } 
            }
            
            for (t in materials) {
                if (t === "gold") {
                    player.gold -= materials[t];
                    rpgbot.sendMessage(src, materials[t] + " Gold lost!", rpgchan);
                } else {
                    changeItemCount(player, t, -materials[t]);
                    rpgbot.sendMessage(src, materials[t] + " " + items[t].name + "(s) lost!", rpgchan);
                }
            }
            
            for (t in rewards) {
                if (t === "gold") {
                    player.gold += rewards[t];
                    rpgbot.sendMessage(src, rewards[t] + " Gold received!", rpgchan);
                } else {
                    changeItemCount(player, t, rewards[t]);
                    rpgbot.sendMessage(src, rewards[t] + " " + items[t].name + "(s) received!", rpgchan);
                }
            }
            
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg,rpgchan);
            sys.sendMessage(src, "",rpgchan);
            return;
        } else if ("effect" in topic) {
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, topic.message, rpgchan);
            var eff = topic.effect;
            var e;
            
            if ("hp" in eff) {
                player.hp += eff.hp;
                if (player.hp > player.maxhp) {
                    player.hp = player.maxhp;
                } else if (player.hp < 0) {
                    player.hp = 0;
                }
            }
            if ("mp" in eff) {
                player.mp += eff.mp;
                if (player.mp > player.maxmp) {
                    player.mp = player.maxmp;
                } else if (player.mp < 0) {
                    player.mp = 0;
                }
            }
            if ("gold" in eff) {
                player.gold += eff.gold;
                if (player.gold < 0) {
                    player.gold = 0;
                }
                if (eff.gold > 0) {
                    rpgbot.sendMessage(src, "You received " + eff.gold + " Gold!", rpgchan);
                } else if (eff.gold > 0) {
                    rpgbot.sendMessage(src, "You lost " + eff.gold + " Gold!", rpgchan);
                }
            }
            if ("items" in eff) {
                for (e in eff.items) {
                    changeItemCount(player, e, eff.items[e]);
                    if (eff.items[e] > 0) {
                        rpgbot.sendMessage(src, "You received " + eff.items[e] + " " + items[e].name + "(s)!", rpgchan);
                    } else if (eff.items[e] < 0) {
                        rpgbot.sendMessage(src, "You lost " + (-1 * eff.items[e]) + " " + items[e].name + "(s)!", rpgchan);
                    }
                }
            }
            if ("events" in eff) {
                for (e in eff.events) {
                    player.events[e] = eff.events[e];
                }
            }
            if ("partyMove" in eff) {
                if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                    var party = this.findParty(player.party).findMembersNear(src);
                    for (e in party[0]) {
                        this.changeLocation(party[0][e], eff.partyMove);
                    }
                }
            } else if ("move" in eff) {
                this.changeLocation(src, eff.move);
            }
            if ("respawn" in eff) {
                player.respawn = eff.respawn;
                rpgbot.sendMessage(src, "Your respawn point was set to " + places[player.respawn].name + "!", rpgchan);
            }
            if ("exp" in eff && eff.exp > 0) {
                rpgbot.sendMessage(src, "You received " + eff.exp + " Exp. Points!", rpgchan);
                this.receiveExp(src, eff.exp);
            }
            if ("classes" in eff) {
                for (e in eff.classes) {
                    if (e === player.job) {
                        this.changePlayerClass(player, eff.classes[e]);
                        rpgbot.sendMessage(src, "You changed classes and now are a " + classes[player.job].name + "!", rpgchan);
                        break;
                    }
                }
            }
            if ("skills" in eff) {
                for (e in eff.skills) {
                    if (!(e in player.skills)) {
                        player.skills[e] = 0;
                    }
                    player.skills[e] += eff.skills[e];
                    if (player.skills[e] < 0) {
                        player.skills[e] = 0;
                    } else if (player.skills[e] > skills[e].levels) {
                        player.skills[e] = skills[e].levels;
                    }
                }
            }
            if ("attributes" in eff) {
                var attr = ["maxhp", "maxmp", "str", "def", "spd", "dex", "mag"];
                for (e in eff.attributes) {
                    if (attr.indexOf(e) !== -1) {
                        player[e] += eff.attributes[e];
                        if (player[e] < 1) {
                            player[e] = 1;
                        }
                    }
                }
            }
            if ("resetStats" in eff) {
                this.resetStats(src);
            }
            if ("resetSkills" in eff) {
                this.resetSkills(src);
            }
            var m, list;
            if ("monsters" in eff) {
                m = [];
                for (e in eff.monsters) {
                    for (var c = 0; c < eff.monsters[e]; ++c) {
                        m.push(this.generateMonster(e));
                    }
                }
                if (m.length > 0) {
                    var list;
                    if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                        list = this.findParty(player.party).findMembersNear(src);
                    } else {
                        list = [[src], [player]];
                    }
                    this.startBattle(list[0], list[1], m);
                }
            } else if ("soloMonsters" in eff) {
                m = [];
                for (e in eff.soloMonsters) {
                    for (var c = 0; c < eff.soloMonsters[e]; ++c) {
                        m.push(this.generateMonster(e));
                    }
                }
                if (m.length > 0) {
                    list = [[src], [player]];
                    this.startBattle(list[0], list[1], m);
                }
            }
            if ("hunt" in eff) {
                if (!(person in player.hunted)) {
                    player.hunted[person] = {};
                }
                for (e in eff.hunt) {
                    player.hunted[person][e] = eff.hunt[e];
                }
            }
            return;
        } else if ("storage" in topic) {
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            if (goods === "view") {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.storedmsg, rpgchan);
                this.viewItems(src, "storage");
                return;
            }
            
            if (!(goods in player.items) && !(goods in player.storage)) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.noitemmsg,rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            if (data.length < 4 || isNaN(parseInt(data[3], 10)) === true) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.storedmsg, rpgchan);
                rpgbot.sendMessage(src, "You have " + (goods in player.storage ? player.storage[goods] : "0") + " " + items[goods].name + "(s) stored!", rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            amount = parseInt(data[3], 10);
            if (this.storeItem(player, goods, amount)) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.acceptmsg, rpgchan);
                if (amount > 0) {
                    rpgbot.sendMessage(src, "You stored " + amount + " " + items[goods].name + " in the bank!", rpgchan);
                } else {
                    rpgbot.sendMessage(src, "You withdrew " + (-amount) + " " + items[goods].name + " from the bank!", rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
            } else {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.noitemmsg, rpgchan);
                sys.sendMessage(src, "", rpgchan);
            }
            return;
            
        } else if ("bank" in topic && topic.bank === true) {
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                rpgbot.sendMessage(src, "You currently have " + player.bank + " Gold stored!", rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            amount = parseInt(data[2], 10);
            
            if(isNaN(amount) === true) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.nogoldmsg, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            if (this.storeGold(player, amount)) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.acceptmsg, rpgchan);
                if (amount > 0) {
                    rpgbot.sendMessage(src, "You stored " + amount + " Gold in the bank! You now have " + player.bank + " stored!", rpgchan);
                } else {
                    rpgbot.sendMessage(src, "You withdrew " + (-amount) + " Gold from the bank! You now have " + player.bank + " stored!", rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
            } else {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.nogoldmsg, rpgchan);
                sys.sendMessage(src, "", rpgchan);
            }
            return;
        }
        
        sys.sendMessage(src, "", rpgchan);
        sys.sendMessage(src, topic.message, rpgchan);
    };
    this.exploreLocation = function(src) {
        var player = SESSION.users(src).rpg;
        
        if (player.isBattling === true) {
            rpgbot.sendMessage(src, "Finish this battle before exploring!", rpgchan);
            return;
        }
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You are dead! Type /revive to respawn!", rpgchan);
            return;
        }
        if (player.location === null || player.location === undefined || !(player.location in places)) {
            player.location = player.respawn in places ? player.respawn : startup.location;
            rpgbot.sendMessage(src, "You were in an unknown location! Moving you to the " + places[player.location].name + "!", rpgchan);
            return;
        }
        if (!("content" in places[player.location])) {
            rpgbot.sendMessage(src, "Nothing to explore here!", rpgchan);
            return;
        }
        
        var content = randomSample(places[player.location].content);
        
        if (content[0] === "*") {
            var item = content.substring(1);
            
            if (isNaN(parseInt(item, 10)) === false && parseInt(item, 10) > 0) {
                player.gold += parseInt(item, 10);
                rpgbot.sendMessage(src, "You found " + parseInt(item, 10) + " Gold!", rpgchan);
                return;
            }
            
            if (item in items) {
                if (!canHoldItems(player, getItemCount(player, item) + 1)) {
                    rpgbot.sendMessage(src, "You found a " + items[item].name + ", but you can't carry more than " + getItemLimit(player) + "!", rpgchan);
                    return;
                }
                rpgbot.sendMessage(src, "You found a " + items[item].name + "!", rpgchan);
                changeItemCount(player, item, 1);
                return;
            } else {
                rpgbot.sendMessage(src, "Nothing found!", rpgchan);
                return;
            }
        } else {
            var mob = content.split(":");
            var mobNames = {};
            var mobCount = {};
            for (var e in mob) {
                if (!(mob[e] in mobNames)) {
                    mobNames[mob[e]] = 0;
                    mobCount[mob[e]] = 0;
                }
                mobNames[mob[e]]++;
            }
            
            var m = [];
            for (e in mob) {
                if (mob[e] in monsters) {
                    if (mobNames[mob[e]] > 1) {
                        mobCount[mob[e]]++;
                        m.push(this.generateMonster(mob[e], mobCount[mob[e]]));
                    } else {
                        m.push(this.generateMonster(mob[e]));
                    }
                }
            }
            if (m.length === 0) {
                rpgbot.sendMessage(src, "Nothing found!", rpgchan);
                return;
            }
            
            var list;
            if (places[player.location].noParty !== true && player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                list = this.findParty(player.party).findMembersNear(src);
            } else {
                list = [[src], [player]];
            }
            
            if (list[0].length === 0 || list[1].length === 0) {
                rpgbot.sendMessage(src, "No one on your party can battle!", rpgchan);
                return;
            }
            this.startBattle(list[0], list[1], m);
        }
    };

    this.challengePlayer = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        if (SESSION.users(src).rpg.hp === 0) {
            rpgbot.sendMessage(src, "You are dead! Type /revive to respawn!", rpgchan);
            return;
        }
        if (SESSION.users(src).rpg.isBattling === true) {
            rpgbot.sendMessage(src, "You are already battling! Finish this battle before you challenge someone!", rpgchan);
            return;
        }
        if (commandData === "*" && duelChallenges[player.name] !== undefined) {
            rpgbot.sendMessage(src, "You cancelled your challenge!", rpgchan);
            duelChallenges[player.name] = undefined;
            return;
        }
        var targetId = sys.id(commandData);
        if (targetId === undefined) {
            rpgbot.sendMessage(src, "No such player!", rpgchan);
            return;
        }
        if (targetId === src) {
            rpgbot.sendMessage(src, "You can't battle yourself!", rpgchan);
            return;
        }
        var opponent = SESSION.users(targetId).rpg;
        if (opponent === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        if (opponent.hp === 0) {
            rpgbot.sendMessage(src, "You can't challenge a dead person!", rpgchan);
            return;
        }
        if (opponent.location !== player.location) {
            rpgbot.sendMessage(src, "You must be at the same location of the person you want to challenge!", rpgchan);
            return;
        }
        var playerName = sys.name(src);
        var targetName = sys.name(targetId);
        
        duelChallenges[playerName] = targetName;
        if (duelChallenges[targetName] && duelChallenges[targetName] === playerName) {
            
            var team1, team2;
            
            if (player.party && opponent.party && player.party === opponent.party) {
                team1 = [[src], [player]];
                team2 = [[targetId], [opponent]];
            } else {
                if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                    team1 = this.findParty(player.party).findMembersNear(src);
                } else {
                    team1 = [[src], [player]];
                }
                
                if (opponent.party && this.findParty(opponent.party) && this.findParty(opponent.party).isMember(targetId)) {
                    team2 = this.findParty(opponent.party).findMembersNear(targetId);
                } else {
                    team2 = [[targetId], [opponent]];
                }
            }
            
            if (team1[0].length === 0 || team1[1].length === 0 || team2[0].length === 0 || team2[1].length === 0) {
                rpgbot.sendMessage(src, "Battle couldn't begin because one of the teams is not ready!", rpgchan);
                rpgbot.sendMessage(targetId, "Battle couldn't begin because one of the teams is not ready!", rpgchan);
                return;
            } else {
                var names1 = team1[1].map(getTeamNames, this);
                var names2 = team2[1].map(getTeamNames, this);
                
                sys.sendAll("", rpgchan);
                rpgbot.sendAll("A battle between " + readable(names1, "and") + " and " + readable(names2, "and") + " has begun!", rpgchan);
                this.startBattle(team1[0].concat(team2[0]), team1[1], team2[1]);
                sys.sendAll("", rpgchan);
                
                duelChallenges[playerName] = undefined;
                duelChallenges[targetName] = undefined;
            }
        } else {
            rpgbot.sendMessage(src, "You challenged " + targetName + " to a duel! If they accept your challenge, you will automatically start a battle!", rpgchan);
            rpgbot.sendMessage(targetId, "" + playerName + " has challenged you to a duel! To accept it, type /challenge " + playerName + "!", rpgchan);
        }
    };
    this.generateMonster = function(name, num) {
        var data = monsters[name.toLowerCase()];
        
        var monster = this.createChar(data);
        
        monster.name = data.name + (num ? " " + num : "");
        monster.id = name.toLowerCase();
        monster.exp = data.exp;
        monster.gold = data.gold;
        monster.loot = data.loot;
        monster.defenseElement = data.element || "none";
        monster.attackElement = "none";
        monster.isPlayer = false;
        monster.passives = data.passives || {};
        
        return monster;
    };
    this.startBattle = function(viewers, team1, team2) {
        var battle = new Battle(viewers, team1, team2);
        var names1 = [];
        var names2 = [];
        for (var p in team1) {
            names1.push(team1[p].name);
            if (team1[p].isPlayer) {
                team1[p].isBattling = true;
            }
        }
        for (p in team2) {
            names2.push(team2[p].name);
            if (team2[p].isPlayer) {
                team2[p].isBattling = true;
            }
        }
        
        battle.sendToViewers("A battle between " + readable(names1, "and") + " and " + readable(names2, "and") + " has started!");
        
        currentBattles.push(battle);
    };
    this.fleeBattle = function(src) {
        var player = SESSION.users(src).rpg;
        if (player.isBattling === false) {
            rpgbot.sendMessage(src, "You are not battling!", rpgchan);
            return;
        }
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You are dead!", rpgchan);
            return;
        }
        
        this.quitBattle(src);
    };
    this.quitBattle = function(src) {
        var player = SESSION.users(src).rpg;
        if (player.isBattling) {
            rpgbot.sendMessage(src, "You ran away from a battle!", rpgchan);
        }
        for (var b in currentBattles) {
            currentBattles[b].removePlayer(src);
        }
        player.isBattling = false;
        player.battle = {};
        player.bonus.battle = {
            str: 0,
            def: 0,
            spd: 0,
            dex: 0,
            mag: 0
        };
    };
    this.reviveSelf = function(src) {
        var player = SESSION.users(src).rpg;
        if (player.hp > 0) {
            rpgbot.sendMessage(src, "You are not even dead!", rpgchan);
            return;
        }
        if (player.isBattling === true) {
            this.quitBattle(src);
        }
        
        player.hp = Math.floor(player.maxhp / 2);
        
        sys.sendMessage(src, "", rpgchan);
        this.changeLocation(src, player.respawn, "respawned with " + player.hp + " HP at the");
        sys.sendMessage(src, "", rpgchan);
    };
    this.watchBattle = function(src, commandData) {
        var bat, b;
        if (commandData === "*") {
            var cancelView = false;
            for (b in currentBattles) {
                bat = currentBattles[b];
                var i = bat.viewers.indexOf(src);
                if (i !== -1) {
                    cancelView = true;
                    bat.sendToViewers(sys.name(src) + " stopped watching this battle!");
                    bat.viewers.splice(i, 1);
                }
            }
            if (!cancelView) {
                rpgbot.sendMessage(src, "Specify a player!", rpgchan);
            }
            return;
        } else if (commandData === "on") {
            rpgbot.sendMessage(src, "Other players can watch your battles!", rpgchan);
            SESSION.users(src).rpg.watchableBattles = true;
            return;
        } else if (commandData === "off") {
            rpgbot.sendMessage(src, "Other players can't watch your battles!", rpgchan);
            SESSION.users(src).rpg.watchableBattles = false;
            return;
        
        }
        var id = sys.id(commandData);
        if (id === undefined) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        if (SESSION.users(id).rpg === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        var target = SESSION.users(id).rpg;
        if (target.watchableBattles === false) {
            rpgbot.sendMessage(src, "You can't watch this person's battles!", rpgchan);
            return;
        }
        if (target.isBattling === false) {
            rpgbot.sendMessage(src, "This person is not battling!", rpgchan);
            return;
        }
        /* if (SESSION.users(src).rpg.location !== target.location) {
            rpgbot.sendMessage(src, "You must be in the same location as your target to watch their battles!", rpgchan);
            return;
        } */
        
        for (b in currentBattles) {
            bat = currentBattles[b];
            if (bat.viewers.indexOf(src) === -1 && (bat.team1.indexOf(target) !== -1 || bat.team2.indexOf(target) !== -1)) {
                bat.viewers.push(src);
                bat.sendToViewers(sys.name(src) + " is watching this battle!");
                return;
            }
        }
        rpgbot.sendMessage(src, "You can't watch any battle now!", rpgchan);
    };
    
    function Battle(viewers, teamA, teamB) {
        this.viewers = viewers;
        this.team1 = teamA;
        this.team2 = teamB;
        this.turn = 1;
        this.events = [];
        
        this.team1Exp = 0;
        this.team1Gold = 0;
        this.team2Exp = 0;
        this.team2Gold = 0;
        
        this.team1Focus = [];
        this.team2Focus = [];
        
        this.isPVP = false;
        
        this.colorNames = {};
        var p1 = false, p2 = false;
        var player;
        
        for (var p in this.team1) {
            if (this.team1[p].isPlayer) {
                p1 = true;
                player = this.team1[p];
                this.colorNames[player.name] = '<span style="font-weight:bold; color:' + sys.getColor(player.id) + ';">' + player.name + '</span>';
            }
        }
        for (p in this.team2) {
            if (this.team2[p].isPlayer) {
                p2 = true;
                player = this.team2[p];
                this.colorNames[player.name] = '<span style="font-weight:bold; color:' + sys.getColor(player.id) + ';">' + player.name + '</span>';
            }
        }
        
        this.colorOrder = Object.keys(this.colorNames).sort(function(a, b){
          return b.length - a.length; // ASC -> a - b; DESC -> b - a
        });
        
        if (p1 && p2) {
            this.isPVP = true;
        }
        
        this.names1 = this.team1.map(getTeamNames, this);
        this.names2 = this.team2.map(getTeamNames, this);
    }
    function getFullValue(p, att) {
        return p[att] + p.bonus.battle[att] + p.bonus.equip[att] + p.bonus.skill[att];
    }
    Battle.prototype.playNextTurn = function() {
        var out = ['', '<span style="font-weight:bold;">Turn: ' + this.turn + '</span>'];
        var team1 = this.team1;
        var team2 = this.team2;
        
        var priority = team1.concat(team2);
        priority.sort(function(a, b) { return getFullValue(b, "spd") - getFullValue(a, "spd"); });
        
        var totalDex = 0;
        for (var i = 0; i < priority.length; ++i) {
            if (priority[i].hp > 0) {
                totalDex += getFullValue(priority[i], "dex");
            }
        }
        var doubleAttackDex = Math.floor(totalDex / (priority.length + 1) * 2) + 1;
        var tripleAttackDex = Math.floor(totalDex * 0.75) + 1;
        var quadAttackDex = Math.floor(totalDex * 0.90) + 1;
        for (i = priority.length - 1; i >= 0; --i) {
            var d = Math.floor(getFullValue(priority[i], "dex") * getPassiveMultiplier(priority[i], "attackSpeed")) * (priority[i].battle.attackSpeed ? priority[i].battle.attackSpeed : 1);
            if (d >= doubleAttackDex && d >= 3) {
                priority.push(priority[i]);
                if (d >= tripleAttackDex) {
                    priority.push(priority[i]);
                    if (d >= quadAttackDex) {
                        priority.push(priority[i]);
                    }
                }
            }
        }
        
        var player, side, target, targets, castComplete, focusList;
        var effectsMessages;
        for (i = 0; i < priority.length; ++i) {
            player = priority[i];
            side = team1.indexOf(player) !== -1 ? 1 : 2;
            targets = [];
            focusList = [];
            castComplete = false;
            effectsMessages = {
                castBreak: [],
                defeated: [],
                targets: [],
                damaged: {},
                damagedNames: [],
                evaded: []
            };
            
            if (player.battle.delay) {
                if (player.battle.delay > 0) {
                    player.battle.delay--;
                    if (player.hp > 0) {
                        out.push(player.name + " can't move this turn!");
                    }
                    continue;
                } else {
                    player.battle.delay = null;
                }
            }
            
            if (player.battle.casting !== null && player.battle.casting >= 0) {
                player.battle.casting--;
                if (player.battle.casting > 0) {
                    if (player.hp > 0) {
                        out.push(player.name + " is preparing a move!");
                    }
                    continue;
                } else {
                    castComplete = true;
                }
            }
            
            if (player.hp > 0) {
                var moveName = (castComplete === true) ? player.battle.skillCasting : randomSample(player.strategy);
                var move = skills[moveName];
                var level = player.skills[moveName] - 1;
                
                var mpModifier = getPassiveMultiplier(player, "mpModifier");
                var targetTeam, n, added = 0;
                
                if (player.mp < Math.floor(move.cost * mpModifier)) {
                    out.push(player.name + " tried to use " + move.name + ", but didn't have enough Mana!");
                    player.battle.casting = null;
                    continue;
                }
                if (player.isPlayer === true && move.effect && "goldCost" in move.effect && player.gold < getLevelValue(move.effect.goldCost, level)) {
                    out.push(player.name + " tried to use " + move.name + ", but didn't have enough Gold!");
                    continue;
                }
                if (player.isPlayer === true && move.effect && "itemCost" in move.effect) {
                    if (typeof move.effect.itemCost === "string") {
                        if(hasItem(player, move.effect.itemCost, 1) === false) {
                            out.push(player.name + " tried to use " + move.name + ", but didn't have a " + items[move.effect.itemCost].name + "!");
                            continue;
                        }
                    } else {
                        var missingItems = [];
                        for (n in move.effect.itemCost) {
                            if(hasItem(player, n, move.effect.itemCost[n]) === false) {
                                missingItems.push(move.effect.itemCost[n] + " " + items[n].name + "(s)");
                            }
                        }
                        if (missingItems.length > 0) {
                            out.push(player.name + " tried to use " + move.name + ", but didn't have " + readable(missingItems, "and") + "!");
                            continue;
                        }
                    }
                    
                }
                
                if (!castComplete && "cast" in move) {
                    var cast = Math.round((move.cast + getPassiveValue(player, "castTime")) * getPassiveMultiplier(player, "castMultiplier"));
                    
                    if (cast > 0 || (cast === 0 && battleSetup.instantCast === false)) {
                        out.push(player.name + " is preparing to use " + skills[moveName].name + "!");
                        player.battle.casting = cast;
                        player.battle.skillCasting = moveName;
                        continue;
                    }
                } else {
                    player.battle.casting = null;
                }
                
                
                switch (move.target.toLowerCase()) {
                    case "self":
                        targets.push(player);
                        break;
                    case "party":
                        targetTeam = side === 1 ? shuffle(team1.concat()) : shuffle(team2.concat());
                        focusList = side === 1 ? shuffle(this.team1Focus.concat()) : shuffle(this.team2Focus.concat());
                        break;
                    case "enemy":
                        targetTeam = side === 1 ? shuffle(team2.concat()) : shuffle(team1.concat());
                        focusList = side === 1 ? shuffle(this.team2Focus.concat()) : shuffle(this.team1Focus.concat());
                        break;
                    case "all":
                        targetTeam = shuffle(team1.concat(team2));
                        focusList = shuffle(this.team1Focus.concat(this.team2Focus));
                        break;
                }
                
                var count = (move.targetCount) ? move.targetCount : 1;
                var hitDead = (move.hitDead) ? move.hitDead.toLowerCase() : "none";
                
                if (move.target.toLowerCase() !== "self") {
                    for (n = 0; n < focusList.length; ++n) {
                        if ((focusList[n].hp > 0 && hitDead === "none") || (hitDead === "any") || (focusList[n].hp === 0 && hitDead === "only")) {
                            targets.push(focusList[n]);
                            added++;
                        }
                    }
                    for (n = 0; n < targetTeam.length && added < count; ++n) {
                        if ((targetTeam[n].hp > 0 && hitDead === "none") || (hitDead === "any") || (targetTeam[n].hp === 0 && hitDead === "only")) {
                            targets.push(targetTeam[n]);
                            added++;
                        }
                    }
                }
                
                if (targets.length === 0) {
                    out.push(player.name + " tried to use " + move.name + ", but found no target!");
                    continue;
                }
                
                for (n in targets) {
                    if (effectsMessages.targets.indexOf(targets[n].name) === -1) {
                        effectsMessages.targets.push(targets[n].name);
                    }
                }
                
                if (move.effect && move.effect.multihit) {
                    var originalTargets = targets.concat();
                    var hits = getLevelValue(move.effect.multihit, level);
                    for (n = targets.length; n < hits; ++n) {
                        targets.push(originalTargets[n % originalTargets.length]);
                    }
                }
                
                player.mp -= Math.floor(move.cost * mpModifier);
                if (player.isPlayer === true && move.effect && "goldCost" in move.effect) {
                    player.gold -= getLevelValue(move.effect.goldCost, level);
                }
                if (player.isPlayer === true && move.effect && "itemCost" in move.effect) {
                    if (typeof move.effect.itemCost === "string") {
                        changeItemCount(player, move.effect.itemCost, -1);
                    } else {
                        for (n in move.effect.itemCost) {
                            changeItemCount(player, n, -move.effect.itemCost[n]);
                        }
                    }
                }
                
                var breakCast;
                for (var t = 0; t < targets.length; ++t) {
                    target = targets[t];
                    breakCast = false;
                    var damage = 0;
                    var critical = 1;
                    if ((hitDead === "none" && target.hp === 0) || (hitDead === "only" && target.hp > 0)) {
                        continue;
                    }
                    
                    if (move.type === "physical" || move.type === "magical") {
                        var acc = getFullValue(player, "dex") * ((move.effect && move.effect.accuracy) ? getLevelValue(move.effect.accuracy, level) : 1) * getEquipMultiplier(player, "accuracy") * getPassiveMultiplier(player, "accuracy") * (player.battle.accuracy ? player.battle.accuracy : 1);
                        var evd = getFullValue(target, "spd") * battleSetup.evasion * getEquipMultiplier(target, "evasion") * getPassiveMultiplier(target, "evasion") * (target.battle.evasion ? target.battle.evasion : 1);
                        if (acc <= 0) {
                            acc = 1;
                        }
                        if (evd <= 0) {
                            evd = 1;
                        }
                        var evadeCheck = 0.7 + ((acc - evd) / 100);
                        if (evadeCheck < 0.05) {
                            evadeCheck = 0.05;
                        } else if (evadeCheck > 0.095) {
                            evadeCheck = 0.95;
                        }
                        if (!(move.effect && move.effect.snipe && move.effect.snipe === true) && Math.random() > evadeCheck) {
                            if (effectsMessages.evaded.indexOf(target.name) === -1) {
                                effectsMessages.evaded.push(target.name);
                            }
                            if (move.effect && move.effect.chained && move.effect.chained === true) {
                                for (var v = t + 1; v < targets.length; ++v) {
                                    if (effectsMessages.evaded.indexOf(targets[v].name) === -1) {
                                        effectsMessages.evaded.push(targets[v].name);
                                    }
                                }
                                break;
                            } else {
                                continue;
                            }
                        }
                        
                        var power = 0;
                        if (move.effect && "attributeModifier" in move.effect) {
                            for (var m in move.effect.attributeModifier) {
                                if (["str", "def", "spd", "dex", "mag"].indexOf(m) !== -1) {
                                    power += getFullValue(player, m) * getLevelValue(move.effect.attributeModifier[m], level);
                                }
                            }
                        } else {
                            power = move.type === "physical" ? getFullValue(player, "str") : getFullValue(player, "mag");
                            if (power <= 0) {
                                power = 1;
                            }
                        }
                        power = power * getLevelValue(move.modifier, level) * battleSetup.damage;
                        
                        // Passive Skill that increases damage by consuming Gold
                        var goldDamageSkills = getPassiveByEffect(player, "goldDamage");
                        if (goldDamageSkills.length > 0) {
                            var goldUsed, goldLevel;
                            for (var g in goldDamageSkills) {
                                goldLevel = player.passives[goldDamageSkills[g]] - 1;
                                goldUsed = getLevelValue(skills[goldDamageSkills[g]].effect.goldDamage.cost, goldLevel);
                                if (player.gold >= goldUsed) {
                                    power += getLevelValue(skills[goldDamageSkills[g]].effect.goldDamage.modifier, goldLevel);
                                    player.gold -= goldUsed;
                                }
                            }
                        }
                        
                        var def = getFullValue(target, "def") * battleSetup.defense;
                        if (move.effect && move.effect.pierce) {
                            var pierce = move.effect.pierce;
                            if (pierce === true) {
                                pierce = 1;
                            } else if (pierce === false) {
                                pierce = 0;
                            }
                            def *= 1 - pierce;
                        }
                        if (def <= 0) {
                            def = 1;
                        }
                        
                        var atkElement = "none";
                        if (move.element && move.element !== "none") {
                            atkElement = move.element;
                        } else if (player.battle.atkElement) {
                            atkElement = player.battle.atkElement;
                        } else {
                            atkElement = player.attackElement;
                        }
                        
                        var defElement = "none";
                        if (target.battle.defElement) {
                            defElement = target.battle.defElement;
                        } else {
                            defElement = target.defenseElement;
                        }
                        
                        var element = 1;
                        if (atkElement in elements && defElement in elements[atkElement] && defElement !== "name") {
                            element = elements[atkElement][defElement];
                        }
                        
                        var main = move.type === "physical" ? getFullValue(player, "str") : getFullValue(player, "mag");
                        var invert = move.type === "physical" ? getFullValue(player, "mag") : getFullValue(player, "str");
                        main = main <= 0 ? 1 : main;
                        invert = invert <= 0 ? 1 : invert;
                        var varRange = (invert / main > 1 ? 1 : invert / main) * 0.25;
                        var variation = (0.75 + varRange) + (Math.random() * (0.25 - varRange));
                        
                        if (power < 0) {
                            critical = 1;
                        } else {
                            var critChance = (invert / main) * 0.66 * getEquipMultiplier(player, "critical") * getPassiveMultiplier(player, "critical") * (player.battle.critical ? player.battle.critical : 1);
                            critical = (Math.random() < critChance) ? battleSetup.critical : 1;
                        }
                        variation = (critical === battleSetup.critical) ? 1 : variation;
                        damage = Math.floor((power / def) * element * variation * critical) + (getLevelValue(move.modifier, level) > 0 ? 1 : -1);
                    } 
                    
                    if (move.effect) {
                        var duration = move.effect.duration ? getLevelValue(move.effect.duration, level) : 6;
                        var e;
                        
                        if (move.effect.target && (!move.effect.targetChance || Math.random() < getLevelValue(move.effect.targetChance, level))) {
                            if (!target.battle.counters) {
                                target.battle.counters = {};
                                target.battle.counters.overTime = {};
                                target.battle.hpdamage = {};
                                target.battle.mpdamage = {};
                            }
                            for (e in move.effect.target) {
                                if (e in target.bonus.battle) {
                                    target.bonus.battle[e] = getLevelValue(move.effect.target[e], level);
                                    target.battle.counters[e] = duration;
                                } else {
                                    switch (e) {
                                        case "mp":
                                            target.mp += getLevelValue(move.effect.target[e], level);
                                            break;
                                        case "hp":
                                            damage -= getLevelValue(move.effect.target[e], level);
                                            break;
                                        case "mpPercent":
                                            target.mp += Math.round(getLevelValue(move.effect.target[e], level) * target.maxmp);
                                            break;
                                        case "hpPercent":
                                            damage -= Math.round(getLevelValue(move.effect.target[e], level) * target.maxhp);
                                            break;
                                        case "hpdamage":
                                        case "mpdamage":
                                            target.battle.counters.overTime[moveName] = duration;
                                            target.battle[e][moveName] = getLevelValue(move.effect.target[e], level);
                                            break;
                                        case "accuracy":
                                        case "evasion":
                                        case "critical":
                                        case "attackSpeed":
                                            target.battle[e] = getLevelValue(move.effect.target[e], level);
                                            target.battle.counters[e] = duration;
                                            break;
                                        case "delay":
                                            target.battle.delay = getLevelValue(move.effect.target[e], level);
                                            break;
                                        case "attackElement":
                                        case "defenseElement":
                                            target.battle[e] = move.effect.target[e];
                                            target.battle.counters[e] = duration;
                                            break;
                                        case "focus":
                                            focusList = this.team1.indexOf(target) !== -1 ? this.team1Focus : this.team2Focus;
                                            if (focusList.indexOf(target) === -1) {
                                                focusList.push(target);
                                            }
                                            target.battle.counters[e] = duration;
                                            break;
                                        
                                    }
                                }
                            } 
                        }
                        if (move.effect.user && (!move.effect.userChance || Math.random() < getLevelValue(move.effect.userChance, level))) {
                            if (!player.battle.counters) {
                                player.battle.counters = {};
                                player.battle.counters.overTime = {};
                                player.battle.hpdamage = {};
                                player.battle.mpdamage = {};
                            }
                            for (e in move.effect.user) {
                                if (e in player.bonus.battle) {
                                    player.bonus.battle[e] = getLevelValue(move.effect.user[e], level);
                                    player.battle.counters[e] = duration;
                                } else {
                                    switch (e) {
                                        case "mp":
                                            player.mp += getLevelValue(move.effect.user[e], level);
                                            break;
                                        case "hp":
                                            player.hp += getLevelValue(move.effect.user[e], level);
                                            break;
                                        case "mpPercent":
                                            player.mp += Math.round(getLevelValue(move.effect.user[e], level) * player.maxmp);
                                            break;
                                        case "hpPercent":
                                            player.hp += Math.round(getLevelValue(move.effect.user[e], level) * player.maxhp);
                                            break;
                                        case "hpdamage":
                                        case "mpdamage":
                                            player.battle.counters.overTime[moveName] = duration;
                                            player.battle[e][moveName] = getLevelValue(move.effect.user[e], level);
                                            break;
                                        case "accuracy":
                                        case "evasion":
                                        case "critical":
                                        case "attackSpeed":
                                            player.battle[e] = getLevelValue(move.effect.user[e], level);
                                            player.battle.counters[e] = duration;
                                            break;
                                        case "delay":
                                            player.battle.delay = getLevelValue(move.effect.user[e], level);
                                            break;
                                        case "attackElement":
                                        case "defenseElement":
                                            player.battle[e] = move.effect.user[e];
                                            player.battle.counters[e] = duration;
                                            break;
                                        case "focus":
                                            focusList = side === 1 ? this.team1Focus : this.team2Focus;
                                            if (focusList.indexOf(player) === -1) {
                                                focusList.push(player);
                                            }
                                            player.battle.counters[e] = duration;
                                            break;
                                        
                                    }
                                }
                            }
                        }
                        if (target.battle.casting !== null && move.effect.breakCast && Math.random() < getLevelValue(move.effect.breakCast, level)) {
                            breakCast = true;
                            target.battle.casting = null;
                            target.battle.skillCasting = null;
                            if (effectsMessages.castBreak.indexOf(target.name) === -1) {
                                effectsMessages.castBreak.push(target.name);
                            }
                        }
                        if (damage > 0) {
                            if (move.effect.hpabsorb) {
                                player.hp += Math.floor(damage * getLevelValue(move.effect.hpabsorb, level));
                            }
                            if (move.effect.mpabsorb) {
                                player.mp += Math.floor(damage * getLevelValue(move.effect.mpabsorb, level));
                            }
                            if (hasEquipEffect(player, "hpabsorb")) {
                                player.hp += Math.floor(damage * getEquipMultiplier(player, "hpabsorb"));
                            }
                            if (hasEquipEffect(player, "mpabsorb")) {
                                player.mp += Math.floor(damage * getEquipMultiplier(player, "mpabsorb"));
                            }
                        }
                    }
                    
                    target.hp -= damage;
                    
                    if (damage !== 0) {
                        if (!(target.name in effectsMessages.damaged)) {
                            effectsMessages.damaged[target.name] = [];
                        }
                        effectsMessages.damaged[target.name].push("<b>" + (damage < 0 ? "+" : "") + (-damage) + (critical === battleSetup.critical ? "*" : "") + "</b>");
                    }
                    
                    if (player.hp <= 0) {
                        player.hp = 0;
                        if (effectsMessages.defeated.indexOf(player.name) === -1) {
                            effectsMessages.defeated.push(player.name);
                        }
                    } else if (player.hp > player.maxhp) {
                        player.hp = player.maxhp;
                    }
                    if (player.mp < 0) {
                        player.mp = 0;
                    } else if (player.mp > player.maxmp) {
                        player.mp = player.maxmp;
                    }
                    if (target.hp <= 0) {
                        target.hp = 0;
                        if (effectsMessages.defeated.indexOf(target.name) === -1) {
                            effectsMessages.defeated.push(target.name);
                        }
                    } else if (target.hp > target.maxhp) {
                        target.hp = target.maxhp;
                    }
                    if (target.mp < 0) {
                        target.mp = 0;
                    } else if (target.mp > target.maxmp) {
                        target.mp = target.maxmp;
                    }
                }
                 
                
                for (var dam in effectsMessages.damaged) {
                    effectsMessages.damagedNames.push(dam + " (" + effectsMessages.damaged[dam].map(getNumberSign).join(", ") + " HP)");
                }
                
                if (moveName === "attack" && player.isPlayer === true && player.equips.rhand && player.equips.rhand !== null && items[player.equips.rhand].message) {
                    out.push(items[player.equips.rhand].message.replace(/~User~/g, player.name).replace(/~Target~/g, readable(effectsMessages.targets, "and")) + (effectsMessages.damagedNames.length > 0 ? " " + readable(effectsMessages.damagedNames, "and") + "!" : "") + (effectsMessages.evaded.length > 0 ? " " + readable(effectsMessages.evaded, "and") + " evaded!" : ""));
                } else {
                    out.push(move.message.replace(/~User~/g, player.name).replace(/~Target~/g, readable(effectsMessages.targets, "and")) + (effectsMessages.damagedNames.length > 0 ? " " + readable(effectsMessages.damagedNames, "and") + "!" : "") + (effectsMessages.evaded.length > 0 ? " " + readable(effectsMessages.evaded, "and") + " evaded!" : ""));
                }
                
                if (effectsMessages.castBreak.length > 0) {
                    out.push(readable(effectsMessages.castBreak, "and") + "'s concentration was broken!");
                }
                
                if (effectsMessages.defeated.length > 0) {
                    out.push(readable(effectsMessages.defeated, "and") + (effectsMessages.defeated.length > 1 ? " were" : " was") + " defeated!");
                }
            }
        }
        
        // Turn Events here
        var battlers = team1.concat(team2);
        var buffs, b, o, overTime;
        var translations = {
            str: "Strength",
            def: "Defense",
            spd: "Speed",
            dex: "Dexterity",
            mag: "Magic",
            attackElement: "Weapon's element",
            defenseElement: "Armor's element",
            accuracy: "Accuracy",
            evasion: "Evasion",
            critical: "Critical Hit rate",
            attackSpeed: "Attack Speed"
        };
        function translateAtt(x) { return translations[x]; }
        for (i = 0; i < battlers.length; ++i) {
            player = battlers[i];
            buffs = [];
            var hpGain = getPassiveValue(player, "hpdamage");
            var mpGain = getPassiveValue(player, "mpdamage");
            if (player.battle.counters) {
                for (b in player.battle.counters) {
                    if (b === "overTime") {
                        overTime = player.battle.counters.overTime;
                        for (o in overTime) {
                            if (overTime[o] > 0) {
                                overTime[o]--;
                                if (o in player.battle.hpdamage && player.hp > 0) {
                                    hpGain += player.battle.hpdamage[o];
                                }
                                if (o in player.battle.mpdamage && player.hp > 0) {
                                    mpGain += player.battle.mpdamage[o];
                                }
                            }
                        }
                    } else {
                        if (player.battle.counters[b] > 0) {
                            player.battle.counters[b]--;
                            if (b in player.bonus.battle && player.battle.counters[b] <= 0) {
                                player.bonus.battle[b] = 0;
                                if (player.hp > 0) {
                                    buffs.push(b);
                                }
                            } else if (b === "attackElement" && player.battle.counters[b] <= 0) {
                                player.battle.attackElement = null;
                                buffs.push(b);
                            } else if (b === "defenseElement" && player.battle.counters[b] <= 0) {
                                player.battle.defenseElement = null;
                                buffs.push(b);
                            } else if (b === "focus" && player.battle.counters[b] <= 0) {
                                focusList = this.team1.indexOf(player) !== - 1 ? this.team1Focus : this.team2Focus;
                                focusList.splice(focusList.indexOf(player), 1);
                            } else if ((b === "accuracy" || b === "evasion" || b === "critical" || b === "attackSpeed") && player.battle.counters[b] <= 0) {
                                player.battle[b] = 1;
                                if (player.hp > 0) {
                                    buffs.push(b);
                                }
                            }
                        }
                    }
                }
                if (buffs.length > 0) {
                    out.push(player.name + "'s " + readable(buffs.map(translateAtt) , "and") + " " + (buffs.length > 1 ? "are" : "is") + " back to normal.");
                }
            }
            var gained = [];
            var lost = [];
            if (mpGain !== 0 && player.hp > 0) {
                player.mp += mpGain;
                
                if (player.mp < 0) {
                    player.mp = 0;
                } else if (player.mp > player.maxmp) {
                    player.mp = player.maxmp;
                }
                
                if (mpGain > 0) {
                    gained.push(mpGain + " Mana");
                } else {
                    lost.push(Math.abs(mpGain) + " Mana");
                }
            }
            if (hpGain !== 0 && player.hp > 0) {
                player.hp += hpGain;
                
                if (player.hp < 0) {
                    player.hp = 0;
                } else if (player.hp > player.maxhp) {
                    player.hp = player.maxhp;
                }
                
                if (hpGain > 0) {
                    gained.push(hpGain + " HP");
                } else {
                    lost.push(Math.abs(hpGain) + " HP");
                }
            }
            
            if (gained.length > 0 || lost.length > 0) {
                var gainmsg = [];
                if (gained.length > 0) {
                    gainmsg.push("gained " + readable(gained, "and"));
                }
                if (lost.length > 0) {
                    gainmsg.push("lost " + readable(lost, "and"));
                }
                var finalGain = [];
                if (hpGain !== 0) {
                    finalGain.push(player.hp + " HP");
                }
                if (mpGain !== 0) {
                    finalGain.push(player.mp + " Mana");
                }
                
                out.push(player.name  + " " + readable(gainmsg, "and") + " and now has " + readable(finalGain, "and") + "!");
            }
        }
        out.push("⇛ " + this.team2.map(getPlayerHP).join(", "));
        out.push("⇛ " + this.team1.map(getPlayerHP).join(", "));
        this.sendToViewers(out);
        var winner = this.checkWin();
        if (winner !== null) {
            this.finishBattle(winner);
        }
        this.turn++;
    };
    function getPlayerHP(x) {
        return x.name + " (" + x.hp + " HP, " + x.mp + " MP)";
    }
    function getNumberSign(x) { 
        return (x >= 0 ? "+" + x : x); 
    }
    Battle.prototype.checkWin = function() {
        var defeated1 = true;
        var defeated2 = true;
        var winner = null;
        
        //Check if team1 was defeated
        for (var o in this.team1) {
            if (this.team1[o].hp > 0) {
                defeated1 = false;
                break;
            }
        }
        
        //Check if team2 was defeated
        for (o in this.team2) {
            if (this.team2[o].hp > 0) {
                defeated2 = false;
                break;
            }
        }
        
        if (defeated1 || defeated2) {
            if (defeated1 && defeated2) {
                winner = 0;
            } else if (!defeated1 && defeated2) {
                winner = 1;
            } else if (defeated1 && !defeated2) {
                winner = 2;
            }
        }
        
        return winner;
    };
    Battle.prototype.sendToViewers = function(msg) {
        var size, v, viewer, reg;
        
        if (typeof msg === "string") { 
            msg = [msg];
        }
        msg = msg.map(function(x) { return (x === "" ? "" : "<timestamp/>" + x); } ).join("<br/>");
        
        for (v in this.colorOrder) {
            reg = new RegExp("\\b" + this.colorOrder[v], "g");
            msg = msg.replace(reg, this.colorNames[this.colorOrder[v]]);
        }
        
        for (v in this.viewers) {
            viewer = this.viewers[v];
            size = SESSION.users(viewer).rpg.fontSize || 11;
            sys.sendHtmlMessage(viewer, '<span style="font-size:' + size + 'px;">' + msg + '</span>', rpgchan);
        }
    };
    Battle.prototype.finishBattle = function(win) {
        var winner = (win === 1) ? this.team1 : this.team2;
        var loser = (win === 1) ? this.team2 : this.team1;
        
        var winNames = winner.map(getTeamNames, this);
        var loseNames = loser.map(getTeamNames, this);
        
        if (this.isPVP) {
            if (win === 0) {
                rpgbot.sendAll("The battle between " + readable(winNames, "and") + " and " + readable(loseNames, "and") + " ended in a draw!", rpgchan);
            } else {
                winNames = (win === 1) ? this.names1 : this.names2;
                loseNames = (win === 1) ? this.names2 : this.names1;
                
                rpgbot.sendAll(readable(winNames, "and") + " defeated " + readable(loseNames, "and") + "!", rpgchan);
            }
        } else {
            if (win === 0) {
                this.sendToViewers("The battle between " + readable(winNames, "and") + " and " + readable(loseNames, "and") + " ended in a draw!");
            } else {
                this.sendToViewers(readable(winNames, "and") + " defeated " + readable(loseNames, "and") + "!");
            }
        }
        
        var gold = 0;
        var monsterExp = 0;
        var playerExp = 0;
        
        if (win === 0) {
            loser = loser.concat(winner);
        } else {
            gold += (win === 1) ? this.team2Gold : this.team1Gold;
            playerExp += (win === 1) ? this.team2Exp : this.team1Exp;
        }
        
        for (var p in loser) {
            var lost = loser[p];
            if (lost.isPlayer) {
                if (!places[lost.location].noGoldLoss || places[lost.location].noGoldLoss !== true) {
                    rpgbot.sendMessage(lost.id, "You lost " + Math.floor(lost.gold * 0.1) + " Gold!", rpgchan);
                    lost.gold = Math.floor(lost.gold * 0.9);
                }
            } else {
                if (lost.gold) {
                    gold += Math.floor(lost.gold);
                }
                if (lost.exp) {
                    monsterExp += Math.floor(lost.exp);
                }
            }
        }
        
        if (win !== 0) {
            gold = Math.floor(gold / winner.length);
            monsterExp = Math.floor(monsterExp / winner.length);
            // playerExp = Math.floor(playerExp / winner.length);
            playerExp = 0;
            
            var l, m, loot, gainedExp, gainedGold;
            for (p in winner) {
                var won = winner[p];
                if (won.isPlayer) {
                    var lootFound = {};
                    for (l in loser) {
                        m = loser[l];
                        if (m.isPlayer === false) {
                            for (var c in won.hunted) {
                                if (m.id in won.hunted[c]) {
                                    won.hunted[c][m.id] += 1;
                                }
                            }
                            if (!(m.id in won.defeated)) {
                                won.defeated[m.id] = 0;
                            }
                            won.defeated[m.id]++;
                            if (m.loot) {
                                loot = randomSample(m.loot);
                                if (loot !== "none") {
                                    if (canHoldItems(getItemCount(won, loot) + 1)) {
                                        changeItemCount(won, loot, 1);
                                        if (!(loot in lootFound)) {
                                            lootFound[loot] = 0;
                                        }
                                        lootFound[loot]++;
                                    }
                                }
                            }
                        }
                    }
                    if (Object.keys(lootFound).length > 0) {
                        var itemsFound = [];
                        for (l in lootFound) {
                            itemsFound.push(lootFound[l] + " " + items[l].name + (lootFound[l] > 1 ? "(s)" : ""));
                        }
                        rpgbot.sendMessage(won.id, "You found " + readable(itemsFound, "and") + "!", rpgchan);
                    }
                    
                    var goldMultiplier = getPassiveMultiplier(won, "goldBonus");
                    gainedGold = Math.floor(gold * goldMultiplier);
                    if (gainedGold > 0) {
                        won.gold += gainedGold;
                    }
                    
                    var expMultiplier = getPassiveMultiplier(won, "expBonus");
                    gainedExp = Math.floor((monsterExp + Math.floor(playerExp / won.level)) * expMultiplier);
                    if (gainedExp > 0 || gainedGold > 0) {
                        rpgbot.sendMessage(won.id, "You received " + (gainedExp > 0 ? gainedExp + " Exp. Points" : "") + (gainedExp > 0 && gainedGold > 0 ? " and " : "") + (gainedGold > 0 ? gainedGold + " Gold" : "") + "!", rpgchan);
                    }
                    if (gainedExp > 0) {
                        game.receiveExp(won.id, gainedExp);
                    }
                }
            }
        }
        this.destroyBattle();
    };
    Battle.prototype.removePlayer = function(src) {
        var name = SESSION.users(src).rpg.name;
        var found = false;
        for (var s in this.team1) {
            if (this.team1[s].name === name) {
                this.team1.splice(s, 1);
                found = true;
                break;
            }
        }
        for (s in this.team2) {
            if (this.team2[s].name === name) {
                this.team2.splice(s, 1);
                found = true;
                break;
            }
        }
        if (found) {
            var player = SESSION.users(src).rpg;
            if (player.hp === 0 || this.isPVP === true) {
                rpgbot.sendMessage(src, "You lost " + Math.floor(player.gold * 0.1) + " Gold!", rpgchan);
                player.gold = Math.floor(player.gold * 0.9);
            }
            this.sendToViewers(name + " ran away!");
            this.viewers.splice(this.viewers.indexOf(src), 1);
            
            if (this.team1.length === 0 || this.team2.length === 0) {
                this.sendToViewers("No opponents left!");
                if (this.isPVP === false) {
                    this.destroyBattle();
                    return;
                }
            } 
            
            var winner = this.checkWin();
            if (winner !== null) {
                this.finishBattle(winner);
            }
        }
    };
    Battle.prototype.destroyBattle = function(){
        var allPlayers = this.team1.concat(this.team2);
        for (var p in allPlayers) {
            if (allPlayers[p].isPlayer) {
                allPlayers[p].isBattling = false;
                allPlayers[p].battle = {};
                allPlayers[p].bonus.battle = {
                    str: 0,
                    def: 0,
                    spd: 0,
                    dex: 0,
                    mag: 0
                };
            }
        }
        currentBattles.splice(currentBattles.indexOf(this), 1);
    };
    
    function getTeamNames(x) {
        return x.name;
    }
    function getLevelValue(att, level) {
        if (Array.isArray(att)) {
            if (level < att.length) {
                return att[level];
            } else {
                return att[att.length - 1];
            }
        } else {
            return att;
        }
    }
    function hasEquipEffect(player, effect) {
        if (!player.isPlayer) {
            return false;
        }
        var e, it;
        for (e in player.equips) {
            it = player.equips[e];
            if (it !== null && "effect" in items[it] && effect in items[it].effect) {
                return true;
            }
        }
        return false;
    }
    function getEquipMultiplier(player, effect) {
        var multiplier = 1;
        if (!player.isPlayer) {
            return multiplier;
        }
        var e, it;
        for (e in player.equips) {
            it = player.equips[e];
            if (it !== null && "effect" in items[it] && effect in items[it].effect) {
                multiplier *= items[it].effect[effect];
            }
        }
        return multiplier;
    }
    function getPassiveMultiplier(player, effect) {
        var multiplier = 1;
        for (var s in player.passives) {
            if (skills[s].effect && effect in skills[s].effect) {
                multiplier *= getLevelValue(skills[s].effect[effect], player.passives[s] - 1);
            }
        }
        return multiplier;
    }
    function getPassiveValue(player, effect) {
        var v = 0;
        for (var s in player.passives) {
            if (skills[s].effect && effect in skills[s].effect) {
                v += getLevelValue(skills[s].effect[effect], player.passives[s] - 1);
            }
        }
        return v;
    }
    function getPassiveClasses(player, effect) {
        var list = [];
        var eff;
        for (var s in player.passives) {
            if (skills[s].effect && effect in skills[s].effect) {
                eff = skills[s].effect[effect];
                for (var e in eff) {
                    if (list.indexOf(eff[e]) === -1) {
                        list.push(eff[e]);
                    }
                }
            }
        }
        return list;
    }
    function getPassiveByEffect(player, effect) {
        var list = [];
        for (var s in player.passives) {
            if (skills[s].effect && effect in skills[s].effect) {
                list.push(s);
            }
        }
        return list;
    }
    function getEquipAttributes(item, hideSlot) {
        item = items[item];
        var result = [];
        if (!hideSlot || hideSlot === false) {
            result.push(item.slot === "2-hands" ? "Both Hands" : equipment[item.slot]);
        }
        if ("element" in item) {
            result.push(cap(item.element) + "-element");
        }
        if ("effect" in item) {
            var effect = item.effect;
            if ("maxhp" in effect) {
                result.push(getNumberSign(effect.maxhp) + " Max HP");
            }
            if ("maxmp" in effect) {
                result.push(getNumberSign(effect.maxmp) + " Max Mana");
            }
            if ("str" in effect) {
                result.push(getNumberSign(effect.str) + " Str");
            }
            if ("def" in effect) {
                result.push(getNumberSign(effect.def) + " Def");
            }
            if ("spd" in effect) {
                result.push(getNumberSign(effect.spd) + " Spd");
            }
            if ("dex" in effect) {
                result.push(getNumberSign(effect.dex) + " Dex");
            }
            if ("mag" in effect) {
                result.push(getNumberSign(effect.mag) + " Mag");
            }
            if ("multiplier" in effect) {
                if ("maxhp" in effect.multiplier) {
                    result.push((effect.multiplier.maxhp > 0 ? "+" : "") + (effect.multiplier.maxhp * 100) + "% Max HP");
                }
                if ("maxmp" in effect.multiplier) {
                    result.push((effect.multiplier.maxmp > 0 ? "+" : "") + (effect.multiplier.maxmp * 100) + "% Max Mana");
                }
                if ("str" in effect.multiplier) {
                    result.push((effect.multiplier.str > 0 ? "+" : "") + (effect.multiplier.str * 100) + "% Str");
                }
                if ("def" in effect.multiplier) {
                    result.push((effect.multiplier.def > 0 ? "+" : "") + (effect.multiplier.def * 100) + "% Def");
                }
                if ("spd" in effect.multiplier) {
                    result.push((effect.multiplier.spd > 0 ? "+" : "") + (effect.multiplier.spd * 100) + "% Spd");
                }
                if ("dex" in effect.multiplier) {
                    result.push((effect.multiplier.dex > 0 ? "+" : "") + (effect.multiplier.dex * 100) + "% Dex");
                }
                if ("mag" in effect.multiplier) {
                    result.push((effect.multiplier.mag > 0 ? "+" : "") + (effect.multiplier.mag * 100) + "% Mag");
                }
            }
            if ("accuracy" in effect) {
                result.push((effect.accuracy > 1 ? "+" : "") + Math.round((effect.accuracy-1) * 100) + "% Accuracy");
            }
            if ("evasion" in effect) {
                result.push((effect.evasion > 1 ? "+" : "") + Math.round((effect.evasion-1) * 100) + "% Evasion");
            }
            if ("critical" in effect) {
                result.push((effect.critical > 1 ? "+" : "") + Math.round((effect.critical-1) * 100) + "% Critical");
            }
        }
        return "[" + result.join(", ") + "]";
    }
    this.useItem = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        
        if (commandData === "*") {
            var out = [];
            
            this.viewItems(src, "all");
            
            out.push("Equipment:");
            for (var i in player.equips) {
                if (player.equips[i] !== null && !(player.equips[i] in items)) {
                    out.push(equipment[i] + ": Invalid item '" + player.equips[i] + "' found! Contact an RPG Admin to fix the issue!");
                } else {
                    out.push(equipment[i] + ": " + (player.equips[i] === null ? "Nothing" : items[player.equips[i]].name + " - " + items[player.equips[i]].info + " " + getEquipAttributes(player.equips[i], true)));
                }
            }
            
            out.push("");
            out.push("To use or equip an item, type /item itemName");
            out.push("");
            
            for (var x in out) {
                sys.sendMessage(src, out[x], rpgchan);
            }
            return;
        }
        
        var data = commandData.split(":");
        
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You can't use an item while dead!", rpgchan);
            return;
        }
        /* if (player.isBattling === true) {
            rpgbot.sendMessage(src, "You can't use items during a battle!", rpgchan);
            return;
        } */
        var it = data[0].toLowerCase();
        
        if (!hasItem(player, it, 1)) {
            if (it in altItems && hasItem(player, altItems[it], 1)) {
                it = altItems[it];
            } else {
                rpgbot.sendMessage(src, "You don't have this item!", rpgchan);
                return;
            }
        }
        
        var item = items[it];
        
        if (player.isBattling === true && "inBattle" in item && item.inBattle === false) {
            rpgbot.sendMessage(src, "You can't use this item while battling!", rpgchan);
            return;
        }
        
        if (item.type === "usable" && places[player.location].noUsable && places[player.location].noUsable === true) {
            rpgbot.sendMessage(src, "You can't use items here!", rpgchan);
            return;
        }
        
        if (data.length > 1 && data[1].toLowerCase() === "drop") {
            var amm = -1;
            if (data.length > 2 && isNaN(parseInt(data[2], 10)) === false) {
                amm = -parseInt(data[2], 10);
            }
            changeItemCount(player, it, amm);
            rpgbot.sendMessage(src, "You have dropped " + Math.abs(amm) + " " + item.name + "(s)!", rpgchan);
            return;
        }
        
        if (item.level > player.level) {
            rpgbot.sendMessage(src, "You need to be at least level " + item.level + " to use this item!", rpgchan);
            return;
        }
        
        if (canUseItem(player, it) === false) {
            rpgbot.sendMessage(src, "You can't use this item as " + classes[player.job].name + "!", rpgchan);
            return;
        }
        
        sys.sendMessage(src, "", rpgchan);
        if (item.type === "usable") {
            var startingHp = player.hp, startingMp = player.mp, hpGain = 0, mpGain = 0, dest;
            if (item.effect) {
                if ("hp" in item.effect) {
                    player.hp += item.effect.hp;
                    hpGain += item.effect.hp;
                }
                if ("mp" in item.effect) {
                    player.mp += item.effect.mp;
                    mpGain += item.effect.mp;
                }
                if ("hpPercent" in item.effect) {
                    player.hp += Math.round(player.maxhp * item.effect.hpPercent);
                    hpGain += Math.round(player.maxhp * item.effect.hpPercent);
                }
                if ("mpPercent" in item.effect) {
                    player.mp += Math.round(player.maxmp * item.effect.mpPercent);
                    mpGain += Math.round(player.maxmp * item.effect.mpPercent);
                }
                if (player.hp > player.maxhp) {
                    player.hp = player.maxhp;
                    hpGain = player.maxhp - startingHp;
                } else if (player.hp < 0) {
                    player.hp = 0;
                }
                if (player.mp > player.maxmp) {
                    player.mp = player.maxmp;
                    mpGain = player.maxmp - startingMp;
                } else if (player.mp < 0) {
                    player.mp = 0;
                }
                
                var p, r, loc;
                dest = [];
                if ("move" in item.effect) {
                    loc = item.effect.move;
                    loc = loc === "*" ? player.respawn : loc;
                    if (loc in places) {
                        player.location = loc;
                        
                        for (r in places[loc].access) {
                            p = places[loc].access[r];
                            if (!places[p].hide || places[p].hide !== true) {
                                dest.push(places[p].name + " (" + p + ")");
                            }
                        }
                        
                        if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                            this.findParty(player.party).broadcast(player.name + " moved to " + places[loc].name, src);
                        }
                    }
                } 
            }
            rpgbot.sendMessage(src, item.message.replace(/~Life~/g, player.hp).replace(/~Mana~/g, player.mp).replace(/~LifeGained~/g, Math.abs(hpGain)).replace(/~ManaGained~/g, Math.abs(mpGain)).replace(/~Place~/g, places[player.location].name), rpgchan);
            if (dest.length > 0) {
                rpgbot.sendMessage(src, places[player.location].welcome, rpgchan);
                rpgbot.sendMessage(src, "From here, you can go to " + readable(dest, "or"), rpgchan);
            }
            changeItemCount(player, it, -1);
        } else if (item.type === "equip") {
            var slot = item.slot;
            
            for (var s in player.equips) {
                if (player.equips[s] === it) {
                    this.removeEquip(src, it);
                    rpgbot.sendMessage(src, items[it].name + " unequipped!", rpgchan);
                    return;
                }
            }
            if (item.slot === "2-hands") {
                slot = "rhand";
                if (player.equips.lhand && player.equips.lhand !== null) {
                    rpgbot.sendMessage(src, items[player.equips.lhand].name + " unequipped!", rpgchan);
                    player.equips.lhand = null;
                }
            } else if ((item.slot === "rhand" || item.slot === "lhand") && player.equips.rhand !== null && items[player.equips.rhand].slot === "2-hands") {
                if (player.equips.rhand !== null) {
                    rpgbot.sendMessage(src, items[player.equips.rhand].name + " unequipped!", rpgchan);
                    player.equips.rhand = null;
                }
            }
            if (player.equips[slot] !== null) {
                rpgbot.sendMessage(src, items[player.equips[slot]].name + " unequipped!", rpgchan);
                player.equips[slot] = null;
            }
            rpgbot.sendMessage(src, items[it].name + " equipped!", rpgchan);
            player.equips[slot] = it;
            this.updateBonus(src);
        } else {
            rpgbot.sendMessage(src, "This item cannot be used!", rpgchan);
        }
    };
    this.viewItems = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        var out = [];
        
        var e, i, item, id, ordered, noCategory = true;
        var data = commandData.toLowerCase();
        
        var sortByName = function (a, b) {
            var tra = items[a].name;
            var trb = items[b].name;
            if (tra === trb) {
                return 0;
            } else if (tra < trb) {
                return -1;
            } else {
                return 1;
            }
        };
        
        var itemSource = player.items;
        
        try {
            ordered = data === "storage" ? Object.keys(player.storage).sort(sortByName) : Object.keys(player.items).sort(sortByName);
            if (data === "storage") {
                data = "all";
                itemSource = player.storage;
            }
        } catch (err) {
            rpgbot.sendMessage(src, "You have an invalid item, so you can't use this command! Contact an RPG admin for help.", rpgchan);
            return;
        }
        
        if (data === "all" || data === "*") {
            var types = {
                usable: [],
                equip: [],
                key: [],
                other: [],
                broken: []
            };
            
            for (i in ordered) {
                id = ordered[i];
                if (id in items) {
                    item = items[id];
                    switch (item.type) {
                        case "usable":
                            types.usable.push(itemSource[id] + "x " + item.name + " (" + id + "): " + item.info);
                            break;
                        case "equip":
                            types.equip.push(itemSource[id] + "x " + item.name + " (" + id + "): " + item.info + " " + getEquipAttributes(id));
                            break;
                        case "key":
                            types.key.push(itemSource[id] + "x " + item.name + " (" + id + "): " + item.info);
                            break;
                        default:
                            types.other.push(itemSource[id] + "x " + item.name + " (" + id + "): " + item.info);
                            break;
                    }
                } else {
                    types.broken.push(id + ": Unknown item. Contact an RPG admin to fix that.");
                }
            }
            
            if (types.equip.length > 0) {
                out.push("");
                out.push("Equipable Items:");
                for (i in types.equip) {
                    out.push(types.equip[i]);
                }
            }
            if (types.key.length > 0) {
                out.push("");
                out.push("Key Items:");
                for (i in types.key) {
                    out.push(types.key[i]);
                }
            }
            if (types.other.length > 0) {
                out.push("");
                out.push("Other Items:");
                for (i in types.other) {
                    out.push(types.other[i]);
                }
            }
            if (types.usable.length > 0) {
                out.push("");
                out.push("Usable Items:");
                for (i in types.usable) {
                    out.push(types.usable[i]);
                }
            }
            if (types.broken.length > 0) {
                out.push("");
                out.push("Broken Items:");
                for (i in types.broken) {
                    out.push(types.broken[i]);
                }
            }
            noCategory = false;
        } else if (data === "usable") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type === "usable") {
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info);
                }
            }
            noCategory = false;
        } else if (data === "equipment" || data === "equip") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type === "equip") {
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info + " " + getEquipAttributes(id));
                }
            }
            noCategory = false;
        } else if (data === "key") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type === "key") {
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info);
                }
            }
            noCategory = false;
        } else if (data === "other") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type !== "usable" && item.type !== "equip" && item.type !== "key") {
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info);
                }
            }
            noCategory = false;
        } else {
            for (e in equipment) {
                if (data === e || data === equipment[e].toLowerCase()) {
                    for (i in ordered) {
                        id = ordered[i];
                        item = items[id];
                        if (item.type === "equip" && (item.slot === e || ((e === "lhand" || e === "rhand") && item.slot === "2-hands"))) {
                            out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info + " " + getEquipAttributes(id));
                        }
                    }
                    noCategory = false;
                    break;
                }
            }
        }
        
        if (noCategory === true) {
            rpgbot.sendMessage(src, "No such item category! Valid categories are 'all', 'usable', 'equipment', 'key', 'other', " + readable(Object.keys(equipment).map(function(e){ return "'" + equipment[e].toLowerCase() + "'"; }), "or") + ".", rpgchan);
            return;
        }
        if (out.length === 0) {
            rpgbot.sendMessage(src, "You have no items in this category!", rpgchan);
            return;
        }
        
        sys.sendMessage(src, "", rpgchan);
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
        sys.sendMessage(src, "", rpgchan);
    };
    this.removeEquip = function(src, item) {
        var equips = SESSION.users(src).rpg.equips;
        
        for (var e in equips) {
            if (equips[e] === item) {
                equips[e] = null;
            }
        }
        this.updateBonus(src);
    };
    this.requestTrade = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        if (commandData === "*" && tradeRequests[player.name] !== undefined) {
            rpgbot.sendMessage(src, "You cancelled your trade request!", rpgchan);
            tradeRequests[player.name] = undefined;
            return;
        }
        if (player.level < leveling.trade) {
            rpgbot.sendMessage(src, "You must be at least level " + leveling.trade + " to trade!", rpgchan);
            return;
        }
        if (player.isBattling === true) {
            rpgbot.sendMessage(src, "You can't trade while battling!", rpgchan);
            return;
        }
        var data = commandData.split(":");
        if (data.length < 3) {
            rpgbot.sendMessage(src, "Incorrect formatting! Use /trade Player:ItemYouOffer:ItemYouWant to request a trade. You can also use itemName*amount to offer/ask for more than 1 item!", rpgchan);
            return;
        }
        var targetId = sys.id(data[0].toLowerCase());
        if (targetId === undefined) {
            rpgbot.sendMessage(src, "No such player!", rpgchan);
            return;
        }
        if (targetId === src) {
            rpgbot.sendMessage(src, "You can't trade with yourself!", rpgchan);
            return;
        }
        if (SESSION.users(targetId).rpg === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        
        var target = SESSION.users(targetId).rpg;
        if (target.isBattling === true) {
            rpgbot.sendMessage(src, "Wait for that person to finish their battle!", rpgchan);
            return;
        }
        if (tradeRequests[player.name] !== undefined) {
            rpgbot.sendMessage(src, "Finish or cancel your last offer before making another trade request!", rpgchan);
            return;
        }
        if (places[player.location].noTrade && places[player.location].noTrade === true) {
            rpgbot.sendMessage(src, "You can't make a trade in this area!", rpgchan);
            return;
        }
        if (player.location !== target.location) {
            rpgbot.sendMessage(src, "You must be in the same location as your target to request a trade!", rpgchan);
            return;
        }
        
        var itemOffered = data[1].toLowerCase();
        var itemWanted = data[2].toLowerCase();
        var amountOffered = 1;
        var amountWanted = 1;
        var tempSplit;
        
        if (isNaN(parseInt(itemOffered, 10)) === true) {
            tempSplit = itemOffered.split("*");
            itemOffered = tempSplit[0];
            if (tempSplit.length > 1 && isNaN(parseInt(tempSplit[1], 10)) === false) {
                amountOffered = parseInt(tempSplit[1], 10);
                if (amountOffered <= 0) {
                    rpgbot.sendMessage(src, "You need to offer at least one of this item!", rpgchan);
                    return;
                }
            }
            if (!(itemOffered in items)) {
                if (itemOffered in altItems) {
                    itemOffered = altItems[itemOffered];
                } else {
                    rpgbot.sendMessage(src, "The item " + itemOffered + " doesn't exist!", rpgchan);
                    return;
                }
            }
            if (!hasItem(player, itemOffered, amountOffered)) {
                rpgbot.sendMessage(src, "You don't have " + (amountOffered > 1 ? amountOffered + " of ": "") + "this item!", rpgchan);
                return;
            }
        } else {
            itemOffered = parseInt(itemOffered, 10);
        }
        if (isNaN(parseInt(itemWanted, 10)) === true) {
            tempSplit = itemWanted.split("*");
            itemWanted = tempSplit[0];
            if (tempSplit.length > 1 && isNaN(parseInt(tempSplit[1], 10)) === false) {
                amountWanted = parseInt(tempSplit[1], 10);
                if (amountWanted <= 0) {
                    rpgbot.sendMessage(src, "You need to ask for at least one of this item!", rpgchan);
                    return;
                }
            }
            if (!(itemWanted in items)) {
                if (itemWanted in altItems) {
                    itemWanted = altItems[itemWanted];
                } else {
                    rpgbot.sendMessage(src, "The item " + itemWanted + " doesn't exist!", rpgchan);
                    return;
                }
            }
        } else {
            itemWanted = parseInt(itemWanted, 10);
        }
        
        var playerName = player.name;
        var targetName = target.name;
        
        var offer = typeof itemOffered === "number" ? itemOffered + " Gold" : items[itemOffered].name + (amountOffered > 1 ? " (x" + amountOffered + ")": "");
        var wanted = typeof itemWanted === "number" ? itemWanted + " Gold" : items[itemWanted].name + (amountWanted > 1 ? " (x" + amountWanted + ")": "");
        
        tradeRequests[playerName] = [targetName, itemOffered, itemWanted, amountOffered, amountWanted];
        if (tradeRequests[targetName] && tradeRequests[targetName][0] === playerName) {
            var playerTrade = tradeRequests[playerName];
            var targetTrade = tradeRequests[targetName];
            if (playerTrade[1] === targetTrade[2] && playerTrade[2] === targetTrade[1] && playerTrade[3] === targetTrade[4] && playerTrade[4] === targetTrade[3]) {
                // Check if players have the items to be traded, and cancel the trade if any of them doesn't have it
                if (typeof itemOffered === "number" && player.gold < itemOffered) {
                    rpgbot.sendMessage(src, "Trade cancelled because you don't have " + itemOffered + " Gold!", rpgchan);
                    rpgbot.sendMessage(targetId, "Trade cancelled because " + playerName + " doesn't have " + itemOffered + " Gold!", rpgchan);
                    tradeRequests[playerName] = undefined;
                    tradeRequests[targetName] = undefined;
                    return;
                } else if (!canHoldItems(target, getItemCount(target, itemOffered) + amountOffered)) {
                    rpgbot.sendMessage(src, "Trade cancelled because " + targetName + " can't hold more than " + getItemLimit(target) + " " + itemOffered + "(s)!", rpgchan);
                    rpgbot.sendMessage(targetId, "Trade cancelled because you can't hold more than " + getItemLimit(target) + " " + itemOffered + "(s)!", rpgchan);
                    tradeRequests[playerName] = undefined;
                    tradeRequests[targetName] = undefined;
                    return;
                }
                if (typeof itemWanted === "number" && target.gold < itemWanted) {
                    rpgbot.sendMessage(targetId, "Trade cancelled because you don't have " + itemWanted + " Gold!", rpgchan);
                    rpgbot.sendMessage(src, "Trade cancelled because " + targetName + " doesn't have " + itemWanted + " Gold!", rpgchan);
                    tradeRequests[playerName] = undefined;
                    tradeRequests[targetName] = undefined;
                    return;
                } else if (!canHoldItems(player, getItemCount(player, itemWanted) + amountWanted)) {
                    rpgbot.sendMessage(targetId, "Trade cancelled because " + playerName + " can't hold more than " + getItemLimit(player) + " " + itemWanted + "(s)!", rpgchan);
                    rpgbot.sendMessage(src, "Trade cancelled because you can't hold more than " + getItemLimit(player) + " " + itemWanted + "(s)!", rpgchan);
                    tradeRequests[playerName] = undefined;
                    tradeRequests[targetName] = undefined;
                    return;
                }
                
                // Trade the items/gold
                if (typeof itemOffered === "number") {
                    player.gold -= itemOffered;
                    target.gold += itemOffered;
                } else {
                    changeItemCount(player, itemOffered, -amountOffered);
                    changeItemCount(target, itemOffered, amountOffered);
                }
                if (typeof itemWanted === "number") {
                    target.gold -= itemWanted;
                    player.gold += itemWanted;
                } else {
                    changeItemCount(target, itemWanted, -amountWanted);
                    changeItemCount(player, itemWanted, amountWanted);
                }
                
                rpgbot.sendMessage(src, "You traded your " + offer + " with " + targetName + "'s " + wanted + "!", rpgchan);
                rpgbot.sendMessage(targetId, "You traded your " + wanted + " with " + playerName + "'s " + offer + "!", rpgchan);
                
                tradeRequests[playerName] = undefined;
                tradeRequests[targetName] = undefined;
                
                if (typeof itemOffered === "string" && !hasItem(player, itemOffered, 1)) {
                    this.removeEquip(src, itemOffered);
                }
                if (typeof itemWanted === "string" && !hasItem(target, itemWanted, 1)) {
                    this.removeEquip(targetId, itemWanted);
                }
                this.saveGame(src);
                this.saveGame(targetId);
                
            } else {
                rpgbot.sendMessage(src, "You offered " + offer + " for " + targetName + "'s " + wanted + "!", rpgchan);
                rpgbot.sendMessage(targetId, playerName + " offered " + offer + " for your " + wanted + "! To accept it, use /accept " + sys.name(src) + ". To negotiate, use /trade " + sys.name(src) + ":" + itemWanted + (amountWanted > 1 ? "*" + amountWanted : "") + ":" + itemOffered + (amountOffered > 1 ? "*" + amountOffered : ""), rpgchan);
                
                rpgbot.sendMessage(src, "You and " + targetName + " didn't come to an agreement!", rpgchan);
                rpgbot.sendMessage(targetId, "You and " + playerName + " didn't come to an agreement!", rpgchan);
            }
        } else {
            rpgbot.sendMessage(src, "You offered " + offer + " for " + targetName + "'s " + wanted + "!", rpgchan);
            rpgbot.sendMessage(targetId, playerName + " offered " + offer + " for your " + wanted + "! To accept it, use /accept " + sys.name(src) + ". To negotiate, use  /trade " + sys.name(src) + ":" + itemWanted + (amountWanted > 1 ? "*" + amountWanted : "") + ":" + itemOffered + (amountOffered > 1 ? "*" + amountOffered : ""), rpgchan);
        }
    };
    this.acceptTrade = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        var targetId = sys.id(commandData);
        if (targetId === undefined) {
            rpgbot.sendMessage(src, "No such player!", rpgchan);
            return;
        }
        var target = SESSION.users(targetId).rpg;
        if (target === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        
        if (target.name in tradeRequests && tradeRequests[target.name] !== undefined && tradeRequests[target.name][0] === player.name) {
            var trade = tradeRequests[target.name];
            this.requestTrade(src, sys.name(targetId) + ":" + trade[2] + "*" + trade[4] + ":" + trade[1] + "*" + trade[3]);
        } else {
            rpgbot.sendMessage(src, "This person didn't offer you anything!", rpgchan);
        }
        
    };
    this.updateBonus = function(src) {
        var player = SESSION.users(src).rpg;
        
        player.maxhp = player.basehp;
        player.maxmp = player.basemp;
        
        player.bonus.equip.maxhp = 0;
        player.bonus.equip.maxmp = 0;
        player.bonus.equip.str = 0;
        player.bonus.equip.def = 0;
        player.bonus.equip.spd = 0;
        player.bonus.equip.dex = 0;
        player.bonus.equip.mag = 0;
        
        player.bonus.skill.maxhp = 0;
        player.bonus.skill.maxmp = 0;
        player.bonus.skill.str = 0;
        player.bonus.skill.def = 0;
        player.bonus.skill.spd = 0;
        player.bonus.skill.dex = 0;
        player.bonus.skill.mag = 0;
        
        var equip, s, x, skill, level;
        
        //Multiplier bonus from equipments and skills
        for (x in player.equips) {
            equip = player.equips[x];
            if (equip !== null) {
                equip = items[equip];
                if (equip.effect && equip.effect.multiplier) {
                    for (s in equip.effect.multiplier) {
                        if (s in player.bonus.equip) {
                            player.bonus.equip[s] += Math.floor(player[s] * equip.effect.multiplier[s]);
                        }
                    }
                }
            }
        }
        for (x in player.passives) {
            level = player.passives[x];
            if (level > 0) {
                skill = skills[x];
                if (skill.effect && skill.effect.multiplier) {
                    for (s in skill.effect.multiplier) {
                        if (s in player.bonus.skill) {
                            player.bonus.skill[s] += Math.floor(player[s] * (getLevelValue(skill.effect.multiplier[s], level - 1)));
                        }
                    }
                }
            }
        }
        
        //Regular bonus from equipments and skills
        for (x in player.equips) {
            equip = player.equips[x];
            if (equip !== null) {
                equip = items[equip];
                if (equip.effect) {
                    for (s in equip.effect) {
                        if (s !== "multiplier" && s in player.bonus.equip) {
                            player.bonus.equip[s] += equip.effect[s];
                        }
                    }
                }
            }
        }
        for (x in player.passives) {
            level = player.passives[x];
            if (level > 0) {
                skill = skills[x];
                if (skill.effect) {
                    for (s in skill.effect) {
                        if (s !== "multiplier" && s in player.bonus.skill) {
                            player.bonus.skill[s] += getLevelValue(skill.effect[s], level - 1);
                        }
                    }
                }
            }
        }
        
        player.maxhp += player.bonus.equip.maxhp + player.bonus.skill.maxhp;
        player.maxmp += player.bonus.equip.maxmp + player.bonus.skill.maxmp;
        if (player.maxhp <= 0) {
            player.maxhp = 1;
        }
        if (player.maxmp < 0) {
            player.maxmp = 0;
        }
        
        if (player.hp > player.maxhp) {
            player.hp = player.maxhp;
        }
        if (player.mp > player.maxmp) {
            player.mp = player.maxmp;
        }
        
        player.attackElement = "none";
        var passiveElements = getPassiveByEffect(player, "attackElement");
        if (passiveElements.length > 0) {
            player.attackElement = skills[passiveElements[0]].effect.attackElement;
        } else if (player.equips.rhand && player.equips.rhand !== null && items[player.equips.rhand].element) {
            player.attackElement = items[player.equips.rhand].element;
        }
        
        player.defenseElement = "none";
        if (getPassiveByEffect(player, "defenseElement").length > 0) {
            player.defenseElement = skills[getPassiveByEffect(player, "defenseElement")[0]].effect.defenseElement;
        } else {
            for (var f in equipment) {
                if (f !== "rhand" && player.equips[f] !== null && items[player.equips[f]].element) {
                    player.defenseElement = items[player.equips[f]].element;
                    break;
                }
            }
        }
        
    };
    this.storeItem = function(player, item, amount) {
        if (amount > 0) {
            if (hasItem(player, item, amount)) {
                changeItemCount(player, item, -amount);
                changeStorageCount(player, item, amount);
                return true;
            } 
        } else if (amount < 0) {
            if (item in player.storage && player.storage[item] >= (-amount)) {
                if (!canHoldItems(player, getItemCount(player, item) + (-amount))) {
                    return false;
                }
                changeStorageCount(player, item, amount);
                changeItemCount(player, item, -amount);
                return true;
            }
        }
        return false;
    };
    this.storeGold = function(player, amount) {
        if (amount > 0 && player.gold >= amount) {
            player.gold -= amount;
            player.bank += amount;
            return true;
        } else if (amount < 0 && player.bank >= -amount) {
            player.gold -= amount;
            player.bank += amount;
            return true;
        }
        return false;
    };
    function changeItemCount(player, item, amount) {
        if (!(item in player.items)) {
            player.items[item] = 0;
        }
        player.items[item] += amount;
        if (!canHoldItems(player, player.items[item])) {
            player.items[item] = getItemLimit(player);
        }
        if (player.items[item] <= 0) {
            game.removeEquip(player.id, item);
            delete player.items[item];
        }
    }
    function changeStorageCount(player, item, amount) {
        if (!(item in player.storage)) {
            player.storage[item] = 0;
        }
        player.storage[item] += amount;
        if (player.storage[item] <= 0) {
            delete player.storage[item];
        }
    }
    function hasItem(player, item, amount) {
        var count = amount || 1;
        if (!(item in player.items)) {
            return false;
        } else if (player.items[item] >= count) {
            return true;
        }
        return false;
    }
    function getItemCount(player, item) {
        if (!(item in player.items)) {
            return 0;
        } else {
            return player.items[item];
        }
    }
    function getItemLimit(player) {
        return leveling.items + player.level * leveling.itemsPerLevel;
    }
    function canHoldItems(player, amount) {
        if (leveling.items === 0 && leveling.itemsPerLevel === 0) {
            return true;
        }
        if (amount > leveling.items + player.level * leveling.itemsPerLevel) {
            return false;
        } else {
            return true;
        }
    }
    function canUseItem(player, it) {
        if (!("classes" in items[it])) {
            return true;
        } else {
            var item = items[it];
            if (item.classes.indexOf(player.job) === -1) {
                var allowedClasses = getPassiveClasses(player, "itemsFromClass");
                for (var c in item.classes) {
                    if (allowedClasses.indexOf(item.classes[c]) !== -1) {
                        return true;
                    }
                }
                return false;
            } else {
                return true;
            }
        }
    }
    
    this.receiveExp = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        player.exp += commandData;
        
        if (player.exp > expTable[expTable.length-1]) {
            player.exp = expTable[expTable.length-1];
        }
        
        var e;
		for (e = expTable.length; e >= 0; --e) {
			if (player.exp >= expTable[e - 1]) {
				e = e + 1;
				break;
			}
		}
        
        if (e > player.level) {
            var dif = e - player.level;
            player.statPoints += leveling.stats * dif;
            player.skillPoints += leveling.skills * dif;
            
            sys.sendAll("", rpgchan);
            rpgbot.sendAll(player.name + "'s Level increased from " + player.level + " to " + e + "!", rpgchan);
            sys.sendAll("", rpgchan);
            
            
            if (classes[player.job].growth) {
                var growth = classes[player.job].growth;
                var increased = {
                    maxhp: false,
                    maxmp: false,
                    str: false,
                    def: false,
                    spd: false,
                    dex: false,
                    mag: false
                };
                var translation = {
                    maxhp: "Maximum HP",
                    maxmp: "Maximum Mana",
                    str: "Strength",
                    def: "Defense",
                    spd: "Speed",
                    dex: "Dexterity",
                    mag: "Magic"
                };
                var i, g, inc;
                for (i = player.level; i < e; ++i) {
                    for (g in growth) {
                        inc = getLevelValue(growth[g], (player.level - 1) % growth[g].length);
                        if (g === "maxhp") {
                            if (leveling.maxhp > 0 && player.basehp + inc > leveling.maxhp) {
                                inc = leveling.maxhp - player.basehp;
                            }
                        } else if (g === "maxmp") {
                            if (leveling.maxmp > 0 && player.basemp + inc > leveling.maxmp) {
                                inc = leveling.maxmp - player.basemp;
                            }
                        } else {
                            if (leveling.maxstats > 0 && player[g] + inc > leveling.maxstats) {
                                inc = leveling.maxstats - player[g];
                            }
                        }
                        player[g] += inc;
                        if (g === "maxhp") {
                            player.basehp += inc;
                        } else if (g === "maxmp") {
                            player.basemp += inc;
                        }
                        if (inc > 0) {
                            increased[g] = true;
                        }
                    }
                    player.level++;
                }
                for (g in increased) {
                    if (increased[g] === true) {
                        rpgbot.sendMessage(src, translation[g] + " increased to " + player[g] + "!", rpgchan);
                    }
                }
                
            } else {
                player.level = e;
            }
            
        }
    };
    this.addPoint = function(src, commandData) {
        var data = commandData.split(":");
        
        if (commandData === "*") {
            rpgbot.sendMessage(src, "To increase an stat or skill, type /increase statName:amount or /increase skillName:amount.", rpgchan);
            return;
        }
        var player = SESSION.users(src).rpg;
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "Revive before using this command!", rpgchan);
            return;
        }
        
        var what = data[0].toLowerCase();
        var attributes = ["hp", "mana", "mp", "str", "strength", "def", "defense", "spd", "speed", "dex", "dexterity", "mag", "magic"];
        var amount;
        amount = data.length > 1 ? parseInt(data[1], 10) : 1;
        amount = isNaN(amount) ? 1 : amount;
        
        if (attributes.indexOf(what) !== -1) {
            if (player.statPoints <= 0) {
                rpgbot.sendMessage(src, "You have no stat points to increase!", rpgchan);
                return;
            }
            if (player.statPoints < amount) {
                rpgbot.sendMessage(src, "You don't have that many stat points!", rpgchan);
                return;
            }
            switch (what) {
                case "hp":
                    if (leveling.maxhp > 0 && player.basehp + leveling.hp * amount > leveling.maxhp) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxhp + "!", rpgchan);
                        return;
                    }
                    player.maxhp += leveling.hp * amount;
                    player.basehp += leveling.hp * amount;
                    player.hp += leveling.hp * amount;
                    rpgbot.sendMessage(src, "Maximum HP increased to " + player.basehp + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "mana":
                case "mp":
                    if (leveling.maxmp > 0 && player.basemp + leveling.mp * amount > leveling.maxmp) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxmp + "!", rpgchan);
                        return;
                    }
                    player.maxmp += leveling.mp * amount;
                    player.basemp += leveling.mp * amount;
                    player.mp += leveling.mp * amount;
                    rpgbot.sendMessage(src, "Maximum Mana increased to " + player.basemp + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "str":
                case "strength":
                    if (leveling.maxstats > 0 && player.str + amount > leveling.maxstats) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxstats + "!", rpgchan);
                        return;
                    }
                    player.str += 1 * amount;
                    rpgbot.sendMessage(src, "Strength increased to " + player.str + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "def":
                case "defense":
                    if (leveling.maxstats > 0 && player.def + amount > leveling.maxstats) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxstats + "!", rpgchan);
                        return;
                    }
                    player.def += 1 * amount;
                    rpgbot.sendMessage(src, "Defense increased to " + player.def + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "spd":
                case "speed":
                    if (leveling.maxstats > 0 && player.spd + amount > leveling.maxstats) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxstats + "!", rpgchan);
                        return;
                    }
                    player.spd += 1 * amount;
                    rpgbot.sendMessage(src, "Speed increased to " + player.spd + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "dex":
                case "dexterity":
                    if (leveling.maxstats > 0 && player.dex + amount > leveling.maxstats) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxstats + "!", rpgchan);
                        return;
                    }
                    player.dex += 1 * amount;
                    rpgbot.sendMessage(src, "Dexterity increased to " + player.dex + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                case "mag":
                case "magic":
                    if (leveling.maxstats > 0 && player.mag + amount > leveling.maxstats) {
                        rpgbot.sendMessage(src, "You can't have this stat above " + leveling.maxstats + "!", rpgchan);
                        return;
                    }
                    player.mag += 1 * amount;
                    rpgbot.sendMessage(src, "Magic increased to " + player.mag + "!", rpgchan);
                    player.statPoints -= amount;
                    break;
                default:
                    rpgbot.sendMessage(src, "You can only increase HP, Mana, Str, Def, Spd, Dex or Mag!", rpgchan);
                    return;
            }
            this.updateBonus(src);
        } else {
            if (player.skillPoints <= 0) {
                rpgbot.sendMessage(src, "You have no skill points to increase!", rpgchan);
                return;
            }
            if (player.skillPoints < amount) {
                rpgbot.sendMessage(src, "You don't have that many skill points!", rpgchan);
                return;
            }
            if (!(what in skills)) {
                if (what in altSkills) {
                    what = altSkills[what];
                } else {
                    rpgbot.sendMessage(src, "There's no such skill!", rpgchan);
                    return;
                }
            }
            if (leveling.skillFromOtherClass === false &&!(what in classes[player.job].skills)) {
                rpgbot.sendMessage(src, "You can only increase skills from your current class!", rpgchan);
                return;
            } 
            if (!(what in player.skills)) {
                rpgbot.sendMessage(src, "You can't learn this skill!", rpgchan);
                return;
            }
            if (skills[what].requisites) {
                var req = skills[what].requisites;
                if (req.level && player.level < req.level) {
                    rpgbot.sendMessage(src, "You need to be at least level " + req.level + " to learn this skill!", rpgchan);
                    return;
                }
                if (req.maxhp && player.maxhp < req.maxhp) {
                    rpgbot.sendMessage(src, "You need at least " + req.maxhp + " HP to learn this skill!", rpgchan);
                    return;
                }
                if (req.maxmp && player.maxmp < req.maxmp) {
                    rpgbot.sendMessage(src, "You need at least " + req.maxmp + " Mana to learn this skill!", rpgchan);
                    return;
                }
                if (req.str && player.str < req.str) {
                    rpgbot.sendMessage(src, "You need at least " + req.str + " Strength to learn this skill!", rpgchan);
                    return;
                }
                if (req.def && player.def < req.def) {
                    rpgbot.sendMessage(src, "You need at least " + req.def + " Defense to learn this skill!", rpgchan);
                    return;
                }
                if (req.spd && player.spd < req.spd) {
                    rpgbot.sendMessage(src, "You need at least " + req.spd + " Speed to learn this skill!", rpgchan);
                    return;
                }
                if (req.dex && player.dex < req.dex) {
                    rpgbot.sendMessage(src, "You need at least " + req.dex + " Dexterity to learn this skill!", rpgchan);
                    return;
                }
                if (req.mag && player.mag < req.mag) {
                    rpgbot.sendMessage(src, "You need at least " + req.mag + " Magic to learn this skill!", rpgchan);
                    return;
                }
                if (req.skill) {
                    for (var s in req.skill) {
                        if (!(s in player.skills) || player.skills[s] < req.skill[s]) {
                            rpgbot.sendMessage(src, "You need at least " + skills[s].name + " at level " + req.skill[s] + " to learn this skill!", rpgchan);
                            return;
                        }
                    }
                }
            }
            if (!(what in player.skills)) {
                player.skills[what] = 0;
            }
            if (player.skills[what] === skills[what].levels) {
                rpgbot.sendMessage(src, "This skill is already maxed!", rpgchan);
                return;
            }
            if (player.skills[what] + amount > skills[what].levels) {
                rpgbot.sendMessage(src, "You can't add that much skill points to this skill!", rpgchan);
                return;
            }
            player.skills[what] += amount;
            player.skillPoints -= amount;
            
            rpgbot.sendMessage(src, "You increased your " + skills[what].name + " skill to level " + player.skills[what] + "!", rpgchan);
        }
    };
    this.setBattlePlan = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Your current strategy is " + randomSampleText(player.strategy, function(x) { return skills[x].name; } ) + ".", rpgchan);
            rpgbot.sendMessage(src, "To set your strategy, type /plan skill:chance*skill:chance. You can also use /plan slots to save up to 3 strategies.", rpgchan);
            return;
        }

        var broken = commandData.split(" ");
        var action = "plan";
        var target;
        
        if (broken[0] === "slots") {
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 1 is " + randomSampleText(player.plans[0], function(x) { return skills[x].name; } ) + ".", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 2 is " + randomSampleText(player.plans[1], function(x) { return skills[x].name; } ) + ".", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 3 is " + randomSampleText(player.plans[2], function(x) { return skills[x].name; } ) + ".", rpgchan);
            rpgbot.sendMessage(src, "To save a strategy, use /plan set [slot] [strategy]. To load a saved strategy, use /plan load [slot].", rpgchan);
            sys.sendMessage(src, "", rpgchan);
            return;
        }
        
        if (broken.length > 1) {
            action = broken[0].toLowerCase();
            if (action === "load" || action === "set") {
                if (broken[1] !== "1" && broken[1] !== "2" && broken[1] !== "3") {
                    rpgbot.sendMessage(src, "No such slot! Type /plan slots to know how to set/load your strategies.", rpgchan);
                    return;
                }
                target = parseInt(broken[1], 10);
                if (broken.length > 3) {
                    commandData = [];
                    for (var b = 2; b < broken.length; ++b) {
                        commandData = commandData.concat(broken[b]);
                    }
                    commandData = commandData.join("");
                } else {
                    commandData = broken[2];
                }
                if (commandData === undefined && action === "set") {
                    rpgbot.sendMessage(src, "Incorrect format. Type /plan to know how to set your strategy!", rpgchan);
                    return;
                }
            }
        }
        
        if (action === "load") {
            if (player.plans[target-1]) {
                player.strategy = player.plans[target-1];
                rpgbot.sendMessage(src, "Loaded strategy " + randomSampleText(player.strategy, function(x) { return skills[x].name; } ) + ".", rpgchan);
            } else {
                rpgbot.sendMessage(src, "No plan set here!", rpgchan);
            }
            return;
        }
        
        var data = commandData.split("*");
        var obj = {};
        var skill;
        
        for (var s in data) {
            skill = data[s].split(":");
            if (skill.length < 2) {
                rpgbot.sendMessage(src, "Incorrect format. To set your strategy, type /plan skill:chance*skill:chance.", rpgchan);
                return;
            }
            var move = skill[0].toLowerCase();
            var chance = parseFloat(skill[1]);
            
            if (!(move in skills)) {
                if(move in altSkills) {
                    move = altSkills[move];
                } else {
                    rpgbot.sendMessage(src, "The skill '" + move + "' doesn't exist!", rpgchan);
                    return;
                }
            }
            if (!(move in player.skills) || player.skills[move] === 0) {
                rpgbot.sendMessage(src, "You haven't learned the skill '" + move + "'!", rpgchan);
                return;
            }
            
            if (skills[move].type === "passive") {
                rpgbot.sendMessage(src, "You can't set passive skills on your plan!", rpgchan);
                return;
            }
            
            if (typeof chance !== "number" || isNaN(chance) === true) {
                rpgbot.sendMessage(src, "Set a chance for the skill '" + move + "'!", rpgchan);
                return;
            }
            obj[move] = chance;
        }
        
        if (action === "set") {
            if (target === 1 || target === 2 || target === 3) {
                player.plans[target-1] = obj;
                rpgbot.sendMessage(src, "Saved strategy " + randomSampleText(obj, function(x) { return skills[x].name; } ) + " to slot " + target + "!", rpgchan);
            } else {
                rpgbot.sendMessage(src, "No such slot for strategies!", rpgchan);
            }
            return;
        } else {
            player.strategy = obj;
            rpgbot.sendMessage(src, "Your strategy was set to " + randomSampleText(obj, function(x) { return skills[x].name; } ) + "!", rpgchan);
        }
        
    };
    this.getBattlePlan = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        
        switch (commandData) {
            case "*":
                rpgbot.sendMessage(src, "Your current plan (raw): " + getPlanString(player.strategy), rpgchan);
                break;
            case "1":
                rpgbot.sendMessage(src, "Your saved plan 1 (raw): " + getPlanString(player.plans[0]), rpgchan);
                break;
            case "2":
                rpgbot.sendMessage(src, "Your saved plan 2 (raw): " + getPlanString(player.plans[1]), rpgchan);
                break;
            case "3":
                rpgbot.sendMessage(src, "Your saved plan 3 (raw): " + getPlanString(player.plans[2]), rpgchan);
                break;
            default:
                rpgbot.sendMessage(src, "No such slot!", rpgchan);
        }
    };
    this.setPassiveSkills = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNames(player.passives) + "!", rpgchan);
            rpgbot.sendMessage(src, "To change your current passive skills, type /passive skill1:skill2. To clear your passive skills, use '/passive clear'.", rpgchan);
            return;
        }
        
        var data = commandData.split(":");
        var obj = {};
        var skill, s;
        
        if (data.length > battleSetup.passive) {
            rpgbot.sendMessage(src, "You can only set up to " + battleSetup.passive + " passive skills!", rpgchan);
            return;
        }
        if (data[0].toLowerCase() === "clear") {
            player.passives = {};
            rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNames(player.passives) + "!", rpgchan);
        
            for (s in player.equips) {
                if (player.equips[s] !== null && canUseItem(player, player.equips[s]) === false) {
                    rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                    player.equips[s] = null;
                }
            }
            
            this.updateBonus(src);
            return;
        }
        for (s in data) {
            skill = data[s].toLowerCase();
            
            if (!(skill in skills)) {
                if(skill in altSkills) {
                    skill = altSkills[skill];
                } else {
                    rpgbot.sendMessage(src, "The skill '" + skill + "' doesn't exist!", rpgchan);
                    return;
                }
            }
            if (!(skill in player.skills) || player.skills[skill] === 0) {
                rpgbot.sendMessage(src, "You haven't learned the skill '" + skill + "'!", rpgchan);
                return;
            }
            
            if (skills[skill].type !== "passive") {
                rpgbot.sendMessage(src, skills[skill].name + " is not a passive skill!", rpgchan);
                return;
            }
            
            obj[skill] = player.skills[skill];
        }
        
        player.passives = obj;
        
        rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNames(player.passives) + "!", rpgchan);
        
        for (s in player.equips) {
            if (player.equips[s] !== null && canUseItem(player, player.equips[s]) === false) {
                rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                player.equips[s] = null;
            }
        }
        
        this.updateBonus(src);
    };
    function getSkillsNames(obj) {
        var list = [];
        for (var x in obj) {
            list.push(skills[x].name);
        }
        if (list.length === 0) {
            return "not set";
        }
        return readable(list, "and");
    }
    this.changePlayerClass = function(player, job) {
        if (job !== player.job) {
            player.job = job;
            
            for (var s in classes[job].skills) {
                if (!(s in player.skills)) {
                    player.skills[s] = classes[job].skills[s];
                }
            }
        
        }
    };
    function randomSampleText(obj, translator) {
        var total = 0, count = 0, list = [], s;
        for (s in obj) {
            total += obj[s];
            count++;
        }
        for (s in obj) {
            list.push(translator(s) + " [" + (total === 0 ? count/100 : (obj[s] / total * 100).toFixed(2)) + "%]");
        }
        // return readable(list, "or");
        return list.join(", ");
    }
    function getPlanString(obj) {
        var result = [];
        for (var e in obj) {
            result.push(e + ":" + obj[e]);
        }
        return result.join("*");
    }
    
    this.manageParty = function(src, commandData) {
        var player = SESSION.users(src).rpg;
        var party;
        
        if (player.party) {
            party = this.findParty(player.party);
            
            if (party) {
                if (party.members.indexOf(src) === -1) {
                    player.party = null;
                    rpgbot.sendMessage(src, "You have been removed from a party you weren't supposed to be in!", rpgchan);
                    return;
                }
            } else {
                player.party = null;
                rpgbot.sendMessage(src, "You have been removed from a ghost party!", rpgchan);
                return;
            }
        }
        
        if (commandData === "*") {
            if (player.party) {
                party = this.findParty(player.party);
                if (party) {
                    party.viewInfo(src);
                } else {
                    player.party = null;
                    rpgbot.sendMessage(src, "You have been removed from a ghost party!", rpgchan);
                }
            } else {
                rpgbot.sendMessage(src, "You are not in any party! You can use /party create:name to make your own party!", rpgchan);
            }
            return;
        }
        
        var data = commandData.split(":");
        var action = data[0];
        var target;
        
        if (data.length > 1) {
            target = data[1];
            if (target[0] === " ") {
                target = target.substring(1);
            }
        } else {
            target = "*";
        }
        
        if (player.party) {
            party = this.findParty(player.party);
            
            if (!party) {
                player.party = null;
                rpgbot.sendMessage(src, "You have been removed from a ghost party!", rpgchan);
                return;
            }
            
            switch (action) {
                case "kick":
                case "k":
                    party.kick(src, target);
                    break;
                case "leave":
                case "l":
                    party.leave(src, false);
                    break;
                case "invite":
                case "i":
                    party.invite(src, target);
                    break;
                case "leader":
                    party.changeLeader(src, target);
                    break;
                case "disband":
                    party.destroy(src);
                    break;
                default:
                    if (party.leader === src) {
                        rpgbot.sendMessage(src, "No such action. Valid Party commands are: ", rpgchan);
                        rpgbot.sendMessage(src, "/party leave or l (to leave your party)", rpgchan);
                        rpgbot.sendMessage(src, "/party invite:name or i:name (to invite someone to your party)", rpgchan);
                        rpgbot.sendMessage(src, "/party kick:name or k:name (to remove someone from your party)", rpgchan);
                        rpgbot.sendMessage(src, "/party leader:name (to pass leadership of your party to another member)", rpgchan);
                        rpgbot.sendMessage(src, "/party disband (to disband your party)", rpgchan);
                    } else {
                        rpgbot.sendMessage(src, "No such action. Valid Party commands are: /party leave or l (to quit your current party).", rpgchan);
                    }
                    break;
            
            }
        } else {
            switch (action) {
                case "create":
                case "c":
                    if (target === "*") {
                        rpgbot.sendMessage(src, "Choose a name for your party!", rpgchan);
                        return;
                    }
                    if (this.findParty(target) !== null) {
                        rpgbot.sendMessage(src, "This name is already used!", rpgchan);
                        return;
                    }
                    currentParties.push(new Party(src, target));
                    break;
                case "join":
                case "j":
                    party = this.findParty(target);
                    if (party) {
                        party.join(src);
                    } else {
                        rpgbot.sendMessage(src, "No such party!", rpgchan);
                    }
                    break;
                default: 
                    rpgbot.sendMessage(src, "No such action! Use '/party create:name' (or /p c:name) to make your own party, or '/party join:name' (or /p j:name) to join an existing party!", rpgchan);
                    break;
            }
        }
    };
    this.findParty = function(name) {
        for (var p in currentParties) {
            if (currentParties[p].name === name) {
                return currentParties[p];
            }
        }
        return null;
    };
    
    function Party(src, data) {
        this.name = data;
        this.members = [src];
        this.invites = [];
        this.leader = src;
        
        SESSION.users(src).rpg.party = this.name;
        
        sys.sendMessage(src, "", rpgchan);
        rpgbot.sendMessage(src, "You created a party! Use '/party invite:name' to recruit members!", rpgchan);
        rpgbot.sendMessage(src, "You can also use '/party kick' to remove a member, '/party leave' to quit your party and '/party disband' to break the party!", rpgchan);
        sys.sendMessage(src, "", rpgchan);
    }
    Party.prototype.destroy = function(src) {
        if (this.isLeader(src)) {
            this.broadcast(sys.name(src) + " has disbanded the party!");
            
            for (var p = this.members.length - 1; p >= 0; --p) {
                this.leave(this.members[p], true);
            }
            
            if (currentParties.indexOf(this) !== -1) {
                currentParties.splice(currentParties.indexOf(this), 1);
            }
        }
    };
    Party.prototype.leave = function(src, silent) {
        if (this.members.indexOf(src) !== -1) {
            if (silent === false) {
                this.broadcast(sys.name(src) + " left the party!");
            }
            
            this.members.splice(this.members.indexOf(src), 1);
            SESSION.users(src).rpg.party = null;
            
            if (silent === false) {
                this.fix();
            }
        }
        if (this.invites.indexOf(src) !== -1) {
            this.invites.splice(this.invites.indexOf(src), 1);
        }
        
    };
    Party.prototype.invite = function(src, target) {
        if (this.isLeader(src)) {
            if (sys.id(target) === undefined) {
                rpgbot.sendMessage(src, "No such person!", rpgchan);
                return;
            }
            var id = sys.id(target);
            if (SESSION.users(id).rpg === undefined) {
                rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
                return;
            }
            if (this.members.indexOf(id) !== -1) {
                rpgbot.sendMessage(src, "This person is already a member!", rpgchan);
                return;
            }
            if (this.invites.indexOf(id) !== -1) {
                rpgbot.sendMessage(src, "You removed the invite to " + sys.name(id) + "!", rpgchan);
                this.invites.splice(this.invites.indexOf(id), 1);
                return;
            }
            if (SESSION.users(id).rpg.party) {
                rpgbot.sendMessage(src, "This person is already in another party!", rpgchan);
                return;
            }
            if (this.members.length >= battleSetup.party) {
                rpgbot.sendMessage(src, "The party is already full!", rpgchan);
                return;
            }
            this.invites.push(id);
            rpgbot.sendMessage(id, sys.name(src) + " is inviting you to a party! To join, type /party join:" + this.name, rpgchan);
            rpgbot.sendMessage(src, "You invited " + sys.name(id) + " to the party!", rpgchan);
            
        }
    };
    Party.prototype.join = function(src) {
        if (this.invites.indexOf(src) !== -1) {
            if (this.members.length >= battleSetup.party) {
                rpgbot.sendMessage(src, "The party is already full!", rpgchan);
                return;
            }
            this.invites.splice(this.invites.indexOf(src), 1);
            this.members.push(src);
            SESSION.users(src).rpg.party = this.name;
            this.broadcast(sys.name(src) + " has joined the party!");
            this.fix();
        } else {
            rpgbot.sendMessage(src, "You haven't been invited to this party!", rpgchan);
        }
    };
    Party.prototype.kick = function(src, target) {
        if (this.isLeader(src)) {
            this.fix();
            if (sys.id(target) === undefined) {
                rpgbot.sendMessage(src, "No such person!", rpgchan);
                return;
            }
            var id = sys.id(target);
            if (this.members.indexOf(id) === -1) {
                rpgbot.sendMessage(src, "This person is not in your party!", rpgchan);
                return;
            }
            if (id === src) {
                rpgbot.sendMessage(src, "You can't kick yourself! Use /party leave if you wish to leave your party!", rpgchan);
                return;
            }
            this.broadcast(sys.name(src) + " kicked " + sys.name(id) + " from the party!");
            this.leave(id, true);
        }
    };
    Party.prototype.changeLeader = function(src, target) {
        if (this.isLeader(src)) {
            if (sys.id(target) === undefined) {
                rpgbot.sendMessage(src, "No such person!", rpgchan);
                return;
            }
            var id = sys.id(target);
            if (this.members.indexOf(id) === -1) {
                rpgbot.sendMessage(src, "This person is not in your party!", rpgchan);
                return;
            }
            if (id === src) {
                rpgbot.sendMessage(src, "You are already the leader!", rpgchan);
                return;
            }
            var index = this.members.indexOf(id);
            this.members.splice(index, 1);
            this.members.splice(0, 0, id);
            this.fix();
        }
    };
    Party.prototype.updateLeader = function() {
        if (this.leader !== this.members[0]) {
            this.leader = this.members[0];
            this.broadcast(sys.name(this.leader) + " is now the leader of the party!");
        }
    };
    Party.prototype.broadcast = function(msg, exclude) {
        for (var x in this.members) {
            if (exclude && this.members[x] === exclude) {
                continue;
            }
            rpgbot.sendMessage(this.members[x], "[Party] " + msg, rpgchan);
        }
    };
    Party.prototype.viewInfo = function(src) {
        this.fix();
        
        sys.sendMessage(src, "", rpgchan);
        rpgbot.sendMessage(src, "Your Party (" + this.name + "): ", rpgchan);
        for (var x = 0; x < this.members.length; ++x) {
            var player = SESSION.users(this.members[x]).rpg;
            rpgbot.sendMessage(src, player.name + (x === 0 ? " (Leader)" : "") + " [" + classes[player.job].name + " Lv. " + player.level + ", at " + places[player.location].name + (player.hp === 0 ? " (Dead)" : "") + "]", rpgchan);
        }
        sys.sendMessage(src, "", rpgchan);
    };
    Party.prototype.isMember = function(src) {
        return this.members.indexOf(src) !== -1;
    };
    Party.prototype.isLeader = function(src) {
        if (this.leader === src) {
            return true;
        } else {
            rpgbot.sendMessage(src, "Only the Party Leader can use this command!", rpgchan);
            return false;
        }
    };
    Party.prototype.findMembersNear = function(src) {
        this.fix();
        
        var player = SESSION.users(src).rpg;
        var loc = player.location;
        var battlers = [];
        var viewers = [];
        
        var id;
        var target;
        for (var p in this.members) {
            id = this.members[p];
            target = SESSION.users(id).rpg;
            if (target.location === loc && target.isBattling === false && target.hp > 0) {
                battlers.push(target);
                viewers.push(id);
            }
        }
        
        return [viewers, battlers];
    };
    Party.prototype.fix = function() {
        for (var p = this.members.length - 1; p >= 0; --p) {
            if (SESSION.users(this.members[p]) === undefined || SESSION.users(this.members[p]).rpg === undefined) {
                this.members.splice(p, 1);
            }
        }
        for (p = this.invites.length - 1; p >= 0; --p) {
            if (SESSION.users(this.invites[p]) === undefined || SESSION.users(this.invites[p]).rpg === undefined) {
                this.invites.splice(p, 1);
            }
        }
        if (this.members.length > 0) {
            this.updateLeader();
        } else {
            if (currentParties.indexOf(this) !== -1) {
                currentParties.splice(currentParties.indexOf(this), 1);
            }
        }
    };
    
    this.startGame = function(src, commandData) {
        var user = SESSION.users(src);
        
        if (!sys.dbRegistered(sys.name(src))) {
            rpgbot.sendMessage(src, "You need to register before starting a game!", rpgchan);
            return;
        }
        if (user.rpg !== undefined) {
            rpgbot.sendMessage(src, "You already have a character!", rpgchan);
            return;
        }
        if (startup.classes.indexOf(commandData.toLowerCase()) === -1) {
            rpgbot.sendMessage(src, "To create a character, type /start [class]. Possible classes are " + readable(startup.classes, "or") + ".", rpgchan);
            return;
        }
        
        var job = classes[commandData.toLowerCase()];
        user.rpg = this.createChar(job);
        
        var player = user.rpg;
        
        player.basehp = player.maxhp;
        player.basemp = player.maxmp;
        
        player.name = sys.name(src);
        player.level = 1;
        player.exp = 0;
        player.job = commandData.toLowerCase();
        
        player.statPoints = startup.stats;
        player.skillPoints = startup.skills;
        
        player.gold = startup.gold;
        player.bank = 0;
        player.items = {};
        for (var x in startup.items) {
            player.items[x] = startup.items[x];
        }
        player.storage = {};
        
        player.plans = [];
        player.plans.push(player.strategy);
        player.plans.push(player.strategy);
        player.plans.push(player.strategy);
        
        player.equips = {};
        for (x in equipment) {
            player.equips[x] = null;
        }
        
        player.attackElement = "none";
        player.defenseElement = "none";
        
        player.id = src;
        player.location = startup.location;
        player.respawn = startup.location;
        player.party = null;
        
        player.isPlayer = true;
        player.isBattling = false;
        player.version = charVersion;
        player.publicStats = false;
        player.watchableBattles = false;
        player.fontSize = 11;
        player.description = "";
        
        player.events = {};
        player.defeated = {};
        player.hunted = {};
        
        this.updateBonus(src);
        
        rpgbot.sendMessage(src, "Character successfully created!", rpgchan);
    };
    this.createChar = function(data) {
        var character = {};
        
        for (var e in data.stats) {
            if (data.stats[e] <= 0) {
                character[e] = 1;
            } else {
                character[e] = data.stats[e];
            }
        }
        character.maxhp = character.hp;
        character.maxmp = character.mp;
        character.skills = {};
        character.passives = {};
        for (e in data.skills) {
            character.skills[e] = data.skills[e];
        }
        character.strategy = {};
        for (e in data.strategy) {
            character.strategy[e] = data.strategy[e];
        }
        
        character.bonus = {
            battle: {
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            },
            equip: {
                maxhp: 0,
                maxmp: 0,
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            },
            skill: {
                maxhp: 0,
                maxmp: 0,
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            }
        };
        character.battle = {};
        
        return character;
    };
    this.saveGame = function(src, commandData) {
        var user = SESSION.users(src);
        
        if (user.rpg === null) {
            rpgbot.sendMessage(src, "You have no character to save!", rpgchan);
            return;
        }
        
        var savename = user.rpg.name.toLowerCase();
        var savefolder = "rpgsaves";
        
        /* if (!sys.dbRegistered(savename)) {
            rpgbot.sendMessage(src, "You need to register before saving your game!", rpgchan);
            return;
        } */
        
        if (user.rpg.isBattling) {
            rpgbot.sendMessage(src, "Finish this battle before saving your game!", rpgchan);
            return;
        }
        
        if (commandData !== undefined && commandData.toLowerCase() !== "sure") {
            var currentGame = sys.getFileContent(savefolder + "/" + escape(savename) + ".json");
            if (currentGame !== undefined && user.rpg.exp < JSON.parse(currentGame).exp) {
                rpgbot.sendMessage(src, "Warning: You already have a saved character with more Exp. Points! If you want to overwrite it, use '/savechar sure'.", rpgchan);
                return;
            }
        }
        
        sys.makeDir(savefolder);
        sys.writeToFile(savefolder + "/" + escape(savename) + ".json", JSON.stringify(user.rpg));
        
        rpgbot.sendMessage(src, "Game saved as " + savename + "! Use /loadchar to load your progress!", rpgchan);
    };
    this.loadGame = function(src) {
        var user = SESSION.users(src);
        if (user.rpg !== undefined) {
            rpgbot.sendMessage(src, "You already have a character loaded!", rpgchan);
            return;
        }
        
        var savename = sys.name(src).toLowerCase();
        
        if (!sys.dbRegistered(savename)) {
            rpgbot.sendMessage(src, "You need to register before loading a game!", rpgchan);
            return;
        }
        
        var savefolder = "rpgsaves";
        var content = sys.getFileContent(savefolder + "/" + escape(savename) + ".json");
        if (content === undefined) {
            rpgbot.sendMessage(src, "You haven't saved a game!", rpgchan);
            return;
        }
        
        var gamefile;
        try {
            gamefile = JSON.parse(content);
        }
        catch (err) {
            rpgbot.sendMessage(src, "Your game file is corrupted. Try contacting a channel staff for possible solutions.", rpgchan);
            return;
        }
        
        var playerson = sys.playerIds();
        for (var p in playerson) {
            if (SESSION.users(playerson[p]) && SESSION.users(playerson[p]).rpg && SESSION.users(playerson[p]).rpg.name &&  SESSION.users(playerson[p]).rpg.name.toLowerCase() === sys.name(src).toLowerCase()) {
                rpgbot.sendMessage(src, "This character is already being used!", rpgchan);
                return;
            }
        }
        
        gamefile = this.convertChar(gamefile);
        
        user.rpg = gamefile;
        user.rpg.id = src;
        user.rpg.party = null;
        rpgbot.sendMessage(src, "Your character has been loaded successfully!", rpgchan);
    };
    this.convertChar = function(gamefile) {
        var file = gamefile;
        
        var i;
        if (Array.isArray(file.items)) {
            var bag = {};
            for (i = 0; i < file.items.length; ++i) {
                if (!(file.items[i] in bag)) {
                    bag[file.items[i]] = 0;
                }
                bag[file.items[i]] += 1;
            }
            file.items = bag;
        }
        if (!("dex" in file)) {
            file.dex = classes[file.job].stats.dex;
            file.bonus.battle.dex = 0;
            file.bonus.equip.dex = 0;
            file.bonus.skill.dex = 0;
        }
        if(!("element" in file)) {
            file.element = "none";
        }
        if(!file.respawn) {
            file.respawn = startup.location;
        }
        if (!(file.basehp)) {
            file.basehp = file.maxhp - file.bonus.equip.maxhp - file.bonus.skill.maxhp;
        }
        if (!(file.basemp)) {
            file.basemp = file.maxmp - file.bonus.equip.maxmp - file.bonus.skill.maxmp;
        }
        
        var redoEquips = false;
        for (i in equipment) {
            if (!(i in file.equips)) {
                redoEquips = true;
                break;
            }
        }
        
        if (redoEquips) {
            file.maxhp -= file.bonus.equip.maxhp + file.bonus.skill.maxhp;
            file.maxmp -= file.bonus.equip.maxmp + file.bonus.skill.maxmp;
            
            if (file.hp > file.maxhp) {
                file.hp = file.maxhp;
            }
            if (file.mp > file.maxmp) {
                file.mp = file.maxmp;
            }
            
            file.bonus.equip.maxhp = 0;
            file.bonus.equip.maxmp = 0;
            file.bonus.equip.str = 0;
            file.bonus.equip.def = 0;
            file.bonus.equip.spd = 0;
            file.bonus.equip.dex = 0;
            file.bonus.equip.mag = 0;
            
            file.equips = {};
            for (i in equipment) {
                file.equips[i] = null;
            }
        }
        
        if (!file.events) {
            file.events = {};
        }
        if (!file.defeated) {
            file.defeated = {};
        }
        if (!file.hunted) {
            file.hunted = {};
        }
        if (!file.plans) {
            file.plans = [];
            file.plans.push(file.strategy);
            file.plans.push(file.strategy);
            file.plans.push(file.strategy);
        }
        if (!file.battle) {
            file.battle = {};
        }
        if (!file.passives) {
            file.passives = {};
        }
        for (i in classes[file.job].skills) {
            if (!(i in file.skills)) {
                file.skills[i] = classes[file.job].skills[i];
                if (skills[i].type === "passive" && classes[file.job].skills[i] > 0) {
                    file.passives[i] = classes[file.job].skills[i];
                }
            }
        }
        if (!file.publicStats) {
            file.publicStats = false;
        }
        if (!file.watchableBattles) {
            file.watchableBattles = false;
        }
        if(!file.fontSize) {
            file.fontSize = 11;
        }
        if (!file.description) {
            file.description = "";
        }
        
        if (!file.bank) {
            file.bank = 0;
        }
        if (!file.storage) {
            file.storage = {};
        }
        
        return file;
    };
    this.clearChar = function(src) {
        var user = SESSION.users(src);
        
        if (user.rpg.isBattling) {
            rpgbot.sendMessage(src, "Finish this battle first!", rpgchan);
            return;
        }
        
        this.removePlayer(src);
        
        user.rpg = undefined;
        rpgbot.sendMessage(src, "Character successfully cleared!", rpgchan);
    };
    this.resetChar = function(src) {
        var player = SESSION.users(src).rpg;
        
        if (player.isBattling) {
            rpgbot.sendMessage(src, "Finish this battle first!", rpgchan);
            return;
        }
        
        this.resetStats(src);
        this.resetSkills(src);
        rpgbot.sendMessage(src, "Stats/Skills reset!", rpgchan);
    };
    this.resetStats = function(src) {
        var player = SESSION.users(src).rpg;
        var data = classes[player.job];
        
        for (var e in data.stats) {
            player[e] = data.stats[e];
        }
        player.maxhp = player.hp;
        player.maxmp = player.mp;
        player.basehp = player.maxhp;
        player.basemp = player.maxmp;
        
        player.statPoints = startup.stats + leveling.stats * (player.level - 1);
        
        if (classes[player.job].growth) {
            var growth = classes[player.job].growth;
            var inc;
            for (var i = 1; i < player.level; ++i) {
                for (var g in growth) {
                    inc = getLevelValue(growth[g], (i - 1) % growth[g].length);
                    if (g === "maxhp") {
                        if (leveling.maxhp > 0 && player.basehp + inc > leveling.maxhp) {
                            inc = leveling.maxhp - player.basehp;
                        }
                    } else if (g === "maxmp") {
                        if (leveling.maxmp > 0 && player.basemp + inc > leveling.maxmp) {
                            inc = leveling.maxmp - player.basemp;
                        }
                    } else {
                        if (leveling.maxstats > 0 && player[g] + inc > leveling.maxstats) {
                            inc = leveling.maxstats - player[g];
                        }
                    }
                    
                    player[g] += inc;
                    if (g === "maxhp") {
                        player.basehp += inc;
                    } else if (g === "maxmp") {
                        player.basemp += inc;
                    }
                }
            }
        }
        
        player.equips = {};
        for (e in equipment) {
            player.equips[e] = null;
        }
        
        player.bonus = {
            battle: {
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            },
            equip: {
                maxhp: 0,
                maxmp: 0,
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            },
            skill: {
                maxhp: 0,
                maxmp: 0,
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            }
        };
        this.updateBonus(src);
        
    };
    this.resetSkills = function(src) {
        var player = SESSION.users(src).rpg;
        var data = classes[player.job];
        
        player.skills = {};
        for (var e in data.skills) {
            player.skills[e] = data.skills[e];
        }
        player.passives = {};
        player.strategy = {};
        for (e in data.strategy) {
            player.strategy[e] = data.strategy[e];
        }
        player.plans = [];
        player.plans.push(player.strategy);
        player.plans.push(player.strategy);
        player.plans.push(player.strategy);
        
        player.skillPoints = startup.skills + leveling.skills * (player.level - 1);
        
        for (e in player.equips) {
            if (player.equips[e] !== null && canUseItem(player, player.equips[e]) === false) {
                rpgbot.sendMessage(src, items[player.equips[e]].name + " unequipped!", rpgchan);
                player.equips[e] = null;
            }
        }
        
        this.updateBonus(src);
    };
    
    this.viewStats = function(src) {
        var player = SESSION.users(src).rpg;
        
        var out = [
            "",
            "Class: " + cap(player.job),
            "Level: " + player.level,
            "Exp: " + player.exp + "/" + (player.level === expTable.length + 1 ? expTable[expTable.length-1] : expTable[player.level - 1]),
            "",
            "HP: " + player.hp + "/" + player.maxhp,
            "Mana: " + player.mp + "/" + player.maxmp,
            "",
            "Strength: " + player.str + (player.bonus.equip.str + player.bonus.skill.str !== 0 ? (player.bonus.equip.str + player.bonus.skill.str > 0 ? " +" : " ") + (player.bonus.equip.str + player.bonus.skill.str) : ""),
            "Defense: " + player.def + (player.bonus.equip.def + player.bonus.skill.def !== 0 ? (player.bonus.equip.def + player.bonus.skill.def > 0 ? " +" : " ") + (player.bonus.equip.def + player.bonus.skill.def) : ""),
            "Speed: " + player.spd + (player.bonus.equip.spd + player.bonus.skill.spd !== 0 ? (player.bonus.equip.spd + player.bonus.skill.spd > 0 ? " +" : " ") + (player.bonus.equip.spd + player.bonus.skill.spd) : ""),
            "Dexterity: " + player.dex + (player.bonus.equip.dex + player.bonus.skill.dex !== 0 ? (player.bonus.equip.dex + player.bonus.skill.dex > 0 ? " +" : " ") + (player.bonus.equip.dex + player.bonus.skill.dex) : ""),
            "Magic: " + player.mag + (player.bonus.equip.mag + player.bonus.skill.mag !== 0 ? (player.bonus.equip.mag + player.bonus.skill.mag > 0 ? " +" : " ") + (player.bonus.equip.mag + player.bonus.skill.mag) : ""),
            "",
            "Gold: " + player.gold,
            "",
            "Stat Points: " + player.statPoints,
            "",
            "Type /skills to find information about your skills!"
        ];
        
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.viewSkills = function(src) {
        var player = SESSION.users(src).rpg;
        
        var out = ["", "Active Skills:"];
        for (var s in player.skills) {
            if (skills[s].type !== "passive") {
                out.push(skills[s].name + " (" + s + ") : [" + player.skills[s] + "/" + skills[s].levels + "] " + skills[s].info + (" (" + skills[s].cost + " Mana)"));
            }
        }
        out.push("");
        out.push("Passive Skills:");
        for (s in player.skills) {
            if (skills[s].type === "passive") {
                out.push(skills[s].name + " (" + s + ") : [" + player.skills[s] + "/" + skills[s].levels + "] " + skills[s].info);
            }
        }
        
        out.push("");
        out.push("Skill Points: " + player.skillPoints);
        out.push("");
        out.push("Type /stats to find information about your stats!");
        
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.viewPlaces = function(src) {
        var out = [""];
        var sk;
        for (var s in places) {
            sk = places[s];
            out.push(sk.name + " (" + s + "): " + sk.info);
        }
        out.push("");
        
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.viewClasses = function(src) {
        var out = [""];
        for (var x in classHelp) {
            out.push(classHelp[x]);
        }
        out.push("");
        
        for (x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.viewPlayer = function(src, commandData) {
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Type /view name to view someone's stats. Use /view on or /view off to allow or disallow other people from viewing your stats.", rpgchan);
            return;
        }
        if (commandData.toLowerCase() === "on") {
            if (SESSION.users(src).rpg === undefined) {
                rpgbot.sendMessage(src, "You don't even have a character!", rpgchan);
                return;
            }
            rpgbot.sendMessage(src, "Allowing other players to view your stats.", rpgchan);
            SESSION.users(src).rpg.publicStats = true;
            return;
        } else if (commandData.toLowerCase() === "off") {
            if (SESSION.users(src).rpg === undefined) {
                rpgbot.sendMessage(src, "You don't even have a character!", rpgchan);
                return;
            }
            rpgbot.sendMessage(src, "Disallowing other players from viewing your stats.", rpgchan);
            SESSION.users(src).rpg.publicStats = false;
            return;
        }
        
        var id = sys.id(commandData);
        if (id === undefined) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        if (SESSION.users(id).rpg === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        var target = SESSION.users(id).rpg;
        if (target.publicStats !== true) {
            rpgbot.sendMessage(src, "This person's stats are not public!", rpgchan);
            return;
        }
        
        var out = [
            "",
            target.name + "'s information:"
        ];
        if (target.description !== "") {
            out.push("Description: " + target.description);
        }
        out = out.concat([
            "Class: " + cap(target.job),
            "Level: " + target.level,
            "",
            "HP: " + target.hp + "/" + target.maxhp,
            "Mana: " + target.mp + "/" + target.maxmp,
            "",
            "Strength: " + target.str + (target.bonus.equip.str + target.bonus.skill.str !== 0 ? (target.bonus.equip.str + target.bonus.skill.str > 0 ? " +" : " ") + (target.bonus.equip.str + target.bonus.skill.str) : ""),
            "Defense: " + target.def + (target.bonus.equip.def + target.bonus.skill.def !== 0 ? (target.bonus.equip.def + target.bonus.skill.def > 0 ? " +" : " ") + (target.bonus.equip.def + target.bonus.skill.def) : ""),
            "Speed: " + target.spd + (target.bonus.equip.spd + target.bonus.skill.spd !== 0 ? (target.bonus.equip.spd + target.bonus.skill.spd > 0 ? " +" : " ") + (target.bonus.equip.spd + target.bonus.skill.spd) : ""),
            "Dexterity: " + target.dex + (target.bonus.equip.dex + target.bonus.skill.dex !== 0 ? (target.bonus.equip.dex + target.bonus.skill.dex > 0 ? " +" : " ") + (target.bonus.equip.dex + target.bonus.skill.dex) : ""),
            "Magic: " + target.mag + (target.bonus.equip.mag + target.bonus.skill.mag !== 0 ? (target.bonus.equip.mag + target.bonus.skill.mag > 0 ? " +" : " ") + (target.bonus.equip.mag + target.bonus.skill.mag) : ""),
            ""
        ]);
        
        out.push(target.name + "'s skills:");
        for (var i in target.skills) {
            out.push(skills[i].name + " (" + i + ") : [" + target.skills[i] + "/" + skills[i].levels + "] " + skills[i].info + (skills[i].type === "passive" ? " (Passive)" : " (" + skills[i].cost + " Mana)"));
        }
        
        out.push("");
        out.push(target.name + "'s equipment:");
        for (i in target.equips) {
            if (target.equips[i] !== null && !(target.equips[i] in items)) {
                out.push(equipment[i] + ": Invalid equipment '" + target.equips[i] + "' found! Contact an RPG Admin to fix the issue!");
            } else {
                out.push(equipment[i] + ": " + (target.equips[i] === null ? "Nothing" : items[target.equips[i]].name));
            }
        }
        out.push("");
        
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.changeAppearance = function(src, commandData) {
        if (commandData === "*") {
            SESSION.users(src).rpg.description = "";
            rpgbot.sendMessage(src, "Your appearance was cleared! To write an appearance text, use '/appearance text' (please don't use it to break the server rules).", rpgchan);
        } else {
            if (commandData.length > 250) {
                rpgbot.sendMessage(src, "You can only have 250 characters on your appearance description!", rpgchan);
                return;
            }
            SESSION.users(src).rpg.description = commandData;
            rpgbot.sendMessage(src, "Your appearance was set to '" + commandData + "'.", rpgchan);
        }
    };
    this.changeFontSize = function(src, commandData) {
        if (isNaN(parseInt(commandData, 10)) === true) {
            rpgbot.sendMessage(src, "You must choose a valid number!", rpgchan);
            return;
        }
        SESSION.users(src).rpg.fontSize = commandData;
        rpgbot.sendMessage(src, "Battle Font size set to " + commandData, rpgchan);
    };
    this.showCommands = function(src, commandData) {
        sys.sendMessage(src, "", rpgchan);
        var x;
		if (commandData.toLowerCase() !== "auth"){
            if (commandData.toLowerCase() === "hidden") {
                sys.sendMessage(src, "Alternative Commands:", rpgchan);
                for (x in this.commands.altactions) {
                    sys.sendMessage(src, "/" + x + " - " + this.commands.altactions[x][1], rpgchan);
                }
            } else {
                sys.sendMessage(src, "Actions:", rpgchan);
                for (x in this.commands.actions) {
                    sys.sendMessage(src, "/" + x + " - " + this.commands.actions[x][1], rpgchan);
                }
                sys.sendMessage(src, "Character commands:", rpgchan);
                for (x in this.commands.character) {
                    sys.sendMessage(src, "/" + x + " - " + this.commands.character[x][1], rpgchan);
                }
                sys.sendMessage(src, "Channel commands:", rpgchan);
                for (x in this.commands.channel) {
                    sys.sendMessage(src, "/" + x + " - " + this.commands.channel[x][1], rpgchan);
                }
            }
		} else {
			if (isRPGAdmin(src)) {
				sys.sendMessage(src, "Operator Commands:", rpgchan);
				for (x in this.commands.op) {
					sys.sendMessage(src, "/" + x + " - " + this.commands.op[x][1], rpgchan);
				}
			}
			if (SESSION.channels(rpgchan).masters.indexOf(sys.name(src).toLowerCase()) !== -1) {
				sys.sendMessage(src, "Owner Commands:", rpgchan);
				for (x in this.commands.master) {
					sys.sendMessage(src, "/" + x + " - " + this.commands.master[x][1], rpgchan);
				}
			}
		}
        sys.sendMessage(src, "", rpgchan);
    };
    this.showHelp = function(src) {
		var help = [
            "",
            "*** *********************************************************************** ***",
            "±RPG: A newcomer's guide by Oksana: http://gamecorner.info/Thread-RPG-Newcomer-s-Guide",
            "±RPG: /start - To pick a class. See /classes for an explanation. EG: /start mage",
            "±RPG: /classes - Shows all of the current starting classes.",
            "±RPG: /i - To see your items list. Use /i name to equip. EG: /i armor or /i potion to heal during battle - You get some starting items. Equip them. Buy items at the weaponry, use /w weaponry from the inn.",
            "±RPG: /w inn - To go to the inn, which will tell you all the places you can go. /t owner:inn to rest and /e here to get battles vs slimes. Use /w place to move. EG: /w cave",
            "±RPG: /e - Starts a battle or occasionally explores to find an item.",
            "±RPG: /stats - See your stats and available stat points. Use /increase to allocate them. See /skills for your skills.",
            "±RPG: /skills - See your skills and available skill points. Use /increase to allocate them. See /stats for your stats.",
            "±RPG: /increase - To allocate your stat or skill point. EG: /increase speed OR /increase fire:3",
            "±RPG: /revive - Use this when you have died. You will revive at the inn with half HP, so remember to heal at the inn.",
            "*** *********************************************************************** ***",
            ""
		];
		for (var x in help) {
           sys.sendMessage(src, help[x], rpgchan);
        }
	};
    
    function runUpdate() {
        var tempBattles = currentBattles;
        var tempDuels = duelChallenges;
        var tempTrades = tradeRequests;
        var tempParty = currentParties;
        
        var POglobal = SESSION.global();
        var index, source;
        for (var i = 0; i < POglobal.plugins.length; ++i) {
            if ("rpg.js" === POglobal.plugins[i].source) {
                source = POglobal.plugins[i].source;
                index = i;
            }
        }
        if (index !== undefined) {
            updateModule(source, function (module) {
                POglobal.plugins[index] = module;
                module.source = source;
                module.init();
                module.game.restoreValues(tempBattles, tempDuels, tempTrades, tempParty);
                
            });
            sendChanAll("Updating RPG game...", rpgchan);
        }
        return;
    }
    
    this.loadLocalContent = function(src) {
        try {
            this.loadInfo(sys.getFileContent("rpgcontent.json"));
        } catch (err) {
            rpgbot.sendMessage(src, "Error loading RPG content from cached file: " + err, rpgchan);
        }
    };
    this.loadURLContent = function(src, url) {
        try {
            if (url === "*") {
                rpgbot.sendMessage(src, "Loading RPG content from " + contentLoc.url, rpgchan);
                sys.webCall(contentLoc.url, this.loadInfo);
                url = contentLoc.url;
            } else {
                rpgbot.sendMessage(src, "Loading RPG content from " + url, rpgchan);
                sys.webCall(url, this.loadInfo);
            }
            contentLoc = {
                url: url,
                user: sys.name(src),
                date: (new Date()).toUTCString()
            };
            sys.writeToFile("rpglocation.txt", JSON.stringify(contentLoc));
        } catch (err) {
            rpgbot.sendMessage(src, "Error loading RPG content from " + url + ": " + err, rpgchan);
        }
    };
    this.loadInfo = function(content) {
		try {
            var parsed = JSON.parse(content);
        
            classes = parsed.classes;
            monsters = parsed.monsters;
            skills = parsed.skills;
            items = parsed.items;
            places = parsed.places;
            expTable = parsed.config.levels;
            elements = parsed.config.elements || {};
            
            if (parsed.config.battle) {
                var battle = parsed.config.battle;
                if (battle.evasion) {
                    battleSetup.evasion = battle.evasion;
                }
                if (battle.defense) {
                    battleSetup.defense = battle.defense;
                }
                if (battle.damage) {
                    battleSetup.damage = battle.damage;
                }
                if (battle.critical) {
                    battleSetup.critical = battle.critical;
                }
                if (battle.instantCast) {
                    battleSetup.instantCast = battle.instantCast;
                }
                if (battle.passive) {
                    battleSetup.passive = battle.passive;
                }
                if (battle.party) {
                    battleSetup.party = battle.party;
                }
            }
            
            startup.classes = parsed.config.startup.classes;
            startup.location = parsed.config.startup.location;
            startup.gold = parsed.config.startup.gold;
            startup.items = parsed.config.startup.items;
            startup.stats = parsed.config.startup.stats;
            startup.skills = parsed.config.startup.skills;
            
            if (parsed.config.leveling) {
                var level = parsed.config.leveling;
                if (level.hp) {
                    leveling.hp = level.hp;
                }
                if (level.mp) {
                    leveling.mp = level.mp;
                }
                if (level.stats) {
                    leveling.stats = level.stats;
                }
                if (level.skills) {
                    leveling.skills = level.skills;
                }
                if (level.skillFromOtherClass) {
                    leveling.skillFromOtherClass = level.skillFromOtherClass;
                }
                if (level.maxhp) {
                    leveling.maxhp = level.maxhp;
                }
                if (level.maxmp) {
                    leveling.maxmp = level.maxmp;
                }
                if (level.maxstats) {
                    leveling.maxstats = level.maxstats;
                }
                if (level.trade) {
                    leveling.trade = level.trade;
                }
                if (level.items) {
                    leveling.items = level.items;
                }
                if (level.itemsPerLevel) {
                    leveling.itemsPerLevel = level.itemsPerLevel;
                }
            }
            
            if (parsed.config.equipment) {
                equipment = parsed.config.equipment;
            }
            
            var e, n, alt;
            altSkills = {};
            for (e in skills) {
                if ("alt" in skills[e]) {
                    for (n = 0; n < skills[e].alt.length; ++n) {
                        alt = skills[e].alt[n];
                        altSkills[alt] = e;
                    }
                }
            }
            altPlaces = {};
            for (e in places) {
                if ("alt" in places[e]) {
                    for (n = 0; n < places[e].alt.length; ++n) {
                        alt = places[e].alt[n];
                        altPlaces[alt] = e;
                    }
                }
            }
            altItems = {};
            for (e in items) {
                if ("alt" in items[e]) {
                    for (n = 0; n < items[e].alt.length; ++n) {
                        alt = items[e].alt[n];
                        altItems[alt] = e;
                    }
                }
            }
            
            if ("classHelp" in parsed) {
                classHelp = parsed.classHelp;
            }
                
            sys.writeToFile("rpgcontent.json", content);
            rpgbot.sendAll("RPG Game reloaded!", rpgchan);
		} catch (err) {
			sys.sendAll("Error loading RPG Game data: " + err, rpgchan);
		}
	};
    this.restoreValues = function(tempBattles, tempDuels, tempTrades, tempParty) {
        tradeRequests = tempTrades;
        currentBattles = tempBattles;
        duelChallenges = tempDuels;
        currentParties = tempParty;
    };
    this.viewContentFile = function(src) {
        sys.sendMessage(src, "", rpgchan);
        sys.sendMessage(src, "Last Update Info:", rpgchan);
        sys.sendMessage(src, "URL: " + contentLoc.url, rpgchan);
        sys.sendMessage(src, "Who: " + contentLoc.user, rpgchan);
        sys.sendMessage(src, "When: " + contentLoc.date, rpgchan);
        sys.sendMessage(src, "", rpgchan);
    };
    this.callUpdate = function () {
        runUpdate();
        return;
    };
    this.reloadChars = function(src) {
        try {
            var playerson = sys.playerIds();
            var user, x, gamefile;
            for (x = 0; x < playerson.length; ++x) {
                user = SESSION.users(playerson[x]);
                if (user && user.rpg && user.rpg !== null && user.rpg !== undefined) {
                    gamefile = this.convertChar(user.rpg);
                    user.rpg = gamefile;
                }
            }
            rpgbot.sendAll("Characters updated!", rpgchan);
        } catch (err) {
            rpgbot.sendAll("Error when reloading characters: " + err, rpgchan);
        }
    };
    this.unborkChar = function(src, commandData) {
        var data = commandData.split(":");
        if (data.length < 2) {
            rpgbot.sendMessage(src, "Incorrect format. Use /unbork player:property.", rpgchan);
            return;
        }
        
        var id = sys.id(data[0]);
        if (id === undefined) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        
        var target = SESSION.users(id).rpg;
        if (target === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        
        var property = data[1].toLowerCase();
        
        var r;
        switch (property) {
            case "items":
            case "item":
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, sys.name(id) + "'s items:", rpgchan);
                for (r in target.items) {
                    sys.sendMessage(src, r + ": " + target.items[r], rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                break;
            case "skill":
            case "skills":
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, sys.name(id) + "'s skills:", rpgchan);
                for (r in target.skills) {
                    sys.sendMessage(src, r + ": " + target.skills[r], rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                break;
            case "place":
            case "location":
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, sys.name(id) + " is currently at " + target.location, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                break;
            default:
                sys.sendMessage(src, "No such property!", rpgchan);
                break;
        }
        //TO DO: Code to edit or remove properties from a borked character.
    };
    
	this.commands = {
		actions: {
            walk: [this.walkTo, "To go to a different location."],
            talk: [this.talkTo, "To talk to an NPC."],
            explore: [this.exploreLocation, "To explore a location for items or monsters."],
            flee: [this.fleeBattle, "To run away from your current battle."],
            item: [this.useItem, "To use or view your items."],
            challenge: [this.challengePlayer, "To challenge another player to a duel."],
            revive: [this.reviveSelf, "To respawn after you die."],
            trade: [this.requestTrade, "To request a trade with another player."],
            accept: [this.acceptTrade, "To instantly accept someone's trade offer."],
		},
        character: {
            plan: [this.setBattlePlan, "To see or set your battle strategy."],
            passive: [this.setPassiveSkills, "To view or set your passive skills."],
            stats: [this.viewStats, "To view your character status."],
            skills: [this.viewSkills, "To view the available skills."],
            increase: [this.addPoint, "To increase your stats or skills after you level up."],
            // resetchar: [this.resetChar, "To reset your build without erasing your character."],
            savechar: [this.saveGame, "To save your progress."],
            clearchar: [this.clearChar, "To clear your character."],
            // inn: [this.gotoInn, "Pay 10 Gold to fully restore HP and MP."],
            party: [this.manageParty, "To create and manage a party"],
            appearance: [this.changeAppearance, "To change your appearance description."],
            font: [this.changeFontSize, "To change the Battle Message's size."],
            getplan: [this.getBattlePlan, "To get your raw plan text."],
            it: [this.viewItems, "To view your items by category."],
            watch: [this.watchBattle, "To watch someone else's battle."]
        },
        altactions: {
            skill: [this.viewSkills, "Same as /skills."],
            items: [this.useItem, "Same as /item."],
            e: [this.exploreLocation, "Same as /explore."],
            w: [this.walkTo, "Same as /walk."],
            t: [this.talkTo, "Same as /talk."],
            r: [this.reviveSelf, "Same as /revive."],
            i: [this.useItem, "Same as /item."],
            f: [this.fleeBattle, "Same as /flee"],
            c: [this.challengePlayer, "Same as /challenge."],
            p: [this.manageParty, "Same as /party."]
        },
		channel: {
			help: [this.showHelp, "To learn how to play the game."],
			commands: [this.showCommands, "To see the list of commands."],
            classes: [this.viewClasses, "To view basic information about each class."],
            start: [this.startGame, "To create your character and begin your game."],
            loadchar: [this.loadGame, "To load your previously saved game."],
            //places: [this.viewPlaces, "To view the available locations."],
            view: [this.viewPlayer, "To view someone else's stats."]
		},
		op: {
		},
		master: {
            reloadchars: [this.reloadChars, "To reload everyone's character after an update."],
            unbork: [this.unborkChar, "To manually fix someone's character."],
            updatelocal: [this.loadLocalContent, "To load RPG content from the directory."],
            updaterpg: [this.loadURLContent, "To load RPG content from the web. If you don't specify an URL, the default one will be used."],
            updategame: [this.callUpdate, "Update the RPG Scripts."],
            getcontent: [this.viewContentFile, "To view the content file for RPG."]
		}
	};
    this.handleCommand = function(src, message, channel) {
        if (channel !== rpgchan) {
            return;
        }
        try {
			game.handleCommandOld(src, message, channel);
            return true;
        } catch(e) {
            if (e !== "No valid command") {
                sys.sendAll("Error on RPG command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e, rpgchan);
                if (sys.id("RiceKirby") !== undefined) {
                    sys.sendMessage(sys.id("RiceKirby"), "Error on RPG command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e + " [" + sys.name(src) + " typed /" + message + "]", rpgchan);
                }
                return true;
            }
        }
    };
    this.handleCommandOld = function(src, message, channel) {
		var command;
		var commandData = '*';
		var pos = message.indexOf(' ');
		if (pos !== -1) {
			command = message.substring(0, pos).toLowerCase();
			commandData = message.substr(pos+1);
		} else {
			command = message.substr(0).toLowerCase();
		}
        
		if (command in this.commands.channel) {
			this.commands.channel[command][0].call(this, src, commandData);
			return true;
		}
		if (command in this.commands.actions) {
			if (SESSION.users(src).rpg === undefined) {
                rpgbot.sendMessage(src, "You need to start the game to use this command!", rpgchan);
                return true;
            }
            this.commands.actions[command][0].call(this, src, commandData);
			return true;
		}
        if (command in this.commands.altactions) {
			if (SESSION.users(src).rpg === undefined) {
                rpgbot.sendMessage(src, "You need to start the game to use this command!", rpgchan);
                return true;
            }
            this.commands.altactions[command][0].call(this, src, commandData);
			return true;
		}
        if (command in this.commands.character) {
			if (SESSION.users(src).rpg === undefined) {
                rpgbot.sendMessage(src, "You need to start the game to use this command!", rpgchan);
                return true;
            }
            this.commands.character[command][0].call(this, src, commandData);
			return true;
		}

		if (!isRPGAdmin(src)) {
			throw ("No valid command");
		}

		if (command in this.commands.op) {
			this.commands.op[command][0].call(this, src, commandData);
			return true;
		}

		if (SESSION.channels(rpgchan).masters.indexOf(sys.name(src).toLowerCase()) === -1) {
			throw ("No valid command");
		}

		if (command in this.commands.master) {
			this.commands.master[command][0].call(this, src, commandData);
			return true;
		}

		throw ("No valid command");
	};
    this.tickDown = function() {
        tick++;
        if (tick % 3 === 0) {
            for (var x in currentBattles) {
                currentBattles[x].playNextTurn();
            }
            tick = 0;
        }
	};
    this.removePlayer = function(src)  {
        var player = SESSION.users(src).rpg;
            
        this.quitBattle(src);
        for (var p in currentParties) {
            currentParties[p].leave(src, false);
        }
        if (player.name in tradeRequests) {
            tradeRequests[player.name] = undefined;
        }
        if (player.name in duelChallenges) {
            duelChallenges[player.name] = undefined;
        }
        for (var b in currentBattles) {
            var bat = currentBattles[b];
            var i = bat.viewers.indexOf(src);
            if (i !== -1) {
                bat.viewers.splice(i, 1);
                bat.sendToViewers(sys.name(src) + " stopped watching this battle!");
            }
        }
    };
	this.beforeLogOut = function(src) {
        if (SESSION.users(src).rpg !== undefined) {
            game.removePlayer(src);
            game.saveGame(src);
            game.clearChar(src);
        }
    };
	this.init = function() {
		var name="RPG";
		if (sys.existChannel(name)) {
            rpgchan = sys.channelId(name);
        } else {
            rpgchan = sys.createChannel(name);
        }
        SESSION.global().channelManager.restoreSettings(rpgchan);
        SESSION.channels(rpgchan).perm = true;
        SESSION.channels(rpgchan).master = "RiceKirby";
        game.loadLocalContent();
        contentLoc = JSON.parse(sys.getFileContent("rpglocation.txt"));
	};
	this.stepEvent = function() {
        try {
            game.tickDown();
        } catch(err) {
            sys.sendAll("±RPGBot: error occurred" + (err.lineNumber ? " on line " + err.lineNumber : "") + ": " + err, rpgchan);
        }
    };

	function isRPGAdmin(src) {
		if (sys.auth(src) >= 1) {
            return true;
        }
        var name = sys.name(src).toLowerCase();
        if (SESSION.channels(rpgchan).operators.indexOf(name) !== -1 || SESSION.channels(rpgchan).admins.indexOf(name) !== -1 || SESSION.channels(rpgchan).masters.indexOf(name) !== -1) {
            return true;
        }
        return false;
	}
    function cap(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    function shuffle(o) {
        for (var j, x, i = o.length; i; j = parseInt(Math.random() * i, 10), x = o[--i], o[i] = o[j], o[j] = x){}
        return o;
    }
    function readable(arr, last_delim) {
        if (!Array.isArray(arr)) {
            return arr;
        }
        if (arr.length > 1) {
            return arr.slice(0, arr.length - 1).join(", ") + " " + last_delim + " " + arr.slice(-1)[0];
        } else if (arr.length === 1) {
            return arr[0];
        } else {
            return "";
        }
    }
    function randomSample(hash) {
        var cum = 0;
        var val = Math.random();
        var psum = 0.0;
        var x;
        var count = 0;
        for (x in hash) {
            psum += hash[x];
            count += 1;
        }
        if (psum === 0.0) {
            var j = 0;
            for (x in hash) {
                cum = (++j) / count;
                if (cum >= val) {
                    return x;
                }
            }
        } else {
            for (x in hash) {
                cum += hash[x] / psum;
                if (cum >= val) {
                    return x;
                }
            }
        }
    }
}

module.exports = function() {
    var id;
    var init = function() {
        var name = "RPG";
        if (sys.existChannel(name)) {
            id = sys.channelId(name);
        } else {
            id = sys.createChannel(name);
        }
        SESSION.global().channelManager.restoreSettings(id);
        SESSION.channels(id).perm = true;
        SESSION.channels(id).master = "RiceKirby";
    };

    var game = new RPG(id);

    return {
        game: game,
        init: game.init,
        handleCommand: game.handleCommand,
        beforeLogOut: game.beforeLogOut,
        stepEvent: game.stepEvent
    };
}();
