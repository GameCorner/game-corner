// Global variables inherited from scripts.js
/*global rpgbot, sys, SESSION, exports*/
function Battle(viewers, teamA, teamB, rpg) {
    this.game = rpg;
    this.rpgchan = rpg.rpgchan;
    this.skills = rpg.skills;
    this.items = rpg.items;
    this.places = rpg.places;
    this.elements = rpg.elements;
    this.titles = rpg.titles;
    this.battleSetup = rpg.battleSetup;
    this.leveling = rpg.leveling;
    
    this.viewers = viewers;
    this.team1 = teamA;
    this.team2 = teamB;
    this.turn = 1;
    this.events = [];
    this.forceSave = false;
    
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
        player = this.team1[p];
        player.battle = {
            counters: {
                bonus: {},
                overTime: {},
                effects: {}
            },
            bonus: {},
            effects: {},
            hpdamage:{},
            mpdamage:{},
            delay: 0,
            attributes: {}
        };
        if (this.team1[p].isPlayer) {
            p1 = true;
            this.colorNames[player.name] = '<span style="font-weight:bold; color:' + sys.getColor(player.id) + ';">' + player.name + '</span>';
        } else if (this.team1[p].forceSave === true) {
            this.forceSave = true;
        }
    }
    for (p in this.team2) {
        player = this.team2[p];
        player.battle = {
            counters: {
                bonus: {},
                overTime: {},
                effects: {}
            },
            bonus: {},
            effects: {},
            hpdamage:{},
            mpdamage:{},
            delay: 0,
            attributes: {}
        };
        if (this.team2[p].isPlayer) {
            p2 = true;
            this.colorNames[player.name] = '<span style="font-weight:bold; color:' + sys.getColor(player.id) + ';">' + player.name + '</span>';
        } else if (this.team2[p].forceSave === true) {
            this.forceSave = true;
        }
    }
    
    this.colorOrder = Object.keys(this.colorNames).sort(function(a, b){
      return b.length - a.length; // ASC -> a - b; DESC -> b - a
    });
    
    if (p1 && p2) {
        this.isPVP = true;
    }
    
    this.names1 = this.team1.map(getName, this);
    this.names2 = this.team2.map(getName, this);
    this.titleNames1 = this.team1.map(this.getTitlePlayer, this);
    this.titleNames2 = this.team2.map(this.getTitlePlayer, this);
}
Battle.prototype.playNextTurn = function() {
    var out = ['', '<span style="font-weight:bold;">Turn: ' + this.turn + '</span>'];
    var team1 = this.team1;
    var team2 = this.team2;
    
    var priority = team1.concat(team2);
    var pr, i;
    for (i in priority) {
        pr = priority[i];
        pr.battle.attributes = {
            str: getFullValue(pr, "str"),
            def: getFullValue(pr, "def"),
            spd: getFullValue(pr, "spd"),
            dex: getFullValue(pr, "dex"),
            mag: getFullValue(pr, "mag"),
            accuracy: this.getBuffedMultiplier(pr, "accuracy"),
            evasion: this.getBuffedMultiplier(pr, "evasion"),
            critical: this.getBuffedMultiplier(pr, "critical"),
            attackSpeed: this.getBuffedMultiplier(pr, "attackSpeed")
        };
    }
    
    priority.sort(function(a, b) { return b.battle.attributes.spd - a.battle.attributes.spd; });
    
    var totalDex = 0;
    for (i = 0; i < priority.length; ++i) {
        pr = priority[i];
        if (pr.hp > 0) {
            totalDex += pr.battle.attributes.dex;
        }
    }
    var doubleAttackDex = Math.floor(totalDex / (priority.length + 1) * 2) + 1;
    var tripleAttackDex = Math.floor(totalDex * 0.75) + 1;
    var quadAttackDex = Math.floor(totalDex * 0.90) + 1;
    for (i = priority.length - 1; i >= 0; --i) {
        pr = priority[i];
        var d = Math.floor(pr.battle.attributes.dex * pr.battle.attributes.attackSpeed);
        if (d >= doubleAttackDex && d >= 3) {
            priority.push(pr);
            if (d >= tripleAttackDex) {
                priority.push(pr);
                if (d >= quadAttackDex) {
                    priority.push(pr);
                }
            }
        }
    }
    
    var player, side, target, targets, castComplete, focusList, winner;
    var effectsMessages;
    for (i = 0; i < priority.length; ++i) {
        winner = null;
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
            damagedMp: {},
            damagedNames: [],
            evaded: [],
            summons: [],
            userEffect: [],
            targetEffect: [],
            summonFailed: false
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
            var move = this.skills[moveName];
            var level;
            if (player.isPlayer && moveName in player.skillLevels && player.skillLevels[moveName] < player.skills[moveName]) {
                level = player.skillLevels[moveName] - 1;
            } else {
                level = player.skills[moveName] - 1;
            }
            
            var mpModifier = this.getPassiveMultiplier(player, "mpModifier");
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
                    if(this.game.hasItem(player, move.effect.itemCost, 1) === false) {
                        out.push(player.name + " tried to use " + move.name + ", but didn't have a " + this.items[move.effect.itemCost].name + "!");
                        continue;
                    }
                } else {
                    var missingItems = [];
                    for (n in move.effect.itemCost) {
                        if (move.effect.itemCost[n] < 0) {
                            continue;
                        } else if(this.game.hasItem(player, n, move.effect.itemCost[n]) === false) {
                            missingItems.push((move.effect.itemCost[n] || "a") + " " + this.items[n].name + "(s)");
                        }
                    }
                    if (missingItems.length > 0) {
                        out.push(player.name + " tried to use " + move.name + ", but didn't have " + readable(missingItems, "and") + "!");
                        continue;
                    }
                }
                
            }
            
            if (!castComplete && "cast" in move) {
                var cast = Math.round((getLevelValue(move.cast, level) + this.getPassiveValue(player, "castTime")) * this.getPassiveMultiplier(player, "castMultiplier"));
                
                if (cast > 0 || (cast === 0 && this.battleSetup.instantCast === false)) {
                    out.push(player.name + " is preparing to use " + this.skills[moveName].name + "!");
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
                case "ally":
                    targetTeam = side === 1 ? shuffle(team1.concat()) : shuffle(team2.concat());
                    focusList = side === 1 ? shuffle(this.team1Focus.concat()) : shuffle(this.team2Focus.concat());
                    if (targetTeam.indexOf(player) !== -1) {
                        targetTeam.splice(targetTeam.indexOf(player), 1);
                    }
                    if (focusList.indexOf(player) !== -1) {
                        focusList.splice(focusList.indexOf(player), 1);
                    }
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
            
            var count = (move.targetCount) ? getLevelValue(move.targetCount, level) : 1;
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
            
            player.mp -= Math.floor(getLevelValue(move.cost, level) * mpModifier);
            if (player.isPlayer === true && move.effect && "goldCost" in move.effect) {
                player.gold -= getLevelValue(move.effect.goldCost, level);
            }
            if (player.isPlayer === true && move.effect && "itemCost" in move.effect) {
                if (typeof move.effect.itemCost === "string") {
                    this.game.changeItemCount(player, move.effect.itemCost, -1);
                } else {
                    for (n in move.effect.itemCost) {
                        this.game.changeItemCount(player, n, -move.effect.itemCost[n]);
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
                    var acc = player.battle.attributes.dex * ((move.effect && move.effect.accuracy) ? getLevelValue(move.effect.accuracy, level) : 1) * player.battle.attributes.accuracy;
                    var evd = target.battle.attributes.spd * this.battleSetup.evasion * target.battle.attributes.evasion;
                    if (acc <= 0) {
                        acc = 1;
                    }
                    if (evd <= 0) {
                        evd = 1;
                    }
                    var evadeCheck = 0.7 + ((acc - evd) / 100);
                    if (evadeCheck < 0.05) {
                        evadeCheck = 0.05;
                    } else if (evadeCheck > 0.95) {
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
                                power += player.battle.attributes[m] * getLevelValue(move.effect.attributeModifier[m], level);
                            } else if (["hp", "mp", "maxhp", "maxmp"].indexOf(m) !== -1) {
                                power += player[m] * getLevelValue(move.effect.attributeModifier[m], level);
                            }
                        }
                    } else {
                        power = move.type === "physical" ? player.battle.attributes.str : player.battle.attributes.mag;
                        if (power <= 0) {
                            power = 1;
                        }
                    }
                    var pinch = 1;
                    if (move.effect && "pinch" in move.effect) {
                        if ("hp" in move.effect.pinch) {
                            pinch *= player.hp/player.maxhp * getLevelValue(move.effect.pinch.hp, level);
                        } else if ("hpReverse" in move.effect.pinch) {
                            pinch *= getLevelValue(move.effect.pinch.hpReverse, level) - player.hp/player.maxhp * getLevelValue(move.effect.pinch.hpReverse, level);
                        }
                        if ("mp" in move.effect.pinch) {
                            pinch *= player.m/player.maxmp * getLevelValue(move.effect.pinch.mp, level);
                        } else if ("mpReverse" in move.effect.pinch) {
                            pinch *= getLevelValue(move.effect.pinch.mpReverse, level) - player.mp/player.m * getLevelValue(move.effect.pinch.mpReverse, level);
                        }
                    }
                    
                    // Passive Skill that increases damage by consuming Gold
                    var goldDamageSkills = this.getPassiveByEffect(player, "goldDamage"), goldBonus = 0;
                    if (goldDamageSkills.length > 0) {
                        var goldUsed, goldLevel;
                        for (var g in goldDamageSkills) {
                            goldLevel = player.passives[goldDamageSkills[g]] - 1;
                            goldUsed = getLevelValue(this.skills[goldDamageSkills[g]].effect.goldDamage.cost, goldLevel);
                            if (player.gold >= goldUsed) {
                                goldBonus += getLevelValue(this.skills[goldDamageSkills[g]].effect.goldDamage.modifier, goldLevel);
                                player.gold -= goldUsed;
                            }
                        }
                    }
                    
                    power = power * (getLevelValue(move.modifier, level) + goldBonus) * pinch * this.battleSetup.damage;
                    
                    var def = target.battle.attributes.def * this.battleSetup.defense;
                    if (move.effect && move.effect.pierce) {
                        var pierce = move.effect.pierce;
                        if (pierce === true) {
                            pierce = 1;
                        } else if (pierce === false) {
                            pierce = 0;
                        }
                        def *= 1 - pierce;
                    }
                    if (def < 1) {
                        def = 1;
                    }
                    
                    var atkElement = "none";
                    if (move.element && move.element !== "none") {
                        atkElement = move.element;
                    } else if (player.battle.attackElement) {
                        atkElement = player.battle.attackElement;
                    } else {
                        atkElement = player.attackElement;
                    }
                    
                    var defElement = "none";
                    if (target.battle.defenseElement) {
                        defElement = target.battle.defenseElement;
                    } else {
                        defElement = target.defenseElement;
                    }
                    
                    var element = 1;
                    if (atkElement in this.elements && defElement in this.elements[atkElement] && defElement !== "name") {
                        element = this.elements[atkElement][defElement];
                    }
                    
                    var main = move.type === "physical" ? player.battle.attributes.str : player.battle.attributes.mag;
                    var invert = move.type === "physical" ? player.battle.attributes.mag : player.battle.attributes.str;
                    main = main <= 0 ? 1 : main;
                    invert = invert <= 0 ? 1 : invert;
                    var varRange = (invert / main > 1 ? 1 : invert / main) * 0.25;
                    var variation = (0.75 + varRange) + (Math.random() * (0.25 - varRange));
                    
                    if (power < 0) {
                        critical = 1;
                    } else {
                        var critChance = (invert / main) * 0.66 * player.battle.attributes.critical;
                        critical = (Math.random() < critChance) ? this.battleSetup.critical : 1;
                    }
                    variation = (critical === this.battleSetup.critical) ? 1 : variation;
                    damage = Math.floor((power / def) * element * variation * critical) + (getLevelValue(move.modifier, level) >= 0 ? 1 : -1);
                } 
                var userDmg = 0, mpDmg = 0, userMpDmg = 0, tempDmg;
                if (move.effect) {
                    var duration = move.effect.duration ? getLevelValue(move.effect.duration, level) : 6;
                    var e, eff, bonus;
                    var bonusAtt = ["str", "def", "spd", "dex", "mag", "accuracy", "critical", "evasion", "attackSpeed"];
                    
                    if (move.effect.target && (!move.effect.targetChance || Math.random() < getLevelValue(move.effect.targetChance, level))) {
                        eff = move.effect.target;
                        
                        //Apply attribute bonus for player attributes (str, def, etc) and modifiers (accuracy, critical, etc).
                        for (e in bonusAtt) {
                            if (bonusAtt[e] in eff) {
                                target.battle.bonus[moveName] = {};
                                
                                for (e in bonusAtt) {
                                    bonus = bonusAtt[e];
                                    if (bonus in eff) {
                                        target.battle.bonus[moveName][bonus] = getLevelValue(eff[bonus], level);
                                        if (["str", "def", "spd", "dex", "mag"].indexOf(bonus) !== -1) {
                                            target.battle.attributes[bonus] = getFullValue(target, bonus);
                                        } else {
                                            target.battle.attributes[bonus] = this.getBuffedMultiplier(target, bonus);
                                        }
                                    }
                                }
                                target.battle.counters.bonus[moveName] = duration;
                                break;
                            }
                        }
                        if ("mp" in eff) {
                            tempDmg = getLevelValue(eff.mp, level);
                            target.mp += tempDmg;
                            mpDmg += tempDmg;
                        }
                        if ("hp" in eff) {
                            damage -= getLevelValue(eff.hp, level);
                        }
                        if ("mpPercent" in eff) {
                            tempDmg = Math.round(getLevelValue(eff.mpPercent, level) * target.maxmp);
                            target.mp += tempDmg;
                            mpDmg += tempDmg;
                        }
                        if ("hpPercent" in eff) {
                            damage -= Math.round(getLevelValue(eff.hpPercent, level) * target.maxhp);
                        }
                        //Damage Over Time Effect
                        if ("hpdamage" in eff) {
                            target.battle.counters.overTime[moveName] = duration;
                            target.battle.hpdamage[moveName] = getLevelValue(eff.hpdamage, level);
                        }
                        if ("mpdamage" in eff) {
                            target.battle.counters.overTime[moveName] = duration;
                            target.battle.mpdamage[moveName] = getLevelValue(eff.mpdamage, level);
                        }
                        
                        if ("delay" in eff) {
                            if (target.battle.delay <= 0) {
                                target.battle.delay = getLevelValue(eff.delay, level);
                            }
                        }
                        if ("attackElement" in eff) {
                            target.battle.attackElement = eff.attackElement;
                            target.battle.counters.effects.attackElement = duration;
                            target.battle.effects.attackElement = moveName;
                        }
                        if ("defenseElement" in eff) {
                            target.battle.defenseElement = eff.defenseElement;
                            target.battle.counters.effects.defenseElement = duration;
                            target.battle.effects.defenseElement = moveName;
                        }
                        if ("focus" in eff) {
                            focusList = this.team1.indexOf(target) !== -1 ? this.team1Focus : this.team2Focus;
                            if (focusList.indexOf(target) === -1) {
                                focusList.push(target);
                            }
                            target.battle.counters.effects.focus = duration;
                            target.battle.effects.focus = moveName;
                        }
                            
                        if ("message" in eff && effectsMessages.targetEffect.indexOf(target.name) === -1) {
                            effectsMessages.targetEffect.push(target.name);
                        }
                    }
                    if (move.effect.user && (!move.effect.userChance || Math.random() < getLevelValue(move.effect.userChance, level))) {
                        eff = move.effect.user;
                        
                        //Apply attribute bonus for player attributes (str, def, etc) and modifiers (accuracy, critical, etc).
                        for (e in bonusAtt) {
                            if (bonusAtt[e] in eff) {
                                player.battle.bonus[moveName] = {};
                                
                                for (e in bonusAtt) {
                                    bonus = bonusAtt[e];
                                    if (bonus in eff) {
                                        player.battle.bonus[moveName][bonus] = getLevelValue(eff[bonus], level);
                                        if (["str", "def", "spd", "dex", "mag"].indexOf(bonus) !== -1) {
                                            player.battle.attributes[bonus] = getFullValue(player, bonus);
                                        } else {
                                            player.battle.attributes[bonus] = this.getBuffedMultiplier(player, bonus);
                                        }
                                    }
                                }
                                player.battle.counters.bonus[moveName] = duration;
                                break;
                            }
                        }
                        if ("mp" in eff) {
                            tempDmg = getLevelValue(eff.mp, level);
                            player.mp += tempDmg;
                            userMpDmg += tempDmg;
                        }
                        if ("hp" in eff) {
                            tempDmg = getLevelValue(eff.hp, level);
                            player.hp += tempDmg;
                            userDmg += tempDmg;
                        }
                        if ("mpPercent" in eff) {
                            tempDmg = Math.round(getLevelValue(eff.mpPercent, level) * player.maxmp);
                            player.mp += tempDmg;
                            userMpDmg += tempDmg;
                        }
                        if ("hpPercent" in eff) {
                            tempDmg = Math.round(getLevelValue(eff.hpPercent, level) * player.maxhp);
                            player.hp += tempDmg;
                            userDmg += tempDmg;
                        }
                        //Damage Over Time Effect
                        if ("hpdamage" in eff) {
                            player.battle.counters.overTime[moveName] = duration;
                            player.battle.hpdamage[moveName] = getLevelValue(eff.hpdamage, level);
                        }
                        if ("mpdamage" in eff) {
                            player.battle.counters.overTime[moveName] = duration;
                            player.battle.mpdamage[moveName] = getLevelValue(eff.mpdamage, level);
                        }
                        
                        if ("delay" in eff) {
                            if (player.battle.delay <= 0) {
                                player.battle.delay = getLevelValue(eff.delay, level);
                            }
                        }
                        if ("attackElement" in eff) {
                            player.battle.attackElement = eff.attackElement;
                            player.battle.counters.effects.attackElement = duration;
                            player.battle.effects.attackElement = moveName;
                        }
                        if ("defenseElement" in eff) {
                            player.battle.defenseElement = eff.defenseElement;
                            player.battle.counters.effects.defenseElement = duration;
                            player.battle.effects.defenseElement = moveName;
                        }
                        if ("focus" in eff) {
                            focusList = this.team1.indexOf(player) !== -1 ? this.team1Focus : this.team2Focus;
                            if (focusList.indexOf(player) === -1) {
                                focusList.push(player);
                            }
                            player.battle.counters.effects.focus = duration;
                            player.battle.effects.focus = moveName;
                        }
                            
                        if ("message" in eff && effectsMessages.targetEffect.indexOf(player.name) === -1) {
                            effectsMessages.targetEffect.push(player.name);
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
                    if ("summon" in move.effect) {
                        if (!("summons" in target.battle)) {
                            target.battle.summons = {};
                        }
                        if (!(moveName in target.battle.summons)) {
                            target.battle.summons[moveName] = [];
                        }
                        targetTeam = this.team1.indexOf(target) !== -1 ? this.team1 : this.team2;
                        var summoned, limit = {}, mon, maxMon, summonFailed = true;
                        
                        for (mon in move.effect.summon) {
                            limit[mon] = 0;
                        }
                        
                        for (mon in target.battle.summons[moveName]) {
                            maxMon = target.battle.summons[moveName][mon].id;
                            limit[maxMon] += 1;
                        }
                        
                        for (mon in move.effect.summon) {
                            var limitNum;
                            maxMon = limit[mon] + getLevelValue(move.effect.summon[mon], level);
                            if (move.effect.summonLimit && move.effect.summonLimit !== false) {
                                if (move.effect.summonLimit === true) {
                                    limitNum = getLevelValue(move.effect.summon[mon], level);
                                } else {
                                    limitNum = getLevelValue(move.effect.summonLimit, level);
                                }
                            } else {
                                limitNum = maxMon;
                            }
                            
                            for (var sum = limit[mon]; sum < maxMon; ++sum) {
                                // TO-DO: Make it actually check if the number for the name is unused
                                // summoned = game.generateMonster(mon, sum + 1);
                                if (target.battle.summons[moveName].length >= limitNum) {
                                    break;
                                }
                                
                                summoned = this.game.generateMonster(mon);
                                summoned.summoner = target;
                                summoned.isSummon = true;
                                targetTeam.push(summoned);
                                
                                summoned.battle = {
                                    counters: {
                                        bonus: {},
                                        overTime: {},
                                        effects: {}
                                    },
                                    bonus: {},
                                    effects: {},
                                    hpdamage:{},
                                    mpdamage:{},
                                    delay: 0,
                                    attributes: {
                                        str: getFullValue(summoned, "str"),
                                        def: getFullValue(summoned, "def"),
                                        spd: getFullValue(summoned, "spd"),
                                        dex: getFullValue(summoned, "dex"),
                                        mag: getFullValue(summoned, "mag"),
                                        accuracy: this.getBuffedMultiplier(summoned, "accuracy"),
                                        evasion: this.getBuffedMultiplier(summoned, "evasion"),
                                        critical: this.getBuffedMultiplier(summoned, "critical"),
                                        attackSpeed: this.getBuffedMultiplier(summoned, "attackSpeed")
                                    }
                                };
                                
                                target.battle.summons[moveName].push(summoned);
                                effectsMessages.summons.push(summoned.name);
                                summonFailed = false;
                            }
                        }
                        
                        if (summonFailed) {
                            effectsMessages.summonFailed = true;
                        }
                    }
                }
                
                if (damage > 0) {
                    if (move.effect && move.effect.hpabsorb) {
                        tempDmg = Math.floor(damage * getLevelValue(move.effect.hpabsorb, level));
                        player.hp += tempDmg;
                        userDmg += tempDmg;
                    }
                    if (move.effect && move.effect.mpabsorb) {
                        tempDmg = Math.floor(damage * getLevelValue(move.effect.mpabsorb, level));
                        player.mp += tempDmg;
                        userMpDmg += tempDmg;
                    }
                    if (this.hasEquipEffect(player, "hpabsorb")) {
                        tempDmg = Math.floor(damage * this.getEquipPercentage(player, "hpabsorb"));
                        player.hp += tempDmg;
                        userDmg += tempDmg;
                    }
                    if (this.hasEquipEffect(player, "mpabsorb")) {
                        tempDmg = Math.floor(damage * this.getEquipPercentage(player, "mpabsorb"));
                        player.mp += tempDmg;
                        userMpDmg += tempDmg;
                    }
                }
                
                target.hp -= damage;
                
                if (damage !== 0) {
                    if (!(target.name in effectsMessages.damaged)) {
                        effectsMessages.damaged[target.name] = [];
                    }
                    effectsMessages.damaged[target.name].push("<b>" + (damage < 0 ? "+" : "") + (-damage) + (critical === this.battleSetup.critical ? "*" : "") + "</b>");
                }
                if (userDmg !== 0) {
                    if (!(player.name in effectsMessages.damaged)) {
                        effectsMessages.damaged[player.name] = [];
                    }
                    effectsMessages.damaged[player.name].push("<b>" + (userDmg > 0 ? "+" : "") + (userDmg) + "</b>");
                }
                if (mpDmg !== 0) {
                    if (!(target.name in effectsMessages.damagedMp)) {
                        effectsMessages.damagedMp[target.name] = [];
                    }
                    effectsMessages.damagedMp[target.name].push("<b>" + (mpDmg > 0 ? "+" : "") + (mpDmg) + "</b>");
                }
                if (userMpDmg !== 0) {
                    if (!(player.name in effectsMessages.damagedMp)) {
                        effectsMessages.damagedMp[player.name] = [];
                    }
                    effectsMessages.damagedMp[player.name].push("<b>" + (userMpDmg > 0 ? "+" : "") + (userMpDmg) + "</b>");
                }
                
                if (player.hp <= 0) {
                    player.hp = 0;
                    if (effectsMessages.defeated.indexOf(player) === -1) {
                        effectsMessages.defeated.push(player);
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
                    if (effectsMessages.defeated.indexOf(target) === -1) {
                        effectsMessages.defeated.push(target);
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
            
            var allDmg = {}, dam, dmgmsg;
            for (dam in effectsMessages.damaged) {
                if (!(dam in allDmg)) {
                    allDmg[dam] = 1;
                }
            }
            for (dam in effectsMessages.damagedMp) {
                if (!(dam in allDmg)) {
                    allDmg[dam] = 1;
                }
            }
            for (dam in allDmg) {
                dmgmsg = [];
                if (dam in effectsMessages.damaged) {
                    dmgmsg.push(effectsMessages.damaged[dam].map(getNumberSign).join(", ") + " HP");
                }
                if (dam in effectsMessages.damagedMp) {
                    dmgmsg.push(effectsMessages.damagedMp[dam].map(getNumberSign).join(", ") + " MP");
                }
                
                effectsMessages.damagedNames.push(dam + " (" + dmgmsg.join(", ") + ")");
            }
            
            var moveMessage = (moveName === "attack" && player.isPlayer === true && player.equips.rhand && player.equips.rhand !== null && this.items[player.equips.rhand].message) ? this.items[player.equips.rhand].message : move.message;
            out.push(moveMessage.replace(/~User~/g, player.name).replace(/~Target~/g, readable(effectsMessages.targets, "and")) + (effectsMessages.damagedNames.length > 0 ? " " + effectsMessages.damagedNames.join(", ") + "!" : "") + (effectsMessages.evaded.length > 0 ? " " + readable(effectsMessages.evaded, "and") + " evaded!" : ""));
            
            if (effectsMessages.summons.length > 0) {
                out.push(readable(effectsMessages.summons, "and") + " joined " + target.name + "'s side!");
            } else if (effectsMessages.summonFailed === true) {
                out.push(player.name + " couldn't summon anything!");
            }
            
            if (effectsMessages.castBreak.length > 0) {
                out.push(readable(effectsMessages.castBreak, "and") + "'s concentration was broken!");
            }
            if (effectsMessages.targetEffect.length > 0) {
                out.push(move.effect.target.message.replace(/~Target~/g, readable(effectsMessages.targetEffect, "and")).replace(/~User~/g, player.name));
            }
            if (effectsMessages.userEffect.length > 0) {
                out.push(move.effect.user.message.replace(/~Target~/g, readable(effectsMessages.userEffect, "and")).replace(/~User~/g, player.name));
            }
            
            if (effectsMessages.defeated.length > 0) {
                out.push(readable(effectsMessages.defeated.map(getName), "and") + (effectsMessages.defeated.length > 1 ? " were" : " was") + " defeated!");
                
                for (var defe in effectsMessages.defeated) {
                    if (effectsMessages.defeated[defe].isSummon && effectsMessages.defeated[defe].hp === 0) {
                        this.removeSummon(effectsMessages.defeated[defe]);
                    }
                }
                winner = this.checkWin();
                if (winner !== null) {
                    break;
                }
            }
        }
    }
    
    // Turn Events here
    var battlers = team1.concat(team2);
    var buffs, b, counters;
    /*var translations = {
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
    };*/
    function translateSkill(x) { return this.skills[x].name; }
    for (i = 0; i < battlers.length; ++i) {
        player = battlers[i];
        buffs = [];
        var hpGain = this.getPassiveValue(player, "hpdamage") + this.getEquipValue(player, "hpdamage");
        var mpGain = this.getPassiveValue(player, "mpdamage") + this.getEquipValue(player, "mpdamage");
        
        counters = player.battle.counters.overTime;
        for (b in counters) {
            if (counters[b] > 0) {
                counters[b]--;
                if (b in player.battle.hpdamage && player.hp > 0) {
                    hpGain += player.battle.hpdamage[b];
                }
                if (b in player.battle.mpdamage && player.hp > 0) {
                    mpGain += player.battle.mpdamage[b];
                }
                if (counters[b] <= 0 && buffs.indexOf(b) === -1) {
                    buffs.push(b);
                }
            }
        }
        counters = player.battle.counters.bonus;
        for (b in counters) {
            if (counters[b] > 0) {
                counters[b]--;
                if (counters[b] <= 0) {
                    if (buffs.indexOf(b) === -1) {
                        buffs.push(b);
                    }
                    delete player.battle.bonus[b];
                }
            }
        }
        counters = player.battle.counters.effects;
        for (b in counters) {
            if (counters[b] > 0) {
                counters[b]--;
                if (counters[b] <= 0) {
                    if (b === "attackElement") {
                        player.battle.attackElement = null;
                        if (buffs.indexOf(player.battle.effects.attackElement) === -1) {
                            buffs.push(player.battle.effects.attackElement);
                        }
                    } else if (b === "defenseElement") {
                        player.battle.defenseElement = null;
                        if (buffs.indexOf(player.battle.effects.defenseElement) === -1) {
                            buffs.push(player.battle.effects.defenseElement);
                        }
                    } else if (b === "focus") {
                        focusList = this.team1.indexOf(player) !== - 1 ? this.team1Focus : this.team2Focus;
                        focusList.splice(focusList.indexOf(player), 1);
                        if (buffs.indexOf(player.battle.effects.focus) === -1) {
                            buffs.push(player.battle.effects.focus);
                        }
                    }
                }
            }
        }
        
        var gained = [];
        var lost = [];
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
        
        if (buffs.length > 0 && player.hp > 0) {
            out.push("The effects of " + readable(buffs.map(translateSkill, this) , "and") + " on " + player.name + " ended.");
        }
        
        if (player.isSummon && player.hp === 0) {
            this.removeSummon(player);
        }
    }
    out.push(this.lifeBar(this.team2));
    out.push(this.lifeBar(this.team1));
    this.sendToViewers(out);
    winner = this.checkWin();
    if (winner !== null) {
        this.finishBattle(winner);
    }
    this.turn++;
};
Battle.prototype.lifeBar = function(team) {
    var out = [];
    var dead = 0;
    for (var p in team) {
        if (team[p].isPlayer === true || team[p].hp > 0) {
            out.push(getPlayerHP(team[p]));
        } else {
            dead++;
        }
    }
    return "⇛ " + out.join(", ") + (dead > 0 ? (out.length > 0 ? ", " : "") + dead + " Dead Monster" + (dead > 1 ? "s" : "") : "");
};
Battle.prototype.removeSummon = function(monster) {
    var summonTeam = this.team1.indexOf(monster) !== -1 ? this.team1 : this.team2;
    summonTeam.splice(summonTeam.indexOf(monster), 1);
    
    var summoner = monster.summoner;
    var s, l, list;
    
    for (s in summoner.battle.summons) {
        for (l in summoner.battle.summons[s]) {
            list = summoner.battle.summons[s];
            if (list.indexOf(monster) !== -1) {
                list.splice(list.indexOf(monster), 1);
            }
        }
    }
};
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
Battle.prototype.sendToViewers = function(msg, bypass) {
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
        size = this.getAvatar(viewer).fontSize || 11;
        if (size > 0 || bypass === true) {
            sys.sendHtmlMessage(viewer, '<span style="font-size:' + size + 'px;">' + msg + '</span>', this.rpgchan);
        }
    }
};
Battle.prototype.finishBattle = function(win) {
    var winner = (win === 1) ? this.team1 : this.team2;
    var loser = (win === 1) ? this.team2 : this.team1;
    
    var winNames;
    var loseNames;
    
    if (this.isPVP) {
        winNames = win === 1 ? this.titleNames1 : this.titleNames2;
        loseNames = win === 1 ? this.titleNames2 : this.titleNames1;
        
        if (win === 0) {
            rpgbot.sendAll("The battle between " + readable(winNames, "and") + " and " + readable(loseNames, "and") + " ended in a draw!", this.rpgchan);
        } else {
            rpgbot.sendAll(readable(winNames, "and") + " defeated " + readable(loseNames, "and") + "!", this.rpgchan);
        }
    } else {
        winNames = win === 1 ? this.names1 : this.names2;
        loseNames = win === 1 ? this.names2 : this.names1;
        if (win === 0) {
            this.sendToViewers("The battle between " + readable(winNames, "and") + " and " + readable(loseNames, "and") + " ended in a draw!", true);
        } else {
            this.sendToViewers(readable(winNames, "and") + " defeated " + readable(loseNames, "and") + "!", true);
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
    var p;
    for (p in loser) {
        var lost = loser[p];
        if (lost.isPlayer) {
            if (!this.places[lost.location].noGoldLoss || this.places[lost.location].noGoldLoss !== true) {
                rpgbot.sendMessage(lost.id, "You lost " + Math.floor(lost.gold * 0.1) + " Gold!", this.rpgchan);
                lost.gold = Math.floor(lost.gold * 0.9);
            }
        } else if (!lost.isSummon){
            if (lost.gold) {
                gold += Math.floor(lost.gold);
            }
            if (lost.exp) {
                monsterExp += Math.floor(lost.exp);
            }
        }
    }
    
    if (win !== 0) {
        for (p = winner.length - 1; p >= 0; --p) {
            if (winner[p].isSummon) {
                winner.splice(p, 1);
            }
        }
        var partyBonus = 1 + (winner.length - 1) * this.battleSetup.partyExp;
        
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
                    if (m.isPlayer === false && m.isSummon !== true) {
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
                                if (this.game.canHoldItems(this.game.getItemCount(won, loot) + 1)) {
                                    this.game.changeItemCount(won, loot, 1);
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
                        itemsFound.push(lootFound[l] + " " + this.items[l].name + (lootFound[l] > 1 ? "(s)" : ""));
                    }
                    rpgbot.sendMessage(won.id, "You found " + readable(itemsFound, "and") + "!", this.rpgchan);
                }
                
                var goldMultiplier = this.getPassiveMultiplier(won, "goldBonus") * this.leveling.battleGold;
                gainedGold = Math.floor(gold * goldMultiplier);
                if (gainedGold > 0) {
                    won.gold += gainedGold;
                }
                
                gainedExp = Math.floor((monsterExp + Math.floor(playerExp / won.level)) * this.getPassiveMultiplier(won, "expBonus") * this.leveling.battleExp * partyBonus);
                if (gainedExp > 0 || gainedGold > 0) {
                    rpgbot.sendMessage(won.id, "You received " + (gainedExp > 0 ? gainedExp + " Exp. Points" : "") + (gainedExp > 0 && gainedGold > 0 ? " and " : "") + (gainedGold > 0 ? gainedGold + " Gold" : "") + "!", this.rpgchan);
                }
                if (gainedExp > 0) {
                    this.game.receiveExp(won.id, gainedExp);
                }
            }
        }
    }
    this.destroyBattle();
};
Battle.prototype.removePlayer = function(src) {
    var player = this.getAvatar(src),
        name = player.name,
        found = false,
        team;
        
    for (var s in this.team1) {
        if (this.team1[s] === player) {
            this.team1.splice(s, 1);
            team = this.team1;
            found = true;
            break;
        }
    }
    for (s in this.team2) {
        if (this.team2[s] === player) {
            this.team2.splice(s, 1);
            team = this.team2;
            found = true;
            break;
        }
    }
    if (found) {
        if (this.team1Focus.indexOf(player) !== -1) {
            this.team1Focus.splice(this.team1Focus.indexOf(player), 1);
        }
        if (this.team2Focus.indexOf(player) !== -1) {
            this.team2Focus.splice(this.team2Focus.indexOf(player), 1);
        }
        
        if (player.hp === 0 || this.isPVP === true) {
            if (!this.places[player.location].noGoldLoss || this.places[player.location].noGoldLoss !== true) {
                rpgbot.sendMessage(src, "You lost " + Math.floor(player.gold * 0.1) + " Gold!", this.rpgchan);
                player.gold = Math.floor(player.gold * 0.9);
            }
        }
        this.sendToViewers(name + " ran away!");
        
        if ("summons" in player.battle) {
            for (s in player.battle.summons) {
                for (var m = player.battle.summons[s].length -1; m >= 0; --m) {
                    var summon = player.battle.summons[s][m];
                    player.battle.summons[s].splice(m, 1);
                    team.splice(team.indexOf(summon), 1);
                }
            }
        }
        
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
    var player;
    for (var p in allPlayers) {
        player = allPlayers[p];
        if (player.isPlayer) {
            player.isBattling = false;
            player.battle = {};
            player.bonus.battle = {
                str: 0,
                def: 0,
                spd: 0,
                dex: 0,
                mag: 0
            };
            if (this.forceSave) {
                this.game.saveGame(player.id);
            }
        }
    }
    this.game.currentBattles.splice(this.game.currentBattles.indexOf(this), 1);
};
Battle.prototype.isInBattle = function(src) {
    var player = this.getAvatar(src);
    for (var s in this.team1) {
        if (this.team1[s] === player) {
            return true;
        }
    }
    for (s in this.team2) {
        if (this.team2[s] === player) {
            return true;
        }
    }
    return false;
};
Battle.prototype.getAvatar = function(src) {
    return SESSION.users(src)[this.game.rpgAtt];
};
Battle.prototype.getTitlePlayer = function(player) {
    return (player.currentTitle !== null && player.currentTitle in this.titles ? this.titles[player.currentTitle].name + " " : "") + player.name;
};

Battle.prototype.getBuffedMultiplier = function(p, att) {
    var result = 1 * this.getPassiveMultiplier(p, att) * this.getEquipMultiplier(p, att);
    
    for (var e in p.battle.bonus) {
        if (att in p.battle.bonus[e]) {
            result *= p.battle.bonus[e][att];
        }
    }
    
    return result;
};
Battle.prototype.hasEquipEffect = function(player, effect) {
    if (!player.isPlayer) {
        return false;
    }
    var e, it;
    for (e in player.equips) {
        it = player.equips[e];
        if (it !== null && "effect" in this.items[it] && effect in this.items[it].effect) {
            return true;
        }
    }
    return false;
};
Battle.prototype.getEquipMultiplier = function(player, effect) {
    var multiplier = 1;
    if (!player.isPlayer) {
        return multiplier;
    }
    var e, it;
    for (e in player.equips) {
        it = player.equips[e];
        if (it !== null && "effect" in this.items[it] && effect in this.items[it].effect) {
            multiplier *= this.items[it].effect[effect];
        }
    }
    return multiplier;
};
Battle.prototype.getEquipValue = function(player, effect) {
    var result = 0;
    if (!player.isPlayer) {
        return result;
    }
    var e, it;
    for (e in player.equips) {
        it = player.equips[e];
        if (it !== null && "effect" in this.items[it] && effect in this.items[it].effect) {
            result += this.items[it].effect[effect];
        }
    }
    return result;
};
Battle.prototype.getEquipPercentage = function(player, effect) {
    var percentage = 0;
    if (!player.isPlayer) {
        return percentage;
    }
    var e, it;
    for (e in player.equips) {
        it = player.equips[e];
        if (it !== null && "effect" in this.items[it] && effect in this.items[it].effect) {
            percentage += this.items[it].effect[effect];
        }
    }
    return percentage;
};
Battle.prototype.getPassiveMultiplier = function(player, effect) {
    var multiplier = 1;
    for (var s in player.passives) {
        if (this.skills[s].effect && effect in this.skills[s].effect) {
            multiplier *= getLevelValue(this.skills[s].effect[effect], player.passives[s] - 1);
        }
    }
    return multiplier;
};
Battle.prototype.getPassiveValue = function(player, effect) {
    var v = 0;
    for (var s in player.passives) {
        if (this.skills[s].effect && effect in this.skills[s].effect) {
            v += getLevelValue(this.skills[s].effect[effect], player.passives[s] - 1);
        }
    }
    return v;
};
Battle.prototype.getPassiveByEffect = function(player, effect) {
    var list = [];
    for (var s in player.passives) {
        if (this.skills[s].effect && effect in this.skills[s].effect) {
            list.push(s);
        }
    }
    return list;
};

function getName(x) {
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
function getFullValue(p, att) {
    var result = p[att] + p.bonus.equip[att] + p.bonus.skill[att];
    
    for (var e in p.battle.bonus) {
        if (att in p.battle.bonus[e]) {
            result += p.battle.bonus[e][att];
        }
    }
    
    return result;
}
function getPlayerHP(x) {
    return x.name + " (" + x.hp + " HP" + (x.hp > 0 ? ", " + x.mp + " MP)" : ")");
}
function getNumberSign(x) { 
    return (x >= 0 ? "+" + x : x); 
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
function shuffle(o) {
    for (var j, x, i = o.length; i; j = parseInt(Math.random() * i, 10), x = o[--i], o[i] = o[j], o[j] = x){ o = o; }
    return o;
}

exports.Battle = Battle;
