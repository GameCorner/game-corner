// Global variables inherited from scripts.js
/*global rpgbot, updateModule, sys, SESSION, sendChanAll, require, escape, module*/
var RPG_CHANNEL = "Game Corner";
function RPG(rpgchan) {
    var game = this;
    var contentLoc;
    
    var charVersion = 1.1;
    var savefolder = "rpgsaves";
    var contentfile = "rpgcontent.json";
    var locationfile = "rpglocation.txt";
    var leaderboardfile = "rpgleaderboard.json";
    var rpgAtt = "rpg";
    var plugins = {
        party: "rpg_party.js",
        battle: "rpg_battle.js"
    }
    
    var config;
    var classes;
    var monsters;
    var skills;
    var items;
    var places;
    var elements;
    var quests;
    var titles;
    var classSets = {};
    
    var tick = 0;
    
    var expTable = [40, 94, 166, 263, 393, 568, 804, 1122, 1551, 2130, 2911, 3965, 5387, 7306, 9896, 13392, 18111, 24481, 33080, 44688, 60358, 81512, 110069, 148620, 200663, 270921, 365769, 493813, 666672];
    
    this.currentParties = {};
    this.currentBattles = [];
    
    var duelChallenges = {};
    var tradeRequests = {};
    var leaderboards = {};
    
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
        itemsPerLevel: 0,
        battleExp: 1,
        battleGold: 1,
        eventExp: 1
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
        party: 6,
        partyLevelDiff: 99,
        partyExp: 0
    };
    
    var altSkills = {};
    var altPlaces = {};
    var altItems = {};
    var classHelp = [];
    
    var Party = require(plugins.party).Party;
    var Battle = require(plugins.battle).Battle;
    
    function getAvatar(src) {
        return SESSION.users(src)[rpgAtt];
    }
    
    this.walkTo = function(src, commandData) {
        var player = getAvatar(src);
        
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
                    out.push(p.name + " (" + access[l] + "): " + p.info + (p.type ? " [Type: " + cap(p.type) + "]" : ""));
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
            var list = [];
            if ("key" in req) {
                for (s in req.key) {
                    if (!this.hasItem(player, s, req.key[s])) {
                        list.push("You need at least " + req.key[s] + " " + items[s].name + "(s) to go there!");
                    }
                }
            }
            if ("items" in req) {
                for (s in req.items) {
                    if (!this.hasItem(player, s, req.items[s])) {
                        list.push("You need at least " + req.items[s] + " " + items[s].name + "(s) to go there!");
                    }
                }
            }
            if ("level" in req) {
                if (player.level < req.level) {
                    list.push("You need to be at least level " + req.level + " to go there!");
                }
            }
            if ("classes" in req) {
                if (req.classes.indexOf(player.job) === -1) {
                    list.push("You can't go there as a " + classes[player.job].name + "!");
                }
            }
            if ("attributes" in req) {
                var att = ["hp", "mp", "str", "def", "spd", "dex", "mag"];
                for (s in req.attributes) {
                    if (att.indexOf(s) !== -1 && player[s] < req.attributes[s]) {
                        list.push("You need at least " + req.attributes[s] + " " + cap(s) + " to go there!");
                    }
                }
            }
            if ("events" in req) {
                for (s in req.events) {
                    var ev = req.events[s];
                    var v = s in player.events ? player.events[s] : false;
                    if (ev !== v) {
                        list.push("You need to complete a mission to go there!");
                        break;
                    }
                }
            }
            if ("defeated" in req) {
                for (s in req.defeated) {
                    if (!(s in player.defeated) || player.defeated[s] < req.defeated[s]) {
                        list.push("You need to defeat " + (req.defeated[s] - (s in player.defeated ? player.defeated[s] : 0)) + " more " + monsters[s].name + "(s) to go there!");
                    }
                }
            }
            
            if (list.length > 0) {
                for (s in list) {
                    rpgbot.sendMessage(src, list[s], rpgchan);
                }
                return;
            }
        }
        
        var itemsConsumed = [];
        if (req && req.items) {
            for (r in req.items) {
                this.changeItemCount(player, r, -1 * req.items[r]);
                itemsConsumed.push(items[r].name + (req.items[r] > 1 ? "(" + req.items[r] + ")" : ""));
            }
        }
        
        sys.sendMessage(src, "", rpgchan);
        this.changeLocation(src, loc);
        if (itemsConsumed.length > 0) {
            rpgbot.sendMessage(src, "You consumed " + readable(itemsConsumed, "and") + " to enter here!", rpgchan);
        }
        sys.sendMessage(src, "", rpgchan);
        
        if ("effect" in places[loc]) {
            var applyEffect = this.checkNPCRequisites(src, places[loc], ["effectRequisites"], true);
            
            if (applyEffect > 0) {
                var output = this.applyEffect(src, places[loc].effect);
            
                if (output.length > 0) {
                    for (var x in output) {
                        rpgbot.sendMessage(src, output[x], rpgchan);
                    }
                }
            }
        }
        
    };
    this.changeLocation = function(src, loc, verb) {
        var player = getAvatar(src);
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
        if ("welcome" in places[loc]) {
            rpgbot.sendMessage(src, places[loc].welcome, rpgchan);
        }
        
        if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
            this.findParty(player.party).broadcast(getTitleName(src) + " " + verb + " " + places[loc].name, src);
        }
    };
    this.talkTo = function(src, commandData) {
        this.interact(src, "npc", commandData);
    };
    this.actTo = function(src, commandData) {
        this.interact(src, "object", commandData);
    };
    this.interact = function(src, obj, commandData) {
        var player = getAvatar(src);
        
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
            if (!("npc" in places[player.location]) && !("object" in places[player.location])) {
                rpgbot.sendMessage(src, "No one to talk to here!", rpgchan);
                return;
            }
            var talkableNPC = [], talkableObj = [], n;
            if ("npc" in places[player.location]) {
                for (n in places[player.location].npc) {
                    if (!places[player.location].npc[n].hide || places[player.location].npc[n].hide !== true) {
                        talkableNPC.push(cap(n));
                    }
                }
            }
            if ("object" in places[player.location]) {
                for (n in places[player.location].object) {
                    if (!places[player.location].object[n].hide || places[player.location].object[n].hide !== true) {
                        talkableObj.push(cap(n));
                    }
                }
            }
            
            if (talkableNPC.length > 0) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, "You can talk to the following persons:", rpgchan);
                for (n in talkableNPC) {
                    sys.sendMessage(src, talkableNPC[n], rpgchan);
                }
            } 
            if (talkableObj.length > 0) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, "You can interact with the following objects:", rpgchan);
                for (n in talkableObj) {
                    sys.sendMessage(src, talkableObj[n], rpgchan);
                }
            } 
            
            if (talkableNPC.length === 0 && talkableObj.length === 0) {
                rpgbot.sendMessage(src, "No one to talk to here!", rpgchan);
            }
            return;
        }
        
        if (!(obj in places[player.location])) {
            rpgbot.sendMessage(src, (obj === "npc" ? "No one to talk to here!" : "Nothing to interact with here!"), rpgchan);
            return;
        }
        
        var people = places[player.location][obj];
        var data = commandData.split(":");
        var person = data[0].toLowerCase();
        var alt, foundAlt;
       
        if (!(person in people)) {
            foundAlt = false;
            for (alt in people) {
                if ("alt" in people[alt] && people[alt].alt.indexOf(person) !== -1) {
                    person = alt;
                    foundAlt = true;
                    break;
                }
            }
            if (!foundAlt) {
                rpgbot.sendMessage(src, (obj === "npc" ? "No such person!" : "No such object!"), rpgchan);
                return;
            }
        }
        
        var npc = people[person];
        if (data.length < 2) {
            sys.sendMessage(src, npc.message, rpgchan);
            return;
        }
        
        var option = data[1].toLowerCase();
        if (!(option in npc) || ["message", "notopic", "hide", "alt"].indexOf(option) !== -1) {
            foundAlt = false;
            for (alt in npc) {
                if (["message", "notopic", "hide", "alt"].indexOf(alt) !== -1) {
                    continue;
                }
                if ("alt" in npc[alt] && npc[alt].alt.indexOf(option) !== -1) {
                    option = alt;
                    foundAlt = true;
                    break;
                }
            }
            
            if (!foundAlt) {
                if (npc.notopic) {
                    sys.sendMessage(src, npc.notopic, rpgchan);
                } else {
                    sys.sendMessage(src, npc.message, rpgchan);
                }
                return;
            }
        } 
        
        var topic = npc[option];
        var outcome = this.checkNPCRequisites(src, topic, ["requisites", "requisites2", "requisites3", "requisites4", "requisites5", "requisites6", "requisites7", "requisites8", "requisites9", "requisites10"], false, person);
        
        if (outcome === 0) {
            return;
        }
        
        var it, i, goods, price, amount = 1, products, nomsg = false;
        
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
            
            if (!this.canHoldItems(player, this.getItemCount(player, goods) + amount)) {
                rpgbot.sendMessage(src, "You can't have more than " + this.getItemLimit(player) + " " + items[goods].name + "(s)!",rpgchan);
                return;
            }
            
            player.gold -= price;
            this.changeItemCount(player, goods, amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            nomsg = true;
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
            
            if (!this.hasItem(player, goods, amount)) {
                sys.sendMessage(src, topic.noitemmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name),rpgchan);
                return;
            }
            
            player.gold += price;
            this.changeItemCount(player, goods, -amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            nomsg = true;
        } else if ("buy" in topic && topic.buy === "*") {
            if (data.length < 3) {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.message, rpgchan);
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in items) || items[goods].noSell === true) {
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
            
            if (!this.hasItem(player, goods, amount)) {
                sys.sendMessage(src, topic.noitemmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name),rpgchan);
                return;
            }
            
            player.gold += price;
            this.changeItemCount(player, goods, -amount);
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg.replace(/~Count~/g, amount).replace(/~Item~/g, items[goods].name).replace(/~Price~/g, price),rpgchan);
            nomsg = true;
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
                    sys.sendMessage(src, cap(i) + ": " + readable(materials, "and") + " for " + readable(rewards, "and"), rpgchan);
                }
                sys.sendMessage(src, "", rpgchan);
                return;
            }
            
            goods = data[2].toLowerCase();
            
            if (!(goods in products)) {
                sys.sendMessage(src, topic.notrademsg,rpgchan);
                return;
            }
            
            if (data.length > 3 && isNaN(parseInt(data[3], 10)) === false) {
                amount = parseInt(data[3], 10);
                amount = amount < 1 ? 1 : amount;
            }
            
            materials = products[goods].material;
            for (t in materials) {
                if (t === "gold") {
                    if (player.gold < materials[t] * amount) {
                        sys.sendMessage(src, topic.nomaterialmsg,rpgchan);
                        return;
                    }
                } else if (!this.hasItem(player, t, materials[t] * amount)) {
                    sys.sendMessage(src, topic.nomaterialmsg,rpgchan);
                    return;
                }
            }
            
            rewards = products[goods].reward;
            for (t in rewards) {
                if (t !== "gold") {
                    if (!this.canHoldItems(player, this.getItemCount(player, t) + rewards[t] * amount)) {
                        rpgbot.sendMessage(src, "You can't have more than " + this.getItemLimit(player) + " " + items[t].name + "(s)!",rpgchan);
                        return;
                    }
                } 
            }
            
            for (t in materials) {
                if (t === "gold") {
                    player.gold -= materials[t] * amount;
                    rpgbot.sendMessage(src, (materials[t] * amount) + " Gold lost!", rpgchan);
                } else {
                    this.changeItemCount(player, t, -materials[t] * amount);
                    rpgbot.sendMessage(src, (materials[t] * amount) + " " + items[t].name + "(s) lost!", rpgchan);
                }
            }
            
            for (t in rewards) {
                if (t === "gold") {
                    player.gold += rewards[t] * amount;
                    rpgbot.sendMessage(src, (rewards[t] * amount) + " Gold received!", rpgchan);
                } else {
                    this.changeItemCount(player, t, rewards[t] * amount);
                    rpgbot.sendMessage(src, (rewards[t] * amount) + " " + items[t].name + "(s) received!", rpgchan);
                }
            }
            
            sys.sendMessage(src, "",rpgchan);
            sys.sendMessage(src, topic.acceptmsg,rpgchan);
            nomsg = true;
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
            
            if (items[goods].noStore) {
                sys.sendMessage(src, "", rpgchan);
                rpgbot.sendMessage(src, "You can't store this item!", rpgchan);
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
                nomsg = true;
            } else {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.noitemmsg, rpgchan);
                return;
            }
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
                nomsg = true;
            } else {
                sys.sendMessage(src, "", rpgchan);
                sys.sendMessage(src, topic.nogoldmsg, rpgchan);
                return;
            }
        }
        
        if (!nomsg) {
            sys.sendMessage(src, "", rpgchan);
            var messageList = ["message", "message2", "message3", "message4", "message5", "message6", "message7", "message8", "message9", "message10"];
            sys.sendMessage(src, topic[getLevelValue(messageList, outcome - 1)], rpgchan);
        }
        this.checkNPCEffect(src, topic, person, outcome);
    };
    this.checkNPCEffect = function(src, topic, person, outcome) {
        var eff;
        var effectList = ["effect", "effect2", "effect3", "effect4", "effect5", "effect6", "effect7", "effect8", "effect9", "effect10"];
        
        if (outcome <= effectList.length) {
            for (var i = outcome - 1; i >= 0; i--) {
                if (effectList[i] in topic) {
                    eff = topic[effectList[i]];
                    break;
                }
            }
        }
        
        if (!eff) {
            return;
        }
        
        var out = this.applyEffect(src, eff, person);
        
        if (out.length > 0) {
            for (var x in out) {
                rpgbot.sendMessage(src, out[x], rpgchan);
            }
        }
    };
    this.applyEffect = function(src, effect, person) {
        var player = getAvatar(src);   
        var e, sample, out = [];
        if ("broadcast" in effect) {
            rpgbot.sendAll(effect.broadcast.replace(/~Player~/gi, getTitleName(src)), rpgchan);
        }
        if ("messages" in effect) {
            for (e in effect.messages) {
                out.push(effect.messages[e]);
            }
        }
        if ("hp" in effect) {
            player.hp += effect.hp;
        }
        if ("mp" in effect) {
            player.mp += effect.mp;
        }
        if ("hpPercent" in effect) {
            player.hp += Math.round(player.maxhp * effect.hpPercent);
        }
        if ("mpPercent" in effect) {
            player.mp += Math.round(player.maxmp * effect.mpPercent);
        }
        
        if (player.hp > player.maxhp) {
            player.hp = player.maxhp;
        } else if (player.hp < 0) {
            player.hp = 0;
        }
        if (player.mp > player.maxmp) {
            player.mp = player.maxmp;
        } else if (player.mp < 0) {
            player.mp = 0;
        }
        
        if ("gold" in effect) {
            player.gold += effect.gold;
            if (player.gold < 0) {
                player.gold = 0;
            }
            if (effect.gold > 0) {
                out.push("You received " + effect.gold + " Gold!");
            } else if (effect.gold < 0) {
                out.push("You lost " + (-1 * effect.gold) + " Gold!");
            }
        }
        var itemsGained = {};
        if ("items" in effect) {
            for (e in effect.items) {
                this.changeItemCount(player, e, effect.items[e]);
                if (effect.items[e] > 0) {
                    itemsGained[e] = effect.items[e];
                } else if (effect.items[e] < 0) {
                    itemsGained[e] = effect.items[e];
                }
            }
        }
        if ("randomItems" in effect) {
            sample = randomSample(effect.randomItems);
            sample = sample.split(":");
            var itemName;
            for (e in sample) {
                itemName = sample[e];
                if (itemName in items) {
                    this.changeItemCount(player, itemName, 1);
                    if (!(itemName in itemsGained)) {
                        itemsGained[itemName] = 0;
                    }
                    itemsGained[itemName]++;
                }
            }
        }
        for (e in itemsGained) {
            if (itemsGained[e] > 0) {
                out.push("You received " + itemsGained[e] + " " + items[e].name + "(s)!");
            } else if (itemsGained < 0) {
                out.push("You lost " + (-1 * itemsGained[e]) + " " + items[e].name + "(s)!");
            }
        }
        if ("events" in effect) {
            for (e in effect.events) {
                player.events[e] = effect.events[e];
            }
        }
        if ("partyMove" in effect && player.isBattling === false) {
            if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                var party = this.findParty(player.party).findMembersNear(src);
                for (e in party[0]) {
                    this.changeLocation(party[0][e], effect.partyMove);
                }
            }
        } else if ("move" in effect && player.isBattling === false) {
            var loc = effect.move === "*" ? player.respawn : effect.move;
            this.changeLocation(src, loc);
        }
        if ("respawn" in effect) {
            player.respawn = effect.respawn;
            out.push("Your respawn point was set to " + places[player.respawn].name + "!");
        }
        if ("exp" in effect && effect.exp > 0) {
            var finalExp = Math.floor(effect.exp * leveling.eventExp);
            out.push("You received " + finalExp + " Exp. Points!");
            this.receiveExp(src, finalExp);
        }
        if ("classes" in effect) {
            for (e in effect.classes) {
                if (e === player.job) {
                    this.changePlayerClass(player, effect.classes[e]);
                    out.push("You changed classes and now are a " + classes[player.job].name + "!");
                    break;
                }
            }
        }
        if ("skills" in effect) {
            for (e in effect.skills) {
                if (!(e in player.skills)) {
                    player.skills[e] = 0;
                } else if (effect.skills[e] === "*") {
                    delete player.skills[e];
                    continue;
                }
                player.skills[e] += effect.skills[e];
                if (player.skills[e] < 0) {
                    player.skills[e] = 0;
                } else if (player.skills[e] > skills[e].levels) {
                    player.skills[e] = skills[e].levels;
                }
            }
        }
        if ("attributes" in effect) {
            var attr = ["maxhp", "maxmp", "str", "def", "spd", "dex", "mag"];
            for (e in effect.attributes) {
                if (attr.indexOf(e) !== -1) {
                    player[e] += effect.attributes[e];
                    if (player[e] < 1) {
                        player[e] = 1;
                    }
                }
            }
        }
        if ("resetStats" in effect) {
            this.resetStats(src);
        }
        if ("resetSkills" in effect) {
            this.resetSkills(src);
        }
        var m, list, c;
        if ("monsters" in effect && player.isBattling === false) {
            m = [];
            for (e in effect.monsters) {
                for (c = 0; c < effect.monsters[e]; ++c) {
                    if (effect.monsters[e] > 1) {
                        m.push(this.generateMonster(e, c + 1));
                    } else {
                        m.push(this.generateMonster(e));
                    }
                }
            }
            if (m.length > 0) {
                if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                    list = this.findParty(player.party).findMembersNear(src);
                } else {
                    list = [[src], [player]];
                }
                this.startBattle(list[0], list[1], m);
            }
        } else if ("soloMonsters" in effect && player.isBattling === false) {
            m = [];
            for (e in effect.soloMonsters) {
                for (c = 0; c < effect.soloMonsters[e]; ++c) {
                    if (effect.soloMonsters[e] > 1) {
                        m.push(this.generateMonster(e, c + 1));
                    } else {
                        m.push(this.generateMonster(e));
                    }
                }
            }
            if (m.length > 0) {
                list = [[src], [player]];
                this.startBattle(list[0], list[1], m);
            }
        } else if ("randomMonsters" in effect && player.isBattling === false) {
            m = [];
            var monsterList = randomSample(effect.randomMonsters).split(":");
            var monstersFound = {};
            for (e in monsterList) {
                if (!(monsterList[e] in monstersFound)) {
                    monstersFound[monsterList[e]] = 0;
                }
                monstersFound[monsterList[e]]++;
            }
            for (e in monstersFound) {
                for (c = 0; c < monstersFound[e]; ++c) {
                    if (monstersFound[e] > 1) {
                        m.push(this.generateMonster(e, c + 1));
                    } else {
                        m.push(this.generateMonster(e));
                    }
                }
            }
            if (m.length > 0) {
                if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                    list = this.findParty(player.party).findMembersNear(src);
                } else {
                    list = [[src], [player]];
                }
                this.startBattle(list[0], list[1], m);
            }
        }
        if ("quests" in effect) {
            var updatedQuests = [];
            
            for (e in effect.quests) {
                player.quests[e] = effect.quests[e];
                updatedQuests.push(quests[e].name);
            }
            
            if (updatedQuests.length > 0) {
                out.push("The following quests have been updated: " + readable(updatedQuests, "and") + ".");
            }
        }
        if ("title" in effect) {
            for (e in effect.title) {
                if (effect.title[e] === true) {
                    if (player.titles.indexOf(e) === -1) {
                        player.titles.push(e);
                        out.push("You received the title " + titles[e].name + ".");
                    }
                } else {
                    if (player.titles.indexOf(e) !== -1) {
                        player.titles.splice(player.titles.indexOf(e), 1);
                        if (player.currentTitle === e) {
                            player.currentTitle = null;
                        }
                        out.push("You lost the title " + titles[e].name + ".");
                    }
                }
            }
        }
        if ("hunt" in effect && person) {
            if (!(person in player.hunted)) {
                player.hunted[person] = {};
            }
            for (e in effect.hunt) {
                player.hunted[person][e] = effect.hunt[e];
            }
        }
        if ("save" in effect && effect.save === true) {
            this.saveGame(src, "sure");
        }
        
        return out;
    };
    this.checkNPCRequisites = function(src, topic, lists, silent, person) {
        var player = getAvatar(src);
        var req, r, l, v;
        var loops = 0;
        
        for (l = 0; l < lists.length; l++) {
            if (lists[l] in topic) {
                loops++;
            } else {
                break;
            }
        }
        
        var reqMessages = [], deny, warnings;
        
        for (l = 0; l < loops; ++l) {
            req = topic[lists[l]];
            warnings = [];
            deny = false;
            if ("chance" in req && Math.random() > req.chance) {
                deny = true;
            }
            if ("classes" in req && req.classes.indexOf(player.job) === -1) {
                deny = true;
            }
            if ("level" in req && player.level < req.level) {
                deny = true;
            }
            if ("maxlevel" in req && player.level > req.maxlevel) {
                deny = true;
            }
            if ("events" in req) {
                for (r in req.events) {
                    var ev = req.events[r];
                    v = r in player.events ? player.events[r] : false;
                    if (ev !== v) {
                        deny = true;
                    }
                }
            }
            if ("gold" in req && player.gold < req.gold) {
                deny = true;
            }
            if ("items" in req) {
                for (r in req.items) {
                    if (!this.hasItem(player, r, req.items[r])) {
                        deny = true; 
                    }
                }
            }
            if ("maxitems" in req) {
                for (r in req.maxitems) {
                    if (this.hasItem(player, r, req.maxitems[r] + 1)) {
                        deny = true; 
                    }
                }
            }
            if ("attributes" in req) {
                var att = ["hp", "mp", "str", "def", "spd", "dex", "mag"];
                for (r in req.attributes) {
                    if (att.indexOf(r) !== -1 && player[r] < req.attributes[r]) {
                        deny = true;
                    }
                }
            }
            if ("skills" in req) {
                for (r in req.skills) {
                    if (!player.skills[r] || player.skills[r] < req.skills[r]) {
                        deny = true;
                    }
                }
            }
            if ("noSkillPoints" in req && req.noSkillPoints === true) {
                var points = 0;
                for (r in classes[player.job].skills) {
                    points += skills[r].levels - player.skills[r];
                }
                if (player.skillPoints > 0 && points > 0) {
                    warnings.push("use all your Skill Points");
                    deny = true;
                }
            }
            var huntNeeded;
            if ("defeated" in req) {
                huntNeeded = [];
                for (r in req.defeated) {
                    if (!(r in player.defeated)) {
                        player.defeated[r] = 0;
                        huntNeeded.push(req.defeated[r] + " " + monsters[r].name + "(s)");
                    } else if (player.defeated[r] < req.defeated[r]) {
                        huntNeeded.push((req.defeated[r] - player.defeated[r]) + " " + monsters[r].name + "(s)");
                    }
                }
                if (huntNeeded.length > 0) {
                    deny = true;
                    warnings.push("defeat " + readable(huntNeeded, "and"));
                }
            }
            if ("hunt" in req) {
                huntNeeded = [];
                if (!(person in player.hunted)) {
                    player.hunted[person] = {};
                    for (r in req.hunt) {
                        player.hunted[person][r] = 0;
                    }
                } 
                for (r in req.hunt) {
                    if (!(r in player.hunted[person])) {
                        player.hunted[person][r] = 0;
                        huntNeeded.push(req.hunt[r] + " " + monsters[r].name + "(s)");
                    } else if (player.hunted[person][r] < req.hunt[r]) {
                        huntNeeded.push((req.hunt[r] - player.hunted[person][r]) + " " + monsters[r].name + "(s)");
                    }
                }
                if (huntNeeded.length > 0) {
                    deny = true;
                    warnings.push("hunt " + readable(huntNeeded, "and"));
                }
            }
            if ("quests" in req) {
                var q, qp;
                for (r in req.quests) {
                    q = req.quests[r];
                    qp = player.quests[r] || 0;
                    if (Array.isArray(q)) {
                        if (qp < q[0] || qp > q[1]) {
                            deny = true;
                            break;
                        }
                    } else {
                        if (qp !== q) {
                            deny = true;
                            break;
                        }
                    }
                }
            }
            if ("titles" in req) {
                for (r in req.titles) {
                    v = player.titles.indexOf(r) !== -1;
                    if (req.titles[r] !== v) {
                        deny = true;
                    }
                }
            }
            
            if (deny) {
                reqMessages.push(warnings);
                continue;
            }
            return l + 1;
        }
        
        if (loops > 0) {
            if (!silent) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                for (l in reqMessages) {
                    if (reqMessages[l].length > 0) {
                        rpgbot.sendMessage(src, "You need to " + readable(reqMessages, "and"), rpgchan);
                    }
                }
            }
            return 0;
        }
        return 1;
    };
    this.exploreLocation = function(src) {
        var player = getAvatar(src);
        
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
        if (!("content" in places[player.location]) || Object.keys(places[player.location].content).length < 1) {
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
                if (!this.canHoldItems(player, this.getItemCount(player, item) + 1)) {
                    rpgbot.sendMessage(src, "You found 1 " + items[item].name + ", but you can't carry more than " + this.getItemLimit(player) + "!", rpgchan);
                    return;
                }
                rpgbot.sendMessage(src, "You found 1 " + items[item].name + "!", rpgchan);
                this.changeItemCount(player, item, 1);
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
        var player = getAvatar(src);
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "You are dead! Type /revive to respawn!", rpgchan);
            return;
        }
        if (player.isBattling === true) {
            rpgbot.sendMessage(src, "You are already battling! Finish this battle before you challenge someone!", rpgchan);
            return;
        }
        if (commandData === "*" && duelChallenges[player.name] !== undefined) {
            rpgbot.sendMessage(src, "You cancelled your challenge!", rpgchan);
            duelChallenges[player.name] = undefined;
            return;
        } else if (commandData === "on") {
            player.canChallenge = true;
            rpgbot.sendMessage(src, "Now accepting challenges from other players!", rpgchan);
            return;
        } else if (commandData === "off") {
            player.canChallenge = false;
            rpgbot.sendMessage(src, "Now rejecting challenges from other players!", rpgchan);
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
        var opponent = getAvatar(targetId);
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
        if (opponent.canChallenge === false) {
            rpgbot.sendMessage(src, "This person is not accepting challenges!", rpgchan);
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
                if (places[player.location].noParty !== true && player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
                    team1 = this.findParty(player.party).findMembersNear(src);
                } else {
                    team1 = [[src], [player]];
                }
                
                if (places[opponent.location].noParty !== true && opponent.party && this.findParty(opponent.party) && this.findParty(opponent.party).isMember(targetId)) {
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
                var names1 = team1[1].map(getTitlePlayer, this);
                var names2 = team2[1].map(getTitlePlayer, this);
                
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
        monster.forceSave = data.forceSave || false;
        monster.isSummon = false;
        
        return monster;
    };
    this.startBattle = function(viewers, team1, team2) {
        var battle = new Battle(viewers, team1, team2, this);
        var names1 = [];
        var names2 = [];
        var player;
        for (var p in team1) {
            player = team1[p];
            names1.push(player.name + (player.defenseElement !== "none" ? " [" + cap(player.defenseElement) + "]" : ""));
            if (player.isPlayer) {
                player.isBattling = true;
            }
        }
        for (p in team2) {
            player = team2[p];
            names2.push(player.name + (player.defenseElement !== "none" ? " [" + cap(player.defenseElement) + "]" : ""));
            if (player.isPlayer) {
                player.isBattling = true;
            }
        }
        
        battle.sendToViewers("A battle between " + readable(names1, "and") + " and " + readable(names2, "and") + " has started!", true);
        
        this.currentBattles.push(battle);
    };
    this.fleeBattle = function(src) {
        var player = getAvatar(src);
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
    this.quitBattle = function(src, skipSave) {
        var player = getAvatar(src);
        if (player.isBattling) {
            rpgbot.sendMessage(src, "You ran away from a battle!", rpgchan);
        }
        var forceSave = false;
        for (var b in this.currentBattles) {
            if (this.currentBattles[b].isInBattle(src)) {
                if (this.currentBattles[b].forceSave === true) {
                    forceSave = true;
                }
                this.currentBattles[b].removePlayer(src);
            }
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
        if (forceSave === true && skipSave !== true) {
            this.saveGame(src);
        }
    };
    this.reviveSelf = function(src) {
        var player = getAvatar(src);
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
            /* if (getAvatar(src).isBattling === true) {
                rpgbot.sendMessage(src, "Finish this battle first!", rpgchan);
                return;
            } */
            for (b in this.currentBattles) {
                bat = this.currentBattles[b];
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
            getAvatar(src).watchableBattles = true;
            return;
        } else if (commandData === "off") {
            rpgbot.sendMessage(src, "Other players can't watch your battles!", rpgchan);
            getAvatar(src).watchableBattles = false;
            return;
        
        }
        var id = sys.id(commandData);
        if (id === undefined) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        if (getAvatar(id) === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        var target = getAvatar(id);
        if (target.watchableBattles === false && !isRPGAdmin(src)) {
            rpgbot.sendMessage(src, "You can't watch this person's battles!", rpgchan);
            return;
        }
        if (target.isBattling === false) {
            rpgbot.sendMessage(src, "This person is not battling!", rpgchan);
            return;
        }
        /* if (getAvatar(src).location !== target.location) {
            rpgbot.sendMessage(src, "You must be in the same location as your target to watch their battles!", rpgchan);
            return;
        } */
        
        for (b in this.currentBattles) {
            bat = this.currentBattles[b];
            if (bat.viewers.indexOf(src) === -1 && (bat.team1.indexOf(target) !== -1 || bat.team2.indexOf(target) !== -1)) {
                bat.viewers.push(src);
                bat.sendToViewers(sys.name(src) + " is watching this battle!");
                return;
            }
        }
        rpgbot.sendMessage(src, "You can't watch any battle now!", rpgchan);
    };
    
    function getNumberSign(x) { 
        return (x >= 0 ? "+" + x : x); 
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
                    result.push((effect.multiplier.maxhp > 0 ? "+" : "") + Math.round(effect.multiplier.maxhp * 100) + "% Max HP");
                }
                if ("maxmp" in effect.multiplier) {
                    result.push((effect.multiplier.maxmp > 0 ? "+" : "") + Math.round(effect.multiplier.maxmp * 100) + "% Max Mana");
                }
                if ("str" in effect.multiplier) {
                    result.push((effect.multiplier.str > 0 ? "+" : "") + Math.round(effect.multiplier.str * 100) + "% Str");
                }
                if ("def" in effect.multiplier) {
                    result.push((effect.multiplier.def > 0 ? "+" : "") + Math.round(effect.multiplier.def * 100) + "% Def");
                }
                if ("spd" in effect.multiplier) {
                    result.push((effect.multiplier.spd > 0 ? "+" : "") + Math.round(effect.multiplier.spd * 100) + "% Spd");
                }
                if ("dex" in effect.multiplier) {
                    result.push((effect.multiplier.dex > 0 ? "+" : "") + Math.round(effect.multiplier.dex * 100) + "% Dex");
                }
                if ("mag" in effect.multiplier) {
                    result.push((effect.multiplier.mag > 0 ? "+" : "") + Math.round(effect.multiplier.mag * 100) + "% Mag");
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
            if ("attackSpeed" in effect) {
                result.push((effect.attackSpeed > 1 ? "+" : "") + Math.round((effect.attackSpeed-1) * 100) + "% Attack Speed");
            }
            if ("hpabsorb" in effect) {
                result.push((effect.hpabsorb > 0 ? "+" : "") + Math.round(effect.hpabsorb * 100) + "% Damage absorbed as HP");
            }
            if ("mpabsorb" in effect) {
                result.push((effect.mpabsorb > 0 ? "+" : "") + Math.round(effect.mpabsorb * 100) + "% Damage absorbed as MP");
            }
            if ("hpdamage" in effect) {
                result.push((effect.hpdamage > 0 ? "+" : "") + effect.hpdamage + " HP per turn");
            }
            if ("mpdamage" in effect) {
                result.push((effect.mpdamage > 0 ? "+" : "") + effect.mpdamage + " Mana per turn");
            }
        }
        return "[" + result.join(", ") + "]";
    }
    this.useItem = function(src, commandData) {
        var player = getAvatar(src);
        var out;
        if (commandData === "*") {
            out = [];
            
            this.viewItems(src, "all");
            
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
        
        if (!this.hasItem(player, it, 1)) {
            if (it in altItems && this.hasItem(player, altItems[it], 1)) {
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
            this.changeItemCount(player, it, amm);
            rpgbot.sendMessage(src, "You have dropped " + Math.abs(amm) + " " + item.name + "(s)!", rpgchan);
            return;
        }
        
        if (item.level > player.level) {
            rpgbot.sendMessage(src, "You need to be at least level " + item.level + " to use this item!", rpgchan);
            return;
        }
        
        if (this.canUseItem(player, it) === false) {
            rpgbot.sendMessage(src, "You can't use this item as " + classes[player.job].name + "!", rpgchan);
            return;
        }
        
        sys.sendMessage(src, "", rpgchan);
        if (item.type === "usable") {
            var startingHp = player.hp, startingMp = player.mp;
            if (item.effect) {
                out = this.applyEffect(src, item.effect);
                startingHp = Math.abs(startingHp - player.hp);
                startingMp = Math.abs(startingMp - player.mp);
            }
            rpgbot.sendMessage(src, item.message.replace(/~Life~/g, player.hp).replace(/~Mana~/g, player.mp).replace(/~LifeGained~/g, startingHp).replace(/~ManaGained~/g, startingMp).replace(/~Place~/g, places[player.location].name), rpgchan);
            
            if (out && out.length > 0) {
                for (var o in out) {
                    rpgbot.sendMessage(src, out[o], rpgchan);
                }
            }
            this.changeItemCount(player, it, -1);
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
    this.showEquipment = function(src, type) {
        var player = getAvatar(src);
        sys.sendMessage(src, "Equipped Items:", rpgchan);
        for (var i in player.equips) {
            if (type === "*" || type === i) {
                if (player.equips[i] !== null && !(player.equips[i] in items)) {
                    sys.sendMessage(src, equipment[i] + ": Invalid item '" + player.equips[i] + "' found! Contact an RPG Admin to fix the issue!", rpgchan);
                } else {
                    sys.sendMessage(src, equipment[i] + ": " + (player.equips[i] === null ? (i === "lhand" && player.equips.rhand !== null && items[player.equips.rhand].slot === "2-hands" ? items[player.equips.rhand].name : "Nothing") : items[player.equips[i]].name + " - " + items[player.equips[i]].info + " " + getEquipAttributes(player.equips[i], true)), rpgchan);
                }
            }
        }
    };
    this.viewItems = function(src, commandData) {
        var player = getAvatar(src);
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
        var showEquip = null;
        var headerAdded = false;
        
        try {
            ordered = data === "storage" ? Object.keys(player.storage).sort(sortByName) : Object.keys(player.items).sort(sortByName);
            if (data === "storage") {
                data = "all";
                itemSource = player.storage;
            }
        } catch (err) {
            rpgbot.sendMessage(src, "You have an invalid item, so you can't use this command! Contact an RPG admin for help.", rpgchan);
            sys.sendMessage(src, "Invalid items:", rpgchan);
            for (var i in itemSource) {
                if (!(i in items)) {
                    rpgbot.sendMessage(src, i + " (x" + itemSource[i] + ")", rpgchan);
                }
            }
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
            showEquip = "*";
            
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
                    if (!headerAdded) {
                        out.push("Usable Items:");
                        headerAdded = true;
                    }
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info);
                }
            }
            noCategory = false;
        } else if (data === "equipment" || data === "equip") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type === "equip") {
                    if (!headerAdded) {
                        out.push("Equipable Items:");
                        headerAdded = true;
                    }
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info + " " + getEquipAttributes(id));
                    showEquip = "*";
                }
            }
            noCategory = false;
        } else if (data === "key") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type === "key") {
                    if (!headerAdded) {
                        out.push("Key Items:");
                        headerAdded = true;
                    }
                    out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info);
                }
            }
            noCategory = false;
        } else if (data === "other") {
            for (i in ordered) {
                id = ordered[i];
                item = items[id];
                if (item.type !== "usable" && item.type !== "equip" && item.type !== "key") {
                    if (!headerAdded) {
                        out.push("Other Items:");
                        headerAdded = true;
                    }
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
                            if (!headerAdded) {
                                out.push("Items for " + equipment[e] + ":");
                                headerAdded = true;
                            }
                            out.push(itemSource[id] + "x " + items[id].name + " (" + id + "): " + items[id].info + " " + getEquipAttributes(id));
                            showEquip = e;
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
        if (showEquip !== null) {
            this.showEquipment(src, showEquip);
        }
    };
    this.removeEquip = function(src, item) {
        var equips = getAvatar(src).equips;
        
        for (var e in equips) {
            if (equips[e] === item) {
                equips[e] = null;
            }
        }
        this.updateBonus(src);
    };
    this.requestTrade = function(src, commandData) {
        var player = getAvatar(src);
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
        if (getAvatar(targetId) === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        
        var target = getAvatar(targetId);
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
            if (!this.hasItem(player, itemOffered, amountOffered)) {
                rpgbot.sendMessage(src, "You don't have " + (amountOffered > 1 ? amountOffered + " of ": "") + "this item!", rpgchan);
                return;
            }
            if (items[itemOffered].noTrade && items[itemOffered].noTrade === true) {
                rpgbot.sendMessage(src, "This item cannot be traded!", rpgchan);
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
            if (items[itemWanted].noTrade && items[itemWanted].noTrade === true) {
                rpgbot.sendMessage(src, "This item cannot be traded!", rpgchan);
                return;
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
                } else if (!this.canHoldItems(target, this.getItemCount(target, itemOffered) + amountOffered)) {
                    rpgbot.sendMessage(src, "Trade cancelled because " + targetName + " can't hold more than " + this.getItemLimit(target) + " " + itemOffered + "(s)!", rpgchan);
                    rpgbot.sendMessage(targetId, "Trade cancelled because you can't hold more than " + this.getItemLimit(target) + " " + itemOffered + "(s)!", rpgchan);
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
                } else if (!this.canHoldItems(player, this.getItemCount(player, itemWanted) + amountWanted)) {
                    rpgbot.sendMessage(targetId, "Trade cancelled because " + playerName + " can't hold more than " + this.getItemLimit(player) + " " + itemWanted + "(s)!", rpgchan);
                    rpgbot.sendMessage(src, "Trade cancelled because you can't hold more than " + this.getItemLimit(player) + " " + itemWanted + "(s)!", rpgchan);
                    tradeRequests[playerName] = undefined;
                    tradeRequests[targetName] = undefined;
                    return;
                }
                
                // Trade the items/gold
                if (typeof itemOffered === "number") {
                    player.gold -= itemOffered;
                    target.gold += itemOffered;
                } else {
                    this.changeItemCount(player, itemOffered, -amountOffered);
                    this.changeItemCount(target, itemOffered, amountOffered);
                }
                if (typeof itemWanted === "number") {
                    target.gold -= itemWanted;
                    player.gold += itemWanted;
                } else {
                    this.changeItemCount(target, itemWanted, -amountWanted);
                    this.changeItemCount(player, itemWanted, amountWanted);
                }
                
                rpgbot.sendMessage(src, "You traded your " + offer + " with " + targetName + "'s " + wanted + "!", rpgchan);
                rpgbot.sendMessage(targetId, "You traded your " + wanted + " with " + playerName + "'s " + offer + "!", rpgchan);
                
                tradeRequests[playerName] = undefined;
                tradeRequests[targetName] = undefined;
                
                if (typeof itemOffered === "string" && !this.hasItem(player, itemOffered, 1)) {
                    this.removeEquip(src, itemOffered);
                }
                if (typeof itemWanted === "string" && !this.hasItem(target, itemWanted, 1)) {
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
        var player = getAvatar(src);
        var targetId = sys.id(commandData);
        if (targetId === undefined) {
            rpgbot.sendMessage(src, "No such player!", rpgchan);
            return;
        }
        var target = getAvatar(targetId);
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
        var player = getAvatar(src);
        
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
            if (this.hasItem(player, item, amount)) {
                this.changeItemCount(player, item, -amount);
                this.changeStorageCount(player, item, amount);
                return true;
            } 
        } else if (amount < 0) {
            if (item in player.storage && player.storage[item] >= (-amount)) {
                if (!this.canHoldItems(player, this.getItemCount(player, item) + (-amount))) {
                    return false;
                }
                this.changeStorageCount(player, item, amount);
                this.changeItemCount(player, item, -amount);
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
    
    this.changeItemCount = function(player, item, amount) {
        if (!(item in player.items)) {
            player.items[item] = 0;
        }
        player.items[item] += amount;
        if (!this.canHoldItems(player, player.items[item])) {
            player.items[item] = this.getItemLimit(player);
        }
        if (player.items[item] <= 0) {
            game.removeEquip(player.id, item);
            delete player.items[item];
        }
    };
    this.changeStorageCount = function(player, item, amount) {
        if (!(item in player.storage)) {
            player.storage[item] = 0;
        }
        player.storage[item] += amount;
        if (player.storage[item] <= 0) {
            delete player.storage[item];
        }
    };
    this.hasItem = function(player, item, amount) {
        var count = amount || 1;
        if (!(item in player.items)) {
            return false;
        } else if (player.items[item] >= count) {
            return true;
        }
        return false;
    };
    this.getItemCount = function(player, item) {
        if (!(item in player.items)) {
            return 0;
        } else {
            return player.items[item];
        }
    };
    this.getItemLimit = function(player) {
        return leveling.items + player.level * leveling.itemsPerLevel;
    };
    this.canHoldItems = function(player, amount) {
        if (leveling.items === 0 && leveling.itemsPerLevel === 0) {
            return true;
        }
        if (amount > leveling.items + player.level * leveling.itemsPerLevel) {
            return false;
        } else {
            return true;
        }
    };
    this.canUseItem = function(player, it) {
        if (!("classes" in items[it])) {
            return true;
        } else {
            var item = items[it];
            var canUseClasses = [];
            var name, c;
            
            if (item.classes.indexOf(player.job) !== -1) {
                return true;
            }
            
            for (c in item.classes) {
                name = item.classes[c];
                if (name[0] === "*") {
                    name = name.substring(1);
                    if (name in classSets) {
                        canUseClasses = canUseClasses.concat(classSets[name]);
                    }
                } else {
                    canUseClasses.push(name);
                }
            }
            
            var allowedClasses = getPassiveClasses(player, "itemsFromClass");
            allowedClasses.push(player.job);
            for (c in allowedClasses) {
                if (canUseClasses.indexOf(allowedClasses[c]) !== -1) {
                    return true;
                }
            }
            
            return false;
        }
    };
    
    function getTitleName(src) {
        var player = getAvatar(src);
        return (player.currentTitle !== null && player.currentTitle in titles ? titles[player.currentTitle].name + " " : "") + player.name;
    }
    function getTitlePlayer(player) {
        return (player.currentTitle !== null && player.currentTitle in titles ? titles[player.currentTitle].name + " " : "") + player.name;
    }
    
    this.receiveExp = function(src, commandData) {
        var player = getAvatar(src);
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
            rpgbot.sendAll(getTitleName(src) + "'s Level increased from " + player.level + " to " + e + "!", rpgchan);
            
            player.levelUpDate = new Date().getTime();
            
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
        var player = getAvatar(src);
        if (player.hp === 0) {
            rpgbot.sendMessage(src, "Revive before using this command!", rpgchan);
            return;
        }
        
        var what = data[0].toLowerCase();
        var attributes = ["hp", "mana", "mp", "str", "strength", "def", "defense", "spd", "speed", "dex", "dexterity", "mag", "magic"];
        var amount;
        amount = data.length > 1 ? parseInt(data[1], 10) : 1;
        amount = isNaN(amount) ? 1 : amount;
        
        if (amount < 0) {
            rpgbot.sendMessage(src, "That's not a valid amount!", rpgchan);
            return;
        }
        
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
            var s;
            if (skills[what].requisites) {
                var denymsg = [];
                var req = skills[what].requisites;
                if (req.level && player.level < req.level) {
                    denymsg.push("You need to be at least level " + req.level + " to learn this skill!");
                }
                if (req.maxhp && player.maxhp < req.maxhp) {
                    denymsg.push("You need at least " + req.maxhp + " HP to learn this skill!");
                }
                if (req.maxmp && player.maxmp < req.maxmp) {
                    denymsg.push("You need at least " + req.maxmp + " Mana to learn this skill!");
                }
                if (req.str && player.str < req.str) {
                    denymsg.push("You need at least " + req.str + " Strength to learn this skill!");
                }
                if (req.def && player.def < req.def) {
                    denymsg.push("You need at least " + req.def + " Defense to learn this skill!");
                }
                if (req.spd && player.spd < req.spd) {
                    denymsg.push("You need at least " + req.spd + " Speed to learn this skill!");
                }
                if (req.dex && player.dex < req.dex) {
                    denymsg.push("You need at least " + req.dex + " Dexterity to learn this skill!");
                }
                if (req.mag && player.mag < req.mag) {
                    denymsg.push("You need at least " + req.mag + " Magic to learn this skill!");
                }
                if (req.skill) {
                    for (s in req.skill) {
                        if (!(s in player.skills) || player.skills[s] < req.skill[s]) {
                            denymsg.push("You need the skill " + skills[s].name + " at least at level " + req.skill[s] + " to learn this skill!");
                        }
                    }
                }
				
                if (denymsg.length > 0) {
                    for (s in denymsg) {
                        rpgbot.sendMessage(src, denymsg[s], rpgchan);
                    }
                    return;
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
            this.addSkillPoint(src, what, amount, false);
            player.skillPoints -= amount;
            
            rpgbot.sendMessage(src, "You increased your " + skills[what].name + " skill to level " + player.skills[what] + "!", rpgchan);
        }
    };
    this.setBattlePlan = function(src, commandData) {
        var player = getAvatar(src);
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
                    commandData = commandData.substring(commandData.indexOf(" ") + 1);
                    commandData = commandData.substring(commandData.indexOf(" ") + 1);
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
        var player = getAvatar(src);
        
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
    this.setSkillLevel = function(src, commandData) {
        var player = getAvatar(src);
        
        if (commandData === "*") {
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "You will use the following skills at these levels:", rpgchan);
            for (var x in player.skillLevels) {
                rpgbot.sendMessage(src, skills[x].name + ": " + (player.skillLevels[x] >= player.skills[x] ? player.skills[x] + " (Max)" : player.skillLevels[x]), rpgchan);
            }
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "To use a skill on a level below than you have it, use /setskill skill:level", rpgchan);
            return;
        }
        
        var data = commandData.split(":");
        
        if (data.length < 2) {
            rpgbot.sendMessage(src, "Incorrect format! Use /setskill skill:level.", rpgchan);
            return;
        }
        var skill = data[0];
        var level = parseInt(data[1], 10);
        
        if (!(skill in skills)) {
            if (skill in altSkills) {
                skill = altSkills[skill];
            } else {
                rpgbot.sendMessage(src, "Invalid skill.", rpgchan);
                return;
            }
        }
        if (skills[skill].type === "passive") {
            rpgbot.sendMessage(src, "Cannot set level for Passive skills.", rpgchan);
            return;
        }
        if (!(skill in player.skills) || player.skills[skill] === 0) {
            rpgbot.sendMessage(src, "You don't have such skill.", rpgchan);
            return;
        }
        if (isNaN(level) || level < 1) {
            rpgbot.sendMessage(src, "Invalid value for skill level.", rpgchan);
            return;
        }
        
        player.skillLevels[skill] = level;
        if (level > player.skills[skill]) {
            rpgbot.sendMessage(src, "Your level for skill " + skills[skill].name + " is lower than " + level + ", so you will use it at the maximum level available for you.", rpgchan);
        } else {
            rpgbot.sendMessage(src, "You will now use the skill " + skills[skill].name + " at level " + level + ".", rpgchan);
        }
    };
    this.setPassiveSkills = function(src, commandData) {
        var player = getAvatar(src);
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNamesLevels(player.passives) + "!", rpgchan);
            rpgbot.sendMessage(src, "To change your current passive skills, type /passive skill1:skill2. To clear your passive skills, use '/passive clear'.", rpgchan);
            return;
        }
        
        var data = commandData.split(":");
        var obj = {};
        var skill, s, info, level;
        
        if (data.length > battleSetup.passive) {
            rpgbot.sendMessage(src, "You can only set up to " + battleSetup.passive + " passive skills!", rpgchan);
            return;
        }
        if (data[0].toLowerCase() === "clear") {
            player.passives = {};
            rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNamesLevels(player.passives) + "!", rpgchan);
        
            for (s in player.equips) {
                if (player.equips[s] !== null && this.canUseItem(player, player.equips[s]) === false) {
                    rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                    player.equips[s] = null;
                }
            }
            
            this.updateBonus(src);
            return;
        }
        for (s in data) {
            info = data[s].split("*");
            skill = info[0].toLowerCase();
            
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
            level = info.length > 1 && !isNaN(parseInt(info[1], 10)) ? parseInt(info[1], 10) : player.skills[skill];
            if (level < 1 || level > player.skills[skill]) {
                level = player.skills[skill];
            }
            
            obj[skill] = level;
        }
        
        player.passives = obj;
        
        rpgbot.sendMessage(src, "Your current passive skills are " + getSkillsNamesLevels(player.passives) + "!", rpgchan);
        
        for (s in player.equips) {
            if (player.equips[s] !== null && this.canUseItem(player, player.equips[s]) === false) {
                rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                player.equips[s] = null;
            }
        }
        
        this.updateBonus(src);
    };
    this.addSkillPoint = function(src, skill, amount, remove) {
        this.changeSkillLevel(src, skill, getAvatar(src).skills[skill] + amount, remove);
    };
    this.changeSkillLevel = function(src, skill, amount, remove) {
        var player = getAvatar(src), old;
        
        if (amount > skills[skill].levels) {
            amount = skills[skill].levels;
        } else if (amount < 0) {
            amount = 0;
        }
        old = player.skills[skill];
        player.skills[skill] = amount;
        
        this.updatePlayerSkill(src, skill, old, remove);
    };
    this.updatePlayerSkill = function(src, skill, old, remove) {
        var player = getAvatar(src), s;
        var amount = player.skills[skill] || 0;
        
        if (skill in player.passives) {
            if (amount === 0) {
                delete player.passives[skill];
            } else if (player.passives[skill] === old) {
                player.passives[skill] = player.skills[skill];
            }
            
            for (s in player.equips) {
                if (player.equips[s] !== null && this.canUseItem(player, player.equips[s]) === false) {
                    rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                    player.equips[s] = null;
                }
            }
        }
        
        if (amount === 0) {
            if (skill in player.strategy) {
                delete player.strategy[skill];
            }
            for (s in player.plans) {
                if (skill in player.plans[s]) {
                    delete player.plans[s][skill];
                }
            }
            if (skill in player.skillLevels) {
                delete player.skillLevels[skill];
            }
        }
        
        if (remove) {
            delete player.skills[skill];
        }
        
        this.updateBonus(src);
    };
    function getSkillsNamesLevels(obj) {
        var list = [];
        for (var x in obj) {
            list.push(skills[x].name + " (Lv. " + obj[x] + ")");
        }
        if (list.length === 0) {
            return "not set";
        }
        return readable(list, "and");
    }
    this.changePlayerClass = function(player, job) {
        if (job !== player.job) {
            player.job = job;
            
            for (var s in player.skills) {
                if (!(s in classes[job].skills) && player.skills[s] === 0 && leveling.skillFromOtherClass === false) {
                    delete player.skills[s];
                }
            }
            
            for (s in classes[job].skills) {
                if (!(s in player.skills)) {
                    player.skills[s] = classes[job].skills[s];
                }
            }
            
            for (s in player.equips) {
                if (player.equips[s] !== null && this.canUseItem(player, player.equips[s]) === false) {
                    player.equips[s] = null;
                }
            }
            
            this.updateBonus(player.id);
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
        var player = getAvatar(src);
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
        var action = data[0].toLowerCase();
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
                    this.currentParties[target] = new Party(src, target, this);
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
    this.updateParties = function() {
        for (var p in this.currentParties) {
            this.currentParties[p].updateContent(this);
        }
    };
    this.findParty = function(name) {
        if (name in this.currentParties) {
            return this.currentParties[name];
        }
        return null;
    };
    this.talkToParty = function(src, commandData) {
        var player = getAvatar(src);
        
        if (!player.party) {
            rpgbot.sendMessage(src, "You are not in any party!", rpgchan);
            return;
        }
        var party = this.findParty(player.party);
        if (party) {
            party.broadcast(commandData, null, sys.name(src));
        } else {
            rpgbot.sendMessage(src, "You are in an invalid party!", rpgchan);
            return;
        }
        
    };
    
    this.startGame = function(src, commandData) {
        var user = SESSION.users(src);
        
        if (!sys.dbRegistered(sys.name(src))) {
            rpgbot.sendMessage(src, "You need to register before starting a game!", rpgchan);
            return;
        }
        if (user[rpgAtt] !== undefined) {
            rpgbot.sendMessage(src, "You already have a character!", rpgchan);
            return;
        }
        if (startup.classes.indexOf(commandData.toLowerCase()) === -1) {
            rpgbot.sendMessage(src, "To create a character, type /start [class]. Possible classes are " + readable(startup.classes, "or") + ".", rpgchan);
            return;
        }
        
        var job = classes[commandData.toLowerCase()];
        user[rpgAtt] = this.createChar(job);
        
        var player = user[rpgAtt];
        
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
        
        player.skillLevels = {};
        
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
        player.canChallenge = true;
        player.fontSize = 11;
        player.description = "";
        
        player.events = {};
        player.defeated = {};
        player.hunted = {};
        
        player.quests = {};
        player.titles = [];
        player.currentTitle = null;
        player.updateReset = true;
        
        this.updateBonus(src);
        
        sys.sendMessage(src, "", rpgchan);
        rpgbot.sendMessage(src, "Character successfully created!", rpgchan);
        this.changeLocation(src, player.location, "spawned at");
        sys.sendMessage(src, "", rpgchan);
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
        
        if (user[rpgAtt] === null) {
            rpgbot.sendMessage(src, "You have no character to save!", rpgchan);
            return;
        }
        
        var savename = user[rpgAtt].name.toLowerCase();
        
        /* if (!sys.dbRegistered(savename)) {
            rpgbot.sendMessage(src, "You need to register before saving your game!", rpgchan);
            return;
        } */
        
        if (user[rpgAtt].isBattling) {
            rpgbot.sendMessage(src, "Finish this battle before saving your game!", rpgchan);
            return;
        }
        
        if (commandData !== undefined && commandData.toLowerCase() !== "sure") {
            var currentGame = sys.getFileContent(savefolder + "/" + escape(savename) + ".json");
            if (currentGame !== undefined && user[rpgAtt].exp < JSON.parse(currentGame).exp) {
                rpgbot.sendMessage(src, "Warning: You already have a saved character with more Exp. Points! If you want to overwrite it, use '/savechar sure'.", rpgchan);
                return;
            }
        }
        
        sys.makeDir(savefolder);
        sys.writeToFile(savefolder + "/" + escape(savename) + ".json", JSON.stringify(user[rpgAtt]));
        
        rpgbot.sendMessage(src, "Game saved as " + savename + "! Use /loadchar to load your progress!", rpgchan);
    };
    this.loadGame = function(src) {
        var user = SESSION.users(src);
        if (user[rpgAtt] !== undefined) {
            rpgbot.sendMessage(src, "You already have a character loaded!", rpgchan);
            return;
        }
        
        var savename = sys.name(src).toLowerCase();
        
        if (!sys.dbRegistered(savename)) {
            rpgbot.sendMessage(src, "You need to register before loading a game!", rpgchan);
            return;
        }
        
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
        
        var playerson = sys.playerIds(), id;
        for (var p in playerson) {
            id = playerson[p];
            if (SESSION.users(id) && getAvatar(id) && getAvatar(id).name && getAvatar(id).name.toLowerCase() === sys.name(src).toLowerCase()) {
                rpgbot.sendMessage(src, "This character is already being used!", rpgchan);
                return;
            }
        }
        
        if (!(gamefile.job in classes)) {
            rpgbot.sendMessage(src, "This character has an invalid class, so you cannot load it!", rpgchan);
            return;
        }
        
        gamefile = this.convertChar(gamefile);
        
        user[rpgAtt] = gamefile;
        user[rpgAtt].id = src;
        user[rpgAtt].party = null;
        rpgbot.sendMessage(src, "Your character has been loaded successfully!", rpgchan);
    };
    this.convertChar = function(gamefile) {
        var file = gamefile;
        
        var i;
        
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
            }
        }
        if (!file.publicStats) {
            file.publicStats = false;
        }
        if (!file.canChallenge) {
            file.canChallenge = true;
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
        if (!file.quests) {
            file.quests = {};
        }
        if (!file.titles) {
            file.titles = [];
            file.currentTitle = null;
        }
        
        if (!file.levelUpDate) {
            file.levelUpDate = new Date().getTime();
        }
        
        if (!file.skillLevels) {
            file.skillLevels = {};
        }
        
        if (!file.updateReset) {
            file = this.resetCharData(file);
            file.updateReset = true;
        }
        
        return file;
    };
    this.clearChar = function(src) {
        var user =  SESSION.users(src);
        
        if (user[rpgAtt].isBattling) {
            rpgbot.sendMessage(src, "Finish this battle first!", rpgchan);
            return;
        }
        
        this.removePlayer(src);
        
        user[rpgAtt] = undefined;
        rpgbot.sendMessage(src, "Character successfully cleared!", rpgchan);
    };
    this.resetChar = function(src) {
        var player = getAvatar(src);
        
        if (player.isBattling) {
            rpgbot.sendMessage(src, "Finish this battle first!", rpgchan);
            return;
        }
        
        this.resetStats(src);
        this.resetSkills(src);
        rpgbot.sendMessage(src, "Stats/Skills reset!", rpgchan);
    };
    this.resetStats = function(src) {
        var player = getAvatar(src);
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
        var player = getAvatar(src);
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
        player.skillLevels = {};
        
        player.skillPoints = startup.skills + leveling.skills * (player.level - 1);
        
        for (e in player.equips) {
            if (player.equips[e] !== null && this.canUseItem(player, player.equips[e]) === false) {
                rpgbot.sendMessage(src, items[player.equips[e]].name + " unequipped!", rpgchan);
                player.equips[e] = null;
            }
        }
        
        this.updateBonus(src);
    };
    this.resetCharData = function(player) {
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
        
        player.skills = {};
        for (e in data.skills) {
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
        player.skillLevels = {};
        
        player.skillPoints = startup.skills + leveling.skills * (player.level - 1);
        
        for (e in player.equips) {
            if (player.equips[e] !== null && this.canUseItem(player, player.equips[e]) === false) {
                player.equips[e] = null;
            }
        }
        
        return player;
    };
    this.punishPlayer = function(src, commandData) {
        if (["ricekirby", "thepiggy"].indexOf(sys.name(src).toLowerCase()) === -1) {
            rpgbot.sendMessage(src, "You cannot use this command!", rpgchan);
            return;
        }
        
        var data, player, id, name, levels, newClass;
        data = commandData.split(":");
        if (data.length < 2) {
            rpgbot.sendMessage(src, "Incorrect format! Use /punish name:levels to be reduced.", rpgchan);
            return;
        }
        
        name = data[0].toLowerCase();
        levels = parseInt(data[1], 10);
        
        if (isNaN(levels)) {
            rpgbot.sendMessage(src, "You must define a valid number for the levels you want to remove!", rpgchan);
            return;
        }
        
        if (data.length > 2) {
            newClass = data[2].toLowerCase();
            if (!(newClass in classes)) {
                rpgbot.sendMessage(src, "No such class!", rpgchan);
                return;
            }
        }
        
        var playerson = sys.playerIds();
        var playerFound = false;
        for (var p in playerson) {
            id = playerson[p];
            if (SESSION.users(id) && getAvatar(id) && getAvatar(id).name && getAvatar(id).name.toLowerCase() === name) {
                playerFound = true;
                break;
            }
        }
        
        var charLoaded = false;
        if (playerFound) {
            player = getAvatar(id);
            charLoaded = true;
        } else {
            try {
                player = JSON.parse(sys.getFileContent(savefolder + "/" + escape(name) + ".json"));
            } catch (e) {
                rpgbot.sendMessage(src, "Error: " + e, rpgchan);
                return;
            }
        }
        
        player.level -= levels;
        if (player.level < 1) {
            player.level = 1;
        }
        if (player.level === 1) {
            player.exp = 0;
        } else {
            player.exp = expTable[player.level - 2];
        }
        
        if (newClass) {
            player.job = newClass;
        }
        
        player = this.resetCharData(player);
        
        if (charLoaded) {
            this.removePlayer(id, true);
            SESSION.users(id).rpg = player;
            getAvatar(id).location = startup.location;
            this.saveGame(id, "sure");
        } else {
            sys.makeDir(savefolder);
            sys.writeToFile(savefolder + "/" + escape(name) + ".json", JSON.stringify(player));
        }
        
        rpgbot.sendAll("Player " + name + " was punished and went back to level " + player.level + "!", rpgchan);
    };
    this.resetPlayer = function(src, commandData) {
        if (["ricekirby", "thepiggy"].indexOf(sys.name(src).toLowerCase()) === -1) {
            rpgbot.sendMessage(src, "You cannot use this command!", rpgchan);
            return;
        }
        
        var data, player, id, name, newClass;
        data = commandData.split(":");
        if (data.length < 1) {
            rpgbot.sendMessage(src, "Incorrect format! Use /reset name:class.", rpgchan);
            return;
        }
        
        name = data[0].toLowerCase();
        
        if (data.length > 1) {
            newClass = data[1].toLowerCase();
            if (!(newClass in classes)) {
                rpgbot.sendMessage(src, "No such class!", rpgchan);
                return;
            }
        }
        
        var playerson = sys.playerIds();
        var playerFound = false;
        for (var p in playerson) {
            id = playerson[p];
            if (SESSION.users(id) && getAvatar(id) && getAvatar(id).name && getAvatar(id).name.toLowerCase() === name) {
                playerFound = true;
                break;
            }
        }
        
        var charLoaded = false;
        if (playerFound) {
            player = getAvatar(id);
            charLoaded = true;
        } else {
            try {
                player = JSON.parse(sys.getFileContent(savefolder + "/" + escape(name) + ".json"));
            } catch (e) {
                rpgbot.sendMessage(src, "Error: " + e, rpgchan);
                return;
            }
        }
        
        if (newClass) {
            player.job = newClass;
        }
        
        player = this.resetCharData(player);
        
        if (charLoaded) {
            this.removePlayer(id, true);
            SESSION.users(id).rpg = player;
            getAvatar(id).location = startup.location;
            rpgbot.sendMessage(id, "Stats/Skills reset!", rpgchan);
            this.saveGame(id, "sure");
        } else {
            sys.makeDir(savefolder);
            sys.writeToFile(savefolder + "/" + escape(name) + ".json", JSON.stringify(player));
        }
    };
    this.viewStats = function(src) {
        var player = getAvatar(src);
        
        var out = [
            "",
            "Class: " + classes[player.job].name,
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
        var player = getAvatar(src);
        
        var out = ["", "Active Skills:"];
        var job = player.job;
        for (var s in player.skills) {
            if (skills[s].type !== "passive") {
                out.push(skills[s].name + " (" + s + ") : [" + player.skills[s] + "/" + skills[s].levels + "] " + skills[s].info + " (" + skills[s].cost + " Mana) " + (leveling.skillFromOtherClass === false && !(s in classes[job].skills) ? "(Skill from another class)" : ""));
            }
        }
        out.push("");
        out.push("Passive Skills:");
        for (s in player.skills) {
            if (skills[s].type === "passive") {
                out.push(skills[s].name + " (" + s + ") : [" + player.skills[s] + "/" + skills[s].levels + "] " + skills[s].info + " " + (leveling.skillFromOtherClass === false && !(s in classes[job].skills) ? "(Skill from another class)" : ""));
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
    this.viewQuests = function(src) {
        var player = getAvatar(src);
        var ongoing = [], finished = [], q, s, quest, progress;
        
        for (q in player.quests) {
            progress = player.quests[q];
            quest = quests[q];
            
            if (progress === quest.steps) {
                finished.push(quest.name + ": " + quest.messages[progress]);
            } else {
                ongoing.push(quest.name + " (" + progress + "/" + (quest.hiddenSteps !== true ? quest.steps : "??") + "): " + quest.messages[progress]);
            }
        }
        
        if (ongoing.length > 0) {
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, "Ongoing Quests (" + ongoing.length + "):", rpgchan);
            for (s in ongoing) {
                sys.sendMessage(src, ongoing[s], rpgchan);
            }
        }
        if (finished.length > 0) {
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, "Finished Quests (" + finished.length + "):", rpgchan);
            for (s in finished) {
                sys.sendMessage(src, finished[s], rpgchan);
            }
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
            if (getAvatar(src) === undefined) {
                rpgbot.sendMessage(src, "You don't even have a character!", rpgchan);
                return;
            }
            rpgbot.sendMessage(src, "Allowing other players to view your stats.", rpgchan);
            getAvatar(src).publicStats = true;
            return;
        } else if (commandData.toLowerCase() === "off") {
            if (getAvatar(src) === undefined) {
                rpgbot.sendMessage(src, "You don't even have a character!", rpgchan);
                return;
            }
            rpgbot.sendMessage(src, "Disallowing other players from viewing your stats.", rpgchan);
            getAvatar(src).publicStats = false;
            return;
        }
        
        var id = sys.id(commandData);
        if (id === undefined) {
            rpgbot.sendMessage(src, "No such person!", rpgchan);
            return;
        }
        if (getAvatar(id) === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        var target = getAvatar(id);
        if (target.publicStats !== true && !isRPGAdmin(src)) {
            rpgbot.sendMessage(src, "This person's stats are not public!", rpgchan);
            return;
        }
        var titleName = getTitlePlayer(target);
        var out = [
            "",
            titleName + "'s information:"
        ];
        if (target.description !== "") {
            out.push("Description: " + target.description);
        }
        out = out.concat([
            "Class: " + classes[target.job].name,
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
        
        out.push(titleName + "'s skills:");
        for (var i in target.skills) {
            out.push(skills[i].name + " (" + i + ") : [" + target.skills[i] + "/" + skills[i].levels + "] " + skills[i].info + (skills[i].type === "passive" ? " (Passive)" : " (" + skills[i].cost + " Mana)"));
        }
        
        out.push("");
        out.push(titleName + "'s equipment:");
        for (i in target.equips) {
            if (target.equips[i] !== null && !(target.equips[i] in items)) {
                out.push(equipment[i] + ": Invalid equipment '" + target.equips[i] + "' found! Contact an RPG Admin to fix the issue!");
            } else {
                out.push(equipment[i] + ": " + (target.equips[i] === null ? (i === "lhand" && target.equips.rhand !== null && items[target.equips.rhand].slot === "2-hands" ? items[target.equips.rhand].name : "Nothing") : items[target.equips[i]].name));
            }
        }
        out.push("");
        
        for (var x in out) {
            sys.sendMessage(src, out[x], rpgchan);
        }
    };
    this.changeAppearance = function(src, commandData) {
        if (commandData === "*") {
            getAvatar(src).description = "";
            rpgbot.sendMessage(src, "Your appearance was cleared! To write an appearance text, use '/appearance text' (please don't use it to break the server rules).", rpgchan);
        } else {
            if (commandData.length > 250) {
                rpgbot.sendMessage(src, "You can only have 250 characters on your appearance description!", rpgchan);
                return;
            }
            getAvatar(src).description = commandData;
            rpgbot.sendMessage(src, "Your appearance was set to '" + commandData + "'.", rpgchan);
        }
    };
    this.changeTitle = function(src, commandData) {
        var player = getAvatar(src);
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Your current title is " + (player.currentTitle === null ? "not defined" : "'" + titles[player.currentTitle].name + "'") + "! You can choose the following titles (type /title [number], or disable your title with '/title clear'):", rpgchan);
            var title;
            for (var e = 0; e < player.titles.length; e++) {
                title = titles[player.titles[e]];
                rpgbot.sendMessage(src, (e + 1) + ". " + title.name + ": " + title.description, rpgchan);
            }
        } else {
            if (commandData.toLowerCase() === "clear") {
                player.currentTitle = null;
                rpgbot.sendMessage(src, "You removed your current title!", rpgchan);
                return;
            }
            var num = parseInt(commandData, 10);
            if (isNaN(num) || num < 1 || num > player.titles.length) {
                rpgbot.sendMessage(src, "Invalid value!", rpgchan);
                return;
            }
            player.currentTitle = player.titles[num - 1];
            rpgbot.sendMessage(src, "You changed your current title to '" + titles[player.currentTitle].name + "'.", rpgchan);
        }
    };
    this.changeFontSize = function(src, commandData) {
        if (isNaN(parseInt(commandData, 10)) === true) {
            rpgbot.sendMessage(src, "You must choose a valid number!", rpgchan);
            return;
        }
        getAvatar(src).fontSize = commandData;
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
            "±RPG: /classes - To see a list of the current starting classes.",
            "±RPG: /start - To pick a class. Example: '/start mage'",
            "±RPG: /i - To see your items list. Use /i itemname to use the item. Example: '/i armor' to wear armor or '/i potion' to heal during battle.",
            "±RPG: /stats - To see your stats and available stat points. Use /increase to allocate them. Example: '/increase str:2' to put 2 points into strength.",
            "±RPG: /skills - To see your skills and available skill points. Use /increase to allocate them. Example: '/increase rest' to raise your rest level.",
            "±RPG: /plan - To see what our current battle plan is set to. Use /plan skill:chance to set your plan. Example: '/plan attack:8*rest:2' to set your plan to 80% attack and 20% rest.",
            "±RPG: /w - To show all the places you can go. Use /w location to move to the new location. Example: '/w inn' to move to the inn.",
            "±RPG: /t - To show the visible NPCs or objects to interact with. Use /a object or /t NPC to interact with them. Example: '/a board' to view the bulletin board at the inn.",
            "±RPG: /e - To explore your current location. Sometimes it will start a battle, sometimes you will find items.",
            "±RPG: /f - To flee from a battle. Use this to avoid dying if you are in a battle you are sure can't win.",
            "±RPG: /revive - Use this when you have died. You will revive at your respawn location with half HP, so remember to heal at the inn.",
            "±RPG: /savechar - To save your progress.",
            "±RPG: /loadchar - To load your previously saved game.",
            "*** *********************************************************************** ***",
            ""
		];
		for (var x in help) {
           sys.sendMessage(src, help[x], rpgchan);
        }
	};
    
    function runUpdate() {
        var tempBattles = game.currentBattles;
        var tempDuels = duelChallenges;
        var tempTrades = tradeRequests;
        var tempParty = game.currentParties;
        var tempBoards = leaderboards;
        
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
                module.game.restoreValues(tempBattles, tempDuels, tempTrades, tempParty, tempBoards);
                
            });
            sendChanAll("Updating RPG game...", rpgchan);
        }
        return;
    }
    this.callModuleUpdate = function(src, data) {
        try {
            switch (data.toLowerCase()) {
                case "battle":
                    rpgbot.sendMessage(src, "Updating RPG Battle module!", rpgchan);
                    updateModule(plugins.battle, function(module) {
                        Battle = module.Battle;
                        rpgbot.sendMessage(src, "Battle Module updated!", rpgchan);
                    });
                    break;
                case "party":
                    rpgbot.sendMessage(src, "Updating RPG Party module!", rpgchan);
                    updateModule(plugins.party, function(module) {
                        Party = module.Party;
                        rpgbot.sendMessage(src, "Party Module updated!", rpgchan);
                    });
                    break;
                default:
                    rpgbot.sendMessage(src, "Module not found!", rpgchan);
            }
        } catch (err) {
            rpgbot.sendMessage(src, "Error updating RPG module '"+data+"':" + err, rpgchan);
        }
    };
    
    this.loadLocalContent = function(src) {
        try {
            this.loadInfo(sys.getFileContent(contentfile), sys.name(src));
        } catch (err) {
            rpgbot.sendMessage(src, "Error loading RPG content from cached file: " + err, rpgchan);
        }
    };
    this.loadURLContent = function(src, url) {
        try {
            var newUrl;
            if (url === "*") {
                newUrl = contentLoc.url;
            } else {
                newUrl = url;
            }
            
            rpgbot.sendMessage(src, "Loading RPG content from " + newUrl, rpgchan);
            sys.webCall(newUrl, function(resp) {
                game.loadInfo(resp, sys.name(src), newUrl);
            });
        } catch (err) {
            rpgbot.sendMessage(src, "Error loading RPG content from " + url + ": " + err, rpgchan);
        }
    };
    this.loadInfo = function(content, name, url) {
		try {
            var parsed = JSON.parse(content);
            
            var result;
            try {
                result = JSON.parse(sys.getFileContent(contentfile));
            } catch (e) {
                result = {
                    config: config,
                    classes: classes,
                    monsters: monsters,
                    skills: skills,
                    items: items,
                    places: places,
                    quests: quests,
                    titles: titles,
                    classHelp: classHelp
                };
            }
        
            config = parsed.config || result.config;
            classes = parsed.classes || result.classes;
            monsters = parsed.monsters || result.monsters;
            skills = parsed.skills || result.skills;
            items = parsed.items || result.items;
            places = parsed.places || result.places;
            quests = parsed.quests || result.quests;
            titles = parsed.titles || result.titles;
            classHelp = parsed.classHelp || result.classHelp;
            
            expTable = config.levels;
            elements = config.elements || {};
            
            if (config.battle) {
                var battle = config.battle;
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
                if (battle.partyLevelDiff) {
                    battleSetup.partyLevelDiff = battle.partyLevelDiff;
                }
                if (battle.partyExp) {
                    battleSetup.partyExp = battle.partyExp;
                }
            }
            
            startup.classes = config.startup.classes;
            startup.location = config.startup.location;
            startup.gold = config.startup.gold;
            startup.items = config.startup.items;
            startup.stats = config.startup.stats;
            startup.skills = config.startup.skills;
            
            if (config.classSets) {
                classSets = config.classSets;
            }
            
            if (config.leveling) {
                var level = config.leveling;
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
                if (level.battleExp) {
                    leveling.battleExp = level.battleExp;
                }
                if (level.battleGold) {
                    leveling.battleGold = level.battleGold;
                }
                if (level.eventExp) {
                    leveling.eventExp = level.eventExp;
                }
            }
            
            if (config.equipment) {
                equipment = config.equipment;
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
            
            result = {
                config: config,
                classes: classes,
                monsters: monsters,
                skills: skills,
                items: items,
                places: places,
                quests: quests,
                titles: titles,
                classHelp: classHelp
            };
            
            sys.writeToFile(contentfile, JSON.stringify(result, null, 4));
            
            if (url) {
                if (!contentLoc) {
                    try {
                        contentLoc = JSON.parse(sys.getFileContent(locationfile));
                    } catch (cerr) {}
                }
                var date = (new Date()).toUTCString();
                
                var updated = [];
                if (parsed.config) { 
                    updated.push("Config");
                }
                if (parsed.classes) { 
                    updated.push("Classes");
                }
                if (parsed.monsters) { 
                    updated.push("Monsters");
                }
                if (parsed.skills) { 
                    updated.push("Skills");
                }
                if (parsed.items) { 
                    updated.push("Items");
                }
                if (parsed.places) { 
                    updated.push("Places");
                }
                if (parsed.quests) { 
                    updated.push("Quests");
                }
                if (parsed.titles) { 
                    updated.push("Titles");
                }
                if (parsed.classHelp) { 
                    updated.push("Class Help");
                }
                
                var newLoc = {
                    config: parsed.config ? url + " [" + date + "]" : contentLoc.config,
                    classes: parsed.classes ? url + " [" + date + "]" : contentLoc.classes,
                    monsters: parsed.monsters ? url + " [" + date + "]" : contentLoc.monsters,
                    skills: parsed.skills ? url + " [" + date + "]" : contentLoc.skills,
                    items: parsed.items ? url + " [" + date + "]" : contentLoc.items,
                    places: parsed.places ? url + " [" + date + "]" : contentLoc.places,
                    titles: parsed.titles ? url + " [" + date + "]" : contentLoc.titles,
                    quests: parsed.quests ? url + " [" + date + "]" : contentLoc.quests,
                    classHelp: parsed.classHelp ? url + " [" + date + "]" : contentLoc.classHelp,
                    url: url,
                    updated: "[Updated: " + updated.join(", ") + "]",
                    user: name,
                    date: date
                };
                contentLoc = newLoc;
                sys.writeToFile(locationfile, JSON.stringify(contentLoc));
            }
            
            
            this.classes = classes;
            this.monsters = monsters;
            this.skills = skills;
            this.items = items;
            this.places = places;
            this.elements = elements;
            this.quests = quests;
            this.titles = titles;
            this.battleSetup = battleSetup;
            this.leveling = leveling;
            
            rpgbot.sendAll("RPG Game reloaded!", rpgchan);
		} catch (err) {
			sys.sendAll("Error loading RPG Game data: " + err, rpgchan);
		}
	};
    this.restoreValues = function(tempBattles, tempDuels, tempTrades, tempParty, tempBoards) {
        tradeRequests = tempTrades;
        game.currentBattles = tempBattles;
        duelChallenges = tempDuels;
        game.currentParties = tempParty;
        leaderboards = tempBoards;
    };
    this.viewContentFile = function(src) {
        sys.sendMessage(src, "", rpgchan);
        sys.sendMessage(src, "All files:", rpgchan);
        sys.sendMessage(src, "Config URL: " + contentLoc.config, rpgchan);
        sys.sendMessage(src, "Classes URL: " + contentLoc.classes, rpgchan);
        sys.sendMessage(src, "Monsters URL: " + contentLoc.monsters, rpgchan);
        sys.sendMessage(src, "Skills URL: " + contentLoc.skills, rpgchan);
        sys.sendMessage(src, "Items URL: " + contentLoc.items, rpgchan);
        sys.sendMessage(src, "Places URL: " + contentLoc.places, rpgchan);
        sys.sendMessage(src, "Quests URL: " + contentLoc.quests, rpgchan);
        sys.sendMessage(src, "Class Help URL: " + contentLoc.classHelp, rpgchan);
        sys.sendMessage(src, "", rpgchan);
        sys.sendMessage(src, "Last Update Info:", rpgchan);
        sys.sendMessage(src, "URL: " + contentLoc.url + " " + contentLoc.updated, rpgchan);
        sys.sendMessage(src, "Who: " + contentLoc.user, rpgchan);
        sys.sendMessage(src, "When: " + contentLoc.date, rpgchan);
        sys.sendMessage(src, "", rpgchan);
    };
    this.callUpdate = function () {
        runUpdate();
        return;
    };
    this.reloadChars = function() {
        try {
            var playerson = sys.playerIds();
            var user, x, gamefile;
            for (x = 0; x < playerson.length; ++x) {
                user = SESSION.users(playerson[x]);
                if (user && user[rpgAtt] && user[rpgAtt] !== null && user[rpgAtt] !== undefined) {
                    gamefile = this.convertChar(user[rpgAtt]);
                    user[rpgAtt] = gamefile;
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
        
        var target = getAvatar(id);
        if (target === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", rpgchan);
            return;
        }
        
        var property = data[1].toLowerCase(),
            action = data[2] || "view",
            obj = data[3] || null, 
            val = data[4] || null,
            r,
            amount,
            itemHolder;
        action = action.toLowerCase();
        
        sys.sendMessage(src, "", rpgchan);
        switch (property) {
            case "storage":
            case "items":
            case "item":
                itemHolder = (property === "storage") ? target.storage : target.items;
                switch (action) {
                    case "change":
                        val = parseInt(val, 10);
                        if (isNaN(val) === true) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        if (obj in items) {
                            if (property === "storage") {
                                this.changeStorageCount(target, obj, val);
                            } else {
                                this.changeItemCount(target, obj, val);
                            }
                            rpgbot.sendMessage(src, "Item " + obj + " successfully changed to amount " + itemHolder[obj] + " for player " + target.name + ".", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, "Invalid item.", rpgchan);
                        }
                        break;
                    case "edit":
                        val = parseInt(val, 10);
                        if (isNaN(val) === true) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        if (obj in items) {
                            amount = itemHolder[obj] || 0;
                            if (property === "storage") {
                                this.changeStorageCount(target, obj, val - amount);
                            } else {
                                this.changeItemCount(target, obj, val - amount);
                            }
                            rpgbot.sendMessage(src, "Item " + obj + " successfully changed to amount " + itemHolder[obj] + " for player " + target.name + ".", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, "Invalid item.", rpgchan);
                        }
                        break;
                    default:
                        sys.sendMessage(src, sys.name(id) + "'s " + (property === "storage" ? "storage" : "inventory") + ":", rpgchan);
                        for (r in itemHolder) {
                            sys.sendMessage(src, r + ": " + itemHolder[r], rpgchan);
                        }
                }
                break;
            case "skill":
            case "skills":
                switch (action) {
                    case "remove":
                        if (obj in target.skills) {
                            this.changeSkillLevel(target.id, obj, 0, true);
                            rpgbot.sendMessage(src, "Skill " + obj + " successfully removed from player " + target.name + ".", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, target.name + " doesn't have that skill!", rpgchan);
                        }
                        break;
                    case "change":
                        val = parseInt(val, 10);
                        if (isNaN(val) === true) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        if (obj in skills) {
                            amount = target.skills[obj] || 0;
                            if (target.skills[obj] + val < 0 || amount + val > skills[obj].levels) {
                                rpgbot.sendMessage(src, "Invalid level.", rpgchan);
                                return;
                            }
                            if (!(obj in target.skills)) {
                                if (val < 0) {
                                    rpgbot.sendMessage(src, "Can't remove points from a skill this player doesn't have!", rpgchan);
                                    return;
                                }
                                target.skills[obj] = 0;
                            }
                            this.addSkillPoint(target.id, obj, val, false);
                            rpgbot.sendMessage(src, "Skill " + obj + " successfully changed to level " + target.skills[obj] + " for player " + target.name + ".", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, "No such skill found.", rpgchan);
                        }
                        break;
                    case "edit":
                        val = parseInt(val, 10);
                        if (!(obj in skills)) {
                            rpgbot.sendMessage(src, "Invalid skill.", rpgchan);
                            return;
                        }
                        if (isNaN(val) === true || val < 0 || val > skills[obj].levels) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        this.changeSkillLevel(target.id, obj, val, false);
                        rpgbot.sendMessage(src, "Skill " + obj + " successfully changed to level " + val + " for player " + target.name + ".", rpgchan);
                        break;
                    default:
                        sys.sendMessage(src, sys.name(id) + "'s skills:", rpgchan);
                        for (r in target.skills) {
                            sys.sendMessage(src, r + ": " + target.skills[r], rpgchan);
                        }
                }
                break;
            case "gold":
            case "money":
            case "bank":
                var gold = property === "bank" ? "bank" : "gold";
                switch (action) {
                    case "change":
                        obj = parseInt(obj, 10);
                        if (isNaN(obj) === true) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        target[gold] += obj;
                        if (target[gold] < 0) {
                            target[gold] = 0;
                        }
                        rpgbot.sendMessage(src, "Successfully changed " + target.name + "'s " + gold + " amount to " + target[gold] + " .", rpgchan);
                        break;
                    case "edit":
                        obj = parseInt(obj, 10);
                        if (isNaN(obj) === true || obj < 0) {
                            rpgbot.sendMessage(src, "Invalid value.", rpgchan);
                            return;
                        }
                        target[gold] = obj;
                        rpgbot.sendMessage(src, "Successfully changed " + target.name + "'s " + gold + " amount to " + obj + " .", rpgchan);
                        break;
                    default:
                        rpgbot.sendMessage(src, target.name + " has " + target[gold] + " Gold" + (gold === "bank" ? " stored" : "") + "." , rpgchan);
                }
                break;
            case "place":
            case "location":
                switch (action) {
                    case "change":
                    case "edit":
                        if (obj in places) {
                            target.location = obj;
                            rpgbot.sendMessage(src, "Successfully moved " + target.name + " to " + obj + ".", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, "Invalid location", rpgchan);
                        }
                        break;
                    default:
                        rpgbot.sendMessage(src, sys.name(id) + " is currently at " + target.location, rpgchan);
                }
                break;
            case "exp":
                rpgbot.sendMessage(src, sys.name(id) + " currently has " + target.exp + " Exp. Points.", rpgchan);
                break;
            case "party":
                var pt = this.findParty(target.party);
                if (pt) {
                    rpgbot.sendMessage(src, "Party '" + pt.name + "' consists of " + pt.members.map(function(x){ return sys.name(x);}).join(", "), rpgchan);
                } else {
                    rpgbot.sendMessage(src, sys.name(id) + " is not in a party!", rpgchan);
                }
                break;
            default:
                rpgbot.sendMessage(src, "No such property!", rpgchan);
                break;
        }
        sys.sendMessage(src, "", rpgchan);
        
        //TO DO: Code to edit or remove properties from a borked character.
    };
    this.updateLeaderboard = function() {
        leaderboards = {};
        
        var saves = sys.filesForDirectory(savefolder);
        var overall = [];
        
        var data, s, player;
        for (s = 0; s < saves.length; ++s) {
            data = JSON.parse(sys.getFileContent(savefolder + "/" + saves[s]));
            
            if (!(data.job in leaderboards)) {
                leaderboards[data.job] = [];
            }
            
            player = {
                name: data.name,
                title: (data.currentTitle !== null && data.currentTitle !== undefined ? titles[data.currentTitle].name : "N/A"),
                level: data.level,
                exp: data.exp, 
                job: data.job,
                date: data.levelUpDate,
                dateString: (data.levelUpDate ? new Date(data.levelUpDate).toUTCString() : "N/A")
            };
            
            overall.push(player);
            leaderboards[data.job].push(player);
        }
        
        overall.sort(sortByExp);
        
        for (s = 0; s < overall.length; ++s) {
            player = overall[s];
            player.overall = s + 1;
        }
        
        for (s in leaderboards) {
            leaderboards[s].sort(sortByExp);
        }
        
        leaderboards.overall = overall;
        
        sys.writeToFile(leaderboardfile, JSON.stringify(leaderboards));
        
        sys.sendHtmlAll("", rpgchan);
        rpgbot.sendAll("RPG Leaderboards updated!", rpgchan);
    };
    this.viewLeaderboard = function(src, commandData) {
        var name = commandData.toLowerCase();
        
        var list;
        if (name === "*") {
            list = leaderboards.overall;
        } else if (name in classes && name in leaderboards) {
            list = leaderboards[name];
        } else {
            rpgbot.sendMessage(src, "No such list!", rpgchan);
            return;
        }
        
        var out = [];
        out.push("Leaderboards (" + (name === "*" ? "Overall" : classes[name].name) + "): "  );
        out.push("<table border='1' cellpadding='3' cellspacing='1'><tr><th>Pos.</th><th>Player</th><th>Level</th><th>" + (name === "*" ? "Class" : "Overall Pos.") + "</th><th>Title</th><th>Level Up Date</th></tr>");
        
        var data, job;
        var len = list.length > 20 ? 20 : list.length;
        
        var self = sys.name(src).toLowerCase(), selfFound = false;
        
        for (var s = 0; s < len; ++s) {
            data = list[s];
            job = name === "*" ? classes[data.job].name : data.overall;
            out.push('<tr><td>' + (s + 1) + '</td><td>' + data.name + '</td><td>' + data.level + '</td><td>' + job + '</td><td>' + data.title + '</td><td>' + data.dateString + '</td></tr>');
            
            if (data.name.toLowerCase() === self) {
                selfFound = true;
            }
        }
        
        if (!selfFound) {
            for (s = len; s < list.length; ++s) {
                data = list[s];
                if (data.name.toLowerCase() === self) {
                    job = name === "*" ? classes[data.job].name : data.overall;
                    out.push('<tr><td>' + (s + 1) + '</td><td>' + data.name + '</td><td>' + data.level + '</td><td>' + job + '</td><td>' + data.title + '</td><td>' + data.dateString + '</td></tr>');
                    break;
                }
            }
        }
        
        out.push("</table>");
        sys.sendHtmlMessage(src, "", rpgchan);
        sys.sendHtmlMessage(src, out.join(""), rpgchan);
        sys.sendHtmlMessage(src, "", rpgchan);
    };
    function sortByExp(a, b) {
        if (b.exp === a.exp) {
            return a.date - b.date;
        } else {
            return b.exp - a.exp;
        }
    }
    
	this.commands = {
		actions: {
            walk: [this.walkTo, "To go to a different location."],
            talk: [this.talkTo, "To talk to an NPC."],
            act: [this.actTo, "To interact with an object."],
            explore: [this.exploreLocation, "To explore a location for items or monsters."],
            flee: [this.fleeBattle, "To run away from your current battle."],
            item: [this.useItem, "To use or view your items."],
            challenge: [this.challengePlayer, "To challenge another player to a duel."],
            revive: [this.reviveSelf, "To respawn after you die."],
            trade: [this.requestTrade, "To request a trade with another player."],
            accept: [this.acceptTrade, "To instantly accept someone's trade offer."]
		},
        character: {
            plan: [this.setBattlePlan, "To view or set your battle strategy."],
            setskill: [this.setSkillLevel, "To view or set the level you want to use your skills."],
            passive: [this.setPassiveSkills, "To view or set your passive skills."],
            stats: [this.viewStats, "To view your character status."],
            skills: [this.viewSkills, "To view the available skills."],
            quests: [this.viewQuests, "To view the quests you started or completed."],
            increase: [this.addPoint, "To increase your stats or skills after you level up."],
            savechar: [this.saveGame, "To save your progress."],
            clearchar: [this.clearChar, "To clear your character."],
            party: [this.manageParty, "To create and manage a party"],
            partytalk: [this.talkToParty, "To talk to your party."],
            title: [this.changeTitle, "To view or change your Title."],
            appearance: [this.changeAppearance, "To change your appearance description."],
            font: [this.changeFontSize, "To change the Battle Message's size."],
            getplan: [this.getBattlePlan, "To get your raw plan text."],
            it: [this.viewItems, "To view your items by category."],
            watch: [this.watchBattle, "To watch someone else's battle."]
        },
        altactions: {
            skill: [this.viewSkills, "Same as /skills."],
            setskills: [this.setSkillLevel, "Same as /setskill."],
            items: [this.useItem, "Same as /item."],
            e: [this.exploreLocation, "Same as /explore."],
            w: [this.walkTo, "Same as /walk."],
            t: [this.talkTo, "Same as /talk."],
            a: [this.actTo, "Same as /act."],
            r: [this.reviveSelf, "Same as /revive."],
            i: [this.useItem, "Same as /item."],
            f: [this.fleeBattle, "Same as /flee"],
            c: [this.challengePlayer, "Same as /challenge."],
            q: [this.viewQuests, "Same as /quests."],
            p: [this.manageParty, "Same as /party."],
            pt: [this.talkToParty, "Same as /partytalk."]
        },
		channel: {
			help: [this.showHelp, "To learn how to play the game."],
			rpgcommands: [this.showCommands, "To see the list of commands."],
            classes: [this.viewClasses, "To view basic information about each class."],
            start: [this.startGame, "To create your character and begin your game."],
            loadchar: [this.loadGame, "To load your previously saved game."],
            view: [this.viewPlayer, "To view someone else's stats."],
            leaderboard: [this.viewLeaderboard, "To view the RPG Leaderboards."],
            rpgleaderboard: [this.viewLeaderboard, "To view the RPG Leaderboards."]
		},
		op: {
		},
		master: {
            reloadchars: [this.reloadChars, "To reload everyone's character after an update."],
            updateleaderboard: [this.updateLeaderboard, "To manually update the RPG Leaderboards."],
            unbork: [this.unborkChar, "To manually fix someone's character."],
            resetplayer: [this.resetPlayer, "To reset a player's stats and skills."],
            punish: [this.punishPlayer, "To punish a player's character."],
            updatelocal: [this.loadLocalContent, "To load RPG content from the directory."],
            updaterpg: [this.loadURLContent, "To load RPG content from the web. If you don't specify an URL, the default one will be used."],
            updategame: [this.callUpdate, "Update the RPG Scripts."],
            updatemodule: [this.callModuleUpdate, "Update an RPG Module."],
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
			if (getAvatar(src) === undefined) {
                rpgbot.sendMessage(src, "You need to start the game to use this command!", rpgchan);
                return true;
            }
            this.commands.actions[command][0].call(this, src, commandData);
			return true;
		}
        if (command in this.commands.altactions) {
			if (getAvatar(src) === undefined) {
                rpgbot.sendMessage(src, "You need to start the game to use this command!", rpgchan);
                return true;
            }
            this.commands.altactions[command][0].call(this, src, commandData);
			return true;
		}
        if (command in this.commands.character) {
			if (getAvatar(src) === undefined) {
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
            for (var x in this.currentBattles) {
                this.currentBattles[x].playNextTurn();
            }
            tick = 0;
        }
	};
    this.removePlayer = function(src, skipSave)  {
        var player = getAvatar(src);
            
        this.quitBattle(src, skipSave);
        if (player.party && this.findParty(player.party)) {
            this.findParty(player.party).leave(src, false);
        }
        if (player.name in tradeRequests) {
            tradeRequests[player.name] = undefined;
        }
        if (player.name in duelChallenges) {
            duelChallenges[player.name] = undefined;
        }
        for (var b in this.currentBattles) {
            var bat = this.currentBattles[b];
            var i = bat.viewers.indexOf(src);
            if (i !== -1) {
                bat.viewers.splice(i, 1);
                bat.sendToViewers(sys.name(src) + " stopped watching this battle!");
            }
        }
    };
	this.beforeLogOut = function(src) {
        if (getAvatar(src) !== undefined) {
            game.removePlayer(src, true);
            game.saveGame(src);
            game.clearChar(src);
        }
    };
	this.init = function() {
		if (sys.existChannel(RPG_CHANNEL)) {
            rpgchan = sys.channelId(RPG_CHANNEL);
        } else {
            rpgchan = sys.createChannel(RPG_CHANNEL);
        }
        try {
            contentLoc = JSON.parse(sys.getFileContent(locationfile));
            game.loadLocalContent();
        } catch (err) {
            rpgbot.sendAll("Unable to load RPG Content: " + err, rpgchan);
        }
        game.rpgchan = rpgchan;
        game.rpgAtt = rpgAtt;
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
        if (sys.existChannel(RPG_CHANNEL)) {
            id = sys.channelId(RPG_CHANNEL);
        } else {
            id = sys.createChannel(RPG_CHANNEL);
        }
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
