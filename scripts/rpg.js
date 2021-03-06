// Global variables inherited from scripts.js
/*global rpgbot, updateModule, sys, SESSION, sendChanAll, require, escape, module, getTimeString*/
var RPG_CHANNEL = "Game Corner";
function RPG(rpgchan) {
    var game = this;
    var contentLoc;
    
    var charVersion = 1.1;
    var savefolder = "rpgsaves";
    var contentfile = "rpgcontent.json";
    var locationfile = "rpglocation.txt";
    var guildsfile = "rpgguilds.json";
    var leaderboardfile = "rpgleaderboard.json";
    var rpgAtt = "rpg";
    var plugins = {
        party: "rpg_party.js",
        battle: "rpg_battle.js",
        guild: "rpg_guild.js"
    };
    
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
    var guildExp = [40, 94, 166, 263, 393, 568, 804, 1122, 1551, 2130, 2911, 3965, 5387, 7306, 9896, 13392, 18111, 24481, 33080, 44688, 60358, 81512, 110069, 148620, 200663, 270921, 365769, 493813, 666672];
    
    this.currentParties = {};
    this.currentBattles = [];
    this.guilds = {};
    
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
        eventExp: 1,
        saveOnClear: false
    };
    var equipment = {
        rhand: "Right Hand",
        lhand: "Left Hand",
        body: "Body",
        head: "Head"
    };
    var battleSetup = {
        baseAccuracy: 0.7,
        evasion: 1,
        defense: 1,
        damage: 1,
        levelDamageBonus: 0,
        critical: 1.5,
        secondaryDefense: 0,
        instantCast: false,
        passive: 2,
        party: 6,
        partyLevelDiff: 99,
        partyExp: 0,
        itemMode: "free",
        planMode: "free",
        advancedPlans: 5,
        defaultSkill: "attack"
    };
    var guildInfo = {
        baseMembers: 5,
        membersPerLevel: 3,
        exp: [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000]
    };
    
    var altSkills = {};
    var altPlaces = {};
    var altItems = {};
    var classHelp = [];
    var gameHelp = [
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
    
    var Party = require(plugins.party).Party;
    var Battle = require(plugins.battle).Battle;
    var Guild = require(plugins.guild).Guild;
    
    function getAvatar(src) {
        return SESSION.users(src)[rpgAtt];
    }
    
    this.walkTo = function(src, commandData) {
        var player = getAvatar(src), l, p, count, access;
        
        if (player.location === null || player.location === undefined || !(player.location in places)) {
            player.location = player.respawn;
            rpgbot.sendMessage(src, "You were in an unknown location! Moving you to the " + places[player.respawn].name + "!", rpgchan);
            return;
        }
        
        if (commandData === "*") {
            var out = ["", "You are at the " + places[player.location].name + "! You can move to the following locations: "];
            access = places[player.location].access;
            count = 1;
            for (l in access) {
                p = places[access[l]];
                if (!p.hide || p.hide !== true) {
                    out.push(count + ". " + p.name + " (" + access[l] + "): " + p.info + (p.type ? " [Type: " + cap(p.type) + "]" : ""));
                    count++;
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
                if (isNaN(parseInt(commandData, 10)) === false) {
                    var choice = parseInt(commandData, 10), found = false;
                    access = places[player.location].access;
                    count = 1;
                    for (l in access) {
                        p = places[access[l]];
                        if (!p.hide || p.hide !== true) {
                            if (count === choice) {
                                found = true;
                                loc = access[l];
                                break;
                            } 
                            count++;
                        }
                    }
                    if (!found) {
                        rpgbot.sendMessage(src, "No such place!", rpgchan);
                        return;
                    }
                } else {
                    rpgbot.sendMessage(src, "No such place!", rpgchan);
                    return;
                }
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
            var applyEffect = this.checkRequisites(src, places[loc], ["effectRequisites"], true);
            
            if (applyEffect > 0) {
                this.applyEffect(src, places[loc].effect);
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
        var outcome = this.checkRequisites(src, topic, ["requisites", "requisites2", "requisites3", "requisites4", "requisites5", "requisites6", "requisites7", "requisites8", "requisites9", "requisites10"], false, person);
        
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
        } 
        else if ("buy" in topic && typeof topic.buy === "object") {
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
        } 
        else if ("buy" in topic && topic.buy === "*") {
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
        } 
        else if ("trade" in topic) {
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
        } 
        else if ("storage" in topic) {
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
        } 
        else if ("bank" in topic && topic.bank === true) {
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
        else if ("show" in topic) {
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, topic.message, rpgchan);
            var item;
            for (var s in topic.show) {
                if (topic.show[s] in items) {
                    item = items[topic.show[s]];
                    sys.sendMessage(src, item.name + " (" + topic.show[s] + "): " + item.info + " " + (item.type === "equip" ? getEquipAttributes(topic.show[s]) : ""), rpgchan);
                }
            }
            sys.sendMessage(src, "", rpgchan);
            return;
        }
        else if ("guild" in topic) {
            sys.sendMessage(src, "", rpgchan);
            if (data.length < 3) {
                rpgbot.sendMessage(src, "You must choose a name for the Guild!", rpgchan);
                return;
            }
            sys.sendMessage(src, topic.message, rpgchan);
            this.createGuild(src, data[2]);
            sys.sendMessage(src, "", rpgchan);
            return;
        }
        
        if (!nomsg) {
            sys.sendMessage(src, "", rpgchan);
            var messageList = ["message", "message2", "message3", "message4", "message5", "message6", "message7", "message8", "message9", "message10"];
            var msgAttr = messageList[0];
            
            for (var m = outcome - 1; m >= 0; m--) {
                if (messageList[m] in topic) {
                    msgAttr = messageList[m];
                    break;
                }
            }
            
            sys.sendMessage(src, topic[msgAttr], rpgchan);
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
        
        this.applyEffect(src, eff, person);
    };
    this.applyEffect = function(src, effect, person, message) {
        var player = getAvatar(src),
            user = player.name,
            e, 
            p, 
            o, 
            id, 
            target, 
            sample, 
            out = {}, 
            startingHp = {}, 
            startingMp = {},
            fullParty, 
            party, 
            battleParty,
            itemName,
            finalExp,
            updatedQuests,
            attr = ["maxhp", "maxmp", "str", "def", "spd", "dex", "mag"];
        
        if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
            fullParty = this.findParty(player.party).findMembersNear(src, true);
            battleParty = this.findParty(player.party).findMembersNear(src, false);
            party = fullParty[1].concat();
            party.splice(party.indexOf(player), 1);
        } else {
            fullParty = [[src], [player]];
            battleParty = [[src], [player]];
            party = [];
        }
        
        for (e in fullParty[0]) {
            id = fullParty[0][e];
            out[id] = [];
            startingHp[id] = getAvatar(id).hp;
            startingMp[id] = getAvatar(id).mp;
        }
        
        
        if ("broadcast" in effect) {
            sys.sendAll(effect.broadcast.replace(/~Bot~/gi, "±" + rpgbot.name).replace(/~Player~/gi, getTitleName(src)), rpgchan);
        }
        if ("messages" in effect) {
            for (e in effect.messages) {
                out[src].push(effect.messages[e].replace(/~Bot~/gi, "±" + rpgbot.name));
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
                out[src].push(rpgbot.formatMsg("You received " + effect.gold + " Gold!"));
            } else if (effect.gold < 0) {
                out[src].push(rpgbot.formatMsg("You lost " + (-1 * effect.gold) + " Gold!"));
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
                out[src].push(rpgbot.formatMsg("You received " + itemsGained[e] + " " + items[e].name + "(s)!"));
            } else if (itemsGained[e] < 0) {
                out[src].push(rpgbot.formatMsg("You lost " + (-1 * itemsGained[e]) + " " + items[e].name + "(s)!"));
            }
        }
        if ("events" in effect) {
            for (e in effect.events) {
                player.events[e] = effect.events[e];
            }
        }
        if ("timers" in effect) {
            for (e in effect.timers) {
                player.timers[e] = new Date().getTime() + effect.timers[e] * 1000;
            }
        } 
        if ("move" in effect && player.isBattling === false) {
            var loc = effect.move === "*" ? player.respawn : effect.move;
            this.changeLocation(src, loc);
        }
        if ("respawn" in effect) {
            player.respawn = effect.respawn;
            out[src].push(rpgbot.formatMsg("Your respawn point was set to " + places[player.respawn].name + "!"));
        }
        if ("setLevel" in effect) {
            if (player.level !== effect.setLevel) {
                var levelDiff, oldLevel = player.level;
                this.setToLevel(player, effect.setLevel);
                levelDiff = player.level - oldLevel;
                out[src].push(rpgbot.formatMsg("Your level changed to " + player.level + "!"));
                // rpgbot.sendAll(getTitleName(src) + "'s Level " + (levelDiff >= 0 ? "increased" : "dropped") + " from " + oldLevel + " to " + player.level + "!", rpgchan);
            }
        }
        if ("exp" in effect && effect.exp > 0) {
            finalExp = Math.floor(effect.exp * leveling.eventExp);
            out[src].push(rpgbot.formatMsg("You received " + finalExp + " Exp. Points!"));
            this.receiveExp(src, finalExp);
        }
        if ("classes" in effect) {
            for (e in effect.classes) {
                if (e === player.job) {
                    this.changePlayerClass(player, effect.classes[e]);
                    out[src].push(rpgbot.formatMsg("You changed classes and now are a " + classes[player.job].name + "!"));
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
                this.startBattle(battleParty[0], battleParty[1], m);
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
                this.startBattle(battleParty[0], battleParty[1], m);
            }
        }
        if ("quests" in effect) {
            updatedQuests = [];
            
            for (e in effect.quests) {
                player.quests[e] = effect.quests[e];
                updatedQuests.push(quests[e].name);
            }
            
            if (updatedQuests.length > 0) {
                out[src].push(rpgbot.formatMsg("The following quests have been updated: " + readable(updatedQuests, "and") + "."));
            }
        }
        if ("title" in effect) {
            for (e in effect.title) {
                if (effect.title[e] === true) {
                    if (player.titles.indexOf(e) === -1) {
                        player.titles.push(e);
                        out[src].push(rpgbot.formatMsg("You received the title " + titles[e].name + "."));
                    }
                } else {
                    if (player.titles.indexOf(e) !== -1) {
                        player.titles.splice(player.titles.indexOf(e), 1);
                        if (player.currentTitle === e) {
                            player.currentTitle = null;
                        }
                        out[src].push(rpgbot.formatMsg("You lost the title " + titles[e].name + "."));
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
        
        //Party Effects
        for (p in party) {
            target = party[p];
            id = target.id;
            if ("partyMessages" in effect) {
                for (e in effect.partyMessages) {
                    for (o in party) {
                        out[id].push(effect.partyMessages[e].replace(/~Bot~/gi, "±" + rpgbot.name));
                    }
                }
            }
            
            if ("partyHp" in effect) {
                target.hp += effect.partyHp;
            }
            if ("partyMp" in effect) {
                target.mp += effect.partyMp;
            }
            if ("partyHpPercent" in effect) {
                target.hp += Math.round(target.maxhp * effect.partyHpPercent);
            }
            if ("partyMpPercent" in effect) {
                target.mp += Math.round(target.maxmp * effect.partyMpPercent);
            }
            
            if (target.hp > target.maxhp) {
                target.hp = target.maxhp;
            } else if (target.hp < 0) {
                target.hp = 0;
            }
            if (target.mp > target.maxmp) {
                target.mp = target.maxmp;
            } else if (target.mp < 0) {
                target.mp = 0;
            }
            
            if ("partyGold" in effect) {
                target.gold += effect.partyGold;
                if (target.gold < 0) {
                    target.gold = 0;
                }
                if (effect.partyGold > 0) {
                    out[id].push(rpgbot.formatMsg("You received " + effect.partyGold + " Gold!"));
                } else if (effect.partyGold < 0) {
                    out[id].push(rpgbot.formatMsg("You lost " + (-1 * effect.partyGold) + " Gold!"));
                }
            }
            itemsGained = {};
            if ("partyItems" in effect) {
                for (e in effect.partyItems) {
                    this.changeItemCount(target, e, effect.partyItems[e]);
                    if (effect.partyItems[e] > 0) {
                        itemsGained[e] = effect.partyItems[e];
                    } else if (effect.partyItems[e] < 0) {
                        itemsGained[e] = effect.partyItems[e];
                    }
                }
            }
            if ("partyRandomItems" in effect) {
                sample = randomSample(effect.partyRandomItems);
                sample = sample.split(":");
                for (e in sample) {
                    itemName = sample[e];
                    if (itemName in items) {
                        this.changeItemCount(target, itemName, 1);
                        if (!(itemName in itemsGained)) {
                            itemsGained[itemName] = 0;
                        }
                        itemsGained[itemName]++;
                    }
                }
            }
            for (e in itemsGained) {
                if (itemsGained[e] > 0) {
                    out[id].push(rpgbot.formatMsg("You received " + itemsGained[e] + " " + items[e].name + "(s)!"));
                } else if (itemsGained < 0) {
                    out[id].push(rpgbot.formatMsg("You lost " + (-1 * itemsGained[e]) + " " + items[e].name + "(s)!"));
                }
            }
            if ("partyEvents" in effect) {
                for (e in effect.partyEvents) {
                    target.events[e] = effect.partyEvents[e];
                }
            }
            if ("partyTimers" in effect) {
                for (e in effect.partyTimers) {
                    target.timers[e] = new Date().getTime() + effect.partyTimers[e] * 1000;
                }
            }
            
            if ("partyMove" in effect) {
                this.changeLocation(id, effect.partyMove);
            } 
            
            if ("partyRespawn" in effect) {
                target.respawn = effect.partyRespawn;
                out[id].push(rpgbot.formatMsg("Your respawn point was set to " + places[target.respawn].name + "!"));
            }
            if ("partyExp" in effect && effect.partyExp > 0) {
                finalExp = Math.floor(effect.partyExp * leveling.eventExp);
                out[id].push(rpgbot.formatMsg("You received " + finalExp + " Exp. Points!"));
                this.receiveExp(id, finalExp);
            }
            if ("partyClasses" in effect) {
                for (e in effect.partyClasses) {
                    if (e === target.job) {
                        this.changePlayerClass(target, effect.partyClasses[e]);
                        out[id].push(rpgbot.formatMsg("You changed classes and now are a " + classes[target.job].name + "!"));
                        break;
                    }
                }
            }
            if ("partySkills" in effect) {
                for (e in effect.partySkills) {
                    if (!(e in target.skills)) {
                        target.skills[e] = 0;
                    } else if (effect.partySkills[e] === "*") {
                        delete target.skills[e];
                        continue;
                    }
                    target.skills[e] += effect.partySkills[e];
                    if (target.skills[e] < 0) {
                        target.skills[e] = 0;
                    } else if (target.skills[e] > skills[e].levels) {
                        target.skills[e] = skills[e].levels;
                    }
                }
            }
            if ("partyAttributes" in effect) {
                for (e in effect.partyAttributes) {
                    if (attr.indexOf(e) !== -1) {
                        target[e] += effect.partyAttributes[e];
                        if (target[e] < 1) {
                            target[e] = 1;
                        }
                    }
                }
            }
            if ("partyQuests" in effect) {
                updatedQuests = [];
                for (e in effect.partyQuests) {
                    target.quests[e] = effect.partyQuests[e];
                    updatedQuests.push(quests[e].name);
                }
                
                if (updatedQuests.length > 0) {
                    out[id].push(rpgbot.formatMsg("The following quests have been updated: " + readable(updatedQuests, "and") + "."));
                }
            }
            if ("partyTitle" in effect) {
                for (e in effect.partyTitle) {
                    if (effect.partyTitle[e] === true) {
                        if (target.titles.indexOf(e) === -1) {
                            target.titles.push(e);
                            out[id].push(rpgbot.formatMsg("You received the title " + titles[e].name + "."));
                        }
                    } else {
                        if (target.titles.indexOf(e) !== -1) {
                            target.titles.splice(target.titles.indexOf(e), 1);
                            if (target.currentTitle === e) {
                                target.currentTitle = null;
                            }
                            out[id].push(rpgbot.formatMsg("You lost the title " + titles[e].name + "."));
                        }
                    }
                }
            }
            if ("partyHunt" in effect && person) {
                if (!(person in target.hunted)) {
                    target.hunted[person] = {};
                }
                for (e in effect.partyHunt) {
                    target.hunted[person][e] = effect.partyHunt[e];
                }
            }
            if ("partySave" in effect && effect.partySave === true) {
                this.saveGame(id, "sure");
            }
        }
        
        
        var hpDmg, mpDmg;
        if (message) {
            hpDmg = Math.abs(startingHp[src] - player.hp);
            mpDmg = Math.abs(startingMp[src] - player.mp);
            rpgbot.sendMessage(src, message.replace(/~Life~/g, player.hp).replace(/~Mana~/g, player.mp).replace(/~LifeGained~/g, hpDmg).replace(/~ManaGained~/g, mpDmg).replace(/~Place~/g, places[player.location].name), rpgchan);
        }
        
        for (e in out) {
            if (out[e].length > 0) {
                id = parseInt(e, 10);
                player = getAvatar(e);
                hpDmg = Math.abs(startingHp[e] - player.hp);
                mpDmg = Math.abs(startingMp[e] - player.mp);
                for (o in out[e]) {
                    sys.sendMessage(e, out[e][o].replace(/~User~/g, user).replace(/~Life~/g, player.hp).replace(/~Mana~/g, player.mp).replace(/~LifeGained~/g, hpDmg).replace(/~ManaGained~/g, mpDmg).replace(/~Place~/g, places[player.location].name), rpgchan);
                }
            }
        }
        
        return out;
    };
    this.checkRequisites = function(src, topic, lists, silent, person) {
        var player = getAvatar(src);
        var req, r, l, v, p;
        var loops = 0;
        
        for (l = 0; l < lists.length; l++) {
            if (lists[l] in topic) {
                loops++;
            } else {
                break;
            }
        }
        
        var reqMessages = [], teamMessages = {}, deny, playerDeny, warnings, teamWarnings, alerts;
        
        var party, team, target;
        if (player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
            team = this.findParty(player.party).findMembersNear(src, true)[1];
        } else {
            team = [player];
        }
        
        
        for (l = 0; l < loops; ++l) {
            req = topic[lists[l]];
            warnings = [];
            teamWarnings = [];
            deny = false;
            
            party = req.partyRequisites === true ? team : [player];
            
            if ("chance" in req && Math.random() > req.chance) {
                deny = true;
            }
            
            for (p in party) {
                target = party[p];
                alerts = target === player ? warnings : teamWarnings;
                playerDeny = false;
                
                if ("timers" in req) {
                    var t, timing;
                    for (r in req.timers) {
                        if (r in target.timers) {
                            t = new Date().getTime();
                            if (req.timers[r] === false && target.timers[r] < t) {
                                timing = getTimeString((t - target.timers[r]) / 1000);
                                alerts.push("be " + (timing === "" ? "0 seconds" : timing) + " faster");
                                playerDeny = true;
                            } else if (req.timers[r] === true && target.timers[r] >= t) {
                                timing = getTimeString((target.timers[r] - t) / 1000);
                                alerts.push("wait for more " + (timing === "" ? "0 seconds" : timing));
                                playerDeny = true;
                            }
                        } 
                        /* else if (req.timers[r] === false) {
                            playerDeny = true;
                        } */
                    }
                }
                if ("classes" in req && req.classes.indexOf(target.job) === -1) {
                    playerDeny = true;
                }
                if ("level" in req && target.level < req.level) {
                    playerDeny = true;
                }
                if ("maxlevel" in req && target.level > req.maxlevel) {
                    playerDeny = true;
                }
                if ("events" in req) {
                    for (r in req.events) {
                        var ev = req.events[r];
                        v = r in target.events ? target.events[r] : false;
                        if (ev !== v) {
                            playerDeny = true;
                        }
                    }
                }
                if ("gold" in req && target.gold < req.gold) {
                    playerDeny = true;
                }
                if ("items" in req) {
                    for (r in req.items) {
                        if (!this.hasItem(target, r, req.items[r])) {
                            playerDeny = true; 
                        }
                    }
                }
                if ("maxitems" in req) {
                    for (r in req.maxitems) {
                        if (this.hasItem(target, r, req.maxitems[r] + 1)) {
                            playerDeny = true; 
                        }
                    }
                }
                if ("attributes" in req) {
                    var att = ["hp", "mp", "str", "def", "spd", "dex", "mag"];
                    for (r in req.attributes) {
                        if (att.indexOf(r) !== -1 && target[r] < req.attributes[r]) {
                            playerDeny = true;
                        }
                    }
                }
                if ("skills" in req) {
                    for (r in req.skills) {
                        if (!target.skills[r] || target.skills[r] < req.skills[r]) {
                            playerDeny = true;
                        }
                    }
                }
                if ("noSkillPoints" in req && req.noSkillPoints === true) {
                    var points = 0;
                    for (r in classes[target.job].skills) {
                        points += skills[r].levels - target.skills[r];
                    }
                    if (target.skillPoints > 0 && points > 0) {
                        alerts.push("use all your Skill Points");
                        playerDeny = true;
                    }
                }
                var huntNeeded;
                if ("defeated" in req) {
                    huntNeeded = [];
                    for (r in req.defeated) {
                        if (!(r in target.defeated)) {
                            target.defeated[r] = 0;
                            huntNeeded.push(req.defeated[r] + " " + monsters[r].name + "(s)");
                        } else if (target.defeated[r] < req.defeated[r]) {
                            huntNeeded.push((req.defeated[r] - target.defeated[r]) + " " + monsters[r].name + "(s)");
                        }
                    }
                    if (huntNeeded.length > 0) {
                        playerDeny = true;
                        alerts.push("defeat " + readable(huntNeeded, "and"));
                    }
                }
                if ("hunt" in req) {
                    huntNeeded = [];
                    if (!(person in target.hunted)) {
                        target.hunted[person] = {};
                        for (r in req.hunt) {
                            target.hunted[person][r] = 0;
                        }
                    } 
                    for (r in req.hunt) {
                        if (!(r in target.hunted[person])) {
                            target.hunted[person][r] = 0;
                            huntNeeded.push(req.hunt[r] + " " + monsters[r].name + "(s)");
                        } else if (target.hunted[person][r] < req.hunt[r]) {
                            huntNeeded.push((req.hunt[r] - target.hunted[person][r]) + " " + monsters[r].name + "(s)");
                        }
                    }
                    if (huntNeeded.length > 0) {
                        playerDeny = true;
                        alerts.push("hunt " + readable(huntNeeded, "and"));
                    }
                }
                if ("quests" in req) {
                    var q, qp;
                    for (r in req.quests) {
                        q = req.quests[r];
                        qp = target.quests[r] || 0;
                        if (Array.isArray(q)) {
                            if (qp < q[0] || qp > q[1]) {
                                playerDeny = true;
                                break;
                            }
                        } else {
                            if (qp !== q) {
                                playerDeny = true;
                                break;
                            }
                        }
                    }
                }
                if ("titles" in req) {
                    for (r in req.titles) {
                        v = target.titles.indexOf(r) !== -1;
                        if (req.titles[r] !== v) {
                            playerDeny = true;
                        }
                    }
                }
                if ("hasGuild" in req) {
                    if (req.hasGuild !== (target.guild !== null)) {
                        playerDeny = true;
                    }
                }
                if (playerDeny) {
                    deny = true;
                
                    if (target !== player && !(target.name in teamMessages)) {
                        teamMessages[target.name] = [];
                    }
                    (target === player ? reqMessages : teamMessages[target.name]).push(alerts);
                }
            }
            
            if (deny) {
                continue;
            }
            
            return l + 1;
        }
        
        if (loops > 0) {
            if (!silent) {
                sys.sendMessage(src, topic.denymsg, rpgchan);
                for (l in reqMessages) {
                    if (reqMessages[l].length > 0) {
                        rpgbot.sendMessage(src, "You need to " + readable(reqMessages[l], "and") + ".", rpgchan);
                    }
                }
                for (l in teamMessages) {
                    for (r in teamMessages[l]) {
                        if (teamMessages[l][r].length > 0) {
                            rpgbot.sendMessage(src, l + " needs to " + readable(teamMessages[l][r], "and") + ".", rpgchan);
                        }
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
        var place = places[player.location];
        if (!("content" in place) || Object.keys(place.content).length < 1) {
            rpgbot.sendMessage(src, "Nothing to explore here!", rpgchan);
            return;
        }
        
        var content = randomSample(place.content);
        
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
        } else if (content[0] === "~"){
            var effect = content.substring(1);
            
            if (!("contentEffect" in place) || !(effect in place.contentEffect)) {
                rpgbot.sendMessage(src, "Nothing found!", rpgchan);
                return;
            }
        
            var applyEffect = this.checkRequisites(src, place.contentEffect[effect], ["requisites"], false);
            
            if (applyEffect > 0) {
                this.applyEffect(src, place.contentEffect[effect].effect);
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
            if (place.noParty !== true && player.party && this.findParty(player.party) && this.findParty(player.party).isMember(src)) {
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
                rpgbot.sendAll("A battle between " + readable(names1, "and") + " against " + readable(names2, "and") + " has begun!", rpgchan);
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
        monster.level = data.level;
        monster.gold = data.gold;
        monster.loot = data.loot;
        monster.defenseElement = data.element || "none";
        monster.attackElement = "none";
        monster.isPlayer = false;
        monster.passives = data.passives || {};
        monster.forceSave = data.forceSave || false;
        monster.isSummon = false;
        if (data.advStrategy) {
            monster.advStrategy = data.advStrategy;
            monster.planMode = "advanced";
        }
        
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
            } else if (level < 0) {
                return att[0];
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
        if ("level" in item && hideSlot !== true) {
            result.push("Required Level " + item.level);
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
        
        if (battleSetup.itemMode === "restricted" && player.isBattling === true) {
            rpgbot.sendMessage(src, "You can't use items while battling!", rpgchan);
            return;
        } else if (player.isBattling === true && "inBattle" in item && item.inBattle === false) {
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
            this.applyEffect(src, item.effect, null, item.message);
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
            
            this.fixSkills(src);
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
    this.viewItems = function(src, commandData, isGuild) {
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
            if (isGuild) {
                var guild = this.guilds[player.guild].storage;
                data = "all";
                itemSource = guild.storage;
                ordered = Object.keys(guild.storage).sort(sortByName);
            } else {
                ordered = data === "storage" ? Object.keys(player.storage).sort(sortByName) : Object.keys(player.items).sort(sortByName);
                if (data === "storage") {
                    data = "all";
                    itemSource = player.storage;
                } 
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
        this.fixSkills(src);
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
            rpgbot.sendMessage(src, "Your current strategy is " + randomSampleText(player.strategy, this.skillOrItem) + ".", rpgchan);
            rpgbot.sendMessage(src, "To set your strategy, type /plan skill:chance*skill:chance. You can also use /plan slots to save up to 3 strategies.", rpgchan);
            return;
        }
        if (commandData === "activate") {
            if (battleSetup.planMode !== "free" && player.isBattling === true) {
                rpgbot.sendMessage(src, "You cannot change the plan mode while battling!", rpgchan);
                return;
            }
            player.planMode = "basic";
            rpgbot.sendMessage(src, "Your current strategy is " + randomSampleText(player.strategy, this.skillOrItem) + ".", rpgchan);
            return;
        }

        var broken = commandData.split(" ");
        var action = "plan";
        var target;
        
        if (broken[0] === "slots") {
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 1 is " + randomSampleText(player.plans[0], this.skillOrItem) + ".", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 2 is " + randomSampleText(player.plans[1], this.skillOrItem) + ".", rpgchan);
            rpgbot.sendMessage(src, "Your saved strategy 3 is " + randomSampleText(player.plans[2], this.skillOrItem) + ".", rpgchan);
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
            if (battleSetup.planMode === "restricted" && player.isBattling === true) {
                rpgbot.sendMessage(src, "You cannot change plans while battling!", rpgchan);
                return;
            }
            if (player.plans[target-1]) {
                player.strategy = player.plans[target-1];
                rpgbot.sendMessage(src, "Loaded strategy " + randomSampleText(player.strategy, this.skillOrItem) + ".", rpgchan);
            } else {
                rpgbot.sendMessage(src, "No plan set here!", rpgchan);
            }
            return;
        }
        
        if (battleSetup.planMode !== "free" && player.isBattling === true) {
            rpgbot.sendMessage(src, (battleSetup.planMode === "setOnly" ? "You cannot change plans while battling (You still can load saved plans)!" : "You cannot change plans while battling!"), rpgchan);
            return;
        }
        
        var obj = this.validatePlan(src, commandData);
        if (obj === false) {
            return;
        }
        
        if (action === "set") {
            if (target === 1 || target === 2 || target === 3) {
                player.plans[target-1] = obj;
                rpgbot.sendMessage(src, "Saved strategy " + randomSampleText(obj, this.skillOrItem) + " to slot " + target + "!", rpgchan);
            } else {
                rpgbot.sendMessage(src, "No such slot for strategies!", rpgchan);
            }
            return;
        } else {
            player.strategy = obj;
            rpgbot.sendMessage(src, "Your strategy was set to " + randomSampleText(obj, this.skillOrItem) + "!", rpgchan);
        }
    };
    this.setAdvancedPlan = function(src, commandData) {
        var player = getAvatar(src);
        if (commandData === "*") {
            rpgbot.sendMessage(src, "Your current advanced strategy is: ", rpgchan);
            for (var p = 0; p < player.advStrategy.length; p++) {
                if (player.advStrategy[p] !== null) {
                    sys.sendMessage(src, (p + 1) + ". " + randomSampleText(player.advStrategy[p][1], this.skillOrItem) + " if " + this.translateConditions(player.advStrategy[p][0]),rpgchan);
                }
            }
            rpgbot.sendMessage(src, "To set your strategy, type /aplan [slot] [conditions] [skill:chance*skill:chance]. Type /aplan help for a detailed explanation.", rpgchan);
            return;
        }
        if (commandData === "help") {
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "To set your strategy, type /aplan [Slot] [Conditions] [Strategy]. ", rpgchan);
            sys.sendMessage(src, "[Slot]: Choose a number between 1~" + battleSetup.advancedPlans + ". The lower the number, the higher priority that plan gets.", rpgchan);
            sys.sendMessage(src, "[Conditions]: Sets the conditions that must be true for this plan to be used during battle. If the conditions are not met, the next slot will be used instead.", rpgchan);
            sys.sendMessage(src, "Syntax: [parameter1>30:parameter2<60] means parameter1's value must be higher than 30 AND parameter2 must be lower than 60.", rpgchan);
            sys.sendMessage(src, "Syntax: [parameter1>30*parameter2<60] means parameter1's value must be higher than 30 OR parameter2 must be lower than 60.", rpgchan);
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, "Parameters for Condition: You can have any number of parameters you want, but you can't use : and * in the same condition. To set no conditions, simply set * as the condition.", rpgchan);
            sys.sendMessage(src, "hp: Player's HP (in %)", rpgchan);
            sys.sendMessage(src, "mp: Player's Mana (in %)", rpgchan);
            sys.sendMessage(src, "allyhp: Any Ally's HP (in %)", rpgchan);
            sys.sendMessage(src, "allymp: Any Ally's Mana (in %)", rpgchan);
            sys.sendMessage(src, "partyhp: Average Party's HP (in %)", rpgchan);
            sys.sendMessage(src, "partymp: Average Party's Mana (in %)", rpgchan);
            sys.sendMessage(src, "enemyhp: Any Enemy's HP (in %)", rpgchan);
            sys.sendMessage(src, "enemymp: Any Enemy's Mana (in %)", rpgchan);
            sys.sendMessage(src, "epartyhp: Average Enemy Party's HP (in %)", rpgchan);
            sys.sendMessage(src, "epartymp: Average Enemy Party's Mana (in %)", rpgchan);
            sys.sendMessage(src, "gold: Player's Gold", rpgchan);
            sys.sendMessage(src, "enemies: Number of enemies still alive.", rpgchan);
            sys.sendMessage(src, "~item: Amount of that item the player has.", rpgchan);
            sys.sendMessage(src, "", rpgchan);
            sys.sendMessage(src, "[Strategy]: Same as normal /plan. Use [skill:chance*skill:chance] to set the plan you want to use when those conditions are met.", rpgchan);
            sys.sendMessage(src, "Example: [/aplan 2 hp<50:mp>30 rest:40*heal:60] will give you 40% chance of using Rest and 60% chance of using Heal if your HP is below 50% and your Mana is above 30%, and if the first slot's condition was not met.", rpgchan);
            sys.sendMessage(src, "", rpgchan);
            rpgbot.sendMessage(src, "Use '/aplan activate' to enable Advanced Plan, or '/plan activate' to go back to Basic Plan mode. Type '/aplan raw' to get your plan in text format. To clear a slot, use '/aplan [slot] * *'.", rpgchan);
            sys.sendMessage(src, "", rpgchan);
            return;
        }
        if (commandData === "activate") {
            if (battleSetup.planMode !== "free" && player.isBattling === true) {
                rpgbot.sendMessage(src, "You cannot change the plan mode while battling!", rpgchan);
                return;
            }
            player.planMode = "advanced";
            rpgbot.sendMessage(src, "You activated Advanced Plan mode. Type /aplan to check your strategy.", rpgchan);
            return;
        }
        if (commandData === "raw") {
            rpgbot.sendMessage(src, "Your Advanced Plan (Raw):", rpgchan);
            var plan;
            for (var r = 0; r < player.advStrategy.length; r++) {
                plan = player.advStrategy[r];
                if (plan !== null) {
                    sys.sendMessage(src, (r + 1)  + ": " + (r + 1) + " " + (plan[0] !== "" ? plan[0] : "*") + " " + getPlanString(plan[1]), rpgchan);
                }
            }
            return;
        }
        
        if (battleSetup.planMode !== "free" && player.isBattling === true) {
            rpgbot.sendMessage(src, (battleSetup.planMode === "setOnly" ? "You cannot change plans while battling (You still can load saved plans)!" : "You cannot change plans while battling!"), rpgchan);
            return;
        }
        
        var slot = parseInt(commandData.substring(0, commandData.indexOf(" ")), 10);
        
        if (isNaN(slot) || slot < 1 || slot > battleSetup.advancedPlans) {
            rpgbot.sendMessage(src, "Set a valid slot (1~" + battleSetup.advancedPlans + ").", rpgchan);
            return;
        }
        
        var broken = commandData.substr(commandData.indexOf(" ") + 1);
        var conditions = broken.substring(0, broken.indexOf(" "));
        var strategy = broken.substr(broken.indexOf(" ") + 1);
        
        if (conditions === "*" || conditions === ":") {
            conditions = "";
            if (strategy === "*" || strategy === ":") {
                if (slot === battleSetup.advancedPlans) {
                    rpgbot.sendMessage(src, "You can't clear the last slot!", rpgchan);
                    return;
                }
                player.advStrategy[slot - 1] = null;
                rpgbot.sendMessage(src, "Your advanced strategy " + slot + " was cleared!", rpgchan);
                return;
            }
        } else if (slot === battleSetup.advancedPlans) {
            conditions = "";
            rpgbot.sendMessage(src, "You can't set conditions to the last slot!", rpgchan);
        } else {
            conditions = this.validateCondition(src, conditions.toLowerCase());
            if (conditions === false) {
                return;
            }
        }    
        var obj = this.validatePlan(src, strategy);
        if (obj === false) {
            return;
        }
        
        player.advStrategy[slot - 1] = [conditions, obj];
        rpgbot.sendMessage(src, "Your advanced strategy " + slot + " was set to " + randomSampleText(obj, this.skillOrItem) + " if " + this.translateConditions(conditions) + "!", rpgchan);
    };
    this.validatePlan = function(src, info) {
        var data = info.split("*");
        var player = getAvatar(src);
        var obj = {};
        var skill;
        
        for (var s in data) {
            skill = data[s].split(":");
            if (skill.length < 2) {
                rpgbot.sendMessage(src, "Incorrect format. To set your strategy, type /plan skill:chance*skill:chance.", rpgchan);
                return false;
            }
            var move = skill[0].toLowerCase();
            var chance = parseFloat(skill[1]);
            var item, itemName;
            
            if (move[0] === "~") {
                itemName = move.substr(1);
                if (!(itemName in items)) {
                    if(itemName in altItems) {
                        itemName = altItems[itemName];
                    } else {
                        rpgbot.sendMessage(src, "The item '" + itemName + "' doesn't exist!", rpgchan);
                        return false;
                    }
                }
                item = items[itemName];
                if (item.battleItem !== true) {
                    rpgbot.sendMessage(src, "The item '" + itemName + "' cannot be used during battles!", rpgchan);
                    return false;
                }
                if ("level" in item && player.level < item.level) {
                    rpgbot.sendMessage(src, "You need to be at least level " + item.level + " to use the item " + itemName + "!", rpgchan);
                    return false;
                }
            } else {
                if (!(move in skills)) {
                    if(move in altSkills) {
                        move = altSkills[move];
                    } else {
                        rpgbot.sendMessage(src, "The skill '" + move + "' doesn't exist!", rpgchan);
                        return false;
                    }
                }
                if (this.canUseSkill(src, move) === false) {
                    rpgbot.sendMessage(src, "You haven't learned the skill '" + move + "'!", rpgchan);
                    return false;
                }
                
                if (skills[move].type === "passive") {
                    rpgbot.sendMessage(src, "You can't set passive skills on your plan!", rpgchan);
                    return false;
                }
            }
            
            if (typeof chance !== "number" || isNaN(chance) === true) {
                if (itemName !== undefined) {
                    rpgbot.sendMessage(src, "Set a chance for the item '" + itemName + "'!", rpgchan);
                } else {
                    rpgbot.sendMessage(src, "Set a chance for the skill '" + move + "'!", rpgchan);
                }
                return false;
            }
            obj[move] = chance;
        }
        
        return obj;
    };
    this.validateCondition = function(src, info) {
        if (info.indexOf(":") !== -1 && info.indexOf("*") !== -1) {
            rpgbot.sendMessage(src, "You can't have both : and * in your plan's condition!", rpgchan);
            return false;
        }
        var conditions = info.indexOf(":") !== -1 ? info.split(":") : info.split("*"),
            type = info.indexOf(":") !== -1 ? ":" : "*",
            cond,
            c,
            param,
            sign,
            val,
            item,
            valid = [],
            formatted;
        
        for (c in conditions) {
            cond = conditions[c];
            if (cond.indexOf(">") === -1 && cond.indexOf("<") === -1) {
                rpgbot.sendMessage(src, "Invalid format for plan's condition! You must define either > or <.", rpgchan);
                return false;
            }
            sign = cond.indexOf(">") !== -1 ? ">" : "<";
            param = cond.substring(0, cond.indexOf(sign));
            val = parseInt(cond.substr(cond.indexOf(sign) + 1), 10);
            
            formatted = param;
            if (["hp", "mp", "allyhp", "allymp", "partyhp", "partymp", "enemyhp", "enemymp", "epartyhp", "epartymp", "gold", "enemies"].indexOf(param) === -1) {
                if (param.indexOf("~") === 0) {
                    item = param.substr(1);
                    if (!(item in items)) {
                        if(item in altItems) {
                            item = altItems[item];
                            formatted = "~" + item;
                        } else {
                            rpgbot.sendMessage(src, "The item '" + item + "' doesn't exist!", rpgchan);
                            return false;
                        }
                    }
                } else {
                    rpgbot.sendMessage(src, "Invalid parameter " + param + " for plan's condition!", rpgchan);
                    return false;
                }
            }
            if (["hp", "mp", "allyhp", "allymp", "partyhp", "partymp", "enemyhp", "enemymp", "epartyhp", "epartymp"].indexOf(param) !== -1) {
                if (isNaN(val) || val < 0 || val > 100) {
                    rpgbot.sendMessage(src, "Value for condition's parameter " + param + " must be a number between 0 and 100.", rpgchan);
                    return false;
                }
            } else {
                if (isNaN(val) || val < 0) {
                    rpgbot.sendMessage(src, "Value for condition's parameter " + param + " must be a number higher than 0.", rpgchan);
                    return false;
                }
            }
            
            valid.push(formatted + sign + val);
        }
        
        return valid.join(type);
    };
    this.skillOrItem = function(obj) {
        return obj[0] === "~" ? "~" + items[obj.substr(1)].name : skills[obj].name;
    };
    this.translateConditions = function(info) {
        if (info === "") {
            return "none of the previous conditions are met";
        }
        var out = [],
            sign = info.indexOf(":") !== -1 ? ":" : "*",
            condition = info.split(sign),
            c, cond, param, val, size;
            
        for (c in condition) {
            cond = condition[c];
            sign = cond.indexOf(">") !== -1 ? ">" : "<";
            param = cond.substring(0, cond.indexOf(sign));
            val = cond.substr(cond.indexOf(sign) + 1);
            size = sign === ">" ? "higher" : "lower";
            
            switch(param) {
                case "hp":
                    out.push("Player's HP is " + size + " than " + val + "%");
                    break;
                case "mp":
                    out.push("Player's Mana is " + size + " than " + val + "%");
                    break;
                case "allyhp":
                    out.push("an Ally's HP is " + size + " than " + val + "%");
                    break;
                case "allymp":
                    out.push("an Ally's Mana is " + size + " than " + val + "%");
                    break;
                case "partyhp":
                    out.push("Party's average HP is " + size + " than " + val + "%");
                    break;
                case "partymp":
                    out.push("Party's average Mana is " + size + " than " + val + "%");
                    break;
                case "enemyhp":
                    out.push("an Enemy's HP is " + size + " than " + val + "%");
                    break;
                case "enemymp":
                    out.push("an Enemy's Mana is " + size + " than " + val + "%");
                    break;
                case "epartyhp":
                    out.push("an Enemy's average HP is " + size + " than " + val + "%");
                    break;
                case "epartymp":
                    out.push("an Enemy's average Mana is " + size + " than " + val + "%");
                    break;
                case "gold":
                    out.push("Player's Gold is " + size + " than " + val);
                    break;
                case "enemies":
                    out.push("number of enemies alive is " + size + " than " + val);
                    break;
                default:
                    if (param.indexOf("~") === 0) {
                        out.push("player has " + (size === "higher" ? "more" : "less") + " than " + val + " " + items[param.substr(1)].name + "(s)");
                    }
                    break;
                
            }
        }
        
        return readable(out, (info.indexOf(":") !== -1 ? "and" : "or"));
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
        
        if (battleSetup.planMode !== "free" && player.isBattling === true) {
            rpgbot.sendMessage(src, "You cannot change skill levels while battling!", rpgchan);
            return;
        }
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
        
        if (battleSetup.planMode !== "free" && player.isBattling === true) {
            rpgbot.sendMessage(src, "You cannot set passive skills while battling!", rpgchan);
            return;
        }
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
            if (this.canUseSkill(src, skill) === false) {
                rpgbot.sendMessage(src, "You haven't learned the skill '" + skill + "'!", rpgchan);
                return;
            }
            
            if (skills[skill].type !== "passive") {
                rpgbot.sendMessage(src, skills[skill].name + " is not a passive skill!", rpgchan);
                return;
            }
            
            if (!(skill in player.skills)) {
                if ("boundSkills" in classes[player.job] && skill in classes[player.job].boundSkills) {
                    level = classes[player.job].boundSkills[skill];
                } else {
                    for (var r in player.equips) {
                        if (player.equips[r] !== null) {
                            var eq = items[player.equips[r]];
                            if ("effect" in eq && "boundSkills" in eq.effect && skill in eq.effect.boundSkills) {
                                level = eq.effect.boundSkills[skill];
                                break;
                            }
                        }
                    }
                }
            } else {
                level = info.length > 1 && !isNaN(parseInt(info[1], 10)) ? parseInt(info[1], 10) : player.skills[skill];
                if (level < 1 || level > player.skills[skill]) {
                    level = player.skills[skill];
                }
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
        }
        
        if (amount === 0) {
            this.fixSkills(src, skill);
        }
        
        if (remove) {
            delete player.skills[skill];
        }
        
        this.updateBonus(src);
    };
    this.fixSkills = function(src) {
        var player = getAvatar(src), s, p, plan;
        
        //Remove Skills that cannot be used from Plan, Saved Plans and Passives
        for (s in player.strategy) {
            if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                delete player.strategy[s];
            }
        }
        for (p in player.plans) {
            for (s in player.plans[p]) {
                if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                    delete player.plans[p][s];
                }
            }
        }
        for (s in player.passives) {
            if (this.canUseSkill(src, s) === false) {
                delete player.passives[s];
            }
        }
        for (p in player.advStrategy) {
            plan = player.advStrategy[p];
            if (plan !== null) {
                for (s in plan[1]) {
                    if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                        delete plan[1][s];
                    }
                }
            }
        }
        
        //Unequip equipment that cannot be used anymore due to Passives unequipped
        for (s in player.equips) {
            if (player.equips[s] !== null && this.canUseItem(player, player.equips[s]) === false) {
                rpgbot.sendMessage(src, items[player.equips[s]].name + " unequipped!", rpgchan);
                player.equips[s] = null;
            }
        }
        
        //Remove Skills that cannot be used from Plan, Saved Plans and Passives due to Equipment unequipped
        for (s in player.strategy) {
            if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                delete player.strategy[s];
            }
        }
        for (p in player.plans) {
            for (s in player.plans[p]) {
                if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                    delete player.plans[p][s];
                }
            }
        }
        for (s in player.passives) {
            if (this.canUseSkill(src, s) === false) {
                delete player.passives[s];
            }
        }
        for (p in player.advStrategy) {
            plan = player.advStrategy[p];
            if (plan !== null) {
                for (s in plan[1]) {
                    if (s[0] !== "~" && this.canUseSkill(src, s) === false) {
                        delete plan[1][s];
                    }
                }
            }
        }
    };
    this.canUseSkill = function(src, skill) {
        var player = getAvatar(src), job = classes[player.job];
        
        if (skill in player.skills && player.skills[skill] > 0) {
            return true;
        } else if ("boundSkills" in job && job.boundSkills[skill] > 0) {
            return true;
        } else {
            var equip;
            for (var s in player.equips) {
                if (player.equips[s] !== null) {
                    equip = items[player.equips[s]];
                    if ("effect" in equip && "boundSkills" in equip.effect && equip.effect.boundSkills[skill] > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
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
            var s, p, newJob = classes[job];
            
            for (s in player.skills) {
                if (!(s in newJob.skills) && player.skills[s] === 0 && leveling.skillFromOtherClass === false) {
                    delete player.skills[s];
                }
            }
            
            for (s in newJob.skills) {
                if (!(s in player.skills)) {
                    player.skills[s] = newJob.skills[s];
                }
            }
            
            this.fixSkills(player.id);
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
        
        player.guild = null;
        
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
        player.timers = {};
        
        player.quests = {};
        player.titles = [];
        player.currentTitle = null;
        player.updateReset = true;
        
        this.updateBonus(src);
        
        sys.sendMessage(src, "", rpgchan);
        rpgbot.sendMessage(src, "Character successfully created!", rpgchan);
        
        var guild, lowerName = player.name.toLowerCase();
        for (x in this.guilds) {
            guild = this.guilds[x];
            if (lowerName in guild.members) {
                if (guild.leader === lowerName) {
                    guild.destroy();
                } else {
                    guild.leaveGuild(src, true);
                }
            }
        }
        
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
        character.advStrategy = [];
        for (e = 0; e < battleSetup.advancedPlans - 1; e++) {
            character.advStrategy.push(null);
        }
        character.advStrategy.push(["", JSON.parse(JSON.stringify(character.strategy))]);
        
        character.planMode = "basic";
        
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
        
        var player = user[rpgAtt];
        if (player.guild !== null) {
            this.guilds[player.guild].updateMembersInfo(player);
        }
        
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
        
        try {
            gamefile = this.convertChar(gamefile);
        } catch (err) {
            rpgbot.sendMessage(src, "Your game file is corrupted. Try contacting a channel staff for possible solutions.", rpgchan);
            return;
        }
        
        user[rpgAtt] = gamefile;
        var player = user[rpgAtt];
        player.id = src;
        player.party = null;
        
        rpgbot.sendMessage(src, "Your character has been loaded successfully!", rpgchan);
        if (player.guild !== null) {
            if (!(player.guild in this.guilds) || !(player.name.toLowerCase() in this.guilds[player.guild].members)) {
                player.guild = null;
            } else {
                this.guilds[player.guild].memberLogin(src);
            }
        }
        
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
        if (!file.timers) {
            file.timers = {};
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
        if (!file.guild) {
            file.guild = null;
        }
        
        if (!file.advStrategy) {
            file.advStrategy = [
                ["", JSON.parse(JSON.stringify(file.strategy))]
            ];
            file.planMode = "basic";
        } 
        if (file.advStrategy.length < battleSetup.advancedPlans) {
            while (file.advStrategy.length < battleSetup.advancedPlans) {
                file.advStrategy.splice(0, 0, null);
            }
        } else if (file.advStrategy.length > battleSetup.advancedPlans) {
            while (file.advStrategy.length > battleSetup.advancedPlans) {
                if (file.advStrategy.indexOf(null) >= 0) {
                    file.advStrategy.splice(file.advStrategy.indexOf(null), 1);
                } else {
                    file.advStrategy.splice(0, 1);
                }
            }
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
        
        if (leveling.saveOnClear === true) {
            this.saveGame(src, "sure");
        }
        
        if (user[rpgAtt].guild !== null) {
            this.guilds[user[rpgAtt].guild].memberLogout(src);
        }
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
        
        this.setToLevel(player, player.level - levels);
        
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
    this.setToLevel = function(player, level) {
        player.level = level;
        if (player.level < 1) {
            player.level = 1;
        } else if (player.level > expTable.length + 1) {
            player.level = expTable.length + 1;
        }
        if (player.level === 1) {
            player.exp = 0;
        } else {
            player.exp = expTable[player.level - 2];
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
                out.push(this.getSkillDescription(s, player.skills[s]) + (leveling.skillFromOtherClass === false && !(s in classes[job].skills) ? "(Skill from another class)" : ""));
            }
        }
        out.push("");
        out.push("Passive Skills:");
        for (s in player.skills) {
            if (skills[s].type === "passive") {
                out.push(this.getSkillDescription(s, player.skills[s]) + (leveling.skillFromOtherClass === false && !(s in classes[job].skills) ? "(Skill from another class)" : ""));
            }
        }
        
        if ("boundSkills" in classes[job]) {
            out.push("");
            out.push("Class-bound Skills:");
            for (s in classes[job].boundSkills) {
                out.push(this.getSkillDescription(s, classes[job].boundSkills[s]));
            }
        }
        
        var bound = {}, equip;
        for (s in player.equips) {
            if (player.equips[s] !== null) {
                equip = items[player.equips[s]];
                if ("effect" in equip && "boundSkills" in equip.effect) {
                    for (var e in equip.effect.boundSkills) {
                        if (!(e in bound) || equip.effect.boundSkills[e] > bound[e]) {
                            bound[e] = equip.effect.boundSkills[e];
                        }
                    }
                }
            }
        }
        
        if (Object.keys(bound).length > 0) {
            out.push("");
            out.push("Equipment-bound Skills:");
            for (s in bound) {
                out.push(this.getSkillDescription(s, bound[s]));
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
    this.getSkillDescription = function(skill, level) {
        var move = skills[skill];
        if (move.type !== "passive") {
            return move.name + " (" + skill + ") : [" + level + "/" + move.levels + "] " + move.info + " (" + getLevelValue(move.cost, (level > 0 ? level : 1) - 1) + " Mana) ";
        } else {
            return move.name + " (" + skill + ") : [" + level + "/" + move.levels + "] " + move.info + " (Passive)";
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
            out.push(skills[i].name + " (" + i + ") : [" + target.skills[i] + "/" + skills[i].levels + "] " + skills[i].info + (skills[i].type === "passive" ? " (Passive)" : " (" + getLevelValue(skills[i].cost, target.skills[i] - 1) + " Mana)"));
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
        var commandsHelp = {
            actions: [
                "/walk [location]%: To go to a different location. Type only '/walk' to see where you can go to from your current location. [Alt: /w]",
                "/talk [npc]%: To talk to an NPC. Type only '/talk' to see a list of NPCs and Objects at your current location. [Alt: /t]",
                "/act [object]%: To interact with an Object. Type only '/act' to see a list of NPCs and Objects at your current location. [Alt: /a]",
                "/explore%: To explore a location for items, monsters or events. [Alt: /e]",
                "/flee%: To run away from your current battle. [Alt: /f]",
                "/item [item]%: To use an Usable Item or equip an Equipment. Type only /item to see all you items you have. [Alt: /i]",
                "/challenge [player]%: To challenge another player to a duel. You must be at the same location as that person. [Alt: /c]",
                "/revive%: To respawn after you die. You will spawn at your last spawn point with half of your maximum HP. [Alt: /r]",
                "/trade [player]:[item you offer]:[item you want]%: To request a trade with another player. To trade more than 1 item, use [item]*[amount]. To trade Gold, just put a number instead of an item name.[Alt: /t]",
                "/accept [player]%: To instantly accept someone's trade offer."
            ],
            character: [
                "/plan [strategy]%: To view or set your battle strategy. Formatting for [strategy] is [skill1]:[chance]*[skill2]:[chance]*[~item]:[chance]. You can have as many skills/items in your strategy as you want. Example: /plan attack:60*rest:20*~potion:20 to set your plan to 60% Attack, 20% Rest and 20% Potion item.",
                "/plan set [slot] [strategy]%: To register a strategy in one of your Saved Plans slots. [slot] can be 1, 2 or 3.",
                "/plan load [slot] [strategy]%: To load a saved strategy from one of your Saved Plans slots. [slot] can be 1, 2 or 3.",
                "/aplan [slot] [conditions] [strategy]%: To set your Advanced Strategy. Use /aplan help for more details.",
                "/setskill [skill]:[level]%: To define a skill that should be used in a lower level instead of its current level. [Alt: /setskills]",
                "/passive [skill1]:[skill2]%: To view or set your passive skills. To set a passive skill to a lower level than its current level, use [skill]*[level]. [Alt: /passives]",
                "/stats%: To view your character status.",
                "/skills%: To view your character's skills. [Alt: /skill]",
                "/quests%: To view the quests you started or completed. [Alt: /q]",
                "/increase [attribute/skill]:[points]%: To increase your stats or skills after you level up. Example: /increase str:2 (increase Strength by 2 points) or /increase empower:1 (increase Empower skill level).",
                "/savechar%: To save your progress.",
                "/clearchar%: To clear your character.",
                "/party%: To create and manage a party. [Alt: /p]",
                "/partytalk [message]%: To talk to your party. [Alt: /pt]",
                "/title [number]%: To view or change your current Title. [Alt: /titles]",
                "/appearance [text]%: To change your appearance description that's displayed when someone view your character.",
                "/font [number]%: To change the Battle's text size. Default is 11. Set to 0 to disable Battle Texts.",
                "/getplan [slot]%: To get your Battle Plan in the same format you type it for easy Copy/Paste. Set a [slot] to get one of your saved plans.",
                "/it [type]%: To view your items organized by category. Set a [type] to only show items from a specific type.",
                "/watch [player]%: To watch someone else's battle. Use '/watch on' or '/watch off' to enable or disable other players from watching your battles."
            ],
            channel: [
                "/help%: To learn how to play the game.",
                "/rpgcommands%: To see the list of commands.",
                "/classes%: To view basic information about each starting class.",
                "/start [class]%: To create your character with the specified class and begin your game.",
                "/loadchar%: To load your previously saved game.",
                "/view [player]%: To view someone else's stats. Use '/view on' or '/view off' to enable or disable other players from viewing your stats.",
                "/leaderboard%: To view the RPG Leaderboards. [Alt: /rpgleaderboard]"
            ],
            auth: [
                "/reloadchars%: To reload everyone's character after an update.",
                "/updateleaderboard%: To manually update the RPG Leaderboards.",
                "/unbork [player]%: To manually fix someone's character.",
                "/resetplayer [player]%: To reset a player's stats and skills.",
                "/punish [player]:[levels]%: To punish a player's character.",
                "/updatelocal%: To load RPG content from the server's directory.",
                "/updaterpg [url]%: To load RPG content from the web. If you don't specify an URL, the last URL will be used.",
                "/updategame%: Update the RPG Scripts.",
                "/updatemodule [module]%: Update an RPG Module.",
                "/getcontent%: To view the content file for RPG."
            ]
        };
        
        var x, type = commandData.toLowerCase(), output = [""];
		if (type !== "auth"){
            if (getAvatar(src) !== undefined) {
                output.push("<b><font color=red>Actions: </font></b>");
                for (x in commandsHelp.actions) {
                    output.push("<b>" + commandsHelp.actions[x].replace(/%/g, "</b>"));
                }
                output.push("");
                output.push("<b><font color=red>Character Commands: </font></b>");
                for (x in commandsHelp.character) {
                    output.push("<b>" + commandsHelp.character[x].replace(/%/g, "</b>"));
                }
                output.push("");
            } 
                
            output.push("<b><font color=red>Channel Commands: </font></b>");
            for (x in commandsHelp.channel) {
                output.push("<b>" + commandsHelp.channel[x].replace(/%/g, "</b>"));
            }
            output.push("");
		} else {
			if (SESSION.channels(rpgchan).masters.indexOf(sys.name(src).toLowerCase()) !== -1) {
				output.push("<b><font color=red>Owner Commands: </font></b>");
				for (x in commandsHelp.auth) {
					output.push("<b>" + commandsHelp.auth[x].replace(/%/g, "</b>"));
				}
                output.push("");
			}
		}
        sys.sendHtmlMessage(src, output.join("<br/>"), rpgchan);
    };
    this.showHelp = function(src) {
		for (var x in gameHelp) {
           sys.sendMessage(src, gameHelp[x], rpgchan);
        }
	};
    
    this.createGuild = function(src, data) {
        var player = getAvatar(src);
        
        if (player.guild !== null) {
            return false;
        }
        
        if (data.toLowerCase() in this.guilds) {
            return false;
        }
        
        var guild = new Guild(data, { player: player, isNew: true }, this);
        this.guilds[data.toLowerCase()] = guild;
        player.guild = data.toLowerCase();
        rpgbot.sendMessage(src, "Guild " + data + " created!", rpgchan);
        this.saveGuilds();
        this.saveGame(src, "sure");
    };
    this.saveGuilds = function() {
        sys.writeToFile(guildsfile, JSON.stringify(this.guilds, function(key, value) {
            if (key == "game" && typeof value === "object") {
                return;
            }
            return value;
        }));
    };
    this.loadGuilds = function() {
        this.guilds = JSON.parse(sys.getFileContent(guildsfile));
        
        var g, oldGuild, newGuild;
        for (g in this.guilds) {
            oldGuild = this.guilds[g];
            newGuild = new Guild(oldGuild.name, oldGuild, this);
            newGuild.updateContent(this);
            newGuild.updateMembers();
            
            this.guilds[g] = newGuild;
        }
    };
    this.updateGuilds = function() {
        var g, oldGuild, newGuild;
        for (g in this.guilds) {
            oldGuild = this.guilds[g];
            newGuild = new Guild(oldGuild.name, oldGuild, this);
            newGuild.updateContent(this);
            newGuild.updateMembers();
            
            this.guilds[g] = newGuild;
        }
    };
    this.guildCommands = function(src, commandData) {
        var player = getAvatar(src);
        
        if (commandData === "u") {
            this.saveGuilds();
            return;
        }
        
        if (player.guild !== null) {
            this.guilds[player.guild.toLowerCase()].useCommand(src, commandData);
        } else {
            var info = commandData.split(":");
            
            if (info.length < 2) {
                rpgbot.sendMessage(src, "Guild Commands: ", rpgchan);
                return;
            }
            var comm = info[0].toLowerCase(),
                data = info[1];
            
            switch (comm) {
                case "accept":
                case "join":
                    if (data.toLowerCase() in this.guilds) {
                        this.guilds[data.toLowerCase()].acceptInvite(player);
                    } else {
                        sys.sendMessage(src, "", rpgchan);
                        rpgbot.sendMessage(src, "No such Guild!", rpgchan);
                        var pending = [], name = player.name.toLowerCase();
                        
                        for (var g in this.guilds) {
                            if (name in this.guilds[g].invites) {
                                pending.push(this.guilds[g].name);
                            }
                        }
                        if (pending.length > 0) {
                            rpgbot.sendMessage(src, "You have invitations to the following guilds: " + readable(pending, "and") + ".", rpgchan);
                        }
                    }
                break;
                case "create":
                case "c":
                    this.createGuild(src, data);
                break;
                default:
                    rpgbot.sendMessage(src, "Invalid Guild Command!", rpgchan);
            }
            sys.sendMessage(src, "", rpgchan);
        }
    };
    this.talkToGuild = function(src, commandData) {
        var player = getAvatar(src);
        
        if (player.guild === null) {
            rpgbot.sendMessage(src, "You are not in any party!", rpgchan);
            return;
        }
        this.guilds[player.guild].guildChat(src, commandData);
    };
    
    function runUpdate() {
        var tempBattles = game.currentBattles;
        var tempDuels = duelChallenges;
        var tempTrades = tradeRequests;
        var tempParty = game.currentParties;
        var tempBoards = leaderboards;
        var tempGuilds = game.guilds;
        
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
                module.game.restoreValues(tempBattles, tempDuels, tempTrades, tempParty, tempBoards, tempGuilds);
                
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
                case "guild":
                    rpgbot.sendMessage(src, "Updating RPG Guild module!", rpgchan);
                    updateModule(plugins.guild, function(module) {
                        Guild = module.Guild;
                        rpgbot.sendMessage(src, "Guild Module updated!", rpgchan);
                        game.updateGuilds();
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
                    classHelp: classHelp,
                    gameHelp: gameHelp
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
            
            if (parsed.gameHelp) {
                gameHelp = parsed.gameHelp;
            } else if (result.gameHelp) {
                gameHelp = result.gameHelp;
            }
            
            expTable = config.levels;
            elements = config.elements || {};
            
            if (config.battle) {
                var battle = config.battle;
                if (battle.baseAccuracy) {
                    battleSetup.baseAccuracy = battle.baseAccuracy;
                }
                if (battle.evasion) {
                    battleSetup.evasion = battle.evasion;
                }
                if (battle.defense) {
                    battleSetup.defense = battle.defense;
                }
                if (battle.damage) {
                    battleSetup.damage = battle.damage;
                }
                if (battle.levelDamageBonus) {
                    battleSetup.levelDamageBonus = battle.levelDamageBonus;
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
                if (battle.partyExp) {
                    battleSetup.partyExp = battle.partyExp;
                }
                if (battle.itemMode) {
                    battleSetup.itemMode = battle.itemMode;
                }
                if (battle.planMode) {
                    battleSetup.planMode = battle.planMode;
                }
                if (battle.secondaryDefense) {
                    battleSetup.secondaryDefense = battle.secondaryDefense;
                }
                if (battle.advancedPlans) {
                    battleSetup.advancedPlans = battle.advancedPlans;
                }
                if (battle.defaultSkill) {
                    battleSetup.defaultSkill = battle.defaultSkill;
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
                if (level.saveOnClear) {
                    leveling.saveOnClear = level.saveOnClear;
                }
            }
            
            if (config.equipment) {
                equipment = config.equipment;
            }
            
            if (config.guild) {
                if (config.guild.baseMembers) {
                    guildInfo.baseMembers = config.guild.baseMembers;
                }
                if (config.guild.membersPerLevel) {
                    guildInfo.membersPerLevel = config.guild.membersPerLevel;
                }
                if (config.guild.exp) {
                    guildInfo.exp = config.guild.exp;
                }
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
                classHelp: classHelp,
                gameHelp: gameHelp
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
                if (parsed.gameHelp) { 
                    updated.push("Game Help");
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
                    gameHelp: parsed.gameHelp ? url + " [" + date + "]" : contentLoc.gameHelp,
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
            this.guildInfo = guildInfo;
            
            this.updateParties();
            
            rpgbot.sendAll("RPG Game reloaded!", rpgchan);
		} catch (err) {
			sys.sendAll("Error loading RPG Game data: " + err, rpgchan);
		}
	};
    this.restoreValues = function(tempBattles, tempDuels, tempTrades, tempParty, tempBoards, tempGuilds) {
        tradeRequests = tempTrades;
        game.currentBattles = tempBattles;
        duelChallenges = tempDuels;
        game.currentParties = tempParty;
        game.guilds = tempGuilds;
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
        sys.sendMessage(src, "Game Help URL: " + contentLoc.gameHelp, rpgchan);
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
            case "event":
            case "events":
                switch (action) {
                    case "change":
                    case "edit":
                        if (obj) {
                            if (val && (val.toLowerCase() === "true" || val.toLowerCase() === "false")) {
                                val = val.toLowerCase() === "true" ? true : false;
                                target.events[obj] = val;
                                rpgbot.sendMessage(src, "Successfully changed " + target.name + "'s '" + obj + "' event to " + val+ ".", rpgchan);
                            } else {
                                rpgbot.sendMessage(src, "Invalid value. Events can only be set to 'true' or 'false'.", rpgchan);
                            } 
                        } else {
                            rpgbot.sendMessage(src, "Choose an event!", rpgchan);
                        }
                        break;
                    default:
                        sys.sendMessage(src, sys.name(id) + "'s events:", rpgchan);
                        for (r in target.events) {
                            sys.sendMessage(src, r + ": " + target.events[r], rpgchan);
                        }
                }
                break;
            case "title":
            case "titles":
                switch (action) {
                    case "add":
                        if (obj) {
                            if (!(obj in titles)) {
                                rpgbot.sendMessage(src, "Invalid title!", rpgchan);
                                return;
                            }
                            if (target.titles.indexOf(obj) !== -1) {
                                rpgbot.sendMessage(src, "Player " + target.name + " already have this title!", rpgchan);
                                return;
                            }
                            
                            target.titles.push(obj);
                            rpgbot.sendMessage(src, "Successfully added title " + obj + " to player " + target.name + "!", rpgchan);
                        } else {
                            rpgbot.sendMessage(src, "Choose a title!", rpgchan);
                        }
                        break;
                    case "remove":
                        if (obj) {
                            if (target.titles.indexOf(obj) !== -1) {
                                target.titles.splice(target.titles.indexOf(obj), 1);
                                if (target.currentTitle === obj) {
                                    target.currentTitle = null;
                                }
                                rpgbot.sendMessage(src, "Successfully removed title " + obj + " from player " + target.name + "!", rpgchan);
                            } else {
                                rpgbot.sendMessage(src, target.name + " doesn't have this title!", rpgchan);
                            }
                        } else {
                            rpgbot.sendMessage(src, "Choose a title!", rpgchan);
                        }
                        break;
                    default:
                        sys.sendMessage(src, sys.name(id) + "'s titles:", rpgchan);
                        for (r in target.titles) {
                            sys.sendMessage(src, target.titles[r] + (target.titles[r] in titles ? " (" + titles[target.titles[r]].name + ")" : " (undefined)"), rpgchan);
                        }
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
            aplan: [this.setAdvancedPlan, "To view or set your advanced battle strategy."],
            setskill: [this.setSkillLevel, "To view or set the level you want to use your skills."],
            passive: [this.setPassiveSkills, "To view or set your passive skills."],
            stats: [this.viewStats, "To view your character status."],
            skills: [this.viewSkills, "To view the available skills."],
            quests: [this.viewQuests, "To view the quests you started or completed."],
            increase: [this.addPoint, "To increase your stats or skills after you level up."],
            savechar: [this.saveGame, "To save your progress."],
            clearchar: [this.clearChar, "To clear your character."],
            party: [this.manageParty, "To create and manage a party."],
            partytalk: [this.talkToParty, "To talk to your party."],
            guild: [this.guildCommands, "To manage a Guild."],
            guildtalk: [this.talkToGuild, "To talk to your party."],
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
            passives: [this.setPassiveSkills, "Same as /passive."],
            titles: [this.changeTitle, "Same as /title."],
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
            g: [this.guildCommands, "Same as /guild."],
            pt: [this.talkToParty, "Same as /partytalk."],
            gt: [this.talkToGuild, "Same as /partytalk."]
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
        }
        if (tick % 60 === 0) {
            this.saveGuilds();
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
        game.updateLeaderboard();
        game.loadGuilds();
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
