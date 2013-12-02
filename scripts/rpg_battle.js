// Global variables inherited from scripts.js
/*global rpgbot, sys, SESSION, exports*/
function Battle(viewers, teamA, teamB, rpg) {
    this.game = rpg;
    this.rpgchan = rpg.rpgchan;
    this.classes = rpg.classes;
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
            attributes: {},
            summons: {}
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
            attributes: {},
            summons: {}
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
    
    var player, side, target, targets, damage, mpDmg, castComplete, focusList, winner, eff, effectResult, reactors, reactions, reSkill, triggers, r, type, autoCast, autoCastLevel, instantAutoCast, isAutoCast;
    var effectsMessages;
    for (i = 0; i < priority.length; ++i) {
        winner = null;
        player = priority[i];
        side = team1.indexOf(player) !== -1 ? 1 : 2;
        targets = [];
        focusList = [];
        reactors = [];
        castComplete = false;
        isAutoCast = false;
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
            var moveName,
                move,
                level = 1;
            
            if (castComplete === true) {
                moveName = player.battle.skillCasting;
            } else if (autoCast) {
                moveName = autoCast;
                autoCast = null;
                isAutoCast = true;
            } else {
                moveName = randomSample(this.getPlan(player));
            }
                
            if (moveName === null || (!(moveName in this.skills) && moveName[0] !== "~")) {
                moveName = this.battleSetup.defaultSkill;
            }
            
            //Using Item instead of Skill
            if (moveName[0] === "~") {
                var itemName = moveName.substr(1);
                var item = this.items[itemName];
                
                if (this.game.hasItem(player, itemName, 1) === false) {
                    out.push(player.name + " tried to use a " + item.name + ", but didn't have any!");
                    continue;
                }
                
                var gainedLife = player.hp,
                    gainedMana = player.mp;
                
                target = player;
                if ("battleEffect" in item) {
                    var itemEff = item.battleEffect,
                        itemDuration = itemEff.duration || 6,
                        itemResult;
                    
                    target = this.getTarget(player, (itemEff.target || "self"), 1, side, (itemEff.hitDead || "none"));
                    
                    if (target.length === 0) {
                        out.push(player.name + " tried to use a " + item.name + ", but didn't anyone to use it on!");
                        continue;
                    } else {
                        target = target[0];
                    }
                    
                    gainedLife = target.hp,
                    gainedMana = target.mp;
                    
                    var itemEffect = this.applyBattleEffect(target, moveName, itemEff, 1, itemDuration);
                    
                    target.hp += itemEffect.hpDmg;
                    target.mp += itemEffect.mpDmg;
                    
                    if ("physical" in itemEff || "magical" in itemEff) {
                        type = "physical" in itemEff ? "physical" : "magical";
                        move = {
                            name: item.name,
                            type: type,
                            modifier: itemEff[type],
                            element: itemEff.element || "none",
                            effect: {
                                snipe: true
                            }
                        };
                        itemResult = this.attackPlayer(player, target, move, 1);
                    }
                    target.hp -= (itemResult ? itemResult.damage : 0);
                }
                
                if (target.hp > target.maxhp) {
                    target.hp = target.maxhp;
                } else if (target.hp <= 0) {
                    target.hp = 0;
                    effectsMessages.defeated.push(target);
                }
                if (target.mp > target.maxmp) {
                    target.mp = target.maxmp;
                } else if (target.mp < 0) {
                    target.mp = 0;
                }
                
                gainedLife = target.hp - gainedLife;
                gainedMana = target.mp - gainedMana;
                
                var gainedmsg = [];
                if (gainedLife !== 0) {
                    gainedmsg.push("<b>" + getNumberSign(gainedLife) + "</b> HP");
                }
                if (gainedMana !== 0) {
                    gainedmsg.push("<b>" + getNumberSign(gainedMana) + "</b> MP");
                }
                
                var itemmsg = "battleMessage" in item ? item.battleMessage.replace(/~User~/gi, player.name).replace(/~Target~/gi, target.name) : player.name + " used a " + item.name + (target !== player ? " on " + target.name : "") + "!";
                itemmsg += gainedmsg.length > 0 ? " " + target.name + " (" + gainedmsg.join(", ") + ")" : "";
                out.push(itemmsg);
                
                this.game.changeItemCount(player, itemName, -1);
                
                if (effectsMessages.defeated.length > 0) {
                    out.push(readable(effectsMessages.defeated.map(getName), "and") + " was defeated!");
                    winner = this.checkWin();
                    if (winner !== null) {
                        break;
                    }
                }
                continue;
            }
            
            move = this.skills[moveName];
            if (isAutoCast) {
                level = autoCastLevel;
            } else if (player.isPlayer && moveName in player.skillLevels && player.skillLevels[moveName] < player.skills[moveName]) {
                level = player.skillLevels[moveName];
            } else if (moveName in player.skills){
                level = player.skills[moveName];
            } else if (player.isPlayer && "boundSkills" in this.classes[player.job] && moveName in this.classes[player.job].boundSkills) {
                level = this.classes[player.job].boundSkills[moveName] - 1;
            } else {
                for (r in player.equips) {
                    if (player.equips[r] !== null) {
                        var equip = this.items[player.equips[r]];
                        if ("effect" in equip && "boundSkills" in equip.effect && moveName in equip.effect.boundSkills && equip.effect.boundSkills[moveName] > level) {
                            level = equip.effect.boundSkills[moveName];
                        }
                    }
                }
            }
            
            level = level -1;
            
            var mpModifier = this.getPassiveMultiplier(player, "mpModifier");
            var targetTeam, n, added = 0;
            
            if (player.mp < Math.floor(getLevelValue(move.cost, level) * mpModifier)) {
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
            
            if (instantAutoCast !== true && !castComplete && "cast" in move) {
                var cast = Math.round((getLevelValue(move.cast, level) + this.getPassiveValue(player, "castTime")) * this.getPassiveMultiplier(player, "castMultiplier"));
                
                if (cast > 0 || (cast === 0 && this.battleSetup.instantCast === false)) {
                    out.push(player.name + " is preparing to use " + this.skills[moveName].name + "!");
                    player.battle.casting = cast;
                    player.battle.skillCasting = moveName;
                    continue;
                }
            } else {
                instantAutoCast = false;
                player.battle.casting = null;
            }
            
            var hitDead = move.hitDead ? move.hitDead.toLowerCase() : "none";
            targets = this.getTarget(player, move.target.toLowerCase(), (move.targetCount ? getLevelValue(move.targetCount, level) : 1), side, hitDead);
            
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
            
            var breakCast, attackResult, skillElement = "none";
            for (var t = 0; t < targets.length; ++t) {
                target = targets[t];
                reactions = [];
                triggers = {};
                breakCast = false;
                damage = 0;
                mpDmg = 0;
                var critical = 1;
                if ((hitDead === "none" && target.hp === 0) || (hitDead === "only" && target.hp > 0)) {
                    continue;
                }
                
                if (move.type === "physical" || move.type === "magical") {
                    attackResult = this.attackPlayer(player, target, move, level);
                    
                    if (attackResult.evaded) {
                        if (effectsMessages.evaded.indexOf(target.name) === -1) {
                            effectsMessages.evaded.push(target.name);
                        }
                        if (attackResult.chained) {
                            for (var v = t + 1; v < targets.length; ++v) {
                                if (effectsMessages.evaded.indexOf(targets[v].name) === -1) {
                                    effectsMessages.evaded.push(targets[v].name);
                                }
                            }
                            break;
                        }
                        continue;
                    }
                    
                    damage = attackResult.damage;
                    critical = attackResult.critical;
                    
                    triggers.elementalDamage = attackResult.element;
                    skillElement = attackResult.element;
                    triggers.criticalHit = critical === this.battleSetup.critical;
                } 
                var userDmg = 0, userMpDmg = 0, tempDmg;
                if (move.effect) {
                    var duration = move.effect.duration ? getLevelValue(move.effect.duration, level) : 6;
                    
                    if (move.effect.target && (!move.effect.targetChance || Math.random() < getLevelValue(move.effect.targetChance, level))) {
                        eff = move.effect.target;
                        effectResult = this.applyBattleEffect(target, moveName, eff, level, duration);
                        
                        damage -= effectResult.hpDmg;
                        mpDmg += effectResult.mpDmg;
                            
                        if ("message" in eff && effectsMessages.targetEffect.indexOf(target.name) === -1) {
                            effectsMessages.targetEffect.push(target.name);
                        }
                        
                        for (r in effectResult.reaction) {
                            triggers[r] = effectResult.reaction[r];
                        }
                    }
                    if (move.effect.user && (!move.effect.userChance || Math.random() < getLevelValue(move.effect.userChance, level))) {
                        eff = move.effect.user;
                        effectResult = this.applyBattleEffect(player, moveName, eff, level, duration);
                        
                        player.hp += effectResult.hpDmg;
                        userDmg += effectResult.hpDmg;
                        userMpDmg += effectResult.mpDmg;
                            
                        if ("message" in eff && effectsMessages.targetEffect.indexOf(player.name) === -1) {
                            effectsMessages.targetEffect.push(player.name);
                        }
                    }
                    if (target.battle.casting !== null && move.effect.breakCast && this.skills[target.battle.skillCasting].avoidBreakCast !== true && Math.random() < getLevelValue(move.effect.breakCast, level)) {
                        breakCast = true;
                        target.battle.casting = null;
                        target.battle.skillCasting = null;
                        if (effectsMessages.castBreak.indexOf(target.name) === -1) {
                            effectsMessages.castBreak.push(target.name);
                        }
                        triggers.breakCast = true;
                    }
                    if ("summon" in move.effect) {
                        var summonResult = this.summonMonster(target, moveName, level);
                        
                        effectsMessages.summonFailed = summonResult.summonFailed;
                        effectsMessages.summons = summonResult.summons;
                        triggers.summon = !summonResult.summonFailed;
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
                    triggers.damage = -damage;
                    triggers[move.type] = -damage;
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
                    triggers.mp = mpDmg;
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
            
                if (reactors.indexOf(target) === -1 && side !== (this.team1.indexOf(target) !== -1 ? 1 : 2)) {
                    reactions = this.getPassiveByEffect(target, "reaction");
                    var re, reValue, reLevel, reactionFound, allConditions;
                    for (r in reactions) {
                        //Compare Triggers here
                        reSkill = this.skills[reactions[r]].effect.reaction;
                        reLevel = target.passives[reactions[r]] - 1;
                        allConditions = reSkill.allConditions || false;
                        reactionFound = allConditions;
                        
                        for (re in reSkill.trigger) {
                            if (re in triggers) {
                                if (["damage", "physical", "magical", "support", "mp", "str", "def", "spd", "dex", "mag", "delay", "hpdamage", "mpdamage"].indexOf(re) !== -1) {
                                    reValue = getLevelValue(reSkill.trigger[re], reLevel);
                                    if (reValue < 0 && triggers[re] <= reValue) {
                                        reactionFound = true;
                                    } else if (reValue > 0 && triggers[re] >= reValue) {
                                        reactionFound = true;
                                    } else {
                                        reactionFound = false;
                                    }
                                } else if (["accuracy", "evasion", "critical", "attackSpeed"].indexOf(re) !== -1) {
                                    reValue = getLevelValue(reSkill.trigger[re], reLevel);
                                    if (reValue < 1 && triggers[re] <= reValue) {
                                        reactionFound = true;
                                    } else if (reValue > 1 && triggers[re] >= reValue) {
                                        reactionFound = true;
                                    } else {
                                        reactionFound = false;
                                    }
                                } else if (["criticalHit", "focus", "breakCast", "attackElement", "defenseElement", "summon"].indexOf(re) !== -1) {
                                    if (reSkill.trigger[re] === triggers[re]) {
                                        reactionFound = true;
                                    } else {
                                        reactionFound = false;
                                    }
                                } else if (["elementalDamage"].indexOf(re) !== -1) {
                                    if (reSkill.trigger[re].indexOf(triggers[re]) !== -1) {
                                        reactionFound = true;
                                    } else {
                                        reactionFound = false;
                                    }
                                }
                            } else if (allConditions === true) {
                                reactionFound = false;
                                break;
                            }
                            
                            if ((allConditions === true && reactionFound === false) || (allConditions === false && reactionFound === true)) {
                                break;
                            }
                        }
                        
                        if (reactionFound) {
                            target.battle.reaction = reactions[r];
                            reactors.push(target);
                            break;
                        }
                    }
                }
            }
            
            var allDmg = {}, dam;
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
                effectsMessages.damagedNames.push(this.playerDamageText(dam, (dam in effectsMessages.damaged ? effectsMessages.damaged[dam] : null), (dam in effectsMessages.damagedMp ? effectsMessages.damagedMp[dam] : null)));
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
            
            var reactionName, reactionLevel, reactionDuration, reactionResult, reactionDamage, reactionEvasion, counter;
            for (r in reactors) {
                //Check reaction chance
                target = reactors[r];
                reactionName = target.battle.reaction;
                reSkill = this.skills[reactionName];
                reactionLevel = target.passives[reactionName];
                reactionDuration = reSkill.effect.reaction.duration ? getLevelValue(reSkill.effect.reaction.duration, reactionLevel) : 6;
                reactionDamage = [];
                reactionEvasion = false;
                
                if (target.hp > 0 && (!("chance" in reSkill.effect.reaction) || Math.random() <= getLevelValue(reSkill.effect.reaction.chance, reactionLevel))) {
                    //Apply reaction effect
                    if ("target" in reSkill.effect.reaction) {
                        eff = reSkill.effect.reaction.target;
                        damage = 0;
                        mpDmg = 0;
                        
                        if ("physical" in eff || "magical" in eff) {
                            type = "physical" in eff ? "physical" : "magical";
                            counter = {
                                name: reSkill.name,
                                type: type,
                                modifier: getLevelValue(eff[type], reactionLevel),
                                element: eff.element || "none",
                                effect: {
                                    accuracy: eff.attackAccuracy,
                                    snipe: eff.snipe
                                }
                            };
                            reactionResult = this.attackPlayer(target, player, counter, reactionLevel);
                        }
                        
                        if (reactionResult) {
                            if (!reactionResult.evaded) {
                                player.hp -= reactionResult.damage;
                                damage -= reactionResult.damage;
                            } else {
                                reactionEvasion = true;
                            }
                        }
                        
                        if (reactionEvasion !== true) {
                            effectResult = this.applyBattleEffect(player, reactionName, eff, reactionLevel, reactionDuration);
                            
                            damage += effectResult.hpDmg;
                            mpDmg += effectResult.mpDmg;
                            
                            if (damage !== 0 || mpDmg !== 0) {
                                damage = damage !== 0 ? getNumberSign(damage) : damage;
                                mpDmg = mpDmg !== 0 ? getNumberSign(mpDmg) : mpDmg;
                                reactionDamage.push(this.playerDamageText(player.name, damage, mpDmg, true));
                            }
                        }
                    }
                    if ("user" in reSkill.effect.reaction && reactionEvasion !== true) {
                        eff = reSkill.effect.reaction.user;
                        effectResult = this.applyBattleEffect(target, reactionName, eff, reactionLevel, reactionDuration);
                        
                        damage = effectResult.hpDmg;
                        mpDmg = effectResult.mpDmg;
                        
                        if (damage !== 0 || mpDmg !== 0) {
                            damage = damage !== 0 ? getNumberSign(damage) : damage;
                            mpDmg = mpDmg !== 0 ? getNumberSign(mpDmg) : mpDmg;
                            reactionDamage.push(this.playerDamageText(target.name, damage, mpDmg, true));
                        }
                    }
                    
                    out.push(reSkill.effect.reaction.message.replace(/~Target~/g, player.name).replace(/~User~/g, target.name) + " " + (reactionDamage.length > 0 ? reactionDamage.join(", ") + "!" : "") + (reactionEvasion === true ? " " + player.name + " evaded!" : "") );
                    
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
                target.battle.reaction = null;
            }
            
            if (!isAutoCast && player.isPlayer === true) {
                var acEquip, acInfo, acTrigger, acFound = false;
                for (r in player.equips) {
                    if (player.equips[r] !== null) {
                        acEquip = this.items[player.equips[r]];
                        if ("effect" in acEquip && "autoCast" in acEquip.effect) {
                            for (t in acEquip.effect.autoCast) {
                                acInfo = acEquip.effect.autoCast[t];
                                acTrigger = acInfo.trigger;
                                if (Math.random() <= acInfo.chance) {
                                    if ("skill" in acTrigger) {
                                        if (acTrigger.skill.indexOf(moveName) !== -1 && acInfo.chance) {
                                            acFound = true;
                                        }
                                    } else if ("anySkillBut" in acTrigger) {
                                        if (acTrigger.anySkillBut.indexOf(moveName) === -1) {
                                            acFound = true;
                                        }
                                    } else if ("type" in acTrigger) {
                                        if (acTrigger.type.indexOf(move.type) !== -1) {
                                            acFound = true;
                                        }
                                    } else if ("element" in acTrigger) {
                                        if (acTrigger.element.indexOf(skillElement) !== -1) {
                                            acFound = true;
                                        }
                                    }
                                    if (acFound) {
                                        autoCast = t;
                                        autoCastLevel = acInfo.level;
                                        instantAutoCast = acInfo.instantCast || false;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (acFound) {
                        priority.splice(i, 0, player);
                        break;
                    }
                }
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
            out.push("The effects of " + readable(buffs.map(this.skillOrItem, this) , "and") + " on " + player.name + " ended.");
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
Battle.prototype.getPlan = function(player) {
    if (player.planMode === "advanced") {
        var p, plan, type, conditions, c, cond, conditionMet, param, sign, val, hasFalse, hasTrue, noTrue, result, count, e, target,
            side = this.team1.indexOf(player) !== -1 ? 1 : 2,
            playerSide = side === 1 ? this.team1.concat() : this.team2.concat(),
            enemySide = side === 1 ? this.team2.concat() : this.team1.concat();
            
        for (p = 0; p < player.advStrategy.length; p++) {
            plan = player.advStrategy[p];
            if (plan !== null) {
                if (plan[0] === "") {
                    return plan[1];
                }
                
                type = plan[0].indexOf(":") !== -1 ? ":" : "*";
                conditions = plan[0].split(type);
                hasFalse = false, hasTrue = false;
                conditionMet = false;
                
                for (c in conditions) {
                    cond = conditions[c];
                    sign = cond.indexOf(">") !== -1 ? ">" : "<";
                    
                    param = cond.substring(0, cond.indexOf(sign));
                    val = parseInt(cond.substr(cond.indexOf(sign) + 1), 10);
                    
                    switch(param) {
                        case "hp":
                            result = player.hp / player.maxhp * 100;
                            break;
                        case "mp":
                            result = player.mp / player.maxmp * 100;
                            break;
                        case "allyhp":
                            result = [];
                            for (e in playerSide) {
                                target = playerSide[e];
                                if (target !== player) {
                                    result.push(target.hp / target.maxhp * 100);
                                }
                            }
                            break;
                        case "allymp":
                            result = [];
                            for (e in playerSide) {
                                target = playerSide[e];
                                if (target !== player) {
                                    result.push(target.mp / target.maxmp * 100);
                                }
                            }
                            break;
                        case "partyhp":
                            count = 0;
                            for (e in playerSide) {
                                target = playerSide[e];
                                count += target.hp / target.maxhp * 100;
                            }
                            result = count / playerSide.length;
                            break;
                        case "partymp":
                            count = 0;
                            for (e in playerSide) {
                                target = playerSide[e];
                                count += target.mp / target.maxmp * 100;
                            }
                            result = count / playerSide.length;
                            break;
                        case "enemyhp":
                            result = [];
                            for (e in enemySide) {
                                target = enemySide[e];
                                result.push(target.hp / target.maxhp * 100);
                            }
                            break;
                        case "enemymp":
                            result = [];
                            for (e in enemySide) {
                                target = enemySide[e];
                                result.push(target.mp / target.maxmp * 100);
                            }
                            break;
                        case "epartyhp":
                            count = 0;
                            for (e in enemySide) {
                                target = enemySide[e];
                                count += target.hp / target.maxhp * 100;
                            }
                            result = count / enemySide.length;
                            break;
                        case "epartymp":
                            count = 0;
                            for (e in enemySide) {
                                target = enemySide[e];
                                count += target.mp / target.maxmp * 100;
                            }
                            result = count / enemySide.length;
                            break;
                        case "gold":
                            result = player.gold;
                            break;
                        case "enemies":
                            result = 0;
                            for (e in enemySide) {
                                if (enemySide[e].hp > 0) {
                                    result += 1;
                                }
                            }
                            break;
                        default: 
                            if (param.indexOf("~") === 0) {
                                result = this.game.getItemCount(player, param.substr(1));
                            }
                            break;
                    }
                    
                    if (Array.isArray(result)) {
                        noTrue = true;
                        for (e in result) {
                            if (sign === ">") {
                                if (val <= result[e]) {
                                    hasTrue = true;
                                    noTrue = false;
                                } 
                            } else if (sign === "<") {
                                if (val >= result[e]) {
                                    hasTrue = true;
                                    noTrue = false;
                                } 
                            }
                        }
                        if (noTrue) {
                            hasFalse = true;
                        }
                    } else {
                        if (sign === ">") {
                            if (result >= val) {
                                hasTrue = true;
                            } else {
                                hasFalse = true;
                            }
                        } else if (sign === "<") {
                            if (result <= val) {
                                hasTrue = true;
                            } else {
                                hasFalse = true;
                            }
                        }
                    }
                    
                    if (type === ":" && hasFalse) {
                        break;
                    }
                    if (type === "*" && hasTrue) {
                        conditionMet = true;
                        break;
                    }
                }
                if (type === ":" && hasFalse === false) {
                    conditionMet = true;
                }
                if (conditionMet) {
                    return plan[1];
                }
            }
        }
    } else {
        return player.strategy;
    }
    return player.strategy;
};
Battle.prototype.getTarget = function(player, target, count, side, hitDead) {
    var targets = [],
        targetTeam,
        focusList,
        added = 0;
    
    switch (target) {
        case "self":
            targets.push(player);
            break;
        case "party":
            targetTeam = side === 1 ? shuffle(this.team1.concat()) : shuffle(this.team2.concat());
            focusList = side === 1 ? shuffle(this.team1Focus.concat()) : shuffle(this.team2Focus.concat());
            break;
        case "ally":
            targetTeam = side === 1 ? shuffle(this.team1.concat()) : shuffle(this.team2.concat());
            focusList = side === 1 ? shuffle(this.team1Focus.concat()) : shuffle(this.team2Focus.concat());
            if (targetTeam.indexOf(player) !== -1) {
                targetTeam.splice(targetTeam.indexOf(player), 1);
            }
            if (focusList.indexOf(player) !== -1) {
                focusList.splice(focusList.indexOf(player), 1);
            }
            break;
        case "enemy":
            targetTeam = side === 1 ? shuffle(this.team2.concat()) : shuffle(this.team1.concat());
            focusList = side === 1 ? shuffle(this.team2Focus.concat()) : shuffle(this.team1Focus.concat());
            break;
        case "all":
            targetTeam = shuffle(this.team1.concat(this.team2));
            focusList = shuffle(this.team1Focus.concat(this.team2Focus));
            break;
    }
    if (target !== "self") {
        for (n = 0; n < focusList.length && added < count; ++n) {
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
    
    return targets;
};
Battle.prototype.attackPlayer = function(player, target, move, level) {
    var result = {
        damage: 0,
        reaction: {},
        critical: 1,
        evaded: false,
        chained: false,
        element: "none"
    };
    var acc = player.battle.attributes.dex * ((move.effect && move.effect.accuracy) ? getLevelValue(move.effect.accuracy, level) : 1) * player.battle.attributes.accuracy;
    var evd = target.battle.attributes.spd * this.battleSetup.evasion * target.battle.attributes.evasion;
    if (acc <= 0) {
        acc = 1;
    }
    if (evd <= 0) {
        evd = 1;
    }
    var evadeCheck = this.battleSetup.baseAccuracy + ((acc - evd) / 100);
    if (evadeCheck < 0.05) {
        evadeCheck = 0.05;
    } else if (evadeCheck > 0.95) {
        evadeCheck = 0.95;
    }
    if (!(move.effect && move.effect.snipe && move.effect.snipe === true) && Math.random() > evadeCheck) {
        result.evaded = true;
        if (move.effect && move.effect.chained && move.effect.chained === true) {
            result.chained = true;
        }
        return result;
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
    var goldDamageSkills = this.getPassiveByEffect(player, "goldDamage"), attackBonus = 0;
    if (goldDamageSkills.length > 0) {
        var goldUsed, goldLevel;
        for (var g in goldDamageSkills) {
            goldLevel = player.passives[goldDamageSkills[g]] - 1;
            goldUsed = getLevelValue(this.skills[goldDamageSkills[g]].effect.goldDamage.cost, goldLevel);
            if (player.gold >= goldUsed) {
                attackBonus += getLevelValue(this.skills[goldDamageSkills[g]].effect.goldDamage.modifier, goldLevel);
                player.gold -= goldUsed;
            }
        }
    }
    if (move.effect && move.effect.levelDamage) {
        attackBonus += Math.floor(player.level * getLevelValue(move.effect.levelDamage, level));
    }
    
    var main = power;
    power = power * (getLevelValue(move.modifier, level) + attackBonus) * pinch * this.battleSetup.damage * (1 + (this.battleSetup.levelDamageBonus * player.level));
    
    var def = (target.battle.attributes.def * (1 - this.battleSetup.secondaryDefense) + target.battle.attributes[move.type === "physical" ? "str" : "mag"] * this.battleSetup.secondaryDefense) * this.battleSetup.defense;
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
    result.element = atkElement;
    
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
    
    
    var invert = move.type === "physical" ? player.battle.attributes.mag : player.battle.attributes.str;
    main = main <= 0 ? 1 : main;
    invert = invert <= 0 ? 1 : invert;
    var varRange = (invert / main > 1 ? 1 : invert / main) * 0.25;
    var variation = (0.75 + varRange) + (Math.random() * (0.25 - varRange));
    
    var critical;
    if (power < 0) {
        critical = 1;
    } else {
        var critChance = (invert / main) * 0.66 * player.battle.attributes.critical;
        critical = (Math.random() < critChance) ? this.battleSetup.critical : 1;
    }
    variation = (critical === this.battleSetup.critical) ? 1 : variation;
    result.critical = critical;
    result.damage = Math.floor((power / def) * element * variation * critical) + (getLevelValue(move.modifier, level) >= 0 ? 1 : -1);
    
    return result;
};
Battle.prototype.applyBattleEffect = function(target, moveName, eff, level, duration) {
    var bonusAtt = ["str", "def", "spd", "dex", "mag", "accuracy", "critical", "evasion", "attackSpeed"],
        e,
        bonus,
        tempDmg,
        result = {
            hpDmg: 0,
            mpDmg: 0,
            reaction: {}
        };
    
    //Apply attribute bonus for player attributes (str, def, etc) and modifiers (accuracy, critical, etc).
    for (e in bonusAtt) {
        if (bonusAtt[e] in eff) {
            target.battle.bonus[moveName] = {};
            
            for (e in bonusAtt) {
                bonus = bonusAtt[e];
                if (bonus in eff) {
                    target.battle.bonus[moveName][bonus] = getLevelValue(eff[bonus], level);
                    result.reaction[bonus] = getLevelValue(eff[bonus], level);
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
        result.mpDmg += tempDmg;
    }
    if ("hp" in eff) {
        result.hpDmg += getLevelValue(eff.hp, level);
    }
    if ("mpPercent" in eff) {
        tempDmg = Math.round(getLevelValue(eff.mpPercent, level) * target.maxmp);
        target.mp += tempDmg;
        result.mpDmg += tempDmg;
    }
    if ("hpPercent" in eff) {
        result.hpDmg += Math.round(getLevelValue(eff.hpPercent, level) * target.maxhp);
    }
    //Damage Over Time Effect
    if ("hpdamage" in eff) {
        target.battle.counters.overTime[moveName] = duration;
        target.battle.hpdamage[moveName] = getLevelValue(eff.hpdamage, level);
        result.reaction.hpdamage = getLevelValue(eff.hpdamage, level);
    }
    if ("mpdamage" in eff) {
        target.battle.counters.overTime[moveName] = duration;
        target.battle.mpdamage[moveName] = getLevelValue(eff.mpdamage, level);
        result.reaction.mpdamage = getLevelValue(eff.mpdamage, level);
    }
    
    if ("delay" in eff) {
        if (target.battle.delay <= 0) {
            target.battle.delay = getLevelValue(eff.delay, level);
            result.reaction.delay = getLevelValue(eff.delay, level);
        }
    }
    if ("attackElement" in eff) {
        target.battle.attackElement = eff.attackElement;
        target.battle.counters.effects.attackElement = duration;
        target.battle.effects.attackElement = moveName;
        result.reaction.attackElement = true;
    }
    if ("defenseElement" in eff) {
        target.battle.defenseElement = eff.defenseElement;
        target.battle.counters.effects.defenseElement = duration;
        target.battle.effects.defenseElement = moveName;
        result.reaction.defenseElement = true;
    }
    if ("focus" in eff) {
        var focusList = this.team1.indexOf(target) !== -1 ? this.team1Focus : this.team2Focus;
        if (focusList.indexOf(target) === -1) {
            focusList.push(target);
        }
        target.battle.counters.effects.focus = duration;
        target.battle.effects.focus = moveName;
        result.reaction.focus = true;
    }
    
    return result;
};
Battle.prototype.summonMonster = function(player, moveName, level) {
    var result = {
        summonFailed: true,
        summons: []
    };
    var move = this.skills[moveName];
    var targetTeam = this.team1.indexOf(player) !== -1 ? this.team1 : this.team2;
    var summoned, previous = {}, necessary = {}, usedIds = {}, mon, max, id;
    
    if (!(moveName in player.battle.summons)) {
        player.battle.summons[moveName] = [];
    } 
    for (mon in player.battle.summons[moveName]) {
        id = player.battle.summons[moveName][mon].id;
        if (!(id in previous)) {
            previous[id] = 0;
            usedIds[id] = [];
        }
        previous[id] += 1;
        usedIds[id].push(player.battle.summons[moveName][mon].summonId);
    }
    
    for (mon in move.effect.summon) {
        necessary[mon] = getLevelValue(move.effect.summon[mon], level);
        
        if (move.effect.summonLimit && move.effect.summonLimit !== false) {
            if (mon in previous) {
                if (move.effect.summonLimit === true) {
                    necessary[mon] -= previous[mon];
                } else {
                    max = getLevelValue(move.effect.summonLimit, level);
                    if (previous[mon] + necessary[mon] > max) {
                        necessary[mon] = max - previous[mon];
                    }
                }
            }
        }
    }
    
    for (mon in move.effect.summon) {
        for (max = necessary[mon]; max > 0; --max) {
            id = 1;
            if (mon in usedIds) {
                while (usedIds[mon].indexOf(id) !== -1) {
                    id++;
                }
            } else {
                usedIds[mon] = [];
            }
            
            usedIds[mon].push(id);
            summoned = this.game.generateMonster(mon, id);
            summoned.summoner = player;
            summoned.isSummon = true;
            summoned.summonId = id;
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
                },
                summons: {}
            };
            
            player.battle.summons[moveName].push(summoned);
            result.summons.push(summoned.name);
            result.summonFailed = false;
        }
    }
    
    return result;
    
};
Battle.prototype.playerDamageText = function(name, damage, mpDamage, bold) {
    var hpDmg, mpDmg, result = [];
    if (damage) {
        if (Array.isArray(damage)) {
            hpDmg = damage.join(", ") + " HP";
        } else {
            if (bold) {
                hpDmg = "<b>" + damage + "</b> HP";
            } else {
                hpDmg = damage + " HP";
            }
        }
        result.push(hpDmg);
    }
    if (mpDamage) {
        if (Array.isArray(mpDamage)) {
            mpDmg = mpDamage.join(", ") + " MP";
        } else {
            if (bold) {
                mpDmg = "<b>" + mpDamage + "</b> MP";
            } else {
                mpDmg = mpDamage + " MP";
            }
        }
        result.push(mpDmg);
    }
    if (result.length > 0) {
        return name + " (" + result.join(", ") + ")";
    } else {
        return null;
    }
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
                var share = 0, guild;
                if (won.guild !== null) {
                    guild = this.game.guilds[won.guild];
                    share = guild.expShare[won.name.toLowerCase()];
                }
                gainedExp = Math.floor((monsterExp + Math.floor(playerExp / won.level)) * this.getPassiveMultiplier(won, "expBonus") * this.leveling.battleExp * partyBonus);
                if (gainedExp > 0 || gainedGold > 0) {
                    rpgbot.sendMessage(won.id, "You received " + (gainedExp > 0 ? gainedExp + " Exp. Points" + (share > 0 ? " (" + (share * 100) + "% sent to Guild)" : "") : "") + (gainedExp > 0 && gainedGold > 0 ? " and " : "") + (gainedGold > 0 ? gainedGold + " Gold" : "") + "!", this.rpgchan);
                }
                if (gainedExp > 0) {
                    if (share > 0) {
                        guild.giveExp(won, Math.round(gainedExp * share));
                        gainedExp = Math.round(gainedExp * (1 - share));
                    }
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
Battle.prototype.skillOrItem = function(obj) {
    return obj[0] === "~" ? this.items[obj.substr(1)].name : this.skills[obj].name;
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
        } else if (level < 0) {
            return att[0];
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
    return null;
}
function shuffle(o) {
    for (var j, x, i = o.length; i; j = parseInt(Math.random() * i, 10), x = o[--i], o[i] = o[j], o[j] = x){ o = o; }
    return o;
}

exports.Battle = Battle;
